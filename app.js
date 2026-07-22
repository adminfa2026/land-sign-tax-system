const key = 'tax-property-prototype-v2';
const firebaseConfig = {apiKey:'AIzaSyDHqzuk1uJ-cO5lQiHYabtTDH5wMJsJKF4',authDomain:'land-sign-tax-system.firebaseapp.com',projectId:'land-sign-tax-system',storageBucket:'land-sign-tax-system.firebasestorage.app',messagingSenderId:'459116004427',appId:'1:459116004427:web:7509b32a2485a45a3179ce'};
const adminEmail = 'fa@impact.co.th';

const signRates = [
  {code:'1ก', rate:10, description:'ป้ายที่มีอักษรไทยล้วน — เคลื่อนที่ได้'},
  {code:'1ข', rate:5, description:'ป้ายที่มีอักษรไทยล้วน'},
  {code:'2ก', rate:52, description:'ป้ายที่มีอักษรไทยปนกับอักษรต่างประเทศ โดยอักษรไทยอยู่บนสุด — เคลื่อนที่ได้'},
  {code:'2ข', rate:26, description:'ป้ายที่มีอักษรไทยปนกับอักษรต่างประเทศ โดยอักษรไทยอยู่บนสุด'},
  {code:'3ก', rate:52, description:'ป้ายที่ไม่มีอักษรไทย หรืออักษรไทยอยู่ต่ำกว่าอักษรต่างประเทศ — เคลื่อนที่ได้'},
  {code:'3ข', rate:50, description:'ป้ายที่ไม่มีอักษรไทย หรืออักษรไทยอยู่ต่ำกว่าอักษรต่างประเทศ'}
];
const sample = { signs: [], land: [] };
let db = JSON.parse(localStorage.getItem(key)||'null') || sample, type='sign', editing=null, cloudDb=null, cloudReady=false, isAdmin=false;
const $ = s => document.querySelector(s);
const fmt = n => '฿'+Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const cm = n => Number(n||0).toLocaleString('th-TH',{maximumFractionDigits:2});
const rateFor = code => signRates.find(x=>x.code===code) || signRates[0];
function calcSign(x){
  const totalSize = Number(x.width||0) * Number(x.length||0) * Number(x.qty||0);
  const units = Math.ceil(totalSize / 500);
  const rate = rateFor(x.category).rate;
  return {totalSize, units, rate, tax: totalSize ? Math.max(200, units * rate) : 0};
}
function syncMessage(message){ const el=$('#syncStatus'); if(el) el.textContent=message; }
function usernameToInternalEmail(username){
  const value=username.trim().toLowerCase();
  // The screen accepts the short username "fa" and also the real account
  // address, so an already-signed-in admin is never redirected to login
  // merely because of the display username.
  return value === 'fa' || value === adminEmail.toLowerCase() ? adminEmail : value;
}
function hasAdminAccess(user){ return Boolean(user && String(user.email||'').trim().toLowerCase() === adminEmail.toLowerCase()); }
function updateAccess(user){
  isAdmin=hasAdminAccess(user);
  document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('hidden',!isAdmin));
  $('#loginButton').classList.toggle('hidden',isAdmin); $('#logoutButton').classList.toggle('hidden',!isAdmin);
  if(isAdmin) syncMessage(`Admin: ${user.email.split('@')[0]}`); else syncMessage('โหมดดูข้อมูลและ Export');
  render();
}
function migrate(data){
  data.signs = (data.signs||[]).map(x => {
    if (x.height && !x.length) x.length = Number(x.height) * 100; // old prototype used metres
    if (x.width && Number(x.width) < 50) x.width = Number(x.width) * 100;
    x.qty = Number(x.qty||1); x.category=x.category||'2ข'; x.owner=x.owner||'IMPACT';
    x.images = x.images || (x.image ? [x.image] : []); delete x.image; delete x.height;
    return {...x, ...calcSign(x)};
  });
  data.land = data.land || [];
  return data;
}
db=migrate(db);
function connectFirebase(){
  try {
    if(!window.firebase) throw new Error('Firebase SDK unavailable');
    if(!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    // Explicit persistence prevents a successful login from being discarded
    // while the user continues to work on the same browser.
    firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(error=>console.warn('Auth persistence:',error));
    cloudDb=firebase.firestore();
    firebase.auth().onAuthStateChanged(updateAccess);
    const record=cloudDb.collection('taxData').doc('current');
    record.onSnapshot(async snapshot=>{
      if(snapshot.exists){ const remote=snapshot.data(); if(Array.isArray(remote.signs)&&Array.isArray(remote.land)){ db=migrate(remote); cloudReady=true; localStorage.setItem(key,JSON.stringify(db)); render(); syncMessage('เชื่อมข้อมูลกลางแล้ว'); } }
      else { cloudReady=true; if(isAdmin) { await record.set(db); syncMessage('สร้างข้อมูลกลางแล้ว'); } }
    }, error=>{ console.error(error); syncMessage('ใช้ข้อมูลในเครื่อง (ต้องตั้ง Firestore Rules)'); });
  } catch(error) { console.error(error); syncMessage('ใช้ข้อมูลในเครื่อง'); }
}
function save(){
  if(!isAdmin){ alert('เฉพาะ Admin ที่เข้าสู่ระบบเท่านั้นที่แก้ไขข้อมูลได้'); return; }
  localStorage.setItem(key,JSON.stringify(db));
  if(cloudDb&&cloudReady){ syncMessage('กำลังบันทึกข้อมูลกลาง…'); cloudDb.collection('taxData').doc('current').set(db).then(()=>syncMessage('เชื่อมข้อมูลกลางแล้ว')).catch(e=>{console.error(e);syncMessage('บันทึกข้อมูลกลางไม่สำเร็จ — รูปอาจมีขนาดใหญ่เกินไป');}); }
}
const statusClass=s=>s==='ชำระแล้ว'?'paid':s==='ตรวจสอบแล้ว'?'checked':'pending';
function thumbnails(images=[]){ return images.length ? images.slice(0,2).map((src,i)=>`<img class="thumb" src="${src}" alt="รูปป้าย ${i+1}">`).join('') : '<span class="no-image">ไม่มีรูป</span>'; }
function totals(){
  const st=db.signs.reduce((a,x)=>a+Number(x.tax||0),0), lt=db.land.reduce((a,x)=>a+Number(x.tax||0),0), all=[...db.signs,...db.land];
  $('#signTotal').textContent=fmt(st); $('#landTotal').textContent=fmt(lt); $('#pending').textContent=all.filter(x=>x.status==='รอตรวจสอบ').length; $('#paid').textContent=all.length?Math.round(all.filter(x=>x.status==='ชำระแล้ว').length/all.length*100)+'%':'0%';
  $('#signCompare').textContent='คำนวณตามหมวดที่เลือก'; $('#landCompare').textContent='เทียบปีก่อน: ตั้งต้นข้อมูล';
  $('#recent').innerHTML=[...db.signs.map(x=>({...x,kind:'ป้าย'})),...db.land.map(x=>({...x,id:x.deed,kind:'ที่ดิน'}))].slice(0,5).map(x=>`<div class="recent-row"><span><b>${x.id}</b><br><small>${x.kind}</small></span><span>${x.name}</span><span>${fmt(x.tax)}</span><span><span class="badge ${statusClass(x.status)}">${x.status}</span></span><span>ปี 2569</span></div>`).join('');
}
function render(){
  totals(); const search=$('#signSearch').value.toLowerCase(), status=$('#signStatus').value;
  $('#signRows').innerHTML=db.signs.filter(x=>(!search||`${x.id} ${x.name} ${x.location} ${x.owner}`.toLowerCase().includes(search))&&(!status||x.status===status)).map(x=>`<tr><td class="image-cell">${thumbnails(x.images)}</td><td><b>${x.id}</b><br><small>${x.name}</small></td><td>${x.owner}</td><td>${x.location}</td><td>${cm(x.width)} × ${cm(x.length)} ซม.<br><small>จำนวน ${x.qty} ป้าย</small></td><td><b>${cm(x.totalSize)}</b><br><small>ตร.ซม.</small></td><td>${x.category}<br><small>${fmt(x.rate)} / 500 ตร.ซม.</small></td><td><b>${fmt(x.tax)}</b></td><td><span class="badge ${statusClass(x.status)}">${x.status}</span></td><td>${isAdmin?`<button class="row-action" onclick="openEdit('sign','${x.id}')">แก้ไข</button>`:''}</td></tr>`).join('');
  $('#landRows').innerHTML=db.land.map(x=>`<tr><td><b>${x.deed}</b></td><td>${x.name}</td><td>${Number(x.area).toLocaleString()} ตร.ว.</td><td>${x.use}</td><td>${fmt(x.appraisal)}</td><td><b>${fmt(x.tax)}</b></td><td><span class="badge ${statusClass(x.status)}">${x.status}</span></td><td>${isAdmin?`<button class="row-action" onclick="openEdit('land','${x.deed}')">แก้ไข</button>`:''}</td></tr>`).join('');
  $('#rateRows').innerHTML=signRates.map(x=>`<tr><td><b>${x.code}</b></td><td>${fmt(x.rate)}</td><td>${x.description}</td></tr>`).join('');
}
function signFields(x={}){ const c=calcSign(x); return `
  <label>รหัสป้าย<input name="id" required value="${x.id||''}"></label><label>ชื่อ/รายละเอียดป้าย<input name="name" required value="${x.name||''}"></label>
  <label>เจ้าของป้าย<select name="owner"><option ${x.owner==='IMPACT'?'selected':''}>IMPACT</option><option ${x.owner==='REIT'?'selected':''}>REIT</option></select></label><label>สถานที่<input name="location" required value="${x.location||''}"></label>
  <label>ประเภท/หมวดภาษี<select name="category" id="categorySelect">${signRates.map(r=>`<option value="${r.code}" ${x.category===r.code?'selected':''}>${r.code} — ${r.description}</option>`).join('')}</select></label><label>อัตราภาษี<input id="ratePreview" readonly value="${fmt(c.rate)} ต่อ 500 ตร.ซม."></label>
  <label>กว้าง (เซนติเมตร)<input id="widthInput" type="number" min="0" step=".01" name="width" required value="${x.width||''}"></label><label>ยาว (เซนติเมตร)<input id="lengthInput" type="number" min="0" step=".01" name="length" required value="${x.length||''}"></label>
  <label>จำนวนป้าย<input id="qtyInput" type="number" min="1" step="1" name="qty" required value="${x.qty||1}"></label><label>รวมขนาดทั้งสิ้น<input id="totalSizePreview" readonly value="${cm(c.totalSize)} ตร.ซม."></label>
  <label>ภาษีที่คำนวณได้<input id="taxPreview" readonly value="${fmt(c.tax)}"></label><label>สถานะ<select name="status">${['รอตรวจสอบ','ตรวจสอบแล้ว','ชำระแล้ว'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
  <label class="full-width">แนบรูปภาพป้าย <small>(สูงสุด 2 ภาพ · ระบบลดขนาดภาพก่อนบันทึก)</small><input id="imagesInput" type="file" accept="image/*" multiple><span id="imageCount" class="upload-note">${(x.images||[]).length ? `มีรูปเดิม ${(x.images||[]).length} ภาพ — เลือกไฟล์ใหม่เพื่อแทนที่` : 'ยังไม่ได้แนบรูปภาพ'}</span></label>
  <div id="imagePreview" class="image-preview full-width">${thumbnails(x.images)}</div>`; }
function landFields(x={}){return `<label>เลขโฉนด<input name="deed" required value="${x.deed||''}"></label><label>ที่ตั้ง / โครงการ<input name="name" required value="${x.name||''}"></label><label>พื้นที่ (ตร.ว.)<input type="number" name="area" required value="${x.area||''}"></label><label>การใช้ประโยชน์<input name="use" required value="${x.use||''}"></label><label>ราคาประเมิน<input type="number" name="appraisal" required value="${x.appraisal||''}"></label><label>ภาษี<input type="number" name="tax" required value="${x.tax||''}"></label><label>สถานะ<select name="status">${['รอตรวจสอบ','ตรวจสอบแล้ว','ชำระแล้ว'].map(s=>`<option ${x.status===s?'selected':''}>${s}</option>`).join('')}</select></label>`;}
function refreshCalculation(){ const form=$('#recordForm'), f=new FormData(form), x={width:+f.get('width')||0,length:+f.get('length')||0,qty:+f.get('qty')||0,category:f.get('category')}; const c=calcSign(x); $('#ratePreview').value=`${fmt(c.rate)} ต่อ 500 ตร.ซม.`; $('#totalSizePreview').value=`${cm(c.totalSize)} ตร.ซม.`; $('#taxPreview').value=fmt(c.tax); }
function openForm(t,x=null){
  // Use Firebase's current session as the source of truth as well as the UI
  // flag. This removes the timing gap between a successful login and the
  // onAuthStateChanged callback.
  if(!isAdmin && !hasAdminAccess(firebase.auth().currentUser)){ $('#loginModal').showModal(); return; }
  isAdmin=true;
  type=t; editing=x; $('#modalTitle').textContent=(x?'แก้ไข':'เพิ่ม')+(t==='sign'?'รายการป้าย':'รายการที่ดิน'); $('#formFields').innerHTML=t==='sign'?signFields(x||{}):landFields(x||{}); if(t==='sign'){ ['#categorySelect','#widthInput','#lengthInput','#qtyInput'].forEach(s=>$(s).addEventListener('input',refreshCalculation)); $('#imagesInput').addEventListener('change',previewImages); } $('#recordModal').showModal();
}
async function compressImage(file){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>{const img=new Image();img.onload=()=>{const max=700, scale=Math.min(1,max/Math.max(img.width,img.height)), canvas=document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.6));};img.onerror=reject;img.src=reader.result;};reader.onerror=reject;reader.readAsDataURL(file); }); }
async function previewImages(e){ const files=[...e.target.files]; if(files.length>2){ alert('แนบรูปภาพได้สูงสุด 2 ภาพ'); e.target.value=''; return; } try { const images=await Promise.all(files.map(compressImage)); e.target.dataset.images=JSON.stringify(images); $('#imagePreview').innerHTML=thumbnails(images); $('#imageCount').textContent=`พร้อมบันทึก ${images.length} ภาพ`; } catch { alert('ไม่สามารถอ่านไฟล์รูปภาพได้'); } }
window.openEdit=(t,id)=>openForm(t,db[t==='sign'?'signs':'land'].find(x=>(t==='sign'?x.id:x.deed)===id));
document.querySelectorAll('.nav,.go-view').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===b.dataset.view));document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===b.dataset.view))});
document.querySelectorAll('.go-add').forEach(b=>b.onclick=()=>openForm(b.dataset.type)); $('#signSearch').oninput=render; $('#signStatus').onchange=render;
function closeRecordModal(){ $('#recordModal').close(); editing=null; }
$('#closeModal').onclick=closeRecordModal;
$('#cancelRecord').onclick=closeRecordModal;
function closeLoginModal(){ $('#loginModal').close(); $('#loginError').textContent=''; $('#password').value=''; }
$('#loginButton').onclick=()=>$('#loginModal').showModal();
$('#closeLogin').onclick=closeLoginModal;
$('#cancelLogin').onclick=closeLoginModal;
$('#logoutButton').onclick=()=>firebase.auth().signOut();
$('#loginForm').onsubmit=async e=>{
  e.preventDefault(); const username=$('#username').value.trim(), password=$('#password').value;
  $('#loginError').textContent='กำลังตรวจสอบ Username และ Password…';
  try {
    const credential=await firebase.auth().signInWithEmailAndPassword(usernameToInternalEmail(username),password);
    if(!hasAdminAccess(credential.user)){
      await firebase.auth().signOut();
      throw Object.assign(new Error('not admin'),{code:'auth/not-admin'});
    }
    // Apply access immediately, instead of waiting for Firebase's async
    // observer. This is what lets the next click on Add/Edit work reliably.
    updateAccess(credential.user);
    closeLoginModal();
  }
  catch(error){
    console.error(error);
    const messages={
      'auth/operation-not-allowed':'Firebase ยังไม่ได้เปิดวิธี Email/Password — ไปที่ Authentication → Sign-in method แล้วเปิด Email/Password',
      'auth/invalid-credential':'Username หรือ Password ไม่ถูกต้อง — กรุณาใช้ Username: fa และ Password ของบัญชี Firebase fa@impact.co.th',
      'auth/user-not-found':'ไม่พบบัญชี Admin — ตรวจสอบ Firebase Authentication → Users',
      'auth/wrong-password':'Password ไม่ถูกต้อง',
      'auth/too-many-requests':'ลองรหัสผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่',
      'auth/network-request-failed':'ไม่สามารถเชื่อมต่อ Firebase ได้ กรุณาตรวจสอบอินเทอร์เน็ต'
      ,'auth/not-admin':'บัญชีนี้ไม่มีสิทธิ์ Admin'
    };
    $('#loginError').textContent=messages[error.code] || `เข้าสู่ระบบไม่สำเร็จ (${error.code||'unknown error'})`;
  }
};
$('#recordForm').onsubmit=e=>{ e.preventDefault(); let x=Object.fromEntries(new FormData(e.target)); ['width','length','qty','area','appraisal','tax'].forEach(k=>{if(k in x)x[k]=Number(x[k])}); if(type==='sign'){const inp=$('#imagesInput'); x.images=inp.dataset.images?JSON.parse(inp.dataset.images):(editing?.images||[]); Object.assign(x,calcSign(x));} const arr=db[type==='sign'?'signs':'land'], id=type==='sign'?'id':'deed',at=editing?arr.indexOf(editing):-1; if(at>=0)arr[at]=x;else arr.push(x); save(); closeRecordModal(); render(); };
function download(t='all'){const arr=t==='sign'?db.signs:t==='land'?db.land:[...db.signs,...db.land];const rows=arr.map(x=>{const y={...x,images:(x.images||[]).length+' ภาพ'};delete y.image;return y});const csv=[Object.keys(rows[0]||{}).join(','),...rows.map(x=>Object.values(x).map(v=>`"${String(v).replaceAll('"','""')}"`).join(','))].join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:'text/csv'}));a.download=`tax-${t}-2569.csv`;a.click();URL.revokeObjectURL(a.href)}
$('#export').onclick=()=>download(); document.querySelectorAll('.export-type').forEach(b=>b.onclick=()=>download(b.dataset.type)); $('#copyYear').onclick=()=>alert('ต้นแบบนี้จะเพิ่มการคัดลอกข้อมูลแยกตามปีในขั้นถัดไป'); render(); connectFirebase();

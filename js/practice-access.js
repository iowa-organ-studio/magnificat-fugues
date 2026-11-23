
import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, addDoc, updateDoc, getDocs, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:'AIzaSyBxtpx-CqMK4XWuRtihy0rSNe6AdAS0Gzc',
  authDomain:'organ-practice-tracker.firebaseapp.com',
  projectId:'organ-practice-tracker',
  storageBucket:'organ-practice-tracker.firebasestorage.app',
  messagingSenderId:'68830167607',
  appId:'1:68830167607:web:849cf39d0199ac317c75b2',
  measurementId:'G-XFM4VKFHWB'
};
const app=getApps().length?getApp():initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const UID_KEY='iowaOrganStudentUid';
const APP_ID='magnificat-fugues', CAP=300;
const root=document.getElementById('practiceAccessRoot');
root.innerHTML=`<div class="pa-bar"><button id="pa-login">Student login</button><button id="pa-history">My practice history</button></div>
<dialog id="pa-login-dialog"><div class="pa-head"><h2>Student login</h2><button id="pa-login-close" aria-label="Close">✕</button></div><div id="pa-out"><form id="pa-form"><label>Eight-digit student UID <input id="pa-uid" inputmode="numeric" maxlength="8" pattern="[0-9]{8}" required></label> <button type="submit">Sign in</button></form></div><div id="pa-in" hidden><p id="pa-welcome"></p><button id="pa-logout">Log out</button></div><p id="pa-message" role="status"></p></dialog>
<dialog id="pa-history-dialog"><div class="pa-head"><h2>My practice history</h2><button id="pa-history-close" aria-label="Close">✕</button></div><div id="pa-history-body" class="pa-scroll"></div></dialog>`;
const el=id=>root.querySelector('#'+id);
const loginDialog=el('pa-login-dialog'), historyDialog=el('pa-history-dialog');
el('pa-login').onclick=()=>loginDialog.showModal();
el('pa-login-close').onclick=()=>loginDialog.close();
el('pa-history').onclick=()=>{historyDialog.showModal();loadHistory();};
el('pa-history-close').onclick=()=>historyDialog.close();
let ready=false,queue=Promise.resolve();
function status(s){el('pa-message').textContent=s;}
function display(name){const logged=!!name;el('pa-out').hidden=logged;el('pa-in').hidden=!logged;el('pa-login').textContent=logged?'Student: '+name:'Student login';el('pa-welcome').textContent=logged?'Logged in as '+name:'';}
async function signInUid(uid){uid=uid.trim();if(!/^\d{8}$/.test(uid)){status('Enter an eight-digit student UID.');return;}
  status('Checking student UID...');
  try {const snap=await getDoc(doc(db,'users',uid));if(!snap.exists()){status('Student UID not found.');return;}
    if(localStorage.getItem(UID_KEY)!==uid)stopAttempt();localStorage.setItem(UID_KEY,uid);display(snap.data().name||uid);status('');startForSelected();
  }catch(e){console.error(e);status('Firebase lookup failed (' + (e.code || e.message || 'unknown error') + ').');}
}
el('pa-form').onsubmit=e=>{e.preventDefault();if(!ready){status('Connecting...');return;}signInUid(el('pa-uid').value);};
el('pa-logout').onclick=()=>{stopAttempt();localStorage.removeItem(UID_KEY);display(null);status('');};
onAuthStateChanged(auth,async user=>{if(!user){try{await signInAnonymously(auth);}catch(e){console.error(e);status('Firebase authentication failed (' + (e.code || e.message || 'unknown error') + ').');}return;}ready=true;const uid=localStorage.getItem(UID_KEY);if(uid)await signInUid(uid);else display(null);});
// A new fugue begins an attempt; changing its key never restarts it.
// A qualifying attempt requires 90 uninterrupted seconds in a visible tab.
const MIN_SECONDS=90;
let activeAttempt=null;
let creditTimer=null;
let selectedDetail=null;
const elapsed=a=>Math.min(CAP,Math.max(0,Math.floor(((a.endedAt||Date.now())-a.startedAt)/1000)));
function cancelCreditTimer(){if(creditTimer!==null){clearTimeout(creditTimer);creditTimer=null;}}
function enqueue(work){queue=queue.then(work).catch(e=>console.error('Practice save failed',e));return queue;}

async function saveQualifiedAttempt(a) {
  if (
    !a ||
    a.saved ||
    a.saving ||
    elapsed(a) < MIN_SECONDS
  ) return;

  a.saving = true;

  try {
    await auth.authStateReady();

    if (!auth.currentUser) {
      throw new Error('Firebase authentication unavailable');
    }

    const seconds = elapsed(a);

    const ref = await addDoc(
      collection(db, 'users', a.uid, 'webPractice'),
      {
        app: APP_ID,
        model: 'Pachelbel Magnificat Fugues',
        modelId: a.detail.id,
        exercise: a.detail.title,
        mode: a.detail.mode,
        key: a.startKey + ' ' +
          (a.detail.mode <= 4 ? 'minor' : 'major'),
        startedAt: serverTimestamp(),
        durationSeconds: seconds
      }
    );

    a.saved = ref.id;

    console.log(
      'Magnificat practice saved:',
      a.detail.title,
      seconds,
      'seconds'
    );

  } catch (error) {
    console.error(
      'Magnificat practice write failed:',
      error
    );
  } finally {
    a.saving = false;
  }
}

async function finalize(a) {
  if (!a || elapsed(a) < MIN_SECONDS) return;

  // Finish any pending first write before updating.
  if (a.saving) {
    await a.savingPromise;
  }

  if (!a.saved) {
    await saveQualifiedAttempt(a);
  }

  if (a.saved) {
    try {
      await updateDoc(
        doc(db, 'users', a.uid, 'webPractice', a.saved),
        { durationSeconds: elapsed(a) }
      );
    } catch (error) {
      console.error(
        'Could not finalize Magnificat practice:',
        error
      );
    }
  }
}

function stopAttempt() {
  cancelCreditTimer();

  const a = activeAttempt;
  activeAttempt = null;

  if (!a) return;

  a.endedAt = Date.now();

  enqueue(() => finalize(a));
}

function startForSelected() {
  const uid = localStorage.getItem(UID_KEY);

  if (
    !uid ||
    !ready ||
    !selectedDetail ||
    document.visibilityState !== 'visible'
  ) return;

  // Changing key does not restart the same fugue.
  if (
    activeAttempt &&
    activeAttempt.uid === uid &&
    activeAttempt.detail.id === selectedDetail.id
  ) return;

  stopAttempt();

  const a = {
    uid,
    detail: { ...selectedDetail },
    startKey: document.getElementById('key')?.value || '',
    startedAt: Date.now(),
    endedAt: null,
    saved: null,
    saving: false,
    savingPromise: null
  };

  activeAttempt = a;

  console.log(
    'Magnificat practice started:',
    a.detail.title
  );

  creditTimer = setTimeout(() => {
    if (activeAttempt !== a) return;

    a.savingPromise = enqueue(
      () => saveQualifiedAttempt(a)
    );
  }, MIN_SECONDS * 1000);
}

window.addEventListener('magnificat:fugue',event=>{
  const d=event.detail;
  if(!d?.id)return;
  if(selectedDetail?.id!==d.id)stopAttempt();
  selectedDetail={id:d.id,title:d.title||d.id,mode:d.mode};
  startForSelected();
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='hidden')stopAttempt();
  else startForSelected();
});
window.addEventListener('pagehide',stopAttempt);

// Venetian practice-history layout: tabs, subtabs, and key-by-exercise grid.
// The only domain-specific change is that the navigation represents fugue modes.
const KEY_ORDER=['C','G','D','A','E','B','F#','C#','F','Bb','Eb','Ab','Db','Gb','Cb',
  'a','e','b','f#','c#','g#','d#','a#','d','g','c','f','bb','eb','ab'];
const niceKey=k=>String(k||'').replace(/#/g,'♯').replace(/b/g,'♭');
const keyFromTonic=(tonic,minor)=>{
  if(!tonic)return null;
  const m=String(tonic).trim().replace(/♯/g,'#').replace(/♭/g,'b').match(/^([A-Ga-g])([#b]?)$/);
  if(!m)return null;
  const key=(minor?m[1].toLowerCase():m[1].toUpperCase())+m[2];
  return KEY_ORDER.includes(key)?key:null;
};
function historyKey(item){
  const raw=String(item.key||'').replace(/^Current key:\s*/i,'').trim();
  const tonic=raw.replace(/\s+(major|minor)\s*$/i,'').trim();
  const mode=Number(item.mode||String(item.modelId||'').match(/^mode(\d+)/)?.[1]);
  if(!mode)return null;
  return keyFromTonic(tonic,mode<=4);
}
function addButton(parent,label,selected,fn){
  const btn=document.createElement('button');btn.type='button';btn.className='pa-tab'+(selected?' pa-active':'');
  btn.textContent=label;btn.setAttribute('aria-pressed',String(selected));btn.onclick=fn;parent.append(btn);
}
function drawGrid(host,attempts,models){
  const allowed=new Set(models.map(x=>x.id));
  const names=new Map(models.map(x=>[x.id,x.title]));
  const byExercise=new Map();let skipped=0;
  for(const item of attempts){
    if(!allowed.has(item.modelId)||Number(item.durationSeconds)<MIN_SECONDS)continue;
    const key=historyKey(item);
    if(!key){skipped++;continue;}
    const name=names.get(item.modelId)||item.exercise||item.modelId;
    if(!byExercise.has(name))byExercise.set(name,new Map());
    const counts=byExercise.get(name);counts.set(key,(counts.get(key)||0)+1);
  }
  if(!byExercise.size){const msg=document.createElement('p');msg.textContent='No recorded fugues for this selection.';host.append(msg);return;}
  const wrap=document.createElement('div');wrap.className='pa-grid-scroll';
  const table=document.createElement('table');table.className='pa-grid';
  const header=document.createElement('thead'),hr=document.createElement('tr');
  for(const label of ['Exercise','Totals',...KEY_ORDER.map(niceKey)]){
    const th=document.createElement('th');th.textContent=label;hr.append(th);
  }
  header.append(hr);table.append(header);
  const body=document.createElement('tbody'),totals=Object.fromEntries(KEY_ORDER.map(k=>[k,0]));let grand=0;
  const rows=[...byExercise.entries()].sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true}));
  for(const [name,counts] of rows){
    const tr=document.createElement('tr'),sum=[...counts.values()].reduce((a,b)=>a+b,0);grand+=sum;
    for(const value of [name,sum,...KEY_ORDER.map(k=>{const v=counts.get(k)||0;totals[k]+=v;return v||'';})]){
      const td=document.createElement('td');td.textContent=value;tr.append(td);
    }
    body.append(tr);
  }
  const totalRow=document.createElement('tr');totalRow.className='pa-total-row';
  for(const value of ['Totals',grand,...KEY_ORDER.map(k=>totals[k]||'')]){
    const td=document.createElement('td');td.textContent=value;totalRow.append(td);
  }
  body.prepend(totalRow);table.append(body);wrap.append(table);host.append(wrap);
  if(skipped){const note=document.createElement('p');note.className='pa-note';note.textContent=`${skipped} attempt(s) had an unrecognized key and are not included.`;host.append(note);}
}
async function loadHistory(){
  const area=el('pa-history-body'),uid=localStorage.getItem(UID_KEY);
  if(!uid){area.textContent='Please log in first.';return;}
  area.textContent='Loading practice history...';
  try{
    await auth.authStateReady();if(!auth.currentUser)throw Error('Not authenticated');
    const [catalog,snapshot]=await Promise.all([
      fetch('tunes/index.json').then(r=>{if(!r.ok)throw Error('Could not load fugue catalog');return r.json();}),
      getDocs(collection(db,'users',uid,'webPractice'))
    ]);
    if(localStorage.getItem(UID_KEY)!==uid){area.textContent='Student changed; reopen history.';return;}
    const attempts=snapshot.docs.map(d=>d.data()).filter(x=>x.app===APP_ID);
    const nav=Array.from({length:8},(_,i)=>({
      title:'Mode '+['I','II','III','IV','V','VI','VII','VIII'][i],
      subtabs:catalog.filter(f=>Number(f.mode)===i+1).map(f=>({title:f.title,id:f.id}))
    }));
    let activeLanding=Math.max(0,Math.min(7,Number(selectedDetail?.mode||1)-1)),activeSub=null;
    const render=()=>{
      area.replaceChildren();
      const tabs=document.createElement('div');tabs.className='pa-tabs';
      nav.forEach((n,i)=>addButton(tabs,n.title,i===activeLanding,()=>{activeLanding=i;activeSub=null;render();}));
      area.append(tabs);
      const landing=nav[activeLanding];
      const sub=document.createElement('div');sub.className='pa-subtabs';
      addButton(sub,'All fugues',activeSub===null,()=>{activeSub=null;render();});
      landing.subtabs.forEach((s,i)=>addButton(sub,s.title,activeSub===i,()=>{activeSub=i;render();}));
      area.append(sub);
      const models=activeSub===null?landing.subtabs:[landing.subtabs[activeSub]];
      drawGrid(area,attempts,models);
    };
    render();
  }catch(e){console.error(e);area.textContent='Could not load practice history (' + (e.code || e.message || 'unknown error') + ').';}
}

// If the app finished its initial load before this ES module initialized,
// recover the already-rendered selection without restarting it later.
if(document.querySelector('#subjectScore svg') && document.getElementById('fugue')?.value){
  const option=document.getElementById('fugue').selectedOptions[0];
  const id=document.getElementById('fugue').value;
  selectedDetail={id,title:option?.textContent||id,mode:Number(id.match(/^mode(\d+)/)?.[1]||0)};
  startForSelected();
}

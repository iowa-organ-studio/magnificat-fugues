
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

const el = id => root.querySelector('#' + id);

const loginDialog = el('pa-login-dialog');
const historyDialog = el('pa-history-dialog');

el('pa-login').onclick = () => {
  loginDialog.showModal();
};

el('pa-login-close').onclick = () => {
  loginDialog.close();
};

el('pa-history').onclick = () => {
  historyDialog.showModal();
  loadHistory();
};

el('pa-history-close').onclick = () => {
  historyDialog.close();
};

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
//
// SHARED ORGAN STUDIO PRACTICE HISTORY
// Identical navigation and grid conventions across trainers.
// Magnificat Fugues opens as the selected tab.
//

const KEY_ORDER = [
  'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb',
  'a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'a#',
  'd', 'g', 'c', 'f', 'bb', 'eb', 'ab'
];

const ROMAN = {
  I: 1, II: 2, III: 3, IV: 4, V: 5,
  VI: 6, VII: 7, VIII: 8, IX: 9, X: 10
};

const MODE_MINOR = new Set([1, 2, 3, 4, 9, 10]);

const SHARED_TRAINER_BASE =
  'https://iowa-organ-studio.github.io/improvisation-models/';

const SHARED_COLLECTIONS = {
  'Pachelbel-Aria':
    'sublandings/Pachelbel-Aria/pachelbel-aria.json',
  'Boehm-Chorale-Partita':
    'sublandings/Boehm-Chorale-Partita/boehm-chorale-partita.json',
  'Bach-WTC':
    'sublandings/Bach-WTC/bach-wtc.json'
};

let sharedNavigationCache = null;


// Preserve lowercase b for B minor.
// Convert only actual accidentals.

const niceKey = key => {
  const value = String(key || '').trim();

  const match = value.match(
    /^([A-Ga-g])([#♯b♭]?)(.*)$/
  );

  if (!match) return value;

  const [, letter, accidental, suffix] = match;

  const formattedAccidental =
    accidental === '#' ? '♯' :
    accidental === 'b' ? '♭' :
    accidental;

  return letter + formattedAccidental + suffix;
};


// Convert a tonic into the existing grid key format.

const keyFromTonic = (tonic, minor) => {
  if (!tonic) return null;

  const match = String(tonic)
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .match(/^([A-Ga-g])([#b]?)$/);

  if (!match) return null;

  const key =
    (minor
      ? match[1].toLowerCase()
      : match[1].toUpperCase()) +
    match[2];

  return KEY_ORDER.includes(key) ? key : null;
};


// Interpret keys from both websites.

function historyKey(item) {
  const raw = String(item.key || '').trim();

  const venetian =
    item.modelId === 'Venetian-Toccata' ||
    /Venetian|Merulo/i.test(item.model || '') ||
    /^Tone\s+[IVX]+\s*\(/i.test(raw);

  if (venetian) {
    const tone =
      item.venetianTone ||
      raw.match(/Tone\s+([IVX]+)/i)?.[1];

    const number = ROMAN[
      String(tone || '').toUpperCase()
    ];

    const final =
      item.final ||
      raw.match(
        /\(([A-Ga-g][♯♭#b]?)\s+Final\)/i
      )?.[1];

    return number
      ? keyFromTonic(final, MODE_MINOR.has(number))
      : null;
  }

  const cleaned = raw
    .replace(/^Current key:\s*/i, '')
    .trim();

  const modeName = cleaned.match(
    /\b(major|minor)\b/i
  )?.[1]?.toLowerCase();

  if (modeName) {
    const tonic = cleaned
      .replace(/\b(major|minor)\b/ig, '')
      .trim();

    return keyFromTonic(
      tonic,
      modeName === 'minor'
    );
  }

  // Support earlier Magnificat records containing
  // a tonic without "major" or "minor".

  if (item.app === 'magnificat-fugues') {
    const mode = Number(
      item.mode ||
      String(item.modelId || '')
        .match(/^mode(\d+)/)?.[1]
    );

    if (mode >= 1 && mode <= 8) {
      return keyFromTonic(cleaned, mode <= 4);
    }
  }

  return null;
}


// Obtain the same trainer tabs as the main website.

async function getSharedNavigation() {
  if (sharedNavigationCache) {
    return sharedNavigationCache;
  }

  const get = async path => {
    const response = await fetch(
      SHARED_TRAINER_BASE + path
    );

    if (!response.ok) {
      throw new Error('Could not load ' + path);
    }

    return response.json();
  };

  const landing = await get('landing/models.json');
  const nav = [];

  for (const entry of landing.models) {

    if (entry.type === 'collection') {
      const path = SHARED_COLLECTIONS[
        entry.collection
      ];

      if (!path) continue;

      const collection = await get(path);

      nav.push({
        title: entry.title,
        subtabs: collection.items.map(item => ({
          title: item.title,
          id: item.model
        }))
      });

    } else if (entry.type === 'model') {
      nav.push({
        title: entry.title,
        id: entry.model,
        subtabs: []
      });

    } else if (
      entry.type === 'external' &&
      entry.url?.includes('/magnificat-fugues/')
    ) {
      nav.push({
        title: 'Pachelbel Magnificat Fugues',
        id: 'magnificat-fugues',
        subtabs: []
      });
    }
  }

  // Ensure Magnificat is available even if the
  // main landing catalog has not yet added it.

  if (!nav.some(n => n.id === 'magnificat-fugues')) {
    nav.push({
      title: 'Pachelbel Magnificat Fugues',
      id: 'magnificat-fugues',
      subtabs: []
    });
  }

  sharedNavigationCache = nav;
  return nav;
}


// Original Venetian-style tab buttons.

function addButton(parent, label, selected, fn) {
  const btn = document.createElement('button');

  btn.type = 'button';
  btn.className =
    'pa-tab' + (selected ? ' pa-active' : '');

  btn.textContent = label;
  btn.setAttribute(
    'aria-pressed',
    String(selected)
  );

  btn.onclick = fn;
  parent.append(btn);
}


// Shared numerical practice-history grid.

function drawGrid(host, attempts, models) {
  const isMagnificat = models.some(
    m => m.id === 'magnificat-fugues'
  );

  const allowed = new Set(
    models.map(m => m.id)
  );

  const names = new Map(
    models.map(m => [m.id, m.title])
  );

  const byExercise = new Map();
  let skipped = 0;

  for (const item of attempts) {
    const fugueRecord =
      item.app === 'magnificat-fugues';

    if (isMagnificat !== fugueRecord) {
      continue;
    }

    const minimum = fugueRecord ? 90 : 60;

    if (Number(item.durationSeconds) < minimum) {
      continue;
    }

    let exercise;

    if (fugueRecord) {
      exercise = String(
        item.exercise || item.modelId || ''
      ).trim();

      if (!exercise) {
        skipped++;
        continue;
      }

    } else {
      const id =
        item.modelId ||
        models.find(m =>
          m.title.toLowerCase() ===
          String(item.model || '').toLowerCase()
        )?.id;

      if (!allowed.has(id)) continue;

      const name =
        names.get(id) || item.model || id;

      exercise =
        `${name} — ${item.exercise || 'Unknown phrase'}`;
    }

    const key = historyKey(item);

    if (!key) {
      skipped++;
      continue;
    }

    if (!byExercise.has(exercise)) {
      byExercise.set(exercise, new Map());
    }

    const counts = byExercise.get(exercise);

    counts.set(
      key,
      (counts.get(key) || 0) + 1
    );
  }

  if (!byExercise.size) {
    const message = document.createElement('p');

    message.textContent = isMagnificat
      ? 'No recorded Magnificat fugues yet.'
      : 'No recorded phrases for this selection.';

    host.append(message);
    return;
  }

  const wrap = document.createElement('div');
  wrap.className = 'pa-grid-scroll';

  const table = document.createElement('table');
  table.className = 'pa-grid';

  const header = document.createElement('thead');
  const headerRow = document.createElement('tr');

  for (const label of [
    'Exercise',
    'Totals',
    ...KEY_ORDER.map(niceKey)
  ]) {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.append(th);
  }

  header.append(headerRow);
  table.append(header);

  const body = document.createElement('tbody');

  const totals = Object.fromEntries(
    KEY_ORDER.map(key => [key, 0])
  );

  let grand = 0;

  const rows = [...byExercise.entries()].sort(
    (a, b) => a[0].localeCompare(
      b[0],
      undefined,
      { numeric: true }
    )
  );

  for (const [name, counts] of rows) {
    const tr = document.createElement('tr');

    const sum = [...counts.values()].reduce(
      (a, b) => a + b,
      0
    );

    grand += sum;

    const values = [
      name,
      sum,
      ...KEY_ORDER.map(key => {
        const count = counts.get(key) || 0;
        totals[key] += count;
        return count || '';
      })
    ];

    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }

    body.append(tr);
  }

  const totalRow = document.createElement('tr');
  totalRow.className = 'pa-total-row';

  for (const value of [
    'Totals',
    grand,
    ...KEY_ORDER.map(key => totals[key] || '')
  ]) {
    const td = document.createElement('td');
    td.textContent = value;
    totalRow.append(td);
  }

  body.prepend(totalRow);
  table.append(body);
  wrap.append(table);
  host.append(wrap);

  if (skipped) {
    const note = document.createElement('p');
    note.className = 'pa-note';

    note.textContent =
      `${skipped} attempt(s) had unrecognized data and are not included.`;

    host.append(note);
  }
}


// Display all trainer histories from shared Firebase.

async function loadHistory() {
  const area = el('pa-history-body');
  const uid = localStorage.getItem(UID_KEY);

  if (!uid) {
    area.textContent = 'Please log in first.';
    return;
  }

  area.textContent = 'Loading practice history...';

  try {
    await auth.authStateReady();

    if (!auth.currentUser) {
      throw Error('Not authenticated');
    }

    const [nav, snapshot] = await Promise.all([
      getSharedNavigation(),
      getDocs(
        collection(db, 'users', uid, 'webPractice')
      )
    ]);

    if (localStorage.getItem(UID_KEY) !== uid) {
      area.textContent =
        'Student changed; reopen history.';
      return;
    }

    const attempts = snapshot.docs
      .map(d => d.data())
      .filter(item =>
        item.app === 'improvisation-models' ||
        item.app === 'magnificat-fugues'
      );

    // Magnificat is selected by default.

    const initialIndex = nav.findIndex(
      n => n.id === 'magnificat-fugues'
    );

    let activeLanding = Math.max(0, initialIndex);
    let activeSub = null;

    const renderHistory = () => {
      area.replaceChildren();

      const tabs = document.createElement('div');
      tabs.className = 'pa-tabs';

      nav.forEach((item, index) => {
        addButton(
          tabs,
          item.title,
          index === activeLanding,
          () => {
            activeLanding = index;
            activeSub = null;
            renderHistory();
          }
        );
      });

      area.append(tabs);

      const landing = nav[activeLanding];
      if (!landing) return;

      let models;

      if (landing.subtabs.length) {
        const subtabs = document.createElement('div');
        subtabs.className = 'pa-subtabs';

        addButton(
          subtabs,
          'All models',
          activeSub === null,
          () => {
            activeSub = null;
            renderHistory();
          }
        );

        landing.subtabs.forEach((item, index) => {
          addButton(
            subtabs,
            item.title,
            activeSub === index,
            () => {
              activeSub = index;
              renderHistory();
            }
          );
        });

        area.append(subtabs);

        models = activeSub === null
          ? landing.subtabs
          : [landing.subtabs[activeSub]];

      } else {
        models = [landing];
      }

      drawGrid(area, attempts, models);
    };

    renderHistory();

  } catch (error) {
    console.error(error);

    area.textContent =
      'Could not load practice history (' +
      (error.code || error.message || 'unknown error') +
      ').';
  }
}


// If the app finished its initial load before this ES module initialized,
// recover the already-rendered selection without restarting it later.
if(document.querySelector('#subjectScore svg') && document.getElementById('fugue')?.value){
  const option=document.getElementById('fugue').selectedOptions[0];
  const id=document.getElementById('fugue').value;
  selectedDetail={id,title:option?.textContent||id,mode:Number(id.match(/^mode(\d+)/)?.[1]||0)};
  startForSelected();
}

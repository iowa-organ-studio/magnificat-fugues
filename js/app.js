
const $ = id => document.getElementById(id);
// Separate complete key-signature inventories: 0 through 7 sharps AND flats.
// Counts are signed so enharmonic spellings never collapse into one another.
const majorKeys = [
  { name: 'C', signature: 0 }, { name: 'G', signature: 1 }, { name: 'D', signature: 2 },
  { name: 'A', signature: 3 }, { name: 'E', signature: 4 }, { name: 'B', signature: 5 },
  { name: 'F♯', signature: 6 }, { name: 'C♯', signature: 7 },
  { name: 'F', signature: -1 }, { name: 'B♭', signature: -2 }, { name: 'E♭', signature: -3 },
  { name: 'A♭', signature: -4 }, { name: 'D♭', signature: -5 }, { name: 'G♭', signature: -6 },
  { name: 'C♭', signature: -7 }
];
const minorKeys = [
  { name: 'A', signature: 0 }, { name: 'E', signature: 1 }, { name: 'B', signature: 2 },
  { name: 'F♯', signature: 3 }, { name: 'C♯', signature: 4 }, { name: 'G♯', signature: 5 },
  { name: 'D♯', signature: 6 }, { name: 'A♯', signature: 7 },
  { name: 'D', signature: -1 }, { name: 'G', signature: -2 }, { name: 'C', signature: -3 },
  { name: 'F', signature: -4 }, { name: 'B♭', signature: -5 }, { name: 'E♭', signature: -6 },
  { name: 'A♭', signature: -7 }
];
const keys = [...new Set([...majorKeys, ...minorKeys].map(k => k.name))];

function tonalityFromKrn(text) {
  const match = metadata(text, 'KEY').match(
    /^([A-Ga-g][#♯b♭]?)\s+(major|minor)$/i
  );

  if (!match) {
    throw new Error(
      'Missing or invalid !!!KEY: metadata. Expected, for example, C minor.'
    );
  }

  return match[2].toLowerCase();
}

function inventoryForFugue(fugue = selectedFugue()) {
  if (!fugue?.tonality) {
    throw new Error('Fugue tonality has not been loaded.');
  }

  return fugue.tonality === 'minor'
    ? minorKeys
    : majorKeys;
}

const selectedFugue = () =>
  fugues.find(f => f.id === $('fugue').value) || fugues[0];

const currentMode = () => Number(selectedFugue()?.mode || 0);

function eligibleKeys(fugue = selectedFugue()) {
  return inventoryForFugue(fugue)
    .filter(k => allowedCounts.has(Math.abs(k.signature)))
    .map(k => k.name);
}

function updateKeyOptions(fugue = selectedFugue(), preferred = null) {
  const select = $('key');
  const previous = preferred ?? select.value;
  const inventory = inventoryForFugue(fugue);
  const available = eligibleKeys(fugue);

  select.innerHTML = inventory
    .map(k => `<option value="${k.name}">${k.name}</option>`)
    .join('');

  if (inventory.some(k => k.name === previous)) {
    select.value = previous;
  } else {
    const enharmonic = inventory.find(
      k => pc[k.name] === pc[previous]
    );

    if (enharmonic) {
      select.value = enharmonic.name;
    } else {
      select.value = available[0] || inventory[0].name;
    }
  }
}

const alternate = { 'C♯': 'D♭', 'D♭': 'C♯', 'E♭': 'D♯', 'D♯': 'E♭', 'F♯': 'G♭', 'G♭': 'F♯', 'A♭': 'G♯', 'G♯': 'A♭', 'B♭': 'A♯', 'A♯': 'B♭' };
const pc = { C: 0, 'C♯': 1, 'D♭': 1, D: 2, 'D♯': 3, 'E♭': 3, E: 4, F: 5, 'F♯': 6, 'G♭': 6, G: 7, 'G♯': 8, 'A♭': 8, A: 9, 'A♯': 10, 'B♭': 10, B: 11, 'C♭': 11, 'E♯': 5, 'B♯': 0, 'F♭': 4 };
let fugues = [], current = null, tk = null, scale = 42, space = .5, sourceTexts = {};


let foregroundOctave = 0;

function updateOctaveButtons() {
  $('octaveDown').disabled = foregroundOctave <= -1;
  $('octaveUp').disabled = foregroundOctave >= 1;
}

$('octaveDown').addEventListener('click', () => {
  if (foregroundOctave <= -1) return;

  foregroundOctave--;
  updateOctaveButtons();

  if (sourceTexts.foregroundScore) {
    render('foregroundScore', sourceTexts.foregroundScore, true);
  }
});

$('octaveUp').addEventListener('click', () => {
  if (foregroundOctave >= 1) return;

  foregroundOctave++;
  updateOctaveButtons();

  if (sourceTexts.foregroundScore) {
    render('foregroundScore', sourceTexts.foregroundScore, true);
  }
});

updateOctaveButtons();


function metadata(text, key) { return text.match(new RegExp('^!!!' + key + ':\\s*(.+)$', 'mi'))?.[1]?.trim() || '' }
function metadataTitle(krn) { return `${metadata(krn, 'OMD') || 'Mode ?'} Fugue ${metadata(krn, 'FUG') || '?'}` }
function notePitch(cell) { const match = cell.match(/([A-Ga-g]+)([#-n]*)/); if (!match) return '?'; const letters = match[1], a = match[2]; return letters[0].toUpperCase() + (a.includes('#') ? '♯' : a.includes('-') ? '♭' : '') }
const letterOrder = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const naturalPc = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, 'C♭': 11, 'E♯': 5, 'B♯': 0, 'F♭': 4 };

function transposeName(p, key) {
  const source = p.replace('#', '♯');

  const originalKey = metadata(
    sourceTexts.foregroundScore || '',
    'KEY'
  );

  const match = originalKey.match(/^([A-G])([#♯b♭]?)/i);

  const sourceTonic = match
    ? match[1].toUpperCase() +
    (match[2] === '#' ? '♯' :
      match[2] === 'b' ? '♭' :
        match[2] || '')
    : 'G';

  const sourceLetter = source[0];
  const targetLetter = key[0];

  if (
    !(sourceLetter in naturalPc) ||
    !(sourceTonic in pc) ||
    !(key in pc)
  ) {
    return p;
  }

  // Diatonic displacement from the fugue's actual tonic.
  const steps =
    (letterOrder.indexOf(targetLetter) -
      letterOrder.indexOf(sourceTonic[0]) + 7) % 7;

  const letter = letterOrder[
    (letterOrder.indexOf(sourceLetter) + steps) % 7
  ];

  // Chromatic displacement from the same tonic.
  const value =
    (pc[source] + pc[key] - pc[sourceTonic] + 24) % 12;

  const delta =
    (value - naturalPc[letter] + 12) % 12;

  return letter +
    (delta === 1 ? '♯' :
      delta === 11 ? '♭' :
        delta === 2 ? '𝄪' :
          delta === 10 ? '𝄫' : '');
}

function kernDuration(cell) { const m = cell.match(/^(\d+)(\.*)/); if (!m) return 0; let d = 4 / Number(m[1]); for (let i = 0; i < m[2].length; i++)d += 4 / Number(m[1]) / 2 ** (i + 1); return d }
function parseFugue(text) {
  const lines = text.split(/\r?\n/); let spines = [], t = 0, measure = 1, ends = [0, 0, 0, 0], lastPitch = ['', '', '', '']; const voices = Object.fromEntries(['B', 'T', 'A', 'S'].map(v => [v, { entries: [], rests: [], state: 'counterpoint', start: 0 }]));
  let lastTime = 0; let warnings = [];
  for (const line of lines) {
    if (!line || line.startsWith('!!!') || line.startsWith('!!')) continue; const c = line.split('\t');
    if (c[0] === '**kern') { spines = c; continue } if (!spines.length) continue;
    if (c[0].startsWith('=')) { const m = c[0].match(/=(\d+)/); if (m) { measure = Number(m[1]); t = (measure - 1) * 4; ends = ends.map(x => Math.max(x, t)) } continue }
    if (c[0].startsWith('*')) continue;
    // The next row occurs at the earliest next onset among the four **kern voices.
    // A dot retains the previous note; it does not advance the voice clock.
    for (let i = 0; i < 4; i++) { const cell = c[i] || '.'; if (cell !== '.') { if (ends[i] > t + 0.001) warnings.push(`Overlap at measure ${measure}, voice ${i}`); const d = kernDuration(cell); ends[i] = t + d; if (!cell.includes('r')) lastPitch[i] = notePitch(cell) } }
    for (let i = 4; i < spines.length; i++) {
      const voice = spines[i].match(/^\*\*fugue([BTAS])$/)?.[1]; if (!voice) continue; const val = c[i] || '.'; if (val === '.') continue; const v = voices[voice]; for (const marker of val.split(/\s+/)) {
        if (marker === 'S' || marker === 'A') { if (v.state === 'rest') v.rests.push([v.start, t]); if (v.state === 'subject' || v.state === 'answer') v.entries[v.entries.length - 1].end = t; v.entries.push({ type: marker === 'S' ? 'subject' : 'answer', start: t, end: null, pitch: lastPitch[['B', 'T', 'A', 'S'].indexOf(voice)] }); v.state = marker === 'S' ? 'subject' : 'answer'; v.start = t }
        else if (marker === '/S' || marker === '/A') { if (v.state === 'subject' || v.state === 'answer') { v.entries[v.entries.length - 1].end = t; v.state = 'counterpoint'; v.start = t } }
        else if (marker === 'R') { if (v.state === 'subject' || v.state === 'answer') v.entries[v.entries.length - 1].end = t; v.state = 'rest'; v.start = t }
        else if (marker === '/R') { if (v.state === 'rest') v.rests.push([v.start, t]); v.state = 'counterpoint'; v.start = t }
      }
    }
    const future = ends.filter(x => x > t + 0.0001); if (future.length) t = Math.min(...future); lastTime = Math.max(lastTime, t);
  }
  const declared = Number(metadata(text, 'END')) || 0; const end = lastTime; for (const v of Object.values(voices)) { if (v.state === 'rest') v.rests.push([v.start, end]); if (v.state === 'subject' || v.state === 'answer') v.entries[v.entries.length - 1].end = end }
  return { voices, measures: declared || Math.ceil(lastTime / 4), availableBeats: lastTime, warnings };
}

function active(v, t) {
  // Explicitly annotated rests.
  if (v.rests.some(([a, b]) => t >= a && t < b)) {
    return false;
  }

  // Before the first subject or answer entry,
  // do not draw counterpoint.
  const firstEntry = v.entries[0];

  if (firstEntry && t < firstEntry.start) {
    return false;
  }

  return true;
}

function catalog() { let html = ''; for (const [voice, label] of [['S', 'Soprano'], ['A', 'Alto'], ['T', 'Tenor'], ['B', 'Bass']]) { const entries = current.voices[voice].entries; html += `<div class="voice-card"><h3>${label}</h3><div class="chips">`; for (const e of entries) { const t = e.start + .001, order = ['S', 'A', 'T', 'B'], on = order.filter(k => active(current.voices[k], t)), lowest = on[on.length - 1] === voice; html += `<span class="chip ${e.type === 'answer' ? 'answer' : ''}" title="${e.type} · beat ${e.start + 1} · ${transposeName(e.pitch, $('key').value)}">${on.length}v${on.length > 1 && lowest ? ' ↓' : ''}</span>` } html += '</div></div>' } $('catalog').innerHTML = html }

function map() {
  const w = 1220;
  const left = 52;
  const right = 14;
  const top = 32;
  const row = 48;

  const total = Math.min(
    current.measures * 4,
    current.availableBeats
  );

  const px = t =>
    left + (w - left - right) * t / total;

  let out = `<svg viewBox="0 0 ${w} 285"
    role="img" aria-label="Four voice fugue map">`;

  // Measure lines and numbers.
  for (let m = 1; (m - 1) * 4 <= total; m += 2) {
    const x = px((m - 1) * 4);

    out += `
      <line x1="${x}" y1="24"
        x2="${x}" y2="231"
        stroke="#ececec"/>
      <text x="${x}" y="253"
        font-size="12" fill="#666"
        text-anchor="middle">${m}</text>`;
  }

  for (const [i, v] of ['S', 'A', 'T', 'B'].entries()) {
    const y = top + i * row + 20;
    const voice = current.voices[v];

    out += `
      <text x="12" y="${y + 5}"
        font-size="17"
        font-weight="700">${v}</text>`;

    const breaks = new Set([0, total]);

    for (const e of voice.entries) {
      breaks.add(e.start);
      breaks.add(e.end);
    }

    for (const [a, b] of voice.rests) {
      breaks.add(a);
      breaks.add(b);
    }

    const pts = [...breaks].sort((a, b) => a - b);

    for (let j = 0; j < pts.length - 1; j++) {
      const a = pts[j];
      const b = pts[j + 1];
      const mid = (a + b) / 2;

      if (!active(voice, mid)) continue;

      const entry = voice.entries.find(
        e => mid >= e.start && mid < e.end
      );

      const x = px(a);
      const width = px(b) - x;

      if (entry) {
        // Subject or answer rectangle.
        out += `
          <rect x="${x}" y="${y - 17}"
            width="${width}" height="34"
            rx="5"
            fill="${entry.type === 'subject'
            ? '#ffcd00'
            : '#fff5cc'}"
            stroke="#b69a20"
            stroke-width="1.4"/>

          <text x="${x + width / 2}"
            y="${y + 6}"
            text-anchor="middle"
            font-size="18"
            font-weight="700">
            ${transposeName(entry.pitch, $('key').value)}
          </text>`;

      } else {
        // Counterpoint interval.
        // Suppress short gaps immediately before an entry.

        const nextEntry = voice.entries.find(
          e => Math.abs(e.start - b) < 0.0001
        );

        const shortPreEntryGap =
          nextEntry !== undefined &&
          (b - a) <= 1.0001;

        if (shortPreEntryGap) continue;

        // Original counterpoint-wave rendering.
        const n = Math.floor(width / 12);

        if (n > 0) {
          let path = `M${x} ${y}`;

          for (let z = 0; z < n; z++) {
            path += ` q3 -7 6 0 t6 0`;
          }

          out += `
            <path d="${path}"
              fill="none"
              stroke="#66798d"
              stroke-width="2.1"/>`;
        }
      }
    }
  }

  out += `</svg>`;
  $('map').innerHTML = out;
}

// Remove only reference records from the rendering copy. The source .krn files
// and their metadata remain intact for the app's title, mode, and indexing.
function stripDisplayMetadata(text) {
  return text.split(/\r?\n/).filter(line => !line.startsWith('!!!')).join('\n');
}
function stripFugueSpines(text) { return text.split('\n').map(line => { const c = line.split('\t'); return c.length === 8 && !line.startsWith('!!!') ? c.slice(0, 4).join('\t') : line }).join('\n') }
// Change only clef interpretations in the rendering copy; never rewrite source notes.
const clefForVoice = v => $('clef' + v)?.value || ({ B: 'F4', T: 'F4', A: 'G2', S: 'G2' }[v]);
function applyForegroundClefs(text) {
  return text.split('\n').map(line => {
    if (!line.startsWith('*clef')) return line;
    const cells = line.split('\t');
    for (let i = 0; i < Math.min(4, cells.length); i++) cells[i] = '*clef' + clefForVoice(['B', 'T', 'A', 'S'][i]);
    return cells.join('\t');
  }).join('\n');
}
async function toolkit() { if (tk) return tk; for (let i = 0; i < 200; i++) { try { if (window.verovio?.toolkit) { tk = new window.verovio.toolkit(); tk.getVersion(); return tk } } catch { } await new Promise(r => setTimeout(r, 75)) } throw Error('Local Verovio toolkit did not initialize') }
// The original Venetian trainer renders unmodified Humdrum with Verovio's transpose option.
// This function deliberately does not rewrite any **kern note, accidental or rhythm token.
// Diatonic transposition from the original G tonic, retaining target spelling.
// Verovio receives an interval (not a rewritten Humdrum note).

function intervalForKey(key) {
  // Determine the original tonic from the current fugue.
  // For example: "G minor" or "F major".
  const originalKey = metadata(
    sourceTexts.foregroundScore || '',
    'KEY'
  );

  const sourceMatch = originalKey.match(
    /^([A-G])([#♯b♭]?)/i
  );

  const sourceName = sourceMatch
    ? sourceMatch[1].toUpperCase() +
    (sourceMatch[2] === '#' ? '♯' :
      sourceMatch[2] === 'b' ? '♭' :
        sourceMatch[2] || '')
    : 'G';

  if (sourceName === key) return '';

  const sourceLetter = sourceName[0];
  const targetLetter = key[0];

  const sourceIndex = letterOrder.indexOf(sourceLetter);
  const targetIndex = letterOrder.indexOf(targetLetter);

  const degree = (targetIndex - sourceIndex + 7) % 7 + 1;

  const majorSemitones = [0, 2, 4, 5, 7, 9, 11];
  const expected = majorSemitones[degree - 1];

  const actual = (pc[key] - pc[sourceName] + 12) % 12;

  let difference = actual - expected;

  if (difference > 6) difference -= 12;
  if (difference < -6) difference += 12;

  const perfect = [1, 4, 5].includes(degree);

  const qualities = perfect
    ? {
      0: 'P',
      1: 'A',
      2: 'AA',
      [-1]: 'd',
      [-2]: 'dd'
    }
    : {
      0: 'M',
      [-1]: 'm',
      1: 'A',
      2: 'AA',
      [-2]: 'd',
      [-3]: 'dd'
    };

  const quality = qualities[difference];

  if (!quality) {
    throw new Error(
      `Unsupported transposition: ${sourceName} to ${key}`
    );
  }

  return quality + degree;
}

// Choose the clearest treble-staff octave for each short example independently.
// The pitch check uses the same G-based chromatic transposition as the renderer.
function kernPitchMidi(token, signature) {
  const match = token.match(/([A-Ga-g]+)([#n-]*)/);
  if (!match) return null;
  const letters = match[1], letter = letters[0].toUpperCase();
  const octave = letters[0] === letters[0].toLowerCase() ? 4 + letters.length - 1 : 4 - letters.length;
  const naturals = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let accidental = signature[letter] || 0;
  if (match[2].includes('n')) accidental = 0;
  else if (match[2].includes('#')) accidental = (match[2].match(/#/g) || []).length;
  else if (match[2].includes('-')) accidental = -(match[2].match(/-/g) || []).length;
  return 12 * (octave + 1) + naturals[letter] + accidental;
}
function kernSignature(text) {
  const line = text.split(/\r?\n/).find(l => l.startsWith('*k[')) || '';
  const out = {}; for (const m of line.matchAll(/([a-g])([#-]+)/g)) out[m[1].toUpperCase()] = m[2].includes('#') ? m[2].length : -m[2].length;
  return out;
}

function exampleOctaveShift(text, key) {
  const signature = kernSignature(text);
  const pitches = [];

  // Read all pitches from the original Humdrum example.
  for (const line of text.split(/\r?\n/)) {
    if (
      !line ||
      line.startsWith('!') ||
      line.startsWith('*') ||
      line.startsWith('=')
    ) continue;

    for (const token of line.split(/\t| /)) {
      if (token === '.' || token.includes('r')) continue;

      const midi = kernPitchMidi(token, signature);

      if (midi !== null) {
        pitches.push(midi);
      }
    }
  }

  if (!pitches.length) return 0;

  // Determine the original tonic of the selected fugue.
  const originalKey = metadata(
    sourceTexts.foregroundScore || '',
    'KEY'
  );

  const match = originalKey.match(/^([A-G])([#♯b♭]?)/i);

  const sourceName = match
    ? match[1].toUpperCase() +
    (match[2] === '#' ? '♯' :
      match[2] === 'b' ? '♭' :
        match[2] || '')
    : 'G';

  // Calculate the actual chromatic transposition.
  const semitones =
    ((pc[key] - pc[sourceName]) % 12 + 12) % 12;

  // Preferred treble-clef range:
  // D4 through B5.
  const LOW = 62;
  const HIGH = 83;

  const transposed = pitches.map(p => p + semitones);

  // Consider octave placements independently.
  const candidates = [-2, -1, 0, 1, 2];

  let bestShift = 0;
  let bestScore = Infinity;

  for (const shift of candidates) {
    const adjusted = transposed.map(
      p => p + shift * 12
    );

    const lowest = Math.min(...adjusted);
    const highest = Math.max(...adjusted);

    // Penalize any notes outside the preferred range.
    const below = Math.max(0, LOW - lowest);
    const above = Math.max(0, highest - HIGH);

    // Strongly favor keeping the entire melody
    // within the permitted range.
    const score =
      below * below * 100 +
      above * above * 100 +
      Math.abs(shift);

    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
    }
  }

  return bestShift;
}

function shiftKernOctaves(text, shift) {
  if (!shift) return text;
  return text.split(/\r?\n/).map(line => {
    if (!line || line.startsWith('!') || line.startsWith('*') || line.startsWith('=')) return line;
    return line.replace(/([A-Ga-g]+)(?=[#n\-\[\]LJkK_\s]|$)/g, letters => {
      const first = letters[0], octave = (first === first.toLowerCase() ? 4 + letters.length - 1 : 4 - letters.length) + shift;
      return octave >= 4 ? first.toLowerCase().repeat(octave - 3) : first.toUpperCase().repeat(4 - octave);
    });
  }).join('\n');
}




async function render(id, text, isForeground = false) {
  const el = $(id);
  if (!text) return;

  try {
    const t = await toolkit();

    const chosen = $('key').value;
    const transpose = intervalForKey(chosen);

    let adjusted;

    if (isForeground) {
      // Apply selected clefs to the four-voice score.
      adjusted = stripFugueSpines(
        applyForegroundClefs(text)
      );

      // Apply foreground octave shift (-1, 0, or +1).
      adjusted = shiftKernOctaves(
        adjusted,
        foregroundOctave
      );

    } else {
      // Preserve automatic octave placement
      // for Subject and Answer independently.
      adjusted = shiftKernOctaves(
        text,
        exampleOctaveShift(text, chosen)
      );
    }

    const musical = stripDisplayMetadata(adjusted);

    const width = Math.max(
      340,
      Math.floor(el.getBoundingClientRect().width || 700)
    );

    const s = isForeground ? scale : 46;

    t.setOptions({
      scale: s,
      pageWidth: Math.round(width * (100 / s)),

      // Allow the complete fugue to fit on one SVG page.
      pageHeight: 60000,
      adjustPageHeight: true,

      transpose,
      spacingLinear: isForeground ? space : 0.5,
      spacingNonLinear: 0.46,

      pageMarginTop: 10,
      pageMarginBottom: 10,
      pageMarginLeft: 12,
      pageMarginRight: 12,

      noJustification: false,
      justifyVertically: false,

      // Preserve normal system breaks.
      breaks: 'auto'
    });

    t.loadData(musical);

    // The entire fugue should now occupy one tall SVG.
    const pageCount = t.getPageCount();

    if (pageCount !== 1) {
      console.warn(
        'Expected one SVG page, Verovio produced',
        pageCount
      );
    }

    const svg = t.renderToSVG(1, {});

    if (!svg || !svg.includes('<svg')) {
      throw new Error('Verovio returned no SVG');
    }

    el.innerHTML = svg;

  } catch (err) {
    el.textContent =
      'Notation unavailable: ' + err.message;

    console.error(err);
  }
}




async function load() {
  const selected = $('fugue').value;
  const info = fugues.find(f => f.id === selected) || fugues[0];

  if (!info) return;

  const base = `tunes/${info.id}`;
  const paths = [
    `${base}-subject.krn`,
    `${base}-answer.krn`,
    `${base}.krn`
  ];

  const texts = await Promise.all(
    paths.map(async path => {
      const response = await fetch(path);
      if (!response.ok) throw Error('Cannot load ' + path);
      return response.text();
    })
  );

  // The full fugue score determines major/minor.
  info.tonality = tonalityFromKrn(texts[2]);

  sourceTexts = {
    subjectScore: texts[0],
    answerScore: texts[1],
    foregroundScore: texts[2]
  };

  current = parseFugue(texts[2]);
  current.id = info.id;

  $('modeDisplay').textContent = metadataTitle(texts[2]);

  updateKeyOptions(info);
  hideAnswer();

  await refresh();
  updateHero();

  window.dispatchEvent(new CustomEvent('magnificat:fugue', {
    detail: {
      id: info.id,
      title: info.title || metadataTitle(texts[2]),
      mode: Number(info.mode),
      tonality: info.tonality
    }
  }));
}



function hideAnswer() { $('answerScore').classList.add('hidden'); $('answerScore').setAttribute('aria-hidden', 'true'); $('answerToggle').classList.remove('revealed'); $('answerToggle').textContent = 'Show answer' }
async function refresh() { if (!current) return; map(); catalog(); await render('subjectScore', sourceTexts.subjectScore); await render('answerScore', sourceTexts.answerScore); if ($('foreground').open) await render('foregroundScore', sourceTexts.foregroundScore, true) }
$('answerToggle').addEventListener('click', () => { const hidden = $('answerScore').classList.toggle('hidden'); $('answerScore').setAttribute('aria-hidden', String(hidden)); $('answerToggle').classList.toggle('revealed', !hidden); $('answerToggle').textContent = hidden ? 'Show answer' : 'Hide answer' });
$('foreground').addEventListener('toggle', () => { $('foregroundHint').textContent = $('foreground').open ? 'Click to hide the score' : 'Click to reveal the score'; if ($('foreground').open && sourceTexts.foregroundScore) render('foregroundScore', sourceTexts.foregroundScore, true) });
$('key').addEventListener('change', refresh); $('fugue').addEventListener('change', load);
function eligibleFugues() { return fugues.filter(f => selectedModes.has(Number(f.mode))) }
function noFugue() { $('status').textContent = 'No fugue found'; $('modeDisplay').textContent = 'No fugue found'; $('catalog').textContent = 'No fugue found'; $('map').textContent = 'No fugue found'; for (const id of ['subjectScore', 'answerScore', 'foregroundScore']) $(id).textContent = ''; current = null; sourceTexts = {}; }

$('random').addEventListener('click', async () => {
  // First filter by the enabled Mode I-VIII buttons.
  const pool = eligibleFugues().filter(
    f => eligibleKeys(f).length > 0
  );

  if (!pool.length) {
    noFugue();
    return;
  }

  // Choose randomly among fugues in enabled modes.
  const chosen = pool[
    Math.floor(Math.random() * pool.length)
  ];

  // Choose a key from this fugue's own major/minor inventory.
  const available = eligibleKeys(chosen);

  $('fugue').value = chosen.id;
  updateKeyOptions(chosen);

  $('key').value = available[
    Math.floor(Math.random() * available.length)
  ];

  await load();
});

for (const [id, delta, which] of [['scaleDown', -3, 'scale'], ['scaleUp', 3, 'scale'], ['spaceDown', -.1, 'space'], ['spaceUp', .1, 'space']]) $(id).addEventListener('click', () => { if (which === 'scale') { scale = Math.max(20, Math.min(75, scale + delta)); $('scaleValue').textContent = scale } else { space = Math.max(.1, Math.min(1.5, Math.round((space + delta) * 100) / 100)); $('spaceValue').textContent = space.toFixed(2) } render('foregroundScore', sourceTexts.foregroundScore, true) });

(async () => {
  try {
    fugues = await fetch('tunes/index.json').then(async r => {
      if (!r.ok) throw Error('Cannot load tunes/index.json');
      return r.json();
    });

    // Read major/minor from each fugue's !!!KEY: metadata.
    await Promise.all(fugues.map(async f => {
      const response = await fetch(`tunes/${f.id}.krn`);

      if (!response.ok) {
        throw Error(`Cannot load tunes/${f.id}.krn`);
      }

      const text = await response.text();
      f.tonality = tonalityFromKrn(text);
    }));

    $('fugue').innerHTML = fugues.map(
      f => `<option value="${f.id}">${f.title}</option>`
    ).join('');

    // Respect enabled mode buttons AND key-signature filters.
    const pool = eligibleFugues().filter(
      f => eligibleKeys(f).length > 0
    );

    if (!pool.length) {
      noFugue();
      return;
    }

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const available = eligibleKeys(chosen);

    $('fugue').value = chosen.id;
    updateKeyOptions(chosen);

    $('key').value = available[
      Math.floor(Math.random() * available.length)
    ];

    await load();

    $('status').textContent = 'Loaded annotated Humdrum fugue.';

  } catch (err) {
    $('status').textContent = 'Load error: ' + err.message;
    $('subjectScore').textContent = 'Load error: ' + err.message;
    console.error(err);
  }
})();

// Venetian-style hero controls. Key-signature buttons filter random choices;
// mode buttons filter fugues; +/- transposes the current example.
const selectedModes = new Set([1, 2, 3, 4, 5, 6, 7, 8]);
const allowedCounts = new Set([0, 1, 2, 3, 4, 5, 6, 7]);

function updateHero() {
  const fugue = selectedFugue();

  $('keyDisplay').textContent =
    'Current key: ' +
    $('key').value + ' ' +
    (fugue?.tonality || '');

  document.querySelectorAll('.key-btn').forEach(b => {
    b.classList.toggle(
      'selected',
      allowedCounts.has(Number(b.dataset.count))
    );
  });

  document.querySelectorAll('.mode-filter-btn').forEach(b => {
    b.classList.toggle(
      'selected',
      selectedModes.has(Number(b.dataset.mode))
    );
  });
}

document.querySelectorAll('.key-btn').forEach(b => b.addEventListener('click', () => { const n = Number(b.dataset.count); allowedCounts.has(n) ? allowedCounts.delete(n) : allowedCounts.add(n); updateHero() }));
$('selectAllKeysBtn').addEventListener('click', () => { for (let i = 0; i <= 7; i++)allowedCounts.add(i); updateHero() });
$('selectNoneKeysBtn').addEventListener('click', () => { allowedCounts.clear(); updateHero() });
document.querySelectorAll('.mode-filter-btn').forEach(b => b.addEventListener('click', () => { const n = Number(b.dataset.mode); selectedModes.has(n) ? selectedModes.delete(n) : selectedModes.add(n); updateHero() }));
// Step chromatically while preserving the appropriate major/minor inventory.
for (const [id, d] of [['downKey', -1], ['upKey', 1]]) $(id).addEventListener('click', () => {
  const k = $('key'), pool = eligibleKeys(selectedFugue()); if (!pool.length) { $('status').textContent = 'No keys enabled'; return }
  const oldPc = pc[k.value];
  for (let step = 1; step <= 12; step++) {
    const nextPc = (oldPc + d * step + 120) % 12;
    const candidate = pool.find(name => pc[name] === nextPc);
    if (candidate) { k.value = candidate; refresh(); updateHero(); return }
  }
});

$('enharmonicBtn').addEventListener('click', () => {
  const k = $('key');
  const alt = alternate[k.value];

  if (!alt) {
    $('status').textContent =
      'No alternate enharmonic spelling available.';
    return;
  }

  // The alternate must exist in the current mode's
  // major or minor key inventory.
const inventory = inventoryForFugue(selectedFugue());

  if (!inventory.some(item => item.name === alt)) {
    $('status').textContent =
      'No alternate enharmonic spelling in this mode.';
    return;
  }

  // Allow enharmonic switching regardless of the
  // currently enabled key-signature filters.
  k.value = alt;

  refresh();
  updateHero();

  $('status').textContent = 'Enharmonic key: ' + alt;
});


for (const v of ['B', 'T', 'A', 'S']) $('clef' + v).addEventListener('change', () => { if ($('foreground').open && sourceTexts.foregroundScore) render('foregroundScore', sourceTexts.foregroundScore, true) });

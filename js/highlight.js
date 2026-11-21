// Entry shading clipped to actual rhythmic entry boundaries, per staff.
// Source Humdrum spines: B T A S; rendered staves: S A T B.
(() => {
  const control = document.getElementById('highlightEntries');
  const host = document.getElementById('foregroundScore');
  if (!control || !host) return;
  const NS = 'http://www.w3.org/2000/svg';
  const voiceOrder = ['S', 'A', 'T', 'B'];
  const sourceIndex = {B: 0, T: 1, A: 2, S: 3};
  let busy = false;
  let observer;

  function duration(token) {
    const m = token.match(/^(\d+)(\.*)/);
    if (!m) return 0;
    const base = 4 / Number(m[1]);
    let beats = base;
    for (let i = 0; i < m[2].length; i++) beats += base / (2 ** (i + 1));
    return beats;
  }

  // Each measure's note onsets in the source, in each voice. All data rows
  // are synchronized; the dot does not create a new onset.
  function sourceOnsets(text) {
    const result = [];
    let measure = null;
    let clock = [0, 0, 0, 0];
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith('!')) continue;
      const cells = line.split('\t');
      if (cells[0].startsWith('=')) {
        if (cells[0].startsWith('==')) break;
        measure = [[], [], [], []];
        result.push(measure);
        clock = [0, 0, 0, 0];
        continue;
      }
      if (!measure || cells[0].startsWith('*')) continue;
      for (let i = 0; i < 4; i++) {
        const token = cells[i] || '.';
        if (token === '.') continue;
        const d = duration(token);
        if (!d) continue;
        if (!token.includes('r')) measure[i].push({beat: clock[i], token});
        clock[i] += d;
      }
    }
    return result;
  }

  function directStaves(measure) {
    return [...measure.querySelectorAll('g.staff')]
      .filter(s => s.closest('g.measure') === measure);
  }

 
function xCenter(element) {
  try {
    // Prefer the notehead itself, excluding stems and beams.
    const head = element.querySelector(
      'g.notehead, .notehead, use'
    );

    const target = head || element;
    const box = target.getBBox();

    return box.x + box.width / 2;
  } catch {
    return null;
  }
}


  // Return x of an entry boundary. Prefer actual engraved note x-coordinates,
  // rather than a linear division of the measure width.
 
function boundaryX(beat, points, left, right, isEnd) {
  if (beat <= 0) return left;
  if (beat >= 4) return right;

  const epsilon = 0.00001;

  const exact = points.find(
    p => Math.abs(p.beat - beat) < epsilon
  );

  if (exact) {
    // Start slightly before the notehead.
    // End at the following onset, also slightly before it.
    return exact.x - 6;
  }

  const before = [...points]
    .reverse()
    .find(p => p.beat < beat);

  const after = points.find(
    p => p.beat > beat
  );

  let x;

  if (before && after) {
    x = before.x +
      (after.x - before.x) *
      (beat - before.beat) /
      (after.beat - before.beat);
  } else if (before) {
    x = before.x +
      (right - before.x) *
      (beat - before.beat) /
      (4 - before.beat);
  } else if (after) {
    x = left +
      (after.x - left) *
      beat / after.beat;
  } else {
    x = isEnd ? right : left;
  }

  return x - 6;
}


  function update() {
    if (busy) return;
    busy = true;
    observer?.disconnect();
    try {
      const svg = host.querySelector('svg');
      if (!svg) return;
      svg.querySelectorAll('.entry-highlight').forEach(el => el.remove());
      if (!control.checked || typeof current === 'undefined' || !current?.voices ||
          typeof sourceTexts === 'undefined' || !sourceTexts.foregroundScore) return;

      const onsets = sourceOnsets(sourceTexts.foregroundScore);
      const measures = [...svg.querySelectorAll('g.measure')];
      measures.forEach((measure, index) => {
        const start = index * 4;
        directStaves(measure).forEach((staff, staffIndex) => {
          const voiceName = voiceOrder[staffIndex];
          const voice = current.voices[voiceName];
          if (!voice) return;
          const entries = voice.entries.filter(e => e.end != null && e.start < start + 4 && e.end > start);
          if (!entries.length) return;

          const lines = staff.querySelector('g.staffLines') || staff;
          let box;
          try { box = lines.getBBox(); } catch { return; }
          if (!box || box.width <= 0) return;
          const left = box.x, right = box.x + box.width;
          const source = onsets[index]?.[sourceIndex[voiceName]] || [];
          // Verovio groups notes by g.note in reading order. Grace notes
          // and chords may add elements, so only accept a one-to-one match.
          const notes = [...staff.querySelectorAll('g.note')]
            .filter(n => n.closest('g.staff') === staff);
          const points = source.length === notes.length
            ? source.map((n, i) => ({beat:n.beat, x:xCenter(notes[i])}))
                .filter(p => p.x != null)
            : [];
          // Do not paint a misleading region if the onset mapping fails.
          if (!points.length) return;
          points.sort((a,b) => a.beat - b.beat);

          for (const entry of entries) {
            const a = Math.max(0, entry.start - start);
            const b = Math.min(4, entry.end - start);
            const x1 = boundaryX(a, points, left, right, false);
            const x2 = boundaryX(b, points, left, right, true);
            if (x2 <= x1) continue;
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('class', 'entry-highlight');
            rect.setAttribute('x', x1);
            rect.setAttribute('y', box.y - 8);
            rect.setAttribute('width', x2 - x1);
            rect.setAttribute('height', box.height + 16);
            rect.setAttribute('fill', entry.type === 'subject' ? '#FFD34D' : '#FFE59A');
            rect.setAttribute('fill-opacity', entry.type === 'subject' ? '0.45' : '0.35');
            rect.setAttribute('pointer-events', 'none');
            staff.insertBefore(rect, staff.firstChild);
          }
        });
      });
    } finally {
      busy = false;
      observer?.observe(host, {childList:true,subtree:true});
    }
  }

  control.addEventListener('change', update);
  observer = new MutationObserver(update);
  observer.observe(host, {childList:true,subtree:true});
})();

'use strict';
/* Annotations et mesures sur une photo.
   photo.annot = { calib: { pts: [[x,y],[x,y]], mm }, shapes: [{ id, type, pts, text }] }
   Les coordonnées sont en pixels de l'image enregistrée (photo.w × photo.h) : le dessin reste juste
   quelle que soit la taille d'affichage. Types : arrow, ellipse, free, text, length, area. */

const ANNOT_COLOR = '#ffd60a', MEASURE_COLOR = '#22d3ee', CALIB_COLOR = '#f472b6';

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
function polyArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return Math.abs(s) / 2;
}
const centroid = pts => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const fr1 = n => n.toLocaleString('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: n < 10 ? 1 : 0 });

// Millimètres par pixel, d'après le trait d'étalonnage tracé sur une règle.
function mmPerPx(annot) {
  const c = annot?.calib;
  return c && c.mm > 0 && dist(c.pts[0], c.pts[1]) > 0 ? c.mm / dist(c.pts[0], c.pts[1]) : null;
}

// Valeur d'une forme de mesure : longueur en mm ou surface en cm² (null sans étalonnage).
function measureOf(shape, annot) {
  const k = mmPerPx(annot);
  if (!k) return null;
  if (shape.type === 'length') return { kind: 'length', value: dist(shape.pts[0], shape.pts[1]) * k, label: `${fr1(dist(shape.pts[0], shape.pts[1]) * k)} mm` };
  if (shape.type === 'area' && shape.pts.length > 2) {
    const cm2 = polyArea(shape.pts) * k * k / 100;
    return { kind: 'area', value: cm2, label: `${fr1(cm2)} cm²` };
  }
  return null;
}

// Résumé des mesures d'une photo, utilisé pour la courbe d'évolution : plus grande surface et plus grande longueur.
function photoMeasures(ph) {
  const a = ph.annot;
  if (!a?.shapes?.length) return null;
  let area = null, length = null;
  for (const s of a.shapes) {
    const m = measureOf(s, a);
    if (m?.kind === 'area') area = Math.max(area ?? 0, m.value);
    if (m?.kind === 'length') length = Math.max(length ?? 0, m.value);
  }
  return area === null && length === null ? null : { area, length };
}

// SVG des annotations, superposé exactement à l'image (même cadre, même « contain »).
function annotSVG(ph, { draft = null, cls = 'annot' } = {}) {
  return `<svg class="${cls}" viewBox="0 0 ${ph.w} ${ph.h}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">${annotInner(ph, draft)}</svg>`;
}

function annotInner(ph, draft = null) {
  const a = ph.annot || {};
  const w = ph.w, h = ph.h, sw = Math.max(w, h) / 320, fs = Math.max(w, h) / 36;
  const shapes = [...(a.shapes || [])];
  if (draft) shapes.push(draft);
  const parts = [];
  const label = (x, y, text, color) =>
    `<text x="${x}" y="${y}" fill="${color}" font-size="${fs}" font-weight="700" text-anchor="middle" dominant-baseline="middle"
      stroke="#000" stroke-width="${sw * 1.6}" paint-order="stroke" font-family="system-ui, sans-serif">${esc(text)}</text>`;
  const line = (p, q, color, extra = '') =>
    `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" ${extra}/>`;
  const shadow = `filter="url(#ds-shadow)"`;

  if (a.calib) {
    const [p, q] = a.calib.pts;
    parts.push(line(p, q, CALIB_COLOR, `stroke-dasharray="${sw * 3} ${sw * 2}" ${shadow}`));
    parts.push(label((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - fs, `étalon ${fr1(a.calib.mm)} mm`, CALIB_COLOR));
  }
  for (const s of shapes) {
    const P = s.pts;
    if (!P?.length) continue;
    switch (s.type) {
      case 'arrow': {
        if (P.length < 2) break;
        const [p, q] = P, ang = Math.atan2(q[1] - p[1], q[0] - p[0]), L = sw * 6;
        const h1 = [q[0] - L * Math.cos(ang - 0.45), q[1] - L * Math.sin(ang - 0.45)];
        const h2 = [q[0] - L * Math.cos(ang + 0.45), q[1] - L * Math.sin(ang + 0.45)];
        parts.push(`<g ${shadow}>${line(p, q, ANNOT_COLOR)}<polygon points="${q} ${h1} ${h2}" fill="${ANNOT_COLOR}"/></g>`);
        break;
      }
      case 'ellipse': {
        if (P.length < 2) break;
        const [p, q] = P;
        parts.push(`<ellipse cx="${(p[0] + q[0]) / 2}" cy="${(p[1] + q[1]) / 2}" rx="${Math.abs(q[0] - p[0]) / 2}" ry="${Math.abs(q[1] - p[1]) / 2}"
          fill="none" stroke="${ANNOT_COLOR}" stroke-width="${sw}" ${shadow}/>`);
        break;
      }
      case 'free':
        parts.push(`<polyline points="${P.map(p => p.join(',')).join(' ')}" fill="none" stroke="${ANNOT_COLOR}" stroke-width="${sw}"
          stroke-linecap="round" stroke-linejoin="round" ${shadow}/>`);
        break;
      case 'text':
        parts.push(label(P[0][0], P[0][1], s.text || '', ANNOT_COLOR));
        break;
      case 'length': {
        if (P.length < 2) break;
        const [p, q] = P, m = measureOf(s, a);
        parts.push(`<g ${shadow}>${line(p, q, MEASURE_COLOR)}<circle cx="${p[0]}" cy="${p[1]}" r="${sw * 1.4}" fill="${MEASURE_COLOR}"/><circle cx="${q[0]}" cy="${q[1]}" r="${sw * 1.4}" fill="${MEASURE_COLOR}"/></g>`);
        parts.push(label((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 - fs * 0.9, m ? m.label : 'non étalonné', MEASURE_COLOR));
        break;
      }
      case 'area': {
        const closed = s.closed !== false;
        parts.push(`<polygon points="${P.map(p => p.join(',')).join(' ')}" fill="${MEASURE_COLOR}" fill-opacity=".18"
          stroke="${MEASURE_COLOR}" stroke-width="${sw}" stroke-linejoin="round" ${closed ? '' : `stroke-dasharray="${sw * 2} ${sw * 1.5}"`} ${shadow}/>`);
        if (!closed) P.forEach(p => parts.push(`<circle cx="${p[0]}" cy="${p[1]}" r="${sw * 1.6}" fill="${MEASURE_COLOR}"/>`));
        const m = closed ? measureOf(s, a) : null;
        if (closed && P.length > 2) { const c = centroid(P); parts.push(label(c[0], c[1] + fs * 0.9, m ? m.label : 'non étalonné', MEASURE_COLOR)); }
        break;
      }
      case 'calib': {
        if (P.length < 2) break;
        parts.push(line(P[0], P[1], CALIB_COLOR, `stroke-dasharray="${sw * 3} ${sw * 2}"`));
        break;
      }
    }
  }
  return `<defs><filter id="ds-shadow" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="0" stdDeviation="${sw * 0.8}" flood-color="#000" flood-opacity=".7"/></filter></defs>
    ${parts.join('')}`;
}

const hasAnnot = ph => !!(ph.annot && (ph.annot.calib || ph.annot.shapes?.length));

// Dessine les annotations d'une photo sur un canvas (export d'image), à l'emplacement (x, y, largeur, hauteur).
async function drawAnnotations(g, ph, x, y, w, h) {
  if (!hasAnnot(ph)) return;
  const svg = annotSVG(ph).replace('<svg ', `<svg width="${ph.w}" height="${ph.h}" `);
  const img = await decode(new Blob([svg], { type: 'image/svg+xml' }));
  g.drawImage(img, x, y, w, h);
}

/* ---------- Éditeur ---------- */

const TOOLS = [
  ['arrow', '↗', 'Flèche'], ['ellipse', '◯', 'Cercle'], ['free', '✎', 'Crayon'], ['text', 'T', 'Texte'],
  ['calib', '📏', 'Étalonner'], ['length', '↔', 'Longueur'], ['area', '⬠', 'Surface'],
];

// Ouvre l'éditeur ; renvoie true si les annotations ont été enregistrées.
async function editAnnotations(ph) {
  const work = JSON.parse(JSON.stringify(ph.annot || { shapes: [] }));
  work.shapes ||= [];
  const history = [];
  const snapshot = () => history.push(JSON.stringify(work));
  let tool = mmPerPx(work) ? 'length' : 'calib';
  let draft = null;
  const url = objUrl(ph.blob);

  const help = {
    arrow: 'Faites glisser pour tracer une flèche.',
    ellipse: 'Faites glisser pour entourer une zone.',
    free: 'Dessinez librement.',
    text: 'Touchez l\'endroit où placer le texte.',
    calib: 'Tracez un trait sur la règle visible dans la photo, puis indiquez sa longueur réelle (ex. 10 mm).',
    length: 'Faites glisser d\'un bord à l\'autre pour mesurer une longueur.',
    area: 'Touchez le contour de la lésion point par point, puis « Fermer la surface ».',
  };

  const render = () => {
    const calibrated = !!mmPerPx(work);
    dlg.innerHTML = `
      <div class="dhead"><h2>Annoter et mesurer</h2>${closeBtn}</div>
      <div class="tools" role="toolbar">
        ${TOOLS.map(([k, ic, lb]) => `<button type="button" class="tool${tool === k ? ' on' : ''}" data-tool="${k}" title="${lb}"
          ${(k === 'length' || k === 'area') && !calibrated ? 'data-needcalib' : ''}><span>${ic}</span>${lb}</button>`).join('')}
      </div>
      <p class="hint">${help[tool]}${(tool === 'length' || tool === 'area') && !calibrated ? ' <b>Étalonnez d\'abord sur une règle pour obtenir des valeurs en mm.</b>' : ''}</p>
      <div class="stage edit">
        <img src="${url}" alt="">
        ${annotSVG({ ...ph, annot: work }, { draft, cls: 'annot live' })}
      </div>
      <div class="dfoot">
        ${tool === 'area' && draft?.pts?.length > 2 ? '<button type="button" class="btn" data-act="closearea">Fermer la surface</button>' : ''}
        <button type="button" class="btn" data-act="undo" ${history.length ? '' : 'disabled'}>↶ Annuler</button>
        <button type="button" class="btn danger ghost" data-act="clear" ${work.shapes.length || work.calib ? '' : 'disabled'}>Tout effacer</button>
        <button type="button" class="btn primary" data-act="save">Enregistrer</button>
      </div>`;
    bind();
  };

  const toImg = (svg, e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [Math.round(Math.max(0, Math.min(ph.w, p.x))), Math.round(Math.max(0, Math.min(ph.h, p.y)))];
  };
  // Pendant un tracé, seul le contenu du dessin change : l'élément (et sa capture du pointeur) reste le même.
  const redrawLive = () => { dlg.querySelector('svg.live').innerHTML = annotInner({ ...ph, annot: work }, draft); };
  const finishArea = () => {
    if (draft?.pts?.length > 2) { snapshot(); work.shapes.push({ ...draft, closed: true }); }
    draft = null;
    render();
  };

  let down = false;
  function bindStage() {
    const svg = dlg.querySelector('svg.live');
    svg.onpointerdown = e => {
      e.preventDefault();
      const p = toImg(svg, e);
      if (tool === 'text') {
        const text = prompt('Texte de l\'annotation :');
        if (text?.trim()) { snapshot(); work.shapes.push({ id: uid(), type: 'text', pts: [p], text: text.trim() }); render(); }
        return;
      }
      if (tool === 'area') {
        draft ||= { id: uid(), type: 'area', pts: [], closed: false };
        // Toucher près du premier point ferme le contour.
        if (draft.pts.length > 2 && dist(p, draft.pts[0]) < Math.max(ph.w, ph.h) / 40) return finishArea();
        draft.pts.push(p);
        return render();
      }
      down = true;
      svg.setPointerCapture(e.pointerId);
      draft = { id: uid(), type: tool, pts: tool === 'free' ? [p] : [p, p] };
      redrawLive();
    };
    svg.onpointermove = e => {
      if (!down || !draft) return;
      const p = toImg(svg, e);
      if (draft.type === 'free') draft.pts.push(p); else draft.pts[1] = p;
      redrawLive();
    };
    svg.onpointerup = async () => {
      if (!down || !draft) return;
      down = false;
      const d = draft;
      draft = null;
      const tiny = d.type === 'free' ? d.pts.length < 3 : dist(d.pts[0], d.pts[1]) < 4;
      if (tiny) return render();
      if (d.type === 'calib') {
        const v = prompt('Longueur réelle de ce trait, en millimètres :', String(work.calib?.mm || 10));
        const mm = parseFloat(String(v || '').replace(',', '.'));
        if (mm > 0) { snapshot(); work.calib = { pts: d.pts, mm }; tool = 'length'; toast(`Étalonnage : ${fr1(mm)} mm`); }
        return render();
      }
      snapshot();
      work.shapes.push(d);
      render();
    };
  }

  function bind() {
    dlg.querySelectorAll('[data-tool]').forEach(b => (b.onclick = () => {
      if (tool === 'area' && draft) draft = null;
      tool = b.dataset.tool;
      render();
    }));
    const on = (act, fn) => { const b = dlg.querySelector(`[data-act=${act}]`); if (b) b.onclick = fn; };
    on('closearea', finishArea);
    on('undo', () => { const prev = history.pop(); if (prev) Object.assign(work, JSON.parse(prev)); if (!JSON.parse(prev || '{}').calib) delete work.calib; draft = null; render(); });
    on('clear', () => { if (!confirm('Effacer toutes les annotations et mesures de cette photo ?')) return; snapshot(); work.shapes = []; delete work.calib; draft = null; render(); });
    on('save', () => dlg.close('save'));
    bindStage();
  }

  const r = await openDialog('', { cls: 'editor', onOpen: render });
  if (r !== 'save') return false;
  ph.annot = work;
  await putOne('photos', ph);
  toast('Annotations enregistrées');
  return true;
}

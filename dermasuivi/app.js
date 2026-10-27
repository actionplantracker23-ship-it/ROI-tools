'use strict';
/* DermaSuivi : un dossier photo par patient, photos datées, comparaison côte à côte.
   Tout est stocké dans IndexedDB, sur l'appareil. Aucune donnée n'est envoyée sur internet. */

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const dlg = $('#dlg');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="9" height="16" rx="1.5"/><rect x="13" y="4" width="9" height="16" rx="1.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M16 6l-4-4-4 4M12 2v13"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
};

/* ================= Dates ================= */

const pad2 = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => isoDate(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtLong = s => parseISO(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = s => parseISO(s).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const daysBetween = (a, b) => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 864e5);
function ymd(s) { const [y, m, d] = s.split('-').map(Number); return [y, m - 1, d]; }
const dayLabel = n => (n === 0 ? 'J0' : `J${n > 0 ? '+' : ''}${n}`);
function durationLabel(n) {
  if (n < 14) return `${n} jour${n > 1 ? 's' : ''}`;
  if (n < 60) return `${n} jours (${Math.round(n / 7)} sem.)`;
  return `${n} jours (${(n / 30.44).toFixed(1).replace('.', ',')} mois)`;
}
const byDate = (a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt;

/* ================= Base de données (IndexedDB) ================= */

let dbPromise;
function db() {
  return dbPromise ||= new Promise((resolve, reject) => {
    const r = indexedDB.open('dermasuivi', 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('patients', { keyPath: 'id' });
      d.createObjectStore('photos', { keyPath: 'id' }).createIndex('patientId', 'patientId');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function run(stores, mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction(stores, mode);
    const r = fn(t);
    t.oncomplete = () => resolve(r && 'result' in r ? r.result : undefined);
    t.onerror = t.onabort = () => reject(t.error);
  });
}
const getAll = s => run(s, 'readonly', t => t.objectStore(s).getAll());
const getOne = (s, id) => run(s, 'readonly', t => t.objectStore(s).get(id));
const putOne = (s, o) => run(s, 'readwrite', t => t.objectStore(s).put(o));
const delOne = (s, id) => run(s, 'readwrite', t => t.objectStore(s).delete(id));
const photosOf = pid => run('photos', 'readonly', t => t.objectStore('photos').index('patientId').getAll(pid));

function deletePatient(pid) {
  return run(['patients', 'photos'], 'readwrite', t => {
    t.objectStore('patients').delete(pid);
    const photos = t.objectStore('photos');
    photos.index('patientId').openKeyCursor(IDBKeyRange.only(pid)).onsuccess = e => {
      const c = e.target.result;
      if (c) { photos.delete(c.primaryKey); c.continue(); }
    };
  });
}

// Résumé stocké sur la fiche patient (nombre de photos, dates, vignette) pour afficher la liste vite.
async function refreshSummary(pid) {
  const p = await getOne('patients', pid);
  if (!p) return;
  const ph = (await photosOf(pid)).sort(byDate);
  const last = ph[ph.length - 1];
  Object.assign(p, {
    count: ph.length,
    firstDate: ph[0]?.date || null,
    lastDate: last?.date || null,
    cover: last?.thumb || null,
    updatedAt: Date.now(),
  });
  await putOne('patients', p);
}

/* ================= Images ================= */

let liveUrls = [];
const objUrl = blob => { const u = URL.createObjectURL(blob); liveUrls.push(u); return u; };
function revokeAll() { liveUrls.forEach(URL.revokeObjectURL); liveUrls = []; }

async function decode(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  try { await img.decode(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return img;
}
const toBlob = (canvas, q = 0.86) => new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
async function resized(img, max, q) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { blob: await toBlob(c, q), w: c.width, h: c.height };
}

// Lit la date de prise de vue (EXIF DateTimeOriginal) d'un JPEG, pour dater correctement
// les photos importées depuis la galerie.
async function exifDate(file) {
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = p => v.getUint16(t + p, le), u32 = p => v.getUint32(t + p, le);
        const ifd = off => {
          const out = {};
          for (let i = 0, n = u16(off); i < n; i++) { const e = off + 2 + i * 12; out[u16(e)] = { count: u32(e + 4), at: e + 8 }; }
          return out;
        };
        const str = ent => {
          const p = ent.count > 4 ? u32(ent.at) : ent.at;
          let s = '';
          for (let i = 0; i < ent.count - 1; i++) s += String.fromCharCode(v.getUint8(t + p + i));
          return s;
        };
        const ifd0 = ifd(u32(4));
        let s = null;
        if (ifd0[0x8769]) { const ex = ifd(u32(ifd0[0x8769].at)); const ent = ex[0x9003] || ex[0x9004]; if (ent) s = str(ent); }
        if (!s && ifd0[0x0132]) s = str(ifd0[0x0132]);
        const m = s && s.match(/^(\d{4}):(\d{2}):(\d{2})/);
        return m && m[1] !== '0000' ? `${m[1]}-${m[2]}-${m[3]}` : null;
      }
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
      o += 2 + len;
    }
  } catch { /* pas d'EXIF lisible */ }
  return null;
}

async function prepareFile(file) {
  const date = (await exifDate(file)) || isoDate(new Date(file.lastModified || Date.now()));
  const img = await decode(file);
  const full = await resized(img, 2000, 0.86);
  const thumb = await resized(img, 420, 0.8);
  return { date, blob: full.blob, w: full.w, h: full.h, thumb: thumb.blob };
}

/* ================= Petits utilitaires d'interface ================= */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// Ouvre la boîte de dialogue et renvoie une promesse résolue à sa fermeture (valeur = bouton cliqué).
function openDialog(html, { cls = '', onOpen } = {}) {
  dlg.className = cls;
  dlg.innerHTML = html;
  return new Promise(resolve => {
    dlg.onclose = () => { dlg.onclose = null; resolve(dlg.returnValue); };
    dlg.returnValue = '';
    dlg.showModal();
    onOpen?.(dlg);
  });
}
const closeBtn = '<button class="btn icon ghost" value="" formnovalidate aria-label="Fermer">✕</button>';

async function confirmBox(title, text, okLabel = 'Supprimer') {
  const r = await openDialog(`
    <form method="dialog">
      <div class="dhead"><h2>${esc(title)}</h2></div>
      <div class="dbody"><p>${esc(text)}</p></div>
      <div class="dfoot">
        <button class="btn" value="">Annuler</button>
        <button class="btn primary" value="ok">${esc(okLabel)}</button>
      </div>
    </form>`);
  return r === 'ok';
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const safeName = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'patient';

function pickFiles(input) {
  return new Promise(resolve => {
    input.value = '';
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

const initials = name => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '?';

/* ================= Routage ================= */

const state = { sort: localStorage.getItem('ds-sort') || 'recent', zone: null, selecting: false, sel: [] };

window.addEventListener('hashchange', route);
async function route() {
  revokeAll();
  if (dlg.open) dlg.close();
  const [path, query] = (location.hash.slice(1) || '/').split('?');
  const parts = path.split('/').filter(Boolean);
  const q = new URLSearchParams(query || '');
  try {
    if (parts[0] === 'p' && parts[1] && parts[2] === 'compare') return await viewCompare(parts[1], (q.get('ids') || '').split(',').filter(Boolean));
    if (parts[0] === 'p' && parts[1]) return await viewPatient(parts[1]);
    if (parts[0] === 'reglages') return await viewSettings();
    return await viewHome();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="empty"><div class="big">⚠️</div><p>Une erreur est survenue : ${esc(e.message)}</p><a class="btn" href="#/">Retour à l'accueil</a></div>`;
  }
}

/* ================= Accueil : liste des patients ================= */

async function viewHome() {
  const patients = await getAll('patients');
  const sorted = patients.sort(state.sort === 'az'
    ? (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
    : (a, b) => b.updatedAt - a.updatedAt);
  const totalPhotos = patients.reduce((n, p) => n + (p.count || 0), 0);

  const last = Number(localStorage.getItem('ds-last-backup') || 0);
  const needBackup = totalPhotos > 0 && Date.now() - last > 30 * 864e5;

  app.innerHTML = `
    <header class="topbar">
      <h1>DermaSuivi<span class="sub">${patients.length} patient${patients.length > 1 ? 's' : ''} · ${totalPhotos} photo${totalPhotos > 1 ? 's' : ''}</span></h1>
      <button class="btn install-btn" data-act="install">${ICON.download} Installer</button>
      <a class="btn icon ghost" href="#/reglages" aria-label="Réglages et sauvegarde">${ICON.gear}</a>
    </header>
    ${needBackup ? `<div class="banner">💾 ${last ? 'Dernière sauvegarde il y a plus de 30 jours.' : 'Aucune sauvegarde faite pour l\'instant.'}<a class="btn" href="#/reglages">Sauvegarder</a></div>` : ''}
    <div class="search">
      <input type="search" id="q" placeholder="Rechercher un patient…" autocomplete="off" aria-label="Rechercher un patient">
      <select id="sort" aria-label="Trier">
        <option value="recent"${state.sort === 'recent' ? ' selected' : ''}>Récents</option>
        <option value="az"${state.sort === 'az' ? ' selected' : ''}>A → Z</option>
      </select>
      <button class="btn primary" data-act="new">${ICON.plus}<span>Patient</span></button>
    </div>
    ${sorted.length ? `<div class="patients">${sorted.map(p => `
      <a class="pcard" href="#/p/${p.id}" data-name="${esc((p.name + ' ' + (p.ref || '')).toLowerCase())}">
        ${p.cover ? `<img class="cover" src="${objUrl(p.cover)}" alt="">` : `<span class="avatar">${esc(initials(p.name))}</span>`}
        <span class="meta">
          <strong>${esc(p.name)}</strong>
          <small>${p.ref ? esc(p.ref) + ' · ' : ''}${p.count || 0} photo${(p.count || 0) > 1 ? 's' : ''}${p.lastDate ? ' · dernière le ' + fmtShort(p.lastDate) : ''}</small>
        </span>
      </a>`).join('')}</div>
      <p class="empty" id="nores" hidden>Aucun patient ne correspond.</p>`
    : `<div class="empty"><div class="big">📁</div><p>Aucun patient pour l'instant.<br>Créez un dossier par patient, puis ajoutez ses photos au fil des consultations.</p>
        <button class="btn primary" data-act="new">${ICON.plus} Nouveau patient</button></div>`}
  `;

  $('#q').oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    let shown = 0;
    app.querySelectorAll('.pcard').forEach(c => { const ok = c.dataset.name.includes(q); c.hidden = !ok; shown += ok; });
    const nores = $('#nores');
    if (nores) nores.hidden = shown > 0;
  };
  $('#sort').onchange = e => { state.sort = e.target.value; localStorage.setItem('ds-sort', state.sort); route(); };
  app.querySelectorAll('[data-act=new]').forEach(b => (b.onclick = () => editPatient()));
  app.querySelector('[data-act=install]').onclick = install;
}

async function editPatient(p) {
  const isNew = !p;
  const r = await openDialog(`
    <form method="dialog" id="pf">
      <div class="dhead"><h2>${isNew ? 'Nouveau patient' : 'Modifier le dossier'}</h2>${closeBtn}</div>
      <div class="dbody">
        <div class="field"><label for="f-name">Nom et prénom *</label><input type="text" id="f-name" required value="${esc(p?.name)}" autocomplete="off"></div>
        <div class="field"><label for="f-ref">N° de dossier / date de naissance</label><input type="text" id="f-ref" value="${esc(p?.ref)}" autocomplete="off"></div>
        <div class="field"><label for="f-notes">Notes (diagnostic, traitement…)</label><textarea id="f-notes">${esc(p?.notes)}</textarea></div>
      </div>
      <div class="dfoot">
        <button class="btn" value="" formnovalidate>Annuler</button>
        <button class="btn primary" value="ok">${isNew ? 'Créer le dossier' : 'Enregistrer'}</button>
      </div>
    </form>`, { onOpen: d => $('#f-name', d).focus() });
  if (r !== 'ok') return;
  const name = $('#f-name', dlg).value.trim();
  if (!name) return;
  const rec = p || { id: uid(), createdAt: Date.now(), count: 0 };
  Object.assign(rec, { name, ref: $('#f-ref', dlg).value.trim(), notes: $('#f-notes', dlg).value.trim(), updatedAt: Date.now() });
  await putOne('patients', rec);
  if (isNew) location.hash = `#/p/${rec.id}`;
  else route();
}

/* ================= Dossier d'un patient ================= */

let currentPid = null;

async function viewPatient(pid) {
  const p = await getOne('patients', pid);
  if (!p) { location.hash = '#/'; return; }
  if (currentPid !== pid) { currentPid = pid; state.zone = null; state.selecting = false; state.sel = []; }

  const all = (await photosOf(pid)).sort(byDate);
  const zones = [...new Set(all.map(x => x.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  if (state.zone && !zones.includes(state.zone)) state.zone = null;
  const list = state.zone ? all.filter(x => x.zone === state.zone) : all;
  state.sel = state.sel.filter(id => list.some(x => x.id === id));
  const first = list[0]?.date;

  const groups = [];
  for (const ph of list) {
    const g = groups[groups.length - 1];
    if (g && g.date === ph.date) g.items.push(ph); else groups.push({ date: ph.date, items: [ph] });
  }

  app.innerHTML = `
    <header class="topbar">
      <a class="btn icon ghost" href="#/" aria-label="Retour">${ICON.back}</a>
      <h1>${esc(p.name)}<span class="sub">${p.ref ? esc(p.ref) + ' · ' : ''}${all.length} photo${all.length > 1 ? 's' : ''}${all.length ? ` · suivi depuis le ${fmtShort(all[0].date)}` : ''}</span></h1>
      <button class="btn icon ghost" data-act="edit" aria-label="Modifier le dossier">${ICON.edit}</button>
    </header>
    ${p.notes ? `<div class="pinfo">${esc(p.notes)}</div>` : ''}
    <div class="actions">
      <button class="btn primary" data-act="camera">${ICON.camera}Prendre une photo</button>
      <button class="btn" data-act="gallery">${ICON.image}Importer</button>
      <button class="btn" data-act="select" ${list.length < 2 ? 'disabled' : ''}>${ICON.compare}Comparer</button>
    </div>
    ${zones.length ? `<div class="chips" role="tablist" aria-label="Zones">
      <button class="chip${state.zone ? '' : ' on'}" data-zone="">Toutes</button>
      ${zones.map(z => `<button class="chip${state.zone === z ? ' on' : ''}" data-zone="${esc(z)}">${esc(z)}</button>`).join('')}
    </div>` : ''}
    ${list.length >= 2 && !state.selecting ? `<div class="row"><button class="btn" data-act="beforeafter">⇆ Première / dernière photo${state.zone ? ' (' + esc(state.zone) + ')' : ''}</button></div>` : ''}
    <div id="timeline" class="${state.selecting ? 'selecting' : ''}">
      ${groups.length ? groups.map(g => `
        <section class="group">
          <h3>${fmtLong(g.date)} <span class="badge">${dayLabel(daysBetween(first, g.date))}</span></h3>
          <div class="thumbs">${g.items.map(ph => `
            <button class="thumb" data-id="${ph.id}" aria-label="Photo du ${fmtShort(ph.date)}${ph.zone ? ', ' + esc(ph.zone) : ''}">
              <img src="${objUrl(ph.thumb)}" alt="" loading="lazy">
              ${ph.zone && !state.zone ? `<span class="zone">${esc(ph.zone)}</span>` : ''}
              <span class="num"></span>
            </button>`).join('')}
          </div>
        </section>`).join('')
      : `<div class="empty"><div class="big">📷</div><p>Aucune photo dans ce dossier.<br>Prenez une photo ou importez-les depuis la galerie.</p></div>`}
    </div>
    ${state.selecting ? `<div class="selbar">
      <span id="selinfo"></span>
      <button class="btn" data-act="cancelsel">Annuler</button>
      <button class="btn primary" data-act="docompare">Comparer</button>
    </div>` : ''}
    <div class="row" style="margin-top:28px">
      <button class="btn danger ghost" data-act="delete">Supprimer le dossier</button>
    </div>
  `;

  const on = (act, fn) => { const b = app.querySelector(`[data-act=${act}]`); if (b) b.onclick = fn; };
  on('edit', () => editPatient(p));
  on('camera', async () => addPhotos(p, await pickFiles($('#in-camera')), zones));
  on('gallery', async () => addPhotos(p, await pickFiles($('#in-gallery')), zones));
  on('select', () => { state.selecting = true; state.sel = []; route(); });
  on('cancelsel', () => { state.selecting = false; state.sel = []; route(); });
  on('docompare', () => { const ids = state.sel.slice(); state.selecting = false; state.sel = []; location.hash = `#/p/${pid}/compare?ids=${ids.join(',')}`; });
  on('beforeafter', () => { location.hash = `#/p/${pid}/compare?ids=${list[0].id},${list[list.length - 1].id}`; });
  on('delete', async () => {
    if (await confirmBox('Supprimer le dossier ?', `Le dossier de ${p.name} et ses ${all.length} photo(s) seront définitivement supprimés de cet appareil.`)) {
      await deletePatient(pid);
      toast('Dossier supprimé');
      location.hash = '#/';
    }
  });
  app.querySelectorAll('[data-zone]').forEach(b => (b.onclick = () => { state.zone = b.dataset.zone || null; route(); }));
  // Met à jour la sélection sur place (sans redessiner la page, pour garder le défilement).
  const paintSel = () => {
    if (!state.selecting) return;
    app.querySelectorAll('.thumb').forEach(t => {
      const k = state.sel.indexOf(t.dataset.id);
      t.classList.toggle('sel', k >= 0);
      t.querySelector('.num').textContent = k >= 0 ? k + 1 : '';
    });
    const n = state.sel.length;
    $('#selinfo').textContent = n ? `${n} photo${n > 1 ? 's' : ''} sélectionnée${n > 1 ? 's' : ''}` : 'Touchez 2 à 4 photos à comparer';
    app.querySelector('[data-act=docompare]').disabled = n < 2;
  };
  paintSel();
  app.querySelectorAll('.thumb').forEach(b => (b.onclick = () => {
    const id = b.dataset.id;
    if (state.selecting) {
      const i = state.sel.indexOf(id);
      if (i >= 0) state.sel.splice(i, 1);
      else if (state.sel.length < 4) state.sel.push(id);
      else return toast('4 photos maximum');
      paintSel();
    } else {
      viewPhoto(p, list, list.findIndex(x => x.id === id), zones);
    }
  }));
}

async function addPhotos(p, files, zones) {
  if (!files.length) return;
  dlg.className = '';
  dlg.innerHTML = `<div class="progress">Préparation des photos… <b id="prog">0/${files.length}</b></div>`;
  dlg.onclose = null;
  dlg.showModal();
  const items = [];
  for (const f of files) {
    try { items.push(await prepareFile(f)); }
    catch (e) { console.warn(e); }
    const pr = $('#prog');
    if (pr) pr.textContent = `${items.length}/${files.length}`;
  }
  // L'événement « close » est asynchrone : on l'attend pour qu'il ne ferme pas la boîte suivante.
  await new Promise(r => { dlg.addEventListener('close', r, { once: true }); dlg.close(); });
  if (!items.length) return toast('Format d\'image non pris en charge');

  const r = await openDialog(`
    <form method="dialog">
      <div class="dhead"><h2>Ajouter ${items.length} photo${items.length > 1 ? 's' : ''}</h2>${closeBtn}</div>
      <div class="dbody">
        <div class="newlist">${items.map((it, i) => `
          <div class="newitem"><img src="${objUrl(it.thumb)}" alt="">
            <input type="date" data-i="${i}" value="${it.date}" max="${today()}" aria-label="Date de la photo ${i + 1}">
          </div>`).join('')}
        </div>
        <div class="field"><label for="n-zone">Zone / lésion (facultatif)</label>
          <input type="text" id="n-zone" list="zones" placeholder="ex. joue gauche, ulcère jambe droite" value="${esc(state.zone || '')}" autocomplete="off">
          <datalist id="zones">${zones.map(z => `<option value="${esc(z)}">`).join('')}</datalist>
        </div>
        <div class="field"><label for="n-note">Note (facultatif)</label><textarea id="n-note" placeholder="ex. après 2 semaines de traitement"></textarea></div>
      </div>
      <div class="dfoot">
        <button class="btn" value="">Annuler</button>
        <button class="btn primary" value="ok">Enregistrer</button>
      </div>
    </form>`);
  if (r !== 'ok') return;

  const zone = $('#n-zone', dlg).value.trim();
  const note = $('#n-note', dlg).value.trim();
  dlg.querySelectorAll('input[type=date]').forEach(inp => { if (inp.value) items[inp.dataset.i].date = inp.value; });
  try {
    for (const it of items) {
      await putOne('photos', { id: uid(), patientId: p.id, ...it, zone, note, createdAt: Date.now() });
    }
    await refreshSummary(p.id);
    navigator.storage?.persist?.();
    toast(`${items.length} photo${items.length > 1 ? 's' : ''} ajoutée${items.length > 1 ? 's' : ''}`);
  } catch (e) {
    console.error(e);
    alert('Impossible d\'enregistrer : l\'espace de stockage est peut-être plein.\n' + e.message);
  }
  if (zone && state.zone && zone !== state.zone) state.zone = zone;
  route();
}

/* ================= Visionneuse d'une photo ================= */

async function viewPhoto(p, list, index, zones) {
  let i = index;
  let changed = false;
  const render = () => {
    const ph = list[i];
    const first = list[0].date;
    dlg.innerHTML = `
      <form method="dialog">
        <div class="dhead"><h2>${fmtLong(ph.date)} <span class="badge">${dayLabel(daysBetween(first, ph.date))}</span></h2>${closeBtn}</div>
        <div class="stage">
          <img src="${objUrl(ph.blob)}" alt="Photo du ${fmtShort(ph.date)}">
          ${i > 0 ? `<button type="button" class="btn icon nav prev" data-nav="-1" aria-label="Photo précédente">‹</button>` : ''}
          ${i < list.length - 1 ? `<button type="button" class="btn icon nav next" data-nav="1" aria-label="Photo suivante">›</button>` : ''}
        </div>
        <div class="dbody">
          <div class="grid2">
            <div class="field"><label for="v-date">Date</label><input type="date" id="v-date" value="${ph.date}" max="${today()}"></div>
            <div class="field"><label for="v-zone">Zone / lésion</label><input type="text" id="v-zone" list="vzones" value="${esc(ph.zone)}" autocomplete="off">
              <datalist id="vzones">${zones.map(z => `<option value="${esc(z)}">`).join('')}</datalist></div>
          </div>
          <div class="field"><label for="v-note">Note</label><textarea id="v-note">${esc(ph.note)}</textarea></div>
        </div>
        <div class="dfoot">
          <button type="button" class="btn danger ghost" data-act="del">Supprimer</button>
          <button type="button" class="btn" data-act="dl">${ICON.download} Télécharger</button>
          <button type="button" class="btn primary" data-act="save">Enregistrer</button>
        </div>
      </form>`;
    dlg.querySelectorAll('[data-nav]').forEach(b => (b.onclick = () => { i += Number(b.dataset.nav); render(); }));
    dlg.querySelector('[data-act=save]').onclick = async () => {
      Object.assign(ph, { date: $('#v-date', dlg).value || ph.date, zone: $('#v-zone', dlg).value.trim(), note: $('#v-note', dlg).value.trim() });
      await putOne('photos', ph);
      changed = true;
      toast('Modifications enregistrées');
      dlg.close();
    };
    dlg.querySelector('[data-act=dl]').onclick = () => download(ph.blob, `${safeName(p.name)}_${ph.date}.jpg`);
    dlg.querySelector('[data-act=del]').onclick = async () => {
      if (!confirm('Supprimer définitivement cette photo ?')) return;
      await delOne('photos', ph.id);
      changed = true;
      toast('Photo supprimée');
      dlg.close();
    };
  };
  const keys = e => {
    if (e.key === 'ArrowLeft' && i > 0 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { i--; render(); }
    if (e.key === 'ArrowRight' && i < list.length - 1 && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') { i++; render(); }
  };
  document.addEventListener('keydown', keys);
  await openDialog('', { cls: 'viewer', onOpen: render });
  document.removeEventListener('keydown', keys);
  if (changed) { await refreshSummary(p.id); route(); }
}

/* ================= Comparaison côte à côte ================= */

async function viewCompare(pid, ids) {
  const p = await getOne('patients', pid);
  const photos = (await Promise.all(ids.map(id => getOne('photos', id)))).filter(Boolean).sort(byDate);
  if (!p || photos.length < 2) { location.hash = `#/p/${pid}`; return; }
  const n = photos.length;
  const first = photos[0].date;
  const mode = n === 2 && sessionStorage.getItem('ds-mode') === 'slider' ? 'slider' : 'side';
  const total = daysBetween(first, photos[n - 1].date);
  const ar = `${photos[0].w || 4} / ${photos[0].h || 3}`;
  const caption = ph => `<b>${dayLabel(daysBetween(first, ph.date))}</b> · ${fmtLong(ph.date)}${ph.zone ? `<small>${esc(ph.zone)}</small>` : ''}${ph.note ? `<small>${esc(ph.note)}</small>` : ''}`;

  app.innerHTML = `
    <header class="topbar">
      <a class="btn icon ghost" href="#/p/${pid}" aria-label="Retour au dossier">${ICON.back}</a>
      <h1>Comparaison<span class="sub">${esc(p.name)}</span></h1>
      <button class="btn primary" data-act="export">${ICON.share}<span>Image</span></button>
    </header>
    ${n === 2 ? `<div class="row" style="margin-top:12px">
      <div class="seg" role="tablist">
        <button data-mode="side" class="${mode === 'side' ? 'on' : ''}">Côte à côte</button>
        <button data-mode="slider" class="${mode === 'slider' ? 'on' : ''}">Curseur avant / après</button>
      </div></div>` : ''}
    ${mode === 'side' ? `
      <div class="cmp n${n}" style="--n:${n};--ar:${ar}">
        ${photos.map(ph => `<figure><img src="${objUrl(ph.blob)}" alt="Photo du ${fmtShort(ph.date)}"><figcaption>${caption(ph)}</figcaption></figure>`).join('')}
      </div>` : `
      <div class="slider" id="slider" style="--x:50%;--ar:${ar}">
        <img src="${objUrl(photos[1].blob)}" alt="Après, ${fmtShort(photos[1].date)}">
        <img class="top" src="${objUrl(photos[0].blob)}" alt="Avant, ${fmtShort(photos[0].date)}">
        <span class="bar"></span>
        <span class="lbl l">${dayLabel(0)} · ${fmtShort(photos[0].date)}</span>
        <span class="lbl r">${dayLabel(total)} · ${fmtShort(photos[1].date)}</span>
      </div>
      <p class="interval">Faites glisser pour comparer.</p>`}
    <p class="interval">Écart entre la première et la dernière photo : <b>${durationLabel(total)}</b></p>
  `;

  app.querySelectorAll('[data-mode]').forEach(b => (b.onclick = () => { sessionStorage.setItem('ds-mode', b.dataset.mode); route(); }));
  app.querySelector('[data-act=export]').onclick = () => exportCompare(p, photos);

  const s = $('#slider');
  if (s) {
    const move = e => {
      const r = s.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      s.style.setProperty('--x', (x * 100).toFixed(2) + '%');
    };
    s.onpointerdown = e => { s.setPointerCapture(e.pointerId); move(e); };
    s.onpointermove = e => { if (s.hasPointerCapture(e.pointerId)) move(e); };
  }
}

// Assemble les photos comparées en une seule image JPEG (avec dates), à partager ou enregistrer.
async function exportCompare(p, photos) {
  toast('Création de l\'image…');
  const imgs = await Promise.all(photos.map(ph => decode(ph.blob)));
  const first = photos[0].date;
  const cellW = 1000, gap = 24, head = 110, foot = 120;
  const cellH = Math.min(1500, Math.round(Math.max(...imgs.map(im => cellW * im.naturalHeight / im.naturalWidth))));
  const c = document.createElement('canvas');
  c.width = photos.length * cellW + (photos.length + 1) * gap;
  c.height = head + cellH + foot;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#15201f';
  g.font = '600 46px system-ui, sans-serif';
  g.textBaseline = 'middle';
  g.fillText(`${p.name} — suivi de cicatrisation`, gap, head / 2);
  imgs.forEach((im, k) => {
    const x0 = gap + k * (cellW + gap);
    g.fillStyle = '#000000';
    g.fillRect(x0, head, cellW, cellH);
    const s = Math.min(cellW / im.naturalWidth, cellH / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    g.drawImage(im, x0 + (cellW - w) / 2, head + (cellH - h) / 2, w, h);
    const ph = photos[k];
    g.fillStyle = '#0f766e';
    g.font = '700 44px system-ui, sans-serif';
    g.fillText(dayLabel(daysBetween(first, ph.date)), x0, head + cellH + 40);
    g.fillStyle = '#15201f';
    g.font = '400 38px system-ui, sans-serif';
    g.fillText(fmtLong(ph.date) + (ph.zone ? ' · ' + ph.zone : ''), x0, head + cellH + 90);
  });
  const blob = await toBlob(c, 0.9);
  const name = `${safeName(p.name)}_comparaison_${photos[0].date}_${photos[photos.length - 1].date}.jpg`;
  const file = new File([blob], name, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: `Suivi – ${p.name}` }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  download(blob, name);
}

/* ================= Réglages et sauvegarde ================= */

const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
const dataURLToBlob = async u => (await fetch(u)).blob();
const fmtMB = n => (n / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: n < 10485760 ? 1 : 0 }) + ' Mo';

async function viewSettings() {
  const est = await navigator.storage?.estimate?.().catch(() => null);
  const persisted = await navigator.storage?.persisted?.().catch(() => false);
  const last = Number(localStorage.getItem('ds-last-backup') || 0);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  app.innerHTML = `
    <header class="topbar">
      <a class="btn icon ghost" href="#/" aria-label="Retour">${ICON.back}</a>
      <h1>Réglages et sauvegarde</h1>
    </header>

    ${standalone ? '' : `<section class="card">
      <h2>Installer l'application</h2>
      ${ios
        ? '<p>Sur iPhone / iPad : ouvrez cette page dans <b>Safari</b>, touchez <b>Partager</b> ⎋ puis <b>« Sur l\'écran d\'accueil »</b>.</p>'
        : '<p>Sur Android (Chrome) : menu ⋮ → <b>« Installer l\'application »</b>. Sur ordinateur (Chrome, Edge) : icône d\'installation dans la barre d\'adresse.</p>'}
      <button class="btn primary install-btn" data-act="install">${ICON.download} Installer maintenant</button>
    </section>`}

    <section class="card">
      <h2>Sauvegarde</h2>
      <p>Les photos sont enregistrées <b>uniquement sur cet appareil</b>. Faites une sauvegarde régulièrement (clé USB, disque, cloud sécurisé)
      pour ne rien perdre et pour transférer les dossiers vers un autre appareil.</p>
      <p>Dernière sauvegarde : <b>${last ? new Date(last).toLocaleDateString('fr-FR') : 'jamais'}</b></p>
      <div class="row">
        <button class="btn primary" data-act="export">${ICON.download} Exporter une sauvegarde</button>
        <button class="btn" data-act="import">Restaurer une sauvegarde</button>
      </div>
    </section>

    <section class="card">
      <h2>Stockage</h2>
      ${est ? `<p>${fmtMB(est.usage || 0)} utilisés sur ${fmtMB(est.quota || 0)} disponibles.</p>
        <div class="meter"><i style="width:${Math.min(100, ((est.usage || 0) / (est.quota || 1)) * 100).toFixed(1)}%"></i></div>` : '<p>Information non disponible sur ce navigateur.</p>'}
      <p>Stockage protégé contre l'effacement automatique : <b>${persisted ? 'oui' : 'non'}</b>${persisted ? '' : ' (installez l\'application pour le protéger)'}.</p>
    </section>

    <section class="card">
      <h2>Confidentialité</h2>
      <p>Aucune photo ni aucune donnée patient n'est envoyée sur internet : tout reste dans la mémoire de l'appareil.
      Protégez l'appareil par un code ou une empreinte, et conservez les fichiers de sauvegarde dans un endroit sécurisé :
      ils contiennent des données de santé.</p>
    </section>
  `;
  app.querySelector('[data-act=install]')?.addEventListener('click', install);
  app.querySelector('[data-act=export]').onclick = exportBackup;
  app.querySelector('[data-act=import]').onclick = async () => {
    const [file] = await pickFiles($('#in-backup'));
    if (file) importBackup(file);
  };
}

async function exportBackup() {
  toast('Préparation de la sauvegarde…');
  const patients = await getAll('patients');
  const photos = await getAll('photos');
  const parts = ['{"app":"dermasuivi","version":1,"exportedAt":', JSON.stringify(new Date().toISOString()), ',"patients":',
    JSON.stringify(patients.map(({ cover, ...rest }) => rest)), ',"photos":['];
  for (let k = 0; k < photos.length; k++) {
    const { blob, thumb, ...meta } = photos[k];
    parts.push((k ? ',' : '') + JSON.stringify({ ...meta, image: await blobToDataURL(blob), thumb: await blobToDataURL(thumb) }));
  }
  parts.push(']}');
  download(new Blob(parts, { type: 'application/json' }), `dermasuivi_sauvegarde_${today()}.json`);
  localStorage.setItem('ds-last-backup', String(Date.now()));
  toast(`Sauvegarde de ${patients.length} dossier(s) et ${photos.length} photo(s)`);
  setTimeout(route, 600);
}

async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { return alert('Ce fichier n\'est pas une sauvegarde DermaSuivi valide.'); }
  if (data?.app !== 'dermasuivi' || !Array.isArray(data.patients) || !Array.isArray(data.photos)) return alert('Ce fichier n\'est pas une sauvegarde DermaSuivi valide.');
  if (!await confirmBox('Restaurer la sauvegarde ?',
    `${data.patients.length} dossier(s) et ${data.photos.length} photo(s) seront ajoutés. Les dossiers déjà présents sur cet appareil sont conservés ; ceux qui portent le même identifiant sont mis à jour.`, 'Restaurer')) return;
  toast('Restauration en cours…');
  try {
    for (const p of data.patients) await putOne('patients', p);
    for (const { image, thumb, ...meta } of data.photos) {
      await putOne('photos', { ...meta, blob: await dataURLToBlob(image), thumb: await dataURLToBlob(thumb) });
    }
    for (const p of data.patients) await refreshSummary(p.id);
    navigator.storage?.persist?.();
    toast('Sauvegarde restaurée');
    location.hash = '#/';
    route();
  } catch (e) {
    console.error(e);
    alert('La restauration a échoué : ' + e.message);
  }
}

/* ================= Installation (PWA) ================= */

let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  document.body.classList.add('can-install');
});
window.addEventListener('appinstalled', () => { installPrompt = null; document.body.classList.remove('can-install'); toast('Application installée'); });
async function install() {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  document.body.classList.remove('can-install');
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('Service worker non enregistré', e));
}

route();

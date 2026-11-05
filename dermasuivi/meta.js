'use strict';
/* Métadonnées des photos : lecture des informations EXIF d'un JPEG (date et heure de prise de vue,
   appareil, objectif, réglages, GPS) et des informations du fichier. L'image enregistrée par
   l'application est recompressée, donc ces informations sont conservées à part, dans photo.meta. */

const EXIF_TAGS = {
  0x010F: 'make', 0x0110: 'model', 0x0112: 'orientation', 0x0131: 'software', 0x0132: 'dateTime',
  0x8769: 'exifIFD', 0x8825: 'gpsIFD',
  0x829A: 'exposureTime', 0x829D: 'fNumber', 0x8827: 'iso', 0x9003: 'dateTimeOriginal',
  0x9004: 'dateTimeDigitized', 0x9010: 'offsetTime', 0x9011: 'offsetTimeOriginal', 0x9209: 'flash',
  0x920A: 'focalLength', 0xA002: 'pixelWidth', 0xA003: 'pixelHeight', 0xA405: 'focalLength35',
  0xA433: 'lensMake', 0xA434: 'lensModel',
};
const GPS_TAGS = { 1: 'latRef', 2: 'lat', 3: 'lonRef', 4: 'lon', 5: 'altRef', 6: 'alt' };

// Lit les blocs EXIF d'un JPEG ; renvoie {} si le fichier n'en contient pas (PNG, capture d'écran…).
async function readExif(file) {
  const out = {};
  try {
    const v = new DataView(await file.slice(0, 256 * 1024).arrayBuffer());
    if (v.getUint16(0) !== 0xFFD8) return out;
    let o = 2;
    while (o + 4 < v.byteLength) {
      const marker = v.getUint16(o), len = v.getUint16(o + 2);
      if (marker === 0xFFE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = p => v.getUint16(t + p, le), u32 = p => v.getUint32(t + p, le), s32 = p => v.getInt32(t + p, le);
        const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
        const value = e => {
          const type = u16(e + 2), count = u32(e + 4), bytes = (SIZE[type] || 1) * count;
          const p = bytes > 4 ? u32(e + 8) : e + 8;
          const one = k => {
            switch (type) {
              case 3: return u16(p + k * 2);
              case 4: return u32(p + k * 4);
              case 9: return s32(p + k * 4);
              case 5: { const d = u32(p + k * 8 + 4); return d ? u32(p + k * 8) / d : 0; }
              case 10: { const d = s32(p + k * 8 + 4); return d ? s32(p + k * 8) / d : 0; }
              default: return v.getUint8(t + p + k);
            }
          };
          if (type === 2) {
            let s = '';
            for (let k = 0; k < count; k++) { const c = v.getUint8(t + p + k); if (!c) break; s += String.fromCharCode(c); }
            return s.trim();
          }
          if (count === 1) return one(0);
          return Array.from({ length: Math.min(count, 8) }, (_, k) => one(k));
        };
        const ifd = (off, names, into) => {
          for (let i = 0, n = u16(off); i < n; i++) {
            const e = off + 2 + i * 12, name = names[u16(e)];
            if (name) { try { into[name] = value(e); } catch { /* entrée illisible */ } }
          }
        };
        ifd(u32(4), EXIF_TAGS, out);
        if (out.exifIFD) ifd(out.exifIFD, EXIF_TAGS, out);
        if (out.gpsIFD) ifd(out.gpsIFD, GPS_TAGS, out);
        delete out.exifIFD; delete out.gpsIFD;
        return out;
      }
      if ((marker & 0xFF00) !== 0xFF00 || marker === 0xFFDA) break;
      o += 2 + len;
    }
  } catch { /* pas d'EXIF lisible */ }
  return out;
}

const pad2m = n => String(n).padStart(2, '0');

// Transforme les données brutes en métadonnées lisibles, stockées avec la photo.
function buildMeta(file, exif, img, source) {
  const raw = exif.dateTimeOriginal || exif.dateTimeDigitized || exif.dateTime || '';
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  const fromExif = m && m[1] !== '0000';
  const lm = new Date(file.lastModified || Date.now());
  const meta = {
    source, // 'import' | 'camera' | 'guided'
    takenAt: fromExif
      ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}`
      : `${lm.getFullYear()}-${pad2m(lm.getMonth() + 1)}-${pad2m(lm.getDate())}T${pad2m(lm.getHours())}:${pad2m(lm.getMinutes())}:${pad2m(lm.getSeconds())}`,
    // Photo prise par l'application : l'heure de capture est exacte, même sans EXIF.
    dateSource: fromExif ? 'exif' : source === 'guided' ? 'capture' : 'file',
    fileName: file.name || '',
    fileSize: file.size || 0,
    fileType: file.type || '',
    origWidth: img.naturalWidth,
    origHeight: img.naturalHeight,
  };
  if (exif.offsetTimeOriginal || exif.offsetTime) meta.tz = exif.offsetTimeOriginal || exif.offsetTime;
  // « Apple iPhone 15 » plutôt que « Apple Apple iPhone 15 » quand le modèle répète la marque.
  if (exif.make || exif.model) {
    const make = String(exif.make || ''), model = String(exif.model || '');
    meta.camera = make && model.toLowerCase().startsWith(make.toLowerCase()) ? model : [make, model].filter(Boolean).join(' ');
  }
  if (exif.lensModel) meta.lens = exif.lensModel;
  if (exif.software) meta.software = exif.software;
  if (exif.fNumber) meta.fNumber = Math.round(exif.fNumber * 10) / 10;
  if (exif.exposureTime) meta.exposure = exif.exposureTime >= 1 ? `${exif.exposureTime} s` : `1/${Math.round(1 / exif.exposureTime)} s`;
  if (exif.iso) meta.iso = Array.isArray(exif.iso) ? exif.iso[0] : exif.iso;
  if (exif.focalLength) meta.focal = Math.round(exif.focalLength * 10) / 10;
  if (exif.focalLength35) meta.focal35 = exif.focalLength35;
  if (exif.flash !== undefined) meta.flash = (exif.flash & 1) === 1;
  if (exif.orientation) meta.orientation = exif.orientation;
  if (Array.isArray(exif.lat) && Array.isArray(exif.lon)) {
    const dms = a => a[0] + a[1] / 60 + a[2] / 3600;
    meta.gps = {
      lat: Math.round(dms(exif.lat) * (exif.latRef === 'S' ? -1 : 1) * 1e6) / 1e6,
      lon: Math.round(dms(exif.lon) * (exif.lonRef === 'W' ? -1 : 1) * 1e6) / 1e6,
    };
  }
  return meta;
}

// Lignes « libellé / valeur » à afficher dans la fiche d'une photo.
function metaRows(ph) {
  const m = ph.meta || {};
  const rows = [];
  const SRC = { import: 'Importée depuis la galerie', camera: 'Appareil photo', guided: 'Photo guidée DermaSuivi' };
  if (m.takenAt) {
    const d = new Date(m.takenAt);
    rows.push(['Prise de vue', d.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) + (m.tz ? ` (UTC${m.tz})` : '')
      + (m.dateSource === 'file' ? ' — date du fichier, pas de date EXIF' : '')]);
  }
  if (m.source) rows.push(['Origine', SRC[m.source] || m.source]);
  if (m.camera) rows.push(['Appareil', m.camera]);
  if (m.lens) rows.push(['Objectif', m.lens]);
  const settings = [m.fNumber && `f/${String(m.fNumber).replace('.', ',')}`, m.exposure, m.iso && `ISO ${m.iso}`,
    m.focal && `${String(m.focal).replace('.', ',')} mm${m.focal35 ? ` (éq. ${m.focal35} mm)` : ''}`,
    m.flash !== undefined && (m.flash ? 'flash' : 'sans flash')].filter(Boolean);
  if (settings.length) rows.push(['Réglages', settings.join(' · ')]);
  if (m.origWidth) rows.push(['Résolution d\'origine', `${m.origWidth} × ${m.origHeight} px (${(m.origWidth * m.origHeight / 1e6).toFixed(1).replace('.', ',')} Mpx)`]);
  if (ph.w) rows.push(['Résolution enregistrée', `${ph.w} × ${ph.h} px`]);
  if (m.fileName) rows.push(['Fichier', m.fileName + (m.fileSize ? ` · ${(m.fileSize / 1048576).toFixed(1).replace('.', ',')} Mo` : '')]);
  if (m.software) rows.push(['Logiciel', m.software]);
  if (m.device) rows.push(['Caméra', m.device]);
  if (m.gps) rows.push(['Position GPS', `${m.gps.lat}, ${m.gps.lon}`]);
  return rows;
}

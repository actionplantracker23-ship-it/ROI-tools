'use strict';
/* Photo guidée : la caméra s'affiche avec la photo de référence (dernière photo du motif) en
   transparence par-dessus, pour reprendre le même cadrage, la même distance et le même angle.
   Renvoie { file, device } ou null ; 'fallback' si la caméra n'est pas accessible. */

const canGuide = () => !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

async function guidedCapture(refs) {
  if (!canGuide()) return 'fallback';
  let facing = 'environment';
  let stream = null;
  let refIndex = refs.length - 1; // dernière photo par défaut
  let opacity = Number(localStorage.getItem('ds-overlay') || 40);
  let grid = localStorage.getItem('ds-grid') === '1';
  let result = null;

  const start = async () => {
    stream?.getTracks().forEach(t => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 3840 }, height: { ideal: 2160 } },
    });
    const v = $('#cam-video', dlg);
    v.srcObject = stream;
    await v.play().catch(() => {});
  };

  const refUrl = i => (refs[i] ? objUrl(refs[i].blob) : '');
  const render = () => {
    const ref = refs[refIndex];
    dlg.innerHTML = `
      <div class="dhead"><h2>Photo guidée</h2>${closeBtn}</div>
      <div class="cam-stage">
        <video id="cam-video" playsinline muted autoplay></video>
        ${ref ? `<img id="cam-ref" src="${refUrl(refIndex)}" alt="" style="opacity:${opacity / 100}">` : ''}
        <div class="cam-grid"${grid ? '' : ' hidden'}></div>
        ${ref ? `<span class="cam-lbl">Référence : ${fmtShort(ref.date)}${ref.zone ? ' · ' + esc(ref.zone) : ''}</span>` : '<span class="cam-lbl">Première photo de ce motif</span>'}
      </div>
      <div class="cam-ctl">
        ${ref ? `<label class="cam-op">Transparence <input type="range" id="cam-op" min="0" max="90" value="${opacity}"></label>
          ${refs.length > 1 ? `<button type="button" class="btn" data-act="prevref" ${refIndex ? '' : 'disabled'} aria-label="Référence précédente">‹</button>
          <button type="button" class="btn" data-act="nextref" ${refIndex < refs.length - 1 ? '' : 'disabled'} aria-label="Référence suivante">›</button>` : ''}` : ''}
        <button type="button" class="btn${grid ? ' on' : ''}" data-act="grid" aria-pressed="${grid}">Grille</button>
        <button type="button" class="btn" data-act="flip" aria-label="Changer de caméra">⟲</button>
      </div>
      <div class="dfoot cam-foot">
        <button type="button" class="btn" data-act="native">Appareil photo du téléphone</button>
        <button type="button" class="btn primary shoot" data-act="shoot" aria-label="Prendre la photo"></button>
      </div>`;
    const on = (act, fn) => { const b = dlg.querySelector(`[data-act=${act}]`); if (b) b.onclick = fn; };
    $('#cam-op', dlg)?.addEventListener('input', e => {
      opacity = Number(e.target.value);
      localStorage.setItem('ds-overlay', String(opacity));
      $('#cam-ref', dlg).style.opacity = opacity / 100;
    });
    on('prevref', () => { refIndex--; render(); });
    on('nextref', () => { refIndex++; render(); });
    on('grid', () => { grid = !grid; localStorage.setItem('ds-grid', grid ? '1' : '0'); render(); });
    on('flip', () => { facing = facing === 'environment' ? 'user' : 'environment'; start().catch(fail); });
    on('native', () => { result = 'fallback'; dlg.close(); });
    on('shoot', shoot);
    // Rebranche le flux déjà ouvert sur la nouvelle balise vidéo, sans redemander la caméra.
    if (stream) { const v = $('#cam-video', dlg); v.srcObject = stream; v.play().catch(() => {}); }
  };

  const fail = e => {
    console.warn(e);
    result = 'fallback';
    toast(e?.name === 'NotAllowedError' ? 'Accès à la caméra refusé : appareil photo du téléphone utilisé.' : 'Caméra indisponible : appareil photo du téléphone utilisé.');
    if (dlg.open) dlg.close();
  };

  async function shoot() {
    const v = $('#cam-video', dlg);
    if (!v.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    const blob = await toBlob(c, 0.92);
    const track = stream.getVideoTracks()[0];
    const now = new Date();
    result = {
      file: new File([blob], `photo_guidee_${now.toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`, { type: 'image/jpeg', lastModified: now.getTime() }),
      device: [track?.label, `${c.width} × ${c.height}`].filter(Boolean).join(' · '),
    };
    dlg.close();
  }

  await openDialog('', {
    cls: 'camera',
    onOpen: () => { render(); start().catch(fail); },
  });
  stream?.getTracks().forEach(t => t.stop());
  return result;
}

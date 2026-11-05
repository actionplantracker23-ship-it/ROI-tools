'use strict';
/* Analyse IA des photos (facultative), appelée depuis l'appareil, au choix avec :
   - l'API Claude d'Anthropic (Claude Opus 5.5) ;
   - l'API Gemini de Google (modèle choisi par le médecin, gemini-flash-latest par défaut).
   - Désactivée tant que le médecin n'a pas saisi de clé API dans les réglages de son espace.
   - N'envoie que l'image et le contexte clinique (motif, zone, type de photo, date relative) :
     jamais le nom, le n° de dossier ni les notes générales du patient.
   - Exige le consentement du patient à l'analyse par IA.
   - Le résultat est une aide à l'analyse, jamais un diagnostic. */

const AI_MODEL = 'claude-opus-5-5';
const AI_SDK_URL = './vendor/anthropic-sdk-1.1.0.mjs';
const GEMINI_SDK_URL = './vendor/google-genai-2.30.0.mjs';
const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
const PROVIDERS = { claude: 'Claude (Anthropic)', gemini: 'Gemini (Google)' };
const AI_DISCLAIMER = 'Aide à l\'analyse générée par IA : ne remplace ni l\'examen clinique ni le jugement du médecin.';

const aiKeyName = () => `ds-ai-${space.id}`;
function aiConfig() { try { return JSON.parse(localStorage.getItem(aiKeyName())) || {}; } catch { return {}; } }
const saveAiConfig = c => localStorage.setItem(aiKeyName(), JSON.stringify(c));
// provider : 'claude' (clé dans key) ou 'gemini' (clé dans geminiKey, modèle dans geminiModel).
const aiProvider = () => (aiConfig().provider === 'gemini' ? 'gemini' : 'claude');
const aiReady = () => { const c = aiConfig(); return aiProvider() === 'gemini' ? !!c.geminiKey : !!c.key; };
const providerCompany = () => (aiProvider() === 'gemini' ? 'Google' : 'Anthropic');

let sdkPromise = null;
async function aiClient() {
  const { key } = aiConfig();
  if (!key) throw new Error('Aucune clé API : ajoutez-la dans Réglages → Analyse IA.');
  sdkPromise ||= import(AI_SDK_URL);
  const { default: Anthropic } = await sdkPromise;
  // Appel direct depuis le navigateur : la clé reste sur cet appareil et n'est envoyée qu'à Anthropic.
  return { Anthropic, client: new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true }) };
}

const SYSTEM = `Tu es un assistant d'aide à l'analyse d'images pour un médecin dermatologue, qui suit l'évolution de lésions cutanées et de plaies de ses patients.
Tu reçois des photos cliniques ou dermoscopiques avec un contexte minimal. Le médecin reste seul responsable du diagnostic : tu l'aides à observer de façon structurée, sans jamais présenter un diagnostic comme certain.

Méthode :
- Décris objectivement ce qui est visible, avec la terminologie dermatologique française (lésion élémentaire, couleur, limites, surface, distribution).
- Plaie ou ulcère : évalue le lit (pourcentages approximatifs de granulation, fibrine, nécrose, épithélialisation), l'exsudat, les berges, la peau périlésionnelle (macération, érythème, eczéma), et les signes d'infection (critères proches de TIME / NERDS-STONEES quand c'est pertinent).
- Lésion pigmentée : applique la règle ABCDE ; si la photo est dermoscopique, décris le réseau, les globules et points, les structures de régression, le voile bleu-blanc, les vaisseaux, et indique si une analyse par la méthode des 7 points ou un algorithme en 2 étapes oriente vers une lésion mélanocytaire suspecte.
- Dermatose inflammatoire : décris la morphologie, l'étendue visible et les signes de sévérité.
- Signale clairement tout signe d'alerte justifiant un avis rapide ou une exérèse/biopsie.
- Évalue la qualité de la photo (netteté, lumière, cadrage, présence d'une échelle) et ce qui limite l'analyse ; ne surinterprète pas une image de mauvaise qualité.
- Propose un diagnostic différentiel classé, avec les arguments, et des éléments de conduite à discuter (examens, surveillance, adaptation du traitement), formulés comme des suggestions.
Réponds en français, de façon concise et clinique.`;

const OBS = {
  type: 'array',
  items: { type: 'object', additionalProperties: false, required: ['critere', 'constat'], properties: { critere: { type: 'string' }, constat: { type: 'string' } } },
};
const QUALITY = {
  type: 'object', additionalProperties: false, required: ['note', 'commentaire'],
  properties: { note: { type: 'string', enum: ['bonne', 'moyenne', 'insuffisante'] }, commentaire: { type: 'string' } },
};
const STRINGS = { type: 'array', items: { type: 'string' } };

const PHOTO_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['categorie', 'description', 'observations', 'hypotheses', 'signes_alerte', 'conduite_suggeree', 'qualite_image'],
  properties: {
    categorie: { type: 'string', enum: ['plaie / ulcère', 'lésion pigmentée', 'dermatose inflammatoire', 'lésion tumorale non pigmentée', 'cicatrice', 'autre / indéterminé'] },
    description: { type: 'string' },
    observations: OBS,
    hypotheses: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['diagnostic', 'arguments', 'probabilite'],
        properties: { diagnostic: { type: 'string' }, arguments: { type: 'string' }, probabilite: { type: 'string', enum: ['élevée', 'moyenne', 'faible'] } },
      },
    },
    signes_alerte: STRINGS,
    conduite_suggeree: STRINGS,
    qualite_image: QUALITY,
  },
};

const EVOL_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['tendance', 'resume', 'changements', 'signes_alerte', 'conduite_suggeree', 'comparabilite'],
  properties: {
    tendance: { type: 'string', enum: ['amélioration nette', 'amélioration légère', 'stable', 'aggravation', 'indéterminé'] },
    resume: { type: 'string' },
    changements: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['critere', 'avant', 'apres'],
        properties: { critere: { type: 'string' }, avant: { type: 'string' }, apres: { type: 'string' } },
      },
    },
    signes_alerte: STRINGS,
    conduite_suggeree: STRINGS,
    comparabilite: QUALITY,
  },
};

// Image réduite (1568 px au plus grand côté, taille conseillée pour l'analyse d'image) en base64.
async function imageBlock(blob) {
  const img = await decode(blob);
  const { blob: small } = await resized(img, 1568, 0.9);
  const data = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(small);
  });
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
}

const PHOTO_TYPES = { clinique: 'photo clinique', dermoscopie: 'image dermoscopique', ensemble: 'vue d\'ensemble' };
function photoContext(ep, ph, first) {
  const m = photoMeasures(ph);
  return [
    `Motif de suivi : ${ep.title}`,
    ph.zone && `Localisation : ${ph.zone}`,
    `Type d'image : ${PHOTO_TYPES[ph.kind] || PHOTO_TYPES.clinique}`,
    first && `Jour de suivi : ${dayLabel(daysBetween(first, ph.date))} (première photo du motif = J0)`,
    m?.area != null && `Surface mesurée par le médecin : ${fr1(m.area)} cm²`,
    m?.length != null && `Plus grande longueur mesurée : ${fr1(m.length)} mm`,
    ph.note && `Note du médecin sur la photo : ${ph.note}`,
  ].filter(Boolean).join('\n');
}

// Point d'entrée commun : le contenu est décrit au format Claude (blocs image / texte) et converti pour Gemini.
const callAI = (content, schema) => (aiProvider() === 'gemini' ? callGemini(content, schema) : callClaude(content, schema));

let geminiSdk = null;
// Relances automatiques sur les erreurs temporaires (surcharge 503, 429…) : 4 essais, 2 s puis délai croissant.
// Une erreur 500 passe directement au second essai sans schéma imposé (voir callGemini).
const GEMINI_RETRY = { attempts: 4, initialDelay: 2, maxDelay: 20, httpStatusCodes: [408, 429, 502, 503, 504] };

async function callGemini(content, schema) {
  const { geminiKey, geminiModel } = aiConfig();
  if (!geminiKey) throw new Error('Aucune clé API Gemini : ajoutez-la dans Réglages → Analyse IA.');
  geminiSdk ||= import(GEMINI_SDK_URL);
  const { GoogleGenAI, ApiError } = await geminiSdk;
  const ai = new GoogleGenAI({ apiKey: geminiKey, httpOptions: { retryOptions: GEMINI_RETRY } });
  const model = geminiModel || GEMINI_DEFAULT_MODEL;
  const parts = content.map(b => (b.type === 'image'
    ? { inlineData: { mimeType: b.source.media_type, data: b.source.data } }
    : { text: b.text }));
  const run = withSchema => ai.models.generateContent({
    model,
    contents: [{ role: 'user', parts: withSchema ? parts : [...parts, { text: `Réponds uniquement par un objet JSON conforme à ce schéma JSON :\n${JSON.stringify(schema)}` }] }],
    config: { systemInstruction: SYSTEM, responseMimeType: 'application/json', ...(withSchema ? { responseJsonSchema: schema } : {}) },
  });
  let res;
  try {
    res = await run(true);
  } catch (e) {
    // Certaines versions de Gemini échouent (erreur 500) sur un schéma de réponse détaillé :
    // nouvel essai avec le schéma décrit dans la consigne plutôt qu'imposé.
    if (!(e instanceof ApiError && e.status === 500)) throw new Error(geminiErrorMessage(e, ApiError));
    try { res = await run(false); } catch (e2) { throw new Error(geminiErrorMessage(e2, ApiError)); }
  }
  const cand = res.candidates?.[0];
  if (!cand) throw new Error(`L'IA n'a pas pu analyser cette image (demande bloquée${res.promptFeedback?.blockReason ? ' : ' + res.promptFeedback.blockReason : ''}).`);
  if (cand.finishReason === 'MAX_TOKENS') throw new Error('Réponse incomplète : relancez l\'analyse.');
  if (cand.finishReason && cand.finishReason !== 'STOP') throw new Error(`L'IA n'a pas pu analyser cette image (arrêt : ${cand.finishReason}).`);
  let result;
  try { result = JSON.parse(String(res.text).replace(/^```(?:json)?\s*|\s*```$/g, '')); }
  catch { throw new Error('Réponse de Gemini illisible : relancez l\'analyse ou choisissez un autre modèle.'); }
  return { result: normalizeResult(result, schema), model: res.modelVersion || model };
}

// Complète une réponse incomplète (champs manquants) pour que l'affichage ne casse pas.
function normalizeResult(r, schema) {
  const out = { ...(r && typeof r === 'object' ? r : {}) };
  for (const [k, def] of Object.entries(schema.properties)) {
    if (out[k] !== undefined && out[k] !== null) continue;
    out[k] = def.type === 'array' ? [] : def.type === 'object' ? { note: 'moyenne', commentaire: '' } : def.enum ? def.enum[def.enum.length - 1] : '';
  }
  return out;
}

function geminiErrorMessage(e, ApiError) {
  if (e instanceof ApiError) {
    // Message exact de Google (raccourci), utile pour comprendre une erreur persistante.
    let detail = String(e.message || '');
    try { detail = JSON.parse(detail.slice(detail.indexOf('{'))).error?.message || detail; } catch { /* message brut */ }
    detail = detail.slice(0, 220);
    if (e.status === 400 && /api key/i.test(detail)) return 'Clé API Gemini refusée : vérifiez-la dans les réglages.';
    if (e.status === 403) return `Cette clé API Gemini n'a pas accès à ce service ou à ce modèle. (Google : ${detail})`;
    if (e.status === 404) return `Modèle Gemini introuvable : choisissez-en un autre dans les réglages. (Google : ${detail})`;
    if (e.status === 429) return `Quota Gemini atteint ou trop de demandes : réessayez plus tard, ou vérifiez les quotas de votre clé. (Google : ${detail})`;
    if (e.status === 503) return `Gemini est surchargé en ce moment (4 essais faits) : réessayez dans quelques minutes, ou choisissez un autre modèle dans les réglages. (Google : ${detail})`;
    if (e.status >= 500) return `Erreur du service Gemini (${e.status}) : réessayez plus tard ou choisissez un autre modèle dans les réglages. (Google : ${detail})`;
    return `Erreur du service Gemini (${e.status}) : ${detail}`;
  }
  if (e instanceof TypeError) return 'Pas de connexion à internet : l\'analyse IA nécessite le réseau.';
  return e?.message || String(e);
}

// Modèles Gemini disponibles pour cette clé, capables d'analyser une image et de répondre en texte.
async function listGeminiModels() {
  const { geminiKey } = aiConfig();
  geminiSdk ||= import(GEMINI_SDK_URL);
  const { GoogleGenAI, ApiError } = await geminiSdk;
  const out = [];
  try {
    const pager = await new GoogleGenAI({ apiKey: geminiKey }).models.list();
    for await (const m of pager) {
      if (/gemini/i.test(m.name) && !/embedding|image|tts|audio|live/i.test(m.name) && (m.supportedActions || ['generateContent']).includes('generateContent')) {
        out.push({ id: m.name.replace(/^models\//, ''), label: m.displayName || m.name });
      }
    }
  } catch (e) {
    throw new Error(geminiErrorMessage(e, ApiError));
  }
  return out;
}

let fallbacksUnsupported = false;
async function callClaude(content, schema) {
  const { Anthropic, client } = await aiClient();
  const params = {
    model: AI_MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: 'high', format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  };
  let res;
  try {
    // Si le modèle décline la demande, l'API la relance d'elle-même sur le modèle de repli recommandé.
    res = fallbacksUnsupported
      ? await client.messages.create(params)
      : await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } catch (e) {
    if (!fallbacksUnsupported && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) {
      fallbacksUnsupported = true;
      return callClaude(content, schema);
    }
    throw new Error(aiErrorMessage(e, Anthropic));
  }
  if (res.stop_reason === 'refusal') throw new Error('L\'IA n\'a pas pu analyser cette image (demande déclinée par le modèle).');
  if (res.stop_reason === 'max_tokens') throw new Error('Réponse incomplète : relancez l\'analyse.');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return { result: normalizeResult(JSON.parse(text), schema), model: res.model };
}

function aiErrorMessage(e, A) {
  if (e instanceof A.AuthenticationError) return 'Clé API refusée : vérifiez-la dans les réglages.';
  if (e instanceof A.PermissionDeniedError) return 'Cette clé API n\'a pas accès à ce modèle.';
  if (e instanceof A.RateLimitError) return 'Trop de demandes pour le moment : réessayez dans une minute.';
  if (e instanceof A.APIConnectionError) return 'Pas de connexion à internet : l\'analyse IA nécessite le réseau.';
  if (e instanceof A.InternalServerError) return 'Le service IA est momentanément indisponible : réessayez plus tard.';
  if (e instanceof A.APIError) return `Erreur du service IA (${e.status ?? '?'}) : ${e.message}`;
  return e?.message || String(e);
}

// Vérifie que le consentement à l'analyse IA est recueilli ; propose de l'enregistrer sinon.
async function ensureAiConsent(p) {
  if (p.consent?.ai) return true;
  const ok = await confirmBox('Consentement à l\'analyse IA',
    `L'image (sans le nom du patient) va être envoyée au service d'IA de ${providerCompany()}, hors de l'appareil. ${p.name} a-t-il donné son accord ? L'accord sera enregistré dans le dossier avec la date du jour.`,
    'Oui, le patient est d\'accord');
  if (!ok) return false;
  p.consent = { ...(p.consent || {}), ai: today() };
  await putOne('patients', p);
  return true;
}

async function analyzePhoto(p, ep, ph, first) {
  const content = [await imageBlock(ph.blob), { type: 'text', text: `${photoContext(ep, ph, first)}\n\nAnalyse cette image.` }];
  const { result, model } = await callAI(content, PHOTO_SCHEMA);
  ph.ai = { at: new Date().toISOString(), provider: aiProvider(), model, result };
  await putOne('photos', ph);
  return ph.ai;
}

async function analyzeEvolution(p, ep, photos) {
  const first = photos[0].date;
  const content = [];
  for (const ph of photos) {
    content.push({ type: 'text', text: `Photo du ${dayLabel(daysBetween(first, ph.date))} :\n${photoContext(ep, ph, first)}` });
    content.push(await imageBlock(ph.blob));
  }
  content.push({ type: 'text', text: `Compare ces ${photos.length} photos, prises dans l'ordre chronologique sur ${daysBetween(first, photos[photos.length - 1].date)} jours, et décris l'évolution. Tiens compte des différences de cadrage, de distance et de lumière avant de conclure.` });
  const { result, model } = await callAI(content, EVOL_SCHEMA);
  const entry = { at: new Date().toISOString(), provider: aiProvider(), model, ids: photos.map(x => x.id), result };
  const e = p.episodes.find(x => x.id === ep.id);
  e.aiEvol = [entry, ...(e.aiEvol || [])].slice(0, 10);
  await putOne('patients', p);
  return entry;
}

/* ---------- Affichage des résultats ---------- */

const aiList = items => (items?.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">Aucun.</p>');
const aiWhen = a => `${new Date(a.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`;

function renderPhotoAnalysis(a) {
  const r = a.result;
  return `<div class="ai-result">
    <p class="ai-meta">Analyse du ${aiWhen(a)} · ${esc(a.model || '')} · ${esc(r.categorie)} · qualité d'image ${esc(r.qualite_image.note)}</p>
    <p>${esc(r.description)}</p>
    ${r.signes_alerte.length ? `<div class="ai-alert"><b>Signes d'alerte</b>${aiList(r.signes_alerte)}</div>` : ''}
    <h4>Observations</h4>
    <dl class="ai-obs">${r.observations.map(o => `<dt>${esc(o.critere)}</dt><dd>${esc(o.constat)}</dd>`).join('')}</dl>
    <h4>Hypothèses à discuter</h4>
    <ol class="ai-hyp">${r.hypotheses.map(h => `<li><b>${esc(h.diagnostic)}</b> <span class="prob ${h.probabilite === 'élevée' ? 'hi' : h.probabilite === 'moyenne' ? 'mid' : 'lo'}">${esc(h.probabilite)}</span><br><small>${esc(h.arguments)}</small></li>`).join('')}</ol>
    <h4>Conduite à discuter</h4>${aiList(r.conduite_suggeree)}
    <p class="muted"><b>Qualité de l'image :</b> ${esc(r.qualite_image.commentaire)}</p>
    <p class="ai-disc">${AI_DISCLAIMER}</p>
  </div>`;
}

function renderEvolution(a) {
  const r = a.result;
  const cls = /amélioration/.test(r.tendance) ? 'up' : r.tendance === 'aggravation' ? 'down' : 'flat';
  return `<div class="ai-result">
    <p class="ai-meta">Analyse du ${aiWhen(a)} · ${esc(a.model || '')} · ${a.ids.length} photos</p>
    <p class="trend ${cls}">${esc(r.tendance)}</p>
    <p>${esc(r.resume)}</p>
    ${r.signes_alerte.length ? `<div class="ai-alert"><b>Signes d'alerte</b>${aiList(r.signes_alerte)}</div>` : ''}
    ${r.changements.length ? `<table class="ai-chg"><thead><tr><th>Critère</th><th>Avant</th><th>Après</th></tr></thead><tbody>
      ${r.changements.map(c => `<tr><td>${esc(c.critere)}</td><td>${esc(c.avant)}</td><td>${esc(c.apres)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h4>Conduite à discuter</h4>${aiList(r.conduite_suggeree)}
    <p class="muted"><b>Comparabilité des photos (${esc(r.comparabilite.note)}) :</b> ${esc(r.comparabilite.commentaire)}</p>
    <p class="ai-disc">${AI_DISCLAIMER}</p>
  </div>`;
}

/* ---------- Réglages ---------- */

function aiSettingsCard() {
  const c = aiConfig();
  const prov = aiProvider();
  const models = c.geminiModels || [];
  const curModel = c.geminiModel || GEMINI_DEFAULT_MODEL;
  return `<section class="card">
    <h2>Analyse IA (facultatif)</h2>
    <p>Demandez à une IA une analyse structurée d'une photo ou de l'évolution entre plusieurs photos :
    description, critères (plaie, ABCDE, dermoscopie), hypothèses à discuter, signes d'alerte. C'est une aide : le diagnostic reste le vôtre.</p>
    <div class="seg ai-prov" role="radiogroup" aria-label="Moteur d'analyse">
      ${Object.entries(PROVIDERS).map(([k, v]) => `<button type="button" role="radio" aria-checked="${prov === k}" class="${prov === k ? 'on' : ''}" data-prov="${k}">${v}</button>`).join('')}
    </div>
    ${prov === 'claude' ? `
      <div class="banner warn">⚠️ Pour l'analyse, la photo quitte l'appareil et est envoyée à Anthropic (États-Unis). Le nom et le n° de dossier ne sont
      jamais envoyés, mais une photo peut rester identifiante. Anthropic n'est pas un hébergeur de données de santé certifié (HDS) :
      vérifiez ce point avec votre DPO avant un usage courant, et recueillez le consentement du patient (demandé par l'application).</div>
      <div class="field" style="margin-top:12px"><label for="ai-key">Clé API Anthropic (console.anthropic.com)</label>
        <input type="password" id="ai-key" value="${esc(c.key || '')}" placeholder="sk-ant-…" autocomplete="off"></div>
      <p class="muted">Modèle : Claude Opus 5.5. Les analyses sont facturées par Anthropic sur votre compte.</p>`
    : `
      <div class="banner warn">⚠️ Pour l'analyse, la photo quitte l'appareil et est envoyée à Google. Le nom et le n° de dossier ne sont jamais envoyés,
      mais une photo peut rester identifiante. <b>Avec une clé gratuite (offre gratuite de Google AI Studio), Google peut utiliser les contenus
      envoyés pour améliorer ses produits et les faire relire par des personnes</b> : ne l'utilisez pas pour de vraies photos de patients.
      Utilisez une clé d'un projet avec facturation activée (offre payante), et faites valider l'usage par votre DPO (Google n'est pas HDS pour ce service).</div>
      <div class="field" style="margin-top:12px"><label for="ai-gkey">Clé API Gemini (aistudio.google.com)</label>
        <input type="password" id="ai-gkey" value="${esc(c.geminiKey || '')}" placeholder="AIza…" autocomplete="off"></div>
      <div class="field"><label for="ai-gmodel">Modèle Gemini</label>
        <select id="ai-gmodel">
          ${[...new Map([[GEMINI_DEFAULT_MODEL, 'Gemini Flash (dernière version)'], [curModel, curModel], ...models.map(m => [m.id, `${m.label} (${m.id})`])])]
            .map(([id, label]) => `<option value="${esc(id)}"${id === curModel ? ' selected' : ''}>${esc(label)}</option>`).join('')}
        </select>
        ${c.geminiKey ? '<button type="button" class="btn small" data-act="aimodels" style="justify-self:start">Charger la liste des modèles de ma clé</button>' : ''}
      </div>`}
    <p class="muted">La clé est enregistrée uniquement sur cet appareil, pour cet espace.</p>
    <div class="row">
      <button class="btn primary" data-act="aisave">Enregistrer</button>
      ${aiReady() ? '<button class="btn" data-act="aitest">Tester</button><button class="btn danger ghost" data-act="aidel">Retirer la clé</button>' : ''}
    </div>
  </section>`;
}

function bindAiSettings() {
  const on = (act, fn) => { const b = app.querySelector(`[data-act=${act}]`); if (b) b.onclick = fn; };
  app.querySelectorAll('[data-prov]').forEach(b => (b.onclick = () => { saveAiConfig({ ...aiConfig(), provider: b.dataset.prov }); route(); }));
  on('aisave', () => {
    const c = aiConfig();
    if (aiProvider() === 'gemini') {
      const geminiKey = $('#ai-gkey').value.trim();
      if (!geminiKey) return toast('Saisissez une clé API Gemini');
      saveAiConfig({ ...c, provider: 'gemini', geminiKey, geminiModel: $('#ai-gmodel').value });
    } else {
      const key = $('#ai-key').value.trim();
      if (!key) return toast('Saisissez une clé API Anthropic');
      saveAiConfig({ ...c, provider: 'claude', key });
    }
    toast('Réglages IA enregistrés sur cet appareil');
    route();
  });
  on('aidel', () => {
    const c = aiConfig();
    if (aiProvider() === 'gemini') { delete c.geminiKey; delete c.geminiModels; } else delete c.key;
    saveAiConfig(c);
    toast('Clé retirée');
    route();
  });
  on('aimodels', async e => {
    const b = e.currentTarget;
    b.disabled = true;
    b.textContent = 'Chargement…';
    try {
      const models = await listGeminiModels();
      saveAiConfig({ ...aiConfig(), geminiModels: models });
      toast(`${models.length} modèles disponibles`);
      route();
    } catch (err) {
      alert(err.message);
      b.disabled = false;
      b.textContent = 'Charger la liste des modèles de ma clé';
    }
  });
  on('aitest', async e => {
    const b = e.currentTarget;
    b.disabled = true;
    b.textContent = 'Test en cours…';
    try {
      // Petite image de test neutre (pas de donnée patient).
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      g.fillStyle = '#e8c4aa'; g.fillRect(0, 0, 64, 64);
      const content = [await imageBlock(await toBlob(c)), { type: 'text', text: 'Test de connexion : image uniforme couleur peau, sans lésion. Réponds brièvement.' }];
      const { model } = await callAI(content, PHOTO_SCHEMA);
      toast(`Connexion réussie (${model})`);
    } catch (err) {
      alert(err.message);
    }
    b.disabled = false;
    b.textContent = 'Tester';
  });
}

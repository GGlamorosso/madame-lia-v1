// Livraison client sans serveur ni stockage : toutes les informations tiennent dans le fragment (#) du lien,
// qui n'est jamais envoyé au serveur. Le téléchargement reste chez le service de transfert choisi par Lia.
// - /livraison/#v1.…        : page de livraison au nom du client.
// - /livraison/creer/       : générateur du lien (page non référencée).
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const VERSION = 'v1';
  // Seuls ces services peuvent être la cible du bouton « Télécharger » : une page Madame Lia
  // ne peut pas renvoyer vers un site inconnu, même si quelqu'un fabrique un lien.
  const SERVICES = [
    ['wetransfer.com', 'WeTransfer'], ['we.tl', 'WeTransfer'],
    ['swisstransfer.com', 'SwissTransfer'],
    ['drive.google.com', 'Google Drive'], ['photos.google.com', 'Google Photos'], ['photos.app.goo.gl', 'Google Photos'],
    ['dropbox.com', 'Dropbox'], ['fromsmash.com', 'Smash'], ['icloud.com', 'iCloud'], ['transfernow.net', 'TransferNow']
  ];
  const LIMITS = { n: 80, o: 60, m: 1200 };
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

  const serviceName = url => {
    const host = url.hostname.toLowerCase();
    return SERVICES.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] || null;
  };
  function checkURL(value) {
    let url;
    try { url = new URL(String(value).trim()); } catch { return { error: 'Collez le lien complet, qui commence par https://' }; }
    if (url.protocol !== 'https:') return { error: 'Le lien doit commencer par https://' };
    if (url.username || url.password) return { error: 'Ce lien n’est pas accepté.' };
    const name = serviceName(url);
    if (!name) return { error: `Service non reconnu (${url.hostname}). Utilisez WeTransfer, SwissTransfer, Google Drive, Dropbox ou Smash.` };
    return { url: url.href, name };
  }
  const validDate = value => ISO_DATE.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
  const formatDate = value => new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${value}T12:00:00`));
  const today = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-JJ, heure locale.
  const clean = (value, max) => String(value ?? '').replace(/\s+$/g, '').replace(/^\s+/g, '').slice(0, max);

  // Normalise et vérifie une livraison ; lève une erreur si elle n'est pas utilisable.
  function normalize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('format');
    const delivery = {};
    const name = clean(raw.n, LIMITS.n).replace(/\s+/g, ' ');
    if (!name) throw new Error('nom');
    delivery.n = name;
    const target = checkURL(raw.u || '');
    if (target.error) throw new Error('lien');
    delivery.u = target.url;
    const occasion = clean(raw.o, LIMITS.o).replace(/\s+/g, ' ');
    if (occasion) delivery.o = occasion;
    if (raw.d && validDate(raw.d)) delivery.d = raw.d;
    if (raw.x && validDate(raw.x)) delivery.x = raw.x;
    const count = Number(raw.c);
    if (Number.isInteger(count) && count > 0 && count <= 100000) delivery.c = count;
    const message = clean(raw.m, LIMITS.m);
    if (message) delivery.m = message;
    return delivery;
  }
  function encode(delivery) {
    const bytes = new TextEncoder().encode(JSON.stringify(delivery));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return `${VERSION}.${btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
  }
  function decode(fragment) {
    const [version, payload] = fragment.split('.');
    if (version !== VERSION || !payload || !/^[A-Za-z0-9_-]+$/.test(payload)) throw new Error('version');
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
    const json = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
    return normalize(JSON.parse(json));
  }
  // Le numéro WhatsApp vient des liens écrits par scripts/sync-content.mjs.
  const whatsappNumber = () => ($('a[href^="https://wa.me/"]')?.href.match(/wa\.me\/(\d+)/) || [])[1] || '';
  const whatsappURL = (text, number = whatsappNumber()) => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;

  /* ---------- Page de livraison ---------- */
  function showDelivery() {
    const states = $$('[data-state]');
    if (!states.length) return;
    const show = state => states.forEach(section => { section.hidden = section.dataset.state !== state; });
    const fragment = location.hash.slice(1);
    if (!fragment) { show('empty'); return; }
    let delivery;
    try { delivery = decode(fragment); } catch {
      $('[data-wa-message="invalid"]').href = whatsappURL('Bonjour Lia, mon lien de livraison ne s’ouvre pas correctement. Pourriez-vous me le renvoyer ?');
      document.title = 'Lien incomplet — Madame Lia';
      show('invalid');
      return;
    }
    const ready = $('[data-state="ready"]');
    const expired = Boolean(delivery.x && today() > delivery.x);
    const service = serviceName(new URL(delivery.u));
    $$('[data-when]', ready).forEach(element => { element.hidden = element.dataset.when !== (expired ? 'expired' : 'ok'); });
    $('[data-field="kicker"]', ready).textContent = ['Livraison', delivery.o, delivery.d && formatDate(delivery.d)].filter(Boolean).join(' · ');
    $('[data-field="name"]', ready).textContent = `${delivery.n},`;
    const message = $('[data-field="message"]', ready);
    message.textContent = delivery.m || '';
    message.hidden = !delivery.m;
    $('[data-field="signature"]', ready).hidden = !delivery.m;
    $$('[data-field="download"]', ready).forEach(link => { link.href = delivery.u; });
    const meta = [];
    if (delivery.c) meta.push(`${delivery.c} image${delivery.c > 1 ? 's' : ''}`);
    meta.push(`via ${service}`);
    if (expired) meta.push(`lien expiré le ${formatDate(delivery.x)}`);
    else if (delivery.x) meta.push(`disponible jusqu’au ${formatDate(delivery.x)}`);
    else meta.push('lien à durée limitée : téléchargez sans attendre');
    $('[data-field="meta"]', ready).textContent = meta.join(' · ');
    $('[data-wa-message="expired"]', ready).href = whatsappURL(`Bonjour Lia, mon lien de livraison (${delivery.n}) a expiré. Pourriez-vous me le renvoyer ?`);
    $('[data-wa-message="again"]', ready).href = whatsappURL(`Bonjour Lia, j’ai bien reçu mes photos (${delivery.n}). J’aimerais réserver une nouvelle séance.`);
    document.title = `${expired ? 'Lien expiré' : 'Vos images'} — ${delivery.n} · Madame Lia`;
    show('ready');
  }
  if ($('[data-state]')) {
    showDelivery();
    addEventListener('hashchange', () => { showDelivery(); scrollTo(0, 0); });
  }

  /* ---------- Générateur ---------- */
  const form = $('#delivery-form');
  if (!form) return;
  const output = $('#d-link');
  const copyButton = $('#d-copy');
  const status = $('#d-status');
  const urlInput = $('#d-url');
  const urlError = $('#d-url-error');
  const links = { whatsapp: $('#d-whatsapp'), email: $('#d-email'), preview: $('#d-preview') };
  const base = new URL('/livraison/', location.origin).href;
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);
  let current = '';
  const setLink = (link, href) => {
    link.href = href || '#';
    link.setAttribute('aria-disabled', String(!href));
    if (href) link.removeAttribute('tabindex'); else link.tabIndex = -1;
  };
  function update() {
    const value = name => form.elements.namedItem(name).value;
    const target = urlInput.value.trim() ? checkURL(urlInput.value) : { error: '' };
    urlError.textContent = target.error || '';
    urlError.hidden = !target.error;
    urlInput.setAttribute('aria-invalid', String(Boolean(target.error)));
    let delivery = null;
    try { delivery = normalize({ n: value('n'), u: value('u'), o: value('o'), d: value('d'), x: value('x'), c: value('c'), m: value('m') }); } catch { delivery = null; }
    current = delivery ? `${base}#${encode(delivery)}` : '';
    output.value = current;
    copyButton.disabled = !current;
    status.textContent = current && local ? 'Aperçu local : ce lien pointe vers votre ordinateur. Créez les liens à envoyer depuis le site en ligne.' : '';
    if (!current) { Object.values(links).forEach(link => setLink(link, '')); return; }
    const text = `Bonjour ${delivery.n},\n\nVos images sont prêtes ! Vous pouvez les découvrir et les télécharger ici :\n${current}\n\nÀ très vite,\nLia`;
    // Sans numéro : WhatsApp demande à Lia de choisir le contact.
    setLink(links.whatsapp, `https://wa.me/?text=${encodeURIComponent(text)}`);
    setLink(links.email, `mailto:?subject=${encodeURIComponent('Vos photos sont prêtes')}&body=${encodeURIComponent(text)}`);
    setLink(links.preview, current);
  }
  form.addEventListener('input', update);
  form.addEventListener('submit', event => event.preventDefault());
  copyButton.addEventListener('click', async () => {
    if (!current) return;
    try { await navigator.clipboard.writeText(current); }
    catch { output.select(); document.execCommand('copy'); }
    status.textContent = 'Lien copié. Vous pouvez le coller dans votre message.';
  });
  update();
})();

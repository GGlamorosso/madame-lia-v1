// Actualise toutes les pages HTML de dist/ sans build après une modification de dist/services.json
// ou des gabarits de templates/. Aucune dépendance.
// - Gabarits partagés (en-tête, pied de page, icônes, barre mobile) entre <!-- partial:nom --> et <!-- /partial:nom -->.
// - Blocs générés depuis les données entre <!-- generated:nom --> et <!-- /generated:nom -->.
// - Images fixes (data-image), préchargement, coordonnées et réseaux écrits en dur (justes sans JavaScript),
//   mentions « provisoire », copie de secours du JSON (accueil) et liens internes vérifiés.
// --check : n'écrit rien, échoue si une page n'est pas à jour.
import { readFile, writeFile, access, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../dist/', import.meta.url);
const templates = new URL('../templates/', import.meta.url);
const data = JSON.parse(await readFile(new URL('services.json', root), 'utf8'));
const validPath = path => typeof path === 'string' && /^assets\/[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(path);
async function checkPhoto(photo) {
  assert(photo && validPath(photo.src), 'Photo: chemin local assets/ requis (jpg, jpeg, png, webp)');
  assert(typeof photo.alt === 'string' && photo.alt.trim(), `Texte alternatif manquant: ${photo.src}`);
  assert(Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0, `Dimensions: ${photo.src}`);
  assert(typeof photo.provisional === 'boolean', `provisional requis: ${photo.src}`);
  assert(photo.select === undefined || typeof photo.select === 'boolean', `select doit être un booléen: ${photo.src}`);
  await access(new URL(photo.src, root));
  if (photo.srcset !== undefined) {
    assert(typeof photo.srcset === 'string');
    for (const candidate of photo.srcset.split(',')) {
      const [path, width, extra] = candidate.trim().split(/\s+/);
      assert(validPath(path) && /^[1-9]\d*w$/.test(width) && !extra, `srcset invalide: ${candidate}`);
      await access(new URL(path, root));
    }
  }
}
assert(data.contact && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact.email) && /^\d+$/.test(data.contact.whatsapp));
assert(Array.isArray(data.contact.socials));
for (const social of data.contact.socials) assert(typeof social.label === 'string' && new URL(social.url).protocol === 'https:', 'Réseau: label et URL https requis');
assert(Array.isArray(data.services) && data.services.length);
assert(new Set(data.services.map(service => service.id)).size === data.services.length);
for (const service of data.services) {
  assert(/^[a-z0-9-]+$/.test(service.id) && typeof service.title === 'string' && Array.isArray(service.photos));
  assert(service.bookable === undefined || typeof service.bookable === 'boolean', `bookable doit être un booléen: ${service.id}`);
  for (const photo of service.photos) await checkPhoto(photo);
}
assert(data.services.some(service => service.photos.length), 'Au moins un thème doit contenir des photos');
for (const key of ['hero', 'aboutMain', 'aboutDetail']) await checkPhoto(data.images[key]);

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
// Les données gardent « assets/… » ; le HTML de toutes les pages utilise des chemins depuis la racine.
const asset = path => `/${path}`;
const assetSet = srcset => srcset.split(',').map(candidate => { const [path, width] = candidate.trim().split(/\s+/); return `${asset(path)} ${width}`; }).join(', ');
const { whatsapp, email, socials } = data.contact;
const phone = /^33\d{9}$/.test(whatsapp) ? `+33 ${whatsapp[2]} ${whatsapp.slice(3).match(/\d{2}/g).join(' ')}` : `+${whatsapp}`;
const whatsappAbout = title => `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Bonjour Lia, je vous écris depuis votre site au sujet d’un projet : ${title}.`)}`;
const socialURL = new Map(socials.map(social => [social.label.toLowerCase(), new URL(social.url).href]));
const handle = url => `@${new URL(url).pathname.split('/').filter(Boolean)[0] || new URL(url).hostname}`;

const partials = {};
for (const name of ['sprite', 'header', 'footer', 'cta-bar', 'labo-head']) partials[name] = (await readFile(new URL(`${name}.html`, templates), 'utf8')).trim();
const bookable = data.services.filter(service => service.bookable !== false);
const lazyImage = (photo, sizes) => `<img src="${escape(asset(photo.src))}"${photo.srcset ? ` srcset="${escape(assetSet(photo.srcset))}" sizes="${sizes}"` : ''} alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">`;
// Accueil : pellicule des vues select:true, dans le même ordre que mixedPhotos() d'app.js (les thèmes alternent).
const reelSizes = '(min-width: 900px) 34vw, 78vw';
function selectionList() {
  const groups = data.services.filter(service => service.photos.length).map(service => service.photos.map(photo => ({ ...photo, title: service.title })));
  const mixed = [];
  for (let index = 0; index < Math.max(0, ...groups.map(group => group.length)); index++) groups.forEach(group => { if (group[index]) mixed.push(group[index]); });
  return mixed.filter(photo => photo.select);
}
const reelImage = photo => `<img src="${escape(asset(photo.src))}"${photo.srcset ? ` srcset="${escape(assetSet(photo.srcset))}" sizes="${reelSizes}"` : ''} alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">`;
const generated = {
  // Accueil : pellicule, présente dans le HTML (visible sans JavaScript).
  selection: () => selectionList().map((photo, index) => `<figure class="strip-item" style="aspect-ratio:${photo.width}/${photo.height}"><button class="dev" type="button" data-select-index="${index}" aria-label="Agrandir : ${escape(photo.title)}">${reelImage(photo)}</button><figcaption class="mono">${escape(photo.title)}</figcaption></figure>`).join(''),
  // À propos : les prestations, vers le filtre du portfolio ou vers WhatsApp sans galerie.
  themes: () => bookable.map(service => service.photos.length
    ? `<li><a href="/?theme=${escape(service.id)}#portfolio">${escape(service.title)}</a></li>`
    : `<li><a href="${escape(whatsappAbout(service.title))}" target="_blank" rel="noopener noreferrer">${escape(service.title)}</a></li>`).join(''),
  // À propos : carnets personnels (thèmes non réservables).
  carnets: () => data.services.filter(service => service.bookable === false).flatMap(service => service.photos)
    .map(photo => `<figure class="strip-item" style="aspect-ratio:${photo.width}/${photo.height}">${lazyImage(photo, '(min-width: 900px) 40vw, 80vw')}</figure>`).join(''),
  // Générateur de livraison : suggestions d'occasion.
  occasions: () => bookable.map(service => `<option value="${escape(service.title)}"></option>`).join('')
};
const fill = (html, kind, name, content) => html.replace(new RegExp(`(<!-- ${kind}:${name} -->)[\\s\\S]*?(<!-- /${kind}:${name} -->)`, 'g'), (_, open, close) => `${open}\n${content}\n${close}`);
const markCurrent = (html, pagePath) => html.replace(/<a\b([^>]*?)\shref="([^"]+)"/g, (tag, attrs, href) => href === pagePath ? `<a${attrs} href="${href}" aria-current="page"` : tag);

function render(html, pagePath) {
  for (const [name, content] of Object.entries(partials)) html = fill(html, 'partial', name, name === 'sprite' ? content : markCurrent(content, pagePath));
  for (const [name, build] of Object.entries(generated)) html = fill(html, 'generated', name, build());

  // Images fixes.
  html = html.replace(/<img\b[^>]*data-image="([^"]+)"[^>]*>/g, (tag, key) => {
    const photo = data.images[key];
    if (!photo) return tag;
    const values = { src: asset(photo.src), alt: photo.alt, width: photo.width, height: photo.height, srcset: photo.srcset && assetSet(photo.srcset) };
    for (const name of Object.keys(values)) {
      tag = tag.replace(new RegExp(`\\s${name}="[^"]*"`, 'g'), '');
      if (values[name] !== undefined) tag = tag.replace(/>$/, ` ${name}="${escape(values[name])}">`);
    }
    return tag;
  });
  const hero = data.images.hero;
  html = html.replace(/<link rel="preload"[^>]*as="image"[^>]*>/, `<link rel="preload" as="image" href="${escape(asset(hero.src))}"${hero.srcset ? ` imagesrcset="${escape(assetSet(hero.srcset))}" imagesizes="(min-width: 900px) 30vw, 74vw"` : ''} fetchpriority="high">`);

  // Coordonnées et réseaux écrits en dur (les messages préremplis ?text= sont conservés).
  html = html.replace(/https:\/\/wa\.me\/\d+/g, `https://wa.me/${whatsapp}`);
  html = html.replace(/mailto:[^"?<\s]+/g, `mailto:${escape(email)}`);
  html = html.replace(/tel:\+\d+/g, `tel:+${whatsapp}`);
  html = html.replace(/(<a\b[^>]*\bdata-email\b[^>]*>)[^<]*(<\/a>)/g, (_, open, close) => open + escape(email) + close);
  html = html.replace(/(<a\b[^>]*\bdata-tel\b[^>]*>)[^<]*(<\/a>)/g, (_, open, close) => open + phone + close);
  html = html.replace(/<a\b[^>]*\bdata-social="([^"]+)"[^>]*>/g, (tag, label) => {
    const url = socialURL.get(label.toLowerCase());
    tag = tag.replace(/\s+hidden(?:="[^"]*")?(?=[\s>])/g, '');
    return url ? tag.replace(/\shref="[^"]*"/, ` href="${escape(url)}"`) : tag.replace(/>$/, ' hidden>');
  });
  html = html.replace(/(<([a-z]+)\b[^>]*\bdata-social-handle="([^"]+)"[^>]*>)[^<]*(<\/\2>)/g, (_, open, tag, label, close) => {
    const url = socialURL.get(label.toLowerCase());
    return open + (url ? escape(handle(url)) : '') + close;
  });

  // Copie de secours (accueil) et mentions « provisoire ».
  const snapshot = JSON.stringify(data).replace(/</g, '\\u003c');
  html = html.replace(/(<script id="site-fallback" type="application\/json">)[\s\S]*?(<\/script>)/, (_, open, close) => open + snapshot + close);
  const allPhotos = [...Object.values(data.images), ...data.services.flatMap(service => service.photos)];
  for (const [attribute, show] of [
    ['data-site-provisional', allPhotos.some(photo => photo.provisional)],
    ['data-about-provisional', data.images.aboutMain.provisional || data.images.aboutDetail.provisional],
    ['data-portfolio-provisional', data.services.some(service => service.photos.some(photo => photo.provisional))]
  ]) html = html.replace(new RegExp(`<([a-z]+)([^>]*\\b${attribute}\\b[^>]*)>`, 'g'), (_, tag, attrs) => `<${tag}${attrs.replace(/\s+hidden(?:="[^"]*")?/g, '')}${show ? '' : ' hidden'}>`);
  return html;
}

// Liens internes absolus (/page/, /assets/…) : la cible doit exister dans dist/.
async function checkLinks(html, file) {
  for (const [, url] of html.matchAll(/\s(?:href|src)="(\/[^"#?]*)/g)) {
    if (url === '/') continue;
    const target = url.endsWith('/') ? `${url.slice(1)}index.html` : url.slice(1);
    await access(new URL(target, root)).catch(() => assert.fail(`Lien interne cassé dans ${file} : ${url}`));
  }
  for (const [, list] of html.matchAll(/\ssrcset="([^"]+)"/g)) {
    for (const candidate of list.split(',')) {
      const path = candidate.trim().split(/\s+/)[0];
      if (path.startsWith('/')) await access(new URL(path.slice(1), root)).catch(() => assert.fail(`Image absente dans ${file} : ${path}`));
    }
  }
}

const check = process.argv.includes('--check');
const pages = (await readdir(root, { recursive: true })).filter(file => file.endsWith('.html') && !file.startsWith('assets')).sort();
const stale = [];
for (const file of pages) {
  const url = new URL(file, root);
  const current = await readFile(url, 'utf8');
  const pagePath = file === 'index.html' ? '/' : file.endsWith('/index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`;
  const html = render(current, pagePath);
  await checkLinks(html, file);
  if (html === current) continue;
  stale.push(file);
  if (!check) await writeFile(url, html);
}
if (check) assert.equal(stale.length, 0, `HTML désynchronisé (${stale.join(', ')}) : lancer node scripts/sync-content.mjs`);
console.log(`${check ? 'Vérifié' : `Synchronisé (${stale.length} page(s) mise(s) à jour)`} : ${pages.length} pages, ${data.services.length} thèmes, ${data.services.reduce((n, s) => n + s.photos.length, 0)} photos. ${fileURLToPath(root)}`);

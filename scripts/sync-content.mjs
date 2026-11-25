// Actualise le HTML sans build après une modification de dist/services.json. Aucune dépendance.
// Met à jour : images fixes (hero, à propos), préchargement, coordonnées et réseaux écrits en dur
// (pour qu'ils restent justes sans JavaScript), mentions « provisoire » et copie de secours du JSON.
import { readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const root = new URL('../dist/', import.meta.url);
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
let html = await readFile(new URL('index.html', root), 'utf8');

// Images fixes.
html = html.replace(/<img\b[^>]*data-image="([^"]+)"[^>]*>/g, (tag, key) => {
  const photo = data.images[key];
  if (!photo) return tag;
  for (const name of ['src', 'alt', 'width', 'height', 'srcset']) {
    tag = tag.replace(new RegExp(`\\s${name}="[^"]*"`, 'g'), '');
    if (photo[name] !== undefined) tag = tag.replace(/>$/, ` ${name}="${escape(photo[name])}">`);
  }
  return tag;
});
const hero = data.images.hero;
html = html.replace(/<link rel="preload"[^>]*as="image"[^>]*>/, `<link rel="preload" as="image" href="${escape(hero.src)}"${hero.srcset ? ` imagesrcset="${escape(hero.srcset)}" imagesizes="(min-width: 900px) 30vw, 74vw"` : ''} fetchpriority="high">`);

// Coordonnées et réseaux écrits en dur.
const { whatsapp, email, socials } = data.contact;
const phone = /^33\d{9}$/.test(whatsapp) ? `+33 ${whatsapp[2]} ${whatsapp.slice(3).match(/\d{2}/g).join(' ')}` : `+${whatsapp}`;
html = html.replace(/https:\/\/wa\.me\/\d+/g, `https://wa.me/${whatsapp}`);
html = html.replace(/mailto:[^"?<\s]+/g, `mailto:${escape(email)}`);
html = html.replace(/tel:\+\d+/g, `tel:+${whatsapp}`);
html = html.replace(/(<a\b[^>]*\bdata-email\b[^>]*>)[^<]*(<\/a>)/g, (_, open, close) => open + escape(email) + close);
html = html.replace(/(<a\b[^>]*\bdata-tel\b[^>]*>)[^<]*(<\/a>)/g, (_, open, close) => open + phone + close);
html = html.replace(/(<div id="social-links">)[\s\S]*?(<\/div>)/, (_, open, close) => open + socials.map(social => `<a class="social-link" href="${escape(new URL(social.url).href)}" target="_blank" rel="noopener noreferrer">${escape(social.label)}</a>`).join('') + close);

// Copie de secours et mentions « provisoire ».
const snapshot = JSON.stringify(data).replace(/</g, '\\u003c');
html = html.replace(/(<script id="site-fallback" type="application\/json">)[\s\S]*?(<\/script>)/, (_, open, close) => open + snapshot + close);
const allPhotos = [...Object.values(data.images), ...data.services.flatMap(service => service.photos)];
for (const [attribute, show] of [
  ['data-site-provisional', allPhotos.some(photo => photo.provisional)],
  ['data-about-provisional', data.images.aboutMain.provisional || data.images.aboutDetail.provisional],
  ['data-portfolio-provisional', data.services.some(service => service.photos.some(photo => photo.provisional))]
]) html = html.replace(new RegExp(`<([a-z]+)([^>]*\\b${attribute}\\b[^>]*)>`, 'g'), (_, tag, attrs) => `<${tag}${attrs.replace(/\s+hidden(?:="[^"]*")?/g, '')}${show ? '' : ' hidden'}>`);
const check = process.argv.includes('--check');
if (check) assert.equal(html, await readFile(new URL('index.html', root), 'utf8'), 'HTML désynchronisé: lancer node scripts/sync-content.mjs');
else await writeFile(new URL('index.html', root), html);
console.log(`${check ? 'Vérifié' : 'Synchronisé'}: ${data.services.length} thèmes, ${data.services.reduce((n,s) => n+s.photos.length,0)} photos. ${fileURLToPath(root)}`);

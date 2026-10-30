// Refresh the buildless HTML fallback after editing services.json. No dependencies.
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
assert(Array.isArray(data.services) && data.services.length);
assert(new Set(data.services.map(service => service.id)).size === data.services.length);
for (const service of data.services) {
  assert(/^[a-z0-9-]+$/.test(service.id) && typeof service.title === 'string' && Array.isArray(service.photos));
  for (const photo of service.photos) await checkPhoto(photo);
}
for (const key of ['hero', 'aboutMain', 'aboutDetail']) await checkPhoto(data.images[key]);
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
let html = await readFile(new URL('index.html', root), 'utf8');
const photos = {...data.images};
for (const id of ['mariage', 'bapteme']) photos[`featured-${id}`] = data.services.find(service => service.id === id)?.photos[0];
html = html.replace(/<img\b[^>]*data-image="([^"]+)"[^>]*>/g, (tag, key) => {
  const photo = photos[key];
  if (!photo) return tag;
  for (const name of ['src', 'alt', 'width', 'height', 'srcset']) {
    tag = tag.replace(new RegExp(`\\s${name}="[^"]*"`, 'g'), '');
    if (photo[name] !== undefined) tag = tag.replace(/>$/, ` ${name}="${escape(photo[name])}">`);
  }
  return tag;
});
const hero = data.images.hero;
html = html.replace(/<link rel="preload"[^>]*as="image"[^>]*>/, `<link rel="preload" as="image" href="${escape(hero.src)}"${hero.srcset ? ` imagesrcset="${escape(hero.srcset)}" imagesizes="(max-width: 760px) calc(100vw - 48px), 88vw"` : ''} fetchpriority="high">`);
const snapshot = JSON.stringify(data).replace(/</g, '\\u003c');
html = html.replace(/(<script id="site-fallback" type="application\/json">)[\s\S]*?(<\/script>)/, (_, open, close) => open + snapshot + close);
const hasProvisional = [...Object.values(data.images), ...data.services.flatMap(service => service.photos)].some(photo => photo.provisional);
for (const [attribute, show] of [
  ['data-site-provisional', hasProvisional],
  ['data-about-provisional', data.images.aboutMain.provisional || data.images.aboutDetail.provisional],
  ['data-portfolio-provisional', data.services.some(service => service.photos.some(photo => photo.provisional))]
]) html = html.replace(new RegExp(`<([a-z]+)([^>]*\\b${attribute}\\b[^>]*)>`, 'g'), (_, tag, attrs) => `<${tag}${attrs.replace(/\s+hidden(?:="[^"]*")?/g, '')}${show ? '' : ' hidden'}>`);
const check = process.argv.includes('--check');
if (check) assert.equal(html, await readFile(new URL('index.html', root), 'utf8'), 'HTML désynchronisé: lancer node scripts/sync-content.mjs');
else await writeFile(new URL('index.html', root), html);
console.log(`${check ? 'Vérifié' : 'Synchronisé'}: ${data.services.length} thèmes, ${data.services.reduce((n,s) => n+s.photos.length,0)} photos. ${fileURLToPath(root)}`);

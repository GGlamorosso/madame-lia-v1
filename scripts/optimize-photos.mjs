// Outil de développement : transforme la sélection design/photo-selection.json en
// images WebP optimisées dans dist/assets/ et met à jour dist/services.json.
// Dépendances système : ffmpeg et cwebp. Lancer ensuite node scripts/sync-content.mjs.
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const sourceDir = join(root, 'photos-source', 'zip');
const assetsDir = join(root, 'dist', 'assets');
const selection = JSON.parse(await readFile(join(root, 'design', 'photo-selection.json'), 'utf8'));
const config = JSON.parse(await readFile(join(root, 'dist', 'services.json'), 'utf8'));
const WIDTHS = [480, 800, 1200];
const tmp = await mkdtemp(join(tmpdir(), 'lia-photos-'));

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });

function probe(file) {
  const out = run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]);
  const [width, height] = out.trim().split(',').map(Number);
  return { width, height };
}

// Certaines publications portent une marge blanche incrustée : on la détecte et on la retire.
function whiteBorderCrop(file) {
  const { stderr: log } = spawnSync('ffmpeg', ['-nostdin', '-hide_banner', '-loop', '1', '-i', file, '-vf', 'negate,cropdetect=limit=0.12:round=2:skip=0:reset=0', '-frames:v', '3', '-f', 'null', '-'], { encoding: 'utf8' });
  const match = [...log.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].pop();
  if (!match) return null;
  const [w, h, x, y] = match.slice(1).map(Number);
  const inset = 6;
  return `crop=${w - inset * 2}:${h - inset * 2}:${x + inset}:${y + inset}`;
}

async function build(entry, name) {
  const source = join(sourceDir, entry.source);
  await access(source);
  const crop = entry.trim ? whiteBorderCrop(source) : null;
  const master = join(tmp, `${name}.png`);
  run('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', '-i', source, ...(crop ? ['-vf', crop] : []), '-frames:v', '1', master]);
  const original = probe(master);
  const widths = WIDTHS.filter(width => width < original.width);
  const largest = Math.min(original.width, WIDTHS.at(-1));
  if (!widths.includes(largest)) widths.push(largest);
  const variants = [];
  for (const width of widths) {
    const isLargest = width === largest;
    const file = isLargest ? `${name}.webp` : `${name}-${width}.webp`;
    run('cwebp', ['-quiet', '-q', '76', '-m', '6', '-sharp_yuv', '-resize', String(width), '0', master, '-o', join(assetsDir, file)]);
    variants.push({ file, width });
  }
  const main = probe(join(assetsDir, `${name}.webp`));
  const photo = { src: `assets/${name}.webp`, alt: entry.alt, width: main.width, height: main.height, provisional: false };
  if (variants.length > 1) photo.srcset = variants.map(variant => `assets/${variant.file} ${variant.width}w`).join(', ');
  if (entry.select) photo.select = true;
  return photo;
}

const byName = {};
const counters = {};
for (const service of config.services) service.photos = [];
for (const entry of selection.photos) {
  const service = config.services.find(item => item.id === entry.theme);
  if (!service) throw new Error(`Thème inconnu dans services.json : ${entry.theme}`);
  counters[entry.theme] = (counters[entry.theme] || 0) + 1;
  const name = `${entry.theme}-${String(counters[entry.theme]).padStart(2, '0')}`;
  const photo = await build(entry, name);
  byName[name] = photo;
  service.photos.push(photo);
  process.stdout.write(`${name} ${photo.width}x${photo.height}\n`);
}
for (const [key, entry] of Object.entries(selection.images)) {
  if (entry.use) {
    if (!byName[entry.use]) throw new Error(`Référence inconnue : ${entry.use}`);
    const { select, ...photo } = byName[entry.use];
    config.images[key] = photo;
  } else {
    config.images[key] = await build(entry, entry.name);
    process.stdout.write(`${entry.name} ${config.images[key].width}x${config.images[key].height}\n`);
  }
}
await writeFile(join(root, 'dist', 'services.json'), `${JSON.stringify(config, null, 2)}\n`);
await rm(tmp, { recursive: true, force: true });
console.log(`Terminé : ${selection.photos.length} photos dans ${Object.keys(counters).length} thèmes.`);

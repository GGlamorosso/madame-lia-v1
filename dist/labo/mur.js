// Laboratoire « mur » (?labo=mur) : bascule Planche / Mur et mur infini de photographies.
// Calque modal plein écran : tuiles DOM virtualisées (seules les tuiles visibles existent, nœuds réutilisés),
// déplacées en transform3d par une physique maison (glisser + inertie, molette, flèches).
// Mouvement réduit : la bascule est masquée et le lien du hero reste une ancre normale.

const ML = window.MadameLia;
const EASE = 'cubic-bezier(.22, 1, .36, 1)';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const mod = (value, base) => ((value % base) + base) % base;
const plural = count => `${count} image${count > 1 ? 's' : ''}`;

// Générateur pseudo-aléatoire déterministe : même mur pour la même sélection.
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hash = text => [...text].reduce((sum, char) => Math.imul(sum ^ char.charCodeAt(0), 16777619), 2166136261);
function shuffle(list, rand) {
  for (let index = list.length - 1; index > 0; index--) {
    const other = Math.floor(rand() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

// Variante légère adaptée à la largeur des tuiles (DPR plafonné à 2) : -480.webp le plus souvent.
function tileSource(photo, cssWidth) {
  if (!photo.srcset) return photo.src;
  const candidates = photo.srcset.split(',').map(item => {
    const [url, width] = item.trim().split(/\s+/);
    return { url, width: parseInt(width, 10) || 0 };
  }).sort((a, b) => a.width - b.width);
  const needed = cssWidth * Math.min(devicePixelRatio || 1, 2) * 0.9;
  return (candidates.find(candidate => candidate.width >= needed) || candidates.at(-1)).url;
}

async function ready() {
  if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
  for (let attempt = 0; attempt < 40 && !window.MadameLia?.home; attempt++) await new Promise(resolve => setTimeout(resolve, 50));
  return window.MadameLia?.home || null;
}

const home = await ready();
const portfolio = document.querySelector('#portfolio');
if (home && portfolio && ML) start(home, portfolio);

function start(home, portfolio) {
  const { $, $$ } = ML;
  const lightbox = $('#lightbox');

  /* ---------- Bascule Planche / Mur ---------- */
  const head = $('.section-head', portfolio);
  const switcher = document.createElement('div');
  switcher.className = 'mur-switch';
  switcher.setAttribute('role', 'group');
  switcher.setAttribute('aria-label', 'Affichage des photographies');
  switcher.innerHTML = '<button class="mur-pill" type="button" data-view="planche" aria-pressed="true">Planche</button><button class="mur-pill" type="button" data-view="mur" aria-pressed="false" aria-haspopup="dialog">Mur</button>';
  head.append(switcher);
  const [plancheButton, murButton] = $$('.mur-pill', switcher);
  const setView = wall => {
    plancheButton.setAttribute('aria-pressed', String(!wall));
    murButton.setAttribute('aria-pressed', String(wall));
  };
  const heroLink = $('.hero-actions a[href="#portfolio"]');
  const plancheFilter = () => $('#portfolio-filters [aria-pressed="true"]')?.dataset.filter || 'all';

  murButton.addEventListener('click', () => open(murButton, plancheFilter(), true));
  heroLink?.addEventListener('click', event => {
    if (!ML.motion() || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open(heroLink, 'all', false);
  });

  /* ---------- Calque ---------- */
  const dialog = document.createElement('dialog');
  dialog.className = 'mur';
  dialog.setAttribute('aria-label', 'Mur de photographies');
  dialog.innerHTML = `
    <div class="mur-top">
      <p class="mono mur-count" role="status" aria-live="polite"></p>
      <button class="icon-button mur-close" type="button" aria-label="Fermer le mur"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
    </div>
    <div class="mur-view"><div class="mur-plane"></div></div>
    <div class="mur-chips" role="group" aria-label="Filtrer les photographies par thème"></div>`;
  document.body.append(dialog);
  const view = $('.mur-view', dialog);
  const plane = $('.mur-plane', dialog);
  const counter = $('.mur-count', dialog);
  const chips = $('.mur-chips', dialog);
  const closeButton = $('.mur-close', dialog);
  // Mur avant les autres contrôles dans l'ordre de tabulation : fermer, tuile active, filtres.
  dialog.insertBefore($('.mur-top', dialog), view);

  let phase = 'closed'; // closed | opening | open | closing
  let trigger = null;
  let syncPlanche = false;
  let allPhotos = [];
  let photos = [];
  let filter = 'all';
  let layout = null;
  let vw = innerWidth, vh = innerHeight;

  /* ---------- Mise en page : colonnes façon maçonnerie, répétées à l'infini ---------- */
  // Chaque colonne boucle verticalement sur sa propre période ; le motif de colonnes boucle horizontalement.
  function buildLayout(list) {
    vw = dialog.clientWidth || innerWidth;
    vh = dialog.clientHeight || innerHeight;
    const compact = vw < 700;
    const colW = Math.round(compact ? vw / 2.42 : clamp(vw / 6.1, 190, 300));
    const gap = Math.round(compact ? 8 : clamp(colW * 0.055, 10, 16));
    const pitch = colW + gap;
    const marginX = Math.round(pitch * 0.8);
    const marginY = Math.round(colW * 0.9);
    const cols = Math.max(4, Math.ceil((vw + 2 * marginX) / pitch) + 1);
    const heights = list.map(photo => Math.round(colW * photo.height / photo.width));
    const rand = random(hash(list.map(photo => photo.src).join('|')) ^ cols);
    const columns = Array.from({ length: cols }, (_, index) => ({ items: [], height: 0, offset: -Math.round((index % 2 ? 0.45 : 0) * colW * 1.3 + rand() * colW * 0.6) }));
    // Assez de copies pour que chaque colonne dépasse largement l'écran (filtres à peu d'images).
    const oneCopy = heights.reduce((sum, height) => sum + height + gap, 0);
    const minColumn = (vh + 2 * marginY) * 1.2;
    const copies = Math.max(1, Math.ceil(minColumn * cols / Math.max(1, oneCopy)));
    const sequence = [];
    for (let copy = 0; copy < copies; copy++) sequence.push(...shuffle(list.map((_, index) => index), rand));
    const near = (column, photoIndex, from, to) => column.items.some(item => item.photo === photoIndex && column.offset + item.y + item.height > from && column.offset + item.y < to);
    while (sequence.length) {
      let target = 0;
      for (let index = 1; index < cols; index++) if (columns[index].height < columns[target].height) target = index;
      const column = columns[target];
      const left = columns[mod(target - 1, cols)], right = columns[mod(target + 1, cols)];
      const top = column.offset + column.height;
      let pick = 0;
      for (let index = 0; index < Math.min(sequence.length, 16); index++) {
        const candidate = sequence[index];
        if (column.items.at(-1)?.photo === candidate) continue;
        if (near(left, candidate, top - colW * 1.6, top + colW * 2.6) || near(right, candidate, top - colW * 1.6, top + colW * 2.6)) continue;
        pick = index; break;
      }
      const photoIndex = sequence.splice(pick, 1)[0];
      column.items.push({ photo: photoIndex, y: column.height, height: heights[photoIndex] });
      column.height += heights[photoIndex] + gap;
    }
    columns.forEach(column => { column.period = Math.max(column.height, 1); });
    return { colW, gap, pitch, cols, columns, marginX, marginY, home: { x: colW / 2 - vw / 2, y: 0 } };
  }

  /* ---------- Tuiles : réserve de nœuds réutilisés ---------- */
  const active = new Map(); // clé « colonne:répétition:rang » → tuile
  const free = [];
  let renderId = 0;
  let rover = null;
  let enterStart = 0, enterOrigin = { x: 0, y: 0 }, enterSpan = 1;
  const ENTER_STAGGER = 520, ENTER_DURATION = 1100;

  function createTile() {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'mur-tile';
    element.tabIndex = -1;
    element.innerHTML = '<span class="mur-card"><img alt="" draggable="false" decoding="async"></span>';
    plane.append(element);
    return { element, card: element.firstChild, image: element.firstChild.firstChild, photo: -1, key: '', k: 0, r: 0, j: 0, seen: 0 };
  }
  function assign(tile, photoIndex) {
    const photo = photos[photoIndex];
    tile.photo = photoIndex;
    tile.element.setAttribute('aria-label', `Agrandir : ${photo.title}`);
    tile.element.style.width = `${layout.colW}px`;
    const url = tileSource(photo, layout.colW);
    if (tile.image.getAttribute('src') !== url) {
      tile.card.classList.add('is-loading');
      tile.image.src = url;
      const reveal = () => { if (tile.image.getAttribute('src') === url) tile.card.classList.remove('is-loading'); };
      if (tile.image.complete && tile.image.naturalWidth) reveal();
      else tile.image.decode().then(reveal, () => tile.image.addEventListener('load', reveal, { once: true }));
    }
  }
  function acquire(key, k, r, j, item) {
    // Un nœud libre qui montre déjà la même photo évite tout rechargement.
    let index = free.findIndex(tile => tile.photo === item.photo);
    if (index < 0 && free.length) index = free.length - 1;
    const tile = index >= 0 ? free.splice(index, 1)[0] : createTile();
    if (tile.photo !== item.photo || tile.image.getAttribute('src') !== tileSource(photos[item.photo], layout.colW)) assign(tile, item.photo);
    tile.element.style.width = `${layout.colW}px`;
    tile.element.style.height = `${item.height}px`;
    Object.assign(tile, { key, k, r, j });
    if (entering) {
      const center = { x: k * layout.pitch + layout.colW / 2 - camera.x, y: worldY(k, r, j) + item.height / 2 - camera.y };
      const distance = Math.hypot(center.x - enterOrigin.x, center.y - enterOrigin.y) / enterSpan;
      const delay = 90 + ENTER_STAGGER * Math.min(1, distance) ** 1.15 - (performance.now() - enterStart);
      tile.card.style.setProperty('--d', `${Math.round(Math.max(delay, -ENTER_DURATION))}ms`);
    }
    tile.element.hidden = false;
    active.set(key, tile);
    return tile;
  }
  function release(tile) {
    active.delete(tile.key);
    tile.element.hidden = true;
    tile.element.tabIndex = -1;
    if (rover === tile) rover = null;
    free.push(tile);
  }
  function releaseAll() { [...active.values()].forEach(release); }

  const columnOf = k => layout.columns[mod(k, layout.cols)];
  const worldY = (k, r, j) => { const column = columnOf(k); return column.offset + r * column.period + column.items[j].y; };
  const itemOf = tile => columnOf(tile.k).items[tile.j];

  /* ---------- Caméra, physique et effets ---------- */
  const camera = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, fx: 0, fy: 0, amount: 0, scale: 1, rx: 0, ry: 0 };
  let glide = null;      // déplacement programmé (entrée, clavier, retour de la visionneuse)
  let drag = null;       // geste en cours
  let frame = 0, last = 0;
  let entering = false;
  const TAU = 0.42;      // décroissance de l'inertie (s)
  const MAX_SPEED = 5200;
  const TILT = 0.0026, MAX_TILT = 6;

  function wake() { if (!frame && phase !== 'closed') { last = 0; frame = requestAnimationFrame(tick); } }
  function tick(now) {
    frame = 0;
    if (phase === 'closed' || lightbox?.open) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60);
    last = now;
    const previous = { x: camera.x, y: camera.y };
    if (glide) {
      const progress = clamp((now - glide.start) / glide.duration, 0, 1);
      const eased = glide.ease(progress);
      camera.tx = glide.from.x + (glide.to.x - glide.from.x) * eased;
      camera.ty = glide.from.y + (glide.to.y - glide.from.y) * eased;
      if (progress >= 1) glide = null;
    } else if (!drag) {
      camera.tx += camera.vx * dt; camera.ty += camera.vy * dt;
      const decay = Math.exp(-dt / TAU);
      camera.vx *= decay; camera.vy *= decay;
      if (Math.hypot(camera.vx, camera.vy) < 6) camera.vx = camera.vy = 0;
    }
    const follow = 1 - Math.exp(-dt * (drag ? (drag.touch ? 34 : 24) : 13));
    camera.x += (camera.tx - camera.x) * follow;
    camera.y += (camera.ty - camera.y) * follow;
    // Vitesse lissée → réduction des tuiles et inclinaison du mur, retour en douceur à l'arrêt.
    const smooth = 1 - Math.exp(-dt * 11);
    camera.fx += ((camera.x - previous.x) / dt - camera.fx) * smooth;
    camera.fy += ((camera.y - previous.y) / dt - camera.fy) * smooth;
    const speed = Math.hypot(camera.fx, camera.fy);
    const wanted = Math.max(drag?.moved ? 0.8 : drag ? 0.45 : 0, Math.min(1, speed / 1300));
    camera.amount += (wanted - camera.amount) * (1 - Math.exp(-dt * (wanted > camera.amount ? 9 : 4.2)));
    camera.scale = 1 - 0.06 * camera.amount;
    camera.rx += (clamp(camera.fy * TILT, -MAX_TILT, MAX_TILT) - camera.rx) * (1 - Math.exp(-dt * 7));
    camera.ry += (clamp(-camera.fx * TILT, -MAX_TILT, MAX_TILT) - camera.ry) * (1 - Math.exp(-dt * 7));

    const resting = !drag && !glide && !camera.vx && !camera.vy && Math.abs(camera.tx - camera.x) < 0.08 && Math.abs(camera.ty - camera.y) < 0.08 && camera.amount < 0.003 && speed < 3 && Math.abs(camera.rx) < 0.01 && Math.abs(camera.ry) < 0.01;
    if (resting) Object.assign(camera, { x: camera.tx, y: camera.ty, fx: 0, fy: 0, amount: 0, scale: 1, rx: 0, ry: 0 });
    dialog.classList.toggle('is-moving', camera.amount > 0.12);
    render();
    if (!resting || entering) frame = requestAnimationFrame(tick);
    else updateRover();
  }

  function render() {
    if (!layout) return;
    const { pitch, cols, columns, marginX, marginY, colW } = layout;
    const left = camera.x - marginX, right = camera.x + vw + marginX;
    const top = camera.y - marginY, bottom = camera.y + vh + marginY;
    const id = ++renderId;
    const scale = camera.scale > 0.9995 ? '' : ` scale(${camera.scale.toFixed(4)})`;
    for (let k = Math.floor(left / pitch); k <= Math.floor(right / pitch); k++) {
      const column = columns[mod(k, cols)];
      const x = (k * pitch - camera.x).toFixed(2);
      for (let r = Math.floor((top - column.offset) / column.period); r <= Math.floor((bottom - column.offset) / column.period); r++) {
        const base = column.offset + r * column.period;
        for (let j = 0; j < column.items.length; j++) {
          const item = column.items[j];
          const y = base + item.y;
          if (y + item.height < top || y > bottom) continue;
          const key = `${k}:${r}:${j}`;
          const tile = active.get(key) || acquire(key, k, r, j, item);
          tile.seen = id;
          tile.element.style.transform = `translate3d(${x}px, ${(y - camera.y).toFixed(2)}px, 0)${scale}`;
        }
      }
    }
    const focused = document.activeElement;
    for (const tile of active.values()) {
      if (tile.seen === id) continue;
      if (tile.element === focused) { // la tuile qui a le focus n'est jamais recyclée
        tile.element.style.transform = `translate3d(${(tile.k * pitch - camera.x).toFixed(2)}px, ${(worldY(tile.k, tile.r, tile.j) - camera.y).toFixed(2)}px, 0)${scale}`;
        continue;
      }
      release(tile);
    }
    plane.style.transform = Math.abs(camera.rx) < 0.01 && Math.abs(camera.ry) < 0.01 ? '' : `rotateX(${camera.rx.toFixed(3)}deg) rotateY(${camera.ry.toFixed(3)}deg)`;
    if (!rover || !active.has(rover.key)) updateRover();
    void colW;
  }

  // Une seule tuile atteignable au clavier : celle qui a le focus, sinon la plus proche du centre.
  function updateRover() {
    if (dialog.contains(document.activeElement) && document.activeElement.classList.contains('mur-tile')) {
      const tile = [...active.values()].find(item => item.element === document.activeElement);
      if (tile) setRover(tile);
      return;
    }
    let best = null, bestDistance = Infinity;
    for (const tile of active.values()) {
      const item = itemOf(tile);
      const dx = tile.k * layout.pitch + layout.colW / 2 - camera.x - vw / 2;
      const dy = worldY(tile.k, tile.r, tile.j) + item.height / 2 - camera.y - vh / 2;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) { bestDistance = distance; best = tile; }
    }
    if (best) setRover(best);
  }
  function setRover(tile) {
    if (rover === tile) return;
    if (rover) rover.element.tabIndex = -1;
    rover = tile;
    tile.element.tabIndex = 0;
  }

  function glideTo(x, y, duration = 700, ease = t => 1 - (1 - t) ** 3) {
    camera.vx = camera.vy = 0;
    glide = { from: { x: camera.tx, y: camera.ty }, to: { x, y }, start: performance.now(), duration, ease };
    wake();
  }
  const centerOn = (k, r, j) => {
    const item = columnOf(k).items[j];
    return { x: k * layout.pitch + layout.colW / 2 - vw / 2, y: worldY(k, r, j) + item.height / 2 - vh / 2 };
  };

  /* ---------- Gestes : glisser avec inertie, molette, clavier ---------- */
  let suppressClick = false;
  view.addEventListener('pointerdown', event => {
    if (phase !== 'open' && phase !== 'opening') return;
    if (drag || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const moving = Math.hypot(camera.fx, camera.fy) > 160 || Math.hypot(camera.vx, camera.vy) > 160;
    // Toucher un mur en mouvement l'arrête sans ouvrir de photo.
    suppressClick = moving;
    glide = null;
    camera.vx = camera.vy = 0;
    if (moving) { camera.tx = camera.x; camera.ty = camera.y; }
    drag = { id: event.pointerId, touch: event.pointerType !== 'mouse', x: event.clientX, y: event.clientY, cx: camera.tx, cy: camera.ty, moved: false, samples: [{ x: event.clientX, y: event.clientY, t: event.timeStamp }] };
    wake();
  });
  view.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > (drag.touch ? 7 : 4)) {
      drag.moved = true;
      suppressClick = true;
      dialog.classList.add('is-dragging');
      try { view.setPointerCapture(event.pointerId); } catch { /* pointeur déjà relâché */ }
    }
    if (!drag.moved) return;
    camera.tx = drag.cx - dx;
    camera.ty = drag.cy - dy;
    drag.samples.push({ x: event.clientX, y: event.clientY, t: event.timeStamp });
    while (drag.samples.length > 2 && event.timeStamp - drag.samples[0].t > 90) drag.samples.shift();
    wake();
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    if (drag.moved && event.type === 'pointerup') {
      const first = drag.samples[0], lastSample = drag.samples.at(-1);
      const elapsed = (lastSample.t - first.t) / 1000;
      const stale = event.timeStamp - lastSample.t > 70;
      if (elapsed > 0.008 && !stale) {
        camera.vx = clamp(-(lastSample.x - first.x) / elapsed, -MAX_SPEED, MAX_SPEED);
        camera.vy = clamp(-(lastSample.y - first.y) / elapsed, -MAX_SPEED, MAX_SPEED);
      }
    }
    drag = null;
    dialog.classList.remove('is-dragging');
    wake();
  }
  window.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  view.addEventListener('lostpointercapture', event => { if (drag && drag.moved) endDrag({ ...event, type: 'pointerup', pointerId: event.pointerId, timeStamp: event.timeStamp }); });
  view.addEventListener('mousedown', event => event.preventDefault()); // ni sélection, ni focus au clic souris
  view.addEventListener('dragstart', event => event.preventDefault());
  view.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { event.preventDefault(); event.stopPropagation(); suppressClick = false; }
  }, true);
  view.addEventListener('click', event => {
    const element = event.target.closest('.mur-tile');
    if (!element || phase !== 'open') return;
    const tile = [...active.values()].find(item => item.element === element);
    if (tile) openPhoto(tile);
  });
  view.addEventListener('wheel', event => {
    if (event.ctrlKey) return; // zoom du navigateur conservé
    event.preventDefault();
    if (phase !== 'open' && phase !== 'opening') return;
    const unit = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? vh : 1;
    let dx = event.deltaX * unit, dy = event.deltaY * unit;
    if (event.shiftKey && !dx) { dx = dy; dy = 0; }
    glide = null;
    camera.vx = camera.vy = 0;
    camera.tx += clamp(dx, -400, 400);
    camera.ty += clamp(dy, -400, 400);
    wake();
  }, { passive: false });

  function neighbour(tile, key) {
    const { cols, columns } = layout;
    let { k, r, j } = tile;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const count = columns[mod(k, cols)].items.length;
      j += key === 'ArrowDown' ? 1 : -1;
      if (j >= count) { j = 0; r++; } else if (j < 0) { j = count - 1; r--; }
      return { k, r, j };
    }
    const middle = worldY(k, r, j) + itemOf(tile).height / 2;
    k += key === 'ArrowRight' ? 1 : -1;
    const column = columns[mod(k, cols)];
    const around = Math.floor((middle - column.offset) / column.period);
    let best = null, bestDistance = Infinity;
    for (let rr = around - 1; rr <= around + 1; rr++) column.items.forEach((item, jj) => {
      const distance = Math.abs(column.offset + rr * column.period + item.y + item.height / 2 - middle);
      if (distance < bestDistance) { bestDistance = distance; best = { k, r: rr, j: jj }; }
    });
    return best;
  }
  function focusTile({ k, r, j }) {
    const key = `${k}:${r}:${j}`;
    const tile = active.get(key) || acquire(key, k, r, j, columnOf(k).items[j]);
    tile.element.style.transform = `translate3d(${(k * layout.pitch - camera.x).toFixed(2)}px, ${(worldY(k, r, j) - camera.y).toFixed(2)}px, 0)`;
    setRover(tile);
    tile.element.focus({ preventScroll: true });
    return tile;
  }

  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (phase !== 'open') return;
    if (event.key === 'Tab') { trapFocus(event); return; }
    if (!event.key.startsWith('Arrow') || chips.contains(event.target)) return;
    event.preventDefault();
    const current = event.target.closest?.('.mur-tile');
    const tile = current && [...active.values()].find(item => item.element === current);
    if (tile) {
      const next = neighbour(tile, event.key);
      const target = centerOn(next.k, next.r, next.j);
      glideTo(target.x, target.y, 620);
      focusTile(next);
    } else {
      const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      glideTo(camera.tx + step[0] * layout.pitch, camera.ty + step[1] * layout.colW, 620);
    }
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  closeButton.addEventListener('click', () => close());
  function trapFocus(event) {
    const items = [closeButton, rover?.element, ...$$('.mur-chip', chips)].filter(Boolean);
    const index = items.indexOf(document.activeElement);
    const next = event.shiftKey ? (index <= 0 ? items.length - 1 : index - 1) : (index < 0 || index === items.length - 1 ? 0 : index + 1);
    event.preventDefault();
    items[next].focus({ preventScroll: true });
  }

  /* ---------- Visionneuse existante, au-dessus du calque ---------- */
  let shown = -1;
  function openPhoto(tile) {
    shown = tile.photo;
    camera.vx = camera.vy = 0; glide = null;
    camera.tx = camera.x; camera.ty = camera.y;
    home.openLightbox(photos, tile.photo, tile.element);
  }
  lightbox?.addEventListener('close', () => {
    if (phase === 'closed' || shown < 0) return;
    // Retour au mur : il glisse jusqu'à la dernière photo regardée, qui reprend le focus.
    const index = parseInt($('#lightbox-counter')?.textContent || '', 10) - 1;
    const opened = shown;
    shown = -1;
    if (!Number.isInteger(index) || index === opened || index < 0 || index >= photos.length) { wake(); return; }
    const found = nearestInstance(index);
    if (!found) { wake(); return; }
    const target = centerOn(found.k, found.r, found.j);
    glideTo(target.x, target.y, 900, t => 1 - (1 - t) ** 4);
    focusTile(found);
  });
  function nearestInstance(photoIndex) {
    const { pitch, cols, columns } = layout;
    const cx = camera.x + vw / 2, cy = camera.y + vh / 2;
    let best = null, bestDistance = Infinity;
    columns.forEach((column, c) => column.items.forEach((item, j) => {
      if (item.photo !== photoIndex) return;
      const k = c + cols * Math.round((cx / pitch - c) / cols);
      const r = Math.round((cy - column.offset - item.y - item.height / 2) / column.period);
      const distance = Math.hypot(k * pitch - cx, column.offset + r * column.period + item.y - cy);
      if (distance < bestDistance) { bestDistance = distance; best = { k, r, j }; }
    }));
    return best;
  }

  /* ---------- Filtres et compteur ---------- */
  function renderChips() {
    const themes = [];
    allPhotos.forEach(photo => { if (!themes.some(theme => theme.id === photo.serviceId)) themes.push({ id: photo.serviceId, title: photo.title }); });
    chips.innerHTML = [{ id: 'all', title: 'Tout' }, ...themes].map(theme => `<button class="mur-chip" type="button" data-mur-filter="${theme.id}" aria-pressed="${theme.id === filter}">${theme.title.replace(/[&<>"]/g, char => `&#${char.charCodeAt(0)};`)}</button>`).join('');
  }
  function applyFilter(id) {
    filter = id === 'all' || allPhotos.some(photo => photo.serviceId === id) ? id : 'all';
    photos = filter === 'all' ? allPhotos : allPhotos.filter(photo => photo.serviceId === filter);
    $$('.mur-chip', chips).forEach(chip => chip.setAttribute('aria-pressed', String(chip.dataset.murFilter === filter)));
    counter.textContent = plural(photos.length);
  }
  let swapTimer = 0;
  chips.addEventListener('click', event => {
    const chip = event.target.closest('.mur-chip');
    if (!chip || phase !== 'open' || chip.dataset.murFilter === filter) return;
    const hadFocus = plane.contains(document.activeElement);
    applyFilter(chip.dataset.murFilter);
    chip.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    clearTimeout(swapTimer);
    dialog.classList.add('is-leaving');
    for (const tile of active.values()) {
      const dx = tile.k * layout.pitch - camera.x - vw / 2, dy = worldY(tile.k, tile.r, tile.j) - camera.y - vh / 2;
      tile.card.style.setProperty('--d', `${Math.round(Math.min(1, Math.hypot(dx, dy) / Math.hypot(vw, vh)) * 90)}ms`);
    }
    swapTimer = setTimeout(() => {
      dialog.classList.remove('is-leaving');
      rebuild(true, { x: vw / 2, y: vh / 2 });
      if (hadFocus) chip.focus({ preventScroll: true });
    }, 380);
  });

  function rebuild(animate, origin) {
    releaseAll();
    rover = null;
    layout = buildLayout(photos);
    view.style.setProperty('--mur-perspective', `${Math.round(Math.max(vw, vh) * 1.25)}px`);
    glide = null;
    Object.assign(camera, { vx: 0, vy: 0, fx: 0, fy: 0, amount: 0, scale: 1, rx: 0, ry: 0 });
    camera.x = camera.tx = layout.home.x;
    camera.y = camera.ty = layout.home.y;
    if (animate) {
      // Les photos éclosent depuis l'origine pendant que le mur se pose en glissant.
      entering = true;
      enterStart = performance.now();
      enterOrigin = origin;
      enterSpan = Math.max(...[[0, 0], [vw, 0], [0, vh], [vw, vh]].map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
      dialog.classList.add('is-entering');
      camera.y = camera.ty = layout.home.y - Math.round(vh * 0.22);
      render();
      glideTo(layout.home.x, layout.home.y, 1500, t => 1 - (1 - t) ** 4);
      clearTimeout(rebuild.timer);
      rebuild.timer = setTimeout(() => { entering = false; dialog.classList.remove('is-entering'); }, 90 + ENTER_STAGGER + ENTER_DURATION + 120);
    } else {
      render();
      wake();
    }
  }

  /* ---------- Ouverture et fermeture ---------- */
  const rectClip = rect => {
    const width = dialog.clientWidth || innerWidth, height = dialog.clientHeight || innerHeight;
    const box = rect && rect.width && rect.bottom > 0 && rect.top < height ? rect : { left: width / 2 - 30, right: width / 2 + 30, top: height / 2 - 22, bottom: height / 2 + 22, height: 44 };
    return `inset(${box.top.toFixed(1)}px ${(width - box.right).toFixed(1)}px ${(height - box.bottom).toFixed(1)}px ${box.left.toFixed(1)}px round ${(box.height / 2).toFixed(1)}px)`;
  };
  let clipAnimation = null;
  let coverTimer = 0;
  const html = document.documentElement;

  function open(from, initialFilter, fromSwitch) {
    if (phase !== 'closed' || !ML.motion()) return;
    allPhotos = home.photos();
    if (!allPhotos.length) return;
    phase = 'opening';
    trigger = from;
    syncPlanche = fromSwitch;
    filter = initialFilter;
    renderChips();
    applyFilter(initialFilter);
    setView(true);
    html.classList.add('mur-lock');
    dialog.showModal();
    ML.updateBar?.();
    const rect = from.getBoundingClientRect();
    const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    rebuild(true, origin);
    updateRover();
    rover?.element.focus({ preventScroll: true });
    dialog.classList.add('is-ui-entering');
    clipAnimation?.cancel();
    clipAnimation = dialog.animate([{ clipPath: rectClip(rect) }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 1000, easing: EASE });
    clipAnimation.finished.then(() => {
      if (phase !== 'opening') return;
      phase = 'open';
      dialog.classList.remove('is-ui-entering');
      // Page masquée sous le calque : plus rien à peindre ni à animer derrière.
      coverTimer = setTimeout(() => cover(true), 400);
      prewarm();
    }, () => {});
  }

  function close(immediate = false) {
    if (phase === 'closed' || (phase === 'closing' && !immediate)) return;
    if (lightbox?.open) lightbox.close();
    clearTimeout(coverTimer);
    cover(false);
    phase = 'closing';
    drag = null; glide = null;
    camera.vx = camera.vy = 0;
    dialog.classList.remove('is-dragging', 'is-ui-entering');
    const finish = () => {
      phase = 'closed';
      cancelAnimationFrame(frame); frame = 0;
      clearTimeout(rebuild.timer); clearTimeout(swapTimer);
      entering = false;
      dialog.classList.remove('is-entering', 'is-leaving', 'is-moving', 'is-closing');
      dialog.close();
      html.classList.remove('mur-lock');
      releaseAll();
      plane.style.transform = '';
      setView(false);
      ML.updateBar?.();
      trigger?.focus({ preventScroll: true });
      if (syncPlanche && filter !== plancheFilter()) $(`#portfolio-filters [data-filter="${CSS.escape(filter)}"]`)?.click();
    };
    if (immediate || !ML.motion()) { clipAnimation?.cancel(); finish(); return; }
    dialog.classList.add('is-closing');
    const rect = trigger?.getBoundingClientRect();
    clipAnimation?.cancel();
    clipAnimation = dialog.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: rectClip(rect) }], { duration: 640, easing: 'cubic-bezier(.65, 0, .25, 1)', fill: 'forwards' });
    clipAnimation.finished.then(() => { finish(); clipAnimation?.cancel(); }, () => {});
  }

  // Sous le calque opaque, la page n'est plus rendue (scènes WebGL et pellicule en pause).
  function cover(on) {
    const main = $('main');
    if (!main) return;
    if (on && phase === 'open') {
      main.style.containIntrinsicSize = `auto ${main.offsetHeight}px`;
      html.classList.add('mur-covered');
    } else {
      html.classList.remove('mur-covered');
      main.style.containIntrinsicSize = '';
    }
  }

  // Préchargement discret des vignettes : le recyclage des tuiles ne montre jamais d'aplat.
  function prewarm() {
    const idle = window.requestIdleCallback || (callback => setTimeout(callback, 200));
    const queue = photos.map(photo => tileSource(photo, layout.colW));
    const next = () => {
      if (phase !== 'open' || !queue.length) return;
      const image = new Image();
      image.decoding = 'async';
      image.src = queue.shift();
      image.decode().catch(() => {}).finally(() => idle(next));
    };
    idle(next);
  }

  let resizeTimer = 0;
  addEventListener('resize', () => {
    if (phase !== 'open') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (phase === 'open') rebuild(false); }, 160);
  });

  /* ---------- Mouvement réduit : site statique, bascule masquée ---------- */
  const applyMotion = () => {
    const enabled = ML.motion() && !ML.reducedMotion.matches;
    switcher.hidden = !enabled;
    if (!enabled && phase !== 'closed') close(true);
  };
  applyMotion();
  ML.reducedMotion.addEventListener('change', () => setTimeout(applyMotion, 0));
}

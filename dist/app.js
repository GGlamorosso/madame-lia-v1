// Accueil : pellicule d'ouverture, planche-contact, prestations, visionneuse, typo cinétique et scène WebGL.
// Dépend de site.js (chargé avant, en defer).
(() => {
  'use strict';
  const { $, $$, reducedMotion, observeReveals, forgetReveals, updateBar, motion } = window.MadameLia;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const pad = number => String(number).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const desktop = matchMedia('(min-width: 900px)');
  const contact = { whatsapp: '33767220949', email: 'liapellegrin22@gmail.com', socials: [] };
  // Copie de secours actualisée par scripts/sync-content.mjs (hors ligne ou échec du JSON).
  const fallback = JSON.parse($('#site-fallback').textContent);
  let services = [];
  let images = {};
  let activeFilter = new URLSearchParams(location.search).get('theme') || 'all';
  let expanded = false;
  let sheetPhotos = [];
  let selectionPhotos = [];

  /* ---------- Données ---------- */
  // Les données gardent « assets/… » ; on sert depuis la racine pour que les chemins restent justes partout.
  const asset = path => (path.startsWith('/') ? path : `/${path}`);
  const assetSet = srcset => srcset.split(',').map(candidate => { const [path, width] = candidate.trim().split(/\s+/); return `${asset(path)} ${width}`; }).join(', ');
  const rooted = photo => ({ ...photo, src: asset(photo.src), ...(photo.srcset ? { srcset: assetSet(photo.srcset) } : {}) });
  const small = photo => (photo.srcset ? photo.srcset.split(',')[0].trim().split(/\s+/)[0] : photo.src);
  const medium = photo => {
    const candidates = photo.srcset ? photo.srcset.split(',').map(item => item.trim().split(/\s+/)[0]) : [photo.src];
    return candidates[Math.min(1, candidates.length - 1)];
  };
  const whatsappURL = text => `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(text)}`;
  const generalMessage = 'Bonjour Lia, je vous écris depuis votre site.';
  const projectMessage = title => `Bonjour Lia, je vous écris depuis votre site au sujet d’un projet : ${title}.`;
  const decorate = service => service.photos.map((photo, index) => ({ ...photo, serviceId: service.id, title: service.title, bookable: service.bookable !== false, number: index + 1 }));
  const withPhotos = () => services.filter(service => service.photos.length);
  function mixedPhotos() {
    // « Tout » alterne les thèmes pour montrer la variété dès les premières vues.
    const groups = withPhotos().map(decorate);
    const longest = Math.max(0, ...groups.map(group => group.length));
    const mixed = [];
    for (let index = 0; index < longest; index++) groups.forEach(group => { if (group[index]) mixed.push(group[index]); });
    return mixed;
  }
  const imageTag = (photo, sizes, eager = false, key = '') => `<img${key ? ` data-image="${key}" fetchpriority="high"` : ''} src="${escape(photo.src)}"${photo.srcset ? ` srcset="${escape(photo.srcset)}" sizes="${sizes}"` : ''} alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;

  /* ---------- Pellicule d'ouverture ---------- */
  // Même balisage que le bloc généré par scripts/sync-content.mjs : la photo d'ouverture (images.hero),
  // puis les vues marquées select:true. En mouvement, une seconde série masquée permet une boucle sans fin.
  const reelSizes = '(min-width: 900px) 34vw, 78vw';
  function selectionList() {
    const mixed = mixedPhotos();
    const opening = mixed.find(photo => photo.src === images.hero.src) || { ...images.hero, title: '' };
    return [opening, ...mixed.filter(photo => photo.select && photo.src !== opening.src)];
  }
  const stripItem = (photo, index, clone = false) => `<figure class="strip-item${clone ? ' is-clone' : ''}" style="aspect-ratio:${photo.width}/${photo.height}"${clone ? ' aria-hidden="true"' : ''}><button class="dev" type="button" data-select-index="${index}"${clone ? ' tabindex="-1"' : ` aria-label="Agrandir : ${escape(photo.title || photo.alt)}"`}>${imageTag(photo, reelSizes, !clone && index < 3, !clone && index === 0 ? 'hero' : '')}</button>${photo.title ? `<figcaption class="mono">${escape(photo.title)}</figcaption>` : ''}</figure>`;
  function renderSelection() {
    selectionPhotos = selectionList();
    const strip = $('#selection-strip');
    strip.hidden = !selectionPhotos.length;
    const clones = motion() ? selectionPhotos.map((photo, index) => stripItem(photo, index, true)).join('') : '';
    strip.innerHTML = selectionPhotos.map((photo, index) => stripItem(photo, index)).join('') + clones;
    reel.reset();
  }
  // Défilement automatique et lent ; il s'arrête au survol, au toucher, au clavier, visionneuse ouverte
  // ou hors écran, et jamais en mouvement réduit. Le glisser manuel reste possible.
  const reel = (() => {
    const strip = $('#selection-strip');
    let position = 0, loop = 0, last = 0, frame = 0, holdUntil = 0, hovered = false, visible = false;
    const measure = () => {
      const clone = strip.querySelector('.is-clone');
      loop = clone && strip.firstElementChild ? clone.offsetLeft - strip.firstElementChild.offsetLeft : 0;
    };
    const hold = (ms = 2600) => { holdUntil = performance.now() + ms; };
    const paused = now => !motion() || hovered || now < holdUntil || strip.contains(document.activeElement) || $$('dialog').some(dialog => dialog.open);
    function tick(now) {
      frame = visible ? requestAnimationFrame(tick) : 0;
      const delta = Math.min(64, now - (last || now));
      last = now;
      if (!loop || paused(now)) { position = strip.scrollLeft; return; }
      position += (desktop.matches ? 40 : 28) * delta / 1000;
      if (position >= loop) position -= loop;
      strip.scrollLeft = position;
    }
    const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(type => strip.addEventListener(type, () => hold(), { passive: true }));
    strip.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovered = true; });
    strip.addEventListener('pointerleave', () => { hovered = false; hold(700); });
    strip.addEventListener('scroll', () => {
      if (loop && strip.scrollLeft >= loop) { strip.scrollLeft -= loop; position = strip.scrollLeft; }
    }, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(strip);
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; run(); }).observe(strip);
    return { reset() { measure(); position = 0; strip.scrollLeft = 0; run(); } };
  })();

  /* ---------- Planche-contact ---------- */
  function renderFilters() {
    const total = withPhotos().reduce((count, service) => count + service.photos.length, 0);
    const button = (id, label, count) => `<button class="filter${activeFilter === id ? ' active' : ''}" type="button" data-filter="${escape(id)}" aria-pressed="${activeFilter === id}">${escape(label)}<sup>${count}</sup></button>`;
    $('#portfolio-filters').innerHTML = button('all', 'Tout', total) + withPhotos().map(service => button(service.id, service.title, service.photos.length)).join('');
  }
  function renderSheet() {
    const all = activeFilter === 'all';
    sheetPhotos = all ? mixedPhotos() : decorate(services.find(service => service.id === activeFilter));
    const limit = all && !expanded ? (desktop.matches ? 20 : 12) : Infinity;
    const shown = sheetPhotos.slice(0, limit);
    const grid = $('#portfolio-grid');
    grid.setAttribute('aria-busy', 'true');
    forgetReveals(grid);
    grid.innerHTML = shown.map((photo, index) => {
      const wide = photo.width / photo.height > 1.2;
      const sizes = wide ? '(min-width: 1300px) 38vw, (min-width: 900px) 48vw, (min-width: 600px) 64vw, 100vw' : '(min-width: 1300px) 19vw, (min-width: 900px) 24vw, (min-width: 600px) 32vw, 50vw';
      return `<figure class="frame${wide ? ' is-wide' : ''}" data-reveal><button class="frame-btn dev" type="button" data-photo-index="${index}" aria-label="Agrandir la vue ${pad(photo.number)} : ${escape(photo.title)}">${imageTag(photo, sizes)}</button><figcaption class="mono"><span>${escape(photo.title)}</span><span>${pad(photo.number)}</span></figcaption></figure>`;
    }).join('');
    grid.setAttribute('aria-busy', 'false');
    const label = all ? 'Toutes les vues' : sheetPhotos[0]?.title || '';
    $('#portfolio-count').textContent = `${label} · ${sheetPhotos.length} images`;
    const more = $('#portfolio-more');
    more.hidden = shown.length >= sheetPhotos.length;
    more.firstChild.textContent = `Afficher les ${sheetPhotos.length} vues `;
    $('[data-portfolio-provisional]').hidden = !sheetPhotos.some(photo => photo.provisional);
    observeReveals(grid);
  }
  function selectFilter(filter) {
    if (filter !== 'all' && !withPhotos().some(service => service.id === filter)) return;
    activeFilter = filter;
    $$('.filter').forEach(button => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
    renderSheet();
  }
  $('#portfolio-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button || activeFilter === button.dataset.filter) return;
    selectFilter(button.dataset.filter);
    button.scrollIntoView({ behavior: motion() ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
  });
  $('#portfolio-more').addEventListener('click', () => {
    const before = $$('.frame').length;
    expanded = true; renderSheet();
    $$('.frame-btn')[before]?.focus({ preventScroll: true });
  });
  desktop.addEventListener('change', () => { if (activeFilter === 'all' && !expanded) renderSheet(); });

  /* ---------- Prestations : un toucher ouvre WhatsApp avec la prestation ---------- */
  const bookable = () => services.filter(service => service.bookable !== false);
  function renderThemes() {
    $('#theme-list').innerHTML = bookable().map((service, index) => {
      const photo = service.photos[0];
      return `<li><a class="theme-row" href="${escape(whatsappURL(projectMessage(service.title)))}" target="_blank" rel="noopener noreferrer" data-project="${escape(service.id)}" data-reveal><span class="mono theme-num">${pad(index + 1)}</span><span class="display theme-name">${escape(service.title)}</span><span class="mono theme-eyebrow">${escape(service.eyebrow || '')}</span>${photo ? `<img class="theme-thumb" src="${escape(small(photo))}" alt="" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">` : ''}${icon('arrow')}</a></li>`;
    }).join('');
    observeReveals($('#theme-list'));
  }

  /* ---------- Visionneuse : modale native, flèches, clavier, balayage tactile ---------- */
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightbox-image');
  const syncDialogState = () => { document.body.classList.toggle('dialog-open', lightbox.open); updateBar(); };
  lightbox.addEventListener('close', syncDialogState);
  let photoList = [];
  let photoIndex = 0;
  let photoTrigger = null;
  let photoRevision = 0;
  function showPhoto(index) {
    if (!photoList.length) return;
    photoIndex = (index + photoList.length) % photoList.length;
    const photo = photoList[photoIndex];
    const revision = ++photoRevision;
    $('[data-photo-provisional]').hidden = !photo.provisional;
    lightboxImage.alt = photo.alt;
    lightboxImage.width = photo.width; lightboxImage.height = photo.height;
    lightboxImage.sizes = '100vw';
    if (photo.srcset) lightboxImage.srcset = photo.srcset; else lightboxImage.removeAttribute('srcset');
    lightboxImage.src = photo.src;
    lightboxImage.style.transform = '';
    $('#lightbox-caption').textContent = `${photo.title} / ${pad(photo.number)}`;
    $('#lightbox-counter').textContent = `${pad(photoIndex + 1)} / ${pad(photoList.length)}`;
    const cta = $('#lightbox-cta');
    cta.href = whatsappURL(photo.bookable ? projectMessage(photo.title) : generalMessage);
    cta.dataset.project = photo.bookable ? photo.serviceId : '';
    const animatePhoto = () => {
      if (revision !== photoRevision || !motion() || !lightbox.open) return;
      lightboxImage.getAnimations().forEach(animation => animation.cancel());
      lightboxImage.animate([{opacity:0, transform:'scale(.97)'}, {opacity:1, transform:'scale(1)'}], {duration:520, easing:'cubic-bezier(.22,1,.36,1)'});
    };
    lightboxImage.onload = animatePhoto;
    if (lightboxImage.complete && lightboxImage.naturalWidth) animatePhoto();
    const next = photoList[(photoIndex + 1) % photoList.length];
    if (next) { const preload = new Image(); preload.src = medium(next); }
  }
  function openLightbox(list, index, trigger) {
    photoList = list; photoTrigger = trigger;
    lightbox.showModal(); syncDialogState();
    showPhoto(index);
    $('[data-close-lightbox]').focus();
  }
  $('#portfolio-grid').addEventListener('click', event => {
    const trigger = event.target.closest('[data-photo-index]');
    if (trigger) openLightbox(sheetPhotos, Number(trigger.dataset.photoIndex), trigger);
  });
  $('#selection-strip').addEventListener('click', event => {
    const trigger = event.target.closest('[data-select-index]');
    if (trigger) openLightbox(selectionPhotos, Number(trigger.dataset.selectIndex), trigger);
  });
  $('[data-lightbox-prev]').addEventListener('click', () => showPhoto(photoIndex - 1));
  $('[data-lightbox-next]').addEventListener('click', () => showPhoto(photoIndex + 1));
  $('[data-close-lightbox]').addEventListener('click', () => lightbox.close());
  const stage = $('.lightbox-stage');
  stage.addEventListener('click', event => { if (event.target === event.currentTarget) lightbox.close(); });
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); showPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  lightbox.addEventListener('close', () => {
    photoRevision++;
    lightboxImage.getAnimations().forEach(animation => animation.cancel());
    photoTrigger?.focus({preventScroll:true});
  });
  let touch = null;
  stage.addEventListener('touchstart', event => {
    touch = event.touches.length === 1 ? { x: event.touches[0].clientX, y: event.touches[0].clientY, dx: 0, dy: 0 } : null;
  }, { passive: true });
  stage.addEventListener('touchmove', event => {
    if (!touch || event.touches.length !== 1) { touch = null; return; }
    touch.dx = event.touches[0].clientX - touch.x; touch.dy = event.touches[0].clientY - touch.y;
    const horizontal = Math.abs(touch.dx) > Math.abs(touch.dy);
    lightboxImage.style.transform = horizontal ? `translateX(${touch.dx}px)` : `translateY(${Math.max(0, touch.dy)}px) scale(${1 - Math.min(.2, Math.max(0, touch.dy) / 1200)})`;
  }, { passive: true });
  stage.addEventListener('touchend', () => {
    if (!touch) return;
    const { dx, dy } = touch; touch = null;
    lightboxImage.style.transform = '';
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) showPhoto(photoIndex + (dx < 0 ? 1 : -1));
    else if (dy > 90 && dy > Math.abs(dx)) lightbox.close();
  });
  stage.addEventListener('touchcancel', () => {
    touch = null;
    lightboxImage.style.transform = '';
  });

  /* ---------- Typo cinétique ---------- */
  const band = $('.band');
  let lastScroll = scrollY, velocity = 0, width = 62, bandFrame = 0;
  function animateBand() {
    velocity *= .9;
    width += (62 + Math.min(52, velocity * 1.4) - width) * .14;
    band.style.setProperty('--wdth', width.toFixed(1));
    bandFrame = velocity > .2 || width > 62.4 ? requestAnimationFrame(animateBand) : 0;
  }
  addEventListener('scroll', () => {
    const delta = Math.abs(scrollY - lastScroll); lastScroll = scrollY;
    if (!motion()) return;
    velocity = Math.max(velocity, delta);
    const box = band.getBoundingClientRect();
    if (!bandFrame && box.bottom > 0 && box.top < innerHeight) bandFrame = requestAnimationFrame(animateBand);
  }, { passive: true });

  /* ---------- Contenus ---------- */
  function setImage(element, photo) {
    if (!element || !photo) return;
    if (element.getAttribute('src') !== photo.src) element.src = photo.src;
    element.alt = photo.alt;
    element.width = photo.width;
    element.height = photo.height;
    if (photo.srcset) { if (element.getAttribute('srcset') !== photo.srcset) element.srcset = photo.srcset; }
    else element.removeAttribute('srcset');
  }
  const formatPhone = number => (/^33\d{9}$/.test(number) ? `+33 ${number[2]} ${number.slice(3).match(/\d{2}/g).join(' ')}` : `+${number}`);
  function applyContent(data) {
    services = data.services.map(service => ({ ...service, photos: service.photos.map(rooted) }));
    images = Object.fromEntries(Object.entries(data.images).map(([key, photo]) => [key, rooted(photo)]));
    if (activeFilter !== 'all' && !withPhotos().some(service => service.id === activeFilter)) activeFilter = 'all';
    $('[data-about-provisional]').hidden = ![images.aboutMain, images.aboutDetail].some(photo => photo.provisional);
    const provisional = [...Object.values(images), ...services.flatMap(service => service.photos)].some(photo => photo.provisional);
    $$('[data-site-provisional]').forEach(element => { element.hidden = !provisional; });
    Object.assign(contact, data.contact);
    renderThemes(); renderSelection(); renderFilters(); renderSheet();
    Object.entries(images).forEach(([key, photo]) => setImage($(`[data-image="${key}"]`), photo));
    // Coordonnées : le numéro change, le message prérempli éventuel est conservé.
    $$('a[href^="https://wa.me/"]').forEach(link => { link.href = link.href.replace(/^https:\/\/wa\.me\/\d+/, `https://wa.me/${contact.whatsapp}`); });
    $$('a[href^="mailto:"]').forEach(link => { link.href = `mailto:${contact.email}`; });
    $$('[data-email]').forEach(link => { link.textContent = contact.email; });
    $$('[data-tel]').forEach(link => { link.href = `tel:+${contact.whatsapp}`; link.textContent = formatPhone(contact.whatsapp); });
    $$('[data-social]').forEach(link => {
      const social = contact.socials.find(item => item.label.toLowerCase() === link.dataset.social.toLowerCase());
      let url = null;
      try { url = social && new URL(social.url).protocol === 'https:' ? new URL(social.url).href : null; } catch { /* lien incomplet : masqué */ }
      link.hidden = !url;
      if (url) link.href = url;
    });
  }
  const validPath = value => typeof value === 'string' && /^assets\/[a-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(value);
  function validPhoto(photo) {
    return photo && validPath(photo.src) && typeof photo.alt === 'string' && typeof photo.provisional === 'boolean' &&
      Number.isInteger(photo.width) && photo.width > 0 && Number.isInteger(photo.height) && photo.height > 0 &&
      (photo.srcset === undefined || (typeof photo.srcset === 'string' && photo.srcset.split(',').every(candidate => {
        const parts = candidate.trim().split(/\s+/);
        return parts.length === 2 && validPath(parts[0]) && /^[1-9]\d*w$/.test(parts[1]);
      })));
  }
  function validContent(data) {
    return data && data.images && ['hero', 'aboutMain', 'aboutDetail'].every(key => validPhoto(data.images[key])) &&
      Array.isArray(data.services) && data.services.length > 0 &&
      new Set(data.services.map(service => service.id)).size === data.services.length &&
      data.services.every(service => typeof service.id === 'string' && /^[a-z0-9-]+$/.test(service.id) &&
        typeof service.title === 'string' && Array.isArray(service.photos) && service.photos.every(validPhoto)) &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contact?.email || '') && /^\d+$/.test(data.contact?.whatsapp || '') &&
      Array.isArray(data.contact?.socials);
  }
  applyContent(fallback);
  const contentReady = fetch('/services.json').then(response => {
    if (!response.ok) throw new Error('Impossible de charger les galeries');
    return response.json();
  }).then(data => {
    if (!validContent(data)) throw new Error('Configuration incomplète');
    if (JSON.stringify(data) !== JSON.stringify(fallback)) applyContent(data);
  }).catch(() => { /* On garde la dernière copie synchronisée ; aucun nom de fichier n'est deviné. */ });

  /* ---------- Scène WebGL : chargée après le premier affichage, jamais indispensable ---------- */
  function startGL() {
    if (!motion() || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory < 4)) return;
    const selects = mixedPhotos().filter(photo => photo.select && photo.src !== images.hero.src);
    const colourful = selects.find(photo => photo.serviceId === 'evenement') || selects[0] || images.hero;
    import('/gl.js').then(module => module.start({
      closing: { canvas: $('#closing-canvas'), section: $('.closing'), src: medium(colourful) },
      reducedMotion
    })).catch(() => { /* Sans WebGL, les images fixes restent en place. */ });
  }
  const whenIdle = window.requestIdleCallback || (callback => setTimeout(callback, 300));
  const boot = () => contentReady.then(() => whenIdle(startGL));
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot, { once: true });
})();

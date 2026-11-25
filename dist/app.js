(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const pad = number => String(number).padStart(2, '0');
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 900px)');
  const contact = { whatsapp: '33767220949', email: 'liapellegrin22@gmail.com', socials: [] };
  // Copie de secours actualisée par scripts/sync-content.mjs (hors ligne ou échec du JSON).
  const fallback = JSON.parse($('#site-fallback').textContent);
  let services = [];
  let images = {};
  let activeFilter = 'all';
  let expanded = false;
  let sheetPhotos = [];
  let selectionPhotos = [];
  let revealObserver;
  let motionEnabled = false;
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Mouvement : amélioration progressive ---------- */
  function observeReveals(root = document) {
    $$('[data-reveal]', root).forEach((element, index) => {
      if (!motionEnabled) { element.classList.add('is-visible'); return; }
      element.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
      revealObserver.observe(element);
    });
  }
  function setMotionPreference() {
    motionEnabled = !reducedMotion.matches && 'IntersectionObserver' in window;
    revealObserver?.disconnect();
    if (motionEnabled) {
      revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }), { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      document.documentElement.classList.add('motion-ready');
    } else {
      document.documentElement.classList.remove('motion-ready');
      document.getAnimations().forEach(animation => animation.cancel());
    }
    observeReveals();
  }
  setMotionPreference();
  reducedMotion.addEventListener('change', setMotionPreference);

  /* ---------- Données ---------- */
  const small = photo => (photo.srcset ? photo.srcset.split(',')[0].trim().split(/\s+/)[0] : photo.src);
  const medium = photo => {
    const candidates = photo.srcset ? photo.srcset.split(',').map(item => item.trim().split(/\s+/)[0]) : [photo.src];
    return candidates[Math.min(1, candidates.length - 1)];
  };
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
  const imageTag = (photo, sizes, eager = false) => `<img src="${escape(photo.src)}" srcset="${escape(photo.srcset || photo.src)}" sizes="${sizes}" alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
  const grease = '<svg class="grease" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M52 5C24 2 4 22 5 50c1 28 21 47 48 45 26-2 43-23 42-48C94 21 76 6 44 9"/></svg>';

  /* ---------- Sélection ---------- */
  function renderSelection() {
    selectionPhotos = mixedPhotos().filter(photo => photo.select);
    const strip = $('#selection-strip');
    $('#selection').hidden = !selectionPhotos.length;
    strip.innerHTML = selectionPhotos.map((photo, index) => `<figure class="strip-item" style="aspect-ratio:${photo.width}/${photo.height}" data-reveal><button class="dev" type="button" data-select-index="${index}" aria-label="Agrandir : ${escape(photo.title)}">${imageTag(photo, '(min-width: 900px) 40vw, 80vw', index < 2)}${grease}</button><figcaption class="mono">${escape(photo.title)}</figcaption></figure>`).join('');
    observeReveals(strip);
  }

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
    $$('[data-reveal]', grid).forEach(element => revealObserver?.unobserve(element));
    grid.innerHTML = shown.map((photo, index) => {
      const wide = photo.width / photo.height > 1.2;
      const sizes = wide ? '(min-width: 1300px) 38vw, (min-width: 900px) 48vw, (min-width: 600px) 64vw, 100vw' : '(min-width: 1300px) 19vw, (min-width: 900px) 24vw, (min-width: 600px) 32vw, 50vw';
      return `<figure class="frame${wide ? ' is-wide' : ''}" data-reveal><button class="frame-btn dev" type="button" data-photo-index="${index}" aria-label="Agrandir la vue ${pad(photo.number)} : ${escape(photo.title)}">${imageTag(photo, sizes)}${photo.select ? grease : ''}</button><figcaption class="mono"><span>${escape(photo.title)}</span><span>${pad(photo.number)}</span></figcaption></figure>`;
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
    button.scrollIntoView({ behavior: motionEnabled ? 'smooth' : 'auto', block: 'nearest', inline: 'center' });
  });
  $('#portfolio-more').addEventListener('click', () => {
    const before = $$('.frame').length;
    expanded = true; renderSheet();
    $$('.frame-btn')[before]?.focus({ preventScroll: true });
  });
  desktop.addEventListener('change', () => { if (activeFilter === 'all' && !expanded) renderSheet(); });

  /* ---------- Prestations et choix du projet ---------- */
  const bookable = () => services.filter(service => service.bookable !== false);
  function renderThemes() {
    $('#theme-list').innerHTML = bookable().map((service, index) => {
      const photo = service.photos[0];
      return `<li><a class="theme-row" href="https://wa.me/${contact.whatsapp}" target="_blank" rel="noopener noreferrer" data-open-contact data-project="${escape(service.id)}" data-reveal><span class="mono theme-num">${pad(index + 1)}</span><span class="display theme-name">${escape(service.title)}</span><span class="mono theme-eyebrow">${escape(service.eyebrow || '')}</span>${photo ? `<img class="theme-thumb" src="${escape(small(photo))}" alt="" width="${photo.width}" height="${photo.height}" loading="lazy" decoding="async">` : ''}${icon('arrow')}</a></li>`;
    }).join('');
    observeReveals($('#theme-list'));
  }
  function renderProjectThemes() {
    const current = $('input[name="service"]:checked')?.value;
    const options = [...bookable().map(service => [service.id, service.title]), ['autre', 'Autre idée']];
    $('#project-themes').innerHTML = options.map(([id, title]) => `<label class="chip"><input type="radio" name="service" value="${escape(id)}" data-title="${escape(title)}"${id === current ? ' checked' : ''}><span>${escape(title)}</span></label>`).join('');
  }

  /* ---------- Dialogs ---------- */
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightbox-image');
  const contactDialog = $('#contact-dialog');
  const legalDialog = $('#legal-dialog');
  const dialogs = [lightbox, contactDialog, legalDialog];
  const syncDialogState = () => { document.body.classList.toggle('dialog-open', dialogs.some(dialog => dialog.open)); updateBar(); };
  dialogs.forEach(dialog => dialog.addEventListener('close', syncDialogState));
  function closeOnBackdrop(dialog) {
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
    });
  }

  // Visionneuse : modale native (focus piégé, page inerte), flèches, balayage tactile.
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
    cta.dataset.project = photo.bookable ? photo.serviceId : '';
    const animatePhoto = () => {
      if (revision !== photoRevision || !motionEnabled || !lightbox.open) return;
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

  // Feuille de contact : tous les liens [data-open-contact] restent de vrais liens WhatsApp sans JavaScript.
  let contactTrigger = null;
  function openContact(project, trigger) {
    const galleryTrigger = lightbox.open ? photoTrigger : null;
    if (lightbox.open) { photoTrigger = null; lightbox.close(); }
    contactTrigger = trigger?.isConnected && !trigger.closest('dialog') ? trigger : galleryTrigger;
    if (project) {
      const radio = $(`input[name="service"][value="${CSS.escape(project)}"]`);
      if (radio) radio.checked = true;
    }
    $('#service-error').hidden = true;
    $('#form-status').replaceChildren();
    contactDialog.showModal(); contactDialog.scrollTop = 0; syncDialogState();
    ($('input[name="service"]:checked') ? $('#project-name') : $('input[name="service"]'))?.focus({ preventScroll: true });
  }
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-open-contact]');
    if (!trigger || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    openContact(trigger.dataset.project, trigger);
  });
  $('[data-close-contact]').addEventListener('click', () => contactDialog.close());
  contactDialog.addEventListener('close', () => contactTrigger?.focus({preventScroll:true}));
  closeOnBackdrop(contactDialog);
  $('#project-themes').addEventListener('change', () => { $('#service-error').hidden = true; });

  let legalTrigger;
  $('[data-open-legal]').addEventListener('click', event => { legalTrigger = event.currentTarget; legalDialog.showModal(); syncDialogState(); });
  $('[data-close-legal]').addEventListener('click', () => legalDialog.close());
  legalDialog.addEventListener('close', () => legalTrigger?.focus({preventScroll:true}));
  closeOnBackdrop(legalDialog);

  /* ---------- Envoi : message prérempli, confirmation dans l'application ---------- */
  const form = $('#project-form');
  form.addEventListener('submit', event => {
    event.preventDefault();
    const selected = $('input[name="service"]:checked', form);
    if (!selected) {
      $('#service-error').hidden = false;
      $('input[name="service"]', form)?.focus();
      return;
    }
    const nameInput = form.elements.namedItem('name');
    nameInput.setCustomValidity(nameInput.value.trim() ? '' : 'Merci d’indiquer votre prénom.');
    if (!nameInput.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    const project = selected.dataset.title;
    const parsedDate = value('date') ? new Date(`${value('date')}T12:00:00`) : null;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? new Intl.DateTimeFormat('fr-FR', {dateStyle:'long'}).format(parsedDate) : 'À définir ensemble';
    const message = [
      'Bonjour Lia,', '', `Je m’appelle ${value('name')} et j’aimerais vous parler de mon projet.`, '',
      `Projet : ${project}`, `Date : ${date}`, `Lieu : ${value('location') || 'À définir ensemble'}`,
      ...(value('message') ? ['', value('message')] : []), '', 'Au plaisir d’échanger,', value('name')
    ].join('\n');
    const channel = event.submitter?.value || 'whatsapp';
    const url = channel === 'email'
      ? `mailto:${contact.email}?subject=${encodeURIComponent(`Projet photo — ${project}`)}&body=${encodeURIComponent(message)}`
      : `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;
    const link = document.createElement('a');
    link.href = url; link.textContent = channel === 'email' ? 'Ouvrir mon application e-mail' : 'Ouvrir WhatsApp';
    if (channel === 'whatsapp') { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    $('#form-status').replaceChildren(document.createTextNode('Votre message est prêt. Si l’application ne s’ouvre pas : '), link);
    window.open(url, channel === 'email' ? '_self' : '_blank', 'noopener,noreferrer');
  });
  form.elements.namedItem('name').addEventListener('input', event => event.target.setCustomValidity(''));

  /* ---------- Barre de contact fixe ---------- */
  const bar = $('#cta-bar');
  const barState = { hero: true, closing: false };
  function updateBar() {
    const visible = !barState.hero && !barState.closing && !dialogs.some(dialog => dialog.open);
    bar.classList.toggle('is-visible', visible);
    bar.inert = !visible;
    bar.setAttribute('aria-hidden', String(!visible));
  }
  if ('IntersectionObserver' in window) {
    bar.hidden = false;
    const barObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => { barState[entry.target.dataset.barZone] = entry.isIntersecting; });
      updateBar();
    });
    [['.hero-actions', 'hero'], ['.closing', 'closing']].forEach(([selector, zone]) => {
      const element = $(selector); element.dataset.barZone = zone; barObserver.observe(element);
    });
  }

  /* ---------- Typo cinétique et boutons magnétiques ---------- */
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
    if (!motionEnabled) return;
    velocity = Math.max(velocity, delta);
    const box = band.getBoundingClientRect();
    if (!bandFrame && box.bottom > 0 && box.top < innerHeight) bandFrame = requestAnimationFrame(animateBand);
  }, { passive: true });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('[data-magnetic]').forEach(button => {
      button.addEventListener('pointermove', event => {
        if (!motionEnabled) return;
        const box = button.getBoundingClientRect();
        button.style.transform = `translate(${(event.clientX - box.left - box.width / 2) * .22}px, ${(event.clientY - box.top - box.height / 2) * .3}px)`;
      });
      button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    });
  }

  /* ---------- Contenus ---------- */
  // Les réseaux ne s'affichent que si une URL https exacte est fournie.
  function renderSocialLinks() {
    const container = $('#social-links');
    container.replaceChildren();
    for (const social of contact.socials) {
      try {
        const url = new URL(social.url);
        if (url.protocol !== 'https:') continue;
        const link = document.createElement('a');
        link.href = url.href; link.textContent = social.label; link.className = 'social-link';
        link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link);
      } catch { /* Lien facultatif incomplet : non affiché. */ }
    }
  }
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
    services = data.services;
    images = data.images;
    Object.entries(images).forEach(([key, photo]) => setImage($(`[data-image="${key}"]`), photo));
    if (activeFilter !== 'all' && !withPhotos().some(service => service.id === activeFilter)) activeFilter = 'all';
    $('[data-about-provisional]').hidden = ![images.aboutMain, images.aboutDetail].some(photo => photo.provisional);
    const provisional = [...Object.values(images), ...services.flatMap(service => service.photos)].some(photo => photo.provisional);
    $$('[data-site-provisional]').forEach(element => { element.hidden = !provisional; });
    Object.assign(contact, data.contact);
    renderThemes(); renderProjectThemes(); renderSelection(); renderFilters(); renderSheet(); renderSocialLinks();
    $$('a[href^="https://wa.me/"]').forEach(link => { link.href = `https://wa.me/${contact.whatsapp}`; });
    $$('[data-email]').forEach(link => { link.href = `mailto:${contact.email}`; link.textContent = contact.email; });
    $$('[data-tel]').forEach(link => { link.href = `tel:+${contact.whatsapp}`; link.textContent = formatPhone(contact.whatsapp); });
    form.action = `mailto:${contact.email}`;
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
  const contentReady = fetch('services.json').then(response => {
    if (!response.ok) throw new Error('Impossible de charger les galeries');
    return response.json();
  }).then(data => {
    if (!validContent(data)) throw new Error('Configuration incomplète');
    if (JSON.stringify(data) !== JSON.stringify(fallback)) applyContent(data);
  }).catch(() => { /* On garde la dernière copie synchronisée ; aucun nom de fichier n'est deviné. */ });

  /* ---------- Scène WebGL : chargée après le premier affichage, jamais indispensable ---------- */
  function startGL() {
    if (!motionEnabled || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory < 4)) return;
    const selects = mixedPhotos().filter(photo => photo.select && photo.src !== images.hero.src);
    const colourful = selects.find(photo => photo.serviceId === 'evenement') || selects[0] || images.hero;
    import('./gl.js').then(module => module.start({
      hero: { canvas: $('#hero-canvas'), section: $('.hero'), frame: $('.hero-frame'), image: $('.hero-image'), sides: selects.slice(0, 4).map(small) },
      closing: { canvas: $('#closing-canvas'), section: $('.closing'), src: medium(colourful) },
      reducedMotion
    })).catch(() => { /* Sans WebGL, les images fixes restent en place. */ });
  }
  const whenIdle = window.requestIdleCallback || (callback => setTimeout(callback, 300));
  const boot = () => contentReady.then(() => whenIdle(startGL));
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot, { once: true });
})();

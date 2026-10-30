(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const contact = { whatsapp: '33767220949', email: 'liapellegrin22@gmail.com', socials: [] };
  const serviceSelect = $('#project-service');
  // Embedded snapshot is refreshed by scripts/sync-content.mjs for offline/JSON failure.
  const fallback = JSON.parse($('#site-fallback').textContent);
  let services = fallback.services;
  let images = fallback.images;
  let activeFilter = 'all';
  let visiblePhotos = [];
  let photoIndex = 0;
  let photoTrigger = null;
  let revealObserver;
  let motionEnabled = false;
  $('#year').textContent = new Date().getFullYear();

  // Progressive enhancement: content stays visible if animations are unavailable.
  function splitHeading() {
    const heading = $('.split-title');
    const clone = heading.cloneNode(true);
    $$('br', clone).forEach(br => br.replaceWith(document.createTextNode(' ')));
    heading.setAttribute('aria-label', clone.textContent.replace(/\s+/g, ' ').trim());
    let index = 0;
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(word => {
        if (!word || /^\s+$/.test(word)) { fragment.append(document.createTextNode(word)); return; }
        const mask = document.createElement('span');
        mask.className = 'word-mask'; mask.setAttribute('aria-hidden', 'true');
        const inner = document.createElement('span');
        inner.className = 'word-inner'; inner.style.setProperty('--word-index', index++); inner.textContent = word;
        mask.append(inner); fragment.append(mask);
      });
      node.replaceWith(fragment);
    });
  }
  splitHeading();
  function observeReveals(root = document) {
    $$('[data-reveal]', root).forEach((element, index) => {
      if (!motionEnabled) { element.classList.add('is-visible'); return; }
      element.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 65}ms`);
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
      }), { threshold: 0.07, rootMargin: '0px 0px -18px 0px' });
      document.documentElement.classList.add('motion-ready');
    } else {
      document.documentElement.classList.remove('motion-ready');
      document.getAnimations().forEach(animation => animation.cancel());
    }
    observeReveals();
  }
  setMotionPreference();
  reducedMotion.addEventListener('change', setMotionPreference);

  const menuButton = $('.menu-toggle');
  const mobileNav = $('#mobile-nav');
  function closeMenu(restoreFocus = false) {
    const wasOpen = menuButton.getAttribute('aria-expanded') === 'true';
    mobileNav.hidden = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Ouvrir le menu');
    if (wasOpen && restoreFocus) menuButton.focus();
  }
  menuButton.addEventListener('click', () => {
    const opening = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(opening));
    menuButton.setAttribute('aria-label', opening ? 'Fermer le menu' : 'Ouvrir le menu');
    mobileNav.hidden = !opening;
    if (opening && motionEnabled) {
      mobileNav.animate([{opacity:0, transform:'translateY(-12px)'}, {opacity:1, transform:'translateY(0)'}], {duration:450, easing:'cubic-bezier(.22,1,.36,1)'});
      $$('a', mobileNav).forEach((link, index) => link.animate([{opacity:0, transform:'translateY(12px)'}, {opacity:1, transform:'translateY(0)'}], {duration:500, delay:index * 60, fill:'backwards', easing:'cubic-bezier(.22,1,.36,1)'}));
    }
  });
  $$('a', mobileNav).forEach(link => link.addEventListener('click', () => closeMenu()));
  document.addEventListener('click', event => { if (!mobileNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(true); });
  document.addEventListener('focusin', event => { if (!mobileNav.hidden && !mobileNav.contains(event.target) && !menuButton.contains(event.target)) closeMenu(); });
  matchMedia('(min-width:761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  function renderProjectThemes() {
    $('#project-themes').innerHTML = services.map(service => `<button class="project-theme" type="button" data-project="${escape(service.id)}" aria-pressed="false">${escape(service.title)}</button>`).join('');
    syncProjectThemes();
  }
  function syncProjectThemes() {
    $$('.project-theme').forEach(button => {
      const selected = button.dataset.project === serviceSelect.value;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }
  serviceSelect.addEventListener('change', syncProjectThemes);
  $('#project-themes').addEventListener('click', event => {
    const button = event.target.closest('[data-project]');
    if (!button) return;
    serviceSelect.value = button.dataset.project;
    syncProjectThemes();
  });

  function renderPortfolio() {
    const selected = services.filter(service => activeFilter === 'all' || service.id === activeFilter);
    visiblePhotos = selected.flatMap(service => service.photos.map((photo, index) => ({...photo, serviceId: service.id, title: service.title, number:index + 1})));
    const grid = $('#portfolio-grid');
    grid.setAttribute('aria-busy', 'true');
    $$('[data-reveal]', grid).forEach(element => revealObserver?.unobserve(element));
    grid.innerHTML = visiblePhotos.map((photo, index) => `<figure class="photo-card" data-reveal><button class="photo-button" type="button" data-photo-index="${index}" aria-label="Ouvrir la photo ${photo.number} : ${escape(photo.title)}"><img src="${escape(photo.src)}" srcset="${escape(photo.srcset || photo.src)}" sizes="(max-width:480px) calc(100vw - 48px), (max-width:760px) calc((100vw - 64px)/2), 29vw" alt="${escape(photo.alt)}" width="${photo.width}" height="${photo.height}" style="--photo-ratio:${photo.width}/${photo.height}" loading="lazy" decoding="async"><span class="image-circle" aria-hidden="true">↗</span></button><figcaption><span>${escape(photo.title)}</span><span>${String(photo.number).padStart(2,'0')}</span></figcaption></figure>`).join('');
    grid.setAttribute('aria-busy', 'false');
    const label = activeFilter === 'all' ? 'Tous les instants' : selected[0]?.title || '';
    $('#portfolio-count').textContent = `${label} · ${visiblePhotos.length} images`;
    $('[data-portfolio-provisional]').hidden = !visiblePhotos.some(photo => photo.provisional);
    observeReveals(grid);
  }
  function selectFilter(filter) {
    if (filter !== 'all' && !services.some(service => service.id === filter)) return;
    activeFilter = filter;
    $$('.filter').forEach(button => {
      const selected = button.dataset.filter === filter;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
    renderPortfolio();
  }
  $('#portfolio-filters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (button && activeFilter !== button.dataset.filter) selectFilter(button.dataset.filter);
  });
  $$('[data-portfolio-theme]').forEach(link => link.addEventListener('click', () => selectFilter(link.dataset.portfolioTheme)));
  renderProjectThemes();
  renderPortfolio();

  // A native modal preserves keyboard focus and keeps the underlying page inert.
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightbox-image');
  let photoRevision = 0;
  function showPhoto(index) {
    if (!visiblePhotos.length) return;
    photoIndex = (index + visiblePhotos.length) % visiblePhotos.length;
    const photo = visiblePhotos[photoIndex];
    const revision = ++photoRevision;
    $('[data-photo-provisional]').hidden = !photo.provisional;
    lightboxImage.alt = photo.alt;
    lightboxImage.src = photo.src;
    $('#lightbox-caption').textContent = `${photo.title} / ${String(photo.number).padStart(2,'0')}`;
    $('#lightbox-counter').textContent = `${String(photoIndex + 1).padStart(2,'0')} / ${String(visiblePhotos.length).padStart(2,'0')}`;
    const animatePhoto = () => {
      if (revision !== photoRevision || !motionEnabled || !lightbox.open) return;
      lightboxImage.getAnimations().forEach(animation => animation.cancel());
      lightboxImage.animate([{opacity:0, transform:'scale(.98)'}, {opacity:1, transform:'scale(1)'}], {duration:650, easing:'cubic-bezier(.22,1,.36,1)'});
    };
    lightboxImage.onload = animatePhoto;
    if (lightboxImage.complete && lightboxImage.naturalWidth) animatePhoto();
    const next = visiblePhotos[(photoIndex + 1) % visiblePhotos.length];
    if (next) { const preload = new Image(); preload.src = next.src; }
  }
  $('#portfolio-grid').addEventListener('click', event => {
    const trigger = event.target.closest('[data-photo-index]');
    if (!trigger) return;
    photoTrigger = trigger;
    closeMenu();
    lightbox.showModal(); document.body.classList.add('dialog-open');
    showPhoto(Number(trigger.dataset.photoIndex));
    $('[data-close-lightbox]').focus();
  });
  $('[data-lightbox-prev]').addEventListener('click', () => showPhoto(photoIndex - 1));
  $('[data-lightbox-next]').addEventListener('click', () => showPhoto(photoIndex + 1));
  $('[data-close-lightbox]').addEventListener('click', () => lightbox.close());
  $('.lightbox-stage').addEventListener('click', event => { if (event.target === event.currentTarget) lightbox.close(); });
  lightbox.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); showPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  lightbox.addEventListener('close', () => {
    document.body.classList.remove('dialog-open'); photoRevision++;
    lightboxImage.getAnimations().forEach(animation => animation.cancel());
    photoTrigger?.focus({preventScroll:true});
  });
  const legalDialog = $('#legal-dialog');
  let legalTrigger;
  $('[data-open-legal]').addEventListener('click', event => {
    legalTrigger = event.currentTarget; legalDialog.showModal(); document.body.classList.add('dialog-open');
  });
  $('[data-close-legal]').addEventListener('click', () => legalDialog.close());
  legalDialog.addEventListener('click', event => {
    if (event.target !== legalDialog) return;
    const box = legalDialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) legalDialog.close();
  });
  legalDialog.addEventListener('close', () => { document.body.classList.remove('dialog-open'); legalTrigger?.focus({preventScroll:true}); });

  $('#project-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const requiredText = ['name', 'location'];
    for (const name of requiredText) {
      const input = form.elements.namedItem(name);
      input.setCustomValidity(input.value.trim() ? '' : 'Merci de renseigner ce champ.');
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const value = key => String(data.get(key) || '').trim();
    const selectedOption = $('option:checked', serviceSelect);
    const project = selectedOption?.textContent || 'Une autre idée';
    const parsedDate = value('date') ? new Date(`${value('date')}T12:00:00`) : null;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? new Intl.DateTimeFormat('fr-FR', {dateStyle:'long'}).format(parsedDate) : 'À définir ensemble';
    const message = [
      'Bonjour Lia,', '', `Je m’appelle ${value('name')} et j’aimerais vous parler de mon projet.`, '',
      `Projet : ${project}`, `Date : ${date}`, `Lieu : ${value('location')}`, `E-mail : ${value('email')}`,
      ...(value('message') ? ['', value('message')] : []), '', 'Au plaisir d’échanger,', value('name')
    ].join('\n');
    const channel = event.submitter?.value || 'whatsapp';
    const url = channel === 'email'
      ? `mailto:${contact.email}?subject=${encodeURIComponent(`Projet photo — ${project}`)}&body=${encodeURIComponent(message)}`
      : `https://wa.me/${contact.whatsapp}?text=${encodeURIComponent(message)}`;
    const fallback = document.createElement('a');
    fallback.href = url; fallback.textContent = channel === 'email' ? 'Ouvrir mon application e-mail ↗' : 'Ouvrir WhatsApp ↗';
    if (channel === 'whatsapp') { fallback.target = '_blank'; fallback.rel = 'noopener noreferrer'; }
    $('#form-status').replaceChildren(document.createTextNode('Votre message est prêt. Si l’application ne s’ouvre pas : '), fallback);
    window.open(url, channel === 'email' ? '_self' : '_blank', 'noopener,noreferrer');
  });
  $$('input', $('#project-form')).forEach(input => input.addEventListener('input', () => input.setCustomValidity('')));

  // Optional social URLs stay empty until the exact public accounts are supplied.
  function renderSocialLinks() {
    const container = $('#social-links');
    container.replaceChildren();
    for (const social of contact.socials) {
      try {
        const url = new URL(social.url);
        if (url.protocol !== 'https:') continue;
        const link = document.createElement('a');
        link.href = url.href; link.textContent = `${social.label} ↗`; link.className = 'social-link';
        link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link);
      } catch { /* Incomplete optional social links are not displayed. */ }
    }
  }
  function setImage(element, photo) {
    if (!element || !photo) return;
    element.src = photo.src;
    element.alt = photo.alt;
    element.width = photo.width;
    element.height = photo.height;
    if (photo.srcset) element.srcset = photo.srcset;
    else element.removeAttribute('srcset');
  }
  function applyContent(data) {
    services = data.services;
    images = data.images;
    Object.entries(images).forEach(([key, photo]) => setImage($(`[data-image="${key}"]`), photo));
    $$('[data-portfolio-theme]').forEach(link => {
      const photo = services.find(service => service.id === link.dataset.portfolioTheme)?.photos[0];
      link.hidden = !photo;
      if (photo) setImage($('img', link), photo);
    });
    $('[data-about-provisional]').hidden = ![images.aboutMain, images.aboutDetail].some(photo => photo.provisional);
    const provisional = [...Object.values(images), ...services.flatMap(service => service.photos)].some(photo => photo.provisional);
    $$('[data-site-provisional]').forEach(element => { element.hidden = !provisional; });
    Object.assign(contact, data.contact);
    $$('a[href^="mailto:"]').forEach(link => { link.href = `mailto:${contact.email}`; if (link.textContent.includes('@')) link.childNodes[0].textContent = contact.email; });
    $$('a[href^="https://wa.me/"]').forEach(link => { link.href = `https://wa.me/${contact.whatsapp}`; });
    $$('a[href^="tel:"]').forEach(link => {
      link.href = `tel:+${contact.whatsapp}`;
      link.childNodes[0].textContent = contact.whatsapp === '33767220949' ? '+33 7 67 22 09 49 ' : `+${contact.whatsapp} `;
    });
    $('#project-form').action = `mailto:${contact.email}`;
    renderProjectThemes(); renderPortfolio(); renderSocialLinks();
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
  fetch('services.json').then(response => {
    if (!response.ok) throw new Error('Impossible de charger les galeries');
    return response.json();
  }).then(data => {
    if (!validContent(data)) throw new Error('Configuration incomplète');
    applyContent(data);
  }).catch(() => {
    // Keep the last synchronized content; never guess image filenames.
    $('#portfolio-count').textContent += ' · sélection disponible';
  });
})();

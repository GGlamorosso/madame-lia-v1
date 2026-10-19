(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const escape = (text) => String(text).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const menu = $('.menu-toggle');
  const nav = $('#mobile-nav');
  function closeMenu() { menu.setAttribute('aria-expanded', 'false'); nav.hidden = true; menu.setAttribute('aria-label', 'Ouvrir le menu'); }
  menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu'); nav.hidden = !open; });
  $$('a', nav).forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('click', event => { if (!nav.contains(event.target) && !menu.contains(event.target)) closeMenu(); });
  window.matchMedia('(min-width:761px)').addEventListener('change', event => { if(event.matches) closeMenu(); });
  $('#year').textContent = new Date().getFullYear();

  let services = [];
  let currentFilter = 'all';
  const card = (s, number) => `<article class="service-card" data-service="${escape(s.id)}"><button class="photo-placeholder" data-tariff="${escape(s.id)}" aria-label="Voir les tarifs : ${escape(s.title)}"><span class="placeholder-frame" aria-hidden="true"></span><span class="placeholder-category">${escape(s.eyebrow)}</span><span class="placeholder-number" aria-hidden="true">${String(number + 1).padStart(2, '0')}</span><span class="placeholder-caption">VOTRE PHOTO · ${escape(s.title.toLocaleUpperCase('fr'))}</span></button><div class="service-info"><div><p class="service-eyebrow">${escape(s.eyebrow)}</p><h3>${escape(s.title)}</h3><p class="service-description">${escape(s.description)}</p></div><button class="card-link" data-tariff="${escape(s.id)}" aria-label="Voir la formule ${escape(s.title)}">↗</button></div></article>`;
  function renderCards() {
    const shown = services.filter(s => currentFilter === 'all' || s.group === currentFilter);
    const grid = $('#services-grid');
    grid.classList.toggle('filtered', currentFilter !== 'all');
    grid.innerHTML = shown.map(s => card(s, services.indexOf(s))).join('');
  }
  function renderPrices() {
    $('#price-list').innerHTML = services.map(s => `<details class="price-item" id="tarif-${escape(s.id)}"><summary><span class="price-name">${escape(s.title)}</span><span class="price-summary-right"><span class="price-amount">${escape(s.price)}</span><span class="price-plus" aria-hidden="true">+</span></span></summary><div class="price-detail"><p>${escape(s.description)}</p><div class="price-metadata"><span>${escape(s.duration)}</span><span>${escape(s.delivery)}</span></div><ul>${s.includes.map(item => `<li>${escape(item)}</li>`).join('')}</ul><button class="text-link" data-open-contact data-project="${escape(s.title)}">Préparer mon projet <span aria-hidden="true">↗</span></button></div></details>`).join('');
    $$('.price-item').forEach(details => details.addEventListener('toggle', () => { if (details.open) $$('.price-item').forEach(other => { if (other !== details) other.open = false; }); }));
  }
  $$('.filter').forEach(button => button.addEventListener('click', () => {
    currentFilter = button.dataset.filter;
    $$('.filter').forEach(filter => { const active = filter === button; filter.classList.toggle('active', active); filter.setAttribute('aria-pressed', String(active)); });
    renderCards();
  }));
  fetch('services.json').then(response => { if (!response.ok) throw new Error('Content unavailable'); return response.json(); }).then(data => {
    services = data.services; renderCards(); renderPrices();
  }).catch(() => { $('#services-grid').innerHTML = '<p>Les prestations sont momentanément indisponibles. Retrouvez mariage, baptême, naissance, anniversaire, portrait, voiture, restaurant et événement dans la version complète.</p>'; });

  const projectDialog = $('#project-dialog');
  const legalDialog = $('#legal-dialog');
  let dialogTrigger;
  function openProject(trigger, service) {
    closeMenu(); dialogTrigger = trigger;
    $('#contact-form-view').hidden = false; $('#contact-result-view').hidden = true;
    if (service) $('#project-service').value = service;
    projectDialog.showModal();
  }
  document.addEventListener('click', event => {
    const tariff = event.target.closest('[data-tariff]');
    if (tariff) { const details = document.getElementById(`tarif-${tariff.dataset.tariff}`); if (details) { details.open = true; details.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth', block: 'center' }); $('summary', details).focus({preventScroll:true}); } }
    const open = event.target.closest('[data-open-contact]');
    if (open) openProject(open, open.dataset.project);
    if (event.target.closest('[data-open-legal]')) { dialogTrigger = event.target; legalDialog.showModal(); }
    const close = event.target.closest('[data-close-dialog]');
    if (close) close.closest('dialog').close();
  });
  [projectDialog, legalDialog].forEach(dialog => {
    dialog.addEventListener('click', event => { if(event.target !== dialog) return; const rect = dialog.getBoundingClientRect(); if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); });
    dialog.addEventListener('close', () => dialogTrigger?.focus());
  });
  $('#project-form').addEventListener('submit', event => {
    event.preventDefault(); const data = new FormData(event.target);
    const dateValue = String(data.get('date') || '');
    const date = dateValue ? new Intl.DateTimeFormat('fr-FR', {dateStyle: 'long'}).format(new Date(`${dateValue}T12:00:00`)) : 'À définir ensemble';
    const message = `Bonjour Madame Lia,\n\nJe m’appelle ${data.get('name')} et j’aimerais vous parler de mon projet.\n\nPrestation : ${data.get('service')}\nDate envisagée : ${date}\nE-mail : ${data.get('email')}\n\n${data.get('message')}\n\nAu plaisir d’échanger,\n${data.get('name')}`;
    $('#project-summary').textContent = message;
    $('#contact-form-view').hidden = true; $('#contact-result-view').hidden = false;
    $('#copy-status').textContent = ''; projectDialog.scrollTop = 0; $('#copy-request').focus();
  });
  $('#copy-request').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#project-summary').textContent); $('#copy-status').textContent = 'Votre demande a été copiée.'; }
    catch { const range = document.createRange(); range.selectNodeContents($('#project-summary')); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); $('#copy-status').textContent = 'Le texte est sélectionné. Utilisez Copier ou téléchargez votre demande.'; }
  });
  $('#download-request').addEventListener('click', () => {
    const blob = new Blob([$('#project-summary').textContent], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'mon-projet-madame-lia.txt'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
  });
  $('#edit-request').addEventListener('click', () => { $('#contact-result-view').hidden = true; $('#contact-form-view').hidden = false; projectDialog.scrollTop = 0; $('[name="name"]').focus(); });
})();

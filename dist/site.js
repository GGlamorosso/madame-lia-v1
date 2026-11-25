// Comportements communs à toutes les pages : mouvement, menu mobile, barre de contact, année.
// Tout est une amélioration : sans JavaScript, les liens et contenus restent utilisables.
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const html = document.documentElement;
  html.classList.add('js');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let motionEnabled = false;
  let revealObserver;
  $$('[data-year]').forEach(element => { element.textContent = new Date().getFullYear(); });

  /* ---------- Mouvement : révélations au défilement ---------- */
  function observeReveals(root = document) {
    $$('[data-reveal]', root).forEach((element, index) => {
      if (!motionEnabled) { element.classList.add('is-visible'); return; }
      element.style.setProperty('--reveal-delay', `${(index % 4) * 70}ms`);
      revealObserver.observe(element);
    });
  }
  const forgetReveals = (root = document) => $$('[data-reveal]', root).forEach(element => revealObserver?.unobserve(element));
  function setMotionPreference() {
    motionEnabled = !reducedMotion.matches && 'IntersectionObserver' in window;
    revealObserver?.disconnect();
    if (motionEnabled) {
      revealObserver = new IntersectionObserver(entries => entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }), { threshold: 0.08, rootMargin: '0px 0px -24px 0px' });
      html.classList.add('motion-ready');
    } else {
      html.classList.remove('motion-ready');
      document.getAnimations().forEach(animation => animation.cancel());
    }
    observeReveals();
  }
  setMotionPreference();
  reducedMotion.addEventListener('change', setMotionPreference);

  /* ---------- Barre de contact fixe (mobile) ---------- */
  const bar = $('#cta-bar');
  const zones = new Map();
  let zonesReady = false;
  function updateBar() {
    if (!bar) return;
    const blocked = [...zones.values()].some(Boolean) || $$('dialog').some(dialog => dialog.open) || document.body.classList.contains('menu-open');
    const visible = zonesReady && !blocked;
    bar.classList.toggle('is-visible', visible);
    bar.inert = !visible;
    bar.setAttribute('aria-hidden', String(!visible));
  }
  if (bar && 'IntersectionObserver' in window) {
    bar.hidden = false;
    updateBar();
    const zoneObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => zones.set(entry.target, entry.isIntersecting));
      zonesReady = true;
      updateBar();
    });
    $$('[data-bar-hide]').forEach(zone => zoneObserver.observe(zone));
  }

  /* ---------- Menu mobile ---------- */
  const toggle = $('.menu-toggle');
  const nav = $('#site-nav');
  if (toggle && nav) {
    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
    const setMenu = open => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      document.body.classList.toggle('menu-open', open);
      $$('main, .site-footer').forEach(element => { element.inert = open; });
      updateBar();
    };
    toggle.addEventListener('click', () => {
      setMenu(!isOpen());
      if (isOpen()) $('a', nav)?.focus({ preventScroll: true });
    });
    nav.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !isOpen()) return;
      setMenu(false); toggle.focus();
    });
    matchMedia('(min-width: 900px)').addEventListener('change', event => { if (event.matches && isOpen()) setMenu(false); });
  }

  /* ---------- Boutons magnétiques (souris uniquement) ---------- */
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

  window.MadameLia = { $, $$, reducedMotion, observeReveals, forgetReveals, updateBar, motion: () => motionEnabled };
})();

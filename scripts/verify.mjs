// Parcours visiteur : aucune application externe n'est réellement ouverte.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const require = createRequire(new URL('../qa/package.json', import.meta.url));
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('playwright-core')); }
await mkdir('qa', { recursive: true });
const baseURL = process.env.BASE_URL || 'http://localhost:4173/';
const browser = await chromium.launch({ ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}), headless: true });
const original = await (await fetch(new URL('services.json', baseURL))).json();
const photoCount = original.services.reduce((n, service) => n + service.photos.length, 0);
const photographed = original.services.filter(service => service.photos.length);
const bookable = original.services.filter(service => service.bookable !== false);
const selectedCount = original.services.flatMap(service => service.photos).filter(photo => photo.select).length;
const report = [];
let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks++; };
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks++; };
const counter = (index, count) => `${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`;
const isOpen = locator => locator.evaluate(element => element.open);
async function settleImages(page) {
  await page.evaluate(async () => {
    const images = [...document.images].filter(image => image.getAttribute('src'));
    images.forEach(image => { image.loading = 'eager'; });
    await Promise.all(images.map(image => image.decode()));
    await document.fonts.ready;
  });
}
try {
  for (const width of [320, 390, 768, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    const errors = [], failures = [], external = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', request => failures.push(request.url()));
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url()); });
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await settleImages(page);
    const state = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth,
      height: document.documentElement.scrollHeight,
      themeHeight: document.querySelector('#prestations').getBoundingClientRect().height,
      unloaded: [...document.images].filter(image => image.getAttribute('src') && !image.naturalWidth).length,
      missingAlts: [...document.images].filter(image => !image.hasAttribute('alt')).length,
      brokenAnchors: [...document.querySelectorAll('a[href^="#"]')].filter(link => !document.getElementById(link.getAttribute('href').slice(1))).length,
      hiddenContent: [...document.querySelectorAll('[data-reveal]')].filter(element => getComputedStyle(element).opacity !== '1').length,
      clippedTitles: [...document.querySelectorAll('h1,h2,.theme-name')].filter(element => element.scrollWidth > element.clientWidth + 2).map(element => element.textContent),
      background: getComputedStyle(document.body).backgroundColor,
      headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
      bodyFont: getComputedStyle(document.body).fontFamily
    }));
    equal(state.overflow, false, `Débordement horizontal à ${width}px`);
    equal(state.unloaded, 0, 'Toutes les photos chargées');
    equal(state.missingAlts, 0, 'Textes alternatifs présents');
    equal(state.brokenAnchors, 0, 'Ancres valides');
    equal(state.hiddenContent, 0, 'Contenu visible avec animations réduites');
    equal(state.clippedTitles.length, 0, `Titres complets : ${state.clippedTitles}`);
    equal(state.background, 'rgb(255, 255, 255)', 'Fond blanc');
    ok(state.headingFont.includes('Archivo'), 'Titres Archivo du plan Claude');
    ok(state.bodyFont.includes('Archivo'), 'Police Archivo restaurée');
    ok(state.themeHeight < (width >= 768 ? 2400 : 1600), 'Miniatures sans hauteur démesurée');
    ok(state.height < 10000, 'Page initiale de longueur maîtrisée');
    equal(await page.locator('.frame').count(), Math.min(photoCount, width >= 900 ? 20 : 12), 'Galerie initiale courte');
    equal(await page.locator('[data-filter]').count(), photographed.length + 1, 'Filtres des thèmes photographiés');
    equal(await page.locator('.strip-item').count(), selectedCount, 'Sélection complète');
    equal(await page.locator('.theme-row').count(), bookable.length, 'Prestations réservables');
    equal(await page.locator('#project-themes input').count(), bookable.length + 1, 'Projets et autre idée');
    equal(await page.locator('.gl-canvas.is-live').count(), 0, 'WebGL désactivé en mouvement réduit');
    await page.screenshot({ path: `qa/blanc-rouge-${width}-hero.png` });
    await page.screenshot({ path: `qa/blanc-rouge-${width}-full.png`, fullPage: true });
    for (const service of photographed) {
      await page.locator(`[data-filter="${service.id}"]`).click();
      equal(await page.locator('.frame').count(), service.photos.length, `Filtre ${service.id} à ${width}px`);
      equal(await page.locator('.filter[aria-pressed="true"]').count(), 1, 'Un seul filtre actif');
      ok((await page.locator('.frame figcaption').allTextContents()).every(text => text.includes(service.title)), 'Photos du thème sélectionné');
    }
    await page.locator('[data-filter="all"]').click();
    await page.locator('#portfolio-more').click();
    equal(await page.locator('.frame').count(), photoCount, 'Toutes les photos disponibles');
    equal(await page.locator('#portfolio-more').isVisible(), false, 'Bouton masqué après ouverture complète');
    equal(await page.evaluate(() => document.activeElement?.classList.contains('frame-btn')), true, 'Focus placé sur la suite');
    const marriage = original.services.find(service => service.id === 'mariage');
    await page.locator('[data-filter="mariage"]').click();
    const opener = page.locator('[data-photo-index="0"]');
    await opener.click();
    equal(await isOpen(page.locator('#lightbox')), true, 'Visionneuse ouverte');
    equal(await page.locator('#lightbox-counter').textContent(), counter(0, marriage.photos.length), 'Compteur initial');
    await page.keyboard.press('ArrowLeft');
    equal(await page.locator('#lightbox-counter').textContent(), counter(marriage.photos.length - 1, marriage.photos.length), 'Boucle vers la dernière photo');
    await page.keyboard.press('ArrowRight');
    await page.locator('[data-lightbox-next]').click();
    equal(await page.locator('#lightbox-counter').textContent(), counter(1, marriage.photos.length), 'Navigation par bouton');
    await settleImages(page);
    const photoBox = await page.locator('#lightbox-image').boundingBox();
    ok(photoBox.x >= 0 && photoBox.y >= 0 && photoBox.y + photoBox.height <= 845, 'Photo contenue dans la fenêtre');
    await page.locator('.lightbox-stage').dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: 200, clientY: 200 }] });
    await page.locator('.lightbox-stage').dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: 100, clientY: 202 }] });
    await page.locator('.lightbox-stage').dispatchEvent('touchend');
    equal(await page.locator('#lightbox-counter').textContent(), counter(2 % marriage.photos.length, marriage.photos.length), 'Balayage tactile horizontal');
    if (width === 390 || width === 1440) await page.screenshot({ path: `qa/blanc-rouge-${width}-lightbox.png` });
    await page.keyboard.press('Escape');
    equal(await isOpen(page.locator('#lightbox')), false, 'Échap ferme la photo');
    equal(await opener.evaluate(element => element === document.activeElement), true, 'Focus restitué à la photo');
    await page.locator('[data-select-index="0"]').click();
    equal(await page.locator('#lightbox-counter').textContent(), counter(0, selectedCount), 'Visionneuse de la sélection');
    await page.keyboard.press('Escape');
    await page.locator('.theme-row[data-project="mariage"]').click();
    equal(await isOpen(page.locator('#contact-dialog')), true, 'Formulaire ouvert sur demande');
    equal(await page.locator('input[name="service"]:checked').inputValue(), 'mariage', 'Prestation présélectionnée');
    equal(await page.locator('#project-name').evaluate(element => element === document.activeElement), true, 'Prénom prêt à saisir');
    await page.keyboard.press('Escape');
    equal(await page.locator('.theme-row[data-project="mariage"]').evaluate(element => element === document.activeElement), true, 'Focus restitué à la prestation');
    await page.locator('.header-cta').click();
    await page.evaluate(() => {
      document.querySelectorAll('input[name="service"]').forEach(input => { input.checked = false; });
      window.open = (url, target) => { window.__opened = { url, target }; return null; };
    });
    await page.locator('button[value="whatsapp"]').click();
    equal(await page.locator('#service-error').isVisible(), true, 'Projet requis');
    equal(await page.evaluate(() => window.__opened), undefined, 'Formulaire vide sans ouverture');
    await page.locator('input[name="service"][value="naissance"]').check();
    await page.locator('#project-name').fill('   ');
    await page.locator('button[value="whatsapp"]').click();
    equal(await page.evaluate(() => window.__opened), undefined, 'Prénom vide rejeté');
    await page.locator('#project-name').fill('Camille & Zoé');
    await page.locator('#project-location').fill('Lyon & alentours');
    await page.locator('.more summary').click();
    await page.locator('#project-message').fill('Une lumière douce, des photos spontanées.');
    await page.locator('button[value="whatsapp"]').click();
    const whatsapp = await page.evaluate(() => window.__opened);
    ok(whatsapp.url.startsWith(`https://wa.me/${original.contact.whatsapp}?text=`), 'Destinataire WhatsApp correct');
    equal(whatsapp.target, '_blank', 'WhatsApp dans un nouvel onglet');
    const message = new URL(whatsapp.url).searchParams.get('text');
    for (const text of ['Camille & Zoé', 'Naissance', 'À définir ensemble', 'Lyon & alentours', 'Une lumière douce']) ok(message.includes(text), `Message contenant ${text}`);
    await page.locator('#project-date').fill('2027-06-12');
    await page.locator('button[value="email"]').click();
    const email = await page.evaluate(() => window.__opened);
    const mailURL = new URL(email.url);
    equal(mailURL.pathname, original.contact.email, 'Destinataire e-mail correct');
    equal(mailURL.searchParams.get('subject'), 'Projet photo — Naissance', 'Objet e-mail');
    ok(mailURL.searchParams.get('body').includes('12 juin 2027'), 'Date française');
    equal(await page.locator('#form-status a').getAttribute('href'), email.url, 'Lien de secours complet');
    if (width === 390 || width === 1440) await page.locator('#contact-dialog').screenshot({ path: `qa/blanc-rouge-${width}-form.png` });
    for (let index = 0; index < 18; index++) {
      await page.keyboard.press('Tab');
      ok(await page.evaluate(() => document.activeElement === document.body || document.querySelector('#contact-dialog').contains(document.activeElement)), 'Aucun contrôle de fond accessible au clavier');
    }
    await page.keyboard.press('Escape');
    await opener.click();
    await page.locator('#lightbox-cta').click();
    equal(await isOpen(page.locator('#lightbox')), false, 'Passage photo vers contact');
    equal(await isOpen(page.locator('#contact-dialog')), true, 'Contact depuis la photo');
    equal(await page.locator('input[name="service"]:checked').inputValue(), 'mariage', 'Thème de la photo repris');
    await page.keyboard.press('Escape');
    equal(await opener.evaluate(element => element === document.activeElement), true, 'Focus restitué après photo puis contact');
    await page.locator('#apropos').scrollIntoViewIfNeeded();
    if (width < 900) {
      await page.waitForFunction(() => document.querySelector('#cta-bar').classList.contains('is-visible'));
      equal(await page.locator('#cta-bar').evaluate(element => element.inert), false, 'Barre mobile utilisable');
      await page.locator('#cta-bar [data-open-contact]').click();
      equal(await isOpen(page.locator('#contact-dialog')), true, 'Contact depuis la barre mobile');
      equal(await page.locator('#cta-bar').evaluate(element => element.inert), true, 'Barre inactive derrière la modale');
      await page.keyboard.press('Escape');
    }
    await page.locator('[data-open-legal]').click();
    equal(await isOpen(page.locator('#legal-dialog')), true, 'Mentions accessibles');
    await page.keyboard.press('Escape');
    equal(await page.locator('[data-open-legal]').evaluate(element => element === document.activeElement), true, 'Focus des mentions restitué');
    await page.locator('.footer-wordmark').click();
    equal(await page.evaluate(() => scrollY), 0, 'Retour en haut depuis le pied de page');
    equal(errors.length, 0, `Erreurs JavaScript : ${errors}`);
    equal(failures.length, 0, `Requêtes échouées : ${failures}`);
    equal(external.length, 0, `Requêtes tierces : ${external}`);
    report.push({ width, initialHeight: state.height, status: 'passed', runtimeErrors: errors, httpFailures: failures });
    await page.close();
  }
  for (const mode of ['offline', 'invalid']) {
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await page.route('**/services.json', route => mode === 'offline' ? route.abort() : route.fulfill({ json: { ...original, images: { ...original.images, hero: { ...original.images.hero, src: 'https://example.com/photo.png' } } } }));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    equal(await page.locator('.frame').count(), Math.min(20, photoCount), `Galerie de secours : ${mode}`);
    equal(await page.locator('#project-themes input').count(), bookable.length + 1, `Contact de secours : ${mode}`);
    await page.close();
  }
  const replacement = { src: 'assets/test-photo.png', alt: 'Photographie réelle de test', width: 1, height: 1, provisional: false };
  const config = structuredClone(original);
  Object.keys(config.images).forEach(key => { config.images[key] = { ...replacement }; });
  config.services.forEach(service => { service.photos = [{ ...replacement }]; });
  config.contact = { whatsapp: '33612345678', email: 'test@example.com', socials: [] };
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1EAAAAASUVORK5CYII=', 'base64');
  const updated = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await updated.route('**/test-photo.png', route => route.fulfill({ contentType: 'image/png', body: png }));
  await updated.route('**/services.json', route => route.fulfill({ json: config }));
  await updated.goto(baseURL, { waitUntil: 'networkidle' });
  await settleImages(updated);
  for (const key of ['hero', 'aboutMain', 'aboutDetail']) {
    equal(await updated.locator(`[data-image="${key}"]`).getAttribute('src'), replacement.src, `Photo remplacée : ${key}`);
    equal(await updated.locator(`[data-image="${key}"]`).getAttribute('srcset'), null, 'Anciennes variantes retirées');
  }
  equal(await updated.locator('.header-cta').getAttribute('href'), 'https://wa.me/33612345678', 'Nouveau téléphone appliqué');
  equal(await updated.locator('[data-email]').first().textContent(), 'test@example.com', 'Nouvel e-mail appliqué');
  equal(await updated.locator('#social-links a').count(), 0, 'Réseaux vides masqués');
  equal(await updated.locator('[data-site-provisional]:visible').count(), 0, 'Pas de mention provisoire pour les photos réelles');
  await updated.close();
  const noScript = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await noScript.goto(baseURL, { waitUntil: 'networkidle' });
  equal(await noScript.locator('h1').isVisible(), true, 'Titre sans JavaScript');
  equal(await noScript.locator('.header-cta').getAttribute('href'), `https://wa.me/${original.contact.whatsapp}`, 'WhatsApp sans JavaScript');
  equal(await noScript.locator('[data-email]').first().getAttribute('href'), `mailto:${original.contact.email}`, 'E-mail sans JavaScript');
  equal(await noScript.locator('.noscript-note').first().isVisible(), true, 'Alternative sans JavaScript');
  await noScript.close();
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.locator('#hero-canvas.is-live').waitFor({ state: 'attached', timeout: 12000 });
    await page.waitForTimeout(2400);
    equal(await page.locator('.hero-actions').evaluate(element => getComputedStyle(element).opacity), '1', 'Boutons visibles après animation');
    await page.screenshot({ path: `qa/blanc-rouge-${width}-motion-hero.png` });
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.locator('#closing-canvas.is-live').waitFor({ state: 'attached', timeout: 12000 });
    await page.waitForTimeout(2400);
    await page.screenshot({ path: `qa/blanc-rouge-${width}-motion-closing.png` });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.gl-canvas.is-live') && !document.documentElement.classList.contains('motion-ready'));
    equal(await page.locator('.gl-canvas.is-live').count(), 0, 'Scènes arrêtées au changement de préférence');
    equal(await page.locator('html').evaluate(element => element.classList.contains('motion-ready')), false, 'Animations désactivées immédiatement');
    equal(errors.length, 0, `Erreurs des scènes : ${errors}`);
    await page.close();
  }
  const result = { checks, viewports: report, status: 'passed' };
  await writeFile('qa/verification.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally { await browser.close(); }

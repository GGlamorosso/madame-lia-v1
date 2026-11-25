// Parcours visiteur sur toutes les pages : aucune application externe n'est réellement ouverte.
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
const whatsapp = `https://wa.me/${original.contact.whatsapp}`;
const pages = ['/', '/a-propos/', '/contact/', '/mentions-legales/', '/confidentialite/', '/livraison/', '/livraison/creer/', '/404.html'];
const page404 = new URL('404.html', baseURL).href;
function watch(page) {
  const errors = [], failures = [], external = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && response.url() !== page404) failures.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => failures.push(request.url()));
  page.on('request', request => { if (new URL(request.url()).origin !== new URL(baseURL).origin) external.push(request.url()); });
  return { errors, failures, external };
}
const encodeDelivery = data => `v1.${Buffer.from(JSON.stringify(data)).toString('base64url')}`;
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
    const { errors, failures, external } = watch(page);
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
      clippedTitles: [...document.querySelectorAll('h1,h2,.theme-name')].filter(element => element.clientWidth > 1 && element.scrollWidth > element.clientWidth + 2).map(element => element.textContent),
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
    equal(await page.locator('#selection-strip .strip-item').count(), selectedCount, 'Pellicule complète, sans doublons en mouvement réduit');
    equal(await page.locator('.hero-image').isVisible(), true, 'Photo d’ouverture dans le hero');
    equal(await page.locator('.hero-mark, .hero-sub, .frame-mark, .section-head .idx, .hint:not(#portfolio-count)').count(), 0, 'Sans accroche ni annotations');
    equal((await page.locator('.hero-title').boundingBox()).width > 1, width >= 900, 'Grand titre sur ordinateur seulement');
    equal(await page.locator('.wordmark').textContent(), 'Liashoot', 'Nom Liashoot dans l’en-tête');
    equal(await page.locator('.theme-row').count(), bookable.length, 'Prestations réservables');
    equal(await page.locator('.grease').count(), 0, 'Aucun trait rouge sur les photos');
    equal(await page.locator('form, #contact-dialog, #legal-dialog').count(), 0, 'Plus de formulaire ni de fenêtre de mentions');
    ok((await page.locator('.theme-row[data-project="mariage"]').getAttribute('href')).startsWith(`${whatsapp}?text=`), 'Prestation vers WhatsApp');
    ok(decodeURIComponent(await page.locator('.theme-row[data-project="mariage"]').getAttribute('href')).includes('Mariage'), 'Prestation reprise dans le message');
    equal(await page.locator('.gl-canvas.is-live').count(), 0, 'WebGL désactivé en mouvement réduit');
    await page.screenshot({ path: `qa/site-${width}-hero.png` });
    await page.screenshot({ path: `qa/site-${width}-full.png`, fullPage: true });
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
    if (width === 390 || width === 1440) await page.screenshot({ path: `qa/site-${width}-lightbox.png` });
    await page.keyboard.press('Escape');
    equal(await isOpen(page.locator('#lightbox')), false, 'Échap ferme la photo');
    equal(await opener.evaluate(element => element === document.activeElement), true, 'Focus restitué à la photo');
    await page.locator('[data-select-index="0"]').click();
    equal(await page.locator('#lightbox-counter').textContent(), counter(0, selectedCount), 'Visionneuse de la sélection');
    await page.keyboard.press('Escape');
    await opener.click();
    ok(decodeURIComponent(await page.locator('#lightbox-cta').getAttribute('href')).includes('Mariage'), 'Photo vers WhatsApp avec le thème');
    equal(await page.locator('#lightbox-cta').getAttribute('target'), '_blank', 'WhatsApp dans un nouvel onglet');
    await page.keyboard.press('Escape');
    await page.locator('#apropos').scrollIntoViewIfNeeded();
    if (width < 900) {
      await page.waitForFunction(() => document.querySelector('#cta-bar').classList.contains('is-visible'));
      equal(await page.locator('#cta-bar').evaluate(element => element.inert), false, 'Barre mobile utilisable');
      ok((await page.locator('#cta-bar .btn').getAttribute('href')).startsWith(`${whatsapp}?text=`), 'Barre mobile vers WhatsApp');
      await page.locator('[data-filter="mariage"]').click();
      await page.locator('[data-photo-index="0"]').click();
      equal(await page.locator('#cta-bar').evaluate(element => element.inert), true, 'Barre inactive derrière la visionneuse');
      await page.keyboard.press('Escape');
      await page.locator('.menu-toggle').click();
      equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'), 'true', 'Menu mobile ouvert');
      equal(await page.locator('#site-nav a[href="/contact/"]').isVisible(), true, 'Liens du menu visibles');
      equal(await page.locator('main').evaluate(element => element.inert), true, 'Page inerte derrière le menu');
      await page.keyboard.press('Escape');
      equal(await page.locator('.menu-toggle').evaluate(element => element === document.activeElement), true, 'Focus rendu au bouton du menu');
      equal(await page.locator('#site-nav a[href="/contact/"]').isVisible(), false, 'Menu refermé');
    }
    await page.locator('.footer-up').click();
    await page.waitForFunction(() => scrollY === 0);
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
    equal(await page.locator('.theme-row').count(), bookable.length, `Prestations de secours : ${mode}`);
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
    equal(await updated.locator(`[data-image="${key}"]`).getAttribute('src'), `/${replacement.src}`, `Photo remplacée : ${key}`);
    equal(await updated.locator(`[data-image="${key}"]`).getAttribute('srcset'), null, 'Anciennes variantes retirées');
  }
  ok((await updated.locator('.header-cta').getAttribute('href')).startsWith('https://wa.me/33612345678?text='), 'Nouveau téléphone appliqué, message conservé');
  equal(await updated.locator('[data-email]').first().textContent(), 'test@example.com', 'Nouvel e-mail appliqué');
  equal(await updated.locator('[data-social]:visible').count(), 0, 'Réseaux vides masqués');
  equal(await updated.locator('[data-site-provisional]:visible').count(), 0, 'Pas de mention provisoire pour les photos réelles');
  await updated.close();
  const noScript = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await noScript.goto(baseURL, { waitUntil: 'networkidle' });
  equal(await noScript.locator('#selection-strip .strip-item').count(), selectedCount, 'Pellicule sans JavaScript');
  equal(await noScript.locator('#selection-strip img').first().isVisible(), true, 'Photo d’ouverture sans JavaScript');
  equal(await noScript.locator('.noscript-note').first().isVisible(), true, 'Alternative sans JavaScript');
  const instagram = original.contact.socials.find(social => social.label === 'Instagram')?.url;
  for (const path of pages) {
    await noScript.goto(new URL(path, baseURL).href, { waitUntil: 'networkidle' });
    ok((await noScript.locator('.header-cta').getAttribute('href')).startsWith(`${whatsapp}?text=`), `WhatsApp sans JavaScript : ${path}`);
    equal(await noScript.locator('[data-email]').first().getAttribute('href'), `mailto:${original.contact.email}`, `E-mail sans JavaScript : ${path}`);
    if (instagram) equal(await noScript.locator('.site-footer [data-social="Instagram"]').first().getAttribute('href'), instagram, `Instagram sans JavaScript : ${path}`);
  }
  await noScript.close();

  // Pages intérieures : rendu, liens internes, pied de page.
  const internal = new Set();
  for (const width of [320, 390, 768, 1440]) {
    for (const path of pages.slice(1)) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const { errors, failures, external } = watch(page);
      await page.goto(new URL(path, baseURL).href, { waitUntil: 'networkidle' });
      await settleImages(page);
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        unloaded: [...document.images].filter(image => image.getAttribute('src') && !image.naturalWidth).length,
        clipped: [...document.querySelectorAll('h1,h2,h3')].filter(element => element.scrollWidth > element.clientWidth + 2).map(element => element.textContent.trim()),
        links: [...document.querySelectorAll('a[href^="/"]')].map(link => link.getAttribute('href').split('#')[0].split('?')[0])
      }));
      state.links.forEach(link => internal.add(link || '/'));
      equal(state.overflow, false, `Débordement horizontal ${path} à ${width}px`);
      equal(state.unloaded, 0, `Images chargées ${path}`);
      equal(state.clipped.length, 0, `Titres complets ${path} : ${state.clipped}`);
      equal(await page.locator('.site-footer .footer-cols a').count(), 12, `Pied de page complet ${path}`);
      if (width === 390 || width === 1440) await page.screenshot({ path: `qa/pages-${width}${path.replace(/[/.]+/g, '-')}.png`, fullPage: true });
      equal(errors.length, 0, `Erreurs JavaScript ${path} : ${errors}`);
      equal(failures.length, 0, `Requêtes échouées ${path} : ${failures}`);
      equal(external.length, 0, `Requêtes tierces ${path} : ${external}`);
      await page.close();
    }
  }
  for (const link of internal) equal((await fetch(new URL(link, baseURL))).status, 200, `Lien interne valide : ${link}`);
  const about = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  await about.goto(new URL('/a-propos/', baseURL).href, { waitUntil: 'networkidle' });
  equal(await about.locator('.theme-cloud li').count(), bookable.length, 'Prestations listées sur À propos');
  equal(await about.locator('.carnets .strip-item').count(), original.services.filter(service => service.bookable === false).flatMap(service => service.photos).length, 'Carnets personnels');
  equal(await about.locator('.site-nav a[aria-current="page"]').getAttribute('href'), '/a-propos/', 'Page courante signalée');
  await about.locator('.theme-cloud a[href*="theme=portrait"]').click();
  await about.waitForURL(/theme=portrait/);
  equal(await about.locator('.filter[aria-pressed="true"]').getAttribute('data-filter'), 'portrait', 'Filtre ouvert depuis À propos');
  await about.close();

  // Livraison : générateur → page client, refus d'un service inconnu, lien expiré ou abîmé.
  const generator = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await generator.goto(new URL('/livraison/creer/', baseURL).href, { waitUntil: 'networkidle' });
  equal(await generator.locator('#d-copy').isDisabled(), true, 'Lien indisponible sans données');
  await generator.locator('#d-name').fill('Julie & Tom');
  await generator.locator('#d-url').fill('https://exemple-piege.com/photos');
  equal(await generator.locator('#d-url-error').isVisible(), true, 'Service inconnu refusé');
  equal(await generator.locator('#d-copy').isDisabled(), true, 'Pas de lien vers un service inconnu');
  await generator.locator('#d-url').fill('https://www.swisstransfer.com/d/test-1234');
  await generator.locator('#d-occasion').fill('Mariage');
  await generator.locator('#d-count').fill('248');
  await generator.locator('#d-expiry').fill('2999-12-31');
  const deliveryLink = await generator.locator('#d-link').inputValue();
  ok(deliveryLink.startsWith(new URL('/livraison/#v1.', baseURL).href), 'Lien de livraison généré');
  ok(decodeURIComponent(await generator.locator('#d-whatsapp').getAttribute('href')).includes(deliveryLink), 'Lien prêt à envoyer sur WhatsApp');
  await generator.close();
  const delivery = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const deliveryWatch = watch(delivery);
  await delivery.goto(deliveryLink, { waitUntil: 'networkidle' });
  equal(await delivery.locator('[data-state="ready"]').isVisible(), true, 'Page de livraison affichée');
  equal(await delivery.locator('[data-field="name"]').textContent(), 'Julie & Tom,', 'Nom du client');
  equal(await delivery.locator('[data-when="ok"][data-field="download"]').getAttribute('href'), 'https://www.swisstransfer.com/d/test-1234', 'Bouton de téléchargement');
  ok((await delivery.locator('[data-field="meta"]').textContent()).includes('248 images · via SwissTransfer'), 'Détails de la livraison');
  await delivery.screenshot({ path: 'qa/livraison-390.png', fullPage: true });
  await delivery.goto(new URL(`/livraison/#${encodeDelivery({ n: 'Camille', u: 'https://we.tl/t-test', x: '2020-01-01' })}`, baseURL).href);
  await delivery.reload({ waitUntil: 'networkidle' });
  equal(await delivery.locator('[data-when="expired"][data-wa-message]').isVisible(), true, 'Lien expiré signalé');
  ok(decodeURIComponent(await delivery.locator('[data-wa-message="expired"]').getAttribute('href')).includes('(Camille) a expiré'), 'Demande de nouveau lien préremplie');
  for (const fragment of [encodeDelivery({ n: 'Piège', u: 'https://exemple-piege.com/x' }), 'v1.%%%', encodeDelivery({ n: '<img src=x onerror=alert(1)>', u: 'javascript:alert(1)' })]) {
    await delivery.goto(new URL(`/livraison/#${fragment}`, baseURL).href);
    await delivery.reload({ waitUntil: 'networkidle' });
    equal(await delivery.locator('[data-state="invalid"]').isVisible(), true, `Lien refusé : ${fragment.slice(0, 24)}`);
  }
  await delivery.goto(new URL('/livraison/', baseURL).href, { waitUntil: 'networkidle' });
  equal(await delivery.locator('[data-state="empty"]').isVisible(), true, 'Espace client sans lien');
  equal(await delivery.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow', 'Livraison non référencée');
  equal(deliveryWatch.errors.length, 0, `Erreurs livraison : ${deliveryWatch.errors}`);
  equal(deliveryWatch.external.length, 0, `Requêtes tierces livraison : ${deliveryWatch.external}`);
  await delivery.close();
  ok(!(await (await fetch(new URL('gl.js', baseURL))).text()).includes('u_lens'), 'Loupe WebGL retirée');
  for (const width of [390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    await page.locator('#hero-canvas.is-live').waitFor({ state: 'attached', timeout: 12000 });
    await page.locator('#selection-strip').scrollIntoViewIfNeeded();
    const reelStart = await page.locator('#selection-strip').evaluate(element => element.scrollLeft);
    await page.waitForTimeout(2400);
    ok(await page.locator('#selection-strip').evaluate(element => element.scrollLeft) > reelStart + 20, 'La pellicule défile seule');
    ok(await page.locator('#selection-strip .is-clone').count() === selectedCount, 'Boucle de la pellicule');
    equal(await page.locator('#selection-strip .is-clone').first().getAttribute('aria-hidden'), 'true', 'Doublons masqués aux lecteurs d’écran');
    equal(await page.locator('.hero-actions').evaluate(element => getComputedStyle(element).opacity), '1', 'Boutons visibles après animation');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(800);
    await page.screenshot({ path: `qa/site-${width}-motion-hero.png` });
    await page.locator('#contact').scrollIntoViewIfNeeded();
    await page.locator('#closing-canvas.is-live').waitFor({ state: 'attached', timeout: 12000 });
    await page.waitForTimeout(2400);
    await page.screenshot({ path: `qa/site-${width}-motion-closing.png` });
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

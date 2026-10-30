import {createRequire} from 'node:module';
const require = createRequire(new URL('../qa/package.json', import.meta.url));
let chromium;
try { ({chromium} = require('playwright')); } catch { ({chromium} = require('playwright-core')); }
import assert from 'node:assert/strict';
import {writeFile, mkdir} from 'node:fs/promises';
await mkdir('qa', {recursive:true});
const baseURL = process.env.BASE_URL || 'http://localhost:4173/';
const browser=await chromium.launch({...(process.env.BROWSER_PATH ? {executablePath:process.env.BROWSER_PATH} : {}),headless:true});
const report=[];
let checks=0;
const ok=(value,message)=>{assert.ok(value,message);checks++;};
const equal=(actual,expected,message)=>{assert.equal(actual,expected,message);checks++;};
async function settleImages(page){
 await page.evaluate(async()=>{const imgs=[...document.images].filter(img=>img.getAttribute('src'));imgs.forEach(img=>img.loading='eager');await Promise.all(imgs.map(img=>img.decode()));await document.fonts.ready;});
}
try {
 for(const width of [1440,768,390,320]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const errors=[]; const failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400)failed.push(`${r.status()} ${r.url()}`);});
  await page.goto(baseURL,{waitUntil:'networkidle'});
  await settleImages(page);
  await page.emulateMedia({reducedMotion:'reduce'});
  const state=await page.evaluate(()=>({
   overflow:document.documentElement.scrollWidth>innerWidth,
   count:document.querySelectorAll('.photo-card').length,
   unloaded:[...document.images].filter(img=>img.getAttribute('src')&&!img.naturalWidth).map(img=>img.src),
   wrongAnchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.getAttribute('href').slice(1))).map(a=>a.href),
   missingAlts:[...document.images].filter(img=>!img.hasAttribute('alt')).length,
   title:document.querySelector('h1').getAttribute('aria-label'),
   hiddenReveals:[...document.querySelectorAll('[data-reveal]')].filter(el=>getComputedStyle(el).opacity!=='1').length
  }));
  equal(state.overflow,false,`horizontal overflow at ${width}`);
  equal(state.count,16,`gallery count ${width}`);
  equal(state.unloaded.length,0,`unloaded images ${width}`);
  equal(state.wrongAnchors.length,0,`broken anchors ${width}`);
  equal(state.missingAlts,0,`missing alt ${width}`);
  equal(state.hiddenReveals,0,`reduced motion hides content ${width}`);
  equal(state.title,'Capturer l’instant pour faire vivre l’authentique.','accessible heading');
  equal(errors.length,0,`runtime errors ${errors}`);equal(failed.length,0,`HTTP failures ${failed}`);
  await page.screenshot({path:`qa/refonte-${width}-hero.png`});
  await page.screenshot({path:`qa/refonte-${width}-full.png`,fullPage:true});
  if(width===1440||width===390){
   for(const selector of ['.hero-introduction','.featured','#contact','#apropos','#portfolio']){
    await page.locator(selector).screenshot({path:`qa/${width}-${selector.replace(/[^a-z]/g,'')}.png`});
   }
  }
  for(const id of ['mariage','bapteme','naissance','anniversaire','portrait','voiture','restaurant','evenement']){
   await page.locator(`[data-filter="${id}"]`).click();
   equal(await page.locator('.photo-card').count(),2,`${id} filter ${width}`);
   equal(await page.locator('.filter[aria-pressed="true"]').count(),1,'one selected filter');
   ok((await page.locator('.photo-card figcaption').allTextContents()).every(t=>t.includes(id==='bapteme'?'Baptême':id==='evenement'?'Événement':id[0].toUpperCase()+id.slice(1))),`correct theme ${id}`);
  }
  await page.locator('[data-filter="all"]').click();
  equal(await page.locator('.photo-card').count(),16,'reset filter');
  await page.locator('[data-portfolio-theme="bapteme"]').click();
  equal(await page.locator('[data-filter="bapteme"]').getAttribute('aria-pressed'),'true','featured selects baptism');
  const opener=page.locator('[data-photo-index="0"]');
  await opener.click();
  equal(await page.locator('#lightbox').evaluate(el=>el.open),true,'lightbox opens');
  equal(await page.locator('#lightbox-counter').textContent(),'01 / 02','first photo');
  await page.keyboard.press('ArrowRight');
  equal(await page.locator('#lightbox-counter').textContent(),'02 / 02','next photo');
  await page.keyboard.press('ArrowRight');
  equal(await page.locator('#lightbox-counter').textContent(),'01 / 02','lightbox wraps');
  await page.keyboard.press('ArrowLeft');
  equal(await page.locator('#lightbox-counter').textContent(),'02 / 02','previous photo');
  await page.keyboard.press('Escape');
  equal(await page.locator('#lightbox').evaluate(el=>el.open),false,'Escape closes');
  equal(await opener.evaluate(el=>el===document.activeElement),true,'focus restores');
  await page.locator('[data-project="mariage"]').click();
  equal(await page.locator('#project-service').inputValue(),'mariage','theme preselects form');
  await page.locator('#project-service').selectOption('naissance');
  equal(await page.locator('[data-project="naissance"]').getAttribute('aria-pressed'),'true','form syncs themes');
  await page.evaluate(()=>{window.open=(url,target)=>{window.__opened={url,target};return null;};});
  await page.locator('button[value="whatsapp"]').click();
  equal(await page.evaluate(()=>window.__opened),undefined,'empty form does not open app');
  await page.locator('#project-name').fill('Camille & Zoé');
  await page.locator('#project-email').fill('camille@example.com');
  await page.locator('#project-location').fill('Saint-Tropez & alentours');
  await page.locator('#project-message').fill('Une lumière douce, des photos spontanées.');
  await page.locator('button[value="whatsapp"]').click();
  const whatsapp=await page.evaluate(()=>window.__opened);
  ok(whatsapp.url.startsWith('https://wa.me/33767220949?text='),'WhatsApp recipient');
  equal(whatsapp.target,'_blank','WhatsApp target');
  const message=new URL(whatsapp.url).searchParams.get('text');
  for(const text of ['Camille & Zoé','Naissance','À définir ensemble','Saint-Tropez & alentours','camille@example.com','Une lumière douce'])ok(message.includes(text),`message contains ${text}`);
  await page.locator('#project-date').fill('2027-06-12');
  await page.locator('button[value="email"]').click();
  const email=await page.evaluate(()=>window.__opened);
  ok(email.url.startsWith('mailto:liapellegrin22@gmail.com?'),'email recipient');
  ok(decodeURIComponent(email.url).includes('12 juin 2027'),'French date');
  ok(decodeURIComponent(email.url).includes('Projet photo — Naissance'),'email subject');
  equal(await page.locator('#form-status a').getAttribute('href'),email.url,'email fallback preserves message');
  await page.locator('#project-name').fill('   ');
  await page.evaluate(()=>window.__opened=null);
  await page.locator('button[value="whatsapp"]').click();
  equal(await page.evaluate(()=>window.__opened),null,'blank-space name is rejected');
  if(width<=760){
   await page.locator('.menu-toggle').click();
   equal(await page.locator('#mobile-nav').isVisible(),true,'mobile menu opens');
   await page.keyboard.press('Escape');
   equal(await page.locator('#mobile-nav').isVisible(),false,'mobile menu closes with Escape');
   equal(await page.locator('.menu-toggle').evaluate(el=>el===document.activeElement),true,'mobile menu restores focus');
  }
  await page.locator('[data-open-legal]').click();
  equal(await page.locator('#legal-dialog').evaluate(el=>el.open),true,'legal dialog opens');
  await page.keyboard.press('Escape');
  equal(await page.locator('[data-open-legal]').evaluate(el=>el===document.activeElement),true,'legal focus restored');
  report.push({width,status:'passed',runtimeErrors:errors,httpFailures:failed});
  await page.close();
 }
 // Replacing images must update every placement and provisional disclosure.
 const config = await (await fetch(new URL('services.json', baseURL))).json();
 const replacement = {src:'assets/test-photo.png',alt:'Photographie réelle de test',width:1,height:1,provisional:false};
 const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1EAAAAASUVORK5CYII=', 'base64');
 for (const key of Object.keys(config.images)) config.images[key] = {...replacement};
 config.services.forEach(service => {service.photos = [{...replacement}];});
 const updated=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await updated.route('**/test-photo.png',route=>route.fulfill({contentType:'image/png',body:png}));
 await updated.route('**/services.json',route=>route.fulfill({json:config}));
 await updated.goto(baseURL,{waitUntil:'networkidle'});
 await settleImages(updated);
 equal(await updated.locator('.photo-card').count(),8,'replacement config loaded');
 for (const selector of ['[data-image="hero"]','[data-image="aboutMain"]','[data-image="aboutDetail"]','[data-portfolio-theme="mariage"] img','[data-portfolio-theme="bapteme"] img']) {
  equal(await updated.locator(selector).getAttribute('src'),'assets/test-photo.png','replacement placement '+selector);
  equal(await updated.locator(selector).getAttribute('srcset'),null,'old responsive variants removed');
 }
 equal(await updated.locator('[data-site-provisional]:visible').count(),0,'real photos hide overall provisional notes');
 equal(await updated.locator('[data-about-provisional]').isVisible(),false,'real portraits hide note');
 equal(await updated.locator('[data-portfolio-provisional]').isVisible(),false,'real portfolio hides note');
 await updated.locator('[data-photo-index="0"]').click();
 equal(await updated.locator('[data-photo-provisional]').isVisible(),false,'real photo hides lightbox note');
 await updated.close();
 // Malformed configuration must leave the synchronized snapshot usable.
 const invalid=await browser.newPage({reducedMotion:'reduce'});
 await invalid.route('**/services.json',route=>route.fulfill({json:{...config,images:{...config.images,hero:{...replacement,src:'https://example.com/photo.png'}}}}));
 await invalid.goto(baseURL,{waitUntil:'networkidle'});
 equal(await invalid.locator('.photo-card').count(),16,'invalid external asset rejected with snapshot fallback');
 await invalid.close();
 const fallback=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await fallback.route('**/services.json',route=>route.abort());
 await fallback.goto(baseURL,{waitUntil:'networkidle'});
 equal(await fallback.locator('.photo-card').count(),16,'gallery fallback works without JSON');
 equal(await fallback.locator('.project-theme').count(),8,'form themes fallback');
 await fallback.close();
 const noScript=await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844}});
 await noScript.goto(baseURL,{waitUntil:'networkidle'});
 equal(await noScript.locator('h1').isVisible(),true,'no-JavaScript heading visible');
 ok(await noScript.locator('a[href="mailto:liapellegrin22@gmail.com"]').count()>0,'no-JavaScript email link');
 equal(await noScript.locator('[data-portfolio-theme]').count(),2,'no-JavaScript featured photos');
 await noScript.close();
 const animated=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
 await animated.goto(baseURL,{waitUntil:'networkidle'});
 await animated.locator('#hero-title').scrollIntoViewIfNeeded();
 await animated.waitForTimeout(2000);
 equal(await animated.locator('#hero-title').evaluate(el=>getComputedStyle(el).opacity),'1','heading reveal completes');
 ok(await animated.locator('.word-inner').count()>5,'title word animation active');
 await animated.locator('.hero-introduction').screenshot({path:'qa/1440-introduction-motion.png'});
 await animated.emulateMedia({reducedMotion:'reduce'});
 equal(await animated.locator('html').evaluate(el=>el.classList.contains('motion-ready')),false,'live reduced-motion switch');
 await animated.close();
 console.log(JSON.stringify({checks,viewports:report,status:'passed'},null,2));
 await writeFile('qa/verification.json',JSON.stringify({checks,viewports:report,status:'passed'},null,2)+'\n');
}finally{await browser.close();}

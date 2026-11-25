import {whenMoving} from './runtime.js';
let libraries;
function loadScript(file) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/vendor/' + file + '.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.append(script);
  });
}
whenMoving(async signal => {
  libraries ??= loadScript('gsap').then(() => Promise.all(['ScrollTrigger','SplitText','lenis'].map(loadScript)));
  await libraries;
  if (signal.aborted) return;
  const {gsap, ScrollTrigger, SplitText, Lenis} = window;
  gsap.registerPlugin(ScrollTrigger, SplitText);
  const home = window.MadameLia.home;
  const lenis = new Lenis({syncTouch:false, smoothWheel:true, anchors:false});
  const tick = seconds => lenis.raf(seconds * 1000);
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(tick);
  lenis.on('scroll', ScrollTrigger.update);
  const lock = () => {
    if (document.body.matches('.dialog-open,.menu-open')) lenis.stop();
    else lenis.start();
  };
  const observer = new MutationObserver(lock);
  observer.observe(document.body,{attributes:true, attributeFilter:['class']});
  lock();
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href*="#"]');
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const target = document.getElementById(url.hash.slice(1));
    if (!target) return;
    event.preventDefault();
    if (url.hash !== location.hash) history.pushState(null,'',url.hash);
    lenis.scrollTo(target,{offset:-document.querySelector('.site-header').offsetHeight,force:true});
  },{signal});
  const splits = [];
  const context = gsap.context(() => {
    document.querySelectorAll('h2.display').forEach(title => {
      splits.push(SplitText.create(title,{type:'lines',mask:'lines',autoSplit:true,
        onSplit: split => gsap.from(split.lines,{yPercent:103, duration:1.05,stagger:.09,ease:'power3.out',
          scrollTrigger:{trigger:title,start:'top 96%',once:true}})
      }));
    });
    document.querySelectorAll('.about-main,.about-detail,#portfolio-grid .frame:nth-child(-n+6) button,.theme-thumb').forEach(node => {
      const trigger = {trigger:node,start:'top 98%',once:true};
      gsap.from(node,{clipPath:'inset(0 0 100% 0)',duration:1.12,ease:'power3.out',scrollTrigger:trigger});
      const image = node.querySelector('img');
      if (image) gsap.from(image,{scale:1.18,duration:1.3,ease:'power3.out',scrollTrigger:{...trigger}});
    });
    for (const [selector, shift] of [['.about-detail',-6],['#contact-title',-8],['.band-track',-3]]) {
      const node = document.querySelector(selector);
      if (node) gsap.to(node,{[selector === '.band-track'?'xPercent':'yPercent']:shift,
        ease:'none',scrollTrigger:{trigger:node.parentElement,start:'top bottom',end:'bottom top',scrub:.6}});
    }
  });
  let timer;
  const decay = home && gsap.quickTo(home.reel,'boost',{duration:.65,ease:'power2.out'});
  lenis.on('scroll', () => {
    if (!decay) return;
    decay(1 + Math.min(6,Math.abs(lenis.velocity)*.09));
    clearTimeout(timer);
    timer = setTimeout(() => decay(1),80);
  });
  document.fonts.ready.then(() => { if (!signal.aborted) ScrollTrigger.refresh(); });
  signal.addEventListener('abort',() => {
    clearTimeout(timer);
    decay?.tween.kill();
    if (home) home.reel.boost = 1;
    observer.disconnect(); gsap.ticker.remove(tick); lenis.destroy(); context.revert();
    splits.forEach(split => split.revert());
  },{once:true});
});

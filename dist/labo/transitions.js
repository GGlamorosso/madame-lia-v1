import {whenMoving} from './runtime.js';

function intro(signal,home){
  if(location.hash || scrollY>10) return;
  try {
    if(sessionStorage.getItem('lia-deal-seen')) return;
    sessionStorage.setItem('lia-deal-seen','1');
  } catch {return;}
  const hero=document.querySelector('.hero-frame');
  const photos=home.selection().slice(0,4);
  if(!hero || !photos.length)return;
  const panel=document.createElement('div');panel.className='contact-deal';panel.setAttribute('aria-hidden','true');
  const counter=document.createElement('span');panel.append(counter);
  document.body.append(panel);
  const rect=hero.getBoundingClientRect();
  const deltaX=rect.left+rect.width/2-innerWidth/2,deltaY=rect.top+rect.height/2-innerHeight/2;
  for(const [i,p] of photos.reverse().entries()){
    const img=new Image();img.src=p.srcset?.split(',')[0].trim().split(' ')[0]||p.src;
    img.alt='';panel.append(img);
    const angle=(i%2?1:-1)*(9-i);
    const rest='translate(-50%,-50%) rotate('+angle+'deg)';
    img.animate([
      {transform:'translate(-50%,90vh) rotate('+(-angle*3)+'deg)',offset:0},
      {transform:rest,offset:.32},{transform:rest,offset:.64},
      {transform:'translate(-50%,-50%) translate('+deltaX+'px,'+deltaY+'px) scale('+rect.width/img.offsetWidth+')',offset:1}
    ],{delay:i*50,duration:1000,fill:'both',easing:'cubic-bezier(.22,.74,.18,1)'});
  }
  panel.animate([{opacity:1},{opacity:1,offset:.78},{opacity:0}],{duration:1300,fill:'both'});
  const controller=new AbortController();
  let frame;const start=performance.now();
  function stop(){cancelAnimationFrame(frame);controller.abort();panel.remove();}
  for(const event of ['pointerdown','wheel','touchstart','keydown','scroll']) addEventListener(event,stop,{signal:controller.signal,passive:true});
  signal.addEventListener('abort',stop,{once:true});
  function count(t){
    counter.textContent=String(Math.min(100,Math.round((t-start)/10))).padStart(2,'0');
    if(t-start<1300) frame=requestAnimationFrame(count);else stop();
  }
  frame=requestAnimationFrame(count);
}

function servicePreviews(signal){
  const list=document.querySelector('#theme-list');
  if(!list)return;
  const rows=[...list.querySelectorAll('.theme-row:has(img)')];
  if(!matchMedia('(hover:hover) and (min-width:900px)').matches){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('is-centered',entry.isIntersecting)),{rootMargin:'-41% 0px -41% 0px'});
    rows.forEach(row=>observer.observe(row));
    signal.addEventListener('abort',()=>{observer.disconnect();rows.forEach(row=>row.classList.remove('is-centered'));});
    return;
  }
  const preview=document.createElement('div');preview.className='service-preview';preview.setAttribute('aria-hidden','true');
  const layers=[new Image(),new Image()]; preview.append(...layers);document.body.append(preview);
  let current,top=0,targetX=0,targetY=0,x=0,y=0,id;
  function move(){
    const dx=targetX-x,dy=targetY-y;x+=dx*.2;y+=dy*.2;
    preview.style.transform='translate3d('+x+'px,'+y+'px,0) rotate('+Math.max(-5,Math.min(5,dx*.06))+'deg)';
    id=(Math.abs(dx)+Math.abs(dy)>.3)?requestAnimationFrame(move):null;
  }
  function hide(){current=null;preview.classList.remove('is-open');}
  list.addEventListener('pointermove',e=>{
    const row=e.target.closest('.theme-row'),thumb=row?.querySelector('.theme-thumb');
    if(!thumb){hide();return;}
    targetX=Math.max(8,Math.min(innerWidth-preview.offsetWidth-8,e.clientX+24));
    targetY=Math.max(8,Math.min(innerHeight-preview.offsetHeight-8,e.clientY-preview.offsetHeight*.46));
    if(!current){x=targetX;y=targetY;}
    if(current!==row){
      current=row;layers[top].classList.remove('is-current'); top=1-top;
      layers[top].src=thumb.currentSrc||thumb.src; layers[top].classList.add('is-current');preview.classList.add('is-open');
    }
    if(!id) move();
  },{signal});
  list.addEventListener('pointerleave',hide,{signal});
  signal.addEventListener('abort',()=>{cancelAnimationFrame(id);preview.remove();});
}
function photoMorph(signal,home){
  if(!document.startViewTransition)return;
  const lightbox=document.querySelector('#lightbox'),large=document.querySelector('#lightbox-image');
  let active=false;
  document.addEventListener('click',e=>{
    const button=e.target.closest('[data-photo-index],[data-select-index]');
    if(!button || active || lightbox.open)return;
    const small=button.querySelector('img');
    const reel=button.hasAttribute('data-select-index');
    const filter=document.querySelector('#portfolio-filters [aria-pressed=true]')?.dataset.filter;
    const photos=reel?home.selection():home.photos().filter(p=>!filter || filter==='all' || p.serviceId===filter);
    const index=Number(reel?button.dataset.selectIndex:button.dataset.photoIndex);
    if(!photos[index]) return;
    e.stopPropagation();
    active=true;document.documentElement.dataset.morph='';small.style.viewTransitionName='photo';
    const transition=document.startViewTransition(()=>{
      small.style.viewTransitionName='';large.style.viewTransitionName='photo';
      home.openLightbox(photos,index,button);
    });
    transition.finished.finally(()=>{
      active=false;delete document.documentElement.dataset.morph;small.style.viewTransitionName='';large.style.viewTransitionName='';
    }).catch(()=>{});
  },{signal,capture:true});
}
whenMoving(signal=>{
  const home=window.MadameLia.home;
  if(!home)return;
  intro(signal,home);servicePreviews(signal);photoMorph(signal,home);
});

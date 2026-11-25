import {whenMoving} from './runtime.js';

const vertex = 'attribute vec2 a; void main(){gl_Position=vec4(a,0.,1.);}';
const fragment = `
precision mediump float;
uniform vec2 size, pointer;
uniform float t, speed, power;
float halo(vec2 p,vec2 center){vec2 d=(p-center)*vec2(1.,1.35);return exp(-6.*dot(d,d));}
void main(){
  vec2 uv=gl_FragCoord.xy/size;
  vec2 follow=(pointer-.5)*.09;
  float olive=halo(uv,vec2(.05+.13*sin(t*.19),.77+.10*cos(t*.21))+follow);
  float rust=halo(uv,vec2(.98+.1*cos(t*.16),.19+.10*sin(t*.23))-follow);
  float grain=fract(sin(dot(mod(gl_FragCoord.xy,83.),vec2(.32,1.71))+floor(t*5.))*178.13);
  vec3 paper=mix(vec3(1.),vec3(.31,.36,.15),olive*power);
  paper=mix(paper,vec3(.69,.31,.17),rust*power*(.82+.18*speed));
  gl_FragColor=vec4(paper-(grain*.009),1.);
}`;
function startPaper(signal, point) {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,powerPreference:'low-power'});
  if (!gl) return;
  const program = gl.createProgram();
  for (const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader,source); gl.compileShader(shader); gl.attachShader(program,shader); gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) { gl.deleteProgram(program); return; }
  canvas.className='darkroom-paper'; canvas.setAttribute('aria-hidden','true'); document.body.prepend(canvas);
  gl.useProgram(program);
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const a=gl.getAttribLocation(program,'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
  const uniform=name=>gl.getUniformLocation(program,name);
  const u={size:uniform('size'),pointer:uniform('pointer'),t:uniform('t'),speed:uniform('speed')};
  gl.uniform1f(uniform('power'),new URLSearchParams(location.search).get('intensite')==='2'?.098:.07);
  const resize=()=>{
    const ratio=Math.min(devicePixelRatio,innerWidth<700?.7:1.2);
    canvas.width=Math.round(innerWidth*ratio); canvas.height=Math.round(innerHeight*ratio);
    gl.viewport(0,0,canvas.width,canvas.height); gl.uniform2f(u.size,canvas.width,canvas.height);
  };
  resize(); addEventListener('resize',resize,{signal});
  let id,last=-Infinity,y=scrollY,velocity=0,px=.5,py=.5;
  function draw(time) {
    id=requestAnimationFrame(draw);
    if(time-last<32) return;
    last=time;
    px+=(point.x/innerWidth-px)*.09; py+=(1-point.y/innerHeight-py)*.09;
    velocity=Math.max(velocity*.87,Math.min(1,Math.abs(scrollY-y)/70)); y=scrollY;
    gl.uniform2f(u.pointer,px,py); gl.uniform1f(u.t,(time*.001)%5400); gl.uniform1f(u.speed,velocity);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  const resume=()=>{cancelAnimationFrame(id); if(!document.hidden) id=requestAnimationFrame(draw);};
  resume(); document.addEventListener('visibilitychange',resume,{signal});
  signal.addEventListener('abort',()=>{
    cancelAnimationFrame(id); canvas.remove(); gl.deleteBuffer(buffer); gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  });
}
whenMoving(signal=>{
  const point={x:innerWidth/2,y:innerHeight/2};
  startPaper(signal,point);
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const ring=document.createElement('span'), dot=document.createElement('span');
  ring.className='darkroom-ring'; dot.className='darkroom-dot';
  for(const el of [ring,dot]) {el.setAttribute('aria-hidden','true');document.body.append(el);}
  let id,x=point.x,y=point.y;
  function track(){
    x+=(point.x-x)*.22; y+=(point.y-y)*.22;
    ring.style.transform='translate('+x+'px,'+y+'px)';
    id=Math.abs(point.x-x)+Math.abs(point.y-y)>.3?requestAnimationFrame(track):null;
  }
  document.addEventListener('pointermove',event=>{
    point.x=event.clientX; point.y=event.clientY;
    if(event.pointerType!=='mouse') return;
    const target=event.target;
    const label=target.closest('.strip-item')?'Glisser':target.closest('.frame-btn')?'Voir':target.closest('.header-cta,.btn-primary[href*="wa.me"]')?'Réserver':'';
    if(label!==ring.dataset.label){ring.textContent=label;ring.dataset.label=label;}
    dot.style.transform='translate('+point.x+'px,'+point.y+'px)';
    document.body.classList.toggle('darkroom-pointing',!target.closest('dialog,input,textarea'));
    if(!id) track();
  },{signal});
  const hide=()=>document.body.classList.remove('darkroom-pointing');
  document.documentElement.addEventListener('pointerleave',hide,{signal});
  document.addEventListener('keydown',hide,{signal});
  signal.addEventListener('abort',()=>{cancelAnimationFrame(id);ring.remove();dot.remove();hide();});
});

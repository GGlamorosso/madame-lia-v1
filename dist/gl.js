// Scène WebGL de liashoots : tirage en perspective dans la section de contact, sans loupe ni filtre.
// Écrit sans dépendance. Tout ici est décoratif : si quoi que ce soit échoue,
// les images HTML restent affichées telles quelles.

const PLANE_VERT = `
attribute vec2 a_pos;
uniform mat4 u_proj;
uniform vec3 u_center;
uniform vec2 u_size;
uniform vec2 u_rot;
varying vec2 v_uv;
void main() {
  v_uv = a_pos + 0.5;
  vec3 p = vec3(a_pos * u_size, 0.0);
  float cy = cos(u_rot.x), sy = sin(u_rot.x);
  p = vec3(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
  float cx = cos(u_rot.y), sx = sin(u_rot.y);
  p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
  gl_Position = u_proj * vec4(p + u_center, 1.0);
}`;

const PLANE_FRAG = `
precision mediump float;
uniform sampler2D u_tex;
uniform float u_alpha;
uniform float u_fade;
uniform vec3 u_paper;
uniform vec2 u_uvScale;
varying vec2 v_uv;
void main() {
  vec2 uv = (v_uv - 0.5) * u_uvScale + 0.5;
  gl_FragColor = vec4(mix(u_paper, texture2D(u_tex, uv).rgb, u_alpha * u_fade), 1.0);
}`;

// Couleur du papier lue dans la palette CSS (--paper) : la scène se fond dans la page.
function paperColor() {
  let hex = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim().replace('#', '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.replace(/./g, '$&$&');
  return /^[0-9a-f]{6}$/i.test(hex) ? hex.match(/../g).map(part => parseInt(part, 16) / 255) : [1, 1, 1];
}
const PAPER = paperColor();

function compile(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'shader');
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'a_pos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'program');
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < count; index++) {
    const { name } = gl.getActiveUniform(program, index);
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
}

function loadImage(source) {
  if (source instanceof HTMLImageElement) {
    return source.decode().catch(() => {}).then(() => {
      if (!source.naturalWidth) throw new Error('image');
      return source;
    });
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function createTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, aspect: image.naturalWidth / image.naturalHeight };
}

// Caméra en perspective calée pour qu'un pixel CSS à z = 0 vaille un pixel à l'écran :
// les plans peuvent ainsi se superposer exactement aux éléments HTML.
function projection(width, height, cameraX, cameraY) {
  const fov = 0.62;
  const distance = height / (2 * Math.tan(fov / 2));
  const f = 1 / Math.tan(fov / 2);
  const near = distance * 0.1, far = distance * 4;
  const a = f / (width / height), c = (far + near) / (near - far), d = (2 * far * near) / (near - far);
  // perspective × translation(-cameraX, -cameraY, -distance), en colonnes.
  return new Float32Array([
    a, 0, 0, 0,
    0, f, 0, 0,
    0, 0, c, -1,
    -a * cameraX, -f * cameraY, -c * distance + d, distance
  ]);
}

function createStage({ canvas, section, layout, reducedMotion }) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true, powerPreference: 'high-performance' });
  if (!gl) throw new Error('webgl');
  const plane = compile(gl, PLANE_VERT, PLANE_FRAG);
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.disable(gl.DEPTH_TEST);

  let width = 0, height = 0, running = false, frame = 0, visible = false, alive = true;
  let born = 0;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  function resize() {
    const box = canvas.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, box.width < 700 ? 1.5 : 1.75);
    width = box.width; height = box.height;
    const nextWidth = Math.max(2, Math.round(box.width * ratio));
    const nextHeight = Math.max(2, Math.round(box.height * ratio));
    if (nextWidth !== canvas.width || nextHeight !== canvas.height) { canvas.width = nextWidth; canvas.height = nextHeight; }
  }

  function point(clientX, clientY) {
    const box = canvas.getBoundingClientRect();
    pointer.tx = (clientX - box.left) / box.width * 2 - 1;
    pointer.ty = 1 - (clientY - box.top) / box.height * 2;
  }
  const onPointer = event => { if (event.pointerType !== 'touch') point(event.clientX, event.clientY); };
  const onTouch = event => { if (event.touches[0]) point(event.touches[0].clientX, event.touches[0].clientY); };
  section.addEventListener('pointermove', onPointer, { passive: true });
  section.addEventListener('touchstart', onTouch, { passive: true });
  section.addEventListener('touchmove', onTouch, { passive: true });
  // Inclinaison du téléphone, uniquement là où le navigateur la fournit sans demande d'autorisation.
  const tilt = { x: 0, y: 0 };
  const onTilt = event => {
    if (event.gamma == null) return;
    tilt.x = Math.max(-1, Math.min(1, event.gamma / 28));
    tilt.y = Math.max(-1, Math.min(1, (event.beta - 45) / 28));
  };
  if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') addEventListener('deviceorientation', onTilt, { passive: true });

  function render(now) {
    frame = 0;
    if (!running) return;
    if (!born) born = now;
    const time = (now - born) / 1000;
    resize();
    const box = canvas.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, -box.top / Math.max(1, box.height)));
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    const swayX = pointer.x * 0.6 + tilt.x * 0.5 + Math.sin(time * 0.31) * 0.12;
    const swayY = pointer.y * 0.6 - tilt.y * 0.4 + Math.cos(time * 0.27) * 0.10;
    const planes = layout({ width, height, time, progress, canvasBox: box });

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(...PAPER, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(plane.program);
    gl.uniformMatrix4fv(plane.uniforms.u_proj, false, projection(width, height, swayX * width * 0.035, swayY * height * 0.03));
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(plane.uniforms.u_tex, 0);
    gl.uniform3fv(plane.uniforms.u_paper, PAPER);
    // Le fondu vers le papier accompagne le défilement, sans teinte ajoutée.
    gl.uniform1f(plane.uniforms.u_fade, 1 - progress * 0.75);
    planes.sort((first, second) => first.z - second.z).forEach(item => {
      gl.bindTexture(gl.TEXTURE_2D, item.texture);
      gl.uniform3f(plane.uniforms.u_center, item.x, item.y, item.z);
      gl.uniform2f(plane.uniforms.u_size, item.w, item.h);
      gl.uniform2f(plane.uniforms.u_rot, (item.rotY || 0) + swayX * 0.10 * (item.sway ?? 1), (item.rotX || 0) - swayY * 0.07 * (item.sway ?? 1));
      gl.uniform2f(plane.uniforms.u_uvScale, item.uvX || 1, item.uvY || 1);
      gl.uniform1f(plane.uniforms.u_alpha, item.alpha ?? 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    });

    if (!canvas.classList.contains('is-live')) canvas.classList.add('is-live');
    frame = requestAnimationFrame(render);
  }

  function update() {
    const shouldRun = alive && visible && !document.hidden && !reducedMotion.matches;
    if (reducedMotion.matches) canvas.classList.remove('is-live');
    if (shouldRun === running) return;
    running = shouldRun;
    if (running && !frame) frame = requestAnimationFrame(render);
    if (!running && reducedMotion.matches) canvas.classList.remove('is-live');
  }
  const observer = new IntersectionObserver(entries => { visible = entries.at(-1).isIntersecting; update(); });
  observer.observe(section);
  document.addEventListener('visibilitychange', update);
  reducedMotion.addEventListener('change', update);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    alive = false; update();
    canvas.classList.remove('is-live');
  });
  return { gl };
}

async function startClosing({ canvas, section, src, reducedMotion }) {
  const image = await loadImage(src);
  let photo;
  const stage = createStage({
    canvas, section, reducedMotion,
    layout({ width, height, time, progress }) {
      const cover = Math.max(width / photo.aspect, height) * 1.08;
      return [{ texture: photo.texture, x: 0, y: -progress * height * 0.08 + Math.sin(time * 0.2) * 6, z: 0, w: cover * photo.aspect, h: cover, sway: 0.5 }];
    }
  });
  photo = createTexture(stage.gl, image);
}

export function start({ closing, reducedMotion }) {
  const guard = promise => promise.catch(() => { /* scène ignorée : l'image fixe reste visible */ });
  // La scène n'est préparée qu'à l'approche de la section.
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    guard(startClosing({ ...closing, reducedMotion }));
  }, { rootMargin: '600px 0px' });
  observer.observe(closing.section);
}

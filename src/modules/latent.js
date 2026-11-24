// LATENT — the signature hero.
// The portrait is shown as an undeveloped colour negative. The visitor's cursor (or finger)
// is the developer: a fluid trail, rendered into a ping-pong framebuffer, reveals the positive
// with an organic chemical edge. Scrolling develops the whole frame.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const TRAIL = `
precision highp float;
uniform sampler2D uPrev;
uniform vec2 uA; uniform vec2 uB;
uniform float uRadius; uniform float uStrength; uniform float uAspect; uniform float uDecay;
varying vec2 vUv;
float seg(vec2 p, vec2 a, vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.); return length(pa-ba*h); }
void main(){
  float prev = texture2D(uPrev, vUv).r;
  vec2 asp = vec2(uAspect, 1.0);
  float d = seg(vUv*asp, uA*asp, uB*asp);
  float brush = smoothstep(uRadius, uRadius*0.15, d) * uStrength;
  float v = max(prev - uDecay, 0.0) + brush;
  gl_FragColor = vec4(min(v, 1.0), 0.0, 0.0, 1.0);
}`;

const COMP = `
precision highp float;
uniform sampler2D uImage; uniform sampler2D uTrail;
uniform vec2 uRes; uniform vec2 uImgRes;
uniform float uTime; uniform float uDevelop; uniform float uIntro; uniform float uVel;
uniform vec2 uMouse;
varying vec2 vUv;

float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }

vec2 cover(vec2 uv){
  float ra = uRes.x/uRes.y, ia = uImgRes.x/uImgRes.y;
  vec2 s = ra > ia ? vec2(1.0, ia/ra) : vec2(ra/ia, 1.0);
  vec2 focus = vec2(0.5, 0.70);              // keep the face in frame (y is flipped)
  vec2 c = clamp(focus, s*0.5, 1.0 - s*0.5);
  return (uv - 0.5) * s + c;
}

void main(){
  float aspect = uRes.x/uRes.y;
  vec2 p = vUv * vec2(aspect, 1.0);
  float n = fbm(p*2.6 + vec2(uTime*0.035, -uTime*0.02));
  float trail = texture2D(uTrail, vUv).r;

  // global development blooms from the centre of the frame
  float dc = length((vUv - vec2(0.5, 0.55)) * vec2(aspect, 1.0));
  float g = uDevelop * 2.0 - dc * 0.9 - 0.15;

  float m = clamp(trail * 1.25 + g, 0.0, 1.6);
  float field = m + (n - 0.5) * 0.55;
  float mask = smoothstep(0.42, 0.62, field);
  float band = clamp(smoothstep(0.18, 0.45, field) - mask, 0.0, 1.0);

  // liquid refraction along the developing edge
  vec2 uvBase = vUv + band * (vec2(n, fbm(p*3.1+7.0)) - 0.5) * 0.028;
  vec2 uv = cover(uvBase);
  uv = (uv - 0.5) / (1.0 + 0.04 * (1.0 - uIntro)) + 0.5;

  // chromatic split driven by pointer speed
  vec2 dir = (vUv - uMouse) * (0.004 + uVel * 0.03);
  vec3 col;
  col.r = texture2D(uImage, uv + dir).r;
  col.g = texture2D(uImage, uv).g;
  col.b = texture2D(uImage, uv - dir).b;

  // positive: warm, filmic
  vec3 pos = col;
  pos = mix(vec3(dot(pos, vec3(.299,.587,.114))), pos, 0.92);
  pos = pos * vec3(1.05, 1.0, 0.93);
  pos = smoothstep(-0.03, 1.02, pos);

  // negative: inverted with the orange base of C-41 film
  vec3 neg = 1.0 - col;
  neg = neg * vec3(0.92, 0.6, 0.36) + vec3(0.10, 0.04, 0.0);
  neg = mix(neg, vec3(dot(neg, vec3(.333))), 0.15) * 0.82;

  vec3 c = mix(neg, pos, mask);
  // developer glow along the reaction edge
  c += band * vec3(1.0, 0.58, 0.18) * 0.55;
  c += band * band * vec3(1.0, 0.85, 0.6) * 0.25;

  // vignette + intro exposure
  float vig = smoothstep(1.25, 0.25, length((vUv - 0.5) * vec2(1.15, 1.0)));
  c *= mix(0.5, 1.0, vig);
  c *= uIntro;

  // grain
  float gr = hash(vUv * uRes + fract(uTime * 7.0) * 311.0) - 0.5;
  c += gr * 0.07;
  gl_FragColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
  return { p, u };
}

export function createLatent(canvas, src) {
  let gl;
  try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); } catch (e) { gl = null; }
  if (!gl) return null;

  let trailP, compP;
  try { trailP = program(gl, TRAIL); compP = program(gl, COMP); } catch (e) { console.warn(e); return null; }

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const makeTex = (w, h, data = null) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return t;
  };

  // ping-pong trail buffers
  let fbos = [];
  let tw = 0, th = 0;
  const makeFbos = () => {
    fbos.forEach((f) => { gl.deleteFramebuffer(f.fb); gl.deleteTexture(f.tex); });
    tw = Math.max(128, Math.round(canvas.width / 4));
    th = Math.max(128, Math.round(canvas.height / 4));
    fbos = [0, 1].map(() => {
      const tex = makeTex(tw, th);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb };
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  const img = { tex: makeTex(1, 1, new Uint8Array([20, 16, 14, 255])), w: 2, h: 3, ready: false };

  const state = {
    develop: 0, intro: 0, time: 0,
    mouse: { x: 0.5, y: 0.6 }, prev: { x: 0.5, y: 0.6 }, target: { x: 0.5, y: 0.6 },
    vel: 0, strength: 0, lastMove: 0, interacted: false, running: false,
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 768 ? 1.25 : 1.5);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w === canvas.width && h === canvas.height && fbos.length) return;
    canvas.width = w; canvas.height = h;
    makeFbos();
  };

  const loaded = new Promise((resolve) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, img.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      img.w = im.naturalWidth; img.h = im.naturalHeight; img.ready = true;
      resolve();
    };
    im.onerror = resolve;
    im.src = src;
  });

  // ---------- input ----------
  const setPointer = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    state.target.x = (cx - r.left) / r.width;
    state.target.y = 1 - (cy - r.top) / r.height;
    state.lastMove = performance.now();
    if (!state.interacted) { state.interacted = true; state.mouse.x = state.prev.x = state.target.x; state.mouse.y = state.prev.y = state.target.y; }
  };
  const onMove = (e) => setPointer(e.clientX, e.clientY);
  const onTouch = (e) => { const t = e.touches[0]; if (t) setPointer(t.clientX, t.clientY); };
  const host = canvas.parentElement;
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('touchstart', onTouch, { passive: true });
  host.addEventListener('touchmove', onTouch, { passive: true });

  // ---------- frame ----------
  let ping = 0;
  function frame(dtMs) {
    const dt = Math.min(dtMs / 16.67, 3);
    state.time += dtMs / 1000;
    const now = performance.now();
    const idle = now - state.lastMove > 2600;

    // a "ghost" brush wanders when the visitor is idle — the image breathes on its own
    if (idle) {
      const t = state.time * 0.35;
      state.target.x = 0.5 + Math.sin(t * 1.3) * 0.28 + Math.sin(t * 0.7) * 0.08;
      state.target.y = 0.55 + Math.cos(t * 0.9) * 0.22;
    }
    state.prev.x = state.mouse.x; state.prev.y = state.mouse.y;
    const ease = idle ? 0.04 : 0.22;
    state.mouse.x += (state.target.x - state.mouse.x) * ease * dt;
    state.mouse.y += (state.target.y - state.mouse.y) * ease * dt;
    const speed = Math.hypot(state.mouse.x - state.prev.x, state.mouse.y - state.prev.y);
    state.vel += (Math.min(speed * 18, 1) - state.vel) * 0.12 * dt;
    const targetStrength = idle ? 0.06 : 0.14 + Math.min(speed * 30, 0.5);
    state.strength += (targetStrength - state.strength) * 0.2 * dt;

    // trail pass
    const src = fbos[ping], dst = fbos[1 - ping];
    gl.useProgram(trailP.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
    gl.viewport(0, 0, tw, th);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(trailP.u.uPrev, 0);
    gl.uniform2f(trailP.u.uA, state.prev.x, state.prev.y);
    gl.uniform2f(trailP.u.uB, state.mouse.x, state.mouse.y);
    const small = canvas.clientWidth < 768;
    gl.uniform1f(trailP.u.uRadius, (small ? 0.17 : 0.12) * (1 + state.vel * 0.6));
    gl.uniform1f(trailP.u.uStrength, state.strength * dt);
    gl.uniform1f(trailP.u.uAspect, canvas.width / canvas.height);
    gl.uniform1f(trailP.u.uDecay, (idle ? 2.2 : 1.4) / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ping = 1 - ping;

    // composite pass
    gl.useProgram(compP.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, img.tex);
    gl.uniform1i(compP.u.uImage, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fbos[ping].tex);
    gl.uniform1i(compP.u.uTrail, 1);
    gl.uniform2f(compP.u.uRes, canvas.width, canvas.height);
    gl.uniform2f(compP.u.uImgRes, img.w, img.h);
    gl.uniform1f(compP.u.uTime, state.time);
    gl.uniform1f(compP.u.uDevelop, state.develop);
    gl.uniform1f(compP.u.uIntro, state.intro);
    gl.uniform1f(compP.u.uVel, state.vel);
    gl.uniform2f(compP.u.uMouse, state.mouse.x, state.mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    state, loaded, frame, resize,
    /** normalised pointer (0..1, y down) for HUD readouts */
    get pointer() { return { x: state.mouse.x, y: 1 - state.mouse.y }; },
  };
}

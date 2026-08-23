/* ==========================================================================
   PixelBlast — vanilla port of the React Bits component
   https://reactbits.dev  ·  shader inspired by
   github.com/zavalit/bayer-dithering-webgl-demo

   The original ships as React + three + postprocessing. This site has no
   build step, so the React wrapper is replaced by a plain init function and
   the liquid pass is done with a render target instead of the
   postprocessing library. The shaders are unchanged.
   ========================================================================== */

import * as THREE from 'https://unpkg.com/three@0.169.0/build/three.module.js';

const SHAPE_MAP = { square: 0, circle: 1, triangle: 2, diamond: 3 };
const MAX_CLICKS = 10;

const VERTEX_SRC = `
void main() {
  gl_Position = vec4(position, 1.0);
}
`;

const FRAGMENT_SRC = `
precision highp float;

uniform vec3  uColor;
uniform vec2  uResolution;
uniform float uTime;
uniform float uPixelSize;
uniform float uScale;
uniform float uDensity;
uniform float uPixelJitter;
uniform int   uEnableRipples;
uniform float uRippleSpeed;
uniform float uRippleThickness;
uniform float uRippleIntensity;
uniform float uEdgeFade;

uniform int   uShapeType;
const int SHAPE_SQUARE   = 0;
const int SHAPE_CIRCLE   = 1;
const int SHAPE_TRIANGLE = 2;
const int SHAPE_DIAMOND  = 3;

const int   MAX_CLICKS = 10;

uniform vec2  uClickPos  [MAX_CLICKS];
uniform float uClickTimes[MAX_CLICKS];

out vec4 fragColor;

float Bayer2(vec2 a) {
  a = floor(a);
  return fract(a.x / 2. + a.y * a.y * .75);
}
#define Bayer4(a) (Bayer2(.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a) (Bayer4(.5*(a))*0.25 + Bayer2(a))

#define FBM_OCTAVES     5
#define FBM_LACUNARITY  1.25
#define FBM_GAIN        1.0

float hash11(float n){ return fract(sin(n)*43758.5453); }

float vnoise(vec3 p){
  vec3 ip = floor(p);
  vec3 fp = fract(p);
  float n000 = hash11(dot(ip + vec3(0.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n100 = hash11(dot(ip + vec3(1.0,0.0,0.0), vec3(1.0,57.0,113.0)));
  float n010 = hash11(dot(ip + vec3(0.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n110 = hash11(dot(ip + vec3(1.0,1.0,0.0), vec3(1.0,57.0,113.0)));
  float n001 = hash11(dot(ip + vec3(0.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n101 = hash11(dot(ip + vec3(1.0,0.0,1.0), vec3(1.0,57.0,113.0)));
  float n011 = hash11(dot(ip + vec3(0.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  float n111 = hash11(dot(ip + vec3(1.0,1.0,1.0), vec3(1.0,57.0,113.0)));
  vec3 w = fp*fp*fp*(fp*(fp*6.0-15.0)+10.0);
  float x00 = mix(n000, n100, w.x);
  float x10 = mix(n010, n110, w.x);
  float x01 = mix(n001, n101, w.x);
  float x11 = mix(n011, n111, w.x);
  float y0  = mix(x00, x10, w.y);
  float y1  = mix(x01, x11, w.y);
  return mix(y0, y1, w.z) * 2.0 - 1.0;
}

float fbm2(vec2 uv, float t){
  vec3 p = vec3(uv * uScale, t);
  float amp = 1.0;
  float freq = 1.0;
  float sum = 1.0;
  for (int i = 0; i < FBM_OCTAVES; ++i){
    sum  += amp * vnoise(p * freq);
    freq *= FBM_LACUNARITY;
    amp  *= FBM_GAIN;
  }
  return sum * 0.5 + 0.5;
}

float maskCircle(vec2 p, float cov){
  float r = sqrt(cov) * .25;
  float d = length(p - 0.5) - r;
  float aa = 0.5 * fwidth(d);
  return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
}

float maskTriangle(vec2 p, vec2 id, float cov){
  bool flip = mod(id.x + id.y, 2.0) > 0.5;
  if (flip) p.x = 1.0 - p.x;
  float r = sqrt(cov);
  float d  = p.y - r*(1.0 - p.x);
  float aa = fwidth(d);
  return cov * clamp(0.5 - d/aa, 0.0, 1.0);
}

float maskDiamond(vec2 p, float cov){
  float r = sqrt(cov) * 0.564;
  return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
}

void main(){
  float pixelSize = uPixelSize;
  vec2 fragCoord = gl_FragCoord.xy - uResolution * .5;
  float aspectRatio = uResolution.x / uResolution.y;

  vec2 pixelId = floor(fragCoord / pixelSize);
  vec2 pixelUV = fract(fragCoord / pixelSize);

  float cellPixelSize = 8.0 * pixelSize;
  vec2 cellId = floor(fragCoord / cellPixelSize);
  vec2 cellCoord = cellId * cellPixelSize;
  vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);

  float base = fbm2(uv, uTime * 0.05);
  base = base * 0.5 - 0.65;

  float feed = base + (uDensity - 0.5) * 0.3;

  float speed     = uRippleSpeed;
  float thickness = uRippleThickness;
  const float dampT     = 1.0;
  const float dampR     = 10.0;

  if (uEnableRipples == 1) {
    for (int i = 0; i < MAX_CLICKS; ++i){
      vec2 pos = uClickPos[i];
      if (pos.x < 0.0) continue;
      float cellPixelSize = 8.0 * pixelSize;
      vec2 cuv = (((pos - uResolution * .5 - cellPixelSize * .5) / (uResolution))) * vec2(aspectRatio, 1.0);
      float t = max(uTime - uClickTimes[i], 0.0);
      float r = distance(uv, cuv);
      float waveR = speed * t;
      float ring  = exp(-pow((r - waveR) / thickness, 2.0));
      float atten = exp(-dampT * t) * exp(-dampR * r);
      feed = max(feed, ring * atten * uRippleIntensity);
    }
  }

  float bayer = Bayer8(fragCoord / uPixelSize) - 0.5;
  float bw = step(0.5, feed + bayer);

  float h = fract(sin(dot(floor(fragCoord / uPixelSize), vec2(127.1, 311.7))) * 43758.5453);
  float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
  float coverage = bw * jitterScale;
  float M;
  if      (uShapeType == SHAPE_CIRCLE)   M = maskCircle (pixelUV, coverage);
  else if (uShapeType == SHAPE_TRIANGLE) M = maskTriangle(pixelUV, pixelId, coverage);
  else if (uShapeType == SHAPE_DIAMOND)  M = maskDiamond(pixelUV, coverage);
  else                                   M = coverage;

  if (uEdgeFade > 0.0) {
    vec2 norm = gl_FragCoord.xy / uResolution;
    float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
    float fade = smoothstep(0.0, uEdgeFade, edge);
    M *= fade;
  }

  vec3 color = uColor;

  vec3 srgbColor = mix(
    color * 12.92,
    1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
    step(0.0031308, color)
  );

  fragColor = vec4(srgbColor, M);
}
`;

/* Liquid distortion pass. The React version uses postprocessing's Effect;
   this samples the rendered target directly so `three` is the only dep. */
const LIQUID_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

const LIQUID_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uTexture;
uniform float uStrength;
uniform float uTime;
uniform float uFreq;

void main() {
  vec2 uv = vUv;
  vec4 tex = texture2D(uTexture, uv);
  float vx = tex.r * 2.0 - 1.0;
  float vy = tex.g * 2.0 - 1.0;
  float intensity = tex.b;
  float wave = 0.5 + 0.5 * sin(uTime * uFreq + intensity * 6.2831853);
  uv += vec2(vx, vy) * (uStrength * intensity * wave);
  gl_FragColor = texture2D(uScene, uv);
}
`;

/* Pointer trail baked into a canvas texture, ported unchanged in spirit */
const createTouchTexture = () => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.Texture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const trail = [];
  const maxAge = 64;
  const speed = 1 / maxAge;
  let last = null;
  let radius = 0.1 * size;

  const drawPoint = (p) => {
    const pos = { x: p.x * size, y: (1 - p.y) * size };
    const easeOutSine = (t) => Math.sin((t * Math.PI) / 2);
    const easeOutQuad = (t) => -t * (t - 2);
    let intensity = p.age < maxAge * 0.3
      ? easeOutSine(p.age / (maxAge * 0.3))
      : easeOutQuad(1 - (p.age - maxAge * 0.3) / (maxAge * 0.7)) || 0;
    intensity *= p.force;
    const color = `${((p.vx + 1) / 2) * 255}, ${((p.vy + 1) / 2) * 255}, ${intensity * 255}`;
    const offset = size * 5;
    ctx.shadowOffsetX = offset;
    ctx.shadowOffsetY = offset;
    ctx.shadowBlur = radius;
    ctx.shadowColor = `rgba(${color},${0.22 * intensity})`;
    ctx.beginPath();
    ctx.fillStyle = 'rgba(255,0,0,1)';
    ctx.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2);
    ctx.fill();
  };

  return {
    texture,
    set radiusScale(v) { radius = 0.1 * size * v; },
    addTouch(norm) {
      let force = 0, vx = 0, vy = 0;
      if (last) {
        const dx = norm.x - last.x;
        const dy = norm.y - last.y;
        if (dx === 0 && dy === 0) return;
        const dd = dx * dx + dy * dy;
        const d = Math.sqrt(dd);
        vx = dx / (d || 1);
        vy = dy / (d || 1);
        force = Math.min(dd * 10000, 1);
      }
      last = { x: norm.x, y: norm.y };
      trail.push({ x: norm.x, y: norm.y, age: 0, force, vx, vy });
    },
    update() {
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, size, size);
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        const f = p.force * speed * (1 - p.age / maxAge);
        p.x += p.vx * f;
        p.y += p.vy * f;
        p.age++;
        if (p.age > maxAge) trail.splice(i, 1);
      }
      for (const p of trail) drawPoint(p);
      texture.needsUpdate = true;
    }
  };
};

export function initPixelBlast(container, options = {}) {
  const {
    variant = 'square',
    pixelSize = 3,
    color = '#B497CF',
    antialias = true,
    patternScale = 2,
    patternDensity = 1,
    liquid = false,
    liquidStrength = 0.1,
    liquidRadius = 1,
    liquidWobbleSpeed = 4.5,
    pixelSizeJitter = 0,
    enableRipples = true,
    rippleIntensityScale = 1,
    rippleThickness = 0.1,
    rippleSpeed = 0.3,
    autoPauseOffscreen = true,
    speed = 0.5,
    transparent = true,
    edgeFade = 0.5
  } = options;

  if (!container) return null;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const renderer = new THREE.WebGLRenderer({
    antialias,
    alpha: true,
    powerPreference: 'high-performance'
  });
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return null;
  }

  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  if (transparent) renderer.setClearAlpha(0);
  else renderer.setClearColor(0x000000, 1);

  const uniforms = {
    uResolution: { value: new THREE.Vector2(0, 0) },
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uClickPos: { value: Array.from({ length: MAX_CLICKS }, () => new THREE.Vector2(-1, -1)) },
    uClickTimes: { value: new Float32Array(MAX_CLICKS) },
    uShapeType: { value: SHAPE_MAP[variant] ?? 0 },
    uPixelSize: { value: pixelSize * renderer.getPixelRatio() },
    uScale: { value: patternScale },
    uDensity: { value: patternDensity },
    uPixelJitter: { value: pixelSizeJitter },
    uEnableRipples: { value: enableRipples ? 1 : 0 },
    uRippleSpeed: { value: rippleSpeed },
    uRippleThickness: { value: rippleThickness },
    uRippleIntensity: { value: rippleIntensityScale },
    uEdgeFade: { value: edgeFade }
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX_SRC,
    fragmentShader: FRAGMENT_SRC,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    glslVersion: THREE.GLSL3
  });
  const quadGeom = new THREE.PlaneGeometry(2, 2);
  scene.add(new THREE.Mesh(quadGeom, material));

  /* Optional liquid pass */
  let touch = null, target = null, liquidScene = null, liquidMat = null, liquidGeom = null;
  if (liquid) {
    touch = createTouchTexture();
    touch.radiusScale = liquidRadius;
    target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });
    liquidMat = new THREE.ShaderMaterial({
      vertexShader: LIQUID_VERT,
      fragmentShader: LIQUID_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: target.texture },
        uTexture: { value: touch.texture },
        uStrength: { value: liquidStrength },
        uTime: { value: 0 },
        uFreq: { value: liquidWobbleSpeed }
      }
    });
    liquidGeom = new THREE.PlaneGeometry(2, 2);
    liquidScene = new THREE.Scene();
    liquidScene.add(new THREE.Mesh(liquidGeom, liquidMat));
  }

  const setSize = () => {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    uniforms.uResolution.value.set(renderer.domElement.width, renderer.domElement.height);
    uniforms.uPixelSize.value = pixelSize * renderer.getPixelRatio();
    if (target) target.setSize(renderer.domElement.width, renderer.domElement.height);
  };
  setSize();

  const ro = new ResizeObserver(setSize);
  ro.observe(container);

  let visible = true;
  let io = null;
  if (autoPauseOffscreen && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { visible = e.isIntersecting; }),
      { rootMargin: '120px' }
    );
    io.observe(container);
  }

  const mapToPixels = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    const scaleX = renderer.domElement.width / rect.width;
    const scaleY = renderer.domElement.height / rect.height;
    return {
      fx: (e.clientX - rect.left) * scaleX,
      fy: (rect.height - (e.clientY - rect.top)) * scaleY,
      w: renderer.domElement.width,
      h: renderer.domElement.height
    };
  };

  let clickIx = 0;
  const onPointerDown = (e) => {
    const { fx, fy } = mapToPixels(e);
    uniforms.uClickPos.value[clickIx].set(fx, fy);
    uniforms.uClickTimes.value[clickIx] = uniforms.uTime.value;
    clickIx = (clickIx + 1) % MAX_CLICKS;
  };
  const onPointerMove = (e) => {
    if (!touch) return;
    const { fx, fy, w, h } = mapToPixels(e);
    touch.addTouch({ x: fx / w, y: fy / h });
  };

  // The canvas sits behind the page and must not eat clicks, so the pointer
  // listeners live on window and the element keeps pointer-events: none.
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointermove', onPointerMove, { passive: true });

  const clock = new THREE.Clock();
  const timeOffset = Math.random() * 1000;
  let raf = 0;

  const draw = () => {
    if (touch) touch.update();
    if (liquid && target) {
      liquidMat.uniforms.uTime.value = uniforms.uTime.value;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(liquidScene, camera);
    } else {
      renderer.render(scene, camera);
    }
  };

  const animate = () => {
    raf = requestAnimationFrame(animate);
    if (autoPauseOffscreen && !visible) return;
    if (document.hidden) return;
    uniforms.uTime.value = timeOffset + clock.getElapsedTime() * speed;
    draw();
  };

  if (reduceMotion.matches) {
    // Render a single still frame rather than animating.
    uniforms.uTime.value = timeOffset;
    draw();
  } else {
    raf = requestAnimationFrame(animate);
  }

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io?.disconnect();
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      quadGeom.dispose();
      material.dispose();
      liquidGeom?.dispose();
      liquidMat?.dispose();
      target?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}

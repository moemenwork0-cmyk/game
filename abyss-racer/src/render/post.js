// HDR post chain: MSAA HDR scene -> physically-based bloom (down/up mip chain) -> composite
// (exposure, ACES, grading, speed radial blur, chromatic aberration, vignette, grain, impact flash).
import * as THREE from 'three';

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DOWN_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uPrefilter; uniform float uThreshold;
varying vec2 vUv;
vec3 s(vec2 o) { return texture2D(tSrc, vUv + o * uTexel).rgb; }
void main() {
  // 13-tap Jimenez downsample (Call of Duty AW), with Karis average on the first pass to kill fireflies
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col;
  if (uPrefilter > 0.5) {
    vec3 g0 = (a + b + d + e) * 0.25, g1 = (b + c + e + f) * 0.25, g2 = (d + e + g + h) * 0.25, g3 = (e + f + h + i) * 0.25, g4 = (j + k + l + m) * 0.25;
    float w0 = 1.0 / (1.0 + dot(g0, vec3(0.2126, 0.7152, 0.0722)));
    float w1 = 1.0 / (1.0 + dot(g1, vec3(0.2126, 0.7152, 0.0722)));
    float w2 = 1.0 / (1.0 + dot(g2, vec3(0.2126, 0.7152, 0.0722)));
    float w3 = 1.0 / (1.0 + dot(g3, vec3(0.2126, 0.7152, 0.0722)));
    float w4 = 1.0 / (1.0 + dot(g4, vec3(0.2126, 0.7152, 0.0722)));
    col = (g0 * w0 * 0.125 + g1 * w1 * 0.125 + g2 * w2 * 0.125 + g3 * w3 * 0.125 + g4 * w4 * 0.5) /
          (w0 * 0.125 + w1 * 0.125 + w2 * 0.125 + w3 * 0.125 + w4 * 0.5);
    float br = max(col.r, max(col.g, col.b));
    col *= max(br - uThreshold, 0.0) / max(br, 1e-4);
  } else {
    col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const UP_FRAG = /* glsl */ `
uniform sampler2D tSrc; uniform sampler2D tPrev; uniform vec2 uTexel; uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 r = uTexel * uRadius;
  vec3 c = texture2D(tSrc, vUv + vec2(-r.x, r.y)).rgb + texture2D(tSrc, vUv + vec2(0, r.y)).rgb * 2.0 + texture2D(tSrc, vUv + r).rgb
    + texture2D(tSrc, vUv + vec2(-r.x, 0)).rgb * 2.0 + texture2D(tSrc, vUv).rgb * 4.0 + texture2D(tSrc, vUv + vec2(r.x, 0)).rgb * 2.0
    + texture2D(tSrc, vUv - r).rgb + texture2D(tSrc, vUv + vec2(0, -r.y)).rgb * 2.0 + texture2D(tSrc, vUv + vec2(r.x, -r.y)).rgb;
  gl_FragColor = vec4(c / 16.0 + texture2D(tPrev, vUv).rgb, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom;
uniform float uBloom; uniform float uExposure; uniform float uTime;
uniform float uSpeedBlur; uniform float uChroma; uniform float uVignette; uniform float uFlash;
uniform vec3 uFlashColor; uniform float uDesat; uniform vec2 uRes; uniform float uGrain;
uniform float uDistort;
varying vec2 vUv;
vec3 aces(vec3 x) {
  // Narkowicz ACES fit, with a touch of input matrix-free saturation preserved
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // subtle water refraction wobble of the whole image
  uv += vec2(sin(uv.y * 24.0 + uTime * 1.7), cos(uv.x * 19.0 + uTime * 1.3)) * 0.0009 * uDistort;
  vec2 dc = uv - 0.5;
  float r2 = dot(dc, dc);
  // chromatic aberration grows towards the edges
  vec2 ca = dc * r2 * uChroma;
  vec3 col;
  col.r = texture2D(tScene, uv - ca).r;
  col.g = texture2D(tScene, uv).g;
  col.b = texture2D(tScene, uv + ca).b;
  // speed radial blur (stronger at the edges, none in the centre)
  if (uSpeedBlur > 0.001) {
    vec3 acc = col; float w = 1.0;
    float amt = uSpeedBlur * smoothstep(0.02, 0.3, r2);
    for (int i = 1; i < 7; i++) {
      float t = float(i) / 6.0;
      acc += texture2D(tScene, uv - dc * amt * t * 0.12).rgb * (1.0 - t * 0.5);
      w += (1.0 - t * 0.5);
    }
    col = acc / w;
  }
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  col += bloom * uBloom;
  col *= uExposure;
  col = aces(col);
  // grade: cool shadows, slightly warm highlights, gentle contrast curve
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, col * vec3(0.92, 1.0, 1.06), 1.0 - l);
  col = mix(vec3(l), col, 1.0 + 0.12 - uDesat);
  col = smoothstep(-0.02, 1.02, col);
  // vignette
  col *= mix(1.0, smoothstep(0.85, 0.15, length(dc * vec2(1.0, 0.8))), uVignette);
  // impact flash
  col = mix(col, uFlashColor, uFlash);
  // gamma (sRGB)
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  // film grain, dithers banding in the dark water gradients
  float g = hash(vUv * uRes + fract(uTime * 13.7)) - 0.5;
  col += g * uGrain;
  gl_FragColor = vec4(col, 1.0);
}`;

export class PostFX {
  constructor(renderer, opts = {}) {
    this.renderer = renderer;
    this.msaa = opts.msaa ?? 4;
    this.bloomLevels = opts.bloomLevels ?? 5;
    this.enabled = true;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene();
    this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });
    this.downMat = mk(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrefilter: { value: 0 }, uThreshold: { value: 1.0 } });
    this.upMat = mk(UP_FRAG, { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1.0 } });
    this.compMat = mk(COMPOSITE_FRAG, {
      tScene: { value: null }, tBloom: { value: null }, uBloom: { value: 0.08 }, uExposure: { value: 1.0 }, uTime: { value: 0 },
      uSpeedBlur: { value: 0 }, uChroma: { value: 0.012 }, uVignette: { value: 0.55 }, uFlash: { value: 0 },
      uFlashColor: { value: new THREE.Color(1, 1, 1) }, uDesat: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
      uGrain: { value: 0.025 }, uDistort: { value: 1.0 },
    });
    this.blackTex = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.blackTex.needsUpdate = true;
    this.uniforms = this.compMat.uniforms;
    this.setSize(2, 2);
  }

  setSize(w, h) {
    this.w = Math.max(2, Math.floor(w)); this.h = Math.max(2, Math.floor(h));
    if (this.sceneRT) this.sceneRT.dispose();
    this.sceneRT = new THREE.WebGLRenderTarget(this.w, this.h, {
      type: THREE.HalfFloatType, samples: this.msaa, depthBuffer: true,
    });
    (this.mips || []).forEach((m) => m.dispose());
    (this.ups || []).forEach((m) => m.dispose());
    this.mips = []; this.ups = [];
    let mw = this.w, mh = this.h;
    for (let i = 0; i < this.bloomLevels; i++) {
      mw = Math.max(2, Math.floor(mw / 2)); mh = Math.max(2, Math.floor(mh / 2));
      const o = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
      this.mips.push(new THREE.WebGLRenderTarget(mw, mh, o));
      this.ups.push(new THREE.WebGLRenderTarget(mw, mh, o));
    }
    this.uniforms.uRes.value.set(this.w, this.h);
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qscene, this.qcam);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.clear();
    r.render(scene, camera);
    // bloom chain
    let src = this.sceneRT.texture, sw = this.w, sh = this.h;
    for (let i = 0; i < this.mips.length; i++) {
      this.downMat.uniforms.tSrc.value = src;
      this.downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      this.downMat.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
      this.pass(this.downMat, this.mips[i]);
      src = this.mips[i].texture; sw = this.mips[i].width; sh = this.mips[i].height;
    }
    let prev = this.blackTex;
    for (let i = this.mips.length - 1; i >= 0; i--) {
      const s = i === this.mips.length - 1 ? this.mips[i] : this.ups[i + 1];
      this.upMat.uniforms.tSrc.value = (i === this.mips.length - 1) ? this.mips[i].texture : this.ups[i + 1].texture;
      this.upMat.uniforms.tPrev.value = i === this.mips.length - 1 ? this.blackTex : this.mips[i].texture;
      this.upMat.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      this.pass(this.upMat, this.ups[i]);
      prev = this.ups[i].texture;
    }
    this.uniforms.tScene.value = this.sceneRT.texture;
    this.uniforms.tBloom.value = prev;
    this.uniforms.uTime.value = time;
    this.pass(this.compMat, null);
  }
}

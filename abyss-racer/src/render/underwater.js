// Underwater light transport shared by every material in the world:
//  - spectral absorption + in-scattering (red dies first, blue-green survives) along the view ray,
//  - depth-dependent ambient (the deeper, the darker and bluer),
//  - animated, chromatic, physically traced caustics projected along the sun direction,
//  - optional bioluminescent plankton glow in the deep.
import * as THREE from 'three';

export const UW = {
  uTime: { value: 0 },
  uCaustics: { value: null },
  uSunDir: { value: new THREE.Vector3(0.25, 1, 0.18).normalize() },   // direction TOWARDS the light
  uSurfaceY: { value: 0 },
  uAbsorb: { value: new THREE.Vector3(0.020, 0.0075, 0.0052) },  // per-metre spectral absorption (r, g, b)
  uScatterTop: { value: new THREE.Color(0.15, 0.47, 0.58) },     // in-scatter colour near the surface
  uScatterDeep: { value: new THREE.Color(0.006, 0.030, 0.060) }, // in-scatter colour in the abyss
  uDepthRange: { value: new THREE.Vector2(15, 120) },             // depth (m) where top -> deep blend
  uCausticStrength: { value: 1.2 },
  uCausticScale: { value: 1 / 9.0 },
  uFogDensity: { value: 0.0085 },                                // per-metre scattering (visibility)
  uExtraGlow: { value: 0.0 },
};

// Shared GLSL: world-space fog + caustic functions.
export const UW_COMMON = /* glsl */ `
uniform float uTime;
uniform sampler2D uCaustics;
uniform vec3 uSunDir;
uniform float uSurfaceY;
uniform vec3 uAbsorb;
uniform vec3 uScatterTop;
uniform vec3 uScatterDeep;
uniform vec2 uDepthRange;
uniform float uCausticStrength;
uniform float uCausticScale;
uniform float uFogDensity;

float uwDepthMix(float y) {
  float depth = uSurfaceY - y;
  return smoothstep(uDepthRange.x, uDepthRange.y, depth);
}
vec3 uwScatterColor(vec3 wpos, vec3 viewDir) {
  float dm = uwDepthMix(wpos.y);
  vec3 c = mix(uScatterTop, uScatterDeep, pow(dm, 0.7));
  // brighter when looking up towards the light, darker looking down into the abyss
  float up = viewDir.y;
  c *= mix(0.55, 1.65, smoothstep(-0.6, 0.9, up));
  float sun = pow(max(dot(viewDir, uSunDir), 0.0), 6.0);
  c += uScatterTop * sun * 0.9 * (1.0 - dm);
  return c;
}
vec3 uwApplyFog(vec3 col, vec3 wpos, vec3 camPos) {
  vec3 d = wpos - camPos;
  float dist = length(d);
  vec3 vdir = d / max(dist, 1e-4);
  vec3 T = exp(-uAbsorb * dist);
  float F = 1.0 - exp(-dist * uFogDensity);
  vec3 sc = uwScatterColor(mix(camPos, wpos, 0.35), vdir);
  return mix(col * T, sc, F);
}
float uwCausticFrame(vec2 uv, float frame) {
  float f = mod(frame, 16.0);
  vec2 cell = vec2(mod(f, 4.0), floor(f / 4.0));
  vec2 tuv = (fract(uv) * 0.996 + 0.002 + cell) * 0.25;
  return texture2D(uCaustics, vec2(tuv.x, 1.0 - tuv.y)).r;
}
float uwCausticSample(vec2 uv) {
  float t = uTime * 7.0;
  float f0 = floor(t);
  float a = uwCausticFrame(uv, f0);
  float b = uwCausticFrame(uv, f0 + 1.0);
  return mix(a, b, t - f0);
}
vec3 uwCaustics(vec3 wpos, vec3 wnormal) {
  // project along the sun direction onto the surface plane
  vec2 p = wpos.xz + uSunDir.xz / max(uSunDir.y, 0.2) * (uSurfaceY - wpos.y);
  vec2 uv = p * uCausticScale;
  float disp = 0.006;
  vec3 c;
  c.r = uwCausticSample(uv + vec2(disp, 0.0));
  c.g = uwCausticSample(uv);
  c.b = uwCausticSample(uv - vec2(disp, disp * 0.6));
  // second, larger and slower layer breaks up the repetition
  float big = uwCausticSample(p * uCausticScale * 0.37 + vec2(0.31, 0.77));
  c *= 0.55 + big * 1.1;
  float facing = clamp(dot(wnormal, uSunDir) * 1.2, 0.0, 1.0);
  float depth = max(uSurfaceY - wpos.y, 0.0);
  float fade = exp(-depth * 0.022) ;
  return c * facing * fade * uCausticStrength;
}
`;

const VERT_DECL = 'varying vec3 vUwWorld;\n';
const VERT_BODY = /* glsl */ `
  {
    vec4 uwW = vec4(transformed, 1.0);
    #ifdef USE_BATCHING
      uwW = batchingMatrix * uwW;
    #endif
    #ifdef USE_INSTANCING
      uwW = instanceMatrix * uwW;
    #endif
    vUwWorld = (modelMatrix * uwW).xyz;
  }
`;

/**
 * Patch a built-in lit material (Standard / Physical / Lambert) with caustics + underwater fog.
 * opts.caustics (default true), opts.fog (default true), opts.extraFrag (glsl run before fog with
 * access to diffuseColor, vUwWorld, uwN), opts.onCompile(shader) for further custom edits.
 */
export function patchMaterial(mat, opts = {}) {
  const caustics = opts.caustics !== false;
  const fog = opts.fog !== false;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    Object.assign(shader.uniforms, UW, opts.uniforms || {});
    shader.vertexShader = VERT_DECL + 'uniform float uTime;\n' + (opts.vertDecl || '') + shader.vertexShader.replace(
      '#include <project_vertex>', '#include <project_vertex>\n' + VERT_BODY + (opts.vertBody || ''));
    const lit = mat.isMeshStandardMaterial || mat.isMeshLambertMaterial || mat.isMeshPhongMaterial;
    let frag = `
      {
        vec3 uwN = vec3(0.0, 1.0, 0.0);
        ${lit ? 'uwN = normalize(inverseTransformDirection(normal, viewMatrix));' : ''}
        ${caustics && lit ? 'gl_FragColor.rgb += diffuseColor.rgb * uwCaustics(vUwWorld, uwN) * (1.0 - metalnessFactorUw) * ' + (opts.causticMul ?? 1).toFixed(3) + ';' : ''}
        ${opts.extraFrag || ''}
        ${fog ? 'gl_FragColor.rgb = uwApplyFog(gl_FragColor.rgb, vUwWorld, cameraPosition);' : ''}
      }
    `;
    const metal = mat.isMeshStandardMaterial ? 'float metalnessFactorUw = metalnessFactor * 0.7;' : 'float metalnessFactorUw = 0.0;';
    shader.fragmentShader = VERT_DECL + UW_COMMON + (opts.fragDecl || '') + shader.fragmentShader
      .replace('#include <fog_fragment>', metal + frag);
    if (opts.onCompile) opts.onCompile(shader, renderer);
    if (prev) prev(shader, renderer);
  };
  mat.customProgramCacheKey = () => 'uw' + (caustics ? 1 : 0) + (fog ? 1 : 0) + (opts.key || '');
  mat.fog = false;
  return mat;
}

/** Shader material snippet helpers for custom ShaderMaterials (particles, shafts, sky). */
export function uwUniforms(extra = {}) {
  return Object.assign({}, UW, extra);
}

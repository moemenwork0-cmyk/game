shader_type spatial;
render_mode cull_disabled;
/** The wall of water: dark deep body, glassy green where the crest thins and the light
 comes through, churning foam streaming down the face and boiling at the toe. */

uniform float width = 3000.0;
uniform float height = 120.0;
uniform float crest_s = 0.42;   // profile parameter of the crest
uniform float churn = 1.0;
varying float vs;
varying vec2 vuv;

float h31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n3(vec3 x) {
	vec3 i = floor(x), f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h31(i), h31(i + vec3(1, 0, 0)), f.x), mix(h31(i + vec3(0, 1, 0)), h31(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(h31(i + vec3(0, 0, 1)), h31(i + vec3(1, 0, 1)), f.x), mix(h31(i + vec3(0, 1, 1)), h31(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n3(p); p *= 2.03; a *= 0.5; } return s; }

void vertex() {
	vs = UV.y;
	vuv = vec2(UV.x * width, UV.y * height * 6.0);
	// water pours down the face: features travel down (towards larger s) over time
	float face = smoothstep(crest_s - 0.08, crest_s + 0.05, UV.y) * (1.0 - smoothstep(0.85, 1.0, UV.y));
	float d = fbm(vec3(vuv.x * 0.02, vuv.y * 0.03 - TIME * 0.9, TIME * 0.1)) - 0.5;
	VERTEX += NORMAL * d * height * 0.06 * (0.3 + face) * churn;
}

void fragment() {
	float t = TIME;
	vec3 p = vec3(vuv.x * 0.05, vuv.y * 0.05 - t * 1.2, t * 0.15);
	float n = fbm(p);
	float crest = 1.0 - smoothstep(0.0, 0.07, abs(vs - crest_s));
	float face = smoothstep(crest_s, crest_s + 0.06, vs) * (1.0 - smoothstep(0.86, 0.95, vs));
	float toe = smoothstep(0.82, 0.92, vs);
	// foam: thick at the lip and the toe, torn streaks pouring down the face
	float streak = fbm(vec3(vuv.x * 0.09, vuv.y * 0.012 - t * 0.6, t * 0.05));
	float foam = clamp(crest * smoothstep(0.4, 0.65, n) * 1.4 + face * smoothstep(0.62, 0.8, streak) * 0.7 + toe * smoothstep(0.35, 0.6, n) * 1.2, 0.0, 1.0);
	// glassy translucent body below the lip
	float thin = (1.0 - smoothstep(crest_s, crest_s + 0.18, vs)) * smoothstep(crest_s - 0.25, crest_s, vs);
	vec3 deep = vec3(0.012, 0.05, 0.055);
	vec3 glass = vec3(0.05, 0.22, 0.19);
	vec3 col = mix(deep, glass, thin * 0.8);
	ALBEDO = mix(col, vec3(0.7, 0.76, 0.78), foam * 0.85);
	ROUGHNESS = mix(0.05, 0.85, foam);
	SPECULAR = 0.6;
	BACKLIGHT = mix(vec3(0.05, 0.45, 0.35) * thin, vec3(0.6), foam * 0.5);
	vec3 nm = vec3(fbm(p * 2.0) - 0.5, fbm(p * 2.0 + 13.1) - 0.5, 0.0);
	NORMAL_MAP = normalize(vec3(nm.xy * 1.2, 1.0)) * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 1.0 - foam * 0.5;
}

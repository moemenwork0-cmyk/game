shader_type spatial;
render_mode cull_disabled;
/** Shark skin: countershaded slate over pale belly, faint tiger bars; carangiform swim. */
uniform float length = 3.6;
uniform float freq = 1.6;
varying vec3 lp;
void vertex() {
	lp = VERTEX;
	float s = clamp((VERTEX.z / length) + 0.5, 0.0, 1.2);  // 0 nose, 1 tail
	float amp = 0.02 + 0.22 * s * s;
	VERTEX.x += sin(TIME * freq * 6.2832 - s * 4.5) * amp * length * 0.25;
}
void fragment() {
	float belly = smoothstep(0.02, -0.08, lp.y);
	vec3 top = vec3(0.12, 0.14, 0.15);
	float bars = smoothstep(0.6, 0.9, sin(lp.z * 9.0 + sin(lp.x * 3.0) * 0.6)) * step(0.02, lp.y) * 0.35;
	ALBEDO = mix(top * (1.0 - bars), vec3(0.5, 0.5, 0.47), belly);
	ROUGHNESS = 0.55;
	SPECULAR = 0.4;
}

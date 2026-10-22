shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled;
/** The sea surface seen from below: bright rippling ceiling with Snell's window. */
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float n(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y);
}
void fragment() {
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec2 p = wp.xz * 0.15;
	float r = n(p + TIME * 0.3) * 0.5 + n(p * 2.3 - TIME * 0.4) * 0.35 + n(p * 5.0 + TIME) * 0.15;
	float caust = pow(1.0 - abs(r - 0.5) * 2.0, 6.0);
	vec3 view = normalize(VERTEX);
	float window = smoothstep(0.55, 0.85, abs(dot(view, (VIEW_MATRIX * vec4(0, 1, 0, 0)).xyz)));
	vec3 col = mix(vec3(0.02, 0.12, 0.13), vec3(0.5, 0.85, 0.85), window) + caust * vec3(0.4, 0.6, 0.55) * window;
	ALBEDO = col;
	EMISSION = col * 2.0;
}

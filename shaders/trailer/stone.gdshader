shader_type spatial;
/** Ashlar stone in world space (clock tower), weathered; algae below `water_y`. */
uniform vec3 stone : source_color = vec3(0.62, 0.55, 0.44);
uniform float water_y = -1000.0;
varying vec3 wp;
varying vec3 wn;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec3 an = abs(wn);
	vec2 uv = an.y > 0.5 ? wp.xz : vec2(an.x > an.z ? wp.z : wp.x, wp.y);
	vec2 b = uv / vec2(1.2, 0.55);
	b.x += step(1.0, mod(floor(b.y), 2.0)) * 0.5;
	vec2 f = fract(b);
	float mortar = 1.0 - step(0.04, f.x) * step(0.07, f.y);
	vec3 col = stone * (0.8 + 0.3 * h21(floor(b)));
	col *= 0.75 + 0.35 * n2(uv * 0.4);
	col = mix(col, col * 0.55, mortar);
	float grime = n2(vec2(uv.x * 0.7, uv.y * 0.05));
	col *= 1.0 - grime * 0.3;
	if (wp.y < water_y) {
		float a = n2(uv * 0.8) * 0.6 + n2(uv * 4.0) * 0.4;
		col = mix(col * vec3(0.5, 0.6, 0.45), vec3(0.14, 0.2, 0.09), smoothstep(0.3, 0.7, a));
	}
	ALBEDO = col;
	ROUGHNESS = 0.9;
	NORMAL_MAP = normalize(vec3(0.5 + (n2(uv * 6.0) - 0.5) * 0.3, 0.5 + (n2(uv * 6.0 + 9.0) - 0.5) * 0.3, 1.0)) * 0.5 + 0.5;
	NORMAL_MAP = mix(NORMAL_MAP, vec3(0.5, 0.5, 1.0), 1.0 - mortar * 0.6);
}

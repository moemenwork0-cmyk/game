shader_type spatial;
render_mode cull_disabled, diffuse_burley;

// COLOR.r = tint variation, COLOR.g = wind weight
uniform vec3 leaf_a : source_color = vec3(0.12, 0.26, 0.05);
uniform vec3 leaf_b : source_color = vec3(0.30, 0.42, 0.10);
uniform bool palm = false;
uniform float wind = 1.0;

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w = COLOR.g * wind;
	vec3 off = vec3(sin(TIME * 1.6 + wp.x * 0.7 + wp.y * 0.3), sin(TIME * 2.1 + wp.z) * 0.4, cos(TIME * 1.3 + wp.z * 0.6)) * 0.06 * w;
	off += vec3(sin(TIME * 7.0 + wp.x * 5.0 + wp.z * 3.0)) * 0.012 * w;
	VERTEX += off;
}

void fragment() {
	float a;
	float shade = 1.0;
	if (!palm) {
		vec2 uv = UV * 2.0 - 1.0;
		float width = 0.62 * (1.0 - uv.y * uv.y) * (1.0 - 0.25 * uv.y);
		a = step(abs(uv.x), width);
		shade = 0.85 + 0.25 * (1.0 - abs(uv.x) / max(width, 0.001));
		shade *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.05, abs(uv.x)));
	} else {
		float cx = abs(UV.x - 0.5) * 2.0;
		float taper = 1.0 - pow(UV.y, 2.5);
		float stripes = fract(UV.y * 34.0 - cx * 2.2);
		a = (step(cx, 0.05) + step(stripes, 0.62) * step(cx, taper * 0.98)) > 0.5 ? 1.0 : 0.0;
		shade = 0.8 + 0.3 * stripes;
	}
	ALPHA = a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	vec3 c = mix(leaf_a, leaf_b, COLOR.r) * shade;
	ALBEDO = c;
	BACKLIGHT = c * 0.7;
	ROUGHNESS = 0.6;
	SPECULAR = 0.35;
}

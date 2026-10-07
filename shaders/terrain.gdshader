shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Smooth voxel terrain. Vertex COLOR carries material weights:
// r = grass, g = sand, b = stone, a = dirt
uniform sampler2D tex_detail : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_macro : hint_default_white, filter_linear_mipmap, repeat_enable;

uniform vec3 grass_lush : source_color = vec3(0.20, 0.34, 0.08);
uniform vec3 grass_dry : source_color = vec3(0.47, 0.45, 0.20);
uniform vec3 dirt_col : source_color = vec3(0.29, 0.20, 0.12);
uniform vec3 sand_col : source_color = vec3(0.86, 0.77, 0.58);
uniform vec3 sand_wet_col : source_color = vec3(0.52, 0.44, 0.31);
uniform vec3 rock_a : source_color = vec3(0.45, 0.43, 0.40);
uniform vec3 rock_b : source_color = vec3(0.27, 0.25, 0.23);
uniform float water_level = 0.0;
uniform float daylight = 1.0;
uniform float wave_time = 0.0;
uniform float wetness = 0.0;

varying vec3 wpos;
varying vec3 wnrm;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

vec3 tri_w(vec3 n) {
	vec3 b = pow(abs(n), vec3(4.0));
	return b / (b.x + b.y + b.z);
}

float tri_s(sampler2D t, vec3 p, vec3 b) {
	return texture(t, p.zy).r * b.x + texture(t, p.xz).r * b.y + texture(t, p.xy).r * b.z;
}

vec3 tri_n(sampler2D t, vec3 p, vec3 b, vec3 n, float strength) {
	vec3 tx = texture(t, p.zy).xyz * 2.0 - 1.0;
	vec3 ty = texture(t, p.xz).xyz * 2.0 - 1.0;
	vec3 tz = texture(t, p.xy).xyz * 2.0 - 1.0;
	tx.xy *= strength;
	ty.xy *= strength;
	tz.xy *= strength;
	tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
	ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
	tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
	return normalize(tx.zyx * b.x + ty.xzy * b.y + tz.xyz * b.z);
}

void fragment() {
	vec3 n = normalize(wnrm);
	vec3 b = tri_w(n);
	float d1 = tri_s(tex_detail, wpos * 0.19, b);
	float d2 = tri_s(tex_detail, wpos * 0.85, b);
	float d3 = tri_s(tex_detail, wpos * 3.1, b);
	float mac = texture(tex_macro, wpos.xz * 0.011).r;

	vec4 w = COLOR;
	float slope = n.y;
	float steep = 1.0 - smoothstep(0.42, 0.66, slope + (d1 - 0.5) * 0.3);
	float g = w.r * (1.0 - steep) * smoothstep(0.62, 0.8, slope + (d2 - 0.5) * 0.25);
	float s = w.g * (1.0 - steep * 0.6);
	float r = w.b + (w.r + w.a + w.g * 0.6) * steep;
	float dt = max(1.0 - g - s - r, 0.0);
	float tot = g + s + r + dt + 0.0001;
	g /= tot; s /= tot; r /= tot; dt /= tot;

	float above = wpos.y - water_level;
	float wet = 1.0 - smoothstep(0.1, 0.9, above);

	vec3 grass_c = mix(grass_lush, grass_dry, smoothstep(0.35, 0.8, mac + (d1 - 0.5) * 0.3));
	grass_c *= 0.7 + 0.55 * d2 * (0.7 + 0.3 * d3);
	vec3 sand_c = mix(sand_col, sand_wet_col, wet) * (0.88 + 0.22 * d3);
	float strata = sin(wpos.y * 3.3 + d1 * 6.0) * 0.5 + 0.5;
	vec3 rock_c = mix(rock_a, rock_b, clamp(strata * 0.55 + d2 * 0.55, 0.0, 1.0));
	rock_c = mix(rock_c, vec3(0.32, 0.36, 0.22), smoothstep(0.62, 0.8, d1) * 0.35 * smoothstep(0.2, 0.7, slope));
	vec3 dirt_c = dirt_col * (0.75 + 0.45 * d2) * (0.9 + 0.2 * d3);

	vec3 albedo = grass_c * g + sand_c * s + rock_c * r + dirt_c * dt;
	albedo *= mix(1.0, 0.72, wet * (1.0 - s));

	// underwater caustics
	float uw = smoothstep(0.1, -0.6, above);
	if (uw > 0.0) {
		float c1 = texture(tex_detail, wpos.xz * 0.23 + vec2(wave_time * 0.035, wave_time * 0.02)).r;
		float c2 = texture(tex_detail, wpos.xz * 0.27 - vec2(wave_time * 0.028, -wave_time * 0.031)).r;
		float caus = pow(1.0 - abs(c1 - c2), 14.0);
		albedo += vec3(0.6, 0.85, 0.9) * caus * uw * daylight * 0.6 * exp(above * 0.12);
	}

	// rain soaks everything: darker, glossier
	float rainwet = wetness * smoothstep(-0.2, 0.6, n.y + 0.4);
	albedo *= 1.0 - rainwet * 0.45;
	ALBEDO = albedo;
	ROUGHNESS = clamp(0.96 - wet * s * 0.6 - wet * 0.15 - r * 0.1 - rainwet * 0.3, 0.3, 1.0);
	SPECULAR = 0.35 + wet * 0.2;
	float ns = 0.45 * g + 0.5 * s + 1.1 * r + 0.8 * dt;
	vec3 wn = tri_n(tex_normal, wpos * 0.33, b, n, ns);
	NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);
	AO = 0.85 + 0.15 * d2;
}

shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_disabled, diffuse_burley, specular_schlick_ggx;

uniform sampler2D SCREEN_TEX : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform sampler2D DEPTH_TEX : hint_depth_texture, filter_linear, repeat_disable;
uniform sampler2D normal_a : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_b : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D foam_tex : hint_default_white, filter_linear_mipmap, repeat_enable;

// xy = direction, z = steepness, w = wavelength (must match ocean.gd)
uniform vec4 wave_a = vec4(1.0, 0.35, 0.07, 26.0);
uniform vec4 wave_b = vec4(0.55, 1.0, 0.06, 14.0);
uniform vec4 wave_c = vec4(-0.45, 0.8, 0.05, 8.0);
uniform vec4 wave_d = vec4(0.9, -0.55, 0.04, 4.5);
uniform float wave_time = 0.0;

uniform vec3 shallow_col : source_color = vec3(0.08, 0.5, 0.5);
uniform vec3 deep_col : source_color = vec3(0.006, 0.06, 0.12);
uniform vec3 absorb = vec3(0.42, 0.075, 0.05);
uniform float daylight = 1.0;
uniform bool displace = true;

varying vec3 wpos;
varying float crest;

vec3 gerstner(vec4 w, vec2 p, inout vec3 tn, inout vec3 bn) {
	float k = 6.2831853 / w.w;
	float c = sqrt(9.8 / k);
	vec2 d = normalize(w.xy);
	float f = k * (dot(d, p) - c * wave_time);
	float s = w.z;
	float a = s / k;
	float sf = sin(f);
	float cf = cos(f);
	tn += vec3(-d.x * d.x * s * sf, d.x * s * cf, -d.x * d.y * s * sf);
	bn += vec3(-d.x * d.y * s * sf, d.y * s * cf, -d.y * d.y * s * sf);
	return vec3(d.x * a * cf, a * sf, d.y * a * cf);
}

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 tn = vec3(1.0, 0.0, 0.0);
	vec3 bn = vec3(0.0, 0.0, 1.0);
	vec3 off = vec3(0.0);
	if (displace) {
		off = gerstner(wave_a, wp.xz, tn, bn);
		off += gerstner(wave_b, wp.xz, tn, bn);
		off += gerstner(wave_c, wp.xz, tn, bn);
		off += gerstner(wave_d, wp.xz, tn, bn);
	}
	VERTEX += off;
	crest = off.y;
	wpos = wp + off;
	NORMAL = normalize(cross(bn, tn));
	TANGENT = normalize(tn);
	BINORMAL = normalize(bn);
}

float scene_depth(vec2 uv, mat4 inv_proj) {
	float raw = texture(DEPTH_TEX, uv).r;
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, raw, 1.0);
	return -v.z / v.w;
}

void fragment() {
	vec2 uv1 = wpos.xz * 0.055 + vec2(wave_time * 0.017, wave_time * 0.009);
	vec2 uv2 = wpos.xz * 0.13 - vec2(wave_time * 0.011, -wave_time * 0.021);
	vec3 n1 = texture(normal_a, uv1).xyz * 2.0 - 1.0;
	vec3 n2 = texture(normal_b, uv2).xyz * 2.0 - 1.0;
	vec3 nd = normalize(vec3(n1.xy + n2.xy, n1.z * n2.z));

	float surf_z = -VERTEX.z;
	float thick = max(scene_depth(SCREEN_UV, INV_PROJECTION_MATRIX) - surf_z, 0.0);
	vec2 ruv = SCREEN_UV + nd.xy * 0.03 * clamp(thick * 0.6, 0.0, 1.0);
	float thick2 = scene_depth(ruv, INV_PROJECTION_MATRIX) - surf_z;
	if (thick2 < 0.0) {
		ruv = SCREEN_UV;
	} else {
		thick = thick2;
	}
	vec3 refr = textureLod(SCREEN_TEX, ruv, 0.0).rgb;

	float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 5.0);

	if (FRONT_FACING) {
		vec3 trans = exp(-absorb * thick);
		float murk = 1.0 - exp(-thick * 0.1);
		vec3 body = mix(shallow_col, deep_col, clamp(thick / 9.0, 0.0, 1.0));

		float fn = texture(foam_tex, wpos.xz * 0.21 + vec2(wave_time * 0.03, 0.0)).r;
		float fn2 = texture(foam_tex, wpos.xz * 0.47 - vec2(0.0, wave_time * 0.05)).r;
		float shore = 1.0 - smoothstep(0.0, 0.9, thick);
		float foam = smoothstep(0.35, 0.75, fn * fn2 * 2.0 + shore * 0.9) * shore;
		foam += smoothstep(0.34, 0.55, crest) * smoothstep(0.55, 0.85, fn) * 0.7;
		foam = clamp(foam, 0.0, 1.0);

		ALBEDO = mix(body * murk, vec3(0.92), foam);
		EMISSION = refr * trans * (1.0 - murk) * (1.0 - fres) * (1.0 - foam);
		ROUGHNESS = mix(0.03, 0.7, foam);
		SPECULAR = 0.5;
		NORMAL_MAP = nd * 0.5 + 0.5;
		NORMAL_MAP_DEPTH = 0.55;
	} else {
		// seen from below the surface
		ALBEDO = deep_col;
		EMISSION = refr * vec3(0.35, 0.7, 0.8) * (1.0 - fres * 0.6);
		ROUGHNESS = 0.2;
		NORMAL_MAP = nd * 0.5 + 0.5;
		NORMAL_MAP_DEPTH = 0.3;
	}
	ALPHA = 1.0;
}

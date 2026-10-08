shader_type spatial;
/**
 * Scanned rocks and cliffs: the scan's own textures, warmed towards sun-baked
 * sandstone, with moss and grass growing on upward-facing surfaces (above the
 * splash zone) and a dark wet band where the sea reaches.
 */

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_roughness_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool use_normal = false;
uniform bool use_orm = false;
uniform vec4 tint : source_color = vec4(1.0);
uniform float roughness = 0.85;

uniform sampler2D moss_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D moss_nrm : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform float moss_amount : hint_range(0.0, 1.0) = 0.7;
uniform float moss_scale = 0.35;      // tiles per metre
uniform float wet_line = 0.9;         // metres above sea level that stay wet

varying vec3 w_pos;
varying vec3 w_nrm;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void vertex() {
	w_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	w_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec3 base = texture(albedo_tex, UV).rgb * tint.rgb;
	vec3 orm = use_orm ? texture(orm_tex, UV).rgb : vec3(1.0, roughness, 0.0);
	// moss: on surfaces facing the sky, broken up by noise, never in the splash zone
	float n = vnoise(w_pos.xz * 0.6) * 0.6 + vnoise(w_pos.xz * 2.3) * 0.4;
	float up = smoothstep(0.45, 0.85, w_nrm.y);
	float dry = smoothstep(wet_line + 0.6, wet_line + 2.0, w_pos.y);
	float m = clamp(up * dry * smoothstep(0.35, 0.65, n + moss_amount - 0.5), 0.0, 1.0);
	vec2 muv = w_pos.xz * moss_scale;
	vec3 moss = texture(moss_tex, muv).rgb;
	// wet band near the sea
	float wet = 1.0 - smoothstep(wet_line - 0.2, wet_line + 0.6, w_pos.y);
	base *= mix(1.0, 0.55, wet);
	ALBEDO = mix(base, moss, m);
	ROUGHNESS = mix(mix(orm.g, 0.25, wet), 0.9, m);
	AO = orm.r;
	AO_LIGHT_AFFECT = 0.5;
	if (use_normal) {
		vec3 rn = texture(normal_tex, UV).rgb;
		vec3 mn = texture(moss_nrm, muv).rgb;
		NORMAL_MAP = mix(rn, mn, m * 0.7);
	}
}

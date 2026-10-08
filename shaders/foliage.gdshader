shader_type spatial;
render_mode cull_disabled, depth_prepass_alpha;
/**
 * Vegetation: alpha-cut leaves with light transmission and wind.
 *  - trunk sway: the whole plant bends with height (quadratic), gusting per instance
 *  - flutter: leaves and grass tips shiver with a faster, smaller motion
 * Wind comes from global shader parameters set by the weather (wind_dir, wind_strength).
 */

global uniform vec2 wind_dir;
global uniform float wind_strength;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D normal_tex : hint_roughness_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D orm_tex : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform bool use_normal = false;
uniform bool use_orm = false;
uniform float alpha_cut = 0.45;
uniform float roughness = 0.8;
uniform float normal_depth = 1.0;
uniform vec3 transmission : source_color = vec3(0.0);
// plant scale terms (metres): height of the plant, how far its top sways, flutter of leaves
uniform float plant_height = 10.0;
uniform float sway = 0.25;
uniform float flutter = 0.03;
uniform bool is_leaf = true;

void vertex() {
	vec3 ipos = MODEL_MATRIX[3].xyz;
	float phase = dot(ipos.xz, vec2(0.13, 0.07));
	float t = TIME;
	float ws = wind_strength;
	// gusts travel across the island
	float gust = 0.6 + 0.4 * sin(t * 0.35 + dot(ipos.xz, wind_dir) * 0.02) * sin(t * 0.13 + phase);
	float h = clamp(VERTEX.y / max(plant_height, 0.1), 0.0, 1.5);
	float bend = h * h * sway * ws * (0.55 + gust * 0.9);
	float osc = sin(t * 1.1 + phase) * 0.35 + sin(t * 1.9 + phase * 1.7) * 0.15;
	vec3 wdir = (inverse(MODEL_MATRIX) * vec4(wind_dir.x, 0.0, wind_dir.y, 0.0)).xyz;
	VERTEX += wdir * bend * (1.0 + osc);
	VERTEX.y -= bend * bend * 0.15;  // keep the length roughly constant
	if (is_leaf) {
		vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
		float f = sin(t * 7.3 + wp.x * 2.1 + wp.z * 1.7) * cos(t * 5.1 + wp.y * 3.3);
		VERTEX += NORMAL * f * flutter * ws * (0.4 + h);
	}
}

void fragment() {
	vec4 a = texture(albedo_tex, UV) * albedo_color;
	if (a.a < alpha_cut) discard;
	ALBEDO = a.rgb;
	vec3 orm = use_orm ? texture(orm_tex, UV).rgb : vec3(1.0, roughness, 0.0);
	ROUGHNESS = orm.g;
	METALLIC = 0.0;
	AO = orm.r;
	AO_LIGHT_AFFECT = 0.6;
	if (use_normal) {
		NORMAL_MAP = texture(normal_tex, UV).rgb;
		NORMAL_MAP_DEPTH = normal_depth;
	}
	BACKLIGHT = transmission;
}

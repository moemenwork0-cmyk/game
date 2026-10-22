shader_type spatial;
render_mode cull_disabled;
/** Canvas sails straining in a gale: billow, ripple running along the cloth, light through it. */

global uniform vec2 wind_dir;
global uniform float wind_strength;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap_anisotropic;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap_anisotropic;

void vertex() {
	float t = TIME;
	float w = clamp(wind_strength, 0.0, 2.0);
	float ripple = sin(VERTEX.y * 1.7 - t * 9.0 * (0.6 + w)) * cos(VERTEX.x * 0.9 + t * 4.0);
	float flap = sin(t * 2.3 + VERTEX.x * 0.3) * 0.5 + 0.5;
	VERTEX += NORMAL * (ripple * 0.12 + flap * 0.25) * w;
}

void fragment() {
	vec4 a = texture(albedo_tex, UV);
	if (a.a < 0.3) discard;
	ALBEDO = a.rgb;
	NORMAL_MAP = texture(normal_tex, UV).rgb;
	ROUGHNESS = 0.85;
	BACKLIGHT = vec3(0.45, 0.4, 0.32);
}

shader_type spatial;
render_mode cull_disabled, depth_draw_always;
/**
 * Lake and river water: clear in the shallows (you see the stones), green-brown in the
 * deep, ripples that flow downstream (UV.y runs along the river), refraction through
 * the real scene depth, and soft foam where the water touches banks and rocks.
 */

uniform vec4 shallow_color : source_color = vec4(0.32, 0.46, 0.38, 1.0);
uniform vec4 deep_color : source_color = vec4(0.03, 0.08, 0.07, 1.0);
uniform vec3 absorption = vec3(0.55, 0.22, 0.28);
uniform sampler2D ripple_a : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D ripple_b : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D foam_noise : filter_linear_mipmap, repeat_enable;
uniform float flow_speed = 0.0;     // m/s along UV.y (0 for the lake)
uniform float ripple_scale = 0.18;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;

varying vec3 world_pos;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float t = TIME;
	vec2 flow = vec2(0.0, flow_speed * t);
	vec2 uv1 = world_pos.xz * ripple_scale + vec2(t * 0.02, t * 0.013);
	vec2 uv2 = world_pos.xz * ripple_scale * 2.3 - vec2(t * 0.017, t * 0.025);
	if (flow_speed > 0.0) {
		uv1 = UV * vec2(0.4, 0.4) - flow * 0.4;
		uv2 = UV * vec2(0.9, 0.9) - flow * 0.9 + vec2(0.37, 0.11);
	}
	vec3 n1 = texture(ripple_a, uv1).rgb * 2.0 - 1.0;
	vec3 n2 = texture(ripple_b, uv2).rgb * 2.0 - 1.0;
	vec3 n = normalize(vec3(n1.xy + n2.xy, 2.2));
	NORMAL_MAP = n * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.6;

	float dist = length(VERTEX);
	float scene_depth = textureLod(depth_tex, SCREEN_UV, 0.0).r;
	vec4 sv = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, scene_depth, 1.0);
	sv.xyz /= sv.w;
	float thickness = max(0.0, length(sv.xyz) - dist);
	vec2 ruv = SCREEN_UV + n.xy * 0.02 * clamp(thickness, 0.0, 1.0);
	float rd = textureLod(depth_tex, ruv, 0.0).r;
	vec4 rv = INV_PROJECTION_MATRIX * vec4(ruv * 2.0 - 1.0, rd, 1.0);
	rv.xyz /= rv.w;
	if (length(rv.xyz) < dist) { ruv = SCREEN_UV; }
	vec3 behind = textureLod(screen_tex, ruv, 0.0).rgb;
	vec3 trans = exp(-absorption * thickness * 1.5);
	float murk = 1.0 - exp(-thickness * 0.6);
	vec3 body = mix(shallow_color.rgb, deep_color.rgb, smoothstep(0.3, 2.5, thickness));

	// foam where the water meets the bank or a rock, stretched by the current
	float fn = texture(foam_noise, uv1 * 2.0).r;
	float foam = smoothstep(0.35, 0.0, thickness) * smoothstep(0.35, 0.7, fn + 0.2) * (flow_speed > 0.0 ? 0.9 : 0.5);

	float fres = 0.02 + 0.98 * pow(1.0 - clamp(dot(normalize(VIEW), NORMAL), 0.0, 1.0), 5.0);
	ALBEDO = mix(body * murk, vec3(0.85), foam);
	EMISSION = behind * trans * (1.0 - fres) * (1.0 - foam);
	ROUGHNESS = mix(0.04, 0.6, foam);
	SPECULAR = 0.5;
}

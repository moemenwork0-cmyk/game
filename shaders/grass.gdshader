shader_type spatial;
render_mode cull_disabled, diffuse_burley, world_vertex_coords;

uniform vec3 root_color : source_color = vec3(0.07, 0.14, 0.03);
uniform vec3 tip_color : source_color = vec3(0.38, 0.52, 0.16);
uniform vec3 dry_color : source_color = vec3(0.62, 0.58, 0.28);
uniform sampler2D wind_noise : filter_linear_mipmap, repeat_enable;
uniform vec3 player_pos = vec3(0.0, -100.0, 0.0);
uniform float wind_strength = 0.18;

varying float h;

void vertex() {
	h = UV.y;
	vec3 wp = VERTEX;
	float wn = texture(wind_noise, wp.xz * 0.025 + TIME * vec2(0.035, 0.02)).r;
	vec2 wind = vec2(1.0, 0.45) * (wn * 1.2 - 0.1) * wind_strength;
	wind += vec2(sin(TIME * 2.3 + wp.x * 0.9 + wp.z * 0.6), cos(TIME * 1.9 + wp.z * 0.8)) * 0.025;
	vec3 dp = wp - player_pos;
	float dist = length(dp.xz);
	float push = (1.0 - smoothstep(0.15, 0.9, dist)) * (1.0 - smoothstep(0.8, 1.6, abs(dp.y)));
	vec2 pdir = normalize(dp.xz + vec2(0.0001)) * push * 0.35;
	vec2 bend = (wind + pdir) * h * h;
	VERTEX.xz += bend;
	VERTEX.y -= length(bend) * 0.45;
}

void fragment() {
	vec3 base = mix(root_color, tip_color, smoothstep(0.0, 1.0, h));
	base = mix(base, dry_color * mix(0.5, 1.0, h), COLOR.r);
	base *= 0.8 + 0.4 * COLOR.g;
	ALBEDO = base;
	ROUGHNESS = 0.85;
	SPECULAR = 0.25;
	BACKLIGHT = base * 0.6 * h;
	vec3 up = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	NORMAL = normalize(mix(NORMAL, up, 0.75));
	AO = mix(0.35, 1.0, h);
	AO_LIGHT_AFFECT = 0.4;
}

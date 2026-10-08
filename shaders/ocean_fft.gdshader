shader_type spatial;
render_mode cull_disabled, depth_draw_always;
/**
 * FFT ocean surface. Wave displacement/normal/foam cascades come from the compute
 * pipeline in addons/ocean_waves (Tessendorf FFT, JONSWAP/TMA spectrum).
 * Lighting follows the Atlas talk (GDC 2019) as in GodotOceanWaves; on top of it:
 *  - CDLOD geomorphing between the camera-following mesh rings (no cracks)
 *  - waves calm down over the reef and in the shallows (island shore distance field)
 *  - refraction + Beer-Lambert absorption through the real scene depth
 *  - shoreline foam: contact foam, wash bands rolling up the beach, reef surf
 */

#define MAX_CASCADES 4
#define REFLECTANCE 0.02

uniform vec4 water_color : source_color = vec4(0.02, 0.09, 0.11, 1.0);
uniform vec4 scatter_color : source_color = vec4(0.05, 0.32, 0.30, 1.0);
uniform vec4 foam_color : source_color = vec4(0.88, 0.90, 0.88, 1.0);
uniform vec3 absorption = vec3(0.45, 0.09, 0.07); // per metre (red dies first)
uniform float roughness : hint_range(0.0, 1.0) = 0.4;
uniform float normal_strength : hint_range(0.0, 2.0) = 1.0;
uniform float wave_scale = 1.0;

uniform vec4 map_scales[MAX_CASCADES];  // [uv scale xy, displacement scale, normal scale]
uniform int num_cascades = 3;
uniform sampler2DArray displacements : filter_linear_mipmap, repeat_enable;
uniform sampler2DArray normals : filter_linear_mipmap, repeat_enable;

// island shore signed distance (metres, + inland), covering shore_rect = (x0, z0, size)
uniform sampler2D shore_sdf : filter_linear, repeat_disable;
uniform vec4 shore_rect = vec4(-1024.0, -1024.0, 2048.0, 0.0);
uniform sampler2D foam_noise : filter_linear_mipmap, repeat_enable;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap, repeat_disable;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest, repeat_disable;

varying vec3 world_pos;
varying float wave_height;
varying float shore_d;
varying float calm;

float shore_distance(vec2 xz) {
	vec2 uv = (xz - shore_rect.xy) / shore_rect.z;
	if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return -2000.0;
	return texture(shore_sdf, uv).r;
}

void vertex() {
	// CDLOD morph: near the outer edge of each ring, odd vertices slide onto the
	// next ring's coarser grid so neighbouring rings meet exactly.
	float spacing = UV2.x;
	float extent = UV2.y;
	vec2 local = VERTEX.xz;
	float cheb = max(abs(local.x), abs(local.y));
	float morph = smoothstep(extent * 0.8, extent * 0.97, cheb);
	vec2 odd = mod(round(local / spacing), 2.0);  // 1 on odd grid lines
	local -= odd * spacing * morph;  // slide onto the even (coarser) neighbour
	VERTEX.xz = local;

	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec2 xz = world_pos.xz;
	shore_d = shore_distance(xz);
	// open sea -> reef -> lagoon -> beach: the lagoon is sheltered by the reef
	calm = mix(0.18, 1.0, smoothstep(-40.0, -230.0, shore_d));
	float dist_cam = length(xz - CAMERA_POSITION_WORLD.xz);
	float distance_factor = min(exp(-(dist_cam - 150.0) * 0.007), 1.0);

	vec3 displacement = vec3(0.0);
	for (int i = 0; i < num_cascades; ++i) {
		vec4 s = map_scales[i];
		displacement += texture(displacements, vec3(xz * s.xy, float(i))).xyz * s.z;
	}
	displacement *= wave_scale * calm;
	world_pos += displacement * distance_factor;
	VERTEX = (inverse(MODEL_MATRIX) * vec4(world_pos, 1.0)).xyz;
	wave_height = displacement.y;
}

varying float foam_factor;
varying float fresnel;

void fragment() {
	vec2 xz = world_pos.xz;
	float dist = length(world_pos - CAMERA_POSITION_WORLD);
	vec3 gradient = vec3(0.0);
	for (int i = 0; i < num_cascades; ++i) {
		vec4 s = map_scales[i];
		gradient += texture(normals, vec3(xz * s.xy, float(i))).xyw * vec3(s.ww, 1.0);
	}
	float whitecap = smoothstep(0.0, 1.0, gradient.z * 0.75) * exp(-dist * 0.0075) * calm;
	gradient.xy *= mix(0.6, 1.0, calm) * wave_scale;
	gradient.xy *= mix(0.02, normal_strength, exp(-dist * 0.0175));
	vec3 n_world = normalize(vec3(-gradient.x, 1.0, -gradient.y));
	bool under = CAMERA_POSITION_WORLD.y < world_pos.y;
	if (under) n_world = -n_world;
	NORMAL = (VIEW_MATRIX * vec4(n_world, 0.0)).xyz;

	// --- water thickness along the view ray (scene depth behind the surface) ---
	float scene_depth = textureLod(depth_tex, SCREEN_UV, 0.0).r;
	vec4 sv = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, scene_depth, 1.0);
	sv.xyz /= sv.w;
	float thickness = max(0.0, length(sv.xyz) - length(VERTEX));
	// refraction: bend the lookup by the surface normal, but never sample things in front
	vec2 ruv = SCREEN_UV + n_world.xz * 0.03 * clamp(thickness * 0.3, 0.0, 1.0) / max(1.0, dist * 0.02);
	float rdepth = textureLod(depth_tex, ruv, 0.0).r;
	vec4 rv = INV_PROJECTION_MATRIX * vec4(ruv * 2.0 - 1.0, rdepth, 1.0);
	rv.xyz /= rv.w;
	if (length(rv.xyz) < length(VERTEX)) { ruv = SCREEN_UV; } else { thickness = max(0.0, length(rv.xyz) - length(VERTEX)); }
	vec3 refracted = textureLod(screen_tex, ruv, 0.0).rgb;
	// the light travels down and back up: approximate vertical depth from the view thickness
	vec3 trans = exp(-absorption * thickness * 1.2);
	float murk = 1.0 - exp(-thickness * 0.16);

	// --- foam ---
	float n1 = texture(foam_noise, xz * 0.09 + TIME * vec2(0.010, 0.017)).r;
	float n2 = texture(foam_noise, xz * 0.23 - TIME * vec2(0.021, 0.008)).r;
	float fn = n1 * 0.6 + n2 * 0.4;
	float contact = smoothstep(0.9, 0.0, thickness) * smoothstep(0.25, 0.55, fn + 0.25);
	// wash bands rolling up the beach (period ~9 s), fading as they climb
	float sd = shore_d;
	float phase = sd * 0.28 + TIME * 0.7;
	float band = pow(0.5 + 0.5 * sin(phase), 6.0) * smoothstep(-26.0, -4.0, sd) * smoothstep(1.0, -2.0, sd);
	float wash = band * smoothstep(0.35, 0.65, fn);
	// surf breaking on the reef crest
	float reef = exp(-pow((sd + 150.0) / 14.0, 2.0)) * smoothstep(0.4, 0.75, fn + 0.25 * sin(TIME * 0.9 + xz.x * 0.05));
	foam_factor = clamp(max(whitecap, max(contact, max(wash, reef * 0.8))), 0.0, 1.0);

	fresnel = mix(pow(1.0 - clamp(dot(VIEW, NORMAL), 0.0, 1.0), 5.0 * exp(-2.69 * roughness)) / (1.0 + 22.7 * pow(roughness, 1.5)), 1.0, REFLECTANCE);
	// body colour: scattering builds up with depth; what is behind shows through with absorption
	vec3 body = mix(scatter_color.rgb, water_color.rgb, smoothstep(2.0, 25.0, thickness));
	vec3 through = refracted * trans;
	ALBEDO = mix(body * murk, foam_color.rgb, foam_factor);
	EMISSION = through * (1.0 - fresnel) * (1.0 - foam_factor);
	ROUGHNESS = mix(roughness * 0.35, 0.9, foam_factor);
	SPECULAR = 0.5;
}

float smith_masking_shadowing(in float cos_theta, in float alpha) {
	float a = cos_theta / (alpha * sqrt(1.0 - cos_theta * cos_theta));
	float a_sq = a * a;
	return a < 1.6 ? (1.0 - 1.259 * a + 0.396 * a_sq) / (3.535 * a + 2.181 * a_sq) : 0.0;
}

float ggx_distribution(in float cos_theta, in float alpha) {
	float a_sq = alpha * alpha;
	float d = 1.0 + (a_sq - 1.0) * cos_theta * cos_theta;
	return a_sq / (PI * d * d);
}

void light() {
	vec3 halfway = normalize(LIGHT + VIEW);
	float dot_nl = max(dot(NORMAL, LIGHT), 2e-5);
	float dot_nv = max(dot(NORMAL, VIEW), 2e-5);
	float light_mask = smith_masking_shadowing(roughness, dot_nv);
	float view_mask = smith_masking_shadowing(roughness, dot_nl);
	float microfacet = ggx_distribution(dot(NORMAL, halfway), roughness);
	float geo = 1.0 / (1.0 + light_mask + view_mask);
	SPECULAR_LIGHT += fresnel * microfacet * geo / (4.0 * dot_nv + 0.1) * ATTENUATION * LIGHT_COLOR * (1.0 - foam_factor);

	const vec3 sss_modifier = vec3(0.9, 1.15, 0.85);
	float sss_height = max(0.0, wave_height + 2.5) * pow(max(dot(LIGHT, -VIEW), 0.0), 4.0) * pow(0.5 - 0.5 * dot(LIGHT, NORMAL), 3.0);
	float sss_near = 0.5 * pow(dot_nv, 2.0);
	float lambertian = 0.5 * dot_nl;
	DIFFUSE_LIGHT += mix((sss_height + sss_near) * sss_modifier / (1.0 + light_mask) + lambertian, vec3(dot_nl), foam_factor)
		* (1.0 - fresnel) * ATTENUATION * LIGHT_COLOR;
}

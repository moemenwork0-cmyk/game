shader_type spatial;
render_mode diffuse_burley, specular_schlick_ggx;

uniform vec3 back_col : source_color = vec3(0.12, 0.22, 0.3);
uniform vec3 belly_col : source_color = vec3(0.78, 0.82, 0.8);
uniform float speed = 1.0;
uniform float phase = 0.0;

varying float side;

void vertex() {
	// body wave grows toward the tail (+z is the tail)
	float t = clamp(VERTEX.z * 3.5 + 0.3, 0.0, 1.0);
	VERTEX.x += sin(TIME * (6.0 + speed * 6.0) + VERTEX.z * 14.0 + phase) * 0.03 * t * (0.5 + speed);
	side = VERTEX.y;
}

void fragment() {
	float k = smoothstep(-0.02, 0.03, side);
	vec3 c = mix(belly_col, back_col, k);
	c *= 0.9 + 0.1 * sin(UV.x * 60.0);
	ALBEDO = c;
	METALLIC = 0.35;
	ROUGHNESS = 0.3;
}

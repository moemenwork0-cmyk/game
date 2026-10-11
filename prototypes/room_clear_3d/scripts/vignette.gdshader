shader_type canvas_item;
// Darkened screen edges, red blood rim when hurt, pulsing red at low health.
uniform float hurt = 0.0;
uniform float low = 0.0;

void fragment() {
	vec2 uv = UV - 0.5;
	uv.x *= 1.35;
	float d = length(uv);
	float edge = smoothstep(0.38, 0.9, d);
	float pulse = 0.55 + 0.45 * sin(TIME * 6.5);
	float red = smoothstep(0.28, 0.85, d) * clamp(hurt * 0.9 + low * pulse * 0.75, 0.0, 1.0);
	vec3 col = mix(vec3(0.0), vec3(0.45, 0.0, 0.0), clamp(red * 1.6, 0.0, 1.0));
	COLOR = vec4(col, clamp(edge * 0.55 + red * 0.85, 0.0, 0.95));
}

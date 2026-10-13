shader_type canvas_item;
// Darkens the left side (where the menu sits) and the edges, with faint scanlines.
void fragment() {
	float left = smoothstep(0.62, 0.0, UV.x);
	vec2 c = UV - vec2(0.62, 0.5);
	float vig = smoothstep(0.35, 0.95, length(c * vec2(1.2, 1.0)));
	float scan = 0.025 * step(0.5, fract(FRAGCOORD.y * 0.5));
	COLOR = vec4(0.01, 0.012, 0.012, clamp(left * 0.78 + vig * 0.55 + scan, 0.0, 0.95));
}

shader_type spatial;
// Second pass on the player: only draws where something is in front of him (inverted depth
// test), so he shows as a soft cyan silhouette behind walls and furniture.
render_mode unshaded, depth_draw_never, depth_test_inverted, cull_back, blend_mix;

uniform vec4 tint : source_color = vec4(0.35, 0.85, 1.0, 0.55);

void fragment() {
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 1.5);
	ALBEDO = tint.rgb;
	ALPHA = tint.a * (0.35 + 0.65 * rim);
}

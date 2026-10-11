shader_type canvas_item;
// Translucent dark backdrop for menus with a soft spotlight and faint scanlines.
void fragment() {
	vec2 uv = UV - 0.5;
	uv.x *= 1.6;
	float d = length(uv);
	float a = mix(0.55, 0.92, smoothstep(0.1, 0.85, d));
	float scan = 0.03 * sin(FRAGCOORD.y * 1.6);
	COLOR = vec4(vec3(0.02, 0.025, 0.02) + scan * 0.2, a);
}

shader_type canvas_item;
/** Waking up: two soft eyelids parting over a blurred, dimmed view that slowly comes
 into focus. open 0..1, blur in screen mip levels. */
uniform sampler2D screen : hint_screen_texture, filter_linear_mipmap;
uniform float open = 0.0;
uniform float blur = 4.0;
uniform float tint = 0.0;
void fragment() {
	vec3 c = textureLod(screen, SCREEN_UV, blur).rgb;
	// lids: an almond opening that widens from the middle
	vec2 p = (SCREEN_UV - 0.5) * vec2(1.0, 1.9);
	float lid = 1.0 - pow(abs(p.x) * 1.6, 2.0) * 0.35;
	float half_h = open * 0.62 * lid;
	float d = abs(p.y) - half_h;
	float a = smoothstep(-0.06, 0.08, d);
	// eyelashes / skin red glow near the edge, dark beyond
	vec3 skin = mix(vec3(0.12, 0.03, 0.02), vec3(0.0), smoothstep(0.0, 0.25, d));
	c = mix(c, c * vec3(1.0, 0.85, 0.8), tint);
	COLOR = vec4(mix(c, skin, a), 1.0);
}

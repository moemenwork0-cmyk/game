shader_type canvas_item;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform float strength = 0.0;

void fragment() {
	vec2 uv = SCREEN_UV;
	uv += vec2(sin(uv.y * 28.0 + TIME * 2.1), cos(uv.x * 23.0 + TIME * 1.7)) * 0.0035 * strength;
	vec3 c = textureLod(screen_tex, uv, 1.2 * strength).rgb;
	c = mix(c, c * vec3(0.3, 0.65, 0.78) + vec3(0.0, 0.03, 0.05), strength * 0.75);
	float vig = smoothstep(1.25, 0.35, length(SCREEN_UV - 0.5) * 1.6);
	c *= mix(1.0, vig, 0.6 * strength);
	COLOR = vec4(c, 1.0);
}

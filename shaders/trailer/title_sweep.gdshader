shader_type canvas_item;
/** A band of light sweeping across the title lettering (metal catching the sun). */
uniform float sweep = 0.0;   // -0.3 .. 1.3 across the label
uniform vec4 base : source_color = vec4(0.86, 0.8, 0.68, 1.0);
void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	float x = UV.x + UV.y * 0.35;
	float band = exp(-pow((x - sweep) * 9.0, 2.0));
	c.rgb = mix(base.rgb * c.rgb, vec3(1.0, 0.97, 0.9) * 1.6, band * 0.85);
	COLOR = c;
}

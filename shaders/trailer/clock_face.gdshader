shader_type spatial;
/** A tower clock face: opal glass dial, iron ring, hour marks, hands at a frozen time. */
uniform float hour = 4.7;      // the hour the world drowned
uniform float glow = 0.0;      // backlit dial
uniform float drowned = 0.0;
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	if (r > 1.0) discard;
	float a = atan(p.x, -p.y);  // 0 at 12 o'clock, clockwise
	vec3 dial = vec3(0.86, 0.84, 0.76);
	float ring = smoothstep(0.86, 0.88, r) * (1.0 - smoothstep(0.98, 1.0, r)) + smoothstep(0.66, 0.67, r) * (1.0 - smoothstep(0.69, 0.7, r));
	float tick = step(0.72, r) * step(r, 0.84) * step(abs(fract(a / (2.0 * PI) * 12.0 + 0.5) - 0.5), 0.03);
	float mtick = step(0.8, r) * step(r, 0.84) * step(abs(fract(a / (2.0 * PI) * 60.0 + 0.5) - 0.5), 0.08);
	float ha = hour / 12.0 * 2.0 * PI;
	float ma = fract(hour) * 2.0 * PI;
	vec2 hd = vec2(sin(ha), -cos(ha));
	vec2 md = vec2(sin(ma), -cos(ma));
	float hh = step(abs(dot(p, vec2(-hd.y, hd.x))), 0.035) * step(-0.08, dot(p, hd)) * step(dot(p, hd), 0.5);
	float mh = step(abs(dot(p, vec2(-md.y, md.x))), 0.022) * step(-0.08, dot(p, md)) * step(dot(p, md), 0.78);
	float ink = clamp(ring + tick + mtick * 0.6 + hh + mh + step(r, 0.05), 0.0, 1.0);
	vec3 col = mix(dial, vec3(0.04), ink);
	col = mix(col, col * vec3(0.4, 0.55, 0.42), drowned);
	ALBEDO = col;
	ROUGHNESS = mix(0.3, 0.9, drowned);
	EMISSION = vec3(1.0, 0.85, 0.6) * glow * (1.0 - ink) * 3.0;
}

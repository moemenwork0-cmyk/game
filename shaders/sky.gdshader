shader_type sky;

uniform vec3 sun_dir = vec3(0.0, 0.6, 0.6);
uniform sampler2D cloud_tex : filter_linear_mipmap, repeat_enable;
uniform float cloud_coverage = 0.46;

float hash3(vec3 p) {
	p = fract(p * vec3(443.897, 441.423, 437.195));
	p += dot(p, p.yxz + 19.19);
	return fract((p.x + p.y) * p.z);
}

void sky() {
	vec3 d = normalize(EYEDIR);
	vec3 s = normalize(sun_dir);
	float sh = s.y;
	float day = smoothstep(-0.22, 0.12, sh);
	float sunset = 1.0 - smoothstep(0.0, 0.32, abs(sh + 0.03));
	float up = max(d.y, 0.0);
	float sd = max(dot(d, s), 0.0);

	vec3 zen = mix(vec3(0.003, 0.006, 0.018), vec3(0.10, 0.28, 0.68), day);
	vec3 hor = mix(vec3(0.015, 0.025, 0.05), vec3(0.60, 0.74, 0.90), day);
	hor = mix(hor, vec3(1.0, 0.42, 0.16), sunset * (0.3 + 0.7 * pow(sd, 3.0)));
	zen = mix(zen, vec3(0.25, 0.22, 0.42), sunset * 0.35);
	vec3 col = mix(hor, zen, pow(up, 0.42));
	if (d.y < 0.0) {
		vec3 sea = mix(vec3(0.004, 0.01, 0.02), vec3(0.03, 0.12, 0.2), day);
		col = mix(hor, sea, smoothstep(0.0, -0.08, d.y));
	}

	// mie scattering around the sun
	float sun_vis = smoothstep(-0.12, 0.05, sh);
	col += vec3(1.0, 0.75, 0.5) * pow(sd, 10.0) * 0.45 * sun_vis;
	col += vec3(1.0, 0.8, 0.6) * pow(sd, 90.0) * 1.2 * sun_vis;
	// sun disc
	float disc = smoothstep(0.99955, 0.99975, sd) * smoothstep(-0.02, 0.01, d.y);
	col += vec3(30.0, 25.0, 18.0) * disc * sun_vis;

	// moon
	vec3 m = -s;
	float md = max(dot(d, m), 0.0);
	float moon_vis = 1.0 - day;
	col += vec3(2.4, 2.5, 2.8) * smoothstep(0.99962, 0.99978, md) * moon_vis;
	col += vec3(0.06, 0.08, 0.12) * pow(md, 40.0) * moon_vis;

	// stars
	if (!AT_CUBEMAP_PASS) {
		vec3 q = d * 260.0;
		vec3 cell = floor(q);
		float h = hash3(cell);
		if (h > 0.9975) {
			vec3 center = cell + 0.5;
			float dist = length(q - center);
			float star = smoothstep(0.5, 0.0, dist);
			float tw = 0.65 + 0.35 * sin(TIME * (2.0 + h * 5.0) + h * 80.0);
			col += vec3(0.9, 0.95, 1.0) * star * tw * 2.0 * moon_vis * smoothstep(0.0, 0.15, d.y);
		}
	}

	// clouds
	if (d.y > 0.0) {
		vec2 uv = d.xz / (d.y + 0.14);
		float n = texture(cloud_tex, uv * 0.09 + TIME * vec2(0.0012, 0.0005)).r * 0.65;
		n += texture(cloud_tex, uv * 0.27 + TIME * vec2(0.0025, 0.001)).r * 0.35;
		float c = smoothstep(1.0 - cloud_coverage, 1.0 - cloud_coverage + 0.28, n);
		c *= smoothstep(0.0, 0.18, d.y);
		vec3 lit = mix(vec3(1.0, 0.55, 0.35), vec3(1.0, 0.98, 0.95), smoothstep(0.0, 0.35, sh));
		lit = mix(vec3(0.025, 0.03, 0.045), lit, day);
		lit *= mix(1.0, 0.62, smoothstep(0.55, 1.0, n));
		lit += vec3(1.0, 0.8, 0.6) * pow(sd, 6.0) * 0.7 * day;
		col = mix(col, lit, c * 0.93);
	}
	COLOR = col;
}

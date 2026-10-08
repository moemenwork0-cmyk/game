shader_type sky;
render_mode use_debanding;
/**
 * Island sky: single-scattering atmosphere (Rayleigh + Mie, ozone tint), sun and moon
 * disks, a star field with the Milky Way at night, and a cheap 2D cloud deck for
 * low settings / far distance (volumetric clouds draw on top when enabled).
 * LIGHT0 = sun, LIGHT1 = moon.
 */

uniform float exposure = 18.0;
uniform vec3 rayleigh_beta = vec3(5.8e-6, 13.5e-6, 33.1e-6);
uniform float mie_beta = 2.1e-5;
uniform float mie_g = 0.78;
uniform float turbidity = 1.0;
uniform vec3 ozone_beta = vec3(0.65e-6, 1.88e-6, 0.085e-6);
uniform float sun_disk_size = 0.0095;
uniform float moon_disk_size = 0.0085;
uniform float moon_phase = 0.25;           // 0 new, 0.5 full
uniform float star_intensity = 1.0;
uniform float cloud_coverage : hint_range(0.0, 1.0) = 0.4;
uniform float cloud_opacity : hint_range(0.0, 1.0) = 1.0;
uniform vec2 cloud_offset = vec2(0.0);
uniform float storm : hint_range(0.0, 1.0) = 0.0;
uniform vec3 ground_color : source_color = vec3(0.06, 0.08, 0.09);

const float R_E = 6360e3;
const float R_A = 6420e3;
const float H_R = 8000.0;
const float H_M = 1200.0;

vec2 ray_sphere(vec3 ro, vec3 rd, float r) {
	float b = dot(ro, rd);
	float c = dot(ro, ro) - r * r;
	float d = b * b - c;
	if (d < 0.0) return vec2(-1.0);
	d = sqrt(d);
	return vec2(-b - d, -b + d);
}

vec3 atmosphere(vec3 rd, vec3 sd, float sun_energy) {
	vec3 ro = vec3(0.0, R_E + 2.0, 0.0);
	vec2 t = ray_sphere(ro, rd, R_A);
	float tmax = t.y;
	vec2 tg = ray_sphere(ro, rd, R_E);
	if (tg.x > 0.0) tmax = tg.x;
	const int STEPS = 12;
	const int LSTEPS = 4;
	float ds = tmax / float(STEPS);
	vec3 sum_r = vec3(0.0);
	vec3 sum_m = vec3(0.0);
	float od_r = 0.0;
	float od_m = 0.0;
	float mu = dot(rd, sd);
	float pr = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
	float g = mie_g;
	float pm = 3.0 / (8.0 * PI) * ((1.0 - g * g) * (1.0 + mu * mu)) / ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
	vec3 bm = vec3(mie_beta * turbidity);
	for (int i = 0; i < STEPS; i++) {
		vec3 p = ro + rd * (float(i) + 0.5) * ds;
		float h = length(p) - R_E;
		float hr = exp(-h / H_R) * ds;
		float hm = exp(-h / H_M) * ds;
		od_r += hr;
		od_m += hm;
		vec2 tl = ray_sphere(p, sd, R_A);
		float dl = tl.y / float(LSTEPS);
		float lr = 0.0;
		float lm = 0.0;
		bool blocked = false;
		for (int j = 0; j < LSTEPS; j++) {
			vec3 q = p + sd * (float(j) + 0.5) * dl;
			float hq = length(q) - R_E;
			if (hq < 0.0) { blocked = true; break; }
			lr += exp(-hq / H_R) * dl;
			lm += exp(-hq / H_M) * dl;
		}
		if (!blocked) {
			vec3 tau = rayleigh_beta * (od_r + lr) + bm * 1.1 * (od_m + lm) + ozone_beta * (od_r + lr) * 2.5;
			vec3 att = exp(-tau);
			sum_r += att * hr;
			sum_m += att * hm;
		}
	}
	return sun_energy * (sum_r * rayleigh_beta * pr + sum_m * bm * pm);
}

float hash13(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.zyx + 31.32);
	return fract((p.x + p.y) * p.z);
}

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y);
}

float fbm(vec2 p) {
	float a = 0.5;
	float s = 0.0;
	for (int i = 0; i < 6; i++) {
		s += a * vnoise(p);
		p = p * 2.03 + vec2(1.7, 9.2);
		a *= 0.5;
	}
	return s;
}

vec3 stars(vec3 rd) {
	vec3 p = rd * 300.0;
	vec3 c = floor(p);
	float h = hash13(c);
	float s = 0.0;
	if (h > 0.9965) {
		vec3 f = fract(p) - 0.5;
		float d = length(f);
		float tw = 0.75 + 0.25 * sin(TIME * (2.0 + h * 9.0) + h * 80.0);
		s = smoothstep(0.42, 0.0, d) * pow((h - 0.9965) / 0.0035, 3.0) * tw;
	}
	// Milky Way: a soft band across the sky
	vec3 band_n = normalize(vec3(0.35, 0.25, 0.9));
	float band = exp(-pow(dot(rd, band_n) * 3.4, 2.0)) * (0.5 + 0.5 * fbm(rd.xz * 9.0 + rd.y * 4.0));
	vec3 col = vec3(s) * mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.85, 0.7), hash13(c + 7.0));
	return col * 3.0 + vec3(0.45, 0.5, 0.65) * band * 0.06;
}

void sky() {
	vec3 rd = EYEDIR;
	vec3 sd = LIGHT0_ENABLED ? LIGHT0_DIRECTION : vec3(0.0, -1.0, 0.0);
	float sun_e = LIGHT0_ENABLED ? 22.0 : 0.0;
	vec3 view = rd;
	view.y = max(view.y, 0.0005);
	vec3 col = atmosphere(normalize(view), sd, sun_e) * exposure;
	// night: moon-lit sky and stars
	vec3 md = LIGHT1_ENABLED ? LIGHT1_DIRECTION : -sd;
	float night = smoothstep(0.05, -0.18, sd.y);
	col += atmosphere(normalize(view), md, 22.0) * exposure * 0.0025 * night;
	col += stars(rd) * night * star_intensity * smoothstep(-0.02, 0.15, rd.y);

	// sun disk with limb darkening
	float sun_d = acos(clamp(dot(rd, sd), -1.0, 1.0));
	if (sun_d < sun_disk_size && sd.y > -0.1) {
		float limb = 1.0 - pow(sun_d / sun_disk_size, 2.0);
		vec3 trans = exp(-(rayleigh_beta * 8e3 + vec3(mie_beta * turbidity) * 1.2e3) / max(0.03, sd.y + 0.05));
		col += vec3(40.0) * trans * pow(limb, 0.4) * LIGHT0_ENERGY;
	}
	// moon disk with phase
	float moon_d = acos(clamp(dot(rd, md), -1.0, 1.0));
	if (moon_d < moon_disk_size) {
		vec3 side = normalize(cross(md, vec3(0.0, 1.0, 0.0)));
		float x = dot(rd - md, side) / moon_disk_size;
		float lit = smoothstep(-0.12, 0.12, x - cos(moon_phase * TAU));
		float mare = 0.82 + 0.18 * fbm((rd - md).xz * 600.0);
		col += vec3(0.9, 0.92, 1.0) * 0.6 * mare * lit * (0.25 + 0.75 * night);
	}

	// cloud deck (2D): project onto a plane ~2 km up
	if (rd.y > 0.0 && cloud_opacity > 0.0) {
		vec2 cp = rd.xz / (rd.y + 0.08) * 1.6 + cloud_offset;
		float n = fbm(cp * 1.3);
		float detail = fbm(cp * 5.0 + 3.1);
		float dens = smoothstep(1.0 - cloud_coverage, 1.0 - cloud_coverage + 0.35, n * 0.8 + detail * 0.3);
		// light: brighter where the sun is behind (silver lining), darker undersides
		float sun_up = clamp(sd.y * 3.0, 0.0, 1.0);
		vec3 sun_col = atmosphere(sd * vec3(1.0, 1.0, 1.0) + vec3(0.0, 0.02, 0.0), sd, sun_e) * exposure * 0.6 + vec3(0.02);
		float self_shadow = clamp(1.0 - (fbm((cp + sd.xz * 0.05) * 1.3) - n) * 3.0, 0.3, 1.0);
		float fwd = pow(max(dot(rd, sd), 0.0), 8.0);
		vec3 ccol = mix(col * 0.65 + vec3(0.03), sun_col * (0.6 + 0.8 * fwd) * self_shadow + col * 0.25, sun_up);
		// storm clouds: heavy, dark slate undersides with lighter tops where they billow
		ccol = mix(ccol, vec3(0.05, 0.06, 0.07) * (0.6 + 0.8 * detail) * (0.3 + sun_up), storm);
		ccol = mix(ccol, col * 0.4 + vec3(0.004, 0.005, 0.008), night);
		float fade = smoothstep(0.0, 0.18, rd.y);
		col = mix(col, ccol, dens * cloud_opacity * fade);
	}
	col = mix(col, col * vec3(0.32, 0.35, 0.38) + vec3(0.012), storm * 0.85);
	if (rd.y < 0.0) {
		col = mix(col, ground_color * (0.2 + 0.8 * clamp(sd.y * 4.0, 0.02, 1.0)), smoothstep(0.0, -0.08, rd.y));
	}
	COLOR = col;
}

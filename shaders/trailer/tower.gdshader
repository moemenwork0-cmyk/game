shader_type spatial;
/** Procedural high-rise facade: concrete frame, glass curtain wall in a floor/bay grid,
 lit and dark offices, broken panes, weathering streaks; below `water_y` it turns into
 a drowned wreck (silt, algae, rust). Mapped in world space so any box becomes a tower. */

uniform vec3 concrete : source_color = vec3(0.52, 0.5, 0.47);
uniform vec3 glass : source_color = vec3(0.06, 0.09, 0.11);
uniform float floor_h = 3.6;
uniform float bay_w = 3.0;
uniform float lit = 0.25;        // fraction of lit windows
uniform float flicker = 0.0;     // power failing
uniform float water_y = -1000.0; // drowned below this
uniform float seed = 0.0;
uniform float broken = 0.1;
varying vec3 wp;
varying vec3 wn;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 17.3) * 43758.5453); }
float n2(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}

void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec3 an = abs(wn);
	float u = an.x > an.z ? wp.z : wp.x;
	float v = wp.y;
	vec3 col = concrete;
	float rough = 0.85;
	float metal = 0.0;
	vec3 emit = vec3(0.0);
	if (an.y < 0.5) {
		vec2 cell = vec2(u / bay_w, v / floor_h);
		vec2 id = floor(cell);
		vec2 f = fract(cell);
		float frame = step(0.1, f.x) * step(f.x, 0.92) * step(0.22, f.y) * step(f.y, 0.92);
		float rnd = h21(id + floor(wp.xz / 50.0));
		float isbroken = step(1.0 - broken, h21(id * 1.7 + 3.1));
		vec3 g = glass * (0.7 + 0.6 * rnd);
		// warm/cool office light
		float on = step(1.0 - lit, rnd) * (1.0 - isbroken);
		on *= 1.0 - flicker * step(0.5, fract(sin(TIME * 23.0 + rnd * 80.0) * 9.1));
		vec3 lc = mix(vec3(1.0, 0.72, 0.42), vec3(0.75, 0.86, 1.0), step(0.6, h21(id + 7.0)));
		col = mix(col, isbroken > 0.5 ? vec3(0.02) : g, frame);
		rough = mix(rough, isbroken > 0.5 ? 1.0 : 0.06, frame);
		metal = mix(0.0, isbroken > 0.5 ? 0.0 : 0.6, frame);
		emit = lc * on * frame * (0.4 + 0.6 * h21(id + 3.0)) * 1.6;
		// rain streaks and soot under the slabs
		float streak = n2(vec2(u * 1.3, v * 0.08)) * (1.0 - smoothstep(0.0, 0.25, f.y));
		col *= 1.0 - streak * 0.35;
	} else {
		col *= 0.55; // roofs: tar and gravel
	}
	// large-scale grime
	col *= 0.8 + 0.35 * n2(wp.xz * 0.03 + wp.y * 0.05);
	if (wp.y < water_y) {
		float depth = clamp((water_y - wp.y) / 40.0, 0.0, 1.0);
		float algae = n2(vec2(u, v) * 0.6) * 0.6 + n2(vec2(u, v) * 3.0) * 0.4;
		col = mix(col * vec3(0.55, 0.62, 0.5), vec3(0.16, 0.2, 0.1), smoothstep(0.35, 0.7, algae));
		col = mix(col, vec3(0.2, 0.18, 0.12), depth * 0.5);
		emit = vec3(0.0);
		rough = 0.95;
		metal = 0.0;
	}
	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metal;
	SPECULAR = 0.5;
	EMISSION = emit;
}

class_name TrailerFire
extends Node3D
## A cinematic fire: layered flame sprites, rising embers, smoke and a flickering
## shadow-casting light. `size` 1 = campfire, ~0.3 = torch head. `blaze` 0..1 ramps it up.

var size := 1.0
var blaze := 1.0
var flames: GPUParticles3D
var embers: GPUParticles3D
var smoke: GPUParticles3D
var light: OmniLight3D
var _t := 0.0


static func create(p_size: float) -> TrailerFire:
	var f := TrailerFire.new()
	f.size = p_size
	return f


func _ready() -> void:
	flames = _particles(160, 0.6, 0.16 * size, Vector3.UP, 1.1 * size, 0.0, 0.26 * size, true,
		[Color(1, 0.85, 0.5, 0.7), Color(1, 0.42, 0.08, 0.5), Color(0.5, 0.08, 0.02, 0.0)], 1.0)
	embers = _particles(60, 2.2, 0.25 * size, Vector3.UP, 2.5 * size, -0.4, 0.03 * size, true,
		[Color(1, 0.7, 0.3, 1), Color(1, 0.35, 0.05, 0.8), Color(1, 0.2, 0, 0)], 2.5)
	(embers.process_material as ParticleProcessMaterial).turbulence_enabled = true
	(embers.process_material as ParticleProcessMaterial).turbulence_noise_strength = 1.5
	smoke = _particles(40, 4.0, 0.3 * size, Vector3.UP, 1.0 * size, -0.1, 1.2 * size, false,
		[Color(0.2, 0.18, 0.16, 0.0), Color(0.15, 0.14, 0.13, 0.35), Color(0.3, 0.3, 0.3, 0)], 0.0)
	smoke.position.y = 0.8 * size
	light = OmniLight3D.new()
	light.light_color = Color(1.0, 0.58, 0.25)
	light.omni_range = 9.0 * maxf(size, 0.5)
	light.shadow_enabled = true
	light.position.y = 0.5 * size
	add_child(light)


func _particles(n: int, life: float, radius: float, dir: Vector3, vel: float, grav: float, sz: float,
		additive: bool, ramp: Array, emit: float) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = n
	p.lifetime = life
	p.preprocess = life
	var m := ParticleProcessMaterial.new()
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	m.emission_sphere_radius = radius
	m.direction = dir
	m.spread = 14.0
	m.initial_velocity_min = vel * 0.5
	m.initial_velocity_max = vel
	m.gravity = Vector3(0, -grav * 9.8, 0)
	m.scale_min = 0.6
	m.scale_max = 1.3
	var sc := Curve.new()
	sc.add_point(Vector2(0, 0.6))
	sc.add_point(Vector2(0.3, 1.0))
	sc.add_point(Vector2(1, 0.2 if additive else 2.0))
	var ct := CurveTexture.new()
	ct.curve = sc
	m.scale_curve = ct
	var g := Gradient.new()
	g.colors = PackedColorArray(ramp)
	var gt := GradientTexture1D.new()
	gt.gradient = g
	m.color_ramp = gt
	p.process_material = m
	var q := QuadMesh.new()
	q.size = Vector2(sz, sz)
	var sm := Fx.soft_sprite_material(additive)
	if emit > 0.0:
		sm.albedo_color = Color(emit, emit, emit)
	q.material = sm
	p.draw_pass_1 = q
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(p)
	return p


func _process(delta: float) -> void:
	_t += delta
	var fl := 0.75 + 0.15 * sin(_t * 17.0) + 0.1 * sin(_t * 31.0 + 1.3) + 0.08 * sin(_t * 7.0)
	light.light_energy = 2.2 * size * fl * blaze
	flames.amount_ratio = clampf(blaze, 0.05, 1.0)
	embers.amount_ratio = clampf(blaze, 0.0, 1.0) * (1.0 if size > 0.6 else 0.25)
	smoke.amount_ratio = clampf(blaze, 0.1, 1.0)
	flames.scale = Vector3.ONE * lerpf(0.3, 1.0, blaze)

class_name Fx
extends RefCounted
## One-shot particle bursts (wood chips, dirt, stone, leaves, splashes).

static var _mesh_cache := {}


static func burst(pos: Vector3, color: Color, amount: int = 16, speed: float = 3.0,
		size: float = 0.05, life: float = 1.2, gravity: float = 9.8, dir: Vector3 = Vector3.UP,
		spread: float = 60.0, flat: bool = false) -> void:
	var tree := Engine.get_main_loop() as SceneTree
	if tree == null or tree.current_scene == null:
		return
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = life
	p.one_shot = true
	p.explosiveness = 0.95
	p.fixed_fps = 0
	var m := ParticleProcessMaterial.new()
	m.direction = dir.normalized()
	m.spread = spread
	m.initial_velocity_min = speed * 0.4
	m.initial_velocity_max = speed
	m.gravity = Vector3(0, -gravity, 0)
	m.angular_velocity_min = -540.0
	m.angular_velocity_max = 540.0
	m.scale_min = 0.5
	m.scale_max = 1.3
	m.damping_min = 0.5
	m.damping_max = 2.0
	m.color = color
	m.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_SPHERE
	m.emission_sphere_radius = 0.08
	var sc := Curve.new()
	sc.add_point(Vector2(0, 1))
	sc.add_point(Vector2(0.8, 0.9))
	sc.add_point(Vector2(1, 0))
	var ct := CurveTexture.new()
	ct.curve = sc
	m.scale_curve = ct
	p.process_material = m
	var key := "%s_%s" % [size, flat]
	if not _mesh_cache.has(key):
		var bm := BoxMesh.new()
		bm.size = Vector3(size, size * (0.25 if flat else 0.8), size * (1.0 if flat else 0.9))
		var mat := StandardMaterial3D.new()
		mat.vertex_color_use_as_albedo = true
		mat.roughness = 0.9
		bm.material = mat
		_mesh_cache[key] = bm
	p.draw_pass_1 = _mesh_cache[key]
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	tree.current_scene.add_child(p)
	p.global_position = pos
	p.emitting = true
	tree.create_timer(life + 0.6).timeout.connect(p.queue_free)


static func splash(pos: Vector3, strength: float = 1.0) -> void:
	burst(pos, Color(0.85, 0.92, 0.95), int(12 + 20 * strength), 2.0 + 2.5 * strength, 0.07, 0.9, 9.8, Vector3.UP, 35.0)


## Soft round sprite used by fire and smoke.
static func soft_sprite_material(additive: bool) -> StandardMaterial3D:
	var g := Gradient.new()
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0)])
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(0.5, 0.0)
	gt.width = 64
	gt.height = 64
	var m := StandardMaterial3D.new()
	m.albedo_texture = gt
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if additive else BaseMaterial3D.BLEND_MODE_MIX
	m.vertex_color_use_as_albedo = true
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return m

extends TrailerShot
## Montage, slow motion: under the lagoon's bright ceiling a spear streaks past camera
## trailing bubbles; above it the long shadow of a tiger shark glides over.

var shark: Shark
var spear: Node3D
var trail: GPUParticles3D


func build(tr: Trailer) -> void:
	duration = 2.6
	speed = 0.45
	tr.sky.hour = 12.5
	tr.sky.underwater = true
	tr.sky.underwater_tint = Color(0.1, 0.42, 0.45)
	tr.sky.underwater_density = 0.022
	var surf := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(2000, 2000)
	pm.flip_faces = true
	surf.mesh = pm
	var sm := ShaderMaterial.new()
	sm.shader = preload("res://shaders/trailer/under_surface.gdshader")
	surf.material_override = sm
	surf.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	surf.position.y = 6.0
	tr.add_child(surf)
	# sandy floor with coral heads
	var floor := MeshInstance3D.new()
	var fp := PlaneMesh.new()
	fp.size = Vector2(800, 800)
	floor.mesh = fp
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.75, 0.68, 0.52)
	fm.roughness = 1.0
	floor.material_override = fm
	floor.position.y = -4.0
	tr.add_child(floor)
	var rock := load("res://assets/env/models/rock_moss_set_01.glb") as PackedScene
	for i in 14:
		var r := rock.instantiate() as Node3D
		tr.add_child(r)
		r.position = Vector3(randf_range(-30, 30), -4.2, randf_range(-40, 10))
		r.scale = Vector3.ONE * randf_range(0.8, 2.2)
		r.rotation.y = randf() * TAU
	shark = Shark.new()
	shark.length = 4.6
	shark.speed = 2.6
	tr.add_child(shark)
	shark.position = Vector3(-6, 2.2, -3.5)
	shark.rotation.y = -PI * 0.42   # gliding across, left to right
	spear = Node3D.new()
	var shaft := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.018
	cm.bottom_radius = 0.022
	cm.height = 2.2
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color(0.45, 0.33, 0.2)
	cm.material = wm
	shaft.mesh = cm
	shaft.rotation.x = PI * 0.5
	spear.add_child(shaft)
	var tip := MeshInstance3D.new()
	var tc := CylinderMesh.new()
	tc.top_radius = 0.0
	tc.bottom_radius = 0.03
	tc.height = 0.25
	tc.material = wm
	tip.mesh = tc
	tip.rotation.x = -PI * 0.5
	tip.position.z = -1.2
	spear.add_child(tip)
	tr.add_child(spear)
	spear.position = Vector3(-2.5, 0.2, 3.0)
	spear.look_at(Vector3(4, 1.6, -9))
	trail = GPUParticles3D.new()
	trail.amount = 300
	trail.lifetime = 3.0
	trail.local_coords = false
	var m := ParticleProcessMaterial.new()
	m.gravity = Vector3(0, 0.8, 0)
	m.initial_velocity_max = 0.2
	m.scale_min = 0.3
	m.scale_max = 1.0
	trail.process_material = m
	var s := SphereMesh.new()
	s.radius = 0.015
	s.height = 0.03
	var bm := StandardMaterial3D.new()
	bm.albedo_color = Color(0.85, 0.97, 1.0, 0.4)
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.rim_enabled = true
	s.material = bm
	trail.draw_pass_1 = s
	spear.add_child(trail)
	trail.position.z = 1.0
	keys = [
		[0.0, Vector3(0.5, -1.2, 1.5), Vector3(0, 3.5, -6), 52.0, 0.0],
		[2.6, Vector3(0.3, -1.1, 1.2), Vector3(0.6, 3.6, -6), 50.0, 0.0],
	]


func tick(_time: float, dt: float) -> void:
	# the spear flies at 14 m/s of world time
	spear.position += -spear.global_basis.z * 14.0 * dt * speed

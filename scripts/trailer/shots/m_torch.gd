extends TrailerShot
## Montage: night at the edge of the jungle. Layla lifts a torch and stares into the
## dark sea; the wind tears at the flame; far out, lightning.

var layla: Actor
var fire: TrailerFire


func build(tr: Trailer) -> void:
	duration = 2.6
	tr.sky.hour = 22.0
	tr.sky.storm = 0.3
	var at := Vector3(-5, 0, 432)
	await tr.add_island(at, 140.0, 1.4)
	at.y = tr.ground(at.x, at.z)
	layla = Actor.create("layla", {"look": "m_idle_look_around_01"})
	tr.add_child(layla)
	layla.global_position = at
	layla.rotation.y = PI  # facing +Z, the sea
	layla.ready.connect(func() -> void:
		layla.play("look", 0.0, 0.6, 2.0)
		layla.feel({"fear": 0.5}, 0.1)
		var ba := BoneAttachment3D.new()
		ba.bone_name = "Bip01 R Hand"
		layla.skel.add_child(ba)
		var stick := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.025
		cm.bottom_radius = 0.02
		cm.height = 0.7
		var wm := StandardMaterial3D.new()
		wm.albedo_color = Color(0.3, 0.2, 0.12)
		cm.material = wm
		stick.mesh = cm
		ba.add_child(stick)
		var sc := layla.skel.global_basis.get_scale().x
		stick.scale = Vector3.ONE / maxf(sc, 0.0001)
		fire = TrailerFire.create(0.35)
		stick.add_child(fire)
		fire.position.y = 0.38)
	var head := at + Vector3(0, 1.62, 0)
	keys = [
		[0.0, head + Vector3(-0.9, -0.05, -1.3), head + Vector3(0.2, 0.0, 0), 36.0, 1.6],
		[2.6, head + Vector3(-0.7, 0.0, -1.0), head + Vector3(0.2, 0.0, 0), 33.0, 1.2],
	]
	events = [[1.4, func() -> void: tr.lightning(at + Vector3(-200, 150, 900), 0.6)]]

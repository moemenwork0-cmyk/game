class_name RainCollector
extends StaticBody3D
## Wooden frame with a leaf funnel over a barrel. Fills with rain (and a little dew).

const CAPACITY := 10.0

var water := 2.0


static func create(pos: Vector3, yaw: float = 0.0) -> RainCollector:
	var c := RainCollector.new()
	Game.props.add_child(c)
	c.global_position = pos
	c.rotation.y = yaw
	return c


func _ready() -> void:
	add_to_group("collectors")
	collision_layer = Game.L_STRUCT
	collision_mask = 0
	var barrel := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.32
	cm.bottom_radius = 0.28
	cm.height = 0.7
	cm.material = Mats.get_mat("wood")
	barrel.mesh = cm
	barrel.position.y = 0.35
	add_child(barrel)
	for i in 4:
		var post := MeshInstance3D.new()
		var pm := BoxMesh.new()
		pm.size = Vector3(0.06, 1.5, 0.06)
		pm.material = Mats.get_mat("wood")
		post.mesh = pm
		var a := TAU * i / 4.0 + PI / 4.0
		post.position = Vector3(cos(a) * 0.6, 0.75, sin(a) * 0.6)
		add_child(post)
	var funnel := MeshInstance3D.new()
	var fm := CylinderMesh.new()
	fm.top_radius = 0.85
	fm.bottom_radius = 0.12
	fm.height = 0.4
	fm.material = Mats.get_mat("leaves_bush")
	funnel.mesh = fm
	funnel.position.y = 1.15
	add_child(funnel)
	var surf := MeshInstance3D.new()
	surf.name = "WaterSurface"
	var wm := CylinderMesh.new()
	wm.top_radius = 0.27
	wm.bottom_radius = 0.27
	wm.height = 0.01
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.1, 0.25, 0.3)
	mat.roughness = 0.05
	wm.material = mat
	surf.mesh = wm
	add_child(surf)
	var cs := CollisionShape3D.new()
	var cy := CylinderShape3D.new()
	cy.radius = 0.45
	cy.height = 1.4
	cs.shape = cy
	cs.position.y = 0.7
	add_child(cs)


func _process(_delta: float) -> void:
	var hours := Game.day_night.last_hours_step if Game.day_night else 0.0
	var r := Game.weather.rain if Game.weather else 0.0
	water = minf(water + hours * (r * 2.5 + 0.05), CAPACITY)
	($WaterSurface as Node3D).position.y = 0.05 + 0.62 * water / CAPACITY


func drink(vitals: Vitals) -> void:
	if water < 1.0:
		Game.toast.emit(tr("The collector is empty — wait for rain"))
		return
	var need := ceilf((100.0 - vitals.water) / 20.0)
	var sips := minf(floorf(water), maxf(need, 1.0))
	water -= sips
	vitals.drink(sips * 20.0)
	Game.toast.emit(tr("You drink fresh rainwater"))

class_name BridgeSet
extends Node3D
## The Murjan's wheelhouse, built in the ship's local space (bow toward -Z),
## on top of the accommodation block. Walls are real slabs, so it reads from
## outside (warm windows in the storm) and inside (where the prologue plays).
## A physical body moves with the ship so loose objects and ragdolls are
## thrown around by the actual motion of the hull.

const FLOOR := 7.8
const CEIL := 10.4
const FRONT := 7.0
const BACK := 11.4
const HALF := 3.2

var body: AnimatableBody3D
var lamp_light: OmniLight3D
var lamp_body: RigidBody3D
var emergency: OmniLight3D
var console_lights: Array[Light3D] = []
var glass_panes: Array[MeshInstance3D] = []
var screens: Array[MeshInstance3D] = []
var loose: Array[RigidBody3D] = []
var lightning: OmniLight3D
var _pin: PinJoint3D

var _wall: StandardMaterial3D
var _wood: StandardMaterial3D
var _metal: StandardMaterial3D
var _dark: StandardMaterial3D
var _glass: ShaderMaterial


func _ready() -> void:
	_materials()
	body = AnimatableBody3D.new()
	body.sync_to_physics = true
	body.collision_layer = Game.L_STRUCT
	body.collision_mask = 0
	add_child(body)
	var cy := (FLOOR + CEIL) * 0.5
	var cz := (FRONT + BACK) * 0.5
	var depth := BACK - FRONT
	# floor, ceiling, back wall
	_slab(Vector3(HALF * 2, 0.12, depth), Vector3(0, FLOOR - 0.06, cz), _wood)
	_slab(Vector3(HALF * 2, 0.12, depth), Vector3(0, CEIL + 0.06, cz), _wall)
	_slab(Vector3(HALF * 2, CEIL - FLOOR, 0.12), Vector3(0, cy, BACK + 0.06), _wall)
	# front wall: solid below and above a band of three windows
	var win_lo := 8.9
	var win_hi := 10.0
	_slab(Vector3(HALF * 2, win_lo - FLOOR, 0.14), Vector3(0, (FLOOR + win_lo) * 0.5, FRONT - 0.07), _wall)
	_slab(Vector3(HALF * 2, CEIL - win_hi, 0.14), Vector3(0, (CEIL + win_hi) * 0.5, FRONT - 0.07), _wall)
	for x in [-HALF + 0.05, -1.0, 1.0, HALF - 0.05]:
		_slab(Vector3(0.1, win_hi - win_lo, 0.16), Vector3(x, (win_lo + win_hi) * 0.5, FRONT - 0.07), _metal)
	for xs in [[-HALF + 0.1, -1.05], [-0.95, 0.95], [1.05, HALF - 0.1]]:
		var w: float = xs[1] - xs[0]
		glass_panes.append(_pane(Vector3(w, win_hi - win_lo, 0.02), Vector3((xs[0] + xs[1]) * 0.5, (win_lo + win_hi) * 0.5, FRONT - 0.07)))
	# side walls, each with one window
	for side in [-1.0, 1.0]:
		var x: float = side * (HALF + 0.07)
		_slab(Vector3(0.14, win_lo - FLOOR, depth), Vector3(x, (FLOOR + win_lo) * 0.5, cz), _wall)
		_slab(Vector3(0.14, CEIL - win_hi, depth), Vector3(x, (CEIL + win_hi) * 0.5, cz), _wall)
		_slab(Vector3(0.14, win_hi - win_lo, BACK - 9.6), Vector3(x, (win_lo + win_hi) * 0.5, (9.6 + BACK) * 0.5), _wall)
		_slab(Vector3(0.14, win_hi - win_lo, 7.8 - FRONT), Vector3(x, (win_lo + win_hi) * 0.5, (FRONT + 7.8) * 0.5), _wall)
		glass_panes.append(_pane(Vector3(0.02, win_hi - win_lo, 1.8), Vector3(x, (win_lo + win_hi) * 0.5, 8.7)))
	_console()
	_wheel()
	_radio()
	_chart_table()
	_lamp()
	_loose_objects()
	emergency = OmniLight3D.new()
	emergency.light_color = Color(1.0, 0.08, 0.04)
	emergency.omni_range = 7.0
	emergency.light_energy = 0.0
	emergency.position = Vector3(0, CEIL - 0.25, 10.8)
	add_child(emergency)
	lightning = OmniLight3D.new()
	lightning.light_color = Color(0.7, 0.8, 1.0)
	lightning.omni_range = 30.0
	lightning.light_energy = 0.0
	lightning.shadow_enabled = true
	lightning.position = Vector3(2.0, CEIL + 4.0, FRONT - 9.0)
	add_child(lightning)


func _materials() -> void:
	_wall = StandardMaterial3D.new()
	_wall.albedo_color = Color(0.78, 0.76, 0.7)
	_wall.roughness = 0.75
	# painted steel: almost flat, a little grime toward the edges of the noise
	_wall.albedo_texture = Mats.noise_tex(0.01, 256, false, 2.0, 3, Mats.gradient([Color(0.9, 0.89, 0.86), Color(1, 1, 1)]))
	_wall.uv1_triplanar = true
	_wall.uv1_scale = Vector3(0.25, 0.25, 0.25)
	_wall.roughness = 0.6
	_wood = StandardMaterial3D.new()
	_wood.albedo_color = Color(0.42, 0.27, 0.16)
	_wood.roughness = 0.55
	_wood.albedo_texture = Mats.noise_tex(0.01, 256, false, 2.0, 3, Mats.gradient([Color(0.75, 0.62, 0.5), Color(1, 1, 1)]))
	_wood.uv1_triplanar = true
	_wood.uv1_scale = Vector3(0.3, 4.0, 4.0)
	_metal = StandardMaterial3D.new()
	_metal.albedo_color = Color(0.2, 0.21, 0.22)
	_metal.metallic = 0.8
	_metal.roughness = 0.4
	_dark = StandardMaterial3D.new()
	_dark.albedo_color = Color(0.09, 0.1, 0.1)
	_dark.roughness = 0.5
	_dark.metallic = 0.3
	_glass = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode blend_mix, cull_disabled, specular_schlick_ggx;
// window glass in a storm: faint tint, specular sheen, rain running down it
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec2 uv = UV * vec2(9.0, 3.0);
	float col = floor(uv.x * 3.0);
	float speed = 0.4 + h(vec2(col, 1.0)) * 0.9;
	float y = fract(uv.y + TIME * speed + h(vec2(col, 7.0)));
	float streak = smoothstep(0.08, 0.0, abs(fract(uv.x * 3.0) - 0.5) - 0.02) * smoothstep(0.0, 0.35, y) * (1.0 - smoothstep(0.35, 1.0, y));
	vec2 cell = floor(uv * vec2(14.0, 10.0) + vec2(0.0, TIME * 0.05));
	float drop = step(0.93, h(cell)) * smoothstep(0.5, 0.15, length(fract(uv * vec2(14.0, 10.0)) - 0.5));
	float wet = clamp(streak * 0.6 + drop, 0.0, 1.0);
	ALBEDO = vec3(0.04, 0.06, 0.08);
	ROUGHNESS = mix(0.06, 0.02, wet);
	METALLIC = 0.0;
	SPECULAR = 0.8;
	ALPHA = 0.16 + wet * 0.22;
	EMISSION = vec3(0.35, 0.4, 0.45) * wet * 0.05;
}"""
	_glass.shader = sh


## A solid slab: visible mesh plus collision on the moving body.
func _slab(size: Vector3, pos: Vector3, mat: Material, collide: bool = true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	add_child(mi)
	if collide:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.position = pos
		body.add_child(cs)
	return mi


func _pane(size: Vector3, pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = _glass
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi


func _emissive(c: Color, e: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c * 0.3
	m.emission_enabled = true
	m.emission = c
	m.emission_energy_multiplier = e
	return m


func _console() -> void:
	_slab(Vector3(HALF * 2 - 0.3, 1.0, 0.7), Vector3(0, FLOOR + 0.5, FRONT + 0.38), _dark)
	# slanted instrument face
	var face := _slab(Vector3(HALF * 2 - 0.4, 0.06, 0.5), Vector3(0, FLOOR + 1.04, FRONT + 0.42), _metal, false)
	face.rotation.x = 0.35
	# radar: a green sweep on a round screen
	var radar := MeshInstance3D.new()
	var cm := PlaneMesh.new()
	cm.size = Vector2(0.4, 0.4)
	radar.mesh = cm
	var rm := ShaderMaterial.new()
	var rs := Shader.new()
	rs.code = """shader_type spatial;
render_mode unshaded;
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float a = atan(p.y, p.x);
	float sweep = fract((a / 6.28318) - TIME * 0.35);
	float trail = pow(1.0 - sweep, 6.0);
	float rings = smoothstep(0.03, 0.0, abs(fract(r * 4.0) - 0.5) - 0.47);
	float blip = step(0.985, fract(sin(floor(a * 30.0) * 12.9 + floor(r * 12.0) * 78.2) * 43758.5)) * trail;
	vec3 c = vec3(0.1, 1.0, 0.45) * (trail * 0.7 + rings * 0.25 + blip * 2.0);
	float inside = step(r, 1.0);
	ALBEDO = mix(vec3(0.02), c, inside) * inside;
	EMISSION = c * 2.0 * inside;
}"""
	rm.shader = rs
	radar.material_override = rm
	radar.position = Vector3(-1.4, FLOOR + 1.085, FRONT + 0.45)
	radar.rotation.x = 0.35
	add_child(radar)
	screens.append(radar)
	var gl := OmniLight3D.new()
	gl.light_color = Color(0.2, 1.0, 0.5)
	gl.omni_range = 0.9
	gl.light_energy = 0.6
	gl.position = radar.position + Vector3(0, 0.2, 0.3)
	add_child(gl)
	console_lights.append(gl)
	# dials and indicator lamps
	var cols := [Color(1.0, 0.6, 0.15), Color(1.0, 0.6, 0.15), Color(0.2, 0.8, 1.0), Color(1.0, 0.15, 0.1), Color(0.3, 1.0, 0.3)]
	for i in 9:
		var d := MeshInstance3D.new()
		var dm := CylinderMesh.new()
		dm.top_radius = 0.045 if i % 3 != 2 else 0.015
		dm.bottom_radius = dm.top_radius
		dm.height = 0.02
		d.mesh = dm
		d.material_override = _emissive(cols[i % cols.size()], 1.4 if i % 3 != 2 else 4.0)
		d.position = Vector3(-0.6 + i * 0.27, FLOOR + 1.09, FRONT + 0.47)
		d.rotation.x = PI / 2 - 0.35 + PI
		add_child(d)
		screens.append(d)
	var amber := OmniLight3D.new()
	amber.light_color = Color(1.0, 0.6, 0.2)
	amber.omni_range = 2.2
	amber.light_energy = 0.5
	amber.position = Vector3(0.6, FLOOR + 1.3, FRONT + 0.7)
	add_child(amber)
	console_lights.append(amber)


func _wheel() -> void:
	var ped := _slab(Vector3(0.22, 0.95, 0.22), Vector3(0, FLOOR + 0.48, 8.15), _wood)
	ped.name = "Pedestal"
	var wheel := Node3D.new()
	wheel.name = "Wheel"
	wheel.position = Vector3(0, FLOOR + 1.12, 8.3)
	add_child(wheel)
	var rim := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.36
	tm.outer_radius = 0.42
	rim.mesh = tm
	rim.material_override = _wood
	rim.rotation.x = PI / 2
	wheel.add_child(rim)
	for i in 8:
		var sp := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.018
		cm.bottom_radius = 0.022
		cm.height = 1.05
		sp.mesh = cm
		sp.material_override = _wood
		sp.rotation.z = i * PI / 4
		wheel.add_child(sp)
	var hub := MeshInstance3D.new()
	var hm := CylinderMesh.new()
	hm.top_radius = 0.07
	hm.bottom_radius = 0.07
	hm.height = 0.12
	hub.mesh = hm
	hub.material_override = _metal
	hub.rotation.x = PI / 2
	wheel.add_child(hub)


func _radio() -> void:
	_slab(Vector3(0.45, 0.5, 0.9), Vector3(-HALF + 0.25, FLOOR + 1.25, 9.6), _dark)
	for i in 4:
		var l := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.02, 0.05, 0.12)
		l.mesh = bm
		l.material_override = _emissive(Color(1.0, 0.15, 0.08) if i == 0 else Color(1.0, 0.7, 0.3), 3.0)
		l.position = Vector3(-HALF + 0.48, FLOOR + 1.4 - i * 0.08 * float(i > 0), 9.35 + i * 0.16)
		add_child(l)
		screens.append(l)
	var red := OmniLight3D.new()
	red.light_color = Color(1.0, 0.35, 0.15)
	red.omni_range = 1.4
	red.light_energy = 0.5
	red.position = Vector3(-HALF + 0.7, FLOOR + 1.4, 9.6)
	add_child(red)
	console_lights.append(red)


func _chart_table() -> void:
	_slab(Vector3(1.3, 0.92, 0.85), Vector3(2.25, FLOOR + 0.46, 10.4), _wood)
	var paper := StandardMaterial3D.new()
	paper.albedo_color = Color(0.86, 0.82, 0.7)
	paper.albedo_texture = Mats.noise_tex(0.05, 128, false, 3.0, 3, Mats.gradient([Color(0.85, 0.8, 0.7), Color(1, 1, 1)]))
	paper.roughness = 0.9
	var map := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(0.9, 0.004, 0.6)
	map.mesh = pm
	map.material_override = paper
	map.position = Vector3(2.2, FLOOR + 0.925, 10.4)
	map.rotation.y = 0.1
	add_child(map)


func _lamp() -> void:
	# a brass lamp on a short chain: a rigid body on a pin joint, swinging with the ship
	lamp_body = RigidBody3D.new()
	lamp_body.mass = 1.5
	lamp_body.collision_layer = 0
	lamp_body.collision_mask = 0
	lamp_body.angular_damp = 0.3
	lamp_body.linear_damp = 0.05
	add_child(lamp_body)
	lamp_body.position = Vector3(0.4, CEIL - 0.55, 9.6)
	var cs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 0.1
	cs.shape = sp
	lamp_body.add_child(cs)
	var shade := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.05
	cm.bottom_radius = 0.18
	cm.height = 0.16
	shade.mesh = cm
	var brass := StandardMaterial3D.new()
	brass.albedo_color = Color(0.75, 0.55, 0.25)
	brass.metallic = 0.9
	brass.roughness = 0.35
	brass.cull_mode = BaseMaterial3D.CULL_DISABLED
	shade.material_override = brass
	lamp_body.add_child(shade)
	var bulb := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.045
	sm.height = 0.09
	bulb.mesh = sm
	bulb.material_override = _emissive(Color(1.0, 0.75, 0.4), 8.0)
	bulb.position.y = -0.06
	lamp_body.add_child(bulb)
	var chain := MeshInstance3D.new()
	var ch := CylinderMesh.new()
	ch.top_radius = 0.008
	ch.bottom_radius = 0.008
	ch.height = 0.55
	chain.mesh = ch
	chain.material_override = _metal
	chain.position.y = 0.3
	lamp_body.add_child(chain)
	lamp_light = OmniLight3D.new()
	lamp_light.light_color = Color(1.0, 0.72, 0.42)
	lamp_light.omni_range = 7.5
	lamp_light.light_energy = 2.2
	lamp_light.shadow_enabled = true
	lamp_light.position.y = -0.1
	lamp_body.add_child(lamp_light)
	lamp_body.top_level = true


func _loose_objects() -> void:
	var specs := [
		# mesh, size, local position, mass, colour
		["cyl", Vector3(0.045, 0.1, 0), Vector3(0.9, FLOOR + 1.06, FRONT + 0.6), 0.3, Color(0.9, 0.9, 0.88)],
		["box", Vector3(0.3, 0.02, 0.22), Vector3(-0.4, FLOOR + 1.04, FRONT + 0.62), 0.2, Color(0.85, 0.82, 0.7)],
		["box", Vector3(0.25, 0.06, 0.18), Vector3(2.0, FLOOR + 0.96, 10.3), 0.6, Color(0.25, 0.15, 0.1)],
		["cyl", Vector3(0.06, 0.28, 0), Vector3(2.5, FLOOR + 1.07, 10.55), 0.8, Color(0.3, 0.35, 0.4)],
		["box", Vector3(0.4, 0.3, 0.3), Vector3(-2.4, FLOOR + 0.16, 10.8), 6.0, Color(0.55, 0.12, 0.08)],
		["cyl", Vector3(0.12, 0.35, 0), Vector3(2.7, FLOOR + 0.18, 9.2), 4.0, Color(0.6, 0.45, 0.2)],
	]
	for s in specs:
		var rb := RigidBody3D.new()
		rb.mass = s[3]
		rb.collision_layer = Game.L_PROPS
		rb.collision_mask = Game.L_STRUCT | Game.L_PROPS
		var mi := MeshInstance3D.new()
		var cs := CollisionShape3D.new()
		var m := StandardMaterial3D.new()
		m.albedo_color = s[4]
		m.roughness = 0.6
		if s[0] == "cyl":
			var cm := CylinderMesh.new()
			cm.top_radius = s[1].x
			cm.bottom_radius = s[1].x
			cm.height = s[1].y
			mi.mesh = cm
			var cy := CylinderShape3D.new()
			cy.radius = s[1].x
			cy.height = s[1].y
			cs.shape = cy
		else:
			var bm := BoxMesh.new()
			bm.size = s[1]
			mi.mesh = bm
			var bs := BoxShape3D.new()
			bs.size = s[1]
			cs.shape = bs
		mi.material_override = m
		rb.add_child(mi)
		rb.add_child(cs)
		rb.set_meta("local", s[2])
		add_child(rb)
		rb.top_level = true
		loose.append(rb)


## Places the free bodies (lamp, loose objects) relative to where the ship is now.
func settle_free_bodies() -> void:
	var xf := global_transform
	for rb in loose:
		rb.global_transform = Transform3D(xf.basis, xf * (rb.get_meta("local") as Vector3))
		rb.linear_velocity = Vector3.ZERO
		rb.angular_velocity = Vector3.ZERO
	lamp_body.global_transform = Transform3D(xf.basis, xf * Vector3(0.4, CEIL - 0.55, 9.6))
	if _pin == null:
		# the joint is made once the ship is in place, so its anchors are where they look
		_pin = PinJoint3D.new()
		add_child(_pin)
		_pin.position = Vector3(0.4, CEIL - 0.02, 9.6)
		_pin.node_a = _pin.get_path_to(body)
		_pin.node_b = _pin.get_path_to(lamp_body)


func set_power(on: bool) -> void:
	for l in console_lights:
		l.visible = on
	for s in screens:
		s.visible = on
	lamp_light.visible = on


func shatter_front() -> void:
	for i in 3:
		glass_panes[i].visible = false

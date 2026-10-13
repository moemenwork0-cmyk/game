class_name Zone
extends Node3D
## Glowing floor ring. While the player stands inside it, progress fills over `hold` seconds
## and then `completed` fires (intel pickup, freeing a hostage, defusing, extraction).

signal completed

var radius := 1.3
var hold := 1.5
var icon := "laptop"
var label := ""
var color := Color(0.98, 0.72, 0.2)
var active := true
var progress := 0.0
var player: Soldier
var _ring: MeshInstance3D
var _mat := StandardMaterial3D.new()
var _beam: MeshInstance3D


func _ready() -> void:
	_ring = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = radius - 0.06
	tm.outer_radius = radius
	tm.rings = 48
	tm.ring_segments = 6
	_ring.mesh = tm
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_mat.albedo_color = Color(color, 0.9) * Color(2, 2, 2, 1)
	_ring.material_override = _mat
	_ring.scale = Vector3(1, 0.15, 1)
	_ring.position.y = 0.04
	_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_ring)
	_beam = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = radius * 0.9
	cm.bottom_radius = radius
	cm.height = 1.6
	cm.cap_top = false
	cm.cap_bottom = false
	_beam.mesh = cm
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	bm.cull_mode = BaseMaterial3D.CULL_DISABLED
	bm.albedo_color = Color(color, 0.07)
	_beam.material_override = bm
	_beam.position.y = 0.8
	_beam.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_beam)


func inside() -> bool:
	if player == null or not player.alive:
		return false
	var d := player.global_position - global_position
	return Vector2(d.x, d.z).length() < radius


func _process(delta: float) -> void:
	visible = active
	if not active:
		return
	var t := Time.get_ticks_msec() * 0.001
	_ring.rotation.y = t * 0.6
	var s := 1.0 + sin(t * 4.0) * 0.03
	_ring.scale = Vector3(s, 0.15, s)
	if inside():
		progress = minf(progress + delta / hold, 1.0)
		if progress >= 1.0:
			active = false
			completed.emit()
	else:
		progress = maxf(progress - delta / hold * 0.5, 0.0)
	_mat.albedo_color = Color(color.lerp(Color.WHITE, progress * 0.5), 0.9) * Color(2, 2, 2, 1)

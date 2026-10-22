class_name BeachWake
extends Node3D
## The morning after: Layla washed up at the waterline of the cove, the wrecked Murjan
## heeled over on the reef behind her. Shared by the wake-up shots.

var layla: Actor
var wreck: Murjan
var spot := Vector3.ZERO


func build(tr: Trailer) -> void:
	tr.sky.hour = 7.1
	tr.sky.storm = 0.15
	await tr.add_island(Vector3(-20, 0, 450), 200.0, 1.2)
	# the wet sand just above the swash line
	var z := 430.0
	while z < 500.0 and tr.ground(-20, z) > 0.35:
		z += 0.5
	spot = Vector3(-20, tr.ground(-20, z - 1.5), z - 1.5)
	wreck = Murjan.new()
	tr.add_child(wreck)
	wreck.position = Vector3(10, -3.8, 540)
	wreck.rotation = Vector3(0.06, 2.3, 0.42)
	for l in wreck.lanterns:
		l.visible = false
	layla = Actor.create("layla", {"idle": "f_idle_nervous_01"})
	tr.add_child(layla)
	# laid on her back, head up the beach, then handed to physics to settle into the sand
	layla.global_position = spot + Vector3(0, 0.25, 0)
	layla.rotation = Vector3(PI * 0.5, 0.35, 0)
	layla.play("idle", 0.0)
	await get_tree().physics_frame
	await get_tree().physics_frame
	layla.go_limp(Vector3(0, -2, 0))
	layla.face.lids = 1.0
	for i in 90:
		await get_tree().physics_frame


func head() -> Vector3:
	# the ragdoll's head body is where the head really is once physics has it
	if layla.ragdoll:
		for b in layla.ragdoll.get_children():
			if b is PhysicalBone3D and (b as PhysicalBone3D).bone_name == "Bip01 Head":
				return (b as Node3D).global_position
	var hb := layla.skel.find_bone("Bip01 Head")
	return (layla.skel.global_transform * layla.skel.get_bone_global_pose(hb)).origin


## Head "up" (the way her face points).
func face_dir() -> Vector3:
	var hb := layla.skel.find_bone("Bip01 Head")
	var b := (layla.skel.global_transform * layla.skel.get_bone_global_pose(hb)).basis
	# Rocketbox head: -Y of the bone looks out of the face after the model's PI turn
	var d := -b.y.normalized()
	return d if d.y > -0.2 else Vector3.UP

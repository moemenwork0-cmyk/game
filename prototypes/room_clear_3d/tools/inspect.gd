extends SceneTree
func _init():
	print("start")
	for p in ["res://assets/characters/player/soldier.fbx","res://assets/characters/enemy/soldier.fbx"]:
		var s:Node=load(p).instantiate()
		print("== ",p); _dump(s,0)
		var sk:Skeleton3D=s.find_children("*","Skeleton3D",true,false)[0]
		var names=[]; for i in sk.get_bone_count(): names.append(sk.get_bone_name(i))
		print(names)
		for m in s.find_children("*","MeshInstance3D",true,false):
			print(m.name," aabb ",m.get_aabb()," surf:")
			for i in m.mesh.get_surface_count(): var mt=m.mesh.surface_get_material(i); print("   ",i," ",mt.resource_name if mt else "-")
	var a:Animation=load("res://assets/characters/anims/m_walk_neutral_01.res")
	print("anim tracks: ",a.get_track_count()," e.g. ",a.track_get_path(0)," ",a.track_get_path(1), " len ",a.length)
	for d in DirAccess.get_directories_at("res://assets/props"):
		var ps=load("res://assets/props/%s/%s.gltf"%[d,d])
		if ps==null: print(d," FAILED"); continue
		var n:Node3D=ps.instantiate(); var ab=AABB(); var first=true
		for m in n.find_children("*","MeshInstance3D",true,false):
			var b=(m.global_transform if m.is_inside_tree() else _gt(m))*m.get_aabb()
			ab = b if first else ab.merge(b); first=false
		print(d," size ",ab.size," pos ",ab.position)
	quit()
func _gt(n:Node3D)->Transform3D:
	var t=Transform3D(); var c:Node=n
	while c is Node3D: t=(c as Node3D).transform*t; c=c.get_parent()
	return t
func _dump(n,d):
	print("  ".repeat(d),n.name," (",n.get_class(),")")
	if d<3: for c in n.get_children(): _dump(c,d+1)

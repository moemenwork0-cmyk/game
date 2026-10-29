class_name Mats
extends RefCounted
## Material library shared by everything generated in Blender: the material slot name picks the
## texture, the mesh vertex colour tints it (so one material serves every paint colour).

const TEX := "res://assets/tex/%s/%s.jpg"
# slot name -> [ambientCG id, metres covered by one texture tile, roughness scale, extra]
const DEFS := {
	"plaster_a": ["PaintedPlaster010", 2.5], "plaster_b": ["PaintedPlaster006", 2.0],
	"plaster_c": ["Plaster006", 2.0], "brick": ["Bricks097", 1.6], "stone": ["Bricks109A", 2.0],
	"concrete": ["Concrete036", 2.5], "trim": ["Plaster006", 1.5], "wood": ["Planks037A", 1.2],
	"metal": ["Metal041B", 1.5], "shutter": ["CorrugatedSteel007A", 1.2], "cloth": ["Fabric030", 0.8],
	"street": ["PavingStones049", 2.2], "sidewalk": ["PavingStones119", 1.6],
}
static var _cache := {}


static func get_mat(name: String) -> Material:
	if _cache.has(name):
		return _cache[name]
	var m := StandardMaterial3D.new()
	m.vertex_color_use_as_albedo = true
	if DEFS.has(name):
		var d: Array = DEFS[name]
		m.albedo_texture = load(TEX % [d[0], "color"])
		m.normal_enabled = true
		m.normal_texture = load(TEX % [d[0], "normalgl"])
		m.roughness_texture = load(TEX % [d[0], "roughness"])
		m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GRAYSCALE
		var s := 1.0 / float(d[1])
		m.uv1_scale = Vector3(s, s, s)
	match name:
		"glass":
			m.albedo_color = Color(0.13, 0.16, 0.18); m.roughness = 0.08; m.metallic = 0.6
		"interior":
			m.albedo_texture = load(TEX % ["Plaster006", "color"])
			m.albedo_color = Color(0.75, 0.62, 0.48); m.roughness = 0.9
			m.uv1_scale = Vector3(0.5, 0.5, 0.5)
			m.emission_enabled = true; m.emission = Color(1.0, 0.75, 0.45); m.emission_energy_multiplier = 0.12
		"sign":
			m.roughness = 0.55
		"dark":
			m.albedo_color = Color(0.04, 0.035, 0.03); m.roughness = 1.0
		"metal":
			m.metallic = 0.3
		"cloth":
			m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_cache[name] = m
	return m


## Replace the imported placeholder materials on every mesh under `n` with library materials.
static func apply(n: Node) -> void:
	for mi: MeshInstance3D in n.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var src := mi.mesh.surface_get_material(i)
			if src:
				mi.set_surface_override_material(i, get_mat(src.resource_name))

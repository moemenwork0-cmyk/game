extends TrailerShot
## After the title. Dusk on the empty beach; the camera finds a footprint pressed into
## wet sand — bare, too large, fresh — and leading into the jungle. Not ours.

var decal: Decal


func build(tr: Trailer) -> void:
	duration = 5.0
	tr.sky.hour = 17.3
	var at := Vector3(30, 0, 440)
	await tr.add_island(at, 140.0, 0.9)
	at.y = tr.ground(at.x, at.z)
	for i in 4:
		var d := Decal.new()
		d.size = Vector3(0.42, 0.6, 0.85)
		d.texture_albedo = _print_tex(false)
		d.texture_normal = _print_tex(true)
		d.albedo_mix = 0.85
		d.normal_fade = 0.2
		tr.add_child(d)
		var p := at + Vector3((-0.35 if i % 2 == 0 else 0.35), 0.0, -i * 1.5)
		p.y = tr.ground(p.x, p.z)
		d.global_position = p
		d.rotation.y = 0.1 * (i % 2 * 2 - 1)
		if i == 0:
			decal = d
	var p0 := decal.global_position
	keys = [
		[0.0, p0 + Vector3(0.2, 0.55, 1.2), p0, 34.0, 0.9],
		[3.0, p0 + Vector3(0.1, 0.7, 1.0), p0 + Vector3(0, 0.0, -1.0), 34.0, 1.0],
		[5.0, p0 + Vector3(0.0, 1.1, 1.4), p0 + Vector3(0, 3.0, -40.0), 40.0, 0.0],
	]


## A bare footprint: heel, sole and five toes pressed into sand (albedo darkening and a
## matching normal map), drawn at 128 px.
func _print_tex(normal: bool) -> ImageTexture:
	var n := 128
	var h := PackedFloat32Array()
	h.resize(n * n)
	var blobs := [[0.5, 0.78, 0.2, 0.17], [0.47, 0.5, 0.17, 0.2], [0.52, 0.3, 0.2, 0.12]]
	for t in [[0.36, 0.13, 0.065], [0.47, 0.1, 0.052], [0.56, 0.1, 0.048], [0.64, 0.12, 0.044], [0.71, 0.15, 0.04]]:
		blobs.append([t[0], t[1], t[2], t[2]])
	for y in n:
		for x in n:
			var u := (x + 0.5) / n
			var v := (y + 0.5) / n
			var d := 0.0
			for b in blobs:
				var dx: float = (u - float(b[0])) / float(b[2])
				var dy: float = (v - float(b[1])) / float(b[3])
				d = maxf(d, 1.0 - smoothstep(0.6, 1.0, sqrt(dx * dx + dy * dy)))
			h[y * n + x] = d
	var img := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var d := h[y * n + x]
			if normal:
				var dx := h[y * n + mini(x + 1, n - 1)] - h[y * n + maxi(x - 1, 0)]
				var dy := h[mini(y + 1, n - 1) * n + x] - h[maxi(y - 1, 0) * n + x]
				var nv := Vector3(dx * 7.0, dy * 7.0, 1.0).normalized()
				img.set_pixel(x, y, Color(nv.x * 0.5 + 0.5, nv.y * 0.5 + 0.5, nv.z * 0.5 + 0.5, minf(d * 3.0, 1.0)))
			else:
				img.set_pixel(x, y, Color(0.16, 0.11, 0.07, minf(d * 1.2, 0.92)))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

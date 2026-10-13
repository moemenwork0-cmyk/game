class_name MapPreview
extends Control
## Blueprint-style drawing of a generated building for mission cards and the briefing.

var map: MapGen
var objective_icon := ""
var dim := false


func _draw() -> void:
	if map == null:
		return
	var b := map.bounds.grow(0.8)
	var sc := minf(size.x / b.size.x, size.y / b.size.y)
	var off := size * 0.5 - b.get_center() * sc
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.03, 0.06, 0.07, 0.9))
	for x in range(0, int(size.x), 12):
		draw_line(Vector2(x, 0), Vector2(x, size.y), Color(0.3, 0.6, 0.7, 0.06), 1.0)
	for y in range(0, int(size.y), 12):
		draw_line(Vector2(0, y), Vector2(size.x, y), Color(0.3, 0.6, 0.7, 0.06), 1.0)
	for i in map.rooms.size():
		var rr: Rect2 = map.rooms[i]["rect"]
		var c := Color(0.25, 0.55, 0.65, 0.18)
		if i == map.far_room:
			c = Color(1.0, 0.35, 0.25, 0.28)
		elif i == map.entrance_room:
			c = Color(0.5, 0.9, 0.45, 0.22)
		draw_rect(Rect2(rr.position * sc + off, rr.size * sc), c)
	for w in map.walls:
		if w["y0"] > 0.1:
			continue
		draw_line(w["a"] * sc + off, w["b"] * sc + off, Color(0.65, 0.9, 1.0, 0.9), maxf(1.5, sc * 0.25))
	var e: Vector2 = map.doors[0]["pos"] * sc + off
	draw_colored_polygon(PackedVector2Array([e + Vector2(0, -7), e + Vector2(6, 4), e + Vector2(-6, 4)]), Color(0.55, 0.92, 0.45))
	if objective_icon != "":
		var c: Vector2 = (map.rooms[map.far_room]["rect"] as Rect2).get_center() * sc + off
		draw_circle(c, 11, Color(1.0, 0.35, 0.25))
		UiKit.draw_icon(self, objective_icon, c, 16, Color(0.08, 0.02, 0.02), 0.0, false)
	if dim:
		draw_rect(Rect2(Vector2.ZERO, size), Color(0, 0, 0, 0.6))

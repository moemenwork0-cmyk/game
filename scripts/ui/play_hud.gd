class_name PlayHud
extends Control
## In-game HUD, drawn in a clean modern style: compass, vitals cluster with ring gauges,
## icon hotbar with durability, item feed, contextual prompts, damage vignette.

const ACCENT := Color(1.0, 0.8, 0.42)
const TEXT := Color(0.96, 0.97, 0.98)
const DIM := Color(1, 1, 1, 0.55)
const PANEL := Color(0.03, 0.05, 0.07, 0.55)
const SLOT_ICONS := {"hand": "hand", "axe": "axe", "pickaxe": "pickaxe", "shovel": "shovel",
	"spear": "spear", "torch": "torch", "build": "build", "place": "campfire"}
const ITEM_ICONS := {"log": "log", "plank": "plank", "stone": "stone", "dirt": "dirt", "sand": "sand",
	"coconut": "coconut", "berry": "berry", "fish_raw": "fishraw", "fish_cooked": "fishcooked",
	"campfire": "campfire", "collector": "collector", "bed": "bed"}
const STATUS_ICONS := {"Hungry": "food", "Starving": "food", "Thirsty": "water", "Dehydrated": "water",
	"Exhausted": "energy", "Cold": "temp", "Freezing": "temp", "Overheated": "temp", "Wet": "wet", "Sick": "sick"}
const WEATHER_ICONS := {"clear": "sun", "cloudy": "cloud", "rain": "rain", "storm": "storm"}

static var _icons := {}
static var _fonts := {}

var _feed: VBoxContainer
var _prompt_key: PanelContainer
var _prompt_label: Label
var _tip: Label
var _slot_title: Label
var _slot_title_t := 0.0
var _notice: Label
var _notice_t := 0.0
var _last_health := 100.0
var _hurt_flash := 0.0
var _vignette: ColorRect
var _vmat: ShaderMaterial


static func icon(name: String) -> Texture2D:
	if not _icons.has(name):
		var path := "res://assets/icons/%s.svg" % name
		_icons[name] = load(path) if ResourceLoader.exists(path) else null
	return _icons[name]


static func font(weight: String = "SemiBold") -> Font:
	if not _fonts.has(weight):
		_fonts[weight] = load("res://assets/fonts/Rajdhani-%s.ttf" % weight)
	return _fonts[weight]


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var th := Theme.new()
	th.default_font = font("SemiBold")
	th.default_font_size = 18
	theme = th

	_vignette = ColorRect.new()
	_vignette.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_vmat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type canvas_item;
uniform float amount = 0.0;
uniform vec3 tint : source_color = vec3(0.6, 0.0, 0.0);
void fragment() {
	float d = length((UV - 0.5) * vec2(1.6, 1.0));
	float v = smoothstep(0.35, 0.95, d) * amount;
	COLOR = vec4(tint, v);
}"""
	_vmat.shader = sh
	_vignette.material = _vmat
	add_child(_vignette)

	# item feed (right side)
	_feed = VBoxContainer.new()
	_feed.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT)
	_feed.offset_left = -260
	_feed.offset_right = -28
	_feed.offset_top = 40
	_feed.alignment = BoxContainer.ALIGNMENT_END
	_feed.add_theme_constant_override("separation", 4)
	add_child(_feed)

	# interaction prompt under the crosshair
	var pr := HBoxContainer.new()
	pr.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	pr.offset_top = 34
	pr.offset_left = -300
	pr.offset_right = 300
	pr.alignment = BoxContainer.ALIGNMENT_CENTER
	pr.add_theme_constant_override("separation", 8)
	add_child(pr)
	_prompt_key = PanelContainer.new()
	var ks := StyleBoxFlat.new()
	ks.bg_color = Color(1, 1, 1, 0.92)
	ks.set_corner_radius_all(4)
	ks.content_margin_left = 8
	ks.content_margin_right = 8
	ks.content_margin_top = 0
	ks.content_margin_bottom = 0
	_prompt_key.add_theme_stylebox_override("panel", ks)
	var kl := Label.new()
	kl.text = "E"
	kl.add_theme_font_override("font", font("Bold"))
	kl.add_theme_color_override("font_color", Color(0.05, 0.06, 0.08))
	kl.add_theme_font_size_override("font_size", 18)
	_prompt_key.add_child(kl)
	pr.add_child(_prompt_key)
	_prompt_label = _label("", 20, TEXT, true)
	pr.add_child(_prompt_label)

	# secondary tip above the hotbar
	_tip = _label("", 16, Color(1, 1, 1, 0.7), true)
	_tip.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_tip.offset_top = -150
	_tip.offset_bottom = -126
	_tip.offset_left = -500
	_tip.offset_right = 500
	_tip.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_tip)

	_slot_title = _label("", 22, ACCENT, true)
	_slot_title.add_theme_font_override("font", font("Bold"))
	_slot_title.set_anchors_and_offsets_preset(Control.PRESET_CENTER_BOTTOM)
	_slot_title.offset_top = -124
	_slot_title.offset_bottom = -98
	_slot_title.offset_left = -300
	_slot_title.offset_right = 300
	_slot_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_slot_title)

	_notice = _label("", 22, TEXT, true)
	_notice.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	_notice.offset_top = 96
	_notice.offset_bottom = 126
	_notice.offset_left = -500
	_notice.offset_right = 500
	_notice.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(_notice)


func _label(text: String, size: int, color: Color, shadow: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if shadow:
		l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.75))
		l.add_theme_constant_override("shadow_offset_x", 0)
		l.add_theme_constant_override("shadow_offset_y", 2)
		l.add_theme_constant_override("shadow_outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


## Item pickups go to the right-hand feed, everything else to the centre notice.
func push_message(text: String) -> void:
	if text.begins_with("+"):
		var parts := text.substr(1).split(" ", false, 1)
		var n := parts[0]
		var item := parts[1] if parts.size() > 1 else ""
		var id := ""
		for k in Items.NAMES:
			if Items.NAMES[k] == item:
				id = k
		var row := PanelContainer.new()
		var st := StyleBoxFlat.new()
		st.bg_color = PANEL
		st.border_color = ACCENT
		st.border_width_left = 3
		st.content_margin_left = 10
		st.content_margin_right = 12
		st.content_margin_top = 3
		st.content_margin_bottom = 3
		row.add_theme_stylebox_override("panel", st)
		var hb := HBoxContainer.new()
		hb.add_theme_constant_override("separation", 8)
		var tr := TextureRect.new()
		tr.texture = icon(ITEM_ICONS.get(id, "build"))
		tr.custom_minimum_size = Vector2(24, 24)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		hb.add_child(tr)
		hb.add_child(_label(item.to_upper(), 17, TEXT))
		var nl := _label("+" + n, 17, ACCENT)
		nl.add_theme_font_override("font", font("Bold"))
		hb.add_child(nl)
		row.add_child(hb)
		_feed.add_child(row)
		if _feed.get_child_count() > 6:
			_feed.get_child(0).queue_free()
		row.modulate.a = 0.0
		var tw := row.create_tween()
		tw.tween_property(row, "modulate:a", 1.0, 0.15)
		tw.tween_interval(2.6)
		tw.tween_property(row, "modulate:a", 0.0, 0.6)
		tw.tween_callback(row.queue_free)
	else:
		_notice.text = text.to_upper()
		_notice_t = 3.2


func slot_changed() -> void:
	var p := Game.player
	if p == null:
		return
	var s: String = Player.SLOTS[p.slot]
	var nm: String = Player.SLOT_NAMES[p.slot]
	if s == "build":
		nm = StructurePiece.DEFS[Player.BUILD_KINDS[p.build_idx]]["name"]
	elif s == "place":
		nm = Items.item_name(Player.PLACE_KINDS[p.place_idx]).replace(" kit", "")
	_slot_title.text = nm.to_upper()
	_slot_title_t = 1.8


func _process(delta: float) -> void:
	var p := Game.player
	if p == null:
		return
	# prompt + tip from the player's context hint
	var h: String = p.hint
	if h.begins_with("[E] "):
		var parts := h.substr(4).split("   ·   ", false, 1)
		_prompt_label.text = parts[0]
		_prompt_key.visible = true
		_tip.text = parts[1] if parts.size() > 1 else ""
	else:
		_prompt_label.text = ""
		_prompt_key.visible = false
		_tip.text = h
	_slot_title_t -= delta
	_slot_title.modulate.a = clampf(_slot_title_t, 0.0, 1.0)
	_notice_t -= delta
	_notice.modulate.a = clampf(_notice_t, 0.0, 1.0)
	var v := p.vitals
	if v.health < _last_health - 0.5:
		_hurt_flash = 1.0
	_last_health = v.health
	_hurt_flash = maxf(_hurt_flash - delta * 2.0, 0.0)
	var low := 1.0 - smoothstep(15.0, 40.0, v.health)
	var pulse := 0.75 + 0.25 * sin(Time.get_ticks_msec() * 0.006)
	_vmat.set_shader_parameter("amount", clampf(low * pulse * 0.8 + _hurt_flash * 0.6, 0.0, 1.0))
	queue_redraw()


# ---------------------------------------------------------------- drawing

func _draw() -> void:
	var p := Game.player
	if p == null:
		return
	var vs := size
	_draw_crosshair(vs * 0.5)
	_draw_compass(Vector2(vs.x * 0.5, 30), p)
	_draw_vitals(Vector2(32, vs.y - 34), p)
	_draw_hotbar(Vector2(vs.x * 0.5, vs.y - 26), p)
	_draw_effort(Vector2(vs.x * 0.5, vs.y - 104), p)


func _text(pos: Vector2, s: String, sz: int, col: Color, align: int = HORIZONTAL_ALIGNMENT_LEFT, weight: String = "SemiBold", width: float = -1.0) -> void:
	var f := font(weight)
	draw_string(f, pos + Vector2(0, 2), s, align, width, sz, Color(0, 0, 0, 0.55 * col.a))
	draw_string(f, pos, s, align, width, sz, col)


func _icon(name: String, rect: Rect2, col: Color) -> void:
	var t := icon(name)
	if t:
		draw_texture_rect(t, rect, false, col)


func _draw_crosshair(c: Vector2) -> void:
	var col := Color(1, 1, 1, 0.9)
	draw_circle(c, 1.8, col)
	for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
		draw_line(c + d * 6.0, c + d * 11.0, Color(1, 1, 1, 0.55), 1.5, true)


func _draw_compass(top: Vector2, p: Player) -> void:
	var w := 560.0
	var heading := fposmod(-rad_to_deg(p.yaw), 360.0)   # 0 = north (-Z)
	var x0 := top.x - w * 0.5
	# soft band behind the compass, fading out at both ends
	var band := PackedVector2Array([Vector2(x0, top.y - 4), Vector2(top.x, top.y - 4), Vector2(x0 + w, top.y - 4),
		Vector2(x0 + w, top.y + 30), Vector2(top.x, top.y + 30), Vector2(x0, top.y + 30)])
	var bc := PackedColorArray([Color(0, 0, 0, 0), Color(0, 0, 0, 0.38), Color(0, 0, 0, 0), Color(0, 0, 0, 0), Color(0, 0, 0, 0.38), Color(0, 0, 0, 0)])
	draw_polygon(PackedVector2Array([band[0], band[1], band[4], band[5]]), PackedColorArray([bc[0], bc[1], bc[4], bc[5]]))
	draw_polygon(PackedVector2Array([band[1], band[2], band[3], band[4]]), PackedColorArray([bc[1], bc[2], bc[3], bc[4]]))
	var labels := {0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW"}
	var px_per_deg := w / 160.0
	for i in range(-90, 91, 5):
		var deg := int(fposmod(round(heading / 5.0) * 5.0 + i, 360.0))
		var off := fposmod(deg - heading + 180.0, 360.0) - 180.0
		var x := top.x + off * px_per_deg
		if absf(off) > 80.0:
			continue
		var fade := 1.0 - smoothstep(55.0, 80.0, absf(off))
		if labels.has(deg):
			var main: bool = String(labels[deg]).length() == 1
			_text(Vector2(x - 40, top.y + 22), labels[deg], 22 if main else 17,
				(ACCENT if deg == 0 else TEXT) * Color(1, 1, 1, fade), HORIZONTAL_ALIGNMENT_CENTER, "Bold", 80)
		elif deg % 15 == 0:
			_text(Vector2(x - 20, top.y + 18), str(deg), 13, Color(1, 1, 1, 0.5 * fade), HORIZONTAL_ALIGNMENT_CENTER, "SemiBold", 40)
		else:
			draw_line(Vector2(x, top.y + 2), Vector2(x, top.y + 8), Color(1, 1, 1, 0.35 * fade), 1.5)
	# centre marker + heading
	draw_colored_polygon(PackedVector2Array([Vector2(top.x - 6, top.y - 6), Vector2(top.x + 6, top.y - 6), Vector2(top.x, top.y + 1)]), ACCENT)
	_text(Vector2(top.x - 40, top.y + 44), "%03d" % int(heading), 15, Color(1, 1, 1, 0.75), HORIZONTAL_ALIGNMENT_CENTER, "Bold", 80)
	# day / time / weather under it
	if Game.day_night:
		var t := Game.day_night.clock_text().to_upper()
		var wx := Game.weather.state if Game.weather else "clear"
		_icon(WEATHER_ICONS.get(wx, "sun"), Rect2(top.x - 92, top.y + 50, 18, 18), Color(1, 1, 1, 0.8))
		_text(Vector2(top.x - 70, top.y + 65), t, 16, Color(1, 1, 1, 0.8), HORIZONTAL_ALIGNMENT_LEFT, "SemiBold")


func _ring(c: Vector2, r: float, frac: float, col: Color, ic: String, warn: bool) -> void:
	draw_circle(c, r + 3.0, Color(0, 0, 0, 0.45))
	draw_arc(c, r, 0, TAU, 48, Color(1, 1, 1, 0.12), 4.0, true)
	if frac > 0.002:
		draw_arc(c, r, -PI / 2, -PI / 2 + TAU * clampf(frac, 0.0, 1.0), 48, col, 4.0, true)
	var ic_col := col if warn else Color(1, 1, 1, 0.9)
	_icon(ic, Rect2(c - Vector2(r, r) * 0.62, Vector2(r, r) * 1.24), ic_col)


func _draw_vitals(base: Vector2, p: Player) -> void:
	var v := p.vitals
	# health bar
	var hw := 250.0
	var y := base.y - 18
	_icon("heart", Rect2(base.x, y - 10, 22, 22), Color(1, 0.35, 0.35))
	var bx := base.x + 30
	draw_rect(Rect2(bx, y - 2, hw, 8), Color(0, 0, 0, 0.5))
	var hcol := Color(0.92, 0.92, 0.92).lerp(Color(0.95, 0.25, 0.2), 1.0 - smoothstep(25.0, 60.0, v.health))
	draw_rect(Rect2(bx, y - 2, hw * v.health / 100.0, 8), hcol)
	for i in range(1, 5):
		draw_line(Vector2(bx + hw * i / 5.0, y - 2), Vector2(bx + hw * i / 5.0, y + 6), Color(0, 0, 0, 0.5), 2.0)
	_text(Vector2(bx + hw + 8, y + 7), str(int(ceil(v.health))), 20, TEXT, HORIZONTAL_ALIGNMENT_LEFT, "Bold")
	# ring gauges
	var gy := y - 44
	var gx := base.x + 22
	var items := [["food", v.food, Color(1.0, 0.68, 0.3)], ["water", v.water, Color(0.4, 0.75, 1.0)], ["energy", v.energy, Color(0.75, 0.6, 1.0)]]
	for i in items.size():
		var e: Array = items[i]
		var c := Vector2(gx + i * 58, gy)
		_ring(c, 20.0, float(e[1]) / 100.0, e[2], e[0], float(e[1]) < 20.0)
	# temperature
	var tcol := Color(1, 1, 1, 0.8)
	if v.body_temp < 35.5:
		tcol = Color(0.5, 0.8, 1.0)
	elif v.body_temp > 38.3:
		tcol = Color(1.0, 0.55, 0.3)
	_icon("temp", Rect2(gx + 3 * 58 - 14, gy - 12, 22, 22), tcol)
	_text(Vector2(gx + 3 * 58 + 10, gy + 7), "%.1f°" % v.body_temp, 18, tcol, HORIZONTAL_ALIGNMENT_LEFT, "Bold")
	# status chips
	var sx := base.x
	var sy := gy - 46
	for s in v.status:
		var w := font().get_string_size(s.to_upper(), HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x + 36
		draw_rect(Rect2(sx, sy, w, 24), Color(0.5, 0.08, 0.05, 0.55))
		draw_rect(Rect2(sx, sy, 3, 24), Color(1.0, 0.4, 0.3))
		_icon(STATUS_ICONS.get(s, "sick"), Rect2(sx + 7, sy + 4, 16, 16), Color(1, 0.85, 0.8))
		_text(Vector2(sx + 27, sy + 18), s.to_upper(), 14, Color(1, 0.9, 0.88))
		sx += w + 6


func _draw_hotbar(bottom: Vector2, p: Player) -> void:
	var n := Player.SLOTS.size()
	var sz := 58.0
	var gap := 6.0
	var total := n * sz + (n - 1) * gap
	var x0 := bottom.x - total * 0.5
	for i in n:
		var s: String = Player.SLOTS[i]
		var sel := i == p.slot
		var r := Rect2(x0 + i * (sz + gap), bottom.y - sz, sz, sz)
		if sel:
			r = r.grow(3)
		draw_rect(r, Color(0.02, 0.03, 0.05, 0.62 if sel else 0.42))
		draw_rect(r, ACCENT if sel else Color(1, 1, 1, 0.12), false, 2.0 if sel else 1.0)
		var ic: String = SLOT_ICONS[s]
		if s == "place":
			ic = ITEM_ICONS.get(Player.PLACE_KINDS[p.place_idx], "campfire")
		var have := true
		var frac := -1.0
		var count := ""
		if Items.is_tool_item(s):
			var d := int(Game.tools.get(s, 0))
			have = d > 0
			frac = float(d) / Items.TOOLS[s]
		elif s == "build":
			var k: String = Player.BUILD_KINDS[p.build_idx]
			var cost: Dictionary = StructurePiece.DEFS[k]["cost"]
			var id: String = cost.keys()[0]
			count = str(Game.count(id) / int(cost[id]))
			ic = "plank" if k != "stone" else "stone"
		elif s == "place":
			count = str(Game.count(Player.PLACE_KINDS[p.place_idx]))
			have = Game.count(Player.PLACE_KINDS[p.place_idx]) > 0
		var icol := Color(1, 1, 1, 0.95 if sel else 0.75) if have else Color(1, 1, 1, 0.22)
		_icon(ic, Rect2(r.position + Vector2(12, 10), Vector2(r.size.x - 24, r.size.y - 24)), icol)
		_text(r.position + Vector2(5, 15), str(i + 1), 13, Color(1, 1, 1, 0.6), HORIZONTAL_ALIGNMENT_LEFT, "Bold")
		if count != "":
			_text(Vector2(r.position.x, r.end.y - 4), count, 15, TEXT, HORIZONTAL_ALIGNMENT_RIGHT, "Bold", r.size.x - 5)
		if frac >= 0.0:
			var bw := r.size.x - 12
			draw_rect(Rect2(r.position.x + 6, r.end.y - 6, bw, 3), Color(0, 0, 0, 0.6))
			if frac > 0.0:
				var dc := Color(0.45, 0.9, 0.45).lerp(Color(1.0, 0.3, 0.2), 1.0 - smoothstep(0.1, 0.5, frac))
				draw_rect(Rect2(r.position.x + 6, r.end.y - 6, bw * frac, 3), dc)


func _draw_effort(c: Vector2, p: Player) -> void:
	# stamina / breath only appear when they matter
	var w := 220.0
	if p.stamina < 0.995:
		draw_rect(Rect2(c.x - w * 0.5, c.y, w, 4), Color(0, 0, 0, 0.5))
		draw_rect(Rect2(c.x - w * 0.5, c.y, w * p.stamina, 4), Color(1, 1, 1, 0.85))
	if p.breath < 0.995:
		draw_rect(Rect2(c.x - w * 0.5, c.y - 9, w, 4), Color(0, 0, 0, 0.5))
		draw_rect(Rect2(c.x - w * 0.5, c.y - 9, w * p.breath, 4), Color(0.45, 0.8, 1.0))

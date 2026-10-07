class_name SurvivalPanel
extends PanelContainer
## Tab screen: your condition, what you carry (eat from here) and crafting.

var _cols: HBoxContainer


func _ready() -> void:
	theme = UiKit.theme()
	set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	grow_horizontal = Control.GROW_DIRECTION_BOTH
	grow_vertical = Control.GROW_DIRECTION_BOTH
	custom_minimum_size = Vector2(980, 520)
	Game.inventory_changed.connect(_rebuild)
	_rebuild()


func _rebuild() -> void:
	if _cols:
		_cols.queue_free()
	_cols = HBoxContainer.new()
	_cols.add_theme_constant_override("separation", 36)
	add_child(_cols)
	_cols.add_child(_status_column())
	_cols.add_child(_inventory_column())
	_cols.add_child(_craft_column())


func _column(title: String, w: float) -> VBoxContainer:
	var vb := VBoxContainer.new()
	vb.custom_minimum_size.x = w
	vb.add_theme_constant_override("separation", 8)
	vb.add_child(UiKit.label(title, 24))
	return vb


func _status_column() -> VBoxContainer:
	var vb := _column("You", 250)
	var v := Game.player.vitals
	for e in [["Health", v.health], ["Food", v.food], ["Water", v.water], ["Energy", v.energy]]:
		vb.add_child(UiKit.label("%s   %d / 100" % [e[0], int(e[1])], 16))
	vb.add_child(UiKit.label("Body temperature  %.1f °C" % v.body_temp, 16))
	vb.add_child(UiKit.label("Wet  %d%%" % int(v.wetness * 100.0), 16))
	if not v.status.is_empty():
		vb.add_child(UiKit.label(" · ".join(v.status), 16, Color(1.0, 0.6, 0.45)))
	var tips := UiKit.label("Coconuts give food AND water.\nCook fish on a campfire — raw fish can make you sick.\nRain collectors give fresh water.\nStay dry and near fire at night.\nSleep in a bed to skip the night.", 13, Color(1, 1, 1, 0.45))
	tips.autowrap_mode = TextServer.AUTOWRAP_WORD
	tips.custom_minimum_size.x = 250
	vb.add_child(tips)
	return vb


func _inventory_column() -> VBoxContainer:
	var vb := _column("Carrying", 280)
	var any := false
	for id in Game.inventory:
		var n := int(Game.inventory[id])
		if n <= 0:
			continue
		any = true
		var hb := HBoxContainer.new()
		var l := UiKit.label("%s  ×%d" % [Items.item_name(id), n], 16)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hb.add_child(l)
		if Items.FOOD.has(id):
			var f: Dictionary = Items.FOOD[id]
			var b := UiKit.button("Eat", func() -> void: Game.player.vitals.eat(id), 80)
			b.tooltip_text = "+%d food  +%d water" % [int(f["food"]), int(f["water"])]
			b.custom_minimum_size.y = 32
			hb.add_child(b)
		vb.add_child(hb)
	if not any:
		vb.add_child(UiKit.label("Nothing yet — chop, dig, gather.", 15, Color(1, 1, 1, 0.5)))
	vb.add_child(UiKit.label("Weight  %.0f / %.0f kg" % [Game.carried_weight(), Items.MAX_CARRY], 14, Color(1, 1, 1, 0.55)))
	vb.add_child(UiKit.label("Tools", 20))
	for t in Items.TOOLS:
		var d := int(Game.tools.get(t, 0))
		var txt := "%s  %d%%" % [Items.item_name(t), int(100.0 * d / Items.TOOLS[t])] if d > 0 else "%s  —" % Items.item_name(t)
		vb.add_child(UiKit.label(txt, 15, Color(1, 1, 1, 0.85 if d > 0 else 0.4)))
	return vb


func _craft_column() -> VBoxContainer:
	var vb := _column("Crafting", 340)
	vb.add_child(UiKit.label("Logs are sawn into planks automatically (1 log = 4 planks).", 12, Color(1, 1, 1, 0.45)))
	for r in Items.RECIPES:
		var hb := HBoxContainer.new()
		var info := VBoxContainer.new()
		info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		info.add_theme_constant_override("separation", 0)
		var cost := PackedStringArray()
		for id in r["cost"]:
			cost.append("%d %s" % [r["cost"][id], Items.item_name(id).to_lower()])
		info.add_child(UiKit.label(Items.item_name(r["id"]), 16))
		info.add_child(UiKit.label(", ".join(cost) + " — " + String(r["desc"]), 12, Color(1, 1, 1, 0.5)))
		hb.add_child(info)
		var b := UiKit.button("Craft", func() -> void: Game.craft(r), 90)
		b.custom_minimum_size.y = 34
		b.disabled = not Game.can_afford(r["cost"])
		hb.add_child(b)
		vb.add_child(hb)
	return vb

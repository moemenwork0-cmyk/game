class_name Vitals
extends Node
## Survival needs. Rates are per in-game hour (one hour = day_minutes*60/24 real seconds).

signal died

const HUNGER_RATE := 4.0      # a full stomach lasts ~25 game hours
const THIRST_RATE := 6.0      # ~16 game hours without water
const ENERGY_RATE := 4.5
const STARVE_DAMAGE := 14.0
const COLD_DAMAGE := 6.0
const REGEN := 4.0

var health := 100.0
var food := 85.0
var water := 85.0
var energy := 90.0
var body_temp := 37.0
var wetness := 0.0
var sick := 0.0   # hours of food poisoning left
var dead := false
var ambient_temp := 26.0
var status := PackedStringArray()


func to_dict() -> Dictionary:
	return {"health": health, "food": food, "water": water, "energy": energy,
		"temp": body_temp, "wet": wetness, "sick": sick}


func from_dict(d: Dictionary) -> void:
	health = float(d.get("health", 100.0))
	food = float(d.get("food", 85.0))
	water = float(d.get("water", 85.0))
	energy = float(d.get("energy", 90.0))
	body_temp = float(d.get("temp", 37.0))
	wetness = float(d.get("wet", 0.0))
	sick = float(d.get("sick", 0.0))


## Simulates `hours` of in-game time (also used for sleeping, with a lower metabolism).
func advance(hours: float, exertion: float = 1.0, asleep: bool = false) -> void:
	if dead:
		return
	var metab := 0.5 if asleep else exertion
	food = maxf(food - HUNGER_RATE * metab * hours, 0.0)
	var thirst_mult := 1.6 if body_temp > 38.3 else 1.0
	water = maxf(water - THIRST_RATE * metab * thirst_mult * hours, 0.0)
	if asleep:
		energy = minf(energy + 13.0 * hours, 100.0)
	else:
		energy = maxf(energy - ENERGY_RATE * exertion * hours, 0.0)

	# body temperature drifts toward what the environment pushes it to
	var target := 37.0 + clampf((ambient_temp - 22.0) * 0.16, -4.5, 2.0)
	body_temp = move_toward(body_temp, target, 1.2 * hours)

	var dmg := 0.0
	if food <= 0.0:
		dmg += STARVE_DAMAGE
	if water <= 0.0:
		dmg += STARVE_DAMAGE * 1.5
	if body_temp < 35.5:
		dmg += COLD_DAMAGE * (2.5 if body_temp < 34.3 else 1.0)
	if sick > 0.0:
		sick = maxf(sick - hours, 0.0)
		dmg += 5.0
	if dmg > 0.0:
		hurt(dmg * hours)
	elif food > 55.0 and water > 55.0 and body_temp > 36.0:
		health = minf(health + REGEN * hours, 100.0)
	_update_status()


func hurt(amount: float, reason: String = "") -> void:
	if dead:
		return
	health = maxf(health - amount, 0.0)
	if reason != "" and Game.hud:
		Game.toast.emit(reason)
	if health <= 0.0:
		dead = true
		died.emit()


func eat(id: String) -> bool:
	if not Items.FOOD.has(id) or Game.count(id) <= 0:
		return false
	var f: Dictionary = Items.FOOD[id]
	Game.inventory[id] = Game.count(id) - 1
	food = minf(food + float(f["food"]), 100.0)
	water = minf(water + float(f["water"]), 100.0)
	if randf() < float(f["sick"]):
		sick = 6.0
		Game.toast.emit("You feel sick… raw fish should be cooked first")
	else:
		Game.toast.emit("Ate %s" % Items.item_name(id))
	if Game.sfx:
		Game.sfx.play("eat")
	Game.inventory_changed.emit()
	return true


func drink(amount: float) -> void:
	water = minf(water + amount, 100.0)
	if Game.sfx:
		Game.sfx.play("drink")


func reset_after_death() -> void:
	dead = false
	health = 60.0
	food = maxf(food, 45.0)
	water = maxf(water, 45.0)
	energy = maxf(energy, 50.0)
	body_temp = 37.0
	wetness = 0.0
	sick = 0.0


func _update_status() -> void:
	status = PackedStringArray()
	if food < 20.0:
		status.append("Starving" if food <= 0.0 else "Hungry")
	if water < 20.0:
		status.append("Dehydrated" if water <= 0.0 else "Thirsty")
	if energy < 15.0:
		status.append("Exhausted")
	if body_temp < 35.5:
		status.append("Freezing" if body_temp < 34.3 else "Cold")
	elif body_temp > 38.3:
		status.append("Overheated")
	if wetness > 0.4:
		status.append("Wet")
	if sick > 0.0:
		status.append("Sick")

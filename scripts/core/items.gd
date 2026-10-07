class_name Items
extends RefCounted
## Item, food, tool and recipe definitions.

## food: hunger restored, water: thirst restored, sick: chance of food poisoning
const FOOD := {
	"coconut": {"food": 12.0, "water": 22.0, "sick": 0.0},
	"berry": {"food": 5.0, "water": 3.0, "sick": 0.0},
	"fish_raw": {"food": 10.0, "water": 0.0, "sick": 0.35},
	"fish_cooked": {"food": 34.0, "water": 0.0, "sick": 0.0, "morale": 5.0},
	"tin": {"food": 30.0, "water": 6.0, "sick": 0.0, "morale": 6.0},
	"waterbottle": {"food": 0.0, "water": 45.0, "sick": 0.0, "morale": 3.0},
	"medkit": {"food": 0.0, "water": 0.0, "sick": 0.0, "health": 45.0, "morale": 4.0},
}
## best first, used by quick-eat
const EAT_ORDER := ["fish_cooked", "tin", "coconut", "waterbottle", "berry", "fish_raw"]

const NAMES := {
	"log": "Log", "plank": "Plank", "stone": "Stone", "dirt": "Dirt", "sand": "Sand",
	"coconut": "Coconut", "berry": "Berries", "fish_raw": "Raw fish", "fish_cooked": "Cooked fish",
	"campfire": "Campfire kit", "collector": "Rain collector kit", "bed": "Bed kit",
	"tin": "Canned food", "waterbottle": "Water bottle", "medkit": "First-aid kit", "flare": "Red flare",
	"axe": "Axe", "pickaxe": "Pickaxe", "shovel": "Shovel", "spear": "Fishing spear", "torch": "Torch",
}

## kg per unit — carrying more than MAX_CARRY slows you down
const WEIGHT := {
	"log": 12.0, "plank": 3.0, "stone": 2.0, "dirt": 1.5, "sand": 1.5, "coconut": 1.2,
	"berry": 0.05, "tin": 0.4, "waterbottle": 0.6, "medkit": 0.5, "flare": 0.3, "fish_raw": 0.6, "fish_cooked": 0.5, "campfire": 20.0, "collector": 14.0, "bed": 18.0,
}
const MAX_CARRY := 70.0

## tools: max durability (uses; torch = seconds of burn time)
const TOOLS := {"axe": 120, "pickaxe": 120, "shovel": 150, "spear": 40, "torch": 360}

const RECIPES := [
	{"id": "axe", "cost": {"plank": 2, "stone": 3}, "desc": "Fell trees, dismantle wood"},
	{"id": "pickaxe", "cost": {"plank": 2, "stone": 4}, "desc": "Break boulders and rock"},
	{"id": "shovel", "cost": {"plank": 2, "stone": 2}, "desc": "Dig and fill terrain"},
	{"id": "spear", "cost": {"plank": 1, "stone": 1}, "desc": "Catch fish in the lagoon"},
	{"id": "torch", "cost": {"plank": 1}, "desc": "Light at night (6 min)"},
	{"id": "campfire", "cost": {"log": 2, "stone": 4}, "desc": "Warmth, light, cooking"},
	{"id": "collector", "cost": {"plank": 4, "stone": 2}, "desc": "Collects rain to drink"},
	{"id": "bed", "cost": {"plank": 6}, "desc": "Sleep until morning, respawn point"},
]


static func item_name(id: String) -> String:
	return NAMES.get(id, id.capitalize())


static func is_tool_item(id: String) -> bool:
	return TOOLS.has(id)

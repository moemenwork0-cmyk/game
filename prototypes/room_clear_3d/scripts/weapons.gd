class_name Weapons
extends RefCounted
## Weapon table. dmg is per pellet; rate is seconds between shots; unlock = campaign mission
## that must be completed first (0 = always available).

const DATA := {
	"rifle": {
		"name": "M4 CARBINE", "icon": "w_rifle", "dmg": 24.0, "rate": 0.1, "mag": 30, "spread": 0.012,
		"pellets": 1, "reload": 1.7, "kick": 1.0, "sound": "shot", "unlock": 0, "move": 1.0,
		"desc": "Reliable all-rounder. Accurate full auto.",
	},
	"smg": {
		"name": "MP5 SMG", "icon": "w_smg", "dmg": 15.0, "rate": 0.066, "mag": 32, "spread": 0.028,
		"pellets": 1, "reload": 1.4, "kick": 0.6, "sound": "smg", "unlock": 2, "move": 1.12,
		"desc": "Blistering fire rate, light and fast. Close quarters.",
	},
	"shotgun": {
		"name": "M870 SHOTGUN", "icon": "w_shotgun", "dmg": 14.0, "rate": 0.72, "mag": 6, "spread": 0.085,
		"pellets": 9, "reload": 2.3, "kick": 2.4, "sound": "shotgun", "unlock": 4, "move": 1.0,
		"desc": "Devastating up close. Sends bodies flying.",
	},
	"ak": {
		"name": "AK-47", "icon": "w_ak", "dmg": 34.0, "rate": 0.125, "mag": 30, "spread": 0.02,
		"pellets": 1, "reload": 1.9, "kick": 1.6, "sound": "shot_heavy", "unlock": 7, "move": 0.95,
		"desc": "Hard-hitting 7.62. Two to the body, one to the head.",
	},
}
const ORDER := ["rifle", "smg", "shotgun", "ak"]


static func get_def(id: String) -> Dictionary:
	return DATA.get(id, DATA["rifle"])


## 0..1 stats for the loadout bars.
static func stats(id: String) -> Dictionary:
	var d := get_def(id)
	return {
		"DAMAGE": clampf(d["dmg"] * d["pellets"] / 120.0 + 0.15, 0.0, 1.0),
		"FIRE RATE": clampf(0.07 / d["rate"], 0.05, 1.0),
		"ACCURACY": clampf(1.0 - d["spread"] * 9.0, 0.05, 1.0),
		"MOBILITY": clampf((d["move"] - 0.8) / 0.35, 0.05, 1.0),
	}

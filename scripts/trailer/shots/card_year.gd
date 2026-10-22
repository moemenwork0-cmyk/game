extends TrailerCard


func build(tr: Trailer) -> void:
	duration = 3.6
	lines = [["في عام ٢٠٣١...", "res://assets/fonts/Amiri-Regular.ttf", 76]]
	lines.append(["ابتلعَ البحرُ العالم", "res://assets/fonts/Amiri-Regular.ttf", 96, Color(1.0, 0.93, 0.8)])
	setup_card(tr)

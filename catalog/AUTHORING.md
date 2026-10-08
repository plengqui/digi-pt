# Catalog authoring rules

Each part file in `catalog/parts/` is a JSON array of exercise entries. Entries are later merged into `catalog/source.json`.

Entry shape (all keys required unless noted):

```json
{
  "id": "hip-thrust-barbell",
  "name_sv": "Höftlyft med skivstång",
  "name_en": "Barbell hip thrust",
  "aliases": ["hip thrust", "hip thrusts"],
  "type": "styrka",
  "primary": ["glutes"],
  "secondary": ["hamstrings"],
  "equipment": "skivstång",
  "common": 1,
  "description_sv": "Övre ryggen mot en bänk, skivstången över höften, pressa höften uppåt."
}
```

Rules:

- `id`: lowercase ascii, words separated by hyphens, pattern `<movement>-<variant/equipment>`, e.g. `squat-barbell-back`, `row-cable-seated`, `plank-forearm`. Must be globally unique. Prefix ids with the movement, not the equipment.
- `name_sv`: the Swedish name a Swedish gym-goer would use. Many are English loanwords (e.g. "Hip thrust", "Lat pulldown", "Burpees") - use those when a Swedish term is not common. Must be unique across the whole catalog, so include the equipment/variant in the name when needed ("Bänkpress med hantlar", "Bänkpress med skivstång").
- `name_en`: standard English name, used for the YouTube search link, so pick the most common searchable name.
- `aliases`: 0-4 alternative names (Swedish or English, lowercase), without repeating name_sv or name_en. Aliases must not collide with other entries' names or aliases. Keep aliases specific (never a bare word like "press" or "rygg").
- `type`: `"styrka"` or `"kardio"`. Cardio entries (treadmill, bike, rower, ski-erg, stair machine, jump rope, running, walking, elliptical, swimming, ...) have `"primary": []` and `"secondary": []`.
- `primary`: 1-2 fine tags (3 only for true compound movements such as deadlift or clean). STRICT: the one or two muscles the exercise mainly trains. Over-tagging breaks the app's rest rule. Examples: squat -> ["quads","glutes"]; Romanian deadlift -> ["hamstrings","glutes"]; lat pulldown -> ["lats"]; bench press -> ["chest"]; overhead press -> ["front_delts"]; bent-over row -> ["lats","upper_back"]; plank -> ["abs"]; calf raise -> ["calves"]; bicep curl -> ["biceps"]; triceps pushdown -> ["triceps"]; face pull -> ["rear_delts"]; shrug -> ["traps"]; hyperextension -> ["lower_back"]; lateral raise -> ["side_delts"].
- `secondary`: 0-3 fine tags, informational only. Never repeat a primary tag.
- Allowed fine tags (exactly these): calves, quads, hamstrings, adductors, glutes, lower_back, lats, upper_back, traps, front_delts, side_delts, rear_delts, chest, biceps, triceps, forearms, abs, obliques.
- `equipment` (Swedish, lowercase, one of): skivstång, hantlar, kettlebell, kabel, maskin, smithmaskin, kroppsvikt, gummiband, trx, medicinboll, viktskiva, bänk, box, bosu, pilatesboll, släde, trap bar, ez-stång, landmine, battle ropes, löpband, crosstrainer, cykel, roddmaskin, skierg, trappmaskin, hopprep, assault bike, övrigt.
- `common`: 1 very common in a normal commercial gym, 2 common, 3 rare/niche.
- `description_sv`: one or two short Swedish sentences (max ~160 chars) describing how to perform it. Plain, friendly tone, no exclamation marks.

Quality: real exercises only, no made-up movements. Cover machines, free weights, cables, bodyweight, kettlebell, bands and common circuit stations. Prefer breadth of distinct movements and realistic variants over trivial variants.

Output: valid JSON (UTF-8, no comments, no trailing commas), nothing else in the file.

# Digital PT: product spec (v1)

Working title. A personal gym-training app for one user (Mette), specified by Per and Mette in a design discussion on 2026-10-08.

**How to use this file.** Read all of it before proposing anything. Work one slice at a time (section 10) and propose a plan for the slice before writing code. Do not deviate from section 2 without asking. Items marked **DEFAULT** are proposals that the users have not confirmed; they are listed again in section 12.

## 1. Summary

A client-only PWA on her iPhone that:

- keeps a library of exercises tagged by type (styrka/kardio) and muscle group,
- makes it easy to add exercises from a large built-in catalog, or by hand,
- logs which exercises she did each day (exercise level only: no sets, reps or weights),
- suggests a session that avoids muscle groups trained in the last 4 calendar days and favours those trained longest ago relative to how often she wants to train them,
- lets her ignore the suggestion and just log, and hints when a muscle group has been neglected for very long.

It must have a very user-friendly GUI, very easy to understand. Use nice colours with a palette that builds around light pink and purple. 

Context: she trains 3–5 days a week, mostly strength and circuit training, and has the phone with her on the gym floor. The app must be very simple to use and understand.

## 2. Hard constraints

1. **Client-only.** No backend, no accounts, no API keys, no analytics, no LLM calls at runtime. After first load the app makes no network requests except fetching its own updates. Outbound links open outside the app.
2. **iPhone, installed to the Home Screen**, `display: standalone`, fully usable offline.
3. **Single user, single device.** No sync.
4. **UI in Swedish.** Code, comments and identifiers in English. All UI strings in one file.
5. **Deterministic rules.** Every suggestion and hint can show its reason.

Out of scope for v1: sets/reps/weights, timers, charts, watch app, multiple users, cloud sync, AI lookup or web search for exercises, user-editable muscle-group list.

Already considered and rejected (do not reintroduce): native iOS or watch app; a serverless function for AI lookup or backup; an LLM chat as the interface.

## 3. Platform requirements (iOS PWA)

- **Install gate.** When not running standalone, show only install instructions ("Dela → Lägg till på hemskärmen"). Reasons: a Home Screen web app has storage separate from Safari, and Safari deletes a site's data after about a week without use, while installed standalone apps are exempt.
- Call `navigator.storage.persist()` on first run and show the result on the diagnostics screen.
- All data in IndexedDB.
- The service worker precaches the app shell and the catalog. An update must reach her within one app restart. She must never need to clear a cache.
- Ergonomics: one-handed use, tap targets ≥ 48 px, body text ≥ 17 px, inputs ≥ 16 px (no zoom on focus), safe-area insets, light and dark mode.
- **Diagnostics** (Inställningar → Om): version and build date, display mode, storage-persisted flag, storage estimate, last 20 captured errors, "Kopiera diagnostik". The developer has no Mac, so there is no Safari Web Inspector for the phone.

## 4. Domain model

Muscle groups are a fixed list in config (**DEFAULT**): vader, lår, rumpa, rygg, mage, skuldror, axlar, biceps, triceps, bröst, plus the pseudo-group kardio.

```ts
type GroupId = 'vader' | 'lar' | 'rumpa' | 'rygg' | 'mage' | 'skuldror'
             | 'axlar' | 'biceps' | 'triceps' | 'brost' | 'kardio';
type Frequency = 'ofta' | 'ibland' | 'sallan';

interface Exercise {
  id: string;
  name: string;                 // Swedish display name
  nameEn?: string;
  type: 'styrka' | 'kardio';
  primary: GroupId[];           // 1-2 groups, rarely 3; ['kardio'] for cardio
  secondary: GroupId[];         // informational only
  description?: string;
  catalogId?: string;           // set when copied from the catalog
  archived: boolean;
}

interface Session {
  date: string;                 // local calendar date, YYYY-MM-DD; one session per date
  entries: { exerciseId: string; done: boolean; source: 'suggested' | 'manual' }[];
}

interface Settings {
  frequency: Record<GroupId, Frequency>;   // all start at 'ibland'
  exercisesPerSession: number;
  groupsPerSession: number;
  shape: 'fokus' | 'helkropp';
  firstUseDate: string;
  lastExportAt?: string;
  schemaVersion: number;
}
```

Data rules:

- A day is a local calendar date string. All rule logic uses whole-day differences between date strings, never timestamps. "Today" is passed into engine functions.
- An entry counts only when `done` is true. Unticked entries are a plan, not history.
- Only primary groups count in the rules.
- Deleting an exercise that appears in history archives it instead.

## 5. Rules engine

Pure functions in their own module, with no DOM or storage access, fully unit-tested.

### Constants (one file, all **DEFAULT**)

| Constant | Value | Meaning |
|---|---|---|
| `REST_DAYS` (per group) | 4 for strength groups, 0 for kardio | Trained on day D means resting D+1 to D+4, available again D+5 |
| `TARGET_INTERVAL` strength | ofta 5, ibland 8, sällan 14 days | How often she wants to train the group |
| `TARGET_INTERVAL` kardio | ofta 2, ibland 5, sällan 10 days | |
| `HINT_FACTOR` | 2 | Hint when days since ≥ factor × target interval |
| `EXERCISES_PER_SESSION` | 8 (range 4–12) | |
| `GROUPS_PER_SESSION` | 3 (range 2–4) | Used by the "fokus" shape |
| `MAX_HINTS` | 3 | |

### Definitions (group g, on date `today`)

- `lastTrained(g)`: latest date with a done entry whose exercise has g as a primary group.
- `daysSince(g)`: whole days from `lastTrained(g)` to `today`; undefined if never trained.
- `resting(g)`: `1 ≤ daysSince(g) ≤ REST_DAYS(g)`. Training earlier today does not make a group resting today.
- `urgency(g) = daysSince(g) / TARGET_INTERVAL(g)`. A never-trained group is more urgent than any trained group.
- `overdue(g)`: `daysSince(g) ≥ HINT_FACTOR × TARGET_INTERVAL(g)`. For a never-trained group, count from `firstUseDate`.

### Suggesting a session

Inputs: today, history, library, settings, exercise count N, cardio on/off, seed.

1. **Candidates:** strength groups with at least one active exercise.
2. **Rank:** rested groups first, by urgency descending. Then resting groups, most rested first. Ties follow the config order.
3. **Choose groups.** Shape "fokus": the first `GROUPS_PER_SESSION` rested groups. Shape "helkropp": all rested groups in rank order, up to N. Resting groups are used only when the rested ones cannot fill N exercises; they are added most rested first and flagged `shortRest`.
4. **Allocate.** Fokus: split N as evenly as possible over the chosen groups, extras to the higher-ranked. Helkropp: one exercise per group in rank order, then a second round if N is not reached.
5. **Pick exercises** within a group: active strength exercises with g as primary that are not already in today's session. Prefer exercises whose other primary groups are also rested. Order by least recently done (never done first); break ties with the seed.
6. If a group cannot fill its share, give the remainder to the other chosen groups, then to the next ranked group.
7. **Never return an empty list** while the library has usable exercises.
8. **Cardio:** when on, prepend the least recently done cardio exercise. Default on when `urgency(kardio) ≥ 1`.
9. **Output:** the ordered list plus, per group, the data for its reason line: days since last trained, never trained, or short rest ("kort vila, 2 dagar").

Actions on a suggestion: start it; swap one exercise (next candidate in the same group); remove one; add any library exercise; change groups (chips; resting groups are selectable but labelled); change N; switch shape; toggle cardio; "Nytt förslag" (new seed).

### Manual mode and hints

- "Välj själv": pick from the library by group. Resting groups are labelled, never blocked. Ticking an exercise is all that is needed to log it.
- Hints on the Idag screen, in both modes: up to `MAX_HINTS` overdue groups that have at least one active exercise, most urgent first, for example "Vader: 23 dagar sedan".
- Earlier dates can be corrected from Historik (add or remove done exercises).

## 6. Screens

Four tabs.

- **Idag.** Date and hints. With no session today: two large buttons, "Föreslå pass" and "Välj själv". With a session: the checklist, grouped by muscle group, with a large checkbox per exercise, progress ("5 av 8") and "+ Lägg till övning". Every tap is saved immediately; there is no save button.
- **Övningar.** Her library grouped by muscle group, filter styrka/kardio, search. Exercise detail: name, type, groups, description, last done, "Visa på YouTube", edit, delete. "+ Ny övning" opens the add flow.
- **Historik.** First a status board: every group with days since last trained and its state (vilar / redo / länge sedan). Below it, sessions by date, newest first, editable.
- **Inställningar.** Frequency per group (Ofta / Ibland / Sällan), exercise count and groups per session, backup, Om (diagnostics).

**Add flow.** One search field with type-ahead over the library (hits marked "finns redan") and the catalog. "Bläddra i katalogen" by muscle group. "Skapa egen": name, type, primary group chips (1–2), optional secondary chips, optional note. Adding from the catalog copies the entry into the library; later catalog updates never change library entries.

**First run.** Install gate, then picking exercises from the catalog per muscle group (most common first, skippable).

## 7. Exercise catalog

- 500–900 gym exercises: machines, free weights, cables, bodyweight, kettlebell, bands, cardio machines and common circuit stations.
- Source of truth is `catalog/source.json`, one entry per exercise:

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

- `primary` and `secondary` use fine anatomical tags: calves, quads, hamstrings, adductors, glutes, lower_back, lats, upper_back, traps, front_delts, side_delts, rear_delts, chest, biceps, triceps, forearms, abs, obliques. Cardio entries have empty muscle lists.
- `catalog/mapping.json` maps fine tags to her groups (**DEFAULT**):

| Her group | Fine tags |
|---|---|
| vader | calves |
| lår | quads, hamstrings, adductors |
| rumpa | glutes |
| rygg | lats, upper_back, lower_back |
| skuldror | traps, rear_delts |
| axlar | front_delts, side_delts |
| bröst | chest |
| biceps | biceps, forearms |
| triceps | triceps |
| mage | abs, obliques |

- A build script applies the mapping and writes the catalog that ships with the app. The app itself only knows her groups.
- A validation script fails the build on: duplicate ids, unknown tags, a strength entry without a primary, more than three primaries, duplicate Swedish names, and alias collisions between different entries.
- **Tagging rule:** primary means the one or two muscle groups the exercise mainly trains. Be strict. Over-tagging breaks the rest rule.
- `common`: 1 very common, 2 common, 3 rare. Used for ordering only.
- **Search:** normalise both sides (lower case, å/ä → a, ö → o, strip spaces and hyphens). Match on `name_sv`, `name_en` and aliases. Rank library hits first, then prefix matches, then `common`. Tolerate one or two typos.
- **"Visa på YouTube":** `https://www.youtube.com/results?search_query=` followed by the English name (or the given name for her own exercises) and " exercise".

## 8. Backup

- **Export:** one JSON file with all stores and `schemaVersion`, named `digital-pt-YYYY-MM-DD.json`, handed to the iOS share sheet through the Web Share API with a file. Fall back to a download link.
- **Import:** file picker, validate, confirm ("Ersätter all data på den här telefonen"), replace.
- **Nudge** on Idag when the last export is older than 30 days and sessions have been logged since.
- The round trip must be lossless. Schema versioning and migrations exist from the first release.

## 9. Technology (proposed, not decided)

- Vite and TypeScript; React unless there is a reason to prefer something lighter; an IndexedDB wrapper such as Dexie; a PWA plugin such as vite-plugin-pwa for manifest and service worker; Vitest for unit tests. Confirm that each is current and maintained when scaffolding.
- Plain CSS, no UI kit, system font.
- Static hosting over HTTPS; the host is not chosen yet. Testing on the phone requires the deployed URL, so deployment is part of slice 1.

## 10. Build order

Each slice ends deployed and tried on the iPhone by Mette.

1. **Skeleton:** installable PWA, install gate, offline shell, update flow, diagnostics, deployment.
2. **Catalog and library:** catalog source, mapping and scripts; add flow; Övningar.
3. **Logging:** Välj själv, checklist, Historik.
4. **Backup:** export, import, nudge. This comes before she depends on the data.
5. **Engine:** status board, suggestions, hints, frequency settings.
6. **Polish:** first-run flow, empty states, wording.

## 11. Acceptance tests (engine, with fixed dates)

- Rygg trained on a Monday is resting Tuesday to Friday and available on Saturday.
- Day differences are correct across the daylight-saving changes in March and October and across month and year ends.
- With nothing rested, a suggestion is still returned, built from the most rested groups and flagged `shortRest`.
- With two rested groups that can fill the session, no resting group is added.
- An unticked planned exercise does not appear in history and does not affect `lastTrained`.
- A never-trained group ranks first in suggestions but produces no hint until `HINT_FACTOR × TARGET_INTERVAL` days after `firstUseDate`.
- Secondary groups never affect resting state or urgency.
- In a simulated 12 weeks with 4 sessions a week, groups are chosen roughly in inverse proportion to their target intervals.
- Export, wipe, import: the state is identical.

## 12. Open decisions

1. **Circuit days and the 4-day rule.** Default here: a circuit station counts like any strength exercise, and the fallback in section 5 handles the days when little is rested. 
2. **Muscle-group list and mapping.** Is skuldror meant as traps and rear shoulders, as mapped? Yes. Should lår be split into front and back? No. Should mage have a shorter rest than 4 days? Yes, and the rest should be configurable per type. 
3. **The constants in section 5**, in particular the target intervals and the session size.
4. **Whether "the last 4 calendar days" includes today.** Default: no, so D+1 to D+4 are blocked.
5. **Hosting, final app name and icon.** Only PWA, no backend. Will be hosted on my Netlify. Icon should be pink with a strong arm icon in black. 

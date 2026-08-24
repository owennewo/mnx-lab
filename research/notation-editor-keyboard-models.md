# Keyboard models in music notation editors

**Research, not roadmap.** A survey of how ten notation and tablature editors bind the
keyboard, with emphasis on the question that actually decides a keymap: **what is a mode,
how many kinds are there, and which of them does a tab-first editor need?**

Surveyed 2026-07-31. Nothing here is built; MNX Lab currently has **no keyboard handling at
all** (`grep -rl 'keydown\|KeyboardEvent' src/ worker/` → nothing). The last section is a
recommendation for if and when it gets some, and it is a recommendation, not a decision.

Tools covered: **Dorico 5/6**, **Sibelius**, **Finale** (discontinued 2024, still the
reference for one whole school of entry), **MuseScore Studio 4.x**, **Guitar Pro 7/8**,
**TuxGuitar**, **Soundslice**, **Flat**, **Noteflight**, **LilyPond/Frescobaldi**,
**Denemo**.

**Provenance warning.** Key tables from official documentation are marked ✅; tables
reconstructed from third-party shortcut aggregators (defkey, quickref.me, usethekeyboard,
hotkeyguru) are marked ⚠️ and may be a version behind or platform-mixed. Two official
sources (Guitar Pro's own shortcut list, Noteflight support, several musescore.org forum
nodes) refused automated fetching, so those rows are ⚠️ or paraphrased.

---

## 1. "Mode" means six different things

The single biggest source of confusion when comparing these products is that they all use
the word *mode* and none of them mean the same thing. Separating the senses makes the
comparison tractable.

| # | Sense | What it switches | Examples |
|---|---|---|---|
| **1** | **Task mode** | What the whole application is *for* right now; the panels, the tools, the meaning of almost every key | Dorico's Setup / Write / Engrave / Play / Print (`Ctrl+1`–`Ctrl+5`); Finale's tool palette, where the selected *tool* is the mode |
| **2** | **Input mode** | Whether keystrokes *create* music at a caret or *select and modify* existing music | MuseScore `N`; Sibelius `N`; Dorico's caret (`Shift+N`); **absent by design** in Guitar Pro, TuxGuitar, Soundslice |
| **3** | **Key layer** (quasi-mode) | What one bank of keys — nearly always the digits — means, without changing anything else | Sibelius Keypad pages; Flat's workflow modes (`Ctrl+1`–`Ctrl+4`); MuseScore's `Shift`+digit durations on tab staves |
| **4** | **Write semantics** | Whether new material *overwrites* or *displaces* what follows | Dorico Insert mode (`I`, scopes cycled with `Alt+I`); MuseScore's insert input method |
| **5** | **Syntax mode** (text tools only) | Which grammar the parser applies to the same characters | LilyPond `\chordmode`, `\drummode`, `\figuremode`, `\lyricmode`, `\markup`, `\notemode` |
| **6** | **Access mode** (view ↔ edit) | Whether the document is open for writing *at all* — and with it the whole presentation | Soundslice's View/Edit button; Flat's read-only mode; Noteflight's Edit / Play / Record (§3.9) |

A sixth, implicit one is worth naming because it is the one the user usually feels:

| # | Sense | What it switches | Examples |
|---|---|---|---|
| **0** | **Navigation mode** | The state where the score is read and traversed and *no* key mutates it | Everyone's "not in note input" state; made explicit and first-class only by the accessibility work (§4) |

Most arguments about "should there be a note input mode" are arguments about sense **2**
only. Nobody disputes senses 1, 3, 4 or 5 — Guitar Pro is proudly modeless in sense 2 while
shipping a full set of sense-3 layers.

### 1.1 Layers and modes are not the same animal

Sense 3 above is worth separating out properly, because "layer" and "mode" get used
interchangeably and the tools treat them very differently.

A **layer** swaps the meaning of *one bank of keys*. A **mode** changes what the application
is doing.

In Flat's Articulations layer, `A`–`G` still enter pitches, the arrows still navigate,
`Ctrl+G` still jumps to a measure — only the digits `1`–`9` change meaning. In MuseScore's
note input mode, near enough every key changes meaning, a caret appears, and the selection
stops being a selection and becomes an insertion point.

Four differences follow:

| | Layer | Mode |
|---|---|---|
| **Scope** | a defined, enumerable bank of keys | the whole interaction model — cursor, selection semantics, what a click does |
| **What else changes** | only the key→command table | session state: a caret exists or doesn't; keys create or select |
| **Cost of being in the wrong one** | you get a staccato instead of an eighth note — visible, undoable, and you did not lose your place | you typed a melody into the score while trying to navigate, or pressed a dozen keys that silently did nothing |
| **Where the state lives** | the keymap | the editing session |

**How the state is *held* cuts across both.** Jef Raskin's term **quasimode**
(*The Humane Interface*, 2000) names a state maintained by continuous physical action —
`Shift` is the canonical one. You cannot forget you are in it, because a finger is holding it
there, so mode errors become impossible. That turns the modal/modeless binary into a ladder:

| State held by | Example from this survey | Observed failure rate |
|---|---|---|
| Physical hold | `Shift`, `Alt`, `Ctrl` on every tool here | mode errors impossible |
| Toggle + permanently visible indicator | Sibelius's Keypad — the active layout is on screen at all times | rare |
| Toggle + transient signal | Flat's toast naming the active workflow mode | occasional |
| Toggle + subtle cue | MuseScore note input (cursor shape + toolbar highlight) | the subject of the Tantacrul critique (§2.4) |
| Toggle + no indicator | — | — |

This is why Sibelius gets away with **six** Keypad layouts stacked on the same digits: strictly
they are toggled, not held, so they are not quasimodes in Raskin's sense — but the Keypad is
permanently on screen, so the widget *is* the mode indicator. Soundslice greys out inactive
voices and Sibelius colour-codes them for the same reason: every mode in this survey that
users tolerate is one they can see.

**Layers and modes compose rather than compete.** Sibelius runs both simultaneously: `N` is a
mode, `F7`–`F12` are layers, and inside note input the active Keypad layout decides what the
digits do. MuseScore's `Shift`+digit durations exist only at the intersection of a mode and a
notation type.

**Every layer in the survey remaps digits; none remap letters.** That is not coincidence.
Letters carry mnemonics — `B` bend, `S` slide, `H` hammer-on — so remapping them destroys
what made them learnable. A digit carries only ordinal position, so its meaning is already
arbitrary and can be reassigned at no mnemonic cost. Combined with digits being the scarcest
key in a tab editor (frets want them, durations want them — §3.3), the digit bank is where
every one of these products put its layers.

---

## 2. Per-tool profiles

### 2.1 Dorico — the deepest keyboard model surveyed ✅

Sources: official Quick Reference Card v5 (Dorico 5.1, Aug 2024), steinberg.help 6.1.

Dorico is modal in senses **1, 2 and 4** simultaneously, and it is the only surveyed tool
where all three are exposed as first-class, separately-bound state.

#### Mode inventory — six separate systems

"Dorico's modes" usually means the five task modes, but there are six independent modal
systems stacked on top of each other. Counted generously this is around thirty distinct
states — **by a wide margin the most modal application in the survey.**

**1 — Task modes** (sense 1), the ones Dorico itself calls modes:

| Mode | Key | For |
|---|---|---|
| Setup | `Ctrl+1` | players, instruments, flows, layouts |
| Write | `Ctrl+2` | notes and notations |
| Engrave | `Ctrl+3` | graphical position and page layout |
| Play | `Ctrl+4` | piano roll, mixer, automation |
| Print | `Ctrl+5` | printing and export |

**2 — View modes:** Page view `Ctrl+Alt+1`, Galley view `Ctrl+Alt+2`.

**3 — Tool modes *within* a task mode.** Each task mode has its own toolbox, and the active
tool changes what dragging and clicking do:

| Task mode | Tools |
|---|---|
| Write | Hand ↔ Marquee (`Alt+H`) |
| **Engrave** | **Graphic Editing** (default) · **Note Spacing** · **Staff Spacing** · **Frames** |
| Play / Key Editor | Select · **Draw** (`Shift+Alt+2`) · **Line** · **Erase** |

Engrave's **Staff Spacing** is worth singling out: while it is active "you cannot make any
selections or make other types of edits to items in the current layout" — a tool that
suppresses editing until you leave it. It is the nearest thing Dorico has to a read-only
state, though it is scoped to a tool rather than to the document (§3.9).

**4 — Note input** (sense 2) — the caret, `Shift+N` — which contains **ten further toggles**,
the Write mode Notes toolbox:

| Toggle | Key |
|---|---|
| Pitch Before Duration | `K` |
| Chords | `Q` |
| **Insert** | `I` — plus a scope enum cycled with `Alt+I`, stop position `Shift+Alt+I` |
| Lock to Duration | `L` |
| Force Duration | `O` |
| Dotted Notes | `.` (`Alt+.` cycles dot count) |
| Rests | `,` |
| Tuplets | (`;` starts, `:` stops) |
| Grace Notes | `/` |
| Select (mouse input on/off) | assignable |

`Tie` (`T`) and `Scissors` (`U`) sit in the same toolbox but are one-shot actions, not states.

**5 — Jump Bar** (`J`) with two sub-modes: **Commands** (`Alt+C`) and **Go To** (`Alt+G`).

**6 — Voice** — `V` cycles which voice the caret writes into; `Shift+V` creates one.

#### What Dorico uses number keys for

Asked directly, because it decides whether the digits are free for anything else:

| Context | Keys | Meaning |
|---|---|---|
| Note input, **notation** staff | `1`–`9` (number row *or* numeric keypad) | **durations** — 5 = eighth, 6 = quarter, 7 = half; double-tap the same key for dotted |
| Note input, **tablature** staff | number keys | **fret numbers** — two digits typed quickly for 10+ |
| Transport (numeric keypad) | `0` stop · `Enter` play from playhead · `.` / `Del` return to start of flow · `-` rewind · `+` fast-forward | |
| Task modes | `Ctrl+1`–`Ctrl+5` | Setup / Write / Engrave / Play / Print |
| Zones | `Ctrl+6`–`Ctrl+0` | toolbar / left / lower / right / all |
| Views | `Ctrl+Alt+1` / `Ctrl+Alt+2` | Page / Galley |
| Jump Bar sub-modes (macOS) | `Ctrl+1` / `Ctrl+2` | Commands / Go To |
| Key Editor Draw tool | `Shift+Alt+2` | |
| MIDI trigger region popover | `Shift+0` | |
| Inside a popover | typed as text | `4/4`, `3:2`, a fret number, a bar number |
| **Voices** | **not on numbers at all** | `V` cycles, `Shift+V` sends to a new voice |

The pattern: **bare digits are always "the value at the caret"** — a duration on a notation
staff, a fret on tab — and every other numeric use is modifier-qualified and points at the
*application* rather than the music. Voices, notably, get no digits; Dorico spends a letter on
them instead.

**Why it works despite the count.** Every layer is named, bound to a mnemonic single key, and
— critically — has a permanent visible indicator: the mode tabs, the highlighted toolbox
button, the caret itself, the depressed state of each Notes toolbox toggle. It is finding 13
(§5) applied at scale: the number of modes a tool can carry is bounded not by the count but
by how many of them the user can see at once.

Zones toggle on `Ctrl+6`–`Ctrl+0`.

**Note input (sense 2)** — the caret. `Shift+N` starts it; the caret is a distinct object
from the selection.

| Action | Key |
|---|---|
| Advance caret | `Space` |
| Durations | `1`–`9` (5 = eighth, 6 = quarter, 7 = half) |
| Dotted | `.`; double-tap the duration key; `Alt+.` cycles dot count |
| Pitch, nearest | `A`–`G` |
| Pitch above / below | `Shift+Alt+A–G` / `Ctrl+Alt+A–G` |
| Rest | `,` |
| Chord input on/off | `Q` |
| Tuplet start / stop | `;` / `:` |
| Grace note | `/` (slashed toggle `Alt+/`) |
| Lock durations | `L` |
| Force durations | `O` |
| Tie | `T` |
| Pitch-before-duration toggle | `K` |
| New voice / switch voice | `Shift+V` / `V` |
| Slur start / stop | `S` / `Shift+S` |
| Repeat selection | `R` |

**Insert mode (sense 4):** `I` toggles, `Alt+I` cycles the *scope* (selected voices only →
all voices of the selected players → all players in the flow), `Shift+Alt+I` sets a stop
position. Scope-as-a-cycled-enum is unique to Dorico and is the most sophisticated answer
anyone has to "displace what, exactly?"

**Navigation (sense 0):** bare arrows navigate; `Tab` cycles *between notes and other music
items* — a second traversal axis over non-note objects. Editing is always on a modifier:

| Action | Key |
|---|---|
| Navigate | `←→↑↓` |
| Cycle notes ↔ music items | `Tab` |
| Move item rhythmically | `Alt+←→` |
| Transpose diatonic / octave / chromatic | `Alt+↑↓` / `Ctrl+Alt+↑↓` / `Shift+Alt+↑↓` |
| Lengthen/shorten by grid | `Shift+Alt+←→` |
| Grid resolution ∓ | `Alt+[` / `Alt+]` |
| Respell using note above/below | `Alt+-` / `Alt+=` |
| Cross to / move to staff above, below | `N`, `M` / `Alt+N`, `Alt+M` |
| Flip | `F` |

**Notations by popover:** `Shift+`letter opens a text popover — `Shift+D` dynamics,
`Shift+C` clefs, `Shift+K` key, `Shift+M` meter, `Shift+T` tempo, `Shift+O` ornaments,
`Shift+R` repeats, `Shift+B` barlines, `Shift+H` holds/pauses, `Shift+P` playing techniques,
`Shift+L` lyrics, `Shift+Q` chord symbols, `Shift+X` text, `Shift+A` rehearsal marks,
`Shift+F` fingering, `Shift+G` figured bass, `Shift+I` note tools. **This is the single most
copyable idea in the survey**: one mnemonic prefix opens a typed mini-language instead of
consuming a top-level binding per notation.

**Tablature ✅** — and this is where it gets interesting for a tab-first project. Because
the digits are frets, Dorico *rebinds duration onto `-` and `=`* inside tab:

| Action | Key |
|---|---|
| Fret number | number keys (two digits typed quickly for 10+) |
| Move caret between strings | `↑↓` |
| Shorter / longer duration | `-` / `=` |
| Move existing note to string above/below | `N` / `M` |
| Cycle chord diagrams | `Alt+Q` (alternatives `Shift+Alt+Q`) |

**Jump Bar (`J`)** — a command palette with *two internal modes*: **Commands** (fuzzy-search
and run any command by name) and **Go To** (bar number, page, rehearsal mark, flow), swapped
with `Alt+C` / `Alt+G` (Win). Supports user-assigned aliases.

### 2.2 Sibelius ⚠️/✅

Modal in sense 2 (`N` enters and leaves note input, `Esc` leaves), and the canonical
implementation of sense **3**: the **Keypad**, a persistent on-screen numeric pad with
several *pages*, each remapping the same digits to a different family of notations. The
digits never change position; their meaning does.

| Action | Key |
|---|---|
| Begin / exit note entry | `N` / `N` or `Esc` |
| Pitch | `A`–`G` |
| Add chord tone by interval above / below | number row `1`–`9` / `Shift+`number |
| Durations | Keypad `1`–`6` (1 = 32nd … 4 = quarter … 6 = whole) |
| Note ↔ rest toggle | Keypad `0` |
| Dot | Keypad `.` |
| Natural / sharp / flat | Keypad `7` / `8` / `9` |
| Diatonic pitch ± | `↑↓` |
| Octave ± | `Ctrl+↑↓` |
| Chromatic ± | `Shift+PageUp/PageDown` |
| Navigate notes / measures | `←→` / `Ctrl+←→` |
| Triplet | duration, then `Ctrl+3` |
| Find in Ribbon | `,` or `Ctrl+0` |

Two preset dimensions matter: a **duration-before-pitch ↔ pitch-before-duration** toggle
(the latter marketed explicitly as "Finale Speedy Entry mode" to court switchers), and a
**Notebook (laptop)** shortcut set for machines with no numeric keypad — an admission that
the Keypad's whole design is hostage to hardware that half of users no longer have.

### 2.3 Finale — modality by *tool* ⚠️/✅

Finale's sense-1 modality is extreme: the selected tool in the palette *is* the mode, and
Simple Entry vs Speedy Entry are two entire parallel entry systems.

- **Simple Entry** — pitch first, then the duration keypress commits the note. Numpad `1`–`8`
  select 64th → double-whole. `Alt+C` / `Alt+T` / `Alt+K` for clef / time / key.
- **Speedy Entry** — duration first, then the pitch commits it, inside a per-measure
  **editing frame**. `[` and `]` move the frame one measure left/right — the frame, not a
  caret, is the unit of position.

The pitch-first/duration-first split Finale institutionalised is now a *preference* in
Sibelius, and as of **MuseScore 4.5 (March 2025)** a whole new input method
("Input by Duration") added specifically to absorb Finale refugees. The order of the two
keystrokes is the deepest personality difference in this whole field, and by 2026 every
serious tool ships both.

### 2.4 MuseScore Studio 4.x ✅

Modal in sense 2 (`N` / `Esc`), with **five** input *methods* layered underneath, which is
sense 2 subdivided rather than a separate axis: **step-time** (default), **input by
duration** (pitch → duration, 4.5+), **re-pitch** (replace pitches, keep rhythm),
**rhythm** (durations only, no pitch), **real-time automatic/manual** (perform to a click or
tap the beat). An **insert** variant (sense 4) composes with the others.

| Action | Key |
|---|---|
| Toggle note input | `N` (exit also `Esc`) |
| Durations | `1` = 64th … `4` = 8th, `5` = quarter, `6` = half, `7` = whole, `8` = double whole, `9` = longa |
| Halve / double duration | `Q` / `W` |
| Dot | `.` |
| Pitch | `A`–`G`; `Shift+A–G` adds to chord |
| Rest | `0` |
| Accidentals | `-` flat, `=` natural, `+` sharp |
| Interval above | `Alt+1`–`Alt+9` |
| Pitch ± semitone | `↑↓` |
| Octave ± | `Ctrl+↑↓` |
| Navigate chord / measure | `←→` / `Ctrl+←→` |
| Extend selection | `Shift+←→`, `Ctrl+Shift+←→` to measure bounds |

**Tablature ✅** — MuseScore is the clearest case of the digit collision, and it solves it
with a *layer* (sense 3) rather than a rebind:

| Action | Key |
|---|---|
| Fret | digits `0`–`9` typed directly (letters `A`–`K`, no `I`, for French tab) |
| Durations on a tab staff | `Shift+0`–`Shift+9`, or NumPad `0`–`9`, or `Q`/`W` |
| Change string (in note input) | `↑↓` |
| Change fret on the same string (outside note input) | `↑↓` |
| Change fret, auto-optimising string | `Alt+Shift+↑↓` (works without leaving note input) |
| Move to adjacent string, keeping pitch | `Ctrl+↑↓` |

Note that `↑↓` means **string** inside note input and **fret** outside it. That is the
mode-dependent-arrow-key trap in its purest form, and it is exactly the trap a dual
notation+tab view walks into.

**The modeless debate.** MuseScore is where this was argued in public. Martin Keary
(Tantacrul)'s critique drove a redesign whose stated aim was to reduce how often users must
consciously enter and leave note input. The counter-argument in the project's own
long-running "why do we need note input mode?" thread is worth recording because it is the
strongest defence of sense-2 modality anywhere: essentially every notation editor examined
(a dozen-plus) has *some* state distinction; the mode is what lets the same click or
keystroke mean "add" or "select" cheaply, and prevents accidental mutation while merely
reading or formatting a score; and the modeless alternative forces the user to track
whether an invisible input position agrees with the visible selection.

### 2.5 Guitar Pro ⚠️

**Modeless in sense 2.** There is no note-input mode: the selection *is* the cursor, arrow
keys move it around the fretboard grid, and typing a digit sets the fret at the current
beat/string. Durations are **relative** (`+` / `-`) because the digits are spoken for. Its
entire top-level letter row is spent on technique — which is the correct trade for a
tab-first tool and the clearest evidence that a tab keymap is *not* a notation keymap with
frets bolted on.

| Group | Bindings |
|---|---|
| Duration | `+` / `-` adjust note value; `Shift+5` dot; `Ctrl+Shift+5` double dot; `/` triplet |
| Beats | `Insert` insert beat; `Shift+Delete` delete beats; `C` copy beats at end; `L` tie note; `Shift+L` tie beat; `R` rest |
| Pitch/string | `Shift+-` / `Shift++` semitone down/up; `Alt+↑↓` shift string |
| Technique | `X` dead, `O` ghost, `;` accent, `Shift+;` heavy accent, `B` bend, `H` hammer-on/pull-off, `S` legato slide, `Alt+S` shift slide, `Y` natural harmonic, `Alt+Y` artificial harmonic, `V`/`Alt+V` vibrato slight/wide, `W`/`Alt+W` trem-bar vibrato, `N` trill, `I` let ring, `[` palm mute, `Shift+0` tapping, `Shift+4` slap, `Ctrl+Shift+4` pop, `Shift+R` rasgueado |
| Strokes | `Ctrl+D`/`Ctrl+U` brush down/up, `Shift+D`/`Shift+U` pickstroke, `Ctrl+Shift+D`/`Ctrl+Shift+U` arpeggio |
| Bar | `Ctrl+Insert`/`Ctrl+Delete` insert/delete bar, `K` clef, `Ctrl+K` key, `Ctrl+T` time, `[`/`]` repeat open/close, `D` directions, `Ctrl+Enter` force line break |
| Navigation | `Ctrl+Home`/`Ctrl+End` first/last bar, `Ctrl+←→` rewind/forward, `Alt+←→` previous/next section, `Ctrl+G` go to |
| Discovery | Command Palette (Tools menu, `Cmd+E` on macOS); typing `?` lists commands |

### 2.6 TuxGuitar ✅

The open-source counterpart, and the most legible statement of the tab-editor consensus.
Modeless; arrows navigate the grid; **`Shift`+arrows edit the thing under the cursor**.

| Action | Key |
|---|---|
| Insert note (fret) | `0`–`29` typed |
| Next/previous note | `←→` |
| Previous/next measure | `Ctrl+←→` |
| First/last measure | `Ctrl+Shift+←→` |
| Move between strings | `↑↓` |
| Increase / decrease fret | `Shift+→` / `Shift+←` |
| Move note to string above / below | `Shift+↑` / `Shift+↓` |
| Duration ± | `+` / `-`; `*` dot; `/` triplet; `L` tie |
| Rest / clean beat / delete | `Ins` / `Ctrl+Del` / `Del` |
| Technique | `B` bend, `H` hammer/pull, `S` slide, `V` vibrato, `X` dead, `O` ghost, `P` palm mute, `F` fade in, `G` grace |
| Voices | `Ctrl+1` / `Ctrl+2` |
| Markers | `Shift+Ins` add; `Alt+←→` previous/next; `Alt+Shift+←→` first/last |

Note the near-identity of TuxGuitar's and Guitar Pro's technique letters (`B` `H` `S` `V`
`X` `O`). **There is a de facto standard tab-technique alphabet**, and a new tab editor that
invents its own is picking a fight for no gain.

### 2.7 Soundslice ✅

Web, transcription-first (notation editing welded to slowed-down audio/video, so the design
target is "eyes on the source recording, hands on the keys"). Modeless in sense 2.

- Selection is an orange circle on a note/rest; arrow keys move between beats and strings.
- **Notation entry auto-advances the cursor; tablature entry deliberately does not** — a
  considered asymmetry, because tab entry commonly stacks several strings on one beat.
- Duration is relative: `+` shorter, `-` longer. Fret `0`–`36` typed. Pitch `A`–`G`, octave
  `Ctrl+↑↓`, accidentals `Ctrl+J` / `Ctrl+G` / `Ctrl+H` (sharp/flat/natural).
- Chords: `Shift`+pitch letter, or `2`–`8` for intervals (`Shift` for below).
- `Alt+↑↓` moves a note to a different string **preserving pitch**.
- **186 commands, all rebindable**, plus shipped presets: *Soundslice default*, *Like Finale
  Simple Entry*, *Like Guitar Pro*, *Like Sibelius Notebook Entry*.

The preset list is the most honest artefact in the survey: it concedes that muscle memory,
not ergonomics, is what a keymap is actually competing on.

### 2.8 Flat ✅

Web. Modal in sense **3** and explicitly so — Flat is the only tool that named the key-layer
concept in its UI and shipped a toast notification telling you which layer is live.

| Layer | Key |
|---|---|
| Composing (default) | `Ctrl+1` |
| Articulations | `Ctrl+2` |
| Dynamics | `Ctrl+3` |
| Ornaments | `Ctrl+4` |

Digits `1`–`9` mean something different in each. In Composing: `1` whole, `2` half,
`3` quarter, `4` eighth, `5` 16th, `6` 32nd, `7` 64th — **ascending number = shorter note,
the exact opposite of MuseScore, Dorico, Sibelius and Finale.** In Articulations: `1`
staccato, `6` accent, `7` fermata.

Other bindings: `←→` next/previous note, `Ctrl+←→` measure, `Home`/`End` part bounds,
`Ctrl+G` go to measure, `Ctrl+Shift+↑↓` change staff, `Shift+←→` extend selection,
`Esc` deselect, `A`–`G` pitch, `Shift+A–G` chord tone, `↑↓` diatonic, `Ctrl+↑↓` octave,
`J` enharmonic toggle, `Alt+2–8` interval above (`Shift+Alt` below), `,` tie, `.` dot,
`S` slur, `P` pedal.

Discovery: `/` quick search anywhere in the editor; `Alt+/` (or `?`) full shortcut reference
with a **Customize** button. Auto-detects QWERTY/AZERTY/QWERTZ/Dvorak/Colemak on Chrome —
a real problem the desktop tools mostly ignore.

### 2.9 Noteflight ⚠️

Web, education-oriented. Letter keys `A`–`G` enter pitches; a one-page "Keyboard Command
Summary" is published, and shortcuts are user-addable. Notably the docs admit **not all
shortcuts appear in the shortcuts dialogue** (e.g. `C` to enter a C is undocumented there) —
a small cautionary tale about generating a help sheet from anything other than the binding
table itself. Official page blocked automated fetch; treat details as unverified.

### 2.10 LilyPond + Frescobaldi, and Denemo — the text and vim schools ✅

**LilyPond** has no keyboard model at all; it has sense-5 **syntax modes** in the source:
`\notemode` (default), `\chordmode`/`\chords`, `\drummode`/`\drums`, `\figuremode`/
`\figures`, `\lyricmode`/`\lyrics`/`\addlyrics`, `\markup`. The same characters mean
different things depending on the enclosing block. This is the same idea as Dorico's
popovers — a typed mini-language per notation domain — reached from the opposite direction.

**Frescobaldi** supplies the editing layer: point-and-click between code and engraved
output, `Ctrl+J` to centre and highlight the corresponding object in the music view, a
**snippet manager** driven by mnemonics, and up to four shortcuts bindable per action. The
code↔music bidirectional highlight is precisely MNX Lab's existing note↔JSON cross-highlight
(`model/noteKeys.ts` + `model/jsonView.ts`), arrived at independently.

**Denemo** is the only genuinely vim-modal notation editor: its own documentation describes
modes (Default, Blank, Replace, Insert) and its default keymap deliberately combines LilyPond
note names with vim conventions — the manual recommends doing the vim tutorial first. Its
cursor is *positionally* modal rather than command-modal: a large blue rectangle means
appending is possible, red means the measure is full, a small green rectangle means you are
inside existing material and keys will edit or insert before. Lowercase `a`–`g` edit the note
at the cursor; **uppercase `A`–`G` insert**; `0`–`6` insert a duration you then give a pitch.

Denemo is worth knowing about mostly as the boundary case: full vim modality in a notation
editor exists, has existed for two decades, and has not spread. The reason appears to be
that music already has a strong natural state distinction (§1 sense 2) and stacking a second
modal system on top buys little.

---

## 3. Cross-cutting comparison

### 3.1 Mode model

| Tool | Task modes (1) | Input mode (2) | Key layers (3) | Insert/overwrite (4) |
|---|---|---|---|---|
| Dorico | 5, `Ctrl+1`–`5` | caret, `Shift+N` | popover prefixes | `I`, scoped, `Alt+I` |
| Sibelius | ribbon tabs | `N` / `Esc` | **Keypad pages** | — |
| Finale | **tool = mode** | Simple / Speedy | numpad banks | — |
| MuseScore | — | `N` / `Esc`, 5 methods | `Shift`+digits on tab | insert method |
| Guitar Pro | — | **none** | — | `Insert` beat |
| TuxGuitar | — | **none** | — | `Ins` beat |
| Soundslice | — | **none** | — | — |
| Flat | — | implicit | **workflow modes**, `Ctrl+1`–`4` | — |
| Denemo | — | **vim modes** | — | Insert mode |
| LilyPond | — | n/a | n/a | text |

The pattern is stark and it is not about "modern vs legacy": **staff-notation-first tools
are modal in sense 2; tablature-first tools are not.** The reason is structural. On a staff,
vertical position is *pitch*, so the caret has to carry a pitch-and-duration intent that the
mouse cannot express. On a fretboard grid, vertical position is *string* — a discrete,
finite, addressable axis — so the selection can be the cursor and a typed digit is
unambiguous. Tab is a spreadsheet; staff notation is not.

### 3.2 The arrow-key contract — the most divergent binding in the field

| Tool | `←→` | `↑↓` | Edit-the-note arrows |
|---|---|---|---|
| Dorico | navigate | navigate | `Alt+↑↓` diatonic, `Ctrl+Alt+↑↓` octave, `Shift+Alt+↑↓` chromatic, `Shift+Alt+←→` duration |
| Sibelius | navigate notes | **diatonic pitch ±** | `Ctrl+↑↓` octave, `Shift+PgUp/Dn` chromatic |
| MuseScore (staff) | navigate | **semitone ±** | `Ctrl+↑↓` octave |
| MuseScore (tab) | navigate | **string in note input, fret outside it** | `Ctrl+↑↓` string keeping pitch, `Alt+Shift+↑↓` fret optimising string |
| Flat | navigate | **diatonic pitch ±** | `Ctrl+↑↓` octave, `Ctrl+Shift+↑↓` staff |
| Guitar Pro | navigate | navigate strings | `Shift+±` semitone, `Alt+↑↓` shift string |
| TuxGuitar | navigate | navigate strings | `Shift+←→` fret ±, `Shift+↑↓` move string |
| Soundslice | navigate beats | navigate strings | `Alt+↑↓` string keeping pitch, `Ctrl+↑↓` octave |

Two coherent camps, and they are **mutually incompatible on bare `↑↓`**:

- **Notation camp** (Sibelius, MuseScore, Flat): bare `↑↓` *mutates pitch*. Fast, and
  dangerous in a read-only context.
- **Tab camp** (Guitar Pro, TuxGuitar, Soundslice) **plus Dorico**: bare arrows *never
  mutate*; every edit takes a modifier. Dorico is in the tab camp on this despite being
  staff-first, and it is the only tool whose rule holds uniformly across staff and tab.

**For any editor that shows notation and tab simultaneously — which MNX Lab's `both` and
`compare` views do — the notation camp's rule cannot be applied consistently, because `↑↓`
would have to mean pitch in one pane and string in the other.** Dorico's answer (arrows
never mutate; `N`/`M` move a note between strings) is the only surveyed rule that survives a
dual view intact.

### 3.3 Duration numbering — nobody agrees

| Tool | Digit → duration | Direction |
|---|---|---|
| MuseScore | `1`=64th, `4`=8th, `5`=quarter, `6`=half, `7`=whole, `9`=longa | ↑ = longer |
| Dorico | `1`–`9`, `5`=eighth, `6`=quarter, `7`=half | ↑ = longer |
| Sibelius (Keypad) | `1`=32nd … `4`=quarter … `6`=whole | ↑ = longer |
| Finale Simple | numpad `1`–`8` = 64th → double whole | ↑ = longer |
| **Flat** | `1`=whole, `2`=half, `3`=quarter, `4`=eighth, `7`=64th | **↑ = shorter** |
| Guitar Pro / TuxGuitar / Soundslice / Dorico-tab | **no absolute digits** — `+`/`-` or `-`/`=` | relative |

Four tools agree on the *direction* and none agree on the *offset*; Flat inverts the
direction outright. There is no standard to inherit. What there *is*, unanimously, is the
rule that **on a tab staff the digits belong to frets and duration moves to a relative
pair** — Guitar Pro `+`/`-`, TuxGuitar `+`/`-`, Soundslice `+`/`-`, Dorico `-`/`=`, and
MuseScore's `Shift`-layer variant of the same concession.

### 3.4 Tab-specific conventions

| Concern | Convergent answer |
|---|---|
| Fret entry | bare digits at the current string/beat |
| Frets ≥ 10 | type two digits quickly (Dorico explicit; a known friction point in Guitar Pro) |
| Move between strings | `↑↓` navigates (all four tab-capable tools) |
| Move a *note* to another string, keeping pitch | modifier + `↑↓` (Soundslice `Alt`, MuseScore `Ctrl`) or a letter pair (Dorico `N`/`M`) |
| Duration | relative `+`/`-` |
| Technique alphabet | `B` bend · `H` hammer/pull · `S` slide · `V` vibrato · `X` dead · `O` ghost — shared by Guitar Pro and TuxGuitar, near-verbatim |
| Auto-advance after entry | **off** for tab (Soundslice states this explicitly), on for staff |

### 3.5 Discoverability and customisation

| Tool | Palette / search | Rebindable | Emulation presets |
|---|---|---|---|
| Dorico | **Jump Bar `J`** (Commands + Go To sub-modes, aliases) | yes | — |
| Flat | `/` quick search; `Alt+/` reference + Customize | yes | migration guides |
| Guitar Pro 8 | **Command Palette** (`Cmd+E`), `?` lists commands | yes | — |
| Soundslice | search finds commands and shows their keys | **186 commands** | **Finale / Guitar Pro / Sibelius** |
| Sibelius | **Find in Ribbon** (`,` or `Ctrl+0`) | yes | Notebook (laptop) set; Finale-style entry order |
| MuseScore | Preferences → Shortcuts | yes | "Input by Duration" for Finale users |
| TuxGuitar | Tools → Shortcuts key-binding editor | yes | — |
| Frescobaldi | snippet mnemonics | up to 4 per action | — |
| Denemo | — | yes; alternate "speedy entry" keymap | — |

Three observations. **(a)** The command-palette pattern has fully arrived — Dorico, Guitar
Pro 8, Flat and Sibelius all shipped one, and it is now the standard escape hatch that
removes the pressure to bind everything. **(b)** Dorico's Jump Bar having two sub-modes
(*run a command* vs *go to a place*) is the correct decomposition: navigation and invocation
are different verbs sharing one input box. **(c)** Emulation presets are table stakes for
any new entrant, because the competition is against installed muscle memory.

### 3.6 Key chaining — the field has almost entirely rejected it

A *chain* here means a multi-stroke binding in the vim/Emacs sense: a prefix key that opens a
transient namespace, then one or more further keys — `insert` → `technique` → `bend`.

| Tool | Chains supported? | Shipped by default? | What it does instead |
|---|---|---|---|
| **Denemo** | ✅ yes — "you can set a two-key keyboard shortcut… to activate the action" | ✅ **yes**, `A,A`–`G,G` | the only tool that ships a semantic chain |
| **MuseScore** | ✅ yes — the Define dialog is literally titled *Enter shortcut sequence* and takes **up to four keys** (Qt `QKeySequence`) | ❌ **none** | palette-free single combos |
| **Frescobaldi** | ~ up to four shortcuts per action — but those are *alternatives*, not a sequence | ❌ | snippet mnemonics |
| **Sibelius** | ❌ | — | **persistent Keypad layers** (below) |
| **Dorico** | ❌ | — | popover prefixes, Jump Bar, double-tap |
| **Guitar Pro / TuxGuitar / Soundslice / Flat / Noteflight** | ❌ (none found) | — | single letters, palette, fuzzy search |

So: **MuseScore has the mechanism and ships not one chained default; Denemo is the only tool
in the survey where a chain is a real, documented, default binding.** Nobody at all does the
hierarchical `insert > technique > bend` shape.

There are four substitutes, and they are all in use:

1. **Spend a single top-level letter on the hot set.** The tab-technique alphabet
   (`B` `H` `S` `V` `X` `O`, §3.4) is exactly this. Technique is high-frequency in tab, so
   Guitar Pro and TuxGuitar pay a whole letter each rather than a prefix.
2. **A persistent layer** — Sibelius's **six Keypad layouts**, switched with `F7`–`F12` or
   cycled with `+` (Common notes / More notes / Beams-Tremolos / Articulations / Jazz
   articulations / Accidentals), and Flat's four workflow modes. Costs one keystroke *per
   run* of same-family operations, not one per operation, and — critically — the active
   layer is **visible on screen** the whole time.
3. **A transient prefix into a typed mini-language** — Dorico's `Shift+`letter popovers,
   MuseScore's `Ctrl+F` go-to grammar, LilyPond's `\...mode` blocks. One prefix buys an
   *unbounded* vocabulary and is self-documenting, where a chain buys a fixed branch.
4. **The palette** (§3.5) as the catch-all for the long tail.

**Why chains lose here.** A chain costs a keystroke on *every* invocation and opens a
transient mode with no visible state unless you also build a which-key overlay; a layer costs
one keystroke per run and shows its state; a popover costs one prefix and scales without
limit. And notation entry is *already* inherently multi-stroke — duration then pitch, or
pitch then duration — so a third stroke per notation is felt immediately. Chains only win
where the vocabulary is large **and** each item is rare **and** you refuse a text prompt,
which is a narrow niche once a palette exists.

**The one chain shape that does pay** is not a hierarchy at all — it is *repetition as a
disambiguator*, same key, two meanings:

- Denemo: `a`–`g` **edits** the note at the cursor; double-struck `A,A`–`G,G` **inserts**
  before it. One binding carries the edit/insert distinction that other tools spend a whole
  mode (sense 4) on.
- Dorico: double-tap a duration key = dotted note. Also two-digit fret entry ("press the two
  digits quickly") — a timeout-disambiguated numeric argument, not a namespace.
- Sibelius: `Alt+Shift+0`–`22` for notehead types, where you "quickly enter the digits in
  order" — again a numeric argument, not a prefix tree.

That is worth stealing. A hierarchy is not.

### 3.7 Voices

| Tool | Switch | Create | Visual state |
|---|---|---|---|
| Dorico | `V` cycles | `Shift+V` new voice, `Shift+Alt+V` new slash voice | caret indicator shows the active voice |
| Flat | `V` toggles | — | — |
| MuseScore | `Ctrl+Alt+1`–`4` | fixed 4 | colour per voice |
| Sibelius | `Alt+1`–`4` | fixed 4 | colour-coded: 1 blue, 2 green, 3 orange, 4 purple |
| TuxGuitar | `Ctrl+1`, `Ctrl+2` | 2 voices | — |
| Soundslice | Voices menu always shows 1–4; click the number (rebindable) | fixed 4 | **other voices render light grey** while you edit one |
| Guitar Pro | ⚠️ not confirmed | 2 voices | — |

Two designs:

- **Cycle** — `V` in **both Dorico and Flat**, an unusually clean convergence. Cheap, and works
  with any number of voices.
- **Absolute index** — `Alt+n` (Sibelius), `Ctrl+Alt+n` (MuseScore), `Ctrl+n` (TuxGuitar).
  Direct, and constant-time to reach voice 4.

**Both do double duty**, which is the important part: the same binding sets the voice the
caret will write into *and* reassigns an existing selection into that voice. Sibelius's
`Alt+3` moves selected notes to voice 3; Dorico's `V` likewise "cycle[s] through existing
voices" for selected notes, with `Shift+V` sending them to a new one. So the real trade is
only cycle-versus-index: cycling costs one key but *n* presses and requires knowing where you
started; indexing costs a bank of keys but is direct and stateless.

Anything that switches voice is a mode in sense 2, so it needs **visible state** — Sibelius
colour-codes, Soundslice greys the inactive voices, Dorico marks the caret. A voice switch
with no on-screen indicator is the classic mode error waiting to happen.

### 3.8 Jumping bars — and the landmark axis nobody talks about

| Tool | Go-to | Grammar | Adjacent motion |
|---|---|---|---|
| Dorico | `Ctrl+G` go to bar; `J` → **Go To** sub-mode (`Alt+G`) | bar number, **page, rehearsal mark, flow** | `W` counterpart layout; `Shift+Alt+[`/`]` prev/next layout |
| MuseScore | `Ctrl+F` Find/Go to | `12` measure · `p12` page · `r12` numeric rehearsal mark · bare name for lettered marks | `Ctrl+←→` measure; `Ctrl+Home/End`; `Ctrl+PgUp/PgDn` page |
| Sibelius | `Ctrl+Alt+G` go to bar; `Ctrl+Shift+G` go to page ⚠️ | numeric prompt | `Ctrl+←→` measure |
| Flat | `Ctrl+G` "prompt & go to a measure number" | numeric | `Home`/`End` part bounds; `Ctrl+←→` measure |
| Guitar Pro | `Ctrl+G` go to | ⚠️ | `Ctrl+Home`/`Ctrl+End` first/last bar; **`Alt+←→` previous/next section** |
| TuxGuitar | — | — | `Ctrl+←→` measure; `Ctrl+Shift+←→` first/last; **markers `Alt+←→`, first/last `Alt+Shift+←→`** |
| Soundslice | ⚠️ not documented | — | arrow navigation by beat |

Three findings:

1. **`Ctrl+G` is the near-standard** — Dorico, Flat and Guitar Pro agree outright; Sibelius
   adds `Alt`; MuseScore alone folds go-to into Find on `Ctrl+F`.
2. **The good implementations are a typed grammar, not a number box.** MuseScore's
   `12` / `p12` / `r12` / `<mark name>` and Dorico's Go To mode both take several *kinds* of
   destination through one field. This is the §3.6 pattern again — prefix into a
   mini-language — and it collapses three or four bindings into one.
3. **Structural landmarks are a separate navigation axis from bar numbers, and for guitar
   material they are the one people actually use.** Guitar Pro jumps **sections**
   (`Alt+←→` ⚠️), TuxGuitar jumps **markers** (`Alt+←→`), Dorico's Go To reaches **rehearsal
   marks and flows**. Nobody thinks "take me to bar 57"; they think "the second chorus". The
   two tab-first tools both put this on `Alt+←→` — a third convergence.

   But the two landmarks are **not the same kind of object**, and the difference decides
   where they live in a document model:

   | | Guitar Pro **section** | TuxGuitar **marker** |
   |---|---|---|
   | What it is | a letter and/or a name (`A`, `Intro`, `Chorus`) attached to a bar | a name + colour attached to a measure |
   | Where it lives | the master track — document content, **tied to the bar** | workspace annotation, managed in a *List Markers* dialog |
   | Is it engraved? | **yes**, it prints in the score | **no** — drawn above the measure in all tracks and flagged in the track table, as an editing aid |
   | Nearest standard concept | rehearsal mark + section name | a DAW timeline marker |

   Guitar Pro's section is exactly the pair MNX Lab already models as **two separate
   `{label}` objects** — `_x.mnxLab.rehearsal` (the letter) and `_x.mnxLab.section` (the
   name) — which CLAUDE.md warns not to re-merge, and which
   [roadmap/proposed/low-priority/spec-score-text.md](../roadmap/proposed/low-priority/spec-score-text.md) proposes typing
   properly upstream. A TuxGuitar-style marker has no home in MNX at all and should not get
   one: it is **editor state, not document data**, so it would belong beside documents in
   IndexedDB rather than in the score — and it must never enter a scenario's
   `score.mnx.json`, where it would corrupt the corpus goldens with workspace noise.

### 3.9 Edit mode vs view mode (sense 6) — a web/desktop split

Soundslice has an unusually strong view/edit separation. It is **not** universal, and the
line falls almost exactly along web-native versus desktop-lineage.

| Tool | Separate view/edit state? | Form it takes |
|---|---|---|
| **Soundslice** | ✅ strong | a **View / Edit button** at the top of the page toggles it; the player also has its own documented shortcut set |
| **Flat** | ✅ explicit | a named **read-only mode**, plus per-collaborator `Can read` / `Can write` permissions, plus a separate embed viewer |
| **Noteflight** | ✅ | **Edit / Play / Record** modes toggled in one app, with **Perform** a full-screen view inside Play; separately, view-only vs full-edit sharing |
| **Guitar Pro** | ❌ | no named reading mode — panels can be hidden and the view configured (page/screen; horizontal/vertical/page), but it is a layout preference |
| **MuseScore** | ❌ | the score is always editable; the read-only surface is a *different product* (musescore.com) |
| **Dorico** | ❌ | Print is a task mode, not a read-only mode; everything stays editable. The one exception is local and accidental: Engrave's **Staff Spacing** tool suppresses selection and item editing while active (§2.1) |
| **Sibelius** | ❌ | Panorama and Focus on Staves are view options; the historical read-only surface was the separate Scorch plugin |
| **Finale** | ❌ | historically served by separate free applications (NotePad, Reader) |
| **TuxGuitar / Denemo / Frescobaldi** | ❌ | — |

**"Play mode" is a false friend here** — it usually names something that is not read-only:

- **Dorico's Play mode** (`Ctrl+4`) is a task mode (sense 1): the piano roll, mixer and
  automation. It is a fully *editing* environment, just for playback data rather than
  notation.
- **TuxGuitar's Play Mode** (`F9`) is a playback *settings* dialog — Simple mode (a fixed
  speed percentage) or Training mode (ramp the tempo by a set increment each repeat). It
  disables nothing.
- **Guitar Pro's** `F9` is "play in loops". Its jam-friendly reading setup is achieved by
  hiding panels, which is a layout preference rather than a state.
- **Noteflight's Play mode** is the exception: a genuine non-editing mode, with **Perform** a
  full-screen view inside it.

So of the tools that have a playback-flavoured mode, only Noteflight's actually stops you
editing.

**Soundslice's split is deep, not cosmetic** — the same gesture does different things on each
side, and the *rendering* changes too:

| | Editing | Viewing |
|---|---|---|
| Clicking a note | selects it | moves the playhead |
| Dragging | selects a range | creates a practice loop |
| Panels | left + top control panels shown | hidden, to maximise notation |
| Empty staves | always shown | hidden |
| Slice-wide transposition | disabled | enabled |
| Inactive voices | light grey | uniform |

**Flat's read-only mode is the crispest formulation of the idea in the survey**: when enabled,
"all tools and keyboard shortcuts that would make changes to the score are disabled", while
everything non-mutating survives — moving the cursor, muting instruments, commenting, zoom.
That is sense-0 navigation mode (§1) promoted to a first-class, nameable product state, and it
implies a keymap partitioned into mutating and non-mutating halves rather than a flat list.

**Getting back to editing — the switch that is not on the keyboard.** For a family of
products that bind note durations to single digits, the control deciding whether keys edit at
all is almost never bound:

| Tool | Switch | Binding |
|---|---|---|
| **Noteflight** | Play → Edit | **`Esc`** — the only real keyboard binding found |
| **Soundslice** | Viewing → Editing | **none documented** — a dropdown at the top of the editor reading *Editing* / *Viewing*, or the View/Edit button beside it |
| **Flat** | Read-only → Composing | **none documented** — click the **Composing** button at the top, then choose the mode |
| Dorico | Play mode → Write mode | `Ctrl+2` (Play is `Ctrl+4`) — but Play is not read-only, so this is a task-mode switch, not an access one |

Two details worth keeping. **Flat puts read-only in the same dropdown as its workflow modes**
— so an access mode (sense 6) and the key layers (sense 3) share one picker, and the layers
have `Ctrl+1`–`4` while the access mode has nothing. And **Noteflight's `Esc` is asymmetric**:
it gets you *out* of Play and back to Edit, with no documented key to enter Play. That fits
the one genuinely universal convention in the survey — `Esc` means *return me to the ordinary
editing state*, whether that state was left by entering note input (MuseScore, Sibelius),
by selecting something (Flat), or by entering playback (Noteflight).

Two observations about the split:

1. **It tracks the audience, not the era.** A web score has a URL that strangers open, so the
   read-only presentation is a first-class product surface and editing is a privileged state
   you enter. A desktop tool assumes whoever has the file is its author. The desktop lineage
   did ship read-only surfaces — Scorch, Finale NotePad/Reader, musescore.com — but as
   *separate applications*, i.e. the same split resolved architecturally instead of modally.
2. **Where it exists, it changes rendering as well as bindings.** Hiding empty staves,
   enabling transposition and swapping click semantics are not keyboard concerns, which is
   why the tools that have it treat it as a mode rather than a permission flag.

MNX Lab currently sits on the architectural side of that line by construction rather than by
decision: the workbench is review-first with no editing at all, and the **embed face**
(`src/entries/embed.ts` → `elements/ScoreViewer.ts`) is a pure viewer shipped as a separate
build artifact. The `#/scenario/<id>?view=…` axis is a *presentation* selector in Soundslice's
sense of page-view options, not an access mode — nothing in the workbench is mutable, so
there is presently no second state for it to be distinguished from.

### 3.10 Arrow-key overloading — the most crowded keys in the field

The four arrow keys carry more distinct meanings than any other key group, by a wide margin.
Counting distinct modifier combinations applied to arrows:

| Tool | Combos | The set |
|---|---|---|
| **MuseScore** | **6**, up to a **four-key** chord | bare · `Ctrl` · `Shift` · `Ctrl+Shift` · `Alt` · `Alt+Shift` · **`Ctrl+Alt+Shift`** |
| **Dorico** | 5 | bare · `Shift` · `Alt` · `Ctrl+Alt` · `Shift+Alt` (and `Alt`/`Ctrl+Alt` change meaning again in Engrave mode) |
| **TuxGuitar** | 6 | bare · `Ctrl` · `Shift` · `Ctrl+Shift` · `Alt` · `Alt+Shift` |
| **Flat** | 4 | bare · `Ctrl` · `Shift` · `Ctrl+Shift` |
| **Guitar Pro** ⚠️ | 4 | bare · `Ctrl` · `Alt` · `Ctrl+Alt` |
| **Soundslice** | 4 | bare · `Ctrl` · `Shift` · `Alt` |
| **Sibelius** | 3 + an escape hatch | bare · `Ctrl` · `Shift` — chromatic transposition lives on `Shift+PageUp/PageDown` |

Three things stand out.

**MuseScore reaches a four-key chord, and it is an accessibility binding.** `Alt+←→` selects
the next/previous element in the score, while `Ctrl+Alt+Shift+←→` is a *second, finer*
element traversal that stays on the current beat and steps through the notes in other voices
before advancing. So the two-granularity navigation idea of §4 costs two separate arrow
bindings — and the finer one, aimed at screen-reader users, is a four-key chord.

**Sibelius's `Shift+PageUp/PageDown` is the tell.** Chromatic transposition is a core
operation that in every other tool would sit on some arrow modifier; Sibelius left the arrow
keys entirely rather than reach for a third modifier. That is what running out looks like.

**Dorico's modifiers come closest to a system — but only two of the three rules generalise.**

| | `Alt+↑↓` — pitch axis | `Alt+←→` — time axis |
|---|---|---|
| `Alt` | diatonic step | move the item by one step |
| `+Ctrl` | octave | (with Shift) double/halve the duration |
| `+Shift` | chromatic | lengthen/shorten by the grid |

Two invariants hold cleanly, including in Engrave mode where `Alt+arrow` nudges graphically
and `Ctrl+Alt+arrow` nudges in large steps:

- **`Alt` = edit the selection.** Bare arrows never mutate anything, anywhere in Dorico.
- **`Ctrl` = a coarser increment** of whatever the edit is — octave not step, doubling not
  a grid step.

**`Shift` is the rule that does not generalise.** On the pitch axis it changes the *unit*
(chromatic instead of diatonic); on the time axis it changes the *verb* (resize instead of
move). Those are not the same kind of substitution, so `Shift+Alt+↑↓` and `Shift+Alt+←→` have
to be learned separately rather than derived. Two rules out of three is still the most
systematic scheme in the survey, but it is not the clean grid it first looks like.

Note also that the two axes are not symmetric in scope, which is principled rather than
sloppy: **`←→` (time) applies to almost every object in the score, while `↑↓` (pitch) applies
only to notes.** Items are attached at a rhythmic position but do not have a pitch, so there
is nothing for the vertical axis to do to them — moving an item to another staff is a
different verb on different keys (`Alt+N` / `Alt+M`).

**What "edit the selection" actually means is polymorphic.** `Alt+←→` is one verb — *move
along the time axis by one step* — where the step is defined per item type:

- most items move by the **current rhythmic grid resolution** (default eighth note, changed
  with `Alt+[` and `Alt+]`);
- but a single selection of a **dynamic, lyric, slur, ornament, pedal line, octave line,
  horizontal line, cue, rehearsal mark, repeat ending or bar repeat region** snaps to the
  **adjacent notehead, bar or barline** instead, because those attach to things rather than
  to times;
- and a **multiple** selection moves as a block by the grid resolution regardless.

So the consistency is at the level of the *verb*, not the *increment*. One key means "nudge
this along in time", and each item type defines what a nudge is for it.

Elsewhere the modifiers mean whatever each tool needed, and the collisions are direct:

| Combo | Meanings observed across tools |
|---|---|
| `Ctrl+↑↓` | octave (Sibelius, MuseScore staff, Flat, Soundslice) · move note to adjacent string keeping pitch (MuseScore **tab**) · stems up/down (TuxGuitar) |
| `Alt+↑↓` | transpose diatonic (Dorico) · traverse voices and staves (MuseScore) · move note to another string keeping pitch (Soundslice) · shift string (Guitar Pro ⚠️) |
| `Shift+↑↓` | extend selection (Dorico, Flat) · move note to string above/below (TuxGuitar) |
| `Shift+←→` | extend selection (Dorico, MuseScore, Flat, Soundslice) · increase/decrease fret (TuxGuitar) |
| `Alt+←→` | move item rhythmically (Dorico) · next/previous element (MuseScore) · next/previous section (Guitar Pro ⚠️) · next/previous marker (TuxGuitar) · page turn (Soundslice player) |

`Shift` = extend selection is the closest thing to a stable convention, and TuxGuitar breaks
even that. Bare `↑↓` splits exactly along the two camps of §3.2.

### 3.11 Selection, copy and paste — where the deepest modality actually hides

This is the least visible modal system in these products, because you enter these modes by
*selecting something*, not by pressing anything.

**Sibelius has four selection types, and the type silently determines what paste does:**

| Type | Appearance | Paste behaviour |
|---|---|---|
| Single | one object | — |
| Multiple | objects highlighted in voice/selection colour | **merges** with what is there, overwriting only same-voice notes |
| Passage | **light blue box** around a continuous range on one or more staves | **overwrites** the destination completely; excludes system objects |
| System passage | **double purple box** across all staves in the system | **inserts new bars** at the paste point; includes time/key signatures, rehearsal marks, special barlines |

Scoring Notes compresses it to: *"Multiple selections merge, passage selections overwrite,
and system passage selections insert."* One `Ctrl+V`, three semantics, selected by what you
clicked. The colour coding is doing real work — enough that "Cracking Sibelius's color code"
is a published article.

**Two opposite philosophies of getting to a selection:**

- **Enumerate the types** (Sibelius): four distinct kinds with distinct rules, distinguished
  by box colour.
- **One selection, grown and shrunk by operators** (Dorico): a single selection type, with
  `Ctrl+Shift+A` **Select More** widening it and filters narrowing it. Nothing to learn about
  *kinds* of selection; instead you learn two operators.

Both tools have **filters** — `Edit > Filter > [item] > [type]` in Dorico, `Edit > Filter` in
Sibelius — which reduce an existing selection to just the dynamics, or just the slurs. The
difference is that Dorico pairs them with the opposite operator: **Select More**
(`Ctrl+Shift+A`), pressed repeatedly, expands from the item to the bar to the system to the
whole flow, voice-aware and working on several item types at once. Sibelius has the narrowing
half only, so the widening has to be done by choosing a different *kind* of selection up
front.

**Dorico's full selection surface**, since it is the most developed in the survey:

| Method | How |
|---|---|
| Individual | click; `Ctrl`+click to add or remove |
| Range on a staff | `Shift`+click the far end; `Shift+←→↑↓` to extend |
| Move the selection | bare arrows — never mutating |
| Notes ↔ other music items | `Tab` cycles between the two traversals |
| Widen progressively | `Ctrl+Shift+A` Select More, repeatable |
| Narrow | `Edit > Filter > …` |
| To a boundary | `Edit > Select To End/Start Of System` / `Of Flow` |
| Freeform | **Marquee tool** (status bar; `Alt+H` toggles Hand/Marquee) — drag a grey rectangle |
| Everything in a bar, all staves | **the system track** — a clickable strip above the top staff (`Alt+T` shows/hides); click a bar to select all staves *including system-attached items*, `Shift`+click or drag to extend |
| Select all / deselect | `Ctrl+A` / `Ctrl+D` |

The **system track** is worth isolating: it is Dorico's answer to exactly the thing Sibelius
encodes as a system passage selection — "everything in these bars, across all staves,
including the things attached to the bar rather than to a staff". Sibelius makes it a
selection *type* you produce by knowing the right gesture and recognise by a purple box;
Dorico makes it a *visible strip you click*. Same distinction in the document, opposite
answers on where the user learns it — one is a fact about the software's model, the other is
a target on screen.

**Per tool:**

| Tool | Selection model | Clipboard variants |
|---|---|---|
| Sibelius | 4 types + filters | Paste as Cue; `R` repeat |
| Dorico | one type, `Ctrl+Shift+A` widens; `Ctrl+D` deselect | **Paste Special → Paste Into Voice** (existing or new, up- or down-stem); chord mode `Q` merges rather than replaces; `R` repeat selection |
| MuseScore | **range** vs **list** (`Ctrl`+click) | **paste half duration `Ctrl+Shift+Q`**, **double `Ctrl+Shift+W`**, **swap with clipboard `Ctrl+Shift+X`** |
| Guitar Pro | normal vs **multitrack** | all-track copy/cut `Ctrl+Shift+C` / `Ctrl+Shift+X`, special paste `Ctrl+Shift+V`; multitrack copy **extends the selection out to whole sections** and carries bar structure (time and key signatures) |
| Soundslice | click, `Ctrl`+click, drag, `Shift+←→`; two select-alls (**all voices** vs **current voice only**) | — |
| Flat | `Shift+←→` add, `Shift+↑↓` vertical, `Ctrl+A` current part, `Ctrl+Shift+A` all parts | — |
| TuxGuitar | `Ctrl+A` whole track; voices `Ctrl+1`/`Ctrl+2` | `Ctrl+R` repeat last action |

Two patterns worth recording.

**Selection types come with capability asymmetries that are not obvious from the UI.**
MuseScore's list selection can copy lyrics, chord symbols, dynamics and articulations while
leaving destination notes intact — but *cannot* copy multiple notes, and special repeat does
not work on it at all. Soundslice's copy/paste "only supports copying single voices at a
time", which is why it offers two distinct select-all commands. Every tool in the survey has
a voice-shaped hole somewhere in its clipboard.

**Structural snapping is a tab-editor trait.** Guitar Pro's multitrack copy widens the
selection to the sections it touches and brings the bar structure with it — the nearest thing
in the survey to a "copy this chorus" verb, and the clipboard counterpart of the landmark
navigation axis in §3.8.

For a document format this matters structurally rather than ergonomically: Sibelius's
passage-vs-system-passage distinction is the question "does this selection include the
things attached to the bar rather than to a staff?" — and **MNX answers it in the document
shape**, because `global.measures[]` is a separate array from the part measures, and tempos,
`_x.mnxLab.harmonies` and the `rehearsal`/`section` labels live there. A range in MNX either
covers global content or it does not, and the schema says which; Sibelius has to encode the
same distinction in a box colour.

---

## 4. Navigation mode and accessibility

The strongest argument for a first-class, fully-keyboard **navigation mode** is not
power-user speed; it is that screen-reader users have no other mode.

**MuseScore ✅** provides two traversal granularities, which is the key insight:

| Action | Key |
|---|---|
| Move between notes/chords/rests | `←→` |
| **Move between *all* notation elements** | `Alt+←→` |
| Move between notes vertically across voices/staves | `Alt+↑↓` |
| Move between UI sections | `F6` / `` ` `` |
| Navigate control groups / within groups | `Tab` / arrows |
| Edit selected element | `F2` or `Alt+Shift+E` |
| Context menu | `Menu` or `Shift+F10` |

Supported readers: NVDA and Narrator (Windows), VoiceOver (macOS), Orca (Linux, must be
launched *before* MuseScore). Score shortcuts are customisable; UI navigation commands are
not.

**Sibelius** invested in this from 7.5.1 onward and again in 2019–2020: notehead types are
announced to screen readers, ribbon tabs are reachable by single letters (`F` File, `H`
Home, `I` Note Input, `N` Notation), and **Find in Ribbon** (`,`) surfaces both the command
and its shortcut in the result list. Berklee's Assistive Music Technology Lab publishes
**SibAccess**, a three-part screen-reader tutorial covering navigation, selection, note
input, tuplets, articulations, and instrument-specific writing including guitar.

**Dorico**'s `Tab` — cycling between notes and other music items — is the same
two-granularity idea as MuseScore's `Alt+←→`, exposed on a more prominent key.

**The transferable finding:** a navigation mode needs *two* axes — the musical spine
(note → note → measure) and the object graph (every element attached to the music, including
the ones with no notehead). One without the other is unusable: notes-only navigation cannot
reach a dynamic or a rehearsal mark, and element-only navigation loses the plot of the music.
This is not primarily an accessibility feature; accessibility is just the use case that makes
its absence fatal rather than annoying.

---

## 5. Findings

1. **"Mode" is five things.** Argue about them separately. The modeless partisans are
   arguing only about sense 2.
2. **Sense-2 modality tracks the vertical axis, not the era.** Staff = pitch on the vertical
   axis ⇒ caret needed. Tab = string on the vertical axis ⇒ selection suffices. Every tool
   surveyed obeys this without exception.
3. **The digits are the scarcest resource, and tab wins them.** Every tab-capable tool
   surrenders absolute duration digits to fret numbers and moves duration to a relative pair.
4. **Bare `↑↓` is the contested key.** Notation-first tools spend it on pitch; tab-first
   tools and Dorico spend it on navigation. A dual notation+tab view forces the second
   choice.
5. **Prefix-plus-mini-language beats one-binding-per-notation.** Dorico's `Shift+`letter
   popovers and LilyPond's `\...mode` blocks are the same idea; both scale to hundreds of
   notations without exhausting the keyboard.
6. **The command palette is now standard**, and Dorico's split of it into *commands* vs
   *go-to* is the right decomposition.
7. **A `?` overlay generated from the actual binding table**, not hand-maintained. Noteflight
   documents shortcuts its own dialogue omits; that is what hand-maintenance costs.
8. **Two navigation granularities**, musical spine and object graph, or the keyboard-only
   path is a dead end.
9. **Emulation presets are how a new editor gets adopted.** Soundslice ships four.
10. **Layout detection is a real bug class on the web.** Flat auto-detects QWERTY/AZERTY/
    QWERTZ/Dvorak/Colemak; `KeyboardEvent.code` vs `.key` is a decision to make deliberately,
    once, before the first binding exists.
11. **Hierarchical key chains are a dead end here.** MuseScore supports four-key sequences
    and ships zero; only Denemo ships a default chain. The field solved the same problem with
    visible layers, typed popovers and a palette — all of which beat a prefix tree on
    keystroke count, discoverability, or both.
12. **Repetition-as-disambiguator is the chain shape that works** — Denemo's `a` edit vs
    `A,A` insert, Dorico's double-tapped duration key for a dot, two-digit fret entry. Same
    key, second meaning, no new namespace.
13. **A mode needs visible state or it is a bug generator.** Sibelius colour-codes voices,
    Soundslice greys the inactive ones, Flat pops a toast naming the active workflow mode,
    Sibelius's Keypad shows its layout permanently. Every mode in this survey that users
    tolerate is one they can see.
14. **Go-to should be a typed grammar, and landmarks are a separate axis from bar numbers.**
    `Ctrl+G` is the near-standard key; MuseScore's `12`/`p12`/`r12` is the near-best
    grammar; and the two tab-first tools both bind `Alt+←→` to section/marker jumping,
    because that is how guitarists actually locate a place in a piece.
15. **Layers remap a bank of keys; modes change what the application is doing** (§1.1). They
    compose — Sibelius runs a mode and six layers at once — and the variable that predicts
    error rate is neither of them, but whether the state is *held* or merely *toggled*, and
    whether it is visible.
16. **A view/edit split is a web-native trait** (§3.9). Soundslice, Flat and Noteflight all
    have one; no desktop tool in the survey does. The desktop lineage solved the same problem
    with separate read-only *applications* — Scorch, Finale NotePad, musescore.com — which is
    the same split drawn architecturally rather than modally.
17. **Flat's read-only mode implies a partitioned keymap.** Enabling it disables "all tools
    and keyboard shortcuts that would make changes to the score" while preserving cursor
    movement, muting, commenting and zoom — which only works if mutating and non-mutating
    bindings are separable by construction rather than by audit.
18. **The arrow keys are the most overloaded keys in the field** (§3.10) — up to six modifier
    combinations, and MuseScore reaches a four-key chord (`Ctrl+Alt+Shift+←→`) for its
    finer, voice-aware element traversal. Sibelius's chromatic transposition sits on
    `Shift+PageUp/PageDown`, off the arrows entirely: what running out of room looks like.
19. **Dorico's arrow modifiers are the most systematic, but only two of three rules hold**
    (§3.10): `Alt` = edit the selection (bare arrows never mutate) and `Ctrl` = a coarser
    increment both generalise across axes and across modes; `Shift` does not — it swaps the
    *unit* on the pitch axis and the *verb* on the time axis. Everywhere else there is no
    scheme at all: `Ctrl+↑↓` means two different things inside MuseScore alone, depending on
    staff type.
20. **"Edit the selection" is one polymorphic verb, not a fixed increment.** `Alt+←→` means
    "nudge along in time", where notes move by the rhythmic grid but dynamics, lyrics, slurs
    and rehearsal marks snap to the adjacent notehead or barline — because they attach to
    things, not to times. The pitch axis has no such polymorphism because only notes have a
    pitch.
21. **Selection is a modal system nobody labels as one.** In Sibelius the *type* of selection
    silently picks the paste semantics — multiple merges, passage overwrites, system passage
    inserts — with no key involved. The alternative is Dorico's single selection widened by
    repeated `Ctrl+Shift+A`, which needs no colour key because there is only one type.
22. **Every clipboard in the survey has a voice-shaped hole.** Soundslice copies one voice at
    a time; MuseScore's list selection cannot copy multiple notes; Dorico needed a whole
    Paste Special → Paste Into Voice submenu. Voices are where copy/paste stops being generic.

---

## 6. Implications for MNX Lab

Speculative; nothing below is committed. Two horizons, because MNX Lab today is a
**review-first workbench with no editing** and the keyboard question is live *now* for
review even if editing never lands.

### 6.1 Now — a navigation keymap for the review workbench

The workbench is a queue-driven review tool (`src/workbench/queue.ts`, the topic-grouped rail,
`#/scenario/<id>?view=…` deep links, `#/objects` coverage map). Reviewing is exactly the
"navigation mode" the accessibility work describes, and it is pure sense-0: **no key should
mutate anything**, which makes it the cheapest possible place to establish a keymap
discipline before an editor forces harder choices.

A plausible layer, consistent with the survey's conventions:

| Action | Key | Precedent |
|---|---|---|
| Previous / next scenario in rail | `↑↓` or `k`/`j` | universal |
| Previous / next group | `Ctrl+↑↓` | measure-jump analogue |
| Views: notation / tab / both / compare / json | `1`–`5` | Flat workflow modes, Dorico `Ctrl+1`–`5` |
| Focus rail filter | `/` | Flat quick search |
| Clear filter / defocus | `Esc` | universal |
| Command palette | `Ctrl+K` or `J` | Dorico Jump Bar, Guitar Pro `Cmd+E` |
| Shortcut overlay | `?` | Flat `Alt+/` |
| Next / previous element within the score | `Alt+←→` | MuseScore accessibility |
| Next / previous note | `←→` | universal |
| Go to — bar, scenario id, `def:`, page | `Ctrl+G` | Dorico / Flat / Guitar Pro |
| Next / previous section or rehearsal mark | `Alt+←→` | Guitar Pro sections, TuxGuitar markers |

The last two are worth taking seriously *now* rather than later. A go-to field with a typed
grammar (§3.8) is the same widget as the rail filter: MuseScore's `p12`/`r12` and the rail's
existing `def:<name>` convention are the same idea, so one prompt could reasonably accept
`def:note`, a scenario id, and a bar number — rather than growing a second and third filter
mode, which CLAUDE.md already rules out. And section/rehearsal jumping is not hypothetical
here: `_x.mnxLab.rehearsal` and `_x.mnxLab.section` are already modelled as two separate
`{label}` objects on the global measure, so the landmark axis has data behind it before any
editing exists.

Two things this buys beyond speed. First, the note↔JSON cross-highlight already needs a
"current element" concept, and `model/noteKeys.ts` already supplies stable identity for it —
keyboard traversal is that concept made drivable, and it must stay in lockstep with
`model/jsonView.ts` the same way the highlight does. Second, `#/objects/<def>` already writes
`def:<name>` into the rail search box; binding `/` to that box makes the existing
deep-linkable filter keyboard-reachable without inventing a second filter mode — consistent
with the rule already recorded in CLAUDE.md.

Digits `1`–`5` for views is the one binding to think twice about, because §3.3 says the
digits are the scarcest resource and an editor would want them. Mitigation: treat them as a
sense-3 **layer** owned by the *view*, exactly as Flat does — digits mean views in the
review shell, frets in a tab pane, durations in a notation pane. Deciding that now costs
nothing; retrofitting it costs a re-bind of everything.

### 6.2 Later — if an editor arrives

The survey gives an unusually clear answer for a **tab-first** editor, and MNX Lab is
tab-first by charter:

- **Modeless in sense 2.** Follow Guitar Pro / TuxGuitar / Soundslice. The selection is the
  cursor. This also matches the workbench's existing grain, where a scenario is *selected*
  and inspected rather than opened into an editing session.
- **Bare arrows never mutate** (Dorico's rule, §3.2) — mandatory, because the `both` view
  puts a notation and a tab pane on screen at once and `↑↓` cannot mean pitch and string
  simultaneously. `Alt+↑↓` to move a note between strings keeping pitch (Soundslice), or
  `N`/`M` (Dorico).
- **Digits are frets in a tab pane; durations are `-`/`=` or `+`/`-`.** Unanimous.
- **Adopt the de facto technique alphabet** — `B` `H` `S` `V` `X` `O` — since `_x.mnxLab`
  already carries bends as curves, hammer-ons, pull-offs, slides, vibrato, harmonics and
  palm mute, and the converters already round-trip all of them through Guitar Pro. Users
  arriving from `.gp` files arrive with those fingers.
- **No hierarchical key chains** (§3.6). Technique is the highest-frequency operation in tab
  editing, so it gets single letters, not a prefix tree. Do borrow
  repetition-as-disambiguator where it earns its place — a double-tapped fret digit for a
  two-digit fret is already forced on us by the same collision Dorico hit.
- **Voices: `V` to cycle** (Dorico and Flat agree), with the active voice visibly marked and
  the others dimmed (Soundslice). MNX Lab renders into shadow DOM with its own primitives,
  so dimming inactive voices is a layout-level affordance, not a CSS afterthought.
- **Popover prefixes for everything else** (Dorico's `Shift+`letter). This maps unusually
  well onto MNX Lab, because `_x.mnxLab` is already a small set of named domains —
  `harmonies`, `rehearsal`/`section`, `tab` — and a typed popover per domain is a UI whose
  grammar is the schema. A chord-symbol popover would be `Shift+Q` for free.
- **The palette is where the AI edit loop belongs.** Dorico's Jump Bar has two sub-modes,
  commands and go-to; MNX Lab's natural third is *prompt* — the same input box routing to
  `/api/edit-notation` when the text is a sentence rather than a command. That is a
  keyboard-first front door for the assist path that already exists, and it needs no new
  surface. It is also the only item here that touches the Worker, so it inherits the
  `ui/ → assist/` boundary rule unchanged.
- **Emulation presets, eventually.** Soundslice's four presets and Sibelius's Finale-order
  toggle say the competition is muscle memory. A `Like Guitar Pro` preset is nearly free if
  the binding table is data from the start — which argues for a declarative keymap module
  (a candidate for `elements/` if both shells want it, per the promotion rule) rather than
  `keydown` switches scattered through components.

### 6.3 Open questions

- `KeyboardEvent.code` (physical position, survives AZERTY) or `.key` (what the user typed,
  survives remapping)? Flat's auto-detection suggests neither alone is sufficient. Decide
  once, before the first binding.
- Everything renders into **shadow DOM** — key handling, focus management and
  `:focus-visible` all need an explicit story there, and shadow roots are where a naive
  document-level listener silently breaks.
- Does the review keymap belong in `workbench/` (shell-only, leaf) or `elements/` (so an embedded
  `ScoreViewer` is keyboard-navigable too)? The embed face arguably needs score navigation
  more than the workbench does — an embedded score with no keyboard access is inaccessible
  on someone else's site.

---

## 7. Things I like

A running record of what appealed while reading this survey, what each preference would
actually cost, and where a stated preference turned out to describe something other than the
thing it named. Preferences, not decisions.

### 7.1 Dorico's modifier scheme — but with `Shift` reserved for selection

**Liked:** that Dorico's arrow modifiers are *derivable* rather than memorised (§3.10) —
`Alt` = edit the selection, `Ctrl` = a coarser increment, bare arrows never mutate.

**Amendment:** `Shift` should mean **extend the selection**, always, and never a second edit
variant. In Dorico today `Shift` does double duty — bare `Shift+arrow` extends a selection,
but `Shift+Alt+↑↓` is chromatic transposition and `Shift+Alt+←→` is lengthen/shorten. That is
precisely the rule of the three that fails to generalise (§3.10), so removing it makes the
scheme *more* regular rather than less:

| Modifier | Meaning |
|---|---|
| bare | navigate |
| `Shift` | extend the selection |
| `Alt` | edit the selection |
| `Ctrl+Alt` | edit, coarser increment |

**What it costs:** two Dorico bindings lose their home — chromatic transposition and
lengthen/shorten-by-grid. Both happen to be the two an arrow keymap in a tab-first editor
needs least:

- **Duration** already has a dedicated relative pair in every tab editor surveyed — `-`/`=`
  in Dorico's own tablature input, `+`/`-` in Guitar Pro, TuxGuitar and Soundslice (§3.3).
  Lengthen/shorten on arrows duplicates a control the tab keymap must have regardless.
- **Chromatic vs diatonic** is a staff-notation distinction. On a fretboard the natural
  increment is the fret, which is already a semitone — TuxGuitar's fret ± *is* chromatic
  transposition. (Though note TuxGuitar spends `Shift+←→` on it, so it is also the tool that
  breaks the Shift-equals-select convention hardest.)

**What it frees:** with `Shift+Alt+←→` vacated, `Ctrl+Alt+←→` is unclaimed on the time axis,
and "move by a bar" is the obvious coarser increment of "move by a grid step" — which would
make the time axis parallel the pitch axis exactly (`Alt` = step, `Ctrl+Alt` = the big unit:
octave there, bar here). The amended scheme is more regular than the one it is borrowed from.

**Precedent:** the strict reading is close to universal already — Flat, Soundslice, MuseScore
and Dorico all use bare `Shift+arrow` for selection extension and nothing else.

### 7.2 Both the system track and the timeline — liked; finer details to work out

The assumption was: *a long rectangle where bars and sections can be seen, used to navigate
or select.* Checked against Dorico:

| Assumption | Dorico's system track |
|---|---|
| a long rectangle | ✅ a translucent horizontal strip, opaque on hover, highlighted when a region is selected |
| where bars can be seen | ✅ shows **bars** — or **beats**, following the current rhythmic grid resolution |
| …and sections | ❌ it displays no rehearsal marks, section labels or other landmarks |
| used to select | ✅ **its main purpose** — click a bar, `Shift`-click or drag to extend, then **System Track Select** takes everything on all staves in that region, *including system-attached items* |
| used to navigate | ❌ not really — it selects and restructures; it does not move you around |

It also does structural editing: with a region selected, three buttons appear — **Delete**
(remove the region), **System Track Select**, and **Add** (insert bars or beats of the same
duration immediately after it). `Alt+T` shows and hides it. Its selections clear when you
select something else or switch layout, but survive the page ↔ galley view switch.

Crucially it is **per system** — a strip above *each* system, not one continuous timeline for
the whole piece. It is a local gutter, not an overview.

**The widget actually described is MuseScore's Timeline**, which is a different thing:

- a panel at the bottom of the window showing instruments × measures as a grid;
- **meta rows** above that grid for key signature, time signature, tempo, **rehearsal marks**,
  barlines, and **jumps and markers** — the "sections can be seen" half;
- **click a measure or a structural element to move there** — navigation is its purpose;
- `Ctrl`+click a cell selects the whole measure, and clicking a meta value selects that object
  in the score.

So the two split cleanly: **Dorico's system track = select and restructure locally; MuseScore's
Timeline = see the shape of the piece and jump around it.** The description hybridised them —
and the hybrid is coherent, since a strip that shows bars *and* landmarks and supports both
navigation and selection is not something either tool refuses on principle; they just each
built one half.

Two notes on how that lands here. The landmark data already exists — `_x.mnxLab.rehearsal`
and `_x.mnxLab.section`, alongside `tempos` and `harmonies`, all on the global measure — so a
Timeline-style meta row would be populated by fields already modelled, and §3.8 found that
landmark navigation is the axis guitarists actually use. And in a review-first workbench
there is nothing to restructure, so of the two halves it is the **navigation** half that
applies today.

**Position: both are wanted.** The system track's bar-region selection *and* the Timeline's
landmark overview and click-to-navigate. Whether that is one strip or two widgets is
undecided, along with the rest of the finer details:

- **One widget or two?** Dorico and MuseScore each shipped one half; nothing in either design
  forbids a single strip that shows landmarks *and* supports region selection.
- **Scope** — a per-system gutter above each system (Dorico) or one continuous strip for the
  whole flow (MuseScore).
- **Granularity** — bars, or beats following the rhythmic grid resolution, or both as a
  toggle.
- **Which rows** — landmarks only (`rehearsal`, `section`), or the full meta set MuseScore
  shows (key, time, tempo, jumps and markers), plus possibly `harmonies`.
- **Click semantics** — navigate, select, or both, and how they are told apart. MuseScore's
  answer is bare click navigates, `Ctrl`+click selects the measure; Dorico's is that clicking
  only ever selects.
- **Vertical axis** — a single strip (Dorico) or an instruments × measures grid (MuseScore).
  The grid form only earns its space in multi-track scores.
- **Read-only now, editing later** — the Add/Delete-bars half of the system track has no
  meaning in a review workbench and would arrive only with an editor, if ever.
- **Relationship to the existing rail** — the workbench already has a left rail for scenario
  navigation. A bottom strip is a *second* navigation surface with a different unit (position
  within a score vs which score), and the two should not end up competing for the same keys.
- **Which face** — workbench only, or also the embed, where a landmark strip would be the
  only navigation affordance an embedded score has.

---

## 8. A first keybinding scheme (working draft)

Not built, not decided. This is the scheme as specified so far, with the survey used to check
it. Where it differs from every surveyed tool, that is noted rather than smoothed over.

### 8.1 The rules

Four rules generate the whole arrow grid:

1. **Bare arrows navigate.** Arrows never mutate without `Alt` (Dorico's invariant, §3.10 —
   and the only rule that survives a simultaneous notation + tab view, §3.2).
2. **`Shift` = extend the selection.** Always, and only (§7.1).
3. **`Alt` = change the selection.**
4. **`Ctrl` = promote to the next larger unit** — of whichever verb is active.

Rule 4 is the improvement on Dorico. There, `Ctrl` qualifies only edits; here it is a
magnitude modifier that composes with all three verbs, so "the next larger unit" is one idea
learned once rather than three special cases.

### 8.2 The arrow grid

| Modifiers | Verb | `←→` | `↑↓` |
|---|---|---|---|
| — | navigate | previous / next event | previous / next **string** (tab) or staff position (notation), **spilling to the adjacent staff at the edge** (§8.4) |
| `Ctrl` | navigate, larger | previous / next **bar** | previous / next **voice** (§8.4) |
| `Shift` | select | extend by one event | extend across positions, spilling across staves |
| `Ctrl+Shift` | select, larger | extend by **bar** | extend to **all staves** |
| `Alt` | change | duration **shorter / longer** | pitch **∓ semitone** (fret ∓1) |
| `Ctrl+Alt` | change, larger | duration **halve / double** | pitch **∓ octave** |
| `Ctrl+Alt+Shift` | — | **reserved, unassigned** | **reserved, unassigned** |

### 8.3 Why `Ctrl+Alt+Shift` stays empty

It should mean "large + change + select", which is not a coherent operation: `Shift` means
select and `Alt` means change, so a binding carrying both breaks rule 2 the moment it is
assigned. The grid is 3 verbs × 2 magnitudes = 6 combinations, all populated and all
derivable; a fourth tier would add bindings that cannot be derived and would have to be
memorised, which is the failure the scheme exists to avoid.

The survey supports leaving it empty. A four-key chord is defensible for a **rare and
consequential** action — Google Docs puts Editing/Suggesting/Viewing on
`Ctrl+Alt+Shift+Z/X/C` and is right to (§3.9). It is wrong for a **frequent and essential**
one — MuseScore's `Ctrl+Alt+Shift+←→` is fine-grained element traversal aimed at
screen-reader users, i.e. a four-key chord for the users least able to perform it (§3.10).
There are no rare, dangerous *arrow* operations, so there is nothing that belongs there.

**Keystroke cost should scale inversely with frequency.** Overflow goes to letters and the
palette, not to a fourth modifier tier.

### 8.4 The vertical axis: spillover walks, `Ctrl+↑↓` changes voice

**Bare `↑↓` walks; at the edge of a staff it spills over to the next one.** String 6 → … →
string 1 → the staff above. The vertical axis is one continuous ordered list of positions
across the system, exactly as a text editor treats `↑` at the start of a line. Costs no
binding, and it is what people already expect. Selection spills the same way, so `Shift+↑`
extends across the boundary rather than stopping at it (MuseScore's `Shift+↑↓` already extends
vertically).

Boundary case: `↑` at the top of a **tablature** staff in a paired notation + tab layout
reaches that instrument's **notation** staff, not the next instrument — the pair is one
instrument shown two ways.

**Because spillover already reaches every staff, `Ctrl+↑↓` is not needed for staff jumping**,
and goes to **voice** instead. The target repertoire decides this: fingerstyle guitar
arrangement routinely puts thumb/bass and melody in separate voices, so voice switching
happens constantly during entry, while a solo arrangement has one instrument and therefore
essentially one staff. Guitar scores run to a handful of staves, so crossing a boundary by
walking costs one keypress; a dedicated staff-jump binding only earns its slot in orchestral
scores, which is not the target.

**Voice on the vertical axis is not arbitrary.** With two voices, `↑`/`↓` is not an ordinal
index — it is **stem direction and register**. In fingerstyle texture the melody is the
up-stem voice and the thumb/bass line is the down-stem voice, a distinction Dorico makes
explicitly when creating a voice ("nominally up-stem or down-stem"). So the vertical
containment chain for this material genuinely reads **position → voice → staff**, and `Ctrl`
promoting from position to voice is rule 4 behaving normally rather than an exception to it.

That said, it is an **interpretation** of rule 4 rather than a clean instance: in a
single-voice score `Ctrl+↑↓` has nothing to do, and in a many-staff score it stops short of
what "the next larger unit" would suggest. Both are acceptable for guitar material and would
not be for orchestral.

**Staff jumping, when a multi-track arrangement wants it**, goes to the `Ctrl+G` typed
grammar (§3.8) — jumping to "the bass track" by name beats counting arrow presses, and it
costs no binding. The obvious alternative, `Ctrl+PageUp`/`Ctrl+PageDown`, is unavailable:
Chrome reserves it (§8.9).

Precedent: **MuseScore's `Alt+↑↓` walks voices *and* staves in one ordered traversal**, so
treating the vertical dimension as a single list containing both is established practice.

### 8.5 Non-arrow bindings this scheme requires

Filling the grid pushes four operations off the arrows. That is a feature — it is what Dorico
did too, and for the same reason.

| Operation | Proposed | Precedent |
|---|---|---|
| Enter edit mode | `F2` | MuseScore's *edit element*; the cross-application rename/edit convention |
| Leave edit mode | `Shift+F2` | symmetric with `F2`, and deliberately **off** the `Esc` stack (§8.7) |
| Dismiss topmost transient layer | `Esc` | universal; bottoms out as a **no-op** |
| Fret entry | digits | universal in tab (§3.4) |
| **Move note to adjacent string, keeping pitch** | `N` / `M` | **Dorico** — which put it on letters for exactly this reason: the vertical arrow slots were full |
| **Nudge item earlier / later in time** | `[` / `]` | the operation Dorico spends `Alt+←→` on, displaced here because `Alt+←→` is duration |
| **Previous / next landmark** (section, rehearsal mark) | `PageUp` / `PageDown` | the *function* is Guitar Pro's and TuxGuitar's `Alt+←→` (§3.8), which this scheme cannot use |
| Cycle voice | — on `Ctrl+↑↓`, see §8.4 | |
| **Repeat selection** | `R` | Dorico and Sibelius (§8.10) |
| Play / pause | `Space` | Guitar Pro, TuxGuitar, universal (§8.11) |
| Go to | `Ctrl+G` + typed grammar | Dorico, Flat, Guitar Pro (§3.8) |
| Technique | `B` `H` `S` `V` `X` `O` | the de facto tab alphabet (§3.4) |
| Command palette | `Ctrl+K` | Dorico's Jump Bar, Guitar Pro's `Cmd+E` |

Two of these are forced moves worth noticing. **Tab has more vertical operations than
notation** — navigate strings, change pitch, change octave, *and* move a note between strings
at constant pitch — which is four, against three vertical arrow slots. Dorico hit the same
wall and answered with `N`/`M`. And **landmark jumping cannot use `Alt+←→`** here, even though
that is where both tab-first tools put it, because `Alt` is reserved for change.

**No aliases yet.** Duration is `Alt+←→` and nothing else. Every tab editor surveyed also
carries a cheap relative pair next to the digit row (`-`/`=` in Dorico's tablature input,
`+`/`-` in Guitar Pro, TuxGuitar and Soundslice) because in tab entry the hand lives over the
digits and duration changes on nearly every beat — but that is a fluency optimisation for
later, not part of the scheme. Two notes for whenever it is revisited: the conventions are
**opposite on the same key** (Soundslice's `+` is *shorter* and `-` is *longer*; Dorico's `-`
is *shorter* and `=` is *longer*), and `-`/`=` has the advantage of being physically ordered
left-to-right, so it can be made spatially consistent with `Alt+←`/`Alt+→`.

### 8.6 `V` = vibrato (voice moved to `Ctrl+↑↓`)

**Resolved.** `V` keeps its Guitar Pro / TuxGuitar meaning of **vibrato**, and voice is handled
by `Ctrl+↑↓` (§8.4), so nothing has to displace it and `Shift+V` is freed. The history below is
kept because the reasoning about digit banks still applies to anything else that wants them.



`V` was claimed twice: **vibrato** in Guitar Pro and TuxGuitar, **cycle voice** in Dorico and
Flat. Resolved in favour of **vibrato** — the tab technique alphabet is the one convention
this scheme has most reason not to fight (§3.4, §6.2), since users arriving from `.gp` files
have it in their fingers.

Voice therefore needs a home, and the survey offers two models (§3.7). **Absolute index wins
here**, for four reasons:

1. The cycle model's whole appeal was the `V` mnemonic, and `V` is gone. A cycle on an
   arbitrary key is a cycle with nothing to recommend it.
2. Index is the majority anyway — Sibelius `Alt+n`, MuseScore `Ctrl+Alt+n`, TuxGuitar
   `Ctrl+n`, against Dorico and Flat.
3. Cycling costs one key but *n* presses, and requires knowing which voice you are currently
   in. Indexing is direct and stateless.
4. Both models already do double duty — set the caret's voice, *and* reassign a selection into
   that voice — so nothing is lost by switching model.

`Alt+1`–`Alt+4` (Sibelius's binding) was the first proposal, and it was semantically neat —
`Alt` means change, and putting a selection into voice 3 is a change. **It does not survive
the browser** (§8.9): `Alt`+digit switches tabs in Firefox on Linux, types `¡`/`£` on macOS,
and the obvious escapes are worse — `Ctrl`+digit is reserved for tab switching and cannot be
overridden in Chrome, and `Ctrl+Alt`+digit is `AltGr` on European layouts. **Digits are not
available to voices in a web app at all.**

That forces the cycle model back, on a key that is not `V`. Two candidates:

| Option | For | Against |
|---|---|---|
| **`Shift+V`** | keeps the mnemonic; browser-safe; one key from vibrato; voice switching is far rarer than vibrato so the extra key is well spent | Dorico uses `Shift+V` for *new voice*, and `Shift`+letter is the slot a Dorico-style popover prefix would want (§6.2) |
| `` ` `` | free everywhere, physically adjacent to the digit row, cheap | no mnemonic |

**`Shift+V` is the better bet** unless popover prefixes are adopted wholesale, in which case
`Shift`+letter is spoken for and `` ` `` wins by default. That dependency is the thing to
settle first.

Since this is a cycle again, the active voice must be visible (§1.1): colour per voice
(Sibelius), or greying the inactive ones (Soundslice).

**One thing the reversal preserves.** Intervals are no longer forced off `Alt`+digit by a
voice collision — but they are still forced off it by the browser, so the conclusion stands:
intervals should use **Dorico's `Shift+Alt+A–G` / `Ctrl+Alt+A–G`** (name the pitch) rather
than MuseScore's or Flat's `Alt`+digit (count the scale degree).

**Minor, unresolved:** `N` is trill in Guitar Pro, and is taken here by move-to-string-above.
Trill is rare enough to live in the palette or on `Shift+N`.

### 8.7 `Esc`, revised

The earlier draft had `Esc` leaving edit mode. That is wrong, for a reason worth recording:
**`Esc` is already the dismiss key for dialogs, popovers and palettes**, so a stray second
press — after closing a dialog, or just to be sure the first registered — falls through the
stack and silently drops the access mode. In a product where view mode rebinds keys, whatever
is typed next then does something else. That is a silent mode error triggered by the most
reflexively-pressed key there is.

Precedent for keeping them apart: **Google Docs deliberately does not put mode switching on
`Esc`** despite having exactly this control, and **Dorico gives deselect its own key
(`Ctrl+D`)** rather than stacking it on `Esc`, keeping its `Esc` stack short.

So: `Esc` dismisses the topmost transient layer — dialog → popover / palette → inline text
field → selection → note-entry caret — and then **bottoms out as a no-op**, as `Esc` does in
vim's normal mode. It never changes whether the document is writable.

**General rule: the bottom of a reflexive key's stack must be a no-op.** Any state a reflex
can reach has to be cheap to undo *and* obvious when it happens; leaving edit mode is neither,
because it changes rendering and click semantics, not only whether keys write.

### 8.8 Deliberate breaks with convention

Worth stating explicitly, since emulation presets (§3.5) may later want to undo them:

- **`Ctrl+↑↓` is staff navigation, not octave.** Sibelius, MuseScore, Flat and Soundslice all
  use `Ctrl+↑↓` for octave; here octave is `Ctrl+Alt+↑↓`, because octave is a *change* and
  changes require `Alt`. Internal consistency is bought at the cost of the strongest
  cross-tool arrow convention in the survey.
- **Bare `↑↓` never alters pitch**, unlike Sibelius, MuseScore and Flat. Forced by the
  simultaneous notation + tab view (§3.2), and shared with Dorico and every tab-first tool.
- **`Alt+←→` is duration, not position.** Dorico's opposite assignment is displaced by
  reserving `Shift` for selection.
- **`Ctrl+↑↓` is voice, not staff** (§8.4) — staff is reached by spillover and by the `Ctrl+G`
  grammar instead. Justified by fingerstyle texture, where two voices are the norm and one
  staff is the norm; it would be the wrong call for orchestral material.
- **Intervals use letters (`Shift+Alt+A–G`), not `Alt`+digits** — forced by the browser (§8.9)
  rather than chosen.

### 8.9 Browser constraints — this is a web app

Every tool in §2 is a desktop application except Soundslice, Flat and Noteflight. The scheme
so far was derived mostly from desktop bindings, and several of them are not available in a
browser.

| Combination | Browser behaviour | Verdict |
|---|---|---|
| `Ctrl+1`–`8` | switches tabs | **impossible.** Chrome does not dispatch reserved shortcuts to the page at all; Firefox dispatches the event but switches tabs anyway, **ignoring `defaultPrevented`**. Not a matter of trying harder |
| `Ctrl+PageUp` / `Ctrl+PageDown` | previous / next tab | **reserved on Chrome**, alongside `Ctrl+N`, `Ctrl+W`, `Ctrl+T`, `Ctrl+Tab`, `Ctrl+Shift+Tab` |
| **`Ctrl+←→` on macOS** | **switches Spaces** — an OS-level grab, above the browser | must map `Ctrl`→`Cmd` on macOS |
| **`Ctrl+↑` on macOS** | **Mission Control**; `Ctrl+↓` is App Exposé | same |
| `Alt+←` / `Alt+→` | **Back / Forward** in Chrome, Firefox and Edge on Windows and Linux | **preventable** — but see below |
| `Alt+1`–`9` | **switches tabs in Firefox on Linux** (Windows Firefox uses `Ctrl+1`–`9`) | avoid |
| `Alt`+digit / `Alt`+letter on **macOS** | types a character — `Option+1` is `¡`, `Option+3` is `£`, `Option+8` is `•` | avoid for digits; read via `code` for letters |
| `Ctrl+1`–`8` | switches tabs in Chrome, Edge and Firefox/Windows | **unavailable** — Chrome refuses to let pages override tab and window actions |
| `Ctrl+Alt`+digit | on many European layouts `Ctrl+Alt` *is* `AltGr`, so this types a character | avoid |
| `Ctrl+Alt`+arrow | reported to rotate the display on Windows machines with Intel graphics hotkeys enabled — a driver-level grab no page can block | hazard, unverified here |
| `Ctrl+G` | Find Again | preventable |
| `Ctrl+K` | focuses the address bar / search | preventable in practice — Slack, Linear and GitHub all use it |
| `F2`, `Shift+F2`, `PageUp`/`PageDown`, bare digits, bare/`Shift`/`Ctrl+Shift` arrows | no browser meaning | safe |

Three consequences.

**`Alt+←→` survives, but the handler must be scoped.** Overriding Back globally is
user-hostile and an accessibility problem — it is how a lot of people navigate. The handler
should be bound to the score element and only call `preventDefault()` when the score has
focus, so `Alt+←` outside the score still goes back. Note that Firefox is permissive about
`preventDefault` while **Chrome refuses it for anything affecting tabs or windows** — which is
what rules out the `Ctrl`+digit row entirely rather than merely discouraging it.

**No digit-based voice selection is possible.** `Alt`+digit fails three ways (Firefox/Linux
tab switching, macOS `¡`/`£`, and `Ctrl+Alt`+digit being `AltGr` on European layouts), and
`Ctrl`+digit is unavailable outright per the table above. This is why voice ends up on
`Ctrl+↑↓` (§8.4) rather than indexed.

**`Ctrl` must map to `Cmd` on macOS** — the ordinary cross-platform web convention, and here it
is forced rather than cosmetic: macOS grabs `Ctrl+arrow` for Spaces and Mission Control before
the browser sees it, so `Ctrl+←→` for bar navigation would simply not work. The two platforms
fail in mirror image, which is mildly reassuring: `Alt+arrow` is hazardous on Windows/Linux
(Back/Forward) and free on macOS, while `Ctrl+arrow` is free on Windows/Linux and grabbed on
macOS. Mapping `Ctrl`→`Cmd` fixes the second; scoping `preventDefault` fixes the first.
`Cmd+←→` is Back/Forward on macOS, so it needs the same scoped handling as `Alt+←→` does
elsewhere.

**`event.code`, not `event.key` — decided.** This was an open question (§6.3); macOS settles
it. `Option+V` reports `key: "√"`, `Option+1` reports `key: "¡"`. Any `Alt`-based binding read
through `.key` is broken on macOS by construction. `code` gives physical position, which is
also what makes a QWERTY-derived layout survive AZERTY — the problem Flat solves with layout
auto-detection (§2.8). The cost is that `code` is *positional*, so a Dvorak user pressing the
key labelled `V` gets whatever sits at QWERTY `V`; a remapping table keyed off the detected
layout is the standard fix.

One caution on precedent: **Flat documents `Ctrl+1`–`4` for its workflow modes**, which by the
above should be swallowed by Chrome's tab switching on Windows. Either Flat has a workaround
or the binding is unreliable there — worth testing before treating it as proof the range is
usable.

### 8.10 Clipboard, undo and delete — conventional keys, unconventional questions

The standard keys apply with their standard meanings. There is no reason to be clever here and
several reasons not to be: these are the bindings users bring from every other application,
and the survey's own lesson is that the competition is against installed muscle memory (§3.5).

| Action | Windows / Linux | macOS | Browser status |
|---|---|---|---|
| Copy / Cut / Paste | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | `Cmd+…` | dispatched as `copy`/`cut`/`paste` events — see below |
| Undo | `Ctrl+Z` | `Cmd+Z` | free |
| Redo | `Ctrl+Y` **and** `Ctrl+Shift+Z` | `Cmd+Shift+Z` | free (`Cmd+Y` is *not* redo on macOS) |
| Select all | `Ctrl+A` | `Cmd+A` | preventable |
| Delete | `Delete` / `Backspace` | `Delete` | free |
| Paste special | `Ctrl+Shift+V` | `Cmd+Shift+V` | free; the general-software convention, and Guitar Pro's (§3.11) |

**One implementation constraint that is not obvious.** A score rendered to SVG in shadow DOM
has no DOM text selection, so the clipboard cannot be driven by the usual means: the editor
must listen for the `copy`, `cut` and `paste` **events** and read or write
`event.clipboardData`. Reading the system clipboard is only permitted *inside* a real `paste`
event (or behind a permission prompt via the async Clipboard API), so "paste" cannot be
invoked from an arbitrary keypress handler or a palette command without a fallback path.

Conventional keys, but three questions the survey says are not conventional at all:

**1 — What does paste *mean*?** §3.11 found this is where the deepest modality hides. Sibelius
gets three behaviours out of one `Ctrl+V` by making the *selection type* decide: multiple
selections merge, passage selections overwrite, system passage selections insert. This scheme
has **one** selection type, so paste needs exactly one defined semantic, chosen rather than
inherited. **Overwrite** is the natural default — it matches Sibelius's passage selection and
the tab editors — with insert-style paste available on `Ctrl+Shift+V`.

**2 — Voices are where clipboards break, and this scheme cannot afford that.** Finding 22:
every clipboard in the survey has a voice-shaped hole. Soundslice copies one voice at a time;
MuseScore's list selection cannot copy multiple notes; Dorico needed a Paste Into Voice
submenu. For fingerstyle material with thumb/bass and melody in separate voices (§8.4),
**copying a passage containing both voices is an ordinary operation, not an edge case** — so
multi-voice ranges are a baseline requirement here rather than a later refinement. Worth
stating explicitly because three mature products got it wrong.

**3 — Delete has the same overwrite-versus-displace duality as insert.** Deleting a note can
leave a rest (overwrite semantics) or close the gap and pull later music earlier (insert
semantics). These are different operations and both are wanted. TuxGuitar splits them with
`Del` (delete note) versus `Ctrl+Del` (clean beat); Dorico governs it globally with Insert mode
(sense 4, §1). Either is defensible; what is not defensible is picking one and leaving the
other unreachable.

Adopted: **`R` = repeat the selection**, which both Dorico and Sibelius bind and which is
heavily used in riff-based material. `R` is *rest* in Guitar Pro, but that conflict dissolves —
this scheme has no rest key at all (§8.11).

### 8.11 Rests: no key, but not no concept

**Can a rest just be the absence of a note?** In the UI, near enough. In MNX, no — and the
distinction is checkable rather than a matter of taste.

An MNX `event` requires only `duration`; both `notes` and `rest` are optional. That gives
**three** distinct states at one rhythmic position, not two:

| Event contains | Means | Draws |
|---|---|---|
| `notes: [...]` | sounding notes | noteheads |
| `rest: {}` | an explicit rest | a rest glyph |
| **neither** | a **space** — timed but draws nothing | nothing |

The model already names the third case: *"Anything carrying a duration spaces like an event —
e.g. `space` items, which are timed but draw nothing (no notes, no rest)"*
([src/model/mnx.ts:284](../src/model/mnx.ts#L284)). So "absence of a note" is **ambiguous** in
MNX: it is either a rest or a space, and they render differently. Whatever the keyboard does,
the writer has to pick one.

And `rest` is not an empty marker. It carries **`staffPosition`** — vertical position in
half-staff-spaces from the middle line ([src/model/mnx.ts:140](../src/model/mnx.ts#L140)) —
which matters *specifically* for this repertoire: in two-voice fingerstyle writing (§8.4) rests
are conventionally raised for the up-stem voice and lowered for the down-stem one. Rests carry
real data in exactly the texture being targeted. There are also `full-measure-rest` (an
empty-content sequence, drawn as a centred whole rest in any meter) and `multimeasure-rest`,
neither of which is an absence of anything.

**So: drop the rest key, keep the rest object.** Two things follow, both of which pay:

1. **`R` is freed for repeat-selection** (§8.10), which resolves the clash with Guitar Pro's
   `R` = rest — the binding is not being taken from rests, rests no longer need it.
2. **Rest positioning needs no new binding.** `Alt+↑↓` already means "change, vertical axis",
   and the §3.10 polymorphic-verb pattern applies: on a note that is pitch, on a rest it is
   `staffPosition`. One verb, per-type meaning.

**The editing model that makes this work:** a measure always has content for its full metric
duration, so unentered positions are already rests — nothing is created by moving the cursor
over them. That matters for rule 1: navigation stays non-mutating because there is nothing to
create. Note this is deliberately *not* Soundslice's model, where "move forward with the right
arrow to create new beats or bars as needed" — arrow-creates-beats would make bare arrows
mutate, which rule 1 forbids.

**`Space` stays play/pause**, as in Guitar Pro and TuxGuitar, rather than taking Dorico's
"advance the caret" meaning. Dorico can have both because note input is a mode (Space is
transport outside it, caret-advance inside); a modeless scheme has to choose, and for a tab
tool with playback the transport meaning is worth more.

Explicit rest operations that remain, and belong in the palette rather than on keys:
full-measure rest, multimeasure rest, and forcing a **space** where the default would write a
rest.

### 8.12 Open

- The `N`/trill clash (§8.6).
- **Whether Dorico-style popover prefixes are adopted** — it claims the whole `Shift`+letter
  row, so it should be settled before anything else is put there.
- Whether a direct staff jump is ever needed beyond spillover and `Ctrl+G` (§8.4) — the answer
  changes if MNX Lab ever targets many-staff scores.
- **Whether `Ctrl+↑↓` also falls through at its boundary** — `Ctrl+↑` at the top voice moving
  to the staff above, mirroring bare `↑` at the top string. It would make "fall through at the
  boundary" one principle covering the whole vertical axis, restore rule 4 exactly ("promote:
  voice if there is one, else staff"), and give `Ctrl+↑↓` something to do in a single-voice
  score. Proposed, not adopted.
- Which of `Delete` / insert-mode handles gap-closing deletion (§8.10).
- Whether paste defaults to overwrite, with insert on `Ctrl+Shift+V` (§8.10).
- Whether the deferred duration alias is ever added, and on which polarity (§8.5).
- Testing Flat's `Ctrl+1`–`4` in Chrome on Windows, since by §8.9 it should not work.
- Whether digits are a view-scoped layer — frets in a tab pane, durations in a notation pane,
  views in the review shell (§1.1, §6.1) — and what shows which is active.
- ~~`KeyboardEvent.code` vs `.key`~~ — **settled: `code`** (§8.9).
- Whether any of this reaches `elements/`, and so the embed, or stays in the workbench shell.

---

## 9. Sources

Official documentation: [Dorico Quick Reference Card v5](https://blog.dorico.com/wp-content/uploads/2024/08/Dorico-Quick-Reference-Card-v5.pdf) ·
[Dorico First Steps key commands](https://www.steinberg.help/r/dorico/doricofirststeps/6.1/en/dorico_first_steps/topics/first_steps_intro/first_steps_key_commands_r.html) ·
[Dorico Insert mode](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/write_mode/write_mode_insert_mode/write_mode_insert_mode_c.html) ·
[Dorico Insert mode scopes](https://archive.steinberg.help/dorico/v5/en/dorico/topics/write_mode/write_mode_insert_mode/write_mode_insert_mode_scope_r.html) ·
[Dorico jump bar](https://www.steinberg.help/r/dorico-elements/6.1/en/dorico/topics/user_interface/user_interface_jump_bar_r.html) ·
[Dorico: inputting notes on tablature](https://www.steinberg.help/r/dorico-se/6.1/en/dorico/topics/write_mode/write_mode_note_input/write_mode_note_input_inputting_notes_tablature_t.html) ·
[Getting started with Note Input in Dorico](https://blog.dorico.com/wp-content/uploads/2018/09/Getting-started-with-Note-Input-in-Dorico.pdf) ·
[MuseScore: all keyboard shortcuts](https://handbook.musescore.org/appendix/all-keyboard-shortcuts) ·
[MuseScore: entering notes and rests](https://handbook.musescore.org/basics/entering-notes-and-rests) ·
[MuseScore: alternative note input methods](https://musescore.org/en/handbook/3/note-input-modes) ·
[MuseScore: entering and editing tablature](https://handbook.musescore.org/idiomatic-notation/guitar/entering-and-editing-tablature-notation) ·
[MuseScore: accessibility](https://handbook.musescore.org/navigation/accessibility) ·
[MuseScore Studio 4.5 release](https://musescore.org/en/4.5) ·
[MuseScore: customizing keyboard shortcuts](https://handbook.musescore.org/customization/keyboard-shortcuts) ·
[MuseScore: navigating your score](https://handbook.musescore.org/navigation/navigating-your-score) ·
[MuseScore: the Timeline](https://handbook.musescore.org/navigation/timeline) ·
[MuseScore: working with multiple voices](https://musescore.org/en/handbook/3/working-multiple-voices) ·
[MuseScore: selecting elements](https://handbook.musescore.org/basics/selecting-elements) ·
[MuseScore: copy and paste](https://handbook.musescore.org/basics/copy-and-paste) ·
[MuseScore accessibility shortcut sheet (PDF)](https://musescore.org/sites/musescore.org/files/MuseScore%20Shortcuts.pdf) ·
[Soundslice: selecting notes](https://www.soundslice.com/help/en/creating/basics/82/selecting-notes/) ·
[Soundslice: using multiple voices](https://www.soundslice.com/help/en/creating/basics/55/voices/) ·
[Soundslice: customizing keyboard shortcuts](https://www.soundslice.com/help/en/creating/basics/76/custom-shortcuts/) ·
[Soundslice: exiting the editor (view vs edit)](https://www.soundslice.com/help/en/creating/basics/88/exiting-the-editor/) ·
[Soundslice blog — quickly toggle the editor off](https://www.soundslice.com/blog/179/new-quickly-toggle-our-editor-off/) ·
[Noteflight: toggling between playback and edit mode](https://support.noteflight.com/hc/en-us/community/posts/43482762077332-Toggling-Between-Playback-and-Edit-Mode) ·
[Soundslice: player keyboard shortcuts](https://www.soundslice.com/help/en/player/tips/1/keyboard-shortcuts/) ·
[Flat: read-only mode](https://help.flat.io/en/music-notation-software/read-only/) ·
[Flat: share and collaborate](https://help.flat.io/en/music-notation-software/share-collaborate/) ·
[Noteflight: what's new — Play Mode and Perform View](https://notes.noteflight.com/whats-new-play-mode-and-perform-view-added/) ·
[TuxGuitar: markers and player](https://www.tuxguitar.app/files/devel/desktop/help/detail_markers_player.html) ·
[Guitar Pro 8 user guide](https://static.guitar-pro.com/gp8/manual/Guitar-Pro-8-user-guide.pdf) ·
[Flat: working with voices](https://help.flat.io/en/music-notation-software/addvoice/) ·
[Soundslice: keyboard shortcuts](https://www.soundslice.com/help/en/creating/basics/62/keyboard-shortcuts/) ·
[Soundslice: note entry](https://www.soundslice.com/help/en/creating/basics/81/note-entry/) ·
[Soundslice: editing tab](https://www.soundslice.com/help/en/creating/tablature/59/overview/) ·
[Flat: keyboard shortcuts](https://help.flat.io/en/music-notation-software/keyboard-shortcuts/) ·
[Flat: workflow modes](https://blog.flat.io/keyboard-shortcuts-back-flat-workflow-modes/) ·
[TuxGuitar: default shortcuts](https://www.tuxguitar.app/files/devel/desktop/help/tools_shortcuts.html) ·
[TuxGuitar: measure and beat](https://www.tuxguitar.app/files/devel/desktop/help/detail_measure_beat.html) ·
[Finale: Speedy Entry tool](https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/tool-speedy-entry.htm) ·
[Finale: Simple Entry](https://usermanuals.finalemusic.com/FinaleMac/Content/Finale/Simple_Entry.htm) ·
[LilyPond: input modes](http://lilypond.org/doc/v2.25/Documentation/notation/input-modes) ·
[Frescobaldi manual](https://frescobaldi.org/uguide.html) ·
[Denemo manual](https://denemo.org/~rshann/denemo-manual.html) ·
[Guitar Pro 8 shortcut list (official)](https://support.guitar-pro.com/hc/en-us/articles/360001646978-GP8-List-of-keyboard-shortcuts)

Secondary and community: [Scoring Notes — Dorico from A to Z](https://www.scoringnotes.com/tips/dorico-from-a-to-z/) ·
[Scoring Notes — tips for using Dorico's Jump Bar](https://www.scoringnotes.com/tips/jump-to-it-tips-for-using-doricos-jump-bar/) ·
[Scoring Notes — customize keyboard shortcuts in Sibelius and Dorico](https://www.scoringnotes.com/tips/customize-keyboard-shortcuts-in-sibelius-and-dorico/) ·
[Scoring Notes — simplifying Simple Entry in Finale](https://www.scoringnotes.com/tutorials/simplifying-simple-entry-in-finale/) ·
[Scoring Notes — MuseScore Studio 4.5](https://www.scoringnotes.com/news/musescore-studio-4-5/) ·
[Notre Dame libguide — Sibelius shortcuts](https://libguides.library.nd.edu/notation/sibelius-shortcuts) ·
[Scoring Notes — add custom shortcuts for Keypad features in Sibelius](https://www.scoringnotes.com/tips/add-custom-shortcuts-for-keypad-features-in-sibelius/) ·
[Scoring Notes — four types of selection in Sibelius](https://www.scoringnotes.com/tips/four-types-of-selection-in-sibelius/) ·
[Scoring Notes — cracking Sibelius's color code](https://www.scoringnotes.com/tips/cracking-sibeliuss-color-code/) ·
[Scoring Notes — getting selective with filters](https://www.scoringnotes.com/tutorials/getting-selective-with-filters/) ·
[Dorico blog — tip: Select More](https://blog.dorico.com/2018/12/tip-select-more/) ·
[Dorico: moving notes/items rhythmically](https://archive.steinberg.help/dorico_pro/v5/en/dorico/topics/write_mode/write_mode_arranging_tools/write_mode_notes_items_moving_rhythmically_t.html) ·
[Dorico: selecting/deselecting notes and items individually](https://www.steinberg.help/r/dorico-se/6.1/en/dorico/topics/write_mode/write_mode_selecting/write_mode_notes_notation_selecting_deselecting_t.html) ·
[Dorico: filters](https://www.steinberg.help/r/dorico-pro/6.1/en/dorico/topics/write_mode/write_mode_selecting/write_mode_filters_r.html) ·
[Dorico: Notes toolbox (Write mode)](https://archive.steinberg.help/dorico_pro/v3.5/en/dorico/topics/write_mode/write_mode_notes_toolbox_r.html) ·
[Dorico: Engrave toolbox](https://archive.steinberg.help/dorico/v2/en/dorico/topics/engrave_mode/engrave_mode_engrave_toolbox_r.html) ·
[Dorico: Engrave mode introduction](https://www.steinberg.help/r/dorico-elements/6.1/en/dorico/topics/engrave_mode/engrave_mode_introduction_c.html) ·
[Dorico: Play toolbox](https://archive.steinberg.help/dorico/v2/en/dorico/topics/play_mode/play_mode_play_toolbox_r.html) ·
[Dorico: piano roll editor](https://www.steinberg.help/r/dorico-se/6.1/en/dorico/topics/key_editor/key_editor_piano_roll_editor_r.html) ·
[Dorico: selecting bars with the system track](https://archive.steinberg.help/dorico_se/v3/en/dorico/topics/write_mode/write_mode_editing_selecting/write_mode_system_track_bars_selecting_t.html) ·
[Dorico: the system track (reference)](https://archive.steinberg.help/dorico_pro/v2/en/dorico/topics/write_mode/write_mode_system_track_r.html) ·
[Dorico blog — tip: rhythmic grid resolution](https://blog.dorico.com/2022/09/tip-rhythmic-grid-resolution/) ·
[Making selections in Dorico (doricotuts)](https://doricotuts.com/making-selections-in-dorico/) ·
[Dorico blog — tip: paste copied music into a new voice](https://blog.dorico.com/2020/09/tip-paste-copied-music-into-a-new-voice/) ·
[Dorico blog — tip: use chord mode to merge music when pasting](https://blog.dorico.com/2018/05/tip-use-chord-mode-to-merge-music-when-pasting/) ·
[Sibelius Reference Guide 2024.3 (Keypad layouts, Go to Bar)](https://resources.avid.com/SupportFiles/Sibelius/2024.3/Sibelius_Reference.pdf) ·
[Avid help centre — Sibelius voices shortcut thread](http://www.sibelius.com/cgi-bin/helpcenter/chat/chat.pl?com=thread&start=652931&groupid=3&guest=1) ⚠️ ·
[Customizing Dorico key commands](https://makingthemostofnotationsoftware.blog/2024/12/15/customizing-dorico-key-commands/) ·
[MuseScore forum — "Open question: why do we need note input mode?"](https://musescore.org/en/node/139606) ·
[MuseScore — Help us improve Note Input workflow (Tantacrul redesign)](https://musescore.org/en/noteinput_redesign) ·
[MuseScore PR #5376 — note input redesign](https://github.com/musescore/MuseScore/pull/5376) ·
[SibAccess — Sibelius tutorial for screen reader users (Berklee AMT Lab)](https://sibaccess.github.io/) ·
[Sibelius accessibility for the visually impaired (Avid)](https://avidtech.my.salesforce-sites.com/pkb/articles/en_US/how_to/Sibelius-Accessibility-for-the-Visually-Impaired-User) ·
[MuseScore.com — How to use Input by Duration in MuseScore 4.5](https://musescore.com/news/lessons-tutorials/how-to-use-input-by-duration-in-musescore-45/) ·
[Soundslice blog — introducing the notation/tab editor](https://www.soundslice.com/blog/55/introducing-the-soundslice-notation-tab-editor/) ·
[Guitar Pro cheat sheet (quickref.me)](https://quickref.me/guitar-pro.html) ⚠️ ·
[Guitar Pro shortcuts (usethekeyboard)](https://usethekeyboard.com/guitar-pro/) ⚠️ ·
[Noteflight keyboard shortcuts](https://support.noteflight.com/hc/en-us/articles/360020463271-Keyboard-Shortcuts) ⚠️

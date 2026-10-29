# Glow-up log

Which pieces in the owner's studio library have been through which treatment. Most of the
~100 pieces came over from Soundslice as hand transcriptions, nearly all by the owner,
synced to a YouTube video or an audio file by hand. The lab now has tools that can check
and improve them against their recordings; a **glow-up** is putting one piece through
those tools, and this file is where that is recorded. The aim, over time: every piece the
owner still plays.

The library is the primary checkout's local one (`localhost:5173/studio/`); a piece's id
is the last part of its studio URL (`#/piece/<id>`). The sync runs' full numbers are in
[tools/recording-align/RUNS.md](tools/recording-align/RUNS.md); this log says what
happened to the piece, and links the run.

## The treatments

| | Treatment | How | Done when |
|---|---|---|---|
| **Sync** | Bar lines found in the recording by the bar search, replacing Soundslice's or a hand sync | [`/sync-recording`](.claude/skills/sync-recording/SKILL.md) — MuScriptor transcription, free-order bar search, cuts snapped to heard downbeats | written, and the owner has watched it play |
| **Form** | The score's performed order is what the recording plays: repeats, endings, jumps | the bar search's departures and `score`'s pass diagnostics, settled with the owner; the score or the player is fixed, whichever is wrong | the search follows the score's own order end to end |
| **Notes** | The written notes are the ones played | written notes no pass of the recording sounds, and notes every pass sounds that are not written, each shown to the owner with its video time and settled by ear (run 6's method; its `disagreements.py` is still research code in `.scratchpad/tab-draft/pipeline/`) | every finding settled; changes saved as named checkpoints (`Recording check: bars …`) |
| **Lyrics** | Songs only: the words under the notes, verse by verse | the lyric panel ([docs/lyric-text.md](docs/lyric-text.md)) | every sung verse entered and lit in the right pass |

A glow-up runs them in that order — the notes check needs the bar lines, and the bar lines
need the right order — but any one can be done alone. Form changes and note changes are
the owner's score being edited: dry run first, the owner says yes, and each batch lands
as a named checkpoint so it can be undone.

## The ledger

One row per piece in the library (2026-10-29: 100, counting drafts and duplicates). **▶**
is the owner's mark for a piece still played — those come first. Sync names where the
current sync came from: **bar search** (a `/sync-recording` run), *Soundslice* (imported,
untreated), *hand* (the sync bar), *unsynced*, or *no recording*. ✅ done · 🟡 started or
partly done · blank not yet · *draft* a piece drafted from audio, not yet a transcription.

| Piece | Artist | id | ▶ | Sync | Notes | Form | Lyrics |
|---|---|---|---|---|---|---|---|
| Ain't no Sunshine | Bill Withers | `b9f39a22e74d8efd` |  | hand, sync bar 09-20 |  |  |  |
| Angie | Rolling Stones | `fb9dbf97903c9295` |  | Soundslice |  |  |  |
| Anji | Davy Graham | `4ba87854701835cc` |  | Soundslice |  |  |  |
| Autumn Leaves |  | `01dd55ce07574bfa` |  | Soundslice |  |  |  |
| Baby Please Don't Go |  | `161f236eba4b591d` |  | no recording |  |  |  |
| Be Good or Be Gone | Fionn Regan | `325538a0a043c7ba` |  | Soundslice |  |  |  |
| Begged | Olivia Rodrigo | `72329d5e9d53a613` |  | Soundslice |  |  |  |
| Bizarre Love Triangle |  | `6be0c2ba1ce7b55d` |  | Soundslice |  |  |  |
| Blackbird | Beatles | `b0bcd1230724657d` |  | **bar search** 10-28 | 🟡 10-28 |  |  |
| Blackwaterside | Bert Jansch | `71a3ad5c18aec9c4` |  | Soundslice |  |  |  |
| Blackwaterside lesson | Bert Jansch | `fb8d1013ffab87ca` |  | Soundslice |  |  |  |
| Blues Run The Game | Jackson C.Frank (Ole Kirkeng) | `b599d2b96aaaa6ca` |  | Soundslice |  |  |  |
| Both Sides Now | Joni Mitchel (Emil Ernebro) | `90bcab067aced626` |  | no recording |  |  |  |
| Broken Man | Narimasa | `c9c7c27a4893a866` |  | Soundslice |  |  |  |
| Camptown Races |  | `d78acbff011d04d0` |  | no recording |  |  |  |
| Candy Man |  | `a514a852dbe58a62` |  | Soundslice |  |  |  |
| Candyman |  | `cd4078934af8b013` |  | Soundslice |  |  |  |
| Carol of the Bells | Mykola Leontovych / Peter J. Wilhousky | `62902862807a8fef` |  | Soundslice |  |  |  |
| Chicago | Surjan Stevens | `491f09c82a77748a` |  | Soundslice |  |  |  |
| China | Tori Amos | `ddee77339a4c1458` |  | Soundslice |  |  |  |
| cirillo-2025-08-09 | Marco Cirillo | `1733e4ec08a1acce` |  | unsynced |  |  |  |
| Classical Gas | Mason Williams | `9d9d1772c97f1629` |  | Soundslice |  |  |  |
| Colours | Donavan (Chris Brain) | `5c96fd4139c593d1` |  | Soundslice |  |  |  |
| Cormorant (draft) | John Blek | `9b093e5a2114a1c3` |  | draft pipeline 10-26 | draft |  |  |
| Cormorant (draft, Meneer Frits 2022) | John Blek | `5df759c729c55db9` |  | **bar search** 10-27 | draft |  |  |
| Cruel Summer | Bananarama | `d63697e5db3ca97a` |  | Soundslice |  |  |  |
| Curragh of Kildare | Bert Jansch | `af9f36d69555abb9` |  | Soundslice |  |  |  |
| Day is Done | Nick Drake | `429dc263a1d42287` |  | Soundslice |  |  |  |
| Don't need the sunshine | Catatonia | `e4060b7fe025c246` |  | Soundslice |  |  |  |
| Don't Think Twice, It's Alright | Bob Dylan | `067529d9b4042160` |  | Soundslice |  |  |  |
| Dust In The Wind | Sungha Jung | `e250217b3b865780` |  | Soundslice |  |  |  |
| Eleanor Rigby | Beatles (fingerstyle book) | `243e798f04b5ff1f` |  | no recording |  |  |  |
| Erwan | Meic Stevens | `2ba9acbdad27fe6b` |  | Soundslice |  |  |  |
| Every Breath You Take | The Police | `05fa6b889b0481b6` |  | Soundslice |  |  |  |
| Everybody Wants To Rule The World | Tears For Fears | `2b156138db0c7716` | ▶ | **fixed-order** 10-29 (interim) | 🟡 10-29 (written half + copies) | 🟡 10-29 | — |
| Fast Car | Tracy Chapman | `10537b9c88cc5329` |  | Soundslice |  |  |  |
| Fingerstyle Mastery: Travis Picking Part 2 | Mike Dawes | `8dee0f5649ee664d` |  | no recording |  |  |  |
| Freight Train | Elizabeth Cotton | `b9cc081329df0d07` |  | Soundslice |  |  |  |
| Fresh as a sweet sunday morning | Bert Jansch (Chris Brain) | `1525621010d30a38` |  | Soundslice |  |  |  |
| Going to California | Led Zepelin (Justin Johnson) | `377b53712b04b817` |  | Soundslice |  |  |  |
| Golden Days |  | `5dd059794ed6a19d` |  | Soundslice |  |  |  |
| Gymnopedie No.1 | Erik Satie | `89522c4cd0b272a4` |  | Soundslice |  |  |  |
| Halelujah | Leonard Cohen | `6cb75bcb76ffb36e` |  | Soundslice |  |  |  |
| Here Comes the Sun | The Beatles | `f137ceb60679fe0d` |  | Soundslice |  |  |  |
| House of the Rising Sun |  | `5839c1574c4756d1` |  | no recording |  |  |  |
| Hurt | Johnny Cash | `82388dda5c5fb2c0` |  | Soundslice |  |  |  |
| I'm on Fire | Bruce Springsteen (Carson Mckee) | `72bca5cbd9c73569` |  | Soundslice |  |  |  |
| Imagine | John Lennon (Tim Van Roy) | `7c1f69e8a92f21b4` |  | Soundslice |  |  |  |
| Is There Anybody Out There? | Pink Floyd | `53d84e3e1bada9f3` |  | Soundslice |  |  |  |
| Jesse | Joshua Kadison | `b982792a06ed1a7e` |  | Soundslice |  |  |  |
| Just Like Heaven | The Cure | `3023ca1345b2164b` |  | Soundslice |  |  |  |
| Kind Hearted Woman Blues | Robert Johnson | `7b1f683c6a056510` |  | Soundslice |  |  |  |
| Kum-ba-yah |  | `6122d434f3999e6f` |  | no recording |  |  |  |
| Landslide (Live Version) | Fleetwood Mac | `ba7bfdae4d7bfcc8` |  | Soundslice |  |  |  |
| Let it snow |  | `e3f4c46609f152a1` |  | Soundslice |  |  |  |
| Like a rolling stone | Eddie Berman with Laura Marling | `7bfe44db369ff738` |  | Soundslice |  |  |  |
| Little Drummer Boy |  | `3693f7c39ebc21a5` |  | Soundslice |  |  |  |
| Little Martha | The Allman Brothers | `fb3bf9c38fc433da` |  | Soundslice |  |  |  |
| Lullabye (Goodnight, My Angel) | Billy Joel | `e0d2e41d5e55b1a0` |  | Soundslice |  |  |  |
| Martha's Harbour | All About Eve | `88329d98f207adc6` |  | Soundslice |  |  |  |
| Merrily Kissed The Quaker | Pierre Bensusan | `8ab33f9e192ee9de` |  | **bar search** 10-15 (run 4) |  | ✅ 10-15 |  |
| More than words | Extreme | `caa2d410d363c36f` |  | Soundslice |  |  |  |
| Môr o Gariad | Meic Stevens | `22bdc4c5e494069a` |  | Soundslice |  |  |  |
| Needle Of Death | Bert Jansch | `0e39b821573b54c3` |  | Soundslice |  |  |  |
| Never going back again | Fleetwood Mac (Corey Heuval) | `ce6ed9941cd91489` |  | Soundslice |  |  |  |
| No Surprises (original) | Radiohead | `aa0029d2a48f4fe2` |  | Soundslice |  |  |  |
| No Surprises (tutorial) | Radiohead | `f91c70277645dca1` |  | Soundslice |  |  |  |
| Northern Skies | John Bramwell | `83860934fa482c44` |  | Soundslice |  |  |  |
| Now Westlin Winds | Chris Brain (Dick Gaughan) | `8d322ecf523f5bd6` |  | Soundslice |  |  |  |
| Oh! Susanna |  | `647c86e43a79f68e` |  | no recording |  |  |  |
| Old Pine | Ben Howard | `335fe1fd3bdb2b47` |  | no recording |  |  |  |
| One Of These Things First | Nick Drake | `21ef56229a8d0a8a` |  | Soundslice |  |  | ✅ 10-21 |
| One of these things first |  | `ce7cd1a69eb0296b` |  | Soundslice |  |  |  |
| River Man | Nick Drake | `d6232c7e169b27d7` |  | Soundslice |  |  |  |
| Road | Nick Drake | `256075ba46010719` |  | Soundslice |  |  |  |
| Romanza | Luke Edwards | `dca57ce024a2b074` |  | Soundslice |  |  |  |
| Running From Home | Bert Jansch | `b4bc9810c003276f` |  | Soundslice |  |  |  |
| Sign of the Times | Harry Styles (Arr. David van Ooijen) | `0dbd73eb5758f45e` |  | Soundslice |  |  |  |
| Silent Night 2020 |  | `be7b066dc56d8a2a` |  | no recording |  |  |  |
| Simple Twist Of Fate | Bob Dylan (Carson McKee) | `30f84b99afaa3a98` |  | Soundslice |  |  |  |
| Smells Like Teen Spirit | Nirvana (arr. Nikola Milovanovic) | `ccef043db55deb0d` |  | **bar search** 10-22 (run 5) | ✅ 10-22 (PDF) | ✅ 10-22 |  |
| Steady Away | Chris Brain | `e863b804cc7fe4e1` |  | Soundslice |  |  |  |
| Street Spirit | Radiohead | `9218b1b6c813558e` |  | Soundslice |  |  |  |
| Strolling Down the highway | Bert Jansch | `4cc190c6b61e55f2` |  | Soundslice |  |  |  |
| Sun did glide | Chris Brain | `dcbc40c2dcd33f45` |  | **bar search** 10-27 (run 6) | ✅ 10-27 | ✅ 10-27 |  |
| Suzanne | Leonard Cohen | `3a6e7d1ae0e9b4dd` |  | Soundslice |  |  |  |
| Sweet Child O Mine |  | `f4d2a15b7dfa926d` |  | Soundslice |  |  |  |
| Take on me | A-Ha | `c30e899567cd43e4` |  | Soundslice |  |  |  |
| Take On Me (melody) | A-Ha | `65aaf6d462d6d425` |  | Soundslice |  |  |  |
| Tell Me What Is True Love | Bert Jansch | `88d9568ccb810450` |  | Soundslice |  |  |  |
| The Bug Collector | Haley Heynderickx | `10122f3d6e7738e5` |  | Soundslice |  |  |  |
| The First Time Ever I Saw Your Face | Bert Jansch | `66384ce413d05771` |  | **bar search** 10-14 (run 1) |  |  |  |
| The Staves - In The Long Run |  | `8079fa2587f3bc39` |  | Soundslice |  |  |  |
| The Winner Takes It All | ABBA | `cb19f76b5567e9e7` |  | Soundslice |  |  |  |
| There she goes | The Las | `e6df329ab2be6d6b` |  | Soundslice |  |  |  |
| These Days | Jackson Browne (Ole Kirkeng) | `73a80978aff76f12` |  | Soundslice |  |  |  |
| Things Behind The Sun | Nick Drake | `3129e94f26a161a2` |  | Soundslice |  |  |  |
| Vestapol | Stefan Grossman | `d626ac54313aecbb` |  | Soundslice |  |  |  |
| Wicked game |  | `a8497181ef214b91` |  | Soundslice |  |  |  |
| Yankee Doodle |  | `7569b56c26ca752a` |  | no recording |  |  |  |

## Log

Newest first. One entry per glow-up session: what was done, the numbers that say it
worked, the checkpoints it left, and what is still open on the piece. Entries before
2026-10-29 were reconstructed from RUNS.md, the tab-draft results and the library's
checkpoints.

### 2026-10-29 — Everybody Wants To Rule The World (Gabriella Quevedo's arrangement) · `2b156138db0c7716` — [run 9](tools/recording-align/RUNS.md#run-9--2026-10-29--everybody-wants-to-rule-the-world-gabriella-quevedo-the-fixed-order-search) · in progress

The first piece put through the glow-up on purpose. The owner's transcription covers bars 1–45
and 52–57 of 111; the rest are placeholder bars. Recording YouTube `aqx5AO4fxDU`, guitar alone,
Open E♭, tuned to A=428 (retuned +48 cents before transcribing).

- **Notes** 🟡 (the written half), five named versions, each checked so that no other bar moves:
  bar 1 is the pickup she plays (six eighths in 6/8); slaps she plays and the score left out
  (beat 4 in bars 10 12 14 18 32 36, beats 2 and 4 in every chorus — heard by MuScriptor's
  `drums` and a percussive measure, two of them confirmed on the video); the F♯–G ornament on
  beat 3 in bars 19 21 37 39; chorus bar 6 (27 45 57) ending F3 pulled off to D♯3; bar 5 is
  11/8 (she drops an eighth before bar 6).
- **Sync**: the Soundslice sync was 100–200 ms early. Replaced (revision 11) by the fixed-order
  search held near it — interim, for transcribing along to the video; the final sync comes when
  the score is complete. Every written bar now matches; 89% of written notes found against 44%
  chance (the riff makes chance high). The Soundslice sync is kept in the run directory.
- **Slaps**: none of the written ones turned out to be missing; the writing had too few, not too
  many. A slap is heard by the guitar transcriber as a burst of pitched notes (open D♯2 + D♯3
  and the held chord) — only the `drums` instrument hears it as a hit.
- **Owner's direction** (2026-10-29), for the repeats step: *"if bars are almost the same in a
  repeat e.g. one note difference (perhaps a mistake or mishear) then I'd accept the
  merge/repeat. i.e. a slight preference for repeats"*.
- **The plan, agreed**: notes before repeats (a repeat claims the passes are the same, which only
  the written-out check can show); the written half corrected in one go; the empty half a section
  at a time — the chorus and outro copies first, then drafts of the solos, interludes and bridge
  with slaps from the start; then a notes check over every pass; then repeats; then the final sync.
- **Then**: chorus bar 5 (26 44 56) — the open D♯2 heard on eighths 6 and 12 is her finger
  leaving the string as she shifts (the owner, from the video), written as pull-offs 2⌒0, 4⌒0.
  Copies: choruses 80–85 (from 40–45), 96–101 (from 52–57), 90–91 (from 44–45); the outro's riff
  102–109 (28 29 6 29 6 29 28 29) — every copied bar 13–20 of its notes found. The sync went stale
  over the copies (it counts beats per bar) and was rewritten (revision 17).
- **The solo, 66–71, drafted** (revision 18) from the recording on the sync's bar lines — MuScriptor
  notes, the pipeline's quantize and fret steps, the drum hits as slaps, each slap's ring (open
  D♯2/D♯3, re-sounded notes) dropped — then reviewed by the owner in the editor. One correction
  (revision 19): bar 67's first note, an F5, was the C♯3 bass's 5th overtone; the owner heard a
  harmonic, and its attack put it an eighth earlier — the s3 12th-fret harmonic on bar 66's last
  eighth, ringing over the bar line. Banked as it stands.
- Open, to draft a section at a time: solo 2 72–79, interlude 58–61 (→ 62–65, 92–95),
  the fourth chorus's opening 86–89 (a variation), bridge 46–51, the line over the outro 104–108,
  the ending 110–111. To listen to: bars 18/36's downbeat; bars 42/54's last eighth (G2 a beat
  early?).

### 2026-10-28 — Blackbird (Beatles) · `b0bcd1230724657d`

- **Sync** against the Beatles' original (YouTube `Man4Xw8Xypo`, voice + guitar): the
  first outside test of Gabox INSTV7N separation. Bar search 85% of score notes found
  (exact) against 25% chance; 87% of written notes heard on the search's bar lines.
- **Notes** 🟡: the score revised from the recording over revisions 26 → 33, ending in the
  checkpoint *Open G on the ¼, melody on the ½ (from the recording)*. Whether every
  finding was settled is not recorded.
- Open: confirm the notes check is complete; Form not assessed.

### 2026-10-27 — Cormorant (John Blek) · `9b093e5a2114a1c3`, `5df759c729c55db9`

- Not glow-ups: two **drafts** made from recordings by the tab-drafting pipeline (live at
  Musicstar; Meneer Frits 2022), redrafted when MuScriptor replaced Basic Pitch. The
  Meneer Frits draft's bar lines came from the bar search (*the tracker had jumped phase*).
- Open: a draft becomes a piece when the owner has corrected it; then it starts here.

### 2026-10-27 — Sun Did Glide (Chris Brain) · `dcbc40c2dcd33f45` — [run 6](tools/recording-align/RUNS.md#run-6--2026-10-27--sun-did-glide-chris-brain-the-owners-own-transcription)

- **Sync** replaced the Soundslice one, which ran early: MuScriptor's notes within ±70 ms
  of it 51%, of the new sync 92%. 153 bars, 88% found (exact) against 21% chance.
- **Form**: the Interlude was a lone "2." ending holding the strain's `:|x3`; studio
  played 55 bars where the performer plays 153. Fixed in `passes.ts`, then written as
  "1.3." on bar 46 and a copy of bar 46 starting "2." (78 written bars), the notation
  MuseScore, Soundslice and studio all read alike.
- **Notes**: every disagreement settled by ear — 14 changes, 4 left as written, a dead
  note marked (bar 70); thumb pinches in bars 5, 8, 17; bar 14's G#4 written once. Seven
  named checkpoints.
- Open: the owner has not yet judged the new sync by watching it.

### 2026-10-22 — Smells Like Teen Spirit (arr. Nikola Milovanovic) · `ccef043db55deb0d` — [run 5](tools/recording-align/RUNS.md#run-5--2026-10-22--smells-like-teen-spirit-a-piece-made-from-the-screen)

- A new piece, read off the video's on-screen score (33 bars), then synced: 65 of 65
  performed bars in order, 90% found against 13% chance.
- **Form**: the performer returns to bar 5, not to the printed `|:` at 21 — written as
  segno / D.S. al Coda; sections named.
- **Notes**: checked bar by bar against the arranger's PDF (bought): 33 of 33 match.

### 2026-10-21 — One Of These Things First (Nick Drake) · `21ef56229a8d0a8a`

- **Lyrics** entered while the lyric panel was being built (62 checkpoints,
  2026-10-18 → 21); the piece settled how verses run through D.S. returns and that the
  player takes repeats after a jump.
- Open: Sync is still Soundslice's; Notes not checked.

### 2026-10-15 — Merrily Kissed The Quaker (Pierre Bensusan) · `8ab33f9e192ee9de` — [run 4](tools/recording-align/RUNS.md#run-4--2026-10-15--merrily-kissed-the-quaker-three-candidate-recordings)

- Three candidate recordings assessed; the owner chose Nik Davies's and dropped
  Bensusan's (a medley).
- **Form**: restructured to the doubled form all the recordings play (A B C A′ B′ C A,
  each part repeated; 32 written bars, 57 performed) — checkpoint *Doubled form*.
- **Sync**: 57 bars in the score's order, 80% found against 37% chance. Owner: "I think it
  lines up very well."
- Open: Notes not checked (MuScriptor hears the fast triplets less well — run 7).

### 2026-10-14 — The First Time Ever I Saw Your Face (Bert Jansch) · `66384ce413d05771` — [run 1](tools/recording-align/RUNS.md#run-1--2026-10-14--the-first-time-ever-i-saw-your-face-bert-jansch)

- The first bar-search **sync**: 44 of 56 performed bars (the clip ends there), 86% found
  against 19% chance. Owner: "it really was superb."
- Open: Form — bar 25's "2nd and 3rd" ending is never reached; Notes not checked.

### 2026-09-20 — Ain't No Sunshine (Bill Withers) · `b9f39a22e74d8efd`

- Written in studio and synced by hand while the sync bar was being designed — not a
  glow-up, but no longer a Soundslice sync either.

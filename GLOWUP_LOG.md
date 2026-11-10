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
| Cormorant (draft, Meneer Frits 2022) | John Blek | `5df759c729c55db9` |  | **bar search** 11-10 | draft | ✅  |  |
| Cruel Summer | Bananarama | `d63697e5db3ca97a` |  | Soundslice |  |  |  |
| Curragh of Kildare | Bert Jansch | `af9f36d69555abb9` |  | Soundslice |  |  |  |
| Day is Done | Nick Drake | `429dc263a1d42287` |  | Soundslice |  |  |  |
| Don't need the sunshine | Catatonia | `e4060b7fe025c246` |  | Soundslice |  |  |  |
| Don't Think Twice, It's Alright | Bob Dylan | `067529d9b4042160` |  | Soundslice |  |  |  |
| Dust In The Wind | Sungha Jung | `e250217b3b865780` |  | Soundslice |  |  |  |
| Eleanor Rigby | Beatles (fingerstyle book) | `243e798f04b5ff1f` |  | no recording |  |  |  |
| Erwan | Meic Stevens | `2ba9acbdad27fe6b` |  | Soundslice |  |  |  |
| Every Breath You Take | The Police | `05fa6b889b0481b6` |  | Soundslice |  |  |  |
| Everybody Wants To Rule The World | Tears For Fears | `2b156138db0c7716` | ▶ | **fixed-order** 10-29 | 🟡 10-29 much improved; strings to check | 🟡 10-30 (bars 2–4 folded; the rest not yet) | — |
| Fast Car | Tracy Chapman | `10537b9c88cc5329` |  | Soundslice |  |  |  |
| Fields of Gold | Sting (Dominic Miller, trans. Serge Kottelat) | `18b7fb82180507ec` |  | **bar search**, 18 bars placed by hand, 11-03 | 🟡 | 🟡 |  |
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
| Strolling Down the highway | Bert Jansch | `4cc190c6b61e55f2` |  | **bar search** 11-08 (run 11) | 🟡 11-09 (owner's fixes; items open) | 🟡 11-08 (endings; heard, not yet watched) | 🟡 11-09 (all verses; not yet watched) |
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

### 2026-11-10 — Cormorant (John Blek) · `5df759c729c55db9`, `9b093e5a2114a1c3` deleted

- **One draft kept.** The two drafts, each checked against its own recording (MuScriptor on
  the INSTV7N instrumental, fixed order near the stored sync): Meneer Frits 94% of 979
  notes found by pitch class against 15% chance, 1 weak bar (137); Musicstar 90% of 935
  against 17%, 5 weak bars (54, 86, 103, 127, 137) and 4 s played past its last bar. Both
  were drafted from these recordings, so the numbers flatter both; the gap is the evidence.
  The Musicstar draft (`9b093e5a2114a1c3`) is deleted (restorable from studio's deleted list).
- **Sections** copied from the Musicstar draft: its bars match the Frits draft's ten bars
  later throughout (Frits has a longer intro), so Intro 1, Verse 13, Pre-chorus 42, Chorus 47,
  Instrumental 56, Verse 62, Pre-chorus 92, Chorus 97, Instrumental 105, Verse 112,
  Pre-chorus 125, Chorus 130, Outro 138 — checkpoint *Section marks (from the Musicstar draft)*.
- **Form**: the owner heard bars 1–3 as a false start before the song; they and the three
  empty bars at the end are removed (150 → 144 bars; the old bar 4 is bar 1, so every
  section mark is three bars earlier) — checkpoint *Song starts at the old bar 4; empty
  end bars removed*.
- **Sync** rewritten for the 144 bars: the same bar lines, three bars on (bar 1 at 50.10 s);
  free and fixed-order searches agree exactly. 94% of 971 written notes heard against 13%
  chance, 140 of 145 bar lines on a heard downbeat, one weak bar (134).
- **Form, written as played** (the owner's hypothesis, checked on the recording's own notes
  rather than the draft, whose passes were drafted by voting): the 29-bar "Verse 1" is two
  12-bar verses with a 5-bar link (bars 17 apart match 83% against 26% for any two bars);
  bars 10–59 and 60–109 are one 50-bar cycle played twice (84–88%); the last pass is one
  verse, Pre-chorus, Chorus (80%). Three section marks copied from the Musicstar draft were
  a bar early (Verse 2, the second Instrumental, Verse 3). Now one strain ×3: bars 10–59,
  with the link + second verse (22–38) a "1.2." ending, the Instrumental (52–59) a "1.2."
  ending holding `:|x3`, and the Outro after it (a "3." bracket there was dropped: the
  third pass skips the "1.2." ending and reaches it anyway) — 144 → 69 written bars, the player's
  order exactly the recording's 144. Where the passes' drafts differed, each written bar
  keeps the version that best matches every pass it stands for (pass 1 on ties; 10, 46, 47,
  59 from later passes), so 24 performed bars changed notes. The sync still fits as stored
  (verify: 94% of 973 notes against 13%) — checkpoint *Repeats: verse pairs and the cycle
  written once (144 → 69 bars)*.
- Open: still a draft — the notes are uncorrected; per-pass variations are gone with the repeats.

### 2026-11-09 — Strolling Down the Highway (Bert Jansch) · `4cc190c6b61e55f2` — pickup, notes, every verse

- **Notes** (revision 155, after the owner's fixes to bars 4 and 12 and the bar-13 triplet swap): 75% of written notes
  heard (was 74%), never heard 22 (was 25), every-pass extras 4 (was 6). Open for the owner's ear: bar 13's "on" chord
  heard with B3 in every pass (21.6 s); bar 11 beat 3 G3/C4 never heard (17.7 s); bar 10 "and" of 2 written E4, heard C4
  (15.8 s); bars 2 and 5 beat 3 C#4 never heard (1.3 s, 6.8 s); bar 14 beat 2 E4 (22.2 s); bar 3 "and" of 4 F#4 (3.8 s).
  Bars 1, 6, 8 (the bend), 16 and 18 explained and left.
- **Form**: bar 1 is now a pickup (`pickup` on the bar rung, revision 160 — [core-anacrusis](roadmap/complete/core-anacrusis.md)):
  4/4 drawn once, no 3/4 on bar 18, numbered from the first full bar. Bar numbers above are the written ones (pickup = 1).
- **Lyrics** (revisions 161–162), from the owner's text, placed on verse 1's syllable slots and checked against the
  separated vocal's per-bar loudness and onsets: pass 1 unsung (an empty row holds its place); pass 2 verse 1 + chorus;
  pass 3 verse 2 + chorus; pass 4 instrumental verse, chorus sung (bars 11–13, 16); pass 5 verse 3 with its own chorus
  ("No, the cars they won't stop…", bars 11–14); pass 6 verse 1 again + chorus; pass 7 unsung (faint vocal in bars 12–13,
  not in the text — humming or bleed). The chorus's "high-way" sits on bar 16 in the passes that take that ending.
  154 syllables; two simulated saves clean. "rock" stays on the owner's grace note at bar 11.
- **Found on the way**, all landed: the player skipped an empty verse row and a Guitar Pro save dropped it, moving every
  verse a pass early (b8d07db8); a syllable on a rest could not be edited (671ee203); a word hyphenated across a note
  its verse skips read back as two (888c7f13); a verse sung only on a grace note was not written at all (4c36c7d7).
- **Open**: the notes items above; bar 9's provisional triplet (owner's call); the lyrics want watching against the
  recording. The lyric panel does not show syllables on rests ("can you", "I", "stroll" …): they are kept, not lost.

### 2026-11-08 — Strolling Down the Highway (Bert Jansch) · `4cc190c6b61e55f2` — [run 11](tools/recording-align/RUNS.md#run-11--2026-11-08--strolling-down-the-highway-bert-jansch-a-singer-and-the-readers-own-bug-under-the-overfull-bars)

- **Sync**: voice separated (INSTV7N), bar search, first and last bar lines on heard downbeats. Rewritten after the
  endings changed: revision 149, 98 bars, 74% of written notes heard against 21% chance, 94 of 99 bar lines on heard
  downbeats, 124–138 bpm. Not yet watched.
- **Form**: the owner's alternative endings — passes 1 and 5 end on bars 14–15, passes 2, 3, 4 and 6 on 16–17, pass 7 on
  bar 18 (3/4). Each matched against the recording; the "1. 5." ending moved to start at bar 14 and bar 15 given
  `repeat end 7` (revision 148), at the owner's word.
- **Found on the way**: the "overfull" bars 9, 14 and 15 of the import were the Guitar Pro reader dropping triplets that
  open with sixteenths, not the transcription — fixed (62a59d40, 2cc4b811). The provisional checkpoint of the morning
  (*Provisional: bars 9, 14, 15 fit 4/4*) treated the symptom; bars 14–15 have since been re-entered by the owner.
- **Open**: bar 9 still carries the morning's provisional change — the original reads `3[A B A G]` then G "can you";
  restoring it is the owner's call. Notes check not done (weakest: bars 9–11 and 17 in pass 3). Lyrics: verse 1 only.

### 2026-11-03 — Fields of Gold (Dominic Miller, trans. Serge Kottelat) · `18b7fb82180507ec` — [run 10](tools/recording-align/RUNS.md#run-10--2026-11-02--fields-of-gold-dominic-miller-serge-kottelats-transcription-a-piece-from-the-screen-a-freely-played-intro)

A new piece, read off the score in Kottelat's video, 79 bars, no checkpoints beyond its first save. Synced (revision 2):
84% of written notes heard against 6% chance as the player plays it; 18 bars (1–13, 53, 76–79) placed on heard downbeats
because he plays them freely. Sync done but not yet watched. **Form** is 🟡 by the letter: the score's order is what he plays,
heard note by note, but the free search still reports departures in the free passages. **Notes** is 🟡: not yet checked by
the disagreements method. Open for the owner's ear: bar 8 (7.7–10.2 s), printed frets 4, 2, 1, heard 2, 1, 0; kept as printed.

### 2026-10-30 — Everybody Wants To Rule The World · `2b156138db0c7716` — the owner's manual pass begins

- Starts from revision 31 (*Tuning named as open D*); the owner's own edits follow it, the first to
  bar 1 (revision 34).
- **Form**: bars 2–4, the same bar written three times, folded at the owner's request into one bar
  repeated ×3 (revision 35, *Bars 2–4: the same bar written three times, now one bar repeated ×3*).
  108 written bars, still 110 performed. Checked on the stored file: every bar's position and every
  sounding note unchanged, no other bar differs, storage check clean, and both recordings' bar lines
  move by 0.
- **Bar numbers**: every bar from the old 5 on is now 2 lower (the 11/8 bar is 3, Verse 12, Bridge 44,
  Outro 100, the last bar 108). The entry below and run 9 use the old numbers, and the notes check's
  findings use open E♭ pitch names as well, a semitone above today's.

### 2026-10-29 — Everybody Wants To Rule The World (Gabriella Quevedo's arrangement) · `2b156138db0c7716` — [run 9](tools/recording-align/RUNS.md#run-9--2026-10-29--everybody-wants-to-rule-the-world-gabriella-quevedo-the-fixed-order-search) · wrapped up

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
- **Solo 2, 72–79, drafted** (revision 20) and banked by the owner unchanged: its own texture —
  an eighth-note figure on strings 2–3 (mostly C4/D4), melody notes over it, the open D♯2 pedal,
  slaps on 2 and 4 (found by the percussive measure; the drum transcription heard none here).
- **The interlude, drafted once from its three passes voting** (a note stands where 2 of 3 passes
  have it; revision 21) and written into 58–61, 62–65 and 92–95 alike; banked unchanged. Written
  once, it matches every pass: 16–23 of each bar's notes found. The whole score: 93% found (87%
  exact) against 41% chance, no weak bars. Heard in one pass only, so dropped: F4 on beat 3 of
  its bars 2 and 4, a D♯5 at its end.
- **The 4th chorus opening, 86–89, drafted** (revision 22) and banked: the chorus bass (F2 G2 G♯2
  G2) under a different top — A♯3+C4 restruck on the eighths, G4 and F4 above.
- **The outro, 104–109**: a redraft from the recording (revision 23) read as strumming — it was the
  transcriber re-reporting the whole ringing chord on every eighth, and the owner heard the opening
  riff; replaced by bars 8–13 again, bar for bar (revision 24, 87–100% of each bar's notes found).
  The owner then added slaps on 2 and 4 to bar 109.
- **The ending**: bar 109 slows into one chord at 238.29 s (open D♯2 A♯2 D♯3 under A♯3 D4 D♯4) that
  rings to the end of the video. Bar 110 is a 6/8 bar holding it — with the 6/8 pickup, one whole
  bar (the owner's reading) — and bar 111 is gone (revision 25); 110 bars. No fermata: Guitar Pro
  storage does not carry one yet. The sync was rewritten to 110 bars (`--shorter`, revision 26).
- **The bridge, 46–51**: a two-bar unit played three times, drafted from its passes voting; bar 51
  keeps the third pass's F-minor chord into the chorus (revision 28). The owner: bar 47's chord is
  up the neck, not open — the second bar of the unit refingered at frets 2–7 (revision 30). Sync
  rewritten for the bridge's bar lengths (revision 29).
- **Every bar is now written**: 93% of written notes found (87% exact) against 40% chance.
- **Wrapped up** (revision 30). The owner's verdict: *"much improved but some string selection
  issues i.e. pitch is pretty good but fingers are on different strings at different frets in some
  bars. This has been a great help but I'll need to go through it in more detail."* The drafted
  bars (46–51, 58–79, 86–89, 92–95) carry the fret step's guesses; their pitches and rhythm come
  from the recording, their strings do not.
- **The notes check** (all 110 bars, both ways, slaps included; 95% of 1790 written attacks heard)
  left unapplied for the owner's own pass. Heard in every pass, or all but one: C4 on beat 4 of
  chorus bar 4 (25 43 53 55 83 97 99); chorus bar 3's last bass eighth G2 not G♯2, and a C4 on beat
  2's second eighth (24 42 54 82 98); the G♯3+C4 chord on the downbeat of riff bars 7 9 11 (105
  107); C4 on beat 2 of 19 21 39; slaps on 13's beats 2 and 4, 31's and 6's beat 4. For the ear: a
  G♯3 inner voice through the choruses (22 40 80, 26 group, 52 96); bars 18/36's D4 downbeat and C4;
  slap-like beats 2 and 4 in intro bar 2. Dismissed as artefacts: grace notes heard a sixteenth off,
  bar 109's slowing, the interlude's light beat-2 slaps. The findings file and the session's tools
  are in `.scratchpad/glowup/` (not tracked).
- **Tuning named as open D** (DADF♯AD; revision 32), at the owner's wish — the commoner name for the
  same frets: every pitch a semitone down, frets unchanged, the library's tuning tag following. Her
  A=428 open E♭ is open D **+52 cents** (−47.9 from E♭). Published MNX, `_x.mnxLab` and the `.gp`
  storage carry no cents offset, so the synth plays 52 cents flat of the video; the offset belongs
  to the recording, not the score — to raise as a proposal. Re-running the analysis: retune the
  audio −52 cents (to D at A440), not +48.
- **Not done**: repeats (the interlude ×3 and the bridge unit ×3 are written identically, ready to
  fold; the owner's rule — merge passes a note apart); the final sync on the finished score — the
  current one already covers all 110 bars with every bar's beats matching.

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

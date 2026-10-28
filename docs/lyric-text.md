# Lyric text entry

Shift+L opens the right-hand lyric panel in studio and workbench. The score narrows
to keep the panel beside it, between the toolbar and playback tray. The text is a projection
of the event lyrics, with live preview. There is no apply: the text is committed
when typing pauses for 3 seconds, when the box loses focus, when the panel closes
(another panel opening closes it), when Play starts and when the page is hidden.
All the commits of one visit to the panel are a single undoable edit.

Text with problems still draws and commits the words that found their notes.
The words that spill past a bar line are left out (the bar line holds, so the
next word starts in the bar it names), and so are words past the end of the
music. One slip puts every later bar out of step, so the first spill is the one
problem reported, and it counts the later bars the slip reaches. While problems
stand, studio also keeps the whole text as a draft on the device (per piece,
part and voice), and the panel offers it back the next time it opens. Play
leaves the panel open, read-only, until the music pauses.

The caret is the editor's cursor. Clicking or arrowing onto a word moves the one
cursor to that word's note on that visit, and the playback cursor with it; while
playing, it seeks. The panel draws no cursor of its own; the word the cursor is
on is outlined, as the score outlines a selected element.

## Where the words are

The text is in the order the words are sung, and **names no bars**. It runs
from the first bar played: `|` is the next bar played, and `×4` (or `x4`, as
typed) is four bars nobody sings, standing where a bar starts. Newlines are
whitespace, so a line can be re-wrapped or pasted without moving anything.
A `|` after the last bar closes the piece; only one beyond that is an error.

The margin beside the text says where each line starts, worked out live from
the bar lines as you type: the **bar played** (counting every pass and jump
from 1), and that bar's **bar of the score and pass** — `26 (10.3)` is the
26th bar played, bar 10 the third time through. Hovering a label says so in
words; clicking it takes the caret, and the score's cursor, to the line's first
word. The labels sit on a rail: a dot per line, hollow for a line that only
crosses empty bars, and the rail dashed where a line ends on bars nobody sings.

```
   1 (1.1)  ×16 |
  17 (9.1)  _____ I | could-a been a_ sail- | -or | ___ could have |
  21 (9.2)  been a cook | ×4 |
  26 (10.3) _ a real live | __ lover | ___ could have |
  29 (9.4)  been a book | ×4 |
```

The generator ends each line on the bar line after its last bar, so every line
opens on a word, and the label is that word's bar. Bars nobody sings close the
line before them as one run (`| ×4 |`); a lead-in stands on a line of its own
(`×16 |`); trailing silence is left off. It starts a new line at repeats and
jumps, and wraps at four bars or before the next bar would pass 80 characters.
A single long bar stays intact. A `|` added anywhere nudges every word after it
along by a bar, and taking one out brings them back.

A **section line** (`[V2 Verse]`) names where a section of the score begins:
the generator writes one wherever a pass into a section starts, on a line of its
own after the bar line that leads into it, splitting a run of empty bars that
the section starts inside. Section lines are the panel's, not the typist's: at
each commit (and when a draft is offered back) they are taken out and written
again where the bar lines now put each section. A section line moves no
word, so a pickup sung before the section's first bar stays on the line above.

The text is painted beneath a transparent text box: words in ink, and the marks
that place them — bar lines, skips, runs, the hyphens and underscores inside a
word — faded back.

## Aligning words

Spaces separate syllables. `-` splits a word; extra hyphens skip intervening
notes (`fant--as-tic`). `_` skips a sung position; suffix underscores do the
same (`day__ next`). `you~are` puts two words on one event. Rests, grace notes,
and tie continuations are skipped automatically. The source does not
explicitly distinguish a held syllable from an untexted event; generated
hyphens/underscores describe placement, not a new stored melisma property.

Pasted plain text flows onto the notes in the order it is sung, from the first
bar played; put `×16 |` in front of it to skip a sixteen-bar intro. Bar numbers
(`9.1|`, `6|`) are not part of the text; the parser names one if it finds it.

## Stored rows, languages, and shared words

Navigation supplies each visit's **verse**, and that selects a stored row within
the language group: a visit sings one past the row its bar's previous visit
sang, or its repeat iteration if that is further on (a second ending reached on
pass 2 sings row 2). So verses keep counting through a D.S./D.C. return, where
the repeat iteration starts over. A verse with no stored row is **unsung** —
it generates no text and lights nothing in playback, exactly as the player
shows it; typing words at that place creates the row. (Until 2026-10-18 a
return re-sang row 1, so deleting a return's line silently did nothing: the
user's call, on *One Of These Things First*, was that unwritten returns are
unsung. The cost: a repeat written once under `×2` now sings once.) A **header line** starts another block of text,
from the first bar played again: `2:` writes stored row 2 wherever its words
fall, `nl:` the Dutch rows by each visit's verse, `nl 2:` Dutch row 2. Headers
keep hymn verses and other rows that no pass sings:

```
Shine bright
2:
Morn-ing
```

New rows are declared in the document only where their words alone would not
keep them — an empty row holding a later one's number, or an order the row ids
would not sort into — because a Guitar Pro save cannot store a declaration.

Two blocks can name one stored syllable, and conflicting assignments are
diagnosed rather than silently choosing the last one. Two mistakes look alike
here and are told apart, each named once:

- **A verse two blocks write differently at one place** is named on the later
  block: *verse 1 at 1.1 is written twice, differently — in the main text and
  under “1:”; keep one.* The same word twice is no mistake.
- **Two passes of a bar that sing the same verse row** store one set of words,
  so they must agree: *1.2 sings “different” and 1.1 sings “changed”, but both
  are verse 2 of the same written notes…*

Lyrics on events never reached by navigation are retained when committing this
surface, as are lyrics outside its staff-1 first-voice walk.

## Design record

The user's requested contract (2026-10-18):

> always start a new line with a <bar number>. <pass>
> use pipe char for bar lines
> have some rules over how many bars/chars before a new line

The agreed `.pass` is a continuously counted occurrence of that written bar;
repeat and D.S./D.C. origins are derived from navigation. Four bars / 80
characters are the canonical wrapping defaults. Sparse storage is unchanged.

Anchors went from every line to a run's first on 2026-10-19. Every wrapped
line used to be anchored, so one more `|` pushed a line's last words into the
next line's bars and collided. Offered anchors at section boundaries instead,
the user chose to anchor only where the flow breaks:

> I'd like to try "Only where the flow breaks". I think the section boundaries
> sound appealing but often lyrics start the bar before the chorus/verse so it
> would be brittle. I'm hoping that if everything is "nudged along" incorrectly
> it will be easy to "nudge it back" by removing a gap later.

Anchors went altogether on 2026-10-20, with the margin taking over saying where
a line is. The owner found the anchored text confusing — `10.3` beside a line
named its first word's bar, not where the line began — and asked for change:

> I find the current editor confusing so I am open to change - but I want
> something clearly better.

> Lets say that there is still a line marker but the format is "{performance
> bar number} (score bar number.passNumber}) with a hover text to explain what
> these 3 mean.

Considering pinned and unpinned markers, they asked whether a pin would survive
a save and reopen; it would not (the text is regenerated from the notes, which
are stored as Guitar Pro) — "Lets remove pinning entirely." Of the
hover text's closing "This line starts here": "This is obvious after its made
true so we don't need to say it". Of four mocked-up margins (quiet, stacked,
faded syntax, rail) they chose the rail, with the faded text. A verse no pass
sings became a header line restarting from the first bar played, and plain
pasted text sung order from the first bar played, retiring the verse-per-line
reading — both the recommended options.

The apply button went on 2026-10-19, after unapplied text was lost to a page
reload. The user's direction:

> Do you think we could go one step further and remove the apply button
> altogether? I.e. like most things changing is enough for state to get
> written locally.

and, on the proposed one-second pause, "1s pause seems quite small", so the
pause is 3 seconds (`LYRIC_COMMIT_PAUSE_MS`). The save session already batches
its local writes, so a commit costs one recovery write, not one per keystroke.

Section lines became the panel's on 2026-10-28. They had been written only when
the text was generated, so a draft typed bar by bar kept its section lines where
they had been typed, and the panel showed `[V1 Verse]` above words that the tray
placed in the third pass of the verse. The owner:

> I was hoping that these sections would be inserted automatically based on if a
> bar has a section name

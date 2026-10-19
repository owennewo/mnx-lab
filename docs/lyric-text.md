# Lyric text entry

Shift+L opens the right-hand lyric panel in studio and workbench. The score narrows
to keep the panel beside it, between the toolbar and playback tray. The text is a projection
of the event lyrics, with live preview. There is no apply: the text is committed
when typing pauses for 3 seconds, when the box loses focus, when the panel closes
(another panel opening closes it), when Play starts and when the page is hidden.
All the commits of one visit to the panel are a single undoable edit.

Text that does not parse cannot be committed. The panel says so beside the
diagnostics, and studio keeps it as a draft on the device (per piece and part)
that the panel offers back the next time it opens. Play leaves the panel open,
read-only, until the music pauses.

The caret is the editor's cursor. Clicking or arrowing onto a word moves the one
cursor to that word's note on that visit (`9.5|` is not `9.1|`), and the
playback cursor with it; while playing, it seeks. The panel draws no cursor
of its own. Anchor-free legacy text has no visit, so its caret moves nothing.

## Performance anchors

A run of text starts at a `bar.occurrence|` anchor. `9.2|` means the second
actual visit to written bar 9, regardless of whether a repeat or a D.S./D.C.
return caused it. It is not verse 2, nor performance bar 9. Alternate endings
count actual visits too: the first visit to a second ending is `.1`.

**Only a run's first line is anchored.** Every later line opens on the `|`
that carries the words on into the next bar, and the margin beside it names
where it lands, live, as you type:

```
       9.1| _____ I | could-a been a_ sail- | -or | ___ could have
  9.2  | been a cook
 10.3  | | | | | _ a real live | __ lover | ___ could have
  9.4  | been a book
```

So a `|` added inside a run nudges every word after it along, through the
following lines, and taking one out (there or further on) brings them back.
Nothing is pinned but the run's start: an anchor you type yourself holds until
the panel next opens, when the text is written out again from the notes.

A bare `|` advances one bar in performance order, including bars without sung
notes. `| |` crosses an empty bar. Anchors may also appear within a line.
The generator starts at the first texted bar, omits trailing empty bars, and
keeps empty bars between texted bars as pipes — up to four; a longer silence
ends the run, and the next words start a new, anchored one. It starts a new
line at repeats/jumps and wraps at four bars or before the next bar would
exceed 80 characters, without an anchor.
A single long bar remains intact. Newlines within an anchored passage are
whitespace, so pasted phrase breaks do not create verses.

## Aligning words

Spaces separate syllables. `-` splits a word; extra hyphens skip intervening
notes (`fant--as-tic`). `_` skips a sung position; suffix underscores do the
same (`day__ next`). `you~are` puts two words on one event. Rests, grace notes,
and tie continuations are skipped automatically. The source does not
explicitly distinguish a held syllable from an untexted event; generated
hyphens/underscores describe placement, not a new stored melisma property.

The parser accepts older unanchored verse-per-line text, including `6|` and
`nl 2:` headers, for paste compatibility. Once using occurrence anchors,
use `6.1|`, not `6|`. Reopening generates the new canonical form.

## Stored rows, languages, and shared words

Navigation supplies each visit's **verse**, and that selects a stored row within
the language group: a visit sings one past the row its bar's previous visit
sang, or its repeat iteration if that is further on (a second ending reached on
pass 2 sings row 2). So verses keep counting through a D.S./D.C. return, where
the repeat iteration starts over. A verse with no stored row is **unsung** —
it generates no text and lights nothing in playback, exactly as the player
shows it; typing words at that anchor creates the row. (Until 2026-10-18 a
return re-sang row 1, so deleting a return's line silently did nothing: the
user's call, on *One Of These Things First*, was that unwritten returns are
unsung. The cost: a repeat written once under `×2` now sings once.) An optional header **after** the anchor can explicitly
select a language and/or stored-row ordinal: `9.2| nl: …` or `1.1| 2: …`.
The latter preserves hymn verses and rows that navigation does not select;
use it also when adding a new row to a score that already has lyrics.

Two anchors can still name one stored syllable — by an explicit row header —
and conflicting assignments are diagnosed, rather than silently choosing the
last one. Two mistakes look alike here and are told apart, each named once:

- **A passage that runs on into the next anchor** (one more `|` pushed its
  last words into bars the next line writes) is named on its own line, with
  the words that ran on: *18.3 runs 6 syllables on into 20.3 (“been the end I
  could be”)…* — move them into that line, or delete its anchor to let the text
  flow on.
- **Two passes of a bar that sing the same verse row** store one set of words,
  so they must agree: *1.1 sings “changed” and 1.2 sings “different”, but both
  are verse 2 of the same written notes…* Lyrics on events never reached by navigation are retained
when committing this surface, as are lyrics outside its staff-1 first-voice walk.

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

The apply button went on 2026-10-19, after unapplied text was lost to a page
reload. The user's direction:

> Do you think we could go one step further and remove the apply button
> altogether? I.e. like most things changing is enough for state to get
> written locally.

and, on the proposed one-second pause, "1s pause seems quite small", so the
pause is 3 seconds (`LYRIC_COMMIT_PAUSE_MS`). The save session already batches
its local writes, so a commit costs one recovery write, not one per keystroke.

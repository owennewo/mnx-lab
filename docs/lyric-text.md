# Lyric text entry

Shift+L opens the right-hand lyric panel in studio and workbench. The score narrows
to keep the panel beside it, between the toolbar and playback tray. The text is a projection
of the event lyrics, with live preview; Ctrl+Enter applies one undoable edit.
Closing without applying discards the draft.

## Performance anchors

Every generated line starts with `bar.occurrence|`. `9.2|` means the second
actual visit to written bar 9, regardless of whether a repeat or a D.S./D.C.
return caused it. It is not verse 2, nor performance bar 9. Alternate endings
count actual visits too: the first visit to a second ending is `.1`.

```
9.1| _____ I | could-a been a_ sail- | -or | ___ could have
9.2| been a cook
10.3| _ a real live | __ lover | ___ could have
9.4| been a book
```

A bare `|` advances one bar in performance order, including bars without sung
notes. `| |` crosses an empty bar. Anchors may also appear within a line.
The generator starts at the first texted bar, omits trailing empty bars, and
keeps empty bars between texted bars. It starts a new line at repeats/jumps
and wraps at four bars or before the next bar would exceed 80 characters.
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

Navigation supplies the repeat iteration; that selects a stored row within
the language group. As with playback, an iteration beyond the existing rows
reuses the first row. On a score with no lyrics, entry creates rows for the
iterations encountered. An optional header **after** the anchor can explicitly
select a language and/or stored-row ordinal: `9.2| nl: …` or `1.1| 2: …`.
The latter preserves hymn verses and rows that navigation does not select;
use it also when adding a new row to a score that already has lyrics.

Later returns can share the same stored syllable. Their generated text is
repeated in performance order; conflicting assignments are diagnosed, rather
than silently choosing the last one. Change all appearances consistently;
to remove a shared syllable, remove all its appearances. The document still
stores it only once. Lyrics on events never reached by navigation are retained
when applying this surface, as are lyrics outside its staff-1 first-voice walk.

## Design record

The user's requested contract (2026-10-18):

> always start a new line with a <bar number>. <pass>
> use pipe char for bar lines
> have some rules over how many bars/chars before a new line

The agreed `.pass` is a continuously counted occurrence of that written bar;
repeat and D.S./D.C. origins are derived from navigation. Four bars / 80
characters are the canonical wrapping defaults. Sparse storage is unchanged.

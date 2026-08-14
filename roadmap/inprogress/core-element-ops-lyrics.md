# Lyrics — text entry without a mode

> **Status: built 2026-08-14.** Campaign:
> [core-campaign-element-ops.md](core-campaign-element-ops.md), item 12.

## The agreement block

### 1. The op pairs — two, because the owners differ

| owner | kind | construct | destruct |
|---|---|---|---|
| the **event** | `lyric` (a syllable on one line) | `setSyllable {noteKey, line, text, syllableType?}` | `removeSyllable {noteKey, line}` |
| the **document** | `lyric-line-metadata` (a verse's label and language) | `setLyricLine {line, label?, lang?}` | `removeLyricLine {line}` |

Item 7's test, for the fifth time, and again it says *split*: a syllable belongs
to an event, a verse's identity belongs to the score.

**Removal class: annotation** — strip the key, and the emptied `lines` map, the
`lyrics` wrapper and `global.lyrics` go with it. One thing removal deliberately
does **not** touch: `lineOrder`. Where a verse *sits* is a separate declaration
from what it is *called*, so removing a label must not silently reorder the
verses. (The sweep caught the first version doing exactly that.)

### 2. The shortcut — `Shift+L`, and no mode

The index proposed "a text *mode* that suspends the keymap". **Rejected**: a
syllable is one short string attached to one note, and the campaign already has
a surface for typing one short string — the popover. A mode would mean a second
input state to enter, leave, and explain, plus a keymap-suspension mechanism
that nothing else needs.

The grammar keeps a singer's own notation for how syllables join:

```
sleep-        a word starts here      → type: start
-ing          a word ends here        → type: end
-ly-          a word continues        → type: middle
2: Am         verse 2 (default is 1)
line 2 Nederlands nl                  label + language for a verse
no lyric · no lyric 2 · no line 2
```

### 3. The rung — note (syllables) and score (verses)

A syllable attaches to the note under the cursor. A verse's metadata is
document-level and needs no cursor at all, which is what makes it the second
kind (after part declarations) whose **address is the document itself**.

### 4. The evidence

- **Destruct**: 34 elements (lyric 28, lyric-line-metadata 6) move `no-op` →
  `removed`.
- **Construct**: 4 scenarios were blocked only by these kinds
  (`spec/lyrics-basic`, `spec/lyrics-multi-line`, `spec/lyric-line-metadata`,
  `lab/lyrics/verse-labels`). Reachable scenarios 78 → 82.
- Goldens byte-identical.

## Scope boundary

Part names, verse *labels* and directions are all "text in a score", but only
the last two are lyrics; part names landed with the part declarations (item 13)
and directions with the adornments (item 8). What remains genuinely unbuilt is
**score-level text** — titles and composer lines — which MNX has no home for yet
([spec-score-text.md](../proposed/spec-score-text.md) is the argument upstream),
so there is nothing to write and nothing to strip.

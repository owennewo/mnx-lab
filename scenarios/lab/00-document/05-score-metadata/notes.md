# Score metadata

## What this pins

That a document can say what it is. MNX v27's root object admits `mnx`, `global`,
`parts`, `scores`, `layouts` and the universal `_c`/`_x`/`id` — and nothing else. There
is no title, no composer, no rights and no encoding provenance anywhere in the schema's
193 `$defs`. The only name-like strings are `part.name`, `part.shortName` and
`score.name`, and the last of those names a **layout** ("Full score", "Guitar part"),
of which one document may have several.

So this scenario carries both blocks at once:

- **`work`** — title, subtitle, artist, album, four typed `creators`, copyright, source
  and notes. Every field, so any consumer has one document that states all of them.
- **`encoding`** — software, version and date: what wrote *this file*.

## Why the engraving looks untitled

Because it is. The printed `score-title` primitive comes from `scores[].name`
(`src/engine/layout/notation.ts`), and nothing in the layout engine reads `work`.
Whether a document's own title should be printed when a score declares no name is a
real engraving question, and deliberately not this scenario's: it would move goldens,
and this is data plumbing. The goldens here are therefore the plain one-note ones, and
a change to them means something read `work` that should not have.

## Where the fields come from

Each one is chosen so that the four formats round-trip through it
(docs/mnx-extensions.md § Format mapping):

| Field | MusicXML | MuseScore | Guitar Pro |
|---|---|---|---|
| `title` | `work-title` | `workTitle` | `Title` |
| `subtitle` | `credit-type="subtitle"` / `movement-title` | `subtitle` | `SubTitle` |
| `artist` | — (`creator type="artist"`) | — | `Artist` |
| `album` | `miscellaneous-field` | — | `Album` |
| `creators[]` | `creator type` | `composer`/`lyricist`/`arranger` | `Music`/`Words`/`WordsAndMusic`/`Tabber` |
| `copyright` | `rights` | `copyright` | `Copyright` |
| `source` | `source` | `source` | — |
| `notes` | `miscellaneous-field` | any custom tag | `Instructions` + `Notices` |

`artist` and `album` are the tab world's addition — Guitar Pro leads with them, and
neither of the other two formats has a native home. `artist` is flat rather than a
`creators` role because a performer is not a creator of the work.

## The `arranger` credit is the deliberate awkward one

Guitar Pro has no arranger field, so an export warns and drops it rather than filing it
under a role that means something else. That is the honest lossy cell, and it is here so
the corpus contains one.

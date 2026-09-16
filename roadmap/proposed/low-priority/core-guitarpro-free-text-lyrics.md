# Guitar Pro free-text lyric recovery

**Status:** proposed, low priority — parked 2026-09-16 after inspecting the cached
“Kind Hearted Woman Blues” source.

## The source problem

The Guitar Pro file contains a track named `Lyrics`, but that track carries none of the
words. All 47 word fragments are `FreeText` annotations on beats in the `Steel Guitar`
track, mixed with genuine directions such as “Tune down 1/2 step and capo 2nd fret to be
same key as recording”. The file contains no formal GPIF `Lyrics` entries. Its MusicXML
export likewise represents the words as directions rather than lyrics.

The importer therefore cannot determine from source structure that “got a kind”,
“hearted woman”, or “Makes mister Johnson drink” are lyrics. Importing them as above-staff
directions is faithful; converting them automatically to MNX lyrics would be a heuristic.

## Trigger

Pick this up when a second real source exhibits the same pattern, or when lyric recovery
becomes important enough to accept a source-specific heuristic. Do not special-case this
one title.

## Candidate investigation

- Test whether the combination of an otherwise text-empty track named `Lyrics` and
  phrase-like `FreeText` on another track is a reliable signal across a larger GP corpus.
- Separate prose-like lyric fragments from performance directions without treating an
  English-language classifier as truth.
- Decide how phrase fragments map onto timed lyric events. These annotations contain
  whole phrases rather than one syllable per note, so merely changing the MNX object kind
  would still produce misleading attachment and spacing.
- Keep the original text and placement recoverable whenever classification is uncertain.

## Acceptance evidence

- A corpus fixture representing this malformed encoding, without depending on the private
  Soundslice cache.
- At least one contrasting fixture where beat `FreeText` is genuinely a direction.
- Round-trip and engraving checks showing that recovered lyrics attach to the intended
  events and no longer compete with above-staff directions.

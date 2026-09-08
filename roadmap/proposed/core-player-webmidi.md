# WebMIDI out — the export's channel plan, on the wire

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](../inprogress/core-campaign-player.md), item 11. Needs item 7. A
> practice item.

## Agreement block (campaign contract)

- **Pure before audible (§1).** A second `Sink` in `src/audio/midi/` behind the same
  transport; the transport does not change.
- **Proof (§4).** Messages captured through a fake `MIDIOutput` and diffed against item
  5's file for the same document — same allocation, same bend range, same quantisation,
  so the wire inherits the export's preflight allocation and degradation: reserved
  per-part channels, independent curves omitted on fallback parts, refusal when the
  minimum allocation does not fit, ±12 semitone bends and quantization diagnostics.
- **Dependencies (§5).** None — Web MIDI is a browser API (Chrome, Edge; Firefox
  behind a site permission).
- **Practice gain.** A real instrument with zero assets shipped.

## Design

- **Never the default**: offered after the user chooses it and grants permission; a
  session with no device shows nothing. A reviewer with no synth is never met with
  silence.
- The transport uses its injected clock even with MIDI as the only sink; no
  AudioContext is required. [Web MIDI](https://www.w3.org/TR/webmidi/) output timestamps
  are DOMHighResTimeStamp milliseconds
  relative to the performance time origin. Convert clock seconds through an explicit
  sampled clock-origin mapping when an audio clock is in use; never pass audio seconds
  directly as MIDI timestamps. Re-anchor after clock suspension/resumption.
- Seek/rate change first invalidate scheduler generations and call `MIDIOutput.clear()`
  to remove future queued messages, then send sustain-off, all-notes-off/all-sound-off
  and bend reset on allocated channels before reconstructing controllers and notes.
  All-notes-off alone cannot prevent a previously queued future note-on.
- Fake-output tests cover pending future attacks across seek, stale scheduler callbacks,
  nonzero clock origins, unit conversion and MIDI-only playback. Use a session-owned
  output queue: clear/reset must not disrupt another player sharing that output.

## Start condition

The dependencies named above are technical prerequisites. Campaign clause 7 additionally
requires reviewer items 1–10 to be verified before this practice item starts.

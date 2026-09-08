# WebMIDI out — the export's channel plan, on the wire

> **Status: proposed 2026-09-08, revised the same day.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 11. Needs item 7. A
> practice item.

## Agreement block (campaign contract)

- **Pure before audible (§1).** A second `Sink` in `src/audio/midi/` behind the same
  transport; the transport does not change.
- **Proof (§4).** Messages captured through a fake `MIDIOutput` and diffed against item
  5's file for the same document — same allocation, same bend range, same quantisation,
  so the wire inherits the export's stated bounds (16 channels, per-part fallback,
  ±12 semitone bends, clips reported).
- **Dependencies (§5).** None — Web MIDI is a browser API (Chrome, Edge; Firefox
  behind a site permission).
- **Practice gain.** A real instrument with zero assets shipped.

## Design

- **Never the default**: offered after the user chooses it and grants permission; a
  session with no device shows nothing. A reviewer with no synth is never met with
  silence.
- The transport's window pass sends with `timestamp`, so the browser schedules — and
  the UI still follows the audio clock (§8), not the send.
- Seek and rate change send all-notes-off and re-send controller state per item 6's
  reconstruction rule.

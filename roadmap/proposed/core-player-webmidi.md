# WebMIDI out — the same events, to a real instrument

> **Status: proposed 2026-09-08.** Campaign:
> [core-campaign-player.md](core-campaign-player.md), item 10. Needs item 7. A
> practice item: the reviewer already has sound.

## Agreement block (campaign contract)

- **Pure before audible (§1).** A second `Sink` implementation in `src/audio/midi/`,
  behind the same transport. Nothing in the transport changes.
- **Proof (§4).** The bytes on the wire are item 4's MIDI file's events in real time,
  so the file's round-trip test already covers the encoding; the sink's own test
  captures messages through a fake `MIDIOutput` and diffs them against the file.
- **Dependencies (§5).** None — Web MIDI is a browser API (Chrome, Edge; Firefox
  behind a site permission).
- **Reviewer gain (§7).** None; **practice gain**: a guitarist with a hardware or soft
  synth hears a real instrument, with zero assets shipped.

## Design

- One channel per string, bend range RPN sent on connect, channel 10 for kits — the
  channel plan item 4 already fixed for the file, so a document sounds the same from
  the file and from the wire.
- **Never the default.** The player element offers the output only after the user has
  chosen it and granted permission; a session with no MIDI device shows nothing.
  A reviewer with no synth must never be met with silence.
- Latency: WebMIDI has no lookahead clock of its own; the transport's window pass
  sends with `timestamp` so the browser schedules — the same two-clocks pattern.

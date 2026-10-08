# Synth 0.2.0 (local release)

Promoted from 0.2.0-rc.4 on 8 October 2026 with the lead's approval, after the release gate
and the lead's listening pass. **Local use only:** nothing is published to npm or any remote,
and distribution needs the notices review in THIRD_PARTY_NOTICES.md. 0.1.0 is retired.

0.2.0 is a fresh start with no compatibility with earlier versions: contract
`mnx-sound/2` (setups with ordered effect chains, channel strips, return buses and a
master), rig 3.0.0 session files, new browser storage keys. Earlier rigs, saved
sessions and designs are not read.

- **Instruments:** physically modelled guitar (one to six strings, ukulele included);
  basic keys and kit (correct behaviour and bounded levels only). Designs and layouts
  play at one loudness as heard (A-weighted model); each design has a Level trim.
- **Effects:** drive, vibrato, tremolo, echo as independent blocks in any order,
  On or Off (Off passes the signal and lets the tail ring out, then costs nothing);
  a Room return bus; a master with a peak limiter.
- **Stream:** the music carries what is played: notes and techniques, a session-wide
  `tempo` control (the echo follows it) and chord `gesture`s (strum by stroke, roll by
  pitch; the guitar strums in string order). The synth has no player-feel settings.
- **App:** one page, chain first: lanes per part into the mixer, block editors with
  Reset, undo/redo, A/B compare. A library of 13 short named pieces: the Piece picker
  changes only the music; Session → Examples loads a piece with its setup; an Inspect
  panel holds diagnostics, note labels, checks and the test fixtures. Saved sessions
  remember their piece; "Export what I'm hearing" writes an event log.

Since rc.3/rc.4: the Examples menu's items no longer overlap; a test race fixed.

Since rc.1:
- Looping material no longer reports `gesture-mismatch`: repeats keep each chord's
  gesture, and each legato chain, within its own iteration.
- Bypass and Off are one Off.
- Material and the fixture player are combined into pieces and examples on one page.
- **Speed:** the multi-part reference session renders at about 11× real time in a
  browser offline (Node about 12×); keys and kit idle pieces cost nothing.

## Known limitations

- Live callback deadlines are tracked, not guaranteed; offline speed is not proof of
  dropout-free playback on a given device.
- Loudness is matched by an A-weighted model; the darkest designs (soft nylon, muted
  jazz, dry small) reach it with brief master limiting on dense strums.
- Very bass-heavy designs (rounded steel) carry little above 250 Hz, so they stay
  quiet on laptop speakers.
- Node consumers need Node 22 or newer; compiled WASM is included, so FAUST is not
  needed. Browser audio needs a secure context (HTTPS or localhost) and AudioWorklet.

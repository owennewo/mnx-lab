# Mix layers: a recording, the synth and a click, together

> **Status: in progress 2026-10-22.** Designed in conversation on 2026-10-22 on the
> *Mix panel: recordings as channels* canvas
> (https://claude.ai/artifact/Am8a3S1z8wpfvxQM6yp2h5); the chosen board is *Without M and S:
> toggles and levels only*. Built 2026-10-22, awaiting the owner's hands-on check (by ear: does
> the synth sit on the video's beat?). Supersedes the Mix panel's "Play from" radio list and its
> parts' M and S (the Mix panel of 2026-10-16), and the loop options' *Click through the loop*
> ([studio-player-practice.md](studio-player-practice.md)).

## The owner's directions (2026-10-22)

- *"I have an idea that recordings are treated like any other channel i.e. they look similar
  and can be muted/unmuted. If unmuted then youtube panel has to be shown (terms of use). some
  items need a settings/edit some do not. All should have volume and mute"* — and *"It should
  be possible to play recording (e.g. youtube) and synth instruments at the same time! This is
  not currently possible so this is more than just a ux change"*.
- *"I like the idea of Tray 3 - quick toggle for synth/recording on/off - however this needs to
  work in conjunction with the contents of the tray. Also can the click track be added to the
  mixer."*
- *"perhaps it should say "Recordings" not "Video" - also can this header have the + (to add a
  recording)"*; *"In the tray - I think I only want space for an icon - maybe the icons can be a
  little bigger"*; *"I think the click row should look more similar to synth instrument"*.
- *"I don't think we should say the "sets the time" in header or "time follows" and "plays
  along with the video" - its noise"*; *"I'd like to see the slider volumes all a similar
  length"*; *"Most pieces have a single recording so if it is the case then it doesn't need to
  have the option selector circle"*.
- *"lets go for the "without m and s" option"*.

## What is built

**Three layers, one switch each.** The tray's Mix field is three icon toggles — the
recording, the synth, the click — and the master level, which opens the panel. The panel's
three sections are headed by the same three toggles, so the two never disagree. A toggle is
the layer's on/off; levels live in the panel.

- **Recording** on: the chosen recording plays and *leads* — its clock is the score's — and a
  YouTube video is shown (YouTube's terms: never played hidden). Off: the video is gone and the
  synth's transport leads. One recording at a time; the radio list to choose it appears only
  when the piece has more than one. Its row carries a level and its edit (the second line).
- **Synth** on: every part sounds. While a recording leads, the synth *follows* it: each note's
  time is mapped through the recording's sync, so the parts play in the recording's tempo
  (`src/audio/mediaFollow.ts`). Off: the parts are silent (the transport still runs the cursor
  when nothing else leads). Each part: the eye (score visibility), its instrument, its level.
  No mute or solo: the toggles and levels are the whole mix (old stored mutes and solos are
  ignored).
- **Click** on: a click on every beat (the bar's meter; the downbeat accented), wherever the
  time comes from — the synth's transport, or the recording's sync. It replaces the loop
  options' *Click through the loop*; the count-in stays a loop option.
- **Master**: the tray's volume, under everything.

The rate follows whatever leads: while a YouTube video leads, Rate offers YouTube's steps.

## Where it lives

- `src/audio/practice.ts` — `beatGrid`: every beat of the performance, as performance and
  score positions.
- `src/audio/mediaFollow.ts` — the warp (synth seconds → recording seconds, sampled through
  the sync) and `MediaFollower`, which supplies a host from a media clock reading.
- `src/audio/hostBackend.ts` — `setLayers` (synth and click levels, the click's beats) and
  `follow` (the follower, on the same host, routing and part mix).
- `src/audio/recordingBackend.ts` — `setLevel`, the recording's level under the master.
- `src/elements/Player.ts` — the tray's toggles; the companion synth that follows a recording.
- `apps/studio/src/MixSheet.ts`, `PiecePage.ts` — the panel and the stored layers (piece
  preferences: `layers`).

## Checked

- `harness/conformance/mix-layers.test.ts`, on the real synth core: the beat grid; the click on
  every beat on the synth's clock with no loop; levels switching the click; the warp (a recording
  that waits 3 s then plays at half speed); the follower — every note once at the recording's
  time and twice as long, a seek taking back what was sent and restarting at bar 7, a pause
  silencing it.
- In a browser on a real YouTube recording with 66 sync points: the synth's and the click's
  outputs both sounding while the video plays (measured at their gains, not heard); the recording
  toggled off mid-play hands over to the synth at the same bar, the video closing; the synth and
  the click switching off and on instantly mid-play.
- The studio smokes, adapted: the layer toggles, a part's level, the click reaching the tray.

## Open

- **By ear.** How tightly the synth sits on a YouTube recording is the sync's accuracy plus the
  difference between the iframe's audio path and the synth's; neither has been heard. If the
  synth runs consistently early or late, a fixed offset belongs in `MediaFollower` (it has none).
- A recording with no usable sync plays alone: the panel says the synth and the click wait for a
  sync. A recording's intro and outro (outside its anchors) have no synth either.
- The sync bar's own click (while editing a sync) is separate from the click layer; both on, both
  sound.

## Learnings

- **Notify loops.** A backend that notifies when set, called from the session's notify handler,
  re-enters it: what is applied must be noted *before* acting (`Player.applyLayers`), and a level
  change that changes no snapshot field should not notify at all.
- **The follower is the click track generalised.** `ClickTrack` already fitted a line through a
  jittery media clock and scheduled each beat once; following with notes needed the same estimate
  plus a restart rule (drift past 0.25 s, a rate change, a pause) and a sustained-note re-strike.

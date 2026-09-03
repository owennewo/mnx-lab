#!/usr/bin/env python3
"""Generate the feature-scoped GP5.00/5.10 clean-room reader fixtures.

Run from the repository root with:
  uv run --with PyGuitarPro python converters/fixtures/tools/make-gp5-basics.py

The values are stated here through PyGuitarPro's public model API. The reader
does not import PyGuitarPro; it is only a dev-time fixture writer.
"""

from pathlib import Path

import guitarpro
from guitarpro import models as gp


ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "guitarpro-mnx" / "tests" / "fixtures" / "gp5"


def basic_score() -> gp.Song:
    song = gp.Song(
        title="Legacy café",
        subtitle="GP5 binary baseline",
        artist="MNX Lab",
        album="Clean-room fixtures",
        words="Public-domain test text",
        music="MNX Lab",
        copyright="CC0",
        tab="Generated fixture",
        instructions="Structural baseline; metadata intentionally exercises Windows-1252.",
        notice=["Generated with PyGuitarPro's public API."],
        tempoName="Andante",
        tempo=96,
    )

    track = song.tracks[0]
    track.name = "Open D"
    track.offset = 2
    track.strings = [
        gp.GuitarString(1, 62),
        gp.GuitarString(2, 57),
        gp.GuitarString(3, 54),
        gp.GuitarString(4, 50),
        gp.GuitarString(5, 45),
        gp.GuitarString(6, 38),
    ]

    header = song.measureHeaders[0]
    header.timeSignature.numerator = 3
    header.timeSignature.denominator.value = 4
    header.marker = gp.Marker("A - baseline")
    header.isRepeatOpen = True

    def note(voice: gp.Voice, value: int, string: int, duration: gp.Duration, text=None):
        beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=duration, text=text)
        beat.notes.append(gp.Note(beat, value=value, string=string, type=gp.NoteType.normal))
        voice.beats.append(beat)

    def rest(voice: gp.Voice, duration: gp.Duration):
        voice.beats.append(gp.Beat(voice, status=gp.BeatStatus.rest, duration=duration))

    first = track.measures[0]
    note(first.voices[0], 3, 1, gp.Duration(value=4, isDotted=True), text="D7")
    note(first.voices[0], 2, 2, gp.Duration(value=8))
    rest(first.voices[0], gp.Duration(value=4))
    note(first.voices[1], 0, 6, gp.Duration(value=2))
    rest(first.voices[1], gp.Duration(value=4))

    song.newMeasure()
    second_header = song.measureHeaders[1]
    second_header.timeSignature.numerator = 4
    second_header.timeSignature.denominator.value = 4
    second_header.keySignature = gp.KeySignature.GMajor
    second_header.repeatClose = 2
    second_header.hasDoubleBar = True

    second = track.measures[1]
    triplet = gp.Tuplet(enters=3, times=2)
    for fret in (0, 2, 3):
        note(second.voices[0], fret, 2, gp.Duration(value=8, tuplet=triplet))
    note(second.voices[0], 0, 3, gp.Duration(value=2, isDotted=True))
    rest(second.voices[1], gp.Duration(value=1))
    return song


def lyrics_and_techniques_score() -> gp.Song:
    song = gp.Song(
        title="Legacy lyrics and techniques",
        artist="MNX Lab",
        tempo=88,
    )
    song.lyrics = gp.Lyrics(
        trackChoice=1,
        lines=[
            gp.LyricLine(startingMeasure=1, lyrics="Shin- ing two+words bright"),
            gp.LyricLine(startingMeasure=2, lyrics="Second verse"),
            gp.LyricLine(),
            gp.LyricLine(),
            gp.LyricLine(),
        ],
    )

    track = song.tracks[0]
    track.name = "Techniques"

    def note(
        voice: gp.Voice,
        value: int,
        *,
        effect: gp.NoteEffect | None = None,
    ) -> None:
        beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=8))
        beat.notes.append(
            gp.Note(
                beat,
                value=value,
                string=1,
                type=gp.NoteType.normal,
                effect=effect or gp.NoteEffect(),
            )
        )
        voice.beats.append(beat)

    first = track.measures[0].voices[0]
    note(first, 0, effect=gp.NoteEffect(hammer=True))
    note(first, 2)
    first.beats.append(gp.Beat(first, status=gp.BeatStatus.rest, duration=gp.Duration(value=8)))
    note(first, 3, effect=gp.NoteEffect(palmMute=True, vibrato=True))
    note(first, 5, effect=gp.NoteEffect(slides=[gp.SlideType.shiftSlideTo]))
    note(first, 7)
    # Fret 7 makes the harmonic's sounding octave observable: it is not the
    # ordinary fretted pitch and therefore catches a lossy importer.
    note(first, 7, effect=gp.NoteEffect(harmonic=gp.NaturalHarmonic()))
    note(first, 8, effect=gp.NoteEffect(harmonic=gp.PinchHarmonic()))

    song.newMeasure()
    second = track.measures[1].voices[0]
    note(second, 7, effect=gp.NoteEffect(slides=[gp.SlideType.legatoSlideTo]))
    note(second, 5)
    note(second, 3, effect=gp.NoteEffect(slides=[gp.SlideType.outDownwards]))
    note(second, 2, effect=gp.NoteEffect(slides=[gp.SlideType.intoFromAbove]))
    second.beats.append(
        gp.Beat(second, status=gp.BeatStatus.rest, duration=gp.Duration(value=2))
    )
    return song


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fixtures = [
        ("basic", basic_score),
        ("lyrics-techniques", lyrics_and_techniques_score),
    ]
    for stem, make_score in fixtures:
        for version, suffix in [((5, 0, 0), "5.00"), ((5, 1, 0), "5.10")]:
            guitarpro.write(
                make_score(), OUT / f"{stem}-{suffix}.gp5", version=version, encoding="cp1252"
            )


if __name__ == "__main__":
    main()

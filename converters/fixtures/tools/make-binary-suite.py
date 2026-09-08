#!/usr/bin/env python3
"""Authors the gp3/gp4/gp5 binary parity fixtures.

    uv run --with PyGuitarPro python3 make-binary-suite.py

WHY THESE ARE GENERATED, AND BY WHAT

The corpus rule holds that Guitar Pro is the source — but nothing maintained
writes the legacy binary family anymore (alphaTab included), so a fixture in
these formats cannot come from the app. These are authored with PyGuitarPro,
the same standing alphaTab has for `Sun-did-glide.gp` today: an ecosystem
library *used* at dev time to write bytes; nothing from its source is copied
into this repo. See roadmap/proposed/core-guitarpro-binary-import.md for the
plan these serve, and the circularity guard it sets: the parity oracle for the
clean-room reader is alphaTab — an implementation independent of the one that
wrote these files — and each file should be opened once in a real consumer
(GP8 imports .gp5; TuxGuitar reads all three) when the chance arises.

Values are written longhand in the FORMAT'S terms. PyGuitarPro numbers strings
1 = highest (its default list is [(1,64) … (6,40)]), the same end as
`_x.mnxLab` and the OPPOSITE end from GPIF — one more reason the clean-room
reader's numbering must come from the oracle, never from assumption.

The suites are deliberately feature-scoped, not musical: each bar exists to
pin one record of the binary format. `Binary-suite.gp5` (v5.10) is the full
set; the gp4 (v4.06) and gp3 (v3.00) suites shrink to what those dialects
carry. No `.mnx.json` is derived from these — they are parity fixtures (the
clean-room reader must see exactly what alphaTab sees), not corpus scores.
"""

import os
import guitarpro as gp

HERE = os.path.dirname(os.path.abspath(__file__))
FIXTURES = os.path.normpath(os.path.join(HERE, '..'))


def quarter():
    return gp.Duration(value=gp.Duration.quarter)


def beat(voice, duration=None, dotted=False, tuplet=None):
    b = gp.Beat(voice)
    b.duration = duration or quarter()
    if dotted:
        b.duration.isDotted = True
    if tuplet:
        b.duration.tuplet = gp.Tuplet(*tuplet)
    voice.beats.append(b)
    return b


def rest(voice, duration=None):
    b = beat(voice, duration)
    b.status = gp.BeatStatus.rest
    return b


def note(b, string, fret, **effects):
    n = gp.Note(b)
    n.string = string          # 1 = highest string (PyGuitarPro numbering)
    n.value = fret
    n.type = gp.NoteType.normal
    for name, value in effects.items():
        setattr(n.effect, name, value)
    b.notes.append(n)
    return n


def add_measure(song):
    previous = song.measureHeaders[-1]
    song.newMeasure()
    header = song.measureHeaders[-1]
    header.number = len(song.measureHeaders)
    header.timeSignature = previous.timeSignature
    header.keySignature = previous.keySignature
    return header


def new_song(title, tempo):
    song = gp.Song()
    song.title = title
    song.tempo = tempo
    song.artist = 'mnx-lab fixtures'
    return song


def bars(song, count):
    """Grow the song to `count` measures and return per-bar (header, measure)."""
    while len(song.measureHeaders) < count:
        add_measure(song)
    track = song.tracks[0]
    return [(song.measureHeaders[i], track.measures[i]) for i in range(count)]


# ---------------------------------------------------------------------------
# gp5 — the full suite
# ---------------------------------------------------------------------------

def make_gp5(path):
    song = new_song('Binary suite (gp5)', 132)
    track = song.tracks[0]
    track.name = 'Suite Guitar'
    # Drop D, to catch tuning-order inversions standard tuning hides.
    track.strings = [
        gp.GuitarString(1, 64), gp.GuitarString(2, 59), gp.GuitarString(3, 55),
        gp.GuitarString(4, 50), gp.GuitarString(5, 45), gp.GuitarString(6, 38)
    ]
    track.offset = 2  # capo 2

    all_bars = bars(song, 10)

    # Bar 1 — G major, a marker, two real voices, dots.
    header, measure = all_bars[0]
    header.keySignature = gp.KeySignature.GMajor
    header.marker = gp.Marker(title='Intro', color=gp.Color(255, 0, 0))
    v1 = measure.voices[0]
    note(beat(v1), 1, 3)
    rest(v1)
    note(beat(v1, gp.Duration(value=gp.Duration.quarter), dotted=True), 2, 3)
    note(beat(v1, gp.Duration(value=gp.Duration.eighth)), 3, 0)
    v2 = measure.voices[1]
    note(beat(v2, gp.Duration(value=gp.Duration.whole)), 6, 0)

    # Bar 2 — hammer-on pair, vibrato, palm mute, let ring.
    _, measure = all_bars[1]
    v1 = measure.voices[0]
    note(beat(v1), 2, 5, hammer=True)   # origin; destination is the next note on the string
    note(beat(v1), 2, 7)
    note(beat(v1), 1, 5, vibrato=True)
    note(beat(v1), 5, 2, palmMute=True, letRing=True)

    # Bar 3 — the four slide kinds the extension distinguishes.
    _, measure = all_bars[2]
    v1 = measure.voices[0]
    note(beat(v1), 3, 5, slides=[gp.SlideType.shiftSlideTo])
    note(beat(v1), 3, 7, slides=[gp.SlideType.legatoSlideTo])
    note(beat(v1), 3, 9, slides=[gp.SlideType.outDownwards])
    note(beat(v1), 4, 5, slides=[gp.SlideType.intoFromAbove])

    # Bar 4 — bends: a plain bend, and a bend-release CURVE (the binary stores
    # a full point list; positions run 0..12, values 100 = a whole tone).
    _, measure = all_bars[3]
    v1 = measure.voices[0]
    plain = gp.BendEffect(type=gp.BendType.bend, value=100, points=[
        gp.BendPoint(0, 0), gp.BendPoint(12, 100)
    ])
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 2, 7, bend=plain)
    curve = gp.BendEffect(type=gp.BendType.bendRelease, value=100, points=[
        gp.BendPoint(0, 0), gp.BendPoint(4, 100), gp.BendPoint(8, 50), gp.BendPoint(12, 100)
    ])
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 2, 7, bend=curve)

    # Bar 5 — natural harmonic at 12, and a grace ornament (a NOTE effect in
    # the binary family, where GPIF has whole grace BEATS).
    _, measure = all_bars[4]
    v1 = measure.voices[0]
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 1, 12, harmonic=gp.NaturalHarmonic())
    grace = gp.GraceEffect(duration=32, fret=2, isOnBeat=False,
                           transition=gp.GraceEffectTransition.hammer, velocity=95)
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 2, 3, grace=grace)

    # Bar 6 — two eighth-note triplets: six flagged eighths that must become
    # exactly two groups.
    _, measure = all_bars[5]
    v1 = measure.voices[0]
    for fret in (0, 2, 3, 5, 3, 2):
        note(beat(v1, gp.Duration(value=gp.Duration.eighth), tuplet=(3, 2)), 4, fret)
    note(beat(v1), 4, 0)
    rest(v1)

    # Bars 7–9 — a repeat with two voltas: |: 7  8(v1, close ×2) | 9(v2).
    header7, measure = all_bars[6]
    header7.isRepeatOpen = True
    note(beat(measure.voices[0], gp.Duration(value=gp.Duration.whole)), 6, 0)
    header8, measure = all_bars[7]
    header8.repeatClose = 2
    header8.repeatAlternative = 0b01
    note(beat(measure.voices[0], gp.Duration(value=gp.Duration.whole)), 5, 0)
    header9, measure = all_bars[8]
    header9.repeatAlternative = 0b10
    note(beat(measure.voices[0], gp.Duration(value=gp.Duration.whole)), 4, 0)

    # Bar 10 — a time change to 3/4, a key change to F, a double bar, and a
    # chord symbol as beat text.
    header, measure = all_bars[9]
    header.timeSignature = gp.TimeSignature(numerator=3, denominator=quarter())
    header.keySignature = gp.KeySignature.FMajor
    header.hasDoubleBar = True
    v1 = measure.voices[0]
    b = beat(v1)
    b.text = 'Am'
    note(b, 2, 1)
    note(beat(v1), 3, 2)
    note(beat(v1), 4, 2)

    # gp5 carries exactly two voices per bar; a zero-beat second voice is not
    # something Guitar Pro itself writes (and alphaTab refuses it), so every
    # bar's silent second voice holds an explicit whole rest.
    for _, measure in all_bars:
        if not measure.voices[1].beats:
            rest(measure.voices[1], gp.Duration(value=gp.Duration.whole))

    # Track-level lyrics: one blob per verse from a start measure — the shape
    # gp4/gp5 store, re-dispatched onto beats on import.
    song.lyrics = gp.Lyrics()
    song.lyrics.lines[0] = gp.LyricLine(startingMeasure=1, lyrics='Hel- lo bin- a- ry world')
    song.lyrics.lines[1] = gp.LyricLine(startingMeasure=1, lyrics='Sec- ond verse as well')

    gp.write(song, path, version=(5, 1, 0))
    print('wrote', path)


# ---------------------------------------------------------------------------
# gp4 — the dialect below: one voice, no per-track RSE, same techniques
# ---------------------------------------------------------------------------

def make_gp4(path):
    song = new_song('Binary suite (gp4)', 120)
    track = song.tracks[0]
    track.name = 'Suite Guitar 4'

    all_bars = bars(song, 5)

    header, measure = all_bars[0]
    header.marker = gp.Marker(title='Head', color=gp.Color(255, 0, 0))
    v1 = measure.voices[0]
    note(beat(v1), 1, 0)
    note(beat(v1, gp.Duration(value=gp.Duration.quarter), dotted=True), 2, 1)
    note(beat(v1, gp.Duration(value=gp.Duration.eighth)), 3, 0)
    rest(v1)

    _, measure = all_bars[1]
    v1 = measure.voices[0]
    note(beat(v1), 2, 5, hammer=True)
    note(beat(v1), 2, 7, vibrato=True)
    note(beat(v1), 3, 5, slides=[gp.SlideType.shiftSlideTo])
    note(beat(v1), 3, 7, palmMute=True)

    _, measure = all_bars[2]
    v1 = measure.voices[0]
    bend = gp.BendEffect(type=gp.BendType.bend, value=50, points=[
        gp.BendPoint(0, 0), gp.BendPoint(12, 50)
    ])
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 2, 8, bend=bend)
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 1, 12, harmonic=gp.NaturalHarmonic())

    _, measure = all_bars[3]
    v1 = measure.voices[0]
    for fret in (2, 4, 5):
        note(beat(v1, gp.Duration(value=gp.Duration.quarter), tuplet=(3, 2)), 4, fret)
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 4, 2)

    header, measure = all_bars[4]
    header.isRepeatOpen = True
    header.repeatClose = 2
    note(beat(measure.voices[0], gp.Duration(value=gp.Duration.whole)), 6, 0)

    song.lyrics = gp.Lyrics()
    song.lyrics.lines[0] = gp.LyricLine(startingMeasure=1, lyrics='Four point oh six')

    gp.write(song, path, version=(4, 0, 6))
    print('wrote', path)


# ---------------------------------------------------------------------------
# gp3 — the floor: coarser effects, no lyrics
# ---------------------------------------------------------------------------

def make_gp3(path):
    song = new_song('Binary suite (gp3)', 100)
    song.tracks[0].name = 'Suite Guitar 3'

    all_bars = bars(song, 3)

    header, measure = all_bars[0]
    header.marker = gp.Marker(title='Three', color=gp.Color(255, 0, 0))
    v1 = measure.voices[0]
    note(beat(v1), 1, 1)
    rest(v1)
    note(beat(v1, gp.Duration(value=gp.Duration.quarter), dotted=True), 2, 3)
    note(beat(v1, gp.Duration(value=gp.Duration.eighth)), 3, 2)

    header, measure = all_bars[1]
    header.isRepeatOpen = True
    header.repeatClose = 2
    v1 = measure.voices[0]
    note(beat(v1), 2, 5, hammer=True)
    note(beat(v1), 2, 7)
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 6, 0, letRing=True)

    _, measure = all_bars[2]
    v1 = measure.voices[0]
    for fret in (0, 2, 4):
        note(beat(v1, gp.Duration(value=gp.Duration.quarter), tuplet=(3, 2)), 5, fret)
    note(beat(v1, gp.Duration(value=gp.Duration.half)), 5, 0)

    gp.write(song, path, version=(3, 0, 0))
    print('wrote', path)


if __name__ == '__main__':
    make_gp5(os.path.join(FIXTURES, 'Binary-suite.gp5'))
    make_gp4(os.path.join(FIXTURES, 'Binary-suite.gp4'))
    make_gp3(os.path.join(FIXTURES, 'Binary-suite.gp3'))

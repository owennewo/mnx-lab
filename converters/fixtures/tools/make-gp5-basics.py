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


def bends_score() -> gp.Song:
    song = gp.Song(title="Bend point curves", tempo=100)
    voice = song.tracks[0].measures[0].voices[0]
    # PyGuitarPro's public model uses positions 0..12 and quarter-tone values;
    # its writer converts these to binary positions 0..60 and values x25.
    curves = [
        [(0, 0), (12, 4)],
        [(0, 0), (3, 4), (6, 2), (9, 4), (12, 0)],
        [(0, 2), (12, 0)],
        [(0, 0), (12, 0)],
    ]
    for curve in curves:
        beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4))
        effect = gp.NoteEffect(bend=gp.BendEffect(
            type=gp.BendType.bendRelease,
            value=4,
            points=[gp.BendPoint(position, value) for position, value in curve],
        ))
        beat.notes.append(gp.Note(beat, value=7, string=2, type=gp.NoteType.normal, effect=effect))
        voice.beats.append(beat)
    return song


def graces_score() -> gp.Song:
    song = gp.Song(title="Grace placements", tempo=100)
    voice = song.tracks[0].measures[0].voices[0]
    for on_beat, duration in [(False, 32), (True, 16), (False, 16), (True, 32)]:
        beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4))
        effect = gp.NoteEffect(grace=gp.GraceEffect(
            fret=2, duration=duration, isOnBeat=on_beat,
            transition=gp.GraceEffectTransition.hammer,
        ))
        beat.notes.append(gp.Note(beat, value=4, string=2, type=gp.NoteType.normal, effect=effect))
        voice.beats.append(beat)
    return song


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for version, suffix in [((3, 0, 0), '3.00'), ((4, 0, 0), '4.00'), ((4, 0, 6), '4.06'), ((5, 0, 0), '5.00'), ((5, 1, 0), '5.10')]:
        song = gp.Song(title='Grace wire combinations', tempo=100)
        for index in range(12):
            if index:
                song.newMeasure()
            voice = song.tracks[0].measures[index].voices[0]
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
            beat.notes.append(gp.Note(beat, value=16, string=1, type=gp.NoteType.normal,
                effect=gp.NoteEffect(grace=gp.GraceEffect(fret=index + 2, duration=32,
                    transition=gp.GraceEffectTransition.none))))
            voice.beats.append(beat)
        grace_path = OUT / f'grace-matrix-{suffix}.gp{version[0]}'
        guitarpro.write(song, grace_path, version=version)
        raw = grace_path.read_bytes()
        # Correct only the explicitly authored grace records; avoid relying on
        # the public writer's known GP3/4 field order and duration-code mapping.
        replacements = []
        for index in range(12):
            writer_record = bytes([index + 2, 6, 2, 0] if version[0] < 5 else [index + 2, 6, 0, 2, 0])
            assert raw.count(writer_record) == 1
            replacements.append((raw.index(writer_record), bytes([index + 2, 6, index % 4, index // 4 + 1]
                + ([index % 4] if version[0] == 5 else []))))
        patched = bytearray(raw)
        for offset, record in replacements:
            patched[offset:offset + len(record)] = record
        grace_path.write_bytes(patched)
        song = gp.Song(title='Chord diagrams', tempo=100)
        voice = song.tracks[0].measures[0].voices[0]
        for modern, first_fret in [(False, 0), (False, 1), (True, 1), (True, 5)]:
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4))
            beat.notes.append(gp.Note(beat, value=0, string=1, type=gp.NoteType.normal))
            beat.effect.chord = gp.Chord(6, name='Em', newFormat=modern, firstFret=first_fret,
                strings=[0, 0, 0, 2, 2, 0])
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'chords-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Beat effects', tempo=100)
        voice = song.tracks[0].measures[0].voices[0]
        effects = [
            gp.BeatEffect(fadeIn=True),
            gp.BeatEffect(stroke=gp.BeatStroke(direction=gp.BeatStrokeDirection.down, value=8)),
            gp.BeatEffect(slapEffect=gp.SlapEffect.slapping),
            gp.BeatEffect(tremoloBar=gp.BendEffect(type=gp.BendType.dip, value=-2,
                points=[gp.BendPoint(0, 0), gp.BendPoint(6, -2), gp.BendPoint(12, 0)])),
        ]
        for effect in effects:
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4), effect=effect)
            beat.notes.append(gp.Note(beat, value=0, string=1, type=gp.NoteType.normal))
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'beat-effects-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Mixer and tempo changes', tempo=100)
        for measure_index in range(2):
            if measure_index:
                song.newMeasure()
            voice = song.tracks[0].measures[measure_index].voices[0]
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
            beat.notes.append(gp.Note(beat, value=0, string=1, type=gp.NoteType.normal))
            if measure_index:
                beat.effect.mixTableChange = gp.MixTableChange(
                    tempo=gp.MixTableItem(value=132),
                    volume=gp.MixTableItem(value=80, duration=1),
                    tempoName='Faster',
                )
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'mix-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Ties and dead notes', tempo=100)
        for measure_index in range(2):
            if measure_index:
                song.newMeasure()
            voice = song.tracks[0].measures[measure_index].voices[0]
            for kind, fret in ([(gp.NoteType.normal, 5), (gp.NoteType.tie, 0)] if not measure_index else
                               [(gp.NoteType.tie, 0), (gp.NoteType.dead, 3)]):
                beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=2))
                beat.notes.append(gp.Note(beat, value=fret, string=2, type=kind))
                voice.beats.append(beat)
        guitarpro.write(song, OUT / f'ties-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Tie source scope', tempo=100)
        song.tracks[0].offset = 2
        song.newMeasure()
        for voice_index in range(2 if version[0] == 5 else 1):
            voice = song.tracks[0].measures[0].voices[voice_index]
            for kind, duration in [(gp.NoteType.normal, 4), (None, 4), (gp.NoteType.tie, 2)]:
                beat = gp.Beat(voice, status=gp.BeatStatus.rest if kind is None else gp.BeatStatus.normal,
                               duration=gp.Duration(value=duration))
                if kind is not None:
                    beat.notes.append(gp.Note(beat, value=5 + 4 * voice_index if kind == gp.NoteType.normal else 0,
                                              string=2, type=kind))
                voice.beats.append(beat)
            voice = song.tracks[0].measures[1].voices[voice_index]
            for kind in [gp.NoteType.normal, gp.NoteType.tie]:
                beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=2))
                effect = gp.NoteEffect(harmonic=gp.NaturalHarmonic()) if kind == gp.NoteType.normal else gp.NoteEffect()
                beat.notes.append(gp.Note(beat, value=12 if kind == gp.NoteType.normal else 0,
                                          string=2, type=kind, effect=effect))
                voice.beats.append(beat)
        guitarpro.write(song, OUT / f'tie-scope-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Orphan tie', tempo=100)
        voice = song.tracks[0].measures[0].voices[0]
        beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
        beat.notes.append(gp.Note(beat, value=0, string=1, type=gp.NoteType.tie))
        voice.beats.append(beat)
        guitarpro.write(song, OUT / f'orphan-tie-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Grace chord', tempo=100)
        voice = song.tracks[0].measures[0].voices[0]
        beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
        for string in [1, 2]:
            effect = gp.NoteEffect(grace=gp.GraceEffect(
                fret=2, duration=32, transition=gp.GraceEffectTransition.hammer))
            beat.notes.append(gp.Note(beat, value=4, string=string, type=gp.NoteType.normal, effect=effect))
        voice.beats.append(beat)
        guitarpro.write(song, OUT / f'grace-chord-{suffix}.gp{version[0]}', version=version)
        # Keep the original writer-discrepancy fixture, and separately author
        # the documented grace field order for a genuine two-note hammer.
        raw = (OUT / f'grace-chord-{suffix}.gp{version[0]}').read_bytes()
        writer_record = bytes([2, 6, 2, 3] if version[0] < 5 else [2, 6, 3, 2])
        assert raw.count(writer_record) == 2
        (OUT / f'grace-hammer-{suffix}.gp{version[0]}').write_bytes(
            raw.replace(writer_record, bytes([2, 6, 3, 1])))
        song = gp.Song(title='Bass and percussion', tempo=100)
        bass = song.tracks[0]
        bass.name = 'Bass'
        bass.channel.instrument = 33
        bass.strings = [gp.GuitarString(i + 1, pitch) for i, pitch in enumerate([43, 38, 33, 28])]
        drums = gp.Track(song, number=2, name='Drums', isPercussionTrack=True,
                         channel=gp.MidiChannel(channel=9, effectChannel=9, instrument=0))
        song.tracks.append(drums)
        for track, fret in [(bass, 3), (drums, 38)]:
            voice = track.measures[0].voices[0]
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
            beat.notes.append(gp.Note(beat, value=fret, string=1, type=gp.NoteType.normal))
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'instruments-{suffix}.gp{version[0]}', version=version)
        # Percussion uses the stored note/grace value as a MIDI key, not a
        # guitar fret. Keep the bass alongside it to catch track-state leaks.
        drums.measures[0].voices[0].beats[0].notes[0].effect.grace = gp.GraceEffect(
            fret=36, duration=32, transition=gp.GraceEffectTransition.none)
        grace_path = OUT / f'percussion-grace-{suffix}.gp{version[0]}'
        guitarpro.write(song, grace_path, version=version)
        # Author the four-byte grace record explicitly per the published
        # format table: fret=36, dynamics=6, transition=0, duration=1 (32nd).
        # The public writer emits duration before transition in GP3/4 and
        # emits code 2 for its 32nd model value. Do not reproduce that in the
        # fixture intended to prove the documented wire semantics.
        raw = grace_path.read_bytes()
        writer_record = bytes([36, 6, 2, 0] if version[0] < 5 else [36, 6, 0, 2])
        assert raw.count(writer_record) == 1
        grace_path.write_bytes(raw.replace(writer_record, bytes([36, 6, 0, 1])))
        song = gp.Song(title='Three repeat endings', tempo=100)
        for measure_index, ending in enumerate([0, 1, 2, 4]):
            if measure_index:
                song.newMeasure()
            header = song.measureHeaders[measure_index]
            header.isRepeatOpen = measure_index == 0
            header.repeatAlternative = ending
            if measure_index in [1, 2]:
                header.repeatClose = 2
            voice = song.tracks[0].measures[measure_index].voices[0]
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
            beat.notes.append(gp.Note(beat, value=measure_index, string=1, type=gp.NoteType.normal))
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'endings-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Grouped and multi-bar endings', tempo=100)
        for measure_index, ending in enumerate([0, 3, 4, 0, 1, 1, 2]):
            if measure_index:
                song.newMeasure()
            header = song.measureHeaders[measure_index]
            header.isRepeatOpen = measure_index in [0, 3]
            header.repeatAlternative = ending
            if measure_index in [1, 5]:
                header.repeatClose = 2
            voice = song.tracks[0].measures[measure_index].voices[0]
            beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
            beat.notes.append(gp.Note(beat, value=measure_index, string=1, type=gp.NoteType.normal))
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'ending-groups-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Combined measure header fields', tempo=100)
        for measure_index in range(2):
            if measure_index:
                song.newMeasure()
            header = song.measureHeaders[measure_index]
            header.isRepeatOpen = measure_index == 0
            if measure_index:
                header.timeSignature.numerator = 3
                header.timeSignature.denominator.value = 4
                header.repeatClose = 2
                header.repeatAlternative = 1
                header.marker = gp.Marker('Combined')
                header.keySignature = gp.KeySignature.GMajor
            voice = song.tracks[0].measures[measure_index].voices[0]
            beat = gp.Beat(voice, status=gp.BeatStatus.normal,
                           duration=gp.Duration(value=2 if measure_index else 1, isDotted=bool(measure_index)))
            beat.notes.append(gp.Note(beat, value=0, string=1, type=gp.NoteType.normal))
            voice.beats.append(beat)
        guitarpro.write(song, OUT / f'combined-header-{suffix}.gp{version[0]}', version=version)
        song = gp.Song(title='Harmonic nodes', tempo=100)
        song.tracks[0].offset = 2
        for index, node in enumerate([12, 7, 5, 4, 9, 3, 2]):
            if index:
                song.newMeasure()
            for voice_index in range(2 if version[0] == 5 else 1):
                voice = song.tracks[0].measures[index].voices[voice_index]
                beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
                effect = gp.NaturalHarmonic() if voice_index == 0 else gp.TappedHarmonic(fret=node + 3)
                beat.notes.append(gp.Note(beat, value=node if voice_index == 0 else 3, string=1,
                    type=gp.NoteType.normal, effect=gp.NoteEffect(harmonic=effect)))
                voice.beats.append(beat)
        guitarpro.write(song, OUT / f'harmonic-nodes-{suffix}.gp{version[0]}', version=version)
        if version[0] == 3:
            song = gp.Song(title='GP3 beat note effects', tempo=100)
            voice = song.tracks[0].measures[0].voices[0]
            for effect in [gp.NoteEffect(vibrato=True), gp.NoteEffect(harmonic=gp.NaturalHarmonic()),
                           gp.NoteEffect(harmonic=gp.ArtificialHarmonic()), gp.NoteEffect()]:
                beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4))
                for string in [1, 2]:
                    beat.notes.append(gp.Note(beat, value=7, string=string, type=gp.NoteType.normal,
                                              effect=effect))
                voice.beats.append(beat)
            guitarpro.write(song, OUT / 'legacy-note-effects-3.00.gp3', version=version)
        if version[0] >= 4:
            song = gp.Song(title='Lyric controls', tempo=100)
            song.lyrics = gp.Lyrics(trackChoice=1, lines=[
                gp.LyricLine(startingMeasure=1, lyrics='Hel-lo two+words [comment]  end'),
                gp.LyricLine(), gp.LyricLine(), gp.LyricLine(), gp.LyricLine()])
            for measure_index in range(2):
                if measure_index:
                    song.newMeasure()
                voice = song.tracks[0].measures[measure_index].voices[0]
                for _ in range(4):
                    beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4))
                    beat.notes.append(gp.Note(beat, value=0, string=1, type=gp.NoteType.normal))
                    voice.beats.append(beat)
            guitarpro.write(song, OUT / f'lyric-controls-{suffix}.gp{version[0]}', version=version)
            song = gp.Song(title='Harmonic variants', tempo=100)
            song.tracks[0].offset = 2
            voice = song.tracks[0].measures[0].voices[0]
            for effect in [gp.ArtificialHarmonic(), gp.TappedHarmonic(fret=17),
                           gp.SemiHarmonic(), gp.PinchHarmonic()]:
                beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=4))
                beat.notes.append(gp.Note(beat, value=5, string=1, type=gp.NoteType.normal,
                                          effect=gp.NoteEffect(harmonic=effect)))
                voice.beats.append(beat)
            guitarpro.write(song, OUT / f'harmonics-{suffix}.gp{version[0]}', version=version)
            song = gp.Song(title='Artificial harmonic register', tempo=100)
            song.tracks[0].offset = 2
            variants = [(gp.PitchClass('A'), gp.Octave.quindicesima),
                        (gp.PitchClass('E'), gp.Octave.ottava),
                        (gp.PitchClass('A'), gp.Octave.ottava)]
            if version[0] == 5:
                variants += [(gp.PitchClass('C'), gp.Octave.ottava),
                             (gp.PitchClass('F#'), gp.Octave.ottava),
                             (gp.PitchClass('A'), gp.Octave.none),
                             (gp.PitchClass('A'), gp.Octave.ottavaBassa),
                             (gp.PitchClass('A'), gp.Octave.quindicesimaBassa)]
            for index, (pitch, octave) in enumerate(variants):
                if index:
                    song.newMeasure()
                voice = song.tracks[0].measures[index].voices[0]
                beat = gp.Beat(voice, status=gp.BeatStatus.normal, duration=gp.Duration(value=1))
                beat.notes.append(gp.Note(beat, value=5, string=1, type=gp.NoteType.normal,
                    effect=gp.NoteEffect(harmonic=gp.ArtificialHarmonic(pitch=pitch, octave=octave))))
                voice.beats.append(beat)
            guitarpro.write(song, OUT / f'harmonic-register-{suffix}.gp{version[0]}', version=version)
    for version, suffix in [((3, 0, 0), '3.00'), ((4, 0, 0), '4.00'), ((4, 0, 6), '4.06')]:
        song = basic_score()
        for measure in song.tracks[0].measures:
            measure.voices[1].beats.clear()
        guitarpro.write(song, OUT / f'basic-{suffix}.gp{version[0]}', version=version, encoding='cp1252')
    fixtures = [
        ("basic", basic_score),
        ("lyrics-techniques", lyrics_and_techniques_score),
        ("bends", bends_score),
        ("graces", graces_score),
    ]
    for stem, make_score in fixtures:
        for version, suffix in [((5, 0, 0), "5.00"), ((5, 1, 0), "5.10")]:
            guitarpro.write(
                make_score(), OUT / f"{stem}-{suffix}.gp5", version=version, encoding="cp1252"
            )


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Open legacy fixtures through installed TuxGuitar's public consumer API.

Dev-time only: uv run --with jpype1 python converters/fixtures/tools/check-binary-tuxguitar.py
No TuxGuitar implementation/source inspection or project runtime dependency.
This checks reader acceptance, not visual engraving approval.
"""
import hashlib
from pathlib import Path
import sys

import jpype

jpype.startJVM('--enable-native-access=ALL-UNNAMED', classpath=[
    '/usr/share/tuxguitar/lib/*', '/usr/share/tuxguitar/plugins/*'
])
J = jpype.JClass
root = Path(__file__).resolve().parents[2]
paths = [Path(p) for p in sys.argv[1:]] or sorted([
    *root.glob('guitarpro-mnx/tests/fixtures/gp5/*.gp[345]'),
    *root.glob('fixtures/Binary-suite.gp[345]'),
])
for path in paths:
    settings = J('app.tuxguitar.io.gtp.GTPSettings')()
    settings.setCharset('windows-1252')
    reader = J(f'app.tuxguitar.io.gtp.GP{path.suffix[-1]}InputStream')(settings)
    handle = J('app.tuxguitar.io.base.TGSongReaderHandle')()
    handle.setFactory(J('app.tuxguitar.song.factory.TGFactory')())
    stream = J('java.io.FileInputStream')(str(path.resolve()))
    try:
        handle.setInputStream(stream)
        reader.read(handle)
        song = handle.getSong()
        assert song is not None and song.countTracks() > 0, path
        assert song.countMeasureHeaders() > 0, path
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        print(f'{path.name}: tracks={song.countTracks()} measures={song.countMeasureHeaders()} sha256={digest}')
        if path.name.startswith(('endings-', 'ending-groups-', 'combined-header-')):
            print('  endings=' + str([song.getMeasureHeader(i).getRepeatAlternative()
                                     for i in range(song.countMeasureHeaders())]))
        if path.name.startswith('harmonics-'):
            for beat in song.getTrack(0).getMeasure(0).getBeats():
                for note in beat.getVoice(0).getNotes():
                    harmonic = note.getEffect().getHarmonic()
                    print(f'  fret={note.getValue()} harmonicType={harmonic.getType()} data={harmonic.getData()}')
        if path.name.startswith('percussion-grace-'):
            note = song.getTrack(1).getMeasure(0).getBeats().get(0).getVoice(0).getNotes().get(0)
            grace = note.getEffect().getGrace()
            assert note.getValue() == 38 and grace.getFret() == 36
            assert grace.getTransition() == 0
            print(f'  percussion principal={note.getValue()} grace={grace.getFret()} duration={grace.getDuration()} transition={grace.getTransition()}')
        if path.name.startswith('grace-hammer-'):
            notes = song.getTrack(0).getMeasure(0).getBeats().get(0).getVoice(0).getNotes()
            assert notes.size() == 2
            for note in notes:
                grace = note.getEffect().getGrace()
                assert note.getValue() == 4 and grace.getFret() == 2
                assert grace.getTransition() == 3 and grace.getDuration() == 1
            print('  two principal fret-4 notes, each with fret-2 grace, transition=3 duration=1')
        if path.name.startswith('harmonic-register-'):
            for measure in song.getTrack(0).getMeasures():
                note = measure.getBeats().get(0).getVoice(0).getNotes().get(0)
                harmonic = note.getEffect().getHarmonic()
                print(f'  measure={measure.getNumber()} fret={note.getValue()} harmonicType={harmonic.getType()} data={harmonic.getData()}')
        if path.name.startswith('grace-matrix-'):
            for index, measure in enumerate(song.getTrack(0).getMeasures()):
                grace = measure.getBeats().get(0).getVoice(0).getNotes().get(0).getEffect().getGrace()
                assert grace.getFret() == index + 2
                assert grace.getTransition() == index % 4 and grace.getDuration() == index // 4 + 1
            print('  all 12 grace duration/transition records match authored wire values')
    finally:
        stream.close()
print(f'TuxGuitar accepted {len(paths)} binary fixtures.')

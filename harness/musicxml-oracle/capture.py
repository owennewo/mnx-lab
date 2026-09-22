"""Independent music21 and W3C XSD judgments. Run only in the locked uv project."""
import argparse
from fractions import Fraction
import hashlib
import json
from pathlib import Path
import warnings
import xml.etree.ElementTree as ET
from lxml import etree
import music21
from music21 import converter, stream, note, chord, harmony

ROOT = Path(__file__).resolve().parents[2]
SCHEMA = ROOT / 'harness/fixtures/musicxml-4.0'


def frac(value):
    # music21 uses Fraction for tuplets, floats for exact binary quantities.
    # Do not round arbitrary fractions to a tolerance.
    v = value if isinstance(value, Fraction) else Fraction(str(value))
    return f'{v.numerator}/{v.denominator}'


class LocalSchema(etree.Resolver):
    def resolve(self, url, pubid, context):
        allowed = {
            'http://www.musicxml.org/xsd/xml.xsd': 'xml.xsd',
            'http://www.musicxml.org/xsd/xlink.xsd': 'xlink.xsd',
        }
        if url in allowed:
            return self.resolve_filename(str(SCHEMA / allowed[url]), context)
        if url == str(SCHEMA / 'musicxml.xsd'):
            return None
        raise ValueError(f'Unexpected schema resource: {url}')


def load_schema():
    parser = etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False)
    parser.resolvers.add(LocalSchema())
    return etree.XMLSchema(etree.parse(str(SCHEMA / 'musicxml.xsd'), parser))


def validate(xml, schema):
    try:
        doc = etree.fromstring(xml.encode(), etree.XMLParser(no_network=True, resolve_entities=False, load_dtd=False))
        valid = schema.validate(doc)
        return {'valid': valid, 'errors': [{'line': e.line, 'path': e.path, 'message': e.message} for e in schema.error_log]}
    except etree.XMLSyntaxError as error:
        return {'valid': False, 'errors': [{'line': error.lineno, 'message': str(error).split('\n')[0]}]}


def semantic(xml):
    caught = []
    try:
        source = ET.fromstring(xml)
        ids = [p.get('id') for p in source.findall('part')]
        if len(set(ids)) != len(ids):
            raise ValueError('Duplicate source part IDs')
        # music21 applies octave brackets when parsing in some cases; MNX keeps
        # a separate position-dependent object. A note table must not guess it.
        if source.find('.//octave-shift') is not None:
            return {'status': 'unsupported', 'reason': 'Ottava sounding-pitch policy not yet mapped'}
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter('always')
            score = converter.parseData(xml, format='musicxml')
            score.toSoundingPitch(inPlace=True)
        rows, measures = [], [0] * len(ids)
        for part in score.parts:
            source_id = part.getInstrument().partId
            if source_id not in ids:
                raise ValueError(f'Cannot map music21 part {source_id!r}')
            part_index = ids.index(source_id)
            staff = 1
            if isinstance(part, stream.PartStaff):
                staff = int(str(part.id).rsplit('-Staff', 1)[1])
            part_measures = list(part.getElementsByClass(stream.Measure))
            if measures[part_index] not in (0,len(part_measures)):
                raise ValueError('Unequal measure counts among split staves')
            measures[part_index] = len(part_measures)
            for mi, measure in enumerate(part_measures):
                streams = list(measure.voices) if measure.voices else [measure]
                for voice in streams:
                    voice_id = str(voice.id) if isinstance(voice,stream.Voice) else '1'
                    grace_at, grace_slot = None, 0
                    for event in voice.notesAndRests:
                        if isinstance(event,harmony.Harmony):
                            continue
                        # music21 creates invisible rests for MusicXML forward.
                        # Silent spacing is judged by following note onsets.
                        if isinstance(event,note.Rest) and event.style.hideObjectOnPrint:
                            continue
                        onset = frac(event.getOffsetInHierarchy(measure))
                        grace = event.duration.isGrace
                        if grace:
                            grace_slot = grace_slot + 1 if grace_at == onset else 1
                            grace_at = onset
                        else:
                            grace_slot = 0
                            grace_at = None
                        lyrics = sorted([[str(l.identifier),l.text or '',l.syllabic or 'single'] for l in event.lyrics])
                        members = event.notes if isinstance(event,chord.ChordBase) else [event]
                        for n in members:
                            if isinstance(n,note.Unpitched):
                                return {'status': 'unsupported', 'reason': 'Unpitched instrument identity not yet mapped'}
                            if isinstance(n,note.Rest):
                                pitch = 'rest'
                            else:
                                pitch = frac(n.pitch.ps)
                            written = music21.duration.Duration(type=event.duration.type, dots=event.duration.dots).quarterLength if grace else None
                            rows.append({
                                'part':part_index,'staff':staff,'voice':voice_id,'measure':mi,
                                'onset':onset,'duration':frac(event.duration.quarterLength),'pitch':pitch,
                                'grace':grace_slot if grace else 0,'writtenGrace':frac(written) if grace else None,
                                'tie':n.tie.type if n.tie else '', 'lyrics':lyrics,
                            })
        return {'status':'ok','table':{'parts':len(ids),'measures':measures,'rows':rows},
                'warnings':[str(w.message) for w in caught]}
    except Exception as error:
        return {'status':'error','error':f'{type(error).__name__}: {error}', 'warnings':[str(w.message) for w in caught]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('request',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    schema=load_schema()
    # Sanity checks demonstrate that the external validator enforces content,
    # not just well-formedness. Always run; an adapter/setup error stops capture.
    valid='<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>P</part-name></score-part></part-list><part id="P1"><measure number="1"><note><rest/><duration>1</duration><type>quarter</type></note></measure></part></score-partwise>'
    assert validate(valid,schema)['valid']
    assert not validate(valid.replace('<duration>1</duration>','<duration>-1</duration>'),schema)['valid']
    assert not validate(valid.replace('<part-list>','<nonsense>'),schema)['valid']
    result={'tools':{'music21':music21.__version__,'lxml':etree.LXML_VERSION,'libxml2':etree.LIBXML_VERSION},'cases':[]}
    request=json.loads(args.request.read_text())
    for case in request:
        row={'id':case['id']}
        for key in ['source','exported']:
            if key in case:
                xml=case[key]
                row[key]={'sha256':hashlib.sha256(xml.encode()).hexdigest(), 'semantic':semantic(xml)}
                if key=='exported':row[key]['xsd']=validate(xml,schema)
        result['cases'].append(row)
    args.output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print(f"Captured {len(result['cases'])} cases using music21 {music21.__version__}")

if __name__=='__main__': main()

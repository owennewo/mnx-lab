"""039 fixed score-blind strongest-note mask, followed by the unchanged official decoder."""
import sys, json, hashlib, time, subprocess
from pathlib import Path
import numpy as np
ROOT = Path('/home/williao/dev/guitar-nn')
sys.path.insert(0, str(ROOT))
from scripts.basic_pitch_benchmark import check_environment, official_apis

def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def write(path, value):
    with Path(path).open('x') as stream: json.dump(value, stream, indent=2); stream.write('\n')

def dominant(raw):
    note, onset = raw['note'], raw['onset']
    if note.ndim != 2 or note.shape[1] != 88 or onset.shape != note.shape or not np.isfinite(note).all() or not np.isfinite(onset).all():
        raise ValueError('Expected finite matching frame-by-88 note/onset maps')
    winners = note.argmax(axis=1)  # numpy chooses the first (lowest) bin on ties.
    mask = np.arange(88)[None, :] == winners[:, None]
    result = {key: value.copy() for key, value in raw.items()}
    result['note'] = np.where(mask, note, 0)
    result['onset'] = np.where(mask, onset, 0)
    return result, winners

def self_test():
    note = np.zeros((4,88), dtype=np.float32); onset = np.ones_like(note)
    note[0,39:41] = .8; note[1,50] = .9; note[2,22] = .4
    raw = dict(note=note.copy(), onset=onset.copy(), contour=np.arange(12).reshape(4,3))
    output,winners = dominant(raw)
    assert winners.tolist() == [39,50,22,0]
    assert output['note'][0,39] == note[0,39] and output['note'][0,40] == 0
    assert output['onset'].sum() == 4 and np.array_equal(output['contour'], raw['contour'])
    assert np.array_equal(raw['note'], note) and np.array_equal(raw['onset'], onset)
    prefix,_ = dominant({k:v[:2] for k,v in raw.items()})
    assert all(np.array_equal(prefix[k],v[:2]) for k,v in output.items())
    try: dominant(dict(note=np.zeros((1,87)), onset=np.zeros((1,87))))
    except ValueError: pass
    else: raise AssertionError('Invalid shape accepted')
    from basic_pitch import note_creation as decoder
    raw = dict(note=np.zeros((90,88),dtype=np.float32), onset=np.zeros((90,88),dtype=np.float32), contour=np.zeros((90,264),dtype=np.float32))
    raw['note'][5:70,39] = .8; raw['note'][5:70,22] = .4
    raw['onset'][5,39] = .9; raw['onset'][5,22] = .6
    config=json.loads((ROOT/'benchmarks/basic-pitch/config.json').read_text())
    _,before=decoder.model_output_to_notes({k:v.copy() for k,v in raw.items()},**config['decoder'])
    masked,_=dominant(raw); _,after=decoder.model_output_to_notes(masked,**config['decoder'])
    assert {e[2] for e in before} == {43,60} and {e[2] for e in after} == {60}
    print('Five policy checks and synthetic decoder suppression passed')

if __name__ == '__main__':
    if sys.argv[1] == '--self-test': self_test(); sys.exit(0)
    request=json.loads(Path(sys.argv[1]).read_text()); out=Path(request['out']);out.mkdir()
    config=json.loads((ROOT/'benchmarks/basic-pitch/config.json').read_text())
    versions=check_environment(); _,decoder,model_path=official_apis(config)
    assert versions == request['identity']['versions']
    assert config == request['identity']['config'] and sha(model_path) == request['identity']['modelSha256']
    index={}
    for i,a in enumerate(request['audio']):
        assert sha(a['raw']['path']) == a['raw']['sha256'] and sha(a['decoded']['path']) == a['decoded']['sha256']
        with np.load(a['raw']['path']) as archive: raw={k:archive[k] for k in ('note','onset','contour')}; times=archive['frame_times_seconds']
        before=json.loads(Path(a['decoded']['path']).read_text())['events']
        tick=time.perf_counter(); masked,winners=dominant(raw)
        _,events=decoder.model_output_to_notes({k:v.copy() for k,v in masked.items()},**config['decoder'])
        elapsed=time.perf_counter()-tick
        values=[dict(onset=float(e[0]),end=float(e[1]),midi=int(e[2]),confidence=float(e[3]),availableAt=a['duration']) for e in events]
        raw_path=out/f"{a['audioSha256']}.npz"
        with raw_path.open('xb') as stream: np.savez_compressed(stream,**masked,frame_times_seconds=times,winner_bins=winners)
        path=out/f"{a['audioSha256']}.json"
        write(path,dict(events=values,audioSha256=a['audioSha256'],rawInput=a['raw'],oldDecoded=a['decoded'],decoder=config['decoder'],policy='dominant-pitch@1',
            decodeSeconds=elapsed,frames=len(times),oldEvents=len(before),newEvents=len(values),
            oldG2=sum(e['midi']==43 for e in before),newG2=sum(e['midi']==43 for e in values),
            oldPitches=sorted({e['midi'] for e in before}),newPitches=sorted({e['midi'] for e in values}),
            removedNoteEnergy=float(np.sum(raw['note']-masked['note'],dtype=np.float64)),
            winnerMidiCounts={str(int(b+21)):int(n) for b,n in zip(*np.unique(winners,return_counts=True))}))
        index[a['audioSha256']]=dict(masked=dict(path=str(raw_path),sha256=sha(raw_path)),decoded=dict(path=str(path),sha256=sha(path)))
        with (out/'journal.jsonl').open('a') as stream: stream.write(json.dumps(dict(audioSha256=a['audioSha256'],**index[a['audioSha256']]))+'\n')
        if (i+1)%25==0: print(f'decoded {i+1}/{len(request["audio"])}',flush=True)
    write(out/'index.json',index)

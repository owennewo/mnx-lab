"""035 score-blind, pinned official offline observations; one record per audio hash."""
import sys, json, hashlib, time, subprocess
from pathlib import Path
import numpy as np
ROOT = Path('/home/williao/dev/guitar-nn')
sys.path.insert(0, str(ROOT))
from scripts.basic_pitch_benchmark import check_environment, official_apis

def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def write(p, v):
    with Path(p).open('x') as f: json.dump(v, f, indent=2); f.write('\n')

if __name__ == '__main__':
    request = json.loads(Path(sys.argv[1]).read_text()); out = Path(request['out']); out.mkdir()
    config = json.loads((ROOT/'benchmarks/basic-pitch/config.json').read_text())
    versions = check_environment(); inference, decoder, model_path = official_apis(config)
    # Default native threading oversubscribes this host. Explicit one-thread CPU for both runtimes.
    import onnxruntime as ort
    options = ort.SessionOptions(); options.intra_op_num_threads = 1; options.inter_op_num_threads = 1
    model = inference.Model(model_path)
    model.model = ort.InferenceSession(str(model_path), sess_options=options, providers=['CPUExecutionProvider'])
    identity = {'guitarNNCommit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
        'config':config,'versions':versions,'modelSha256':sha(model_path),'modelPath':str(model_path),
        'lockSha256':sha(ROOT/'environments/basic-pitch/requirements.lock'), 'threads':1}
    write(out/'identity.json', identity)
    index = {}
    for i, a in enumerate(request['audio']):
        assert sha(a['path']) == a['sha256']
        before = time.perf_counter(); raw = inference.run_inference(Path(a['path']), model)
        infer_seconds = time.perf_counter()-before
        before = time.perf_counter(); _, events = decoder.model_output_to_notes({k:v.copy() for k,v in raw.items()}, **config['decoder'])
        decode_seconds = time.perf_counter()-before
        times = decoder.model_frames_to_time(len(raw['note']))
        raw_path = out/f"{a['sha256']}.npz"
        with raw_path.open('xb') as f: np.savez_compressed(f, **raw, frame_times_seconds=times)
        events_path = out/f"{a['sha256']}.json"
        values = [{'onset':float(e[0]),'end':float(e[1]),'midi':int(e[2]),'confidence':float(e[3]),
                   'availableAt':a['duration']} for e in events]
        write(events_path, {'events':values,'inferenceSeconds':infer_seconds,'decodeSeconds':decode_seconds,
              'audioSha256':a['sha256'], 'modelSha256':identity['modelSha256'], 'frames':len(times),
              'frameAvailability':'whole-clip offline, including zero-padded final window'})
        index[a['sha256']] = {'raw':{'path':str(raw_path),'sha256':sha(raw_path)},'decoded':{'path':str(events_path),'sha256':sha(events_path)}}
        # Incremental journal survives a failure; final index written only after complete measurement.
        with (out/'journal.jsonl').open('a') as f: f.write(json.dumps({'audio':a, **index[a['sha256']]})+'\n')
        if (i+1)%25==0: print(f"offline {i+1}/{len(request['audio'])}", flush=True)
    write(out/'index.json', index)

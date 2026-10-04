"""Read-only stimulus/map diagnostic; no candidate, gate or level selection."""
import json, sys, wave, hashlib
from pathlib import Path
import numpy as np
from scipy.signal import welch
request = json.loads(Path(sys.argv[1]).read_text())
index = json.loads(Path(request['index']).read_text())
rows = []
for a in request['audio']:
    assert hashlib.sha256(Path(a['path']).read_bytes()).hexdigest() == a['sha256']
    with wave.open(a['path']) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), '<i2').astype(np.float64) / 32768
    f, p = welch(x, fs=48000, nperseg=16384)
    mask = (f >= 100) & (f <= 10000) & (p > 0)
    slope = float(np.polyfit(np.log10(f[mask]), np.log10(p[mask]), 1)[0])
    obs = index[a['sha256']]
    raw = np.load(obs['raw']['path'])
    decoded = json.loads(Path(obs['decoded']['path']).read_text())
    rows.append({'audioSha256': a['sha256'], 'samples': len(x), 'spectralLogSlope100to10000Hz': slope,
                 'maps': {k: {'max': float(raw[k].max()), 'mean': float(raw[k].mean())} for k in ['note', 'onset', 'contour']},
                 'offlineFramesOverNoteThreshold': int((raw['note'].max(axis=1) >= .3).sum()),
                 'decodedEvents': len(decoded['events']), 'decodedPitches': sorted({e['midi'] for e in decoded['events']})})
with Path(request['out']).open('x') as f:
    json.dump(rows, f, indent=2); f.write('\n')

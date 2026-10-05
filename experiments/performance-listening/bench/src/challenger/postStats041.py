import json,hashlib,math,statistics
from pathlib import Path
import sys
# GPT-6.1-Sol (high) in Codex: checks saved evidence; no inference or evaluator.
r=Path(sys.argv[1]).resolve()
s=json.loads((r/'results.json').read_text())
rows=s['rows'];latencies=[];groups=[];clock_checks=0;max_chunk=0;cost_sum=0;audio_sum=0
parity_values=0;artifact_checks=0
def checked(a):
 global artifact_checks
 data=Path(a['path']).read_bytes();assert hashlib.sha256(data).hexdigest()==a['sha256'];artifact_checks+=1;return data
for parity in s['parities']:
 p=json.loads(checked(parity['artifact']));checked(p['input'])
 for name,bins in [('note',88),('onset',88),('contour',264)]:
  candidate=checked(p['maps'][name]['candidate']);reference=checked(p['maps'][name]['reference'])
  for j in p['indices']:
   assert candidate[(j-p['begin'])*bins*4:(j-p['begin']+1)*bins*4]==reference[j*bins*4:(j+1)*bins*4]
   parity_values+=bins
for guitar in ['tonejs-acoustic','martin','spanish','fender']:
 own=[x for x in rows if x['id'].startswith(guitar+'-') or x['id'].startswith('noise-'+guitar+'-')]
 for part in ['clean','hesitation']:
  xs=[x for x in own if ('-h-' in x['id'])==(part=='hesitation')]
  groups.append({'guitar':guitar,'part':part,'performance':[sum(not x['failed'] for x in xs if x['kind']=='performance'),sum(x['kind']=='performance' for x in xs)],'wrong':[sum(not x['failed'] for x in xs if x['control']=='wrong-score'),sum(x['control']=='wrong-score' for x in xs)],'noise':[sum(not x['failed'] for x in xs if x['control']=='silence'),sum(x['control']=='silence' for x in xs)],'costClear':sum(x['costClears'] for x in xs),'examples':len(xs),'maxCost':max(x['costRatio'] for x in xs)})
for row in rows:
 live=json.loads(checked(row['live']));c=live['cost'];cost_sum+=c['work'];audio_sum+=c['audioSeconds']
 if row['kind']=='performance':latencies.extend(e['delay'] for e in live['following']['byEvent']['events'] if e['delay'] is not None)
 previous=0;work=0;watermark=None
 for call in live['calls']:
  elapsed=call['elapsed'];samples=call['samples'];expected=max(samples/48000,previous)+elapsed
  assert math.isfinite(elapsed) and elapsed>=0 and abs(expected-call['completion'])<1e-12
  previous=expected;work+=elapsed;clock_checks+=1;max_chunk=max(max_chunk,elapsed)
  if call['kind']=='feed':
   for d in call['decisions']:assert d['madeAt']==call['completion'] and 0<=d['refersTo']<=samples/48000
   assert len(call['indices'])==len(call['frames'])
   n=max(0,math.ceil((samples-1)*147/320)) if samples else 0
   for j,f in zip(call['indices'],call['frames']):
    q=n-43844+256*j
    assert q==f['q'] and f['audioTime']==q/22050 and f['availableAt']==call['completion'] and (watermark is None or q>watermark)
    watermark=q
 assert abs(work-c['work'])<1e-12 and abs(work/c['audioSeconds']-c['ratio'])<1e-12
 for prefix in row['prefixes']:
  assert prefix['pass'] and json.loads(checked(prefix['artifact']))['pass']
latencies.sort()
pct=lambda q:latencies[min(len(latencies)-1,math.ceil(len(latencies)*q)-1)]
out={'groups':groups,'costRatio':{'min':min(x['costRatio'] for x in rows),'median':statistics.median(x['costRatio'] for x in rows),'max':max(x['costRatio'] for x in rows),'weighted':cost_sum/audio_sum,'workSeconds':cost_sum,'audioSeconds':audio_sum},'lagSeconds':{'events':len(latencies),'median':statistics.median(latencies),'p95':pct(.95),'p99':pct(.99),'max':max(latencies)},'callRecurrencesChecked':clock_checks,'maxCallSeconds':max_chunk,'artifactHashChecks':artifact_checks,'rows':len(rows),'exactSelectedFloat32Values':parity_values,'parityWindowsChecked':len(s['parities'])}
out['sourceSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
out['resultsSha256']=hashlib.sha256((r/'results.json').read_bytes()).hexdigest()
encoded=json.dumps(out,indent=2)+'\n'
with (r/'statistics.json').open('x') as f:f.write(encoded)
print(encoded)

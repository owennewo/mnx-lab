"""Read-only 047 verifier. Resolves tracked sources at pinned commit after retirement.
Usage: python3 experiments/performance-listening/bench/src/challenger/verify047.py \
  experiments/performance-listening/runs/g047-challenger-input-buffers/summary.json
It hashes source/private/input records and recomputes clock, prefix and explicit-count
aggregates. It neither runs neural inference nor measures V8/native allocator traffic.
"""
import json,sys,hashlib,subprocess,math
from pathlib import Path
sp=Path(sys.argv[1]).resolve();s=json.loads(sp.read_text());exp=sp.parents[2];repo=exp.parents[1];verified={}
def sha_bytes(b):return hashlib.sha256(b).hexdigest()
def read(a):
 p=Path(a['path']);p=p if p.is_absolute() else exp/p
 b=p.read_bytes();assert sha_bytes(b)==a['sha256'],str(p);verified[str(p)]=a['sha256'];return json.loads(b)
for p,h in s['sourceHashes'].items():
 b=subprocess.check_output(['git','show',f"{s['gitCommit']}:{p}"],cwd=repo);assert sha_bytes(b)==h,p
r=read(s['results']);v=read(s['validation']);k=read(r['kernelResults']);synthetic=read(r['synthetic'])
for p,h in v['verifiedPrivateArtifacts'].items():assert sha_bytes(Path(p).read_bytes())==h,p;verified[p]=h
for a in v['citations']:read(a)
manifest=read(v['manifest']);graph=read(v['graph']);assert sha_bytes(Path(graph['path']).read_bytes())==graph['sha256']
ident=read(v['identity']);assert sha_bytes(Path(ident['modelPath']).read_bytes())==ident['modelSha256']
host=Path(s['host']['path']);assert sha_bytes(host.read_bytes())==s['host']['sha256'];hs=[json.loads(line) for line in host.read_text().splitlines()]
assert hs[0]['load'][0]<2;assert all(not h['reasons'] and h['gapSeconds']<=30 for h in hs)
assert not any(a['load'][0]>4 and b['load'][0]>4 for a,b in zip(hs,hs[1:]));assert len(hs)==s['hostChecks']['samples']
assert all(x['parity'] for x in synthetic['cases']) and synthetic['invalidBeforeMutation'] and synthetic['resetIsolation'] and synthetic['borrowedLifecycle']
old41=json.loads(Path(v['citations'][1]['path'] if Path(v['citations'][1]['path']).is_absolute() else exp/v['citations'][1]['path']).read_text());old41=read(old41['results'])
old45=json.loads((exp/v['citations'][2]['path']).read_text());old45=read(old45['results'])
def payload(xs,cutoff):return [{key:value for key,value in row.items() if key not in ['madeAt','availableAt','elapsed','completion']} for row in xs if row['deliverySamples']<=cutoff]
def clocks(a):
 c=0;total=0
 for call in a['calls']:
  t=call['elapsed'];assert math.isfinite(t) and t>=0;c=max(call['samples']/48000,c)+t;total+=t
  assert abs(c-call['completion'])<1e-12
  for f in call['frames']:assert abs(f['availableAt']-c)<1e-12
  for d in call['decisions']:assert abs(d['madeAt']-c)<1e-12
 assert abs(total-a['cost']['work'])<1e-9;assert abs(total/a['cost']['audioSeconds']-a['cost']['ratio'])<1e-12
 return len(a['calls'])
feeds=windows=bytes_old=bytes_new=raw_elems=all_calls=prefix_count=0;work=audio=0;ratios=[];delays=[]
for e,row,kr in zip(manifest['examples'],r['rows'],k['rows']):
 assert e['id']==row['id']==kr['id'];n=round(e['label']['duration']*48000)
 kernel=read(kr['artifact']);a=read(row['artifact']);b=read(next(x['live'] for x in old41['rows'] if x['id']==e['id']));c=read(next(x['artifact'] for x in old45['rows'] if x['implementation']=='challenger' and x['id']==e['id']))
 assert kernel['parity'];assert kernel['feeds']==(n+479)//480==kernel['baseline']['rawSliceArrays']
 assert kernel['requests']==len(kernel['digest'])==kernel['baseline']['windowArrays'];assert kernel['baseline']['windowBytes']==kernel['requests']*43844*4
 assert kernel['candidate']==a['allocations'];assert a['allocations']['rawArrays']==1 and a['allocations']['growths']==0 and a['allocations']['maxRawCapacity']==482
 assert a['allocations']['windowArrays']==1 and a['allocations']['windowBytes']==43844*4
 assert payload(a['payloads'],n)==payload(b['payloads'],n)==payload(c['payloads'],n)
 request=lambda x:[(call['samples'],call['inputHash'],call['indices'],call['cropBegin'],call['cropLength']) for call in x['calls'] if call.get('inputHash')]
 assert request(a)==request(b)==request(c)
 assert [(x[0],x[1],x[2]) for x in request(a)]==[(x['samples'],x['hash'],x['indices']) for x in kernel['digest']]
 all_calls+=clocks(a);work+=a['cost']['work'];audio+=a['cost']['audioSeconds'];ratios.append(a['cost']['ratio'])
 delays.extend(x['delay'] for x in a['following']['byEvent']['events'] if x['delay'] is not None)
 offline=read(a['offlineCitation']);read(offline['observations']['masked']);read(offline['observations']['decoded']);assert a['offlineUnchanged']
 for pr in row['prefixes']:
  p=read(pr['artifact']);assert payload(a['payloads'],p['cutoff'])==payload(p['payloads'],p['cutoff']);assert p['pass']==pr['pass']==True;all_calls+=clocks(p);prefix_count+=1
 feeds+=kernel['feeds'];windows+=kernel['requests'];bytes_old+=kernel['baseline']['windowBytes'];bytes_new+=a['allocations']['windowBytes'];raw_elems+=kernel['baseline']['rawSliceElements']
assert feeds==s['counts']['kernelFeeds'];assert windows==s['counts']['kernelRequests'];assert prefix_count==s['counts']['prefixes']==592
assert bytes_old==s['allocation']['baseline']['windowBytes'];assert bytes_new==s['allocation']['candidate']['windowBytes']
reduction=1-bytes_new/bytes_old;assert reduction==s['allocation']['windowByteReduction'] and reduction>=.95
assert len(r['rows'])==len(k['rows'])==s['counts']['nativeExamples']==576
out={'summarySha256':sha_bytes(sp.read_bytes()),'sourceHashes':len(s['sourceHashes']),'artifactHashes':len(verified),'clockIntervals':all_calls,
 'kernelFeeds':feeds,'kernelRequests':windows,'nativeExamples':len(r['rows']),'prefixes':prefix_count,'windowBytesBefore':bytes_old,'windowBytesAfter':bytes_new,
 'windowByteReduction':reduction,'rawSliceArraysBefore':feeds,'rawSliceArraysAfter':0,'rawSliceElementsBefore':raw_elems,'hostSamples':len(hs),
 'weightedServiceRatio':work/audio,'serviceSeconds':work,'audioSeconds':audio,'costMin':min(ratios),'costMedian':sorted(ratios)[len(ratios)//2],'costMax':max(ratios),
 'delayMax':max(delays),'readOnly':True,'stageClaim':False}
print(json.dumps(out,indent=2))

"""Read-only 048 verifier; no inference or timing rerun.
Usage: python3 experiments/performance-listening/bench/src/challenger/verify048.py \
  experiments/performance-listening/runs/g048-challenger-output-copies/summary.json
Tracked sources resolve from gitCommit after worktree retirement; private artifacts
are hashed, clocks/parity/targeted counts reconstructed from saved complete records.
"""
import json,sys,hashlib,subprocess,math,posixpath
from pathlib import Path
sp=Path(sys.argv[1]).resolve();s=json.loads(sp.read_text());exp=sp.parents[2];repo=exp.parents[1];verified={}
def sha(b):return hashlib.sha256(b).hexdigest()
def read(a,parse=True):
 p=Path(a['path']);p=p if p.is_absolute() else exp/p;b=p.read_bytes();assert sha(b)==a['sha256'],str(p);verified[str(p)]=a['sha256'];return json.loads(b) if parse else None
for p,h in s['sourceHashes'].items():
 tracked=posixpath.normpath('experiments/performance-listening/'+p);b=subprocess.check_output(['git','show',f"{s['gitCommit']}:{tracked}"],cwd=repo);assert sha(b)==h,p
read(s['attempt']);r=read(s['results']);v=read(s['validation'])
for p,h in v['verifiedPrivateArtifacts'].items():assert sha(Path(p).read_bytes())==h,p;verified[p]=h
for a in v['citations']:read(a)
manifest=read(v['manifest']);graph=read(v['graph']);assert sha(Path(graph['path']).read_bytes())==graph['sha256'];ident=read(v['identity']);assert sha(Path(ident['modelPath']).read_bytes())==ident['modelSha256']
old47=read(read(v['citations'][1])['results']);old39=read(read(v['citations'][0])['results'])
host=Path(s['host']['path']);assert sha(host.read_bytes())==s['host']['sha256'];hs=[json.loads(line) for line in host.read_text().splitlines()]
assert hs[0]['load'][0]<2;assert all(not h['reasons'] and h['gapSeconds']<=30 for h in hs)
assert not any(a['load'][0]>4 and b['load'][0]>4 for a,b in zip(hs,hs[1:]));assert len(hs)==s['hostChecks']['samples']
assert all(not any(a['state']=='working' and a['pane']!=h['ownPane'] for a in h['agents']) for h in hs)
def payload(xs,cutoff):return [{k:v for k,v in row.items() if k not in ['madeAt','availableAt','elapsed','completion']} for row in xs if row['deliverySamples']<=cutoff]
def clocks(a):
 c=total=0
 for call in a['calls']:
  t=call['elapsed'];assert math.isfinite(t) and t>=0;c=max(call['samples']/48000,c)+t;total+=t;assert abs(c-call['completion'])<1e-12
  for f in call['frames']:assert abs(f['availableAt']-c)<1e-12
  for d in call['decisions']:assert abs(d['madeAt']-c)<1e-12
 assert abs(total-a['cost']['work'])<1e-9;assert abs(total/a['cost']['audioSeconds']-a['cost']['ratio'])<1e-12
 return len(a['calls'])
def request(a):return [(q['samples'],q['inputHash'],q['indices'],q['cropBegin'],q['cropLength']) for q in a['calls'] if q.get('inputHash')]
def counts(a,kind):
 req=request(a);assert len(req)==len(a['requests'])==a['cost']['modelCalls'];assert a['snapshotsStable']
 result=dict(requests=0,neuralFrames=0,sliceArrays=0,sliceBytes=0,workerCopyBytes=0)
 for q,t in zip(req,a['requests']):
  assert q[0]==t['samples'] and q[1]==t['inputHash'] and q[2]==t['indices'] and q[3]==t['begin'] and q[4]==t['length'];length=t['length'];assert length==172-t['begin'] and 1<=length<=172
  assert len(t['noteSha256'])==64;expected={'note':88} if kind=='candidate' else {'note':88,'onset':88,'contour':264}
  assert set(t['arrays'])==set(expected)
  for key,bins in expected.items():assert t['arrays'][key]==dict(elements=length*bins,bytes=length*bins*4)
  n=len(expected);b=length*sum(expected.values())*4;assert t['sliceArrays']==n and t['sliceBytes']==t['workerCopyBytes']==b
  result['requests']+=1;result['neuralFrames']+=length;result['sliceArrays']+=n;result['sliceBytes']+=b;result['workerCopyBytes']+=b
 return result
before=dict(requests=0,neuralFrames=0,sliceArrays=0,sliceBytes=0,workerCopyBytes=0);after=before.copy();all_calls=prefixes=0;costs={'parent':[],'candidate':[]};work={'parent':0.,'candidate':0.};audio=0.;delays=[];by_group={}
assert len(manifest['examples'])==len(r['rows'])==576
for ordinal,(e,row) in enumerate(zip(manifest['examples'],r['rows'])):
 assert e['id']==row['id'];n=round(e['label']['duration']*48000);assert sha(Path(e['audioPath']).read_bytes())==e['label']['audio']['sha256']
 a=read(row['artifacts']['parent']);b=read(row['artifacts']['candidate']);old=read(next(x['artifact'] for x in old47['rows'] if x['id']==e['id']))
 assert row['order']==(['candidate','parent'] if ordinal%2 else ['parent','candidate'])
 assert payload(a['payloads'],n)==payload(b['payloads'],n)==payload(old['payloads'],n)
 assert request(a)==request(b)==request(old)
 tensor=lambda x:[(q['samples'],q['begin'],q['length'],q['noteSha256']) for q in x['requests']]
 assert tensor(a)==tensor(b);assert a['allocations']==b['allocations']==old['allocations']
 for flag in ['noteParity','requestParity','payloadParity','inputStorageParity','snapshotsStable','offlineVerified']:assert row[flag]
 group=by_group.setdefault(f"{row['guitar']}/{row['part']}",dict(examples=0,requests=0,parentSliceBytes=0,candidateSliceBytes=0));group['examples']+=1
 for kind,x,total,key in [('parent',a,before,'parentCounts'),('candidate',b,after,'candidateCounts')]:
  all_calls+=clocks(x);computed=counts(x,kind);assert computed==row[key]
  for k,value in computed.items():total[k]+=value
  costs[kind].append(x['cost']['ratio']);work[kind]+=x['cost']['work'];group[kind+'SliceBytes']+=computed['sliceBytes']
 group['requests']+=row['candidateCounts']['requests'];audio+=b['cost']['audioSeconds'];delays.extend(x['delay'] for x in b['following']['byEvent']['events'] if x['delay'] is not None)
 offline=read(b['offlineCitation']);assert b['offlineCitation']==old39[e['id']]['artifact'];read(offline['observations']['masked'],False);read(offline['observations']['decoded'])
 for pr in row['prefixes']:
  p=read(pr['artifact']);assert payload(b['payloads'],p['cutoff'])==payload(p['payloads'],p['cutoff']);assert p['pass']==pr['pass']==True;counts(p,'candidate');all_calls+=clocks(p);prefixes+=1
assert prefixes==s['counts']['prefixes']==592;assert before==r['before']==s['allocation']['before'];assert after==r['after']==s['allocation']['after'];assert after['sliceBytes']*5==before['sliceBytes'];assert after['sliceArrays']*3==before['sliceArrays'];assert after['workerCopyBytes']*5==before['workerCopyBytes']
assert r['sharedOutput']==s['allocation']['sharedOutput']==dict(parent=302720,candidate=60544);assert s['decision']=='D1' and r['parity'] and r['resourcePass']
assert s['counts']==dict(pairedExamples=576,nativePrimaryExecutions=1152,noteIdentities=576,payloadIdentities=576,requestIdentities=576,inputStorageIdentities=576,offlineVerified=576,prefixes=592,prefixesAgree=592)
out={'summarySha256':sha(sp.read_bytes()),'sourceHashes':len(s['sourceHashes']),'artifactHashes':len(verified),'clockIntervals':all_calls,'pairedExamples':576,'prefixes':prefixes,'before':before,'after':after,'sharedOutput':r['sharedOutput'],'allocationReduction':1-after['sliceBytes']/before['sliceBytes'],'audioSecondsPerArm':audio,'serviceSeconds':work,'weightedServiceRatio':{k:value/audio for k,value in work.items()},'costMedian':{k:sorted(v)[len(v)//2] for k,v in costs.items()},'costMax':{k:max(v) for k,v in costs.items()},'delayMax':max(delays),'hostSamples':len(hs),'hostStartLoad1':hs[0]['load'][0],'hostMaxLoad1':max(h['load'][0] for h in hs),'hostMaxGapSeconds':max(h['gapSeconds'] for h in hs),'byGroup':by_group,'readOnly':True,'stageClaim':False}
print(json.dumps(out,indent=2))

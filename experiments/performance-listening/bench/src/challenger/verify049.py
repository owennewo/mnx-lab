"""Read-only 049 eligibility reconstruction; never runs inference or the collector.
Usage: python3 experiments/performance-listening/bench/src/challenger/verify049.py \
 experiments/performance-listening/runs/g049-challenger-dsp-cache/summary.json
Tagged tracked-source paths remain resolvable after worktree retirement.
"""
import json,sys,hashlib,subprocess,posixpath,math
from pathlib import Path
sp=Path(sys.argv[1]).resolve();s=json.loads(sp.read_text());exp=sp.parents[2];repo=exp.parents[1];verified={}
def sha(b):return hashlib.sha256(b).hexdigest()
def read(a,parse=True):
 p=Path(a['path']);p=p if p.is_absolute() else exp/p;b=p.read_bytes();assert sha(b)==a['sha256'],str(p);verified[str(p)]=a['sha256'];return json.loads(b) if parse else None
for p,h in s['sourceHashes'].items():
 tracked=posixpath.normpath('experiments/performance-listening/'+p);b=subprocess.check_output(['git','show',f"{s['gitCommit']}:{tracked}"],cwd=repo);assert sha(b)==h,p
read(s['attempt']);r=read(s['results']);v=read(s['validation']);inspection=read(s['inspection'])
for p,h in v['verifiedPrivateArtifacts'].items():assert sha(Path(p).read_bytes())==h,p;verified[p]=h
old48=read(read(v['citations'][0])['results']);old39=read(read(v['citations'][1])['results'])
manifest=read(v['manifest']);graph=read(v['graph']);read(dict(path=graph['path'],sha256=graph['sha256']),False);identity=read(v['identity']);read(dict(path=identity['modelPath'],sha256=identity['modelSha256']),False);read(v['signal'],False)
assert inspection['sha256']==graph['sha256'];assert inspection['hop']==256;assert inspection['convolutions'][0]['strides']==[1,256];assert inspection['convolutions'][0]['kernel']==[1,256]
for a in [s['host']['start'],s['host']['end']]:assert read(a)['formalTiming']==False
assert s['host']['formalTiming']==False and s['nativeInferenceCalls']==0 and not s['listenerVersionAdded'] and s['newVersions']==0
counts=dict(examples=0,feeds=0,requests=0,wholeHits=0,phasePairs=0,overlapPairs=0,requestsIdentical=0,primaryCitations=0,prefixCitations=0,offlineCitations=0);shifts={};groups={};all_parity=True
assert len(manifest['examples'])==len(r['rows'])==576
for e,row in zip(manifest['examples'],r['rows']):
 assert e['id']==row['id'];a=read(row['artifact']);assert a['id']==e['id'];assert sha((json.dumps(e['label'],indent=2,separators=(',', ': '))+'\n').encode())==a['labelSha256'];read(dict(path=e['audioPath'],sha256=e['label']['audio']['sha256']),False)
 prior=next(x for x in old48['rows'] if x['id']==e['id']);assert a['reference']==prior['artifacts']['candidate'];reference=read(a['reference'])
 digest=lambda xs:[(x['samples'],x['inputHash'],x['indices'],x['cropBegin'],x['cropLength']) for x in xs]
 parity=digest(a['requests'])==digest([x for x in reference['calls'] if x.get('inputHash')]);assert a['requestParity']==row['requestParity']==parity;all_parity=all_parity and parity
 assert a['allocations']==reference['allocations'];assert a['snapshotBytes']==43844*4
 n=round(e['label']['duration']*48000);assert a['feeds']==row['feeds']==math.ceil(n/480);assert len(a['requests'])==row['requests']==n//4800
 hits=phase=overlap=0
 for j,q in enumerate(a['requests']):
  assert q['samples']==(j+1)*4800;generated=((q['samples']-1)*147+319)//320;assert q['generated']==generated and q['windowStart']==generated-43844
  last=a['requests'][j-1] if j else None;hit=last is not None and last['inputHash']==q['inputHash'];assert hit==q['memoHit'];hits+=hit
  delta=q['generated']-last['generated'] if last else None;assert delta==q['shift']
  if delta is not None:shifts[delta]=shifts.get(delta,0)+1
  pairs=[old for old in a['requests'][:j] if 0<q['windowStart']-old['windowStart']<43844]
  compatible=[old for old in pairs if (q['windowStart']-old['windowStart'])%256==0]
  assert len(pairs)==q['overlapPairs'];assert len(compatible)==q['phaseOverlapPairs'];overlap+=len(pairs);phase+=len(compatible)
 assert hits==a['wholeHits']==row['wholeHits'];assert phase==a['phasePairs']==row['phasePairs'];assert overlap==a['overlapPairs']==row['overlapPairs']
 assert a['prefixCitations']==[x['artifact'] for x in prior['prefixes']]
 for x in a['prefixCitations']:assert read(x)['pass']
 assert a['offlineCitation']==old39[e['id']]['artifact'];offline=read(a['offlineCitation']);read(offline['observations']['masked'],False);read(offline['observations']['decoded'])
 add=dict(examples=1,feeds=a['feeds'],requests=len(a['requests']),wholeHits=hits,phasePairs=phase,overlapPairs=overlap,requestsIdentical=int(parity),primaryCitations=1,prefixCitations=len(a['prefixCitations']),offlineCitations=1)
 for k,value in add.items():counts[k]+=value
 key=f"{row['guitar']}/{row['part']}";g=groups.setdefault(key,dict(examples=0,requests=0,wholeHits=0,phasePairs=0));g['examples']+=1;g['requests']+=len(a['requests']);g['wholeHits']+=hits;g['phasePairs']+=phase
assert counts==r['counts']==s['counts'];assert all_parity==r['parity'];decision='D3' if not all_parity else 'D1' if counts['wholeHits'] or counts['phasePairs'] else 'D2';assert decision==r['decision']==s['decision']
assert r['opportunity']['wholeDSPCallsAvoided']==s['opportunity']['wholeDSPCallsAvoided']==counts['wholeHits'];assert r['opportunity']['phaseEligiblePairs']==s['opportunity']['phaseEligiblePairs']==counts['phasePairs'];assert r['opportunity']['snapshotCopiedBytes']==counts['requests']*43844*4
assert counts['prefixCitations']==592;assert s['heldOutReservedAccesses']==0 and not s['stageClaim'] and not s['promotion'];assert s['stopping']['challengerVersions']==5
out=dict(summarySha256=sha(sp.read_bytes()),decision=decision,sourceHashes=len(s['sourceHashes']),artifactHashes=len(verified),counts=counts,shifts=shifts,phaseCycleRequests=256//math.gcd(2205,256),phaseCycleSamples=2205*(256//math.gcd(2205,256)),windowSamples=43844,byGroup=groups,snapshotCopiedBytes=r['opportunity']['snapshotCopiedBytes'],readOnly=True,stageClaim=False,nativeInferenceCalls=0)
print(json.dumps(out,indent=2))

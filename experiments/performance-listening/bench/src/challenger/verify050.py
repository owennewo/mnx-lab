"""Read-only verification for 050; no inference or timing rerun.
Usage: python3 experiments/performance-listening/bench/src/challenger/verify050.py \
  experiments/performance-listening/runs/g050-challenger-optimized-stage/summary.json
Tracked sources and citations resolve by pinned git commit or experiment-relative path
so verification remains usable after worktree retirement.
"""
import json,sys,hashlib,math,subprocess,posixpath
from pathlib import Path
summary_path=Path(sys.argv[1]).resolve();s=json.loads(summary_path.read_text());root=summary_path.parents[2]
repo=root.parents[1];verified={}
for p,h in s['sourceHashes'].items():
 tracked=posixpath.normpath('experiments/performance-listening/'+p)
 assert hashlib.sha256(subprocess.check_output(['git','show',f"{s['gitCommit']}:{tracked}"],cwd=repo)).hexdigest()==h,p
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(a):
 p=Path(a['path']);p=p if p.is_absolute() else root/p
 assert sha(p)==a['sha256'],str(p);verified[str(p)]=a['sha256'];return json.loads(p.read_text())
r=read(s['results']);v=read(s['validation'])
for p,h in v['verifiedArtifacts'].items():
 if Path(p).is_absolute():assert sha(p)==h,p;verified[p]=h
 else:
  tracked=posixpath.normpath('experiments/performance-listening/'+p)
  assert hashlib.sha256(subprocess.check_output(['git','show',f"{s['gitCommit']}:{tracked}"],cwd=repo)).hexdigest()==h,p
read(s['attempt'])
manifest=read(v['manifest']);assert len(manifest['examples'])==576
refs=[read(a) for a in v['citations']]
old39=read(refs[0]['results']);old48=read(refs[2]['results'])
ident=read(v['identity']);assert sha(ident['modelPath'])==ident['modelSha256']
graph=read(v['graph']);assert sha(graph['path'])==graph['sha256']
hp=Path(s['host']['path']);assert sha(hp)==s['host']['sha256'];hs=[json.loads(x) for x in hp.read_text().splitlines()]
assert len(hs)==s['hostChecks']['samples'] and hs[0]['load'][0]<2
for i,h in enumerate(hs):
 assert not h['reasons'] and h['gapSeconds']<=30
 assert h['ownPane']==s['hostChecks']['ownPane'] and h['ownSession']==s['hostChecks']['ownSession']
 assert any(a['pane']==h['ownPane'] and a['session']==h['ownSession'] for a in h['agents'])
 assert not any(a['state']=='working' and a['pane']!=h['ownPane'] for a in h['agents'])
 if i:
  assert abs((h['monotonicMs']-hs[i-1]['monotonicMs'])/1000-h['gapSeconds'])<1e-9
  assert not(h['load'][0]>4 and hs[i-1]['load'][0]>4)
assert max(h['gapSeconds'] for h in hs)==s['hostChecks']['maxGapSeconds']
expected_ids={e['id'] for e in manifest['examples']}
assert len(r['rows'])==1536 and len({(x['implementation'],x['id']) for x in r['rows']})==1536
all_calls=0;by_impl={};delays=[];cost=[];work=0;audio=0;max_backlog=0;zero_service_feeds=0
def payload(xs,cutoff):return [{k:v for k,v in x.items() if k not in ['madeAt','availableAt','elapsed','completion']} for x in xs if x['deliverySamples']<=cutoff]
for row in r['rows']:
 a=read(row['artifact']);completion=0;total=0
 for call in a['calls']:
  service=call['elapsed'];assert math.isfinite(service) and service>=0
  delivery=call['samples']/48000;completion=max(delivery,completion)+service
  assert abs(completion-call['completion'])<1e-12,(row['id'],call)
  total+=service;all_calls+=1
  for f in call['frames']:assert abs(f['availableAt']-completion)<1e-12
  for d in call['decisions']:assert abs(d['madeAt']-completion)<1e-12
 assert abs(total-a['cost']['work'])<1e-9
 assert abs(total/a['cost']['audioSeconds']-a['cost']['ratio'])<1e-12
 prefixes=[]
 for p in row['prefixes']:
  b=read(p['artifact']);c=0
  for call in b['calls']:
   c=max(call['samples']/48000,c)+call['elapsed'];assert abs(c-call['completion'])<1e-12
   all_calls+=1
  def payload(xs):return [{k:v for k,v in x.items() if k not in ['madeAt','availableAt','elapsed','completion']} for x in xs if x['deliverySamples']<=b['cutoff']]
  independently_equal=payload(a['payloads'])==payload(b['payloads'])
  assert independently_equal==p['pass']==b['pass']==True;prefixes.append(independently_equal)
 by_impl.setdefault(row['implementation'],{'examples':0,'prefixes':0,'prefixesAgree':0})
 by_impl[row['implementation']]['examples']+=1;by_impl[row['implementation']]['prefixes']+=len(prefixes);by_impl[row['implementation']]['prefixesAgree']+=sum(prefixes)
 assert a['cursorGates']['failed']==row['cursorFailed'] and a['assessmentGates']['failed']==row['assessmentFailed']
 assert a['cost']['ratio']==row['costRatio'] and row['costPass']==(row['costRatio']<=.25)
 if row['implementation']=='challenger':
  n=round(a['cost']['audioSeconds']*48000)
  previous=read(next(x['artifacts']['candidate'] for x in old48['rows'] if x['id']==row['id']))
  offline=read(old39[row['id']]['artifact'])
  assert payload(a['payloads'],n)==payload(previous['payloads'],n)
  assert a['report']==offline['report'] and row['reportIdentical'] and row['liveIdentical']
  assert a['observations']==offline['observations']
  for art in offline['observations'].values():
   if isinstance(art,dict) and 'path' in art:assert sha(art['path'])==art['sha256'];verified[art['path']]=art['sha256']
  cost.append(a['cost']['ratio']);work+=total;audio+=a['cost']['audioSeconds'];max_backlog=max(max_backlog,a['cost']['maxBacklog'])
  for e in a['following']['byEvent']['events']:
   if e['delay'] is not None:delays.append(e['delay'])
  zero_service_feeds+=sum(not call.get('frames') for call in a['calls'] if call['kind']=='feed')
assert by_impl['challenger']==dict(examples=576,prefixes=592,prefixesAgree=592)
assert by_impl['incumbent']==dict(examples=576,prefixes=592,prefixesAgree=592)
for key,x in by_impl.items():
 if key not in ['challenger','incumbent']:assert x==dict(examples=96,prefixes=104,prefixesAgree=104)
 assert {row['id'] for row in r['rows'] if row['implementation']==key}=={e['id'] for e in manifest['examples'] if key in ['challenger','incumbent'] or '-h-' not in e['of']}
for key,group in r['groups'].items():
 assert group==s['groups'][key]
 impl,g,part=key.split(':') if key.count(':')==2 else (*key.split(':'),None)
 rows=[x for x in r['rows'] if x['implementation']==impl and (g=='all' or x['guitar']==g and x['part']==part)]
 assert group['examples']==len(rows)
 for name,pred in [('cursorPassed',lambda x:not x['cursorFailed']),('assessmentPassed',lambda x:not x['assessmentFailed']),('costPassed',lambda x:x['costPass'])]:assert group[name]==sum(bool(pred(x)) for x in rows)
 all_passed=all(not x['cursorFailed'] and not x['assessmentFailed'] and x['costPass'] and all(p['pass'] for p in x['prefixes']) for x in rows) and all(p['passed'] for p in group['pools'])
 assert all_passed==group['allPassed']
assert s['criterion']['challengerPass']==s['groups']['challenger:all']['allPassed']
assert s['criterion']['allPrefixes'] and s['criterion']['identityPass']
assert s['decision']==('D1' if all(s['criterion'].values()) else 'D2')
def quantile(xs,p):return sorted(xs)[math.ceil(len(xs)*p)-1]
out={'publicSummarySha256':sha(summary_path),'verifiedArtifacts':len(verified),'verifiedPrivateArtifacts':sum(str(p).startswith('/home/williao/dev/mnx-listening-data/') for p in verified),'clockRecurrences':all_calls,'implementations':by_impl,'candidate':{'work':work,'audio':audio,'weightedRatio':work/audio,'costMin':min(cost),'costMedian':quantile(cost,.5),'costMax':max(cost),'eventsWithDelay':len(delays),'delayMin':min(delays),'delayMedian':quantile(delays,.5),'delayP95':quantile(delays,.95),'delayP99':quantile(delays,.99),'delayMax':max(delays),'maxBacklog':max_backlog,'emissionFreeFeedsIncluded':zero_service_feeds},'readerSha256':sha(__file__),'sourceHashes':len(s['sourceHashes']),'hostSamples':len(hs),'hostStartLoad1':hs[0]['load'][0],'hostMaxLoad1':max(h['load'][0] for h in hs),'hostMaxGapSeconds':max(h['gapSeconds'] for h in hs),'decision':s['decision'],'readOnly':True}
print(json.dumps(out,indent=2))

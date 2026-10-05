"""Read-only verification and descriptive statistics for the completed 043 record."""
import json,sys,hashlib,math
from pathlib import Path
summary_path=Path(sys.argv[1]);s=json.loads(summary_path.read_text());root=summary_path.parents[2]
verified={}
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def read(a):
 p=Path(a['path']);p=p if p.is_absolute() else root/p
 assert sha(p)==a['sha256'],str(p);verified[str(p)]=a['sha256'];return json.loads(p.read_text())
r=read(s['results']);v=read(s['validation'])
for p,h in v['verifiedArtifacts'].items(): assert sha(p)==h,p;verified[p]=h
all_calls=0;by_impl={};delays=[];cost=[];work=0;audio=0;max_backlog=0;zero_service_feeds=0
for row in r['rows']:
 a=read(row['artifact']);completion=0;total=0
 for call in a['calls']:
  service=call['elapsed'];assert math.isfinite(service) and service>=0
  delivery=call['samples']/48000;completion=max(delivery,completion)+service
  assert abs(completion-call['completion'])<1e-12,(row['id'],call)
  total+=service;all_calls+=1
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
  assert independently_equal==p['pass']==b['pass'];prefixes.append(independently_equal)
 by_impl.setdefault(row['implementation'],{'examples':0,'prefixes':0,'prefixesAgree':0})
 by_impl[row['implementation']]['examples']+=1;by_impl[row['implementation']]['prefixes']+=len(prefixes);by_impl[row['implementation']]['prefixesAgree']+=sum(prefixes)
 if row['implementation']=='challenger':
  cost.append(a['cost']['ratio']);work+=total;audio+=a['cost']['audioSeconds'];max_backlog=max(max_backlog,a['cost']['maxBacklog'])
  for e in a['following']['byEvent']['events']:
   if e['delay'] is not None:delays.append(e['delay'])
  zero_service_feeds+=sum(not call.get('frames') for call in a['calls'] if call['kind']=='feed')
def quantile(xs,p):return sorted(xs)[math.ceil(len(xs)*p)-1]
out={'publicSummarySha256':sha(summary_path),'verifiedArtifacts':len(verified),'verifiedPrivateArtifacts':sum(str(p).startswith('/home/williao/dev/mnx-listening-data/') for p in verified),'clockRecurrences':all_calls,'implementations':by_impl,'candidate':{'work':work,'audio':audio,'weightedRatio':work/audio,'costMin':min(cost),'costMedian':quantile(cost,.5),'costMax':max(cost),'eventsWithDelay':len(delays),'delayMin':min(delays),'delayMedian':quantile(delays,.5),'delayP95':quantile(delays,.95),'delayP99':quantile(delays,.99),'delayMax':max(delays),'maxBacklog':max_backlog,'emissionFreeFeedsIncluded':zero_service_feeds},'readerSha256':sha(__file__)}
print(json.dumps(out,indent=2))

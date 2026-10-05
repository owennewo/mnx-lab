"""Read-only 046 verification; no listener execution. Sources resolve at tagged commit.
Usage: python3 experiments/performance-listening/bench/src/challenger/postStats046.py <summary.json>
"""
import json,hashlib,sys,pathlib,math,subprocess,posixpath
summary=json.loads(pathlib.Path(sys.argv[1]).read_text());repo=pathlib.Path(__file__).resolve().parents[5];checked=set()
def verify(a):
 p=pathlib.Path(a['path']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==a['sha256'],str(p);checked.add(str(p));return json.loads(b) if p.suffix in ('.json','.cpuprofile','.heapprofile') else b
for p,h in summary['sourceHashes'].items():
 path=posixpath.normpath('experiments/performance-listening/'+p);b=subprocess.check_output(['git','show',summary['gitCommit']+':'+path],cwd=repo);assert hashlib.sha256(b).hexdigest()==h,path
validation=verify(summary['validation'])
for p,h in validation['checked'].items():
 assert hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h,p;checked.add(p)
for p,h in validation['trackedChecks'].items():
 b=subprocess.check_output(['git','show',summary['gitCommit']+':'+p],cwd=repo);assert hashlib.sha256(b).hexdigest()==h,p
result=verify(summary['results']);verify(summary['host']);verify(summary['scheduler'])
host=[json.loads(l) for l in pathlib.Path(summary['host']['path']).read_text().splitlines()];assert not any(x['reasons'] for x in host);assert max(x['gap'] for x in host)<=30
arms=[];services=0
for arm in result['arms']:
 own=[r for r in result['rows'] if r['arm']==arm['arm']];gcmax=[];wall=0;seconds=0;targets=[];exact=[];phase={} ;profiles=[]
 for r in own:
  d=verify(r['artifact']);t=d['trace'];n=len(t)//8;services+=n
  samples=round(d['cost']['audioSeconds']*48000);assert abs(samples/48000-d['cost']['audioSeconds'])<1e-12
  assert n==(samples+479)//480+2,(d['id'],d['kind'],n)
  elapsed=[(t[i*8+1]-t[i*8])/1000 for i in range(n)];assert abs(sum(elapsed)-d['cost']['work'])<1e-9,d['id'];assert abs(elapsed[0]-d['cost']['setup'])<1e-9;assert abs(elapsed[-1]-d['cost']['finish'])<1e-9
  completion=elapsed[0];completions=[completion]
  for i in range(1,n):
   delivery=min(i*.01,d['cost']['audioSeconds']);completion=max(delivery,completion)+elapsed[i];completions.append(completion)
  for p in d['payloads']:
   i=math.ceil(p['deliverySamples']/480);stamp=p.get('availableAt',p.get('madeAt'));assert abs(stamp-completions[i])<1e-9,(d['id'],d['kind'],stamp,completions[i])
  if r['evaluation']:verify(r['evaluation'])
  assert r['identity'] and r['identity41'] is not False and r['reportIdentical'] is not False
  gcmax += [g['duration'] for g in d['gc']]
  if r['kind']=='primary':wall+=d['cost']['work'];seconds+=d['cost']['audioSeconds']
  for ph in d['phases']:phase[ph['name']]=phase.get(ph['name'],0)+ph['end']-ph['start']
  for target in r['targets']:
   i=target['service'];start,end,cpu0,cpu1,wait0,wait1=t[i*8:i*8+6];overlap=sum(max(0,min(end,g['end'])-max(start,g['start'])) for g in d['gc']);assert abs(overlap-target['gcOverlapMs'])<1e-8
   targets.append({'id':r['id'],'kind':r['kind'],'startEpochMs':d['timeOrigin']+start,'endEpochMs':d['timeOrigin']+end,**target})
  historical={'martin-w2-s1-99':62880,'fender-h-s2-90-2000':250560,'martin-h-s2-90-2000':322560,'martin-h-s2-99-2000':265440}.get(r['id'])
  if historical and r['kind']=='primary':
   i=historical//480;start,end,cpu0,cpu1,wait0,wait1=t[i*8:i*8+6];overlap=sum(max(0,min(end,g['end'])-max(start,g['start'])) for g in d['gc']);exact.append({'id':r['id'],'samples':historical,'wallMs':end-start,'cpuMs':(cpu1-cpu0)/1e6,'runqueueMs':(wait1-wait0)/1e6,'gcOverlapMs':overlap,'inference':i in d['inference']})
 for a in arm['profiles']:
  p=verify(a)
  if a['path'].endswith('.cpuprofile'):
   nodes={node['id']:node['callFrame']['functionName'] or node['callFrame']['url'] for node in p['nodes']};weights={}
   for node,delta in zip(p.get('samples',[]),p.get('timeDeltas',[])):weights[nodes[node]]=weights.get(nodes[node],0)+delta/1000
   profiles.append({'path':a['path'],'type':'cpu','samples':len(p.get('samples',[])),'topMs':sorted(weights.items(),key=lambda x:-x[1])[:12]})
  elif a['path'].endswith('.heapprofile'):
   entries=[]
   def visit(node,stack):
    f=node['callFrame'];stack=stack+[f['functionName'] or f['url']];entries.append((node['selfSize'],stack[-5:]));
    for child in node.get('children',[]):visit(child,stack)
   visit(p['head'],[]);profiles.append({'path':a['path'],'type':'allocation','sampledBytes':sum(x[0] for x in entries),'topBytes':sorted(entries,reverse=True)[:20]})
 for a in arm['snapshots']:verify(a)
 arms.append({'arm':arm['arm'],'examples':sum(r['kind']=='primary' for r in own),'executions':len(own),'identical':sum(r['kind']=='primary' and r['identity'] and r['identity41'] for r in own),'assessmentIdentical':sum(r['reportIdentical'] is True for r in own),'prefixesAgree':sum(r['kind']!='primary' and r['identity'] for r in own),'wallServiceSeconds':wall,'audioSeconds':seconds,'weightedRatio':wall/seconds,'maxPrimaryCost':max(r['cost']['ratio'] for r in own if r['kind']=='primary'),'gcEvents':len(gcmax),'maxGcMs':max(gcmax,default=0),'targets50ms':targets,'historicalPoints':exact,'maxHeap':max(r['memoryAfter']['heapUsed'] for r in own),'minHeap':min(r['memoryAfter']['heapUsed'] for r in own),'phaseMs':phase,'profiles':profiles,'snapshots':arm['snapshots'],'done':arm['done']})
print(json.dumps({'verifiedArtifacts':len(checked),'sourceHashes':len(summary['sourceHashes']),'services':services,'hostSamples':len(host),'hostMaxGap':max(x['gap'] for x in host),'hostMaxLoad':max(x['load'][0] for x in host),'arms':arms},indent=2))

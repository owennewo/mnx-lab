"""Read-only artifact/clock/trace verification; no candidate execution."""
import json,hashlib,sys,pathlib,math
root=pathlib.Path(sys.argv[1]);summary=json.loads(root.read_text());checked={}
def verify(a):
 p=pathlib.Path(a['path']);b=p.read_bytes();assert hashlib.sha256(b).hexdigest()==a['sha256'],str(p);checked[str(p)]=a['sha256'];return json.loads(b) if p.suffix=='.json' or p.suffix=='.cpuprofile' else b
result=verify(summary['results']);host=verify(summary['host']);validation=verify(summary['validation'])
for p,h in validation['checked'].items():
 assert hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()==h,p;checked[p]=h
arms=[]
for arm in summary['arms']:
 own=[r for r in result['rows'] if r['arm']==arm['arm']];gcmax=[];work=0;seconds=0;profileinfo=[];traces=0;services=0;targets=[];exact=[]
 for r in own:
  d=verify(r['artifact']);t=d['trace'];n=len(t)//8;services+=n
  assert n==math.ceil(d['cost']['audioSeconds']*100)+2,(d['id'],n)
  elapsed=[(t[i*8+1]-t[i*8])/1000 for i in range(n)];assert abs(sum(elapsed)-d['cost']['work'])<1e-9,d['id'];assert abs(elapsed[0]-d['cost']['setup'])<1e-9;assert abs(elapsed[-1]-d['cost']['finish'])<1e-9
  completion=elapsed[0];completions=[completion]
  for i in range(1,n):
   delivery=min(i*.01,d['cost']['audioSeconds']);completion=max(delivery,completion)+elapsed[i];completions.append(completion)
  for p in d['payloads']:
   samples=p['deliverySamples'];i=math.ceil(samples/480);expected=completions[i];stamp=p.get('availableAt',p.get('madeAt'));assert abs(stamp-expected)<1e-9,(d['id'],stamp,expected)
  gcmax += [g['duration'] for g in d['gc']];work+=d['cost']['work'];seconds+=d['cost']['audioSeconds']
  for target in r['targets']:targets.append({'id':r['id'],**target})
  original={'martin-w2-s1-99':62880,'fender-h-s2-90-2000':250560}.get(r['id'])
  if original:
   i=original//480;start,end,cpu0,cpu1,wait0,wait1=t[i*8:i*8+6];overlap=sum(max(0,min(end,g['end'])-max(start,g['start'])) for g in d['gc'])
   exact.append({'id':r['id'],'samples':original,'wallMs':end-start,'cpuMs':(cpu1-cpu0)/1e6,'runqueueMs':(wait1-wait0)/1e6,'gcOverlapMs':overlap,'inference':i in d['inference']})
 for a in arm['profiles']:
  p=verify(a)
  if a['path'].endswith('.cpuprofile'):
   nodes={node['id']:node['callFrame']['functionName'] or node['callFrame']['url'] for node in p['nodes']};weights={}
   for node,delta in zip(p.get('samples',[]),p.get('timeDeltas',[])):weights[nodes[node]]=weights.get(nodes[node],0)+delta/1000
   profileinfo.append({'path':a['path'],'samples':len(p.get('samples',[])),'topMs':sorted(weights.items(),key=lambda x:-x[1])[:15]})
  else:traces+=len(p.get('traceEvents',[]))
 arms.append({'arm':arm['arm'],'examples':len(own),'services':services,'wallServiceSeconds':work,'audioSeconds':seconds,'weightedRatio':work/seconds,'maxCost':max(r['cost']['ratio'] for r in own),'maxNoInferenceMs':max(r['maxNoInferenceMs'] for r in own),'identical':sum(r['identity'] for r in own),'gcEvents':sum(r['gcEvents'] for r in own),'maxGcMs':max(gcmax,default=0),'targets50ms':targets,'originalSamples':exact,'profiles':profileinfo,'v8TraceEvents':traces})
# Inspect actual active-session ticks without treating lifetime %CPU as concurrent work.
activity={}
for prev,cur in zip(host,host[1:]):
 before={p['pid']:p for p in prev['processes']}
 for p in cur['processes']:
  if p['comm'] not in ['codex','claude'] or p['pid'] not in before:continue
  delta=p['cpuTicks']-before[p['pid']]['cpuTicks'];activity[p['pid']]=max(activity.get(p['pid'],0),delta)
output={'verifiedArtifacts':len(checked),'hostSamples':len(host),'hostLoadFirst':host[0]['load'],'hostLoadLast':host[-1]['load'],'maxAgentTickDelta':activity,'arms':arms}
print(json.dumps(output,indent=2))

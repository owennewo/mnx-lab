"""Compare identical native live input tensors with pinned Python CPU inference."""
import sys,json
from pathlib import Path
import numpy as np
import onnxruntime as ort
request=json.loads(Path(sys.argv[1]).read_text())
o=ort.SessionOptions();o.intra_op_num_threads=1;o.inter_op_num_threads=1
s=ort.InferenceSession(request['model'],sess_options=o,providers=['CPUExecutionProvider'])
rows=[]
for t in request['tensors']:
    x=np.fromfile(t['input']['path'],dtype='<f4').reshape(1,43844,1)
    r=s.run(['StatefulPartitionedCall:1','StatefulPartitionedCall:2','StatefulPartitionedCall:0'],{'serving_default_input_2:0':x})
    err={k:float(np.max(np.abs(a.reshape(-1)-np.fromfile(t[k]['path'],dtype='<f4')))) for k,a in zip(['note','onset','contour'],r)}
    rows.append({'id':t['id'],'errors':err,'passed':max(err.values())<=1e-5})
with Path(request['out']).open('x') as f:json.dump(rows,f,indent=2)

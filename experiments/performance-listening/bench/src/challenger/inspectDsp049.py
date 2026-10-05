"""Read pinned graph metadata only, never infer or alter the graph."""
import json,sys,hashlib
from pathlib import Path
import onnx
from onnx import numpy_helper
p=Path(sys.argv[1]);m=onnx.load(p);nodes=list(m.graph.node)
weights={t.name:t for t in m.graph.initializer}
convs=[]
for i,n in enumerate(nodes[:190]):
 if n.op_type=="Conv":
  attrs={a.name:list(a.ints) for a in n.attribute}
  convs.append(dict(index=i,name=n.name,weights=list(weights[n.input[1]].dims),strides=attrs['strides'],kernel=attrs['kernel_shape']))
assert convs[0]['index']==6 and convs[0]['strides']==[1,256] and convs[0]['kernel']==[1,256]
assert nodes[195].op_type=='ReduceMin' and nodes[203].op_type=='ReduceMax'
print(json.dumps(dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),onnxVersion=onnx.__version__,hop=256,convolutions=convs,normalization=[dict(index=i,op=n.op_type,name=n.name) for i,n in enumerate(nodes[190:213],190)],neuralCropIndex=213)))

"""Deterministic weight-preserving neural time crop; no inference performed here."""
import json, sys, hashlib
from pathlib import Path
import numpy as np
import onnx
from onnx import helper, numpy_helper
model, out = map(Path, sys.argv[1:])
m = onnx.load(model)
assert hashlib.sha256(model.read_bytes()).hexdigest() == '2c3c1d144bfa61ad236e92e169c13535c880469a12a047d4e73451f2c059a0ec'
nodes = list(m.graph.node)
assert nodes[212].op_type == 'Add' and 'batch_normalization' in nodes[212].name
boundary = nodes[212].output[0]
crop = helper.make_node('Slice', [boundary,'neural_start','neural_end','neural_axis'], ['neural_crop'], name='incremental_neural_time_crop_041')
for n in nodes[213:]:
    for i, name in enumerate(n.input):
        if name == boundary: n.input[i] = 'neural_crop'
del m.graph.node[:]; m.graph.node.extend(nodes[:213] + [crop] + nodes[213:])
m.graph.input.append(helper.make_tensor_value_info('neural_start', onnx.TensorProto.INT64, [1]))
m.graph.initializer.extend([numpy_helper.from_array(np.array([172],dtype=np.int64),'neural_end'),numpy_helper.from_array(np.array([1],dtype=np.int64),'neural_axis')])
changes = {'new_shape__614':[1,1,-1,264], 'StatefulPartitionedCall:2_shape__747':[1,-1,88], 'StatefulPartitionedCall:0_shape__746':[1,-1,264]}
for t in m.graph.initializer:
    if t.name in changes: t.CopyFrom(numpy_helper.from_array(np.array(changes[t.name],dtype=np.int64),t.name))
# Remove stale downstream inferred shapes; original DSP shapes stay fixed.
downstream = {name for n in nodes[213:] for name in n.output}
kept = [v for v in m.graph.value_info if v.name not in downstream]
del m.graph.value_info[:]; m.graph.value_info.extend(kept)
for v in m.graph.output:
    v.type.tensor_type.shape.dim[1].ClearField('dim_value')
    v.type.tensor_type.shape.dim[1].dim_param = 'cropped_time'
onnx.checker.check_model(m)
out.mkdir(parents=True,exist_ok=False)
p = out/'incremental.onnx'; onnx.save(m,p)
(out/'graph.json').write_text(json.dumps({'source':str(model),'sourceSha256':hashlib.sha256(model.read_bytes()).hexdigest(),'path':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'onnxVersion':onnx.__version__,'boundary':boundary,'halo':10,'reshapeChanges':changes,'weightsChanged':False,'fullDSP':True},indent=2)+'\n')

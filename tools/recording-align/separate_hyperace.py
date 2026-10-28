"""unwa's BS-RoFormer HyperACE v2 instrumental: the quality separator for guitar + voice (README, "Separating
the guitar"), through bs-roformer-infer's own chunked inference.

The checkpoint ships its own model code (v2_inst/bs_roformer.py, audited 2026-10-27: torch, einops, beartype,
rotary-embedding only; sha256 48571e20d70ea8f2…, checked below before it is executed). It imports MSST's
`models.bs_roformer.attend` (the same Attend bs-roformer-infer ships) and torchaudio, which it never uses; both
are satisfied here without installing anything.

Writes <store dir>/<name>_instrument.wav, the instrumental. The <name>_instrumental.wav beside it is the mix
minus that, i.e. the VOICE: bs-roformer-infer names "instrumental" whatever is left after the first stem.

  separate_hyperace.py <model dir: bs_roformer.py, config.yaml, bs_roformer_inst_hyperacev2.ckpt> <input folder> <store dir> [--check]
"""
import argparse, hashlib, importlib.util, sys, types
import torch, yaml
from ml_collections import ConfigDict
import bs_roformer.attend as attend
from bs_roformer.inference import SafeLoaderWithTuple, run_folder

AUDITED = '48571e20d70ea8f2'   # sha256 prefix of the model code read before it was allowed to run

a = argparse.ArgumentParser(); a.add_argument('model_dir'); a.add_argument('input_folder'); a.add_argument('store_dir'); a.add_argument('--check', action='store_true')
args = a.parse_args()
code = f'{args.model_dir}/bs_roformer.py'
digest = hashlib.sha256(open(code, 'rb').read()).hexdigest()
if not digest.startswith(AUDITED):
    sys.exit(f'{code} is not the audited model code (sha256 {digest[:16]}…, expected {AUDITED}…): read it before running it')
sys.modules.setdefault('torchaudio', types.ModuleType('torchaudio'))
for name in ('models', 'models.bs_roformer'):
    sys.modules.setdefault(name, types.ModuleType(name))
sys.modules['models.bs_roformer.attend'] = attend
spec = importlib.util.spec_from_file_location('hyperace_bs_roformer', code)
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
config = ConfigDict(yaml.load(open(f'{args.model_dir}/config.yaml'), Loader=SafeLoaderWithTuple))
params = {k: tuple(v) if isinstance(v, list) else v for k, v in dict(config.model).items()}   # the safe loader makes tuples lists
model = mod.BSRoformer(**params)
state = torch.load(f'{args.model_dir}/bs_roformer_inst_hyperacev2.ckpt', map_location='cpu', weights_only=True)
state = state.get('state_dict', state) if isinstance(state, dict) else state
missing, unexpected = model.load_state_dict(state, strict=False)
print(f'loaded: {sum(p.numel() for p in model.parameters()) / 1e6:.1f}M parameters; missing {len(missing)}, unexpected {len(unexpected)}; target {getattr(config.training, "target_instrument", None)} of {list(config.training.instruments)}')
if missing or unexpected:
    sys.exit(f'weights do not fit the model: missing {missing[:3]} unexpected {unexpected[:3]}')
if args.check:
    sys.exit(0)
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
run_folder(model.to(device), argparse.Namespace(input_folder=args.input_folder, store_dir=args.store_dir), config, device)

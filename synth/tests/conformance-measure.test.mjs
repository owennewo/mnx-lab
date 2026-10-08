import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fundamental,fft,decayTime,envelope,onsetFlux} from '../web/contract/conformance/measure.js';

const numpy=spawnSync('python3',['-c','import numpy'],{encoding:'utf8'}).status===0;
const signal=(rate,seconds,f)=>Float64Array.from({length:Math.round(seconds*rate)},(_,i)=>.2*Math.sin(2*Math.PI*f*i/rate)+.05*Math.sin(4*Math.PI*f*i/rate)+.01*Math.sin(2*Math.PI*f*2.71*i/rate));

test('FFT matches a direct DFT',()=>{
 const n=64,x=Float64Array.from({length:n},(_,i)=>Math.sin(i*.7)+.3*Math.cos(i*2.1)),re=Float64Array.from(x),im=new Float64Array(n);fft(re,im);
 for(let k=0;k<n;k++){let a=0,b=0;for(let t=0;t<n;t++){a+=x[t]*Math.cos(2*Math.PI*k*t/n);b-=x[t]*Math.sin(2*Math.PI*k*t/n);}assert.ok(Math.abs(a-re[k])<1e-9&&Math.abs(b-im[k])<1e-9);}
});

test('JS fundamental() equals the NumPy estimator it ports',{skip:numpy?false:'NumPy not installed'},()=>{
 const cases=[];for(const rate of [44100,48000,96000])for(const f of [65.4,146.8,329.627557,880,1396])for(const window of [[.1,.14],[.5,2.05]])cases.push({rate,f,window});
 const script=`import sys,json,numpy as np\nsys.path.insert(0,'scripts')\nfrom pitch_estimator import fundamental\nout=[]\nfor c in json.load(sys.stdin):\n  r=c['rate'];n=round(2.2*r);t=np.arange(n)/r;f=c['f']\n  s=.2*np.sin(2*np.pi*f*t)+.05*np.sin(4*np.pi*f*t)+.01*np.sin(2*np.pi*f*2.71*t)\n  out.append(fundamental(s.astype('float64'),r,f,c['window']))\nprint(json.dumps(out))`;
 const py=spawnSync('python3',['-c',script],{input:JSON.stringify(cases),encoding:'utf8'});assert.equal(py.status,0,py.stderr);
 const expected=JSON.parse(py.stdout);
 cases.forEach((c,i)=>{const js=fundamental(signal(c.rate,2.2,c.f),c.rate,c.f,c.window);
  assert.ok(Math.abs(js.hz-expected[i][0])<1e-6,`${JSON.stringify(c)}: ${js.hz} vs ${expected[i][0]}`);assert.ok(Math.abs(js.ratio-expected[i][1])<1e-9);});
});

test('decay and onset measures behave on synthetic envelopes',()=>{
 const rate=48000,x=Float64Array.from({length:rate*2},(_,i)=>i<rate*.5?0:Math.sin(i*.3)*Math.exp(-(i-rate*.5)/(rate*.2)));
 const d=decayTime(envelope(x,rate),.5);assert.ok(Math.abs(d-.2*Math.log(100))<.03,`decay ${d}`);// −40 dB of amplitude at τ·ln 100
 assert.ok(onsetFlux(x,rate,.5)>0);assert.equal(onsetFlux(x,rate,1.2),0,'a decaying tone adds no energy');
});

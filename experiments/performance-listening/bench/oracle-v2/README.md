# V2 instrument oracle — arithmetic before implementation

Implementation-loop evidence about the measuring apparatus, not a listener result.
The v1 oracle and experiment 001 remain unchanged. These cases use handwritten
trajectories and decisions; no audio listener creates its own expected answers.

Use a 50 ms point grid with each cell's right endpoint, splitting at label boundaries
and answerability boundaries. The endpoint belongs to the preceding interval. Point
counts judge decisions; exposure integrates the held live decision continuously,
splitting at emissions and every tolerance crossing. Thus 10 ms emissions do not
become 50 ms exposure estimates. Unknown/pending regions break measured episodes;
unobserved intervals cannot establish a bound on a physical episode across them.

| Case | Hand-worked expectation |
|---|---|
| One second, constant truth [0, 0.25], position 0.125 from time zero | All 20 points guaranteed correct, coverage 1, no deadline misses/exposure |
| Same truth, position 0 | Every possible truth is within tolerance, including the boundary: all 20 correct |
| Same truth, position 0.4 | Some truths within 0.25 and some outside: 20 indeterminate, correctness [0,1], exposure [0,1] seconds |
| Same truth, position 1 | All 20 wrong, exposure exactly 1 second, misses exactly 1 |
| Truth moves from 0 to 1 in one second, held position 0 | First five points correct (through 0.25 s); 15 wrong; continuous exposure exactly 0.75 s |
| First 0.5 s unknown, then truth [0,0] | 10 unknown and 10 supported points, 50% reference coverage; an otherwise perfect record cannot promote |
| Unsupported 0–1 s; distinguishing evidence at zero, allowance until 0.15 s; position until rejection at 0.30 s | Answerable points include 0.15 s; 2 pending points, 18 answerable, 15 correct rejections; continuous exposure 0.15 s over 0.85 s answerable time |
| Truth [0,0], wrong at zero, correction for time zero made at 0.30 s | Live exposure 0.30 s; points 0.05 s and earlier have no correct decision within 0.20 s; later deadlines can be met; correction cannot erase live history |
| Truth on route 2, position on route 1 | Wrong even when quarter values coincide |
| Truth [0,0] with acoustically equivalent route 2 at quarter 4 | Position set {(route 1,0),(route 2,4)} is correct; replacing 4 by 5 makes its unsupported certainty wrong |
| No decisions | No coverage, no false claims, no correct decisions, every answerable deadline missed |

Answerability endpoint convention: points at `answerableFrom` are answerable (as in
v1). For the seventh case, 0.05 and 0.10 s are pending, 0.15–1.00 s are answerable:
18 answerable points, 15 correct rejections (0.30–1.00), 3 false-following points.
Exposure is time-weighted, point counts are not.

Retention oracle: perfect paired records with comparator exposure 20% and candidate
0% clear the 5 percentage-point/25% worthwhile-gain rule, subject to every per-example
gate. Development yields `provisional`, never `retain`. Missing labels or missing
control roles yields `inconclusive`. A definite 10% false-exposure candidate fails.
A [0,10%] exposure candidate is inconclusive. A zero-exposure comparator has no
headroom. Mismatched example evidence is an error, never a comparison. Unknown
performer/session cannot establish reserved independence.

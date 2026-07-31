# score-text — opting-in scenarios

All nine live under `scenarios/lab/31-score-text/` and declare
`"schema": "proposed", "proposal": "score-text"` — their `expect.standard` verdict is
judged against [mnx-schema.proposed.json](../../mnx-schema.proposed.json), so the corpus
proves the proposal instead of merely describing it.

| Scenario | Exercises |
| --- | --- |
| `lab/score-text/rehearsal-marks` | `rehearsal` on the global measure |
| `lab/score-text/sections` | `section` on the global measure |
| `lab/score-text/sections-with-rehearsal-marks` | both on one measure — separate objects, not a merged label |
| `lab/score-text/directions` | `directions[]` on the part measure, plain text |
| `lab/score-text/directions-symbolic` | symbolic direction glyphs |
| `lab/score-text/directions-across-parts` | the same direction on multiple parts |
| `lab/score-text/directions-multi-staff` | directions on a multi-staff part |
| `lab/score-text/directions-stacked` | several directions stacked at one point |
| `lab/score-text/labels-with-navigation` | rehearsal/section coexisting with `segno`/`jump` |

Renders for each are committed beside this file in [engravings/](engravings/).

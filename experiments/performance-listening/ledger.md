# Run ledger

Append-only, one row per numbered experiment under
[development contract 2](contracts/development-contract-2.md), pointing at that
experiment's single report file. Every new row updates [the research log](RESEARCH_LOG.md)
in the same commit. Each row's conditions name the model and tool that ran it.
The first series' rows, experiments 001–021, are in [the archived ledger](archive/ladder-1/ledger.md).

| Run | Hypothesis / sources | Parent / candidate | Set / evaluator | Conditions / resources | Results / uncertainty | Decision / next action |
|---|---|---|---|---|---|---|
| [g022](runs/g022-stage1-baselines/summary.json) | [022 pre-registration](reports/022-event-instruments.md#pre-registration); log questions 1–3; [event instruments 1](contracts/event-instruments-1.md), hand-worked [event-oracle@1](bench/oracle-events/README.md) | No listener developed; frozen clock, online-time-warp@8, @12, @14 through the legacy adapter | New private `contract2-stage1-v1` (s1, s2; sine; handed 90, played 45/63/90/99) / following-evaluator@2; assessment-evaluator@1 on its oracle only | Claude Opus 5.5 (1M context) in Claude Code; known start, 48 kHz/480; 30 s wall; one attempt | Oracle reproduced exactly, no erratum. Every baseline fails stage 1 by running ahead at 45 and 63 (time warpers 7.8–39.2% ahead, clock 47–83%); v12/v14 also ahead at 99 (5.0–8.0%). At 90 every listener equals the clock. Nearest-onset mapping would cost the clock 40–45 points. Causality all pass; cost ≤ 0.12 | Instruments trusted; contract's slow-play prediction supported. [Gates proposed, awaiting the user](reports/022-event-instruments.md#proposed-gates-awaiting-the-users-approval). Next: 023, the first new listener on stage 1 |

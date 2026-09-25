# Evaluator oracle v1

Eleven literal decision records, handwritten goldens, and independently hand-worked
expected counts. Each README explains the arithmetic. These are instrument evidence,
not candidate output; never regenerate answers from the evaluator. Changing an answer
requires a versioned evaluator change and a ledger row. Every case is development.

The right-edge grid and time weighting are fixed in
[the rules](../../contracts/evaluator-rules.md). All categories, denominators,
latency distributions, loss episodes and exposure are tested. Additional tests cover
wrong routes, admissible ambiguity, malformed records and confidence bins.

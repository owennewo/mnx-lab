# Listening bench

Private npm workspace. Zero runtime dependencies; TypeScript runs with development
`tsx`, tests with the root Vitest installation. From the repository root:

```
npm -w mnx-listening-bench test
npm -w mnx-listening-bench run generate -- harness-v1
npm -w mnx-listening-bench run freeze -- harness-v1
npm -w mnx-listening-bench run run -- harness-v1 <new-run-id>
npm -w mnx-listening-bench run report -- <run-id>
```

All commands are implemented. `run` requires a frozen set and committed code,
checks audio hashes and refuses to overwrite a run id. `report` renders recorded
counts without rerunning a candidate. Freeze is exercised only on temporary copies until G.
The committed oracle reports regenerate byte-identically.
Start with [the research log](../RESEARCH_LOG.md). No product build imports this bench.

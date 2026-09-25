# Listening bench

Private npm workspace. Zero runtime dependencies; TypeScript runs with development
`tsx`, tests with the root Vitest installation. From the repository root:

```
npm -w mnx-listening-bench test
npm -w mnx-listening-bench run generate -- harness-v1
npm -w mnx-listening-bench run freeze -- harness-v1
npm -w mnx-listening-bench run run -- harness-v1
npm -w mnx-listening-bench run report -- <run-id>
```

At E, `generate`, `freeze`, tests and `report -- oracle` are implemented.
`run` still fails explicitly. Freeze is exercised only on temporary copies until G.
The committed oracle reports regenerate byte-identically.
Start with [the research log](../RESEARCH_LOG.md). No product build imports this bench.

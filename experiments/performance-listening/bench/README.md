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

At B/C, the contract and oracle tests and `report -- oracle` are implemented;
remaining commands fail explicitly. The committed oracle reports regenerate byte-identically.
Start with [the research log](../RESEARCH_LOG.md). No product build imports this bench.

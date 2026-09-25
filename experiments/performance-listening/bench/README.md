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

At item A only the contract test is implemented; remaining commands fail explicitly.
Start with [the research log](../RESEARCH_LOG.md). No product build imports this bench.

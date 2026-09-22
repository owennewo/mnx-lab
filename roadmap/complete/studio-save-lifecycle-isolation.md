# Isolate Studio saves across navigation

Implementation loop. Status: complete, 2026-09-22.

A checkpoint awaiting its round-trip check can resume after navigation and read
another piece’s sidecar tags, loss-report state, or lock release callback.

Capture metadata and loss reporting per saving session, keep a departing session’s
lock until its flush settles, and reject stale asynchronous session initialization.
Retain existing revision conflict handling and recovery behavior.

Acceptance: delayed checkpoints retain their own title, filename and evidence;
navigation cannot publish stale save state or install a stale session; lock cleanup
cannot release another session’s lock. Prove with focused regressions, full gates,
and the save-pipeline and play-only browser smokes.

## Implementation and evidence

- `src/storage/pieceSaveContext.ts` owns projected tags and evidence history per
  session; tags refresh only from that piece’s own save/read response. Each
  checkpoint retains its own losses. The filename helper moved out of the shell.
- Lock acquisition returns its own release handle. Stale lock/recovery completions
  cannot install a session, and departure releases its lock after the final flush.
- A second regression surfaced: `flush()` returned while the queued final
  checkpoint was still running. It now drains that write, stopping on failure or
  conflict so recovery remains available without hanging departure.
- The delayed-check test failed with Piece B’s title against the extracted old
  getter behavior, then passed with captured metadata. The held-second-write test
  failed against the original `SaveSession.flush`, then passed after the fix.
- Focused suites: 33 tests pass; TypeScript and architecture checks pass.
- The save-pipeline browser smoke now delays the real storage worker across
  navigation and checks persisted metadata, old lock lifetime and current UI state.
  Play-only smoke expectations follow the existing consolidated Edit piece panel.

An undo back to the original document during an in-flight save also drains its final
checkpoint. Failed/conflicted flushes terminate and retain local recovery.

Final rebased validation (2026-09-22): primitives regenerated with a clean
`scenarios/` diff; root suites 2599 passed, 1 skipped; build passed. Built
save-pipeline (including delayed navigation), play-only and piece-lifecycle browser
smokes passed against isolated local D1/R2 on port 8793.

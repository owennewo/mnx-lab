# Isolate Studio saves across navigation

Implementation loop. Status: proposed, 2026-09-22.

A checkpoint awaiting its round-trip check can resume after navigation and read
another piece’s sidecar tags, loss-report state, or lock release callback.

Capture metadata and loss reporting per saving session, keep a departing session’s
lock until its flush settles, and reject stale asynchronous session initialization.
Retain existing revision conflict handling and recovery behavior.

Acceptance: delayed checkpoints retain their own title, filename and evidence;
navigation cannot publish stale save state or install a stale session; lock cleanup
cannot release another session’s lock. Prove with focused regressions, full gates,
and the save-pipeline and play-only browser smokes.

# Input-buffer reuse — experiment 047

2026-10-05, **GPT-6.1-Sol (high) in Codex**. Bounded implementation research,
not evidence that allocations caused the historical stalls.

[ECMAScript TypedArray copyWithin](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-%typedarray%.prototype.copywithin)
defines copying within the same underlying storage, including overlapping regions;
[TypedArray slice](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-%typedarray%.prototype.slice)
creates a destination. These language semantics support compaction and reused capacity,
not a total-byte claim about V8's ordinary number-array allocator. Counts in 047 distinguish
explicit slice result objects/elements from known float32 backing capacity bytes.

[Node worker_threads](https://nodejs.org/docs/latest-v22.x/api/worker_threads.html)
documents shared ArrayBuffer memory and synchronization with Atomics. Local inference:
IncrementalModel041.predict copies the contiguous input into a pre-existing shared
float32 array before notifying its worker, then blocks in wait until worker completion.
Consequently the caller may reuse its source window after predict returns. A future
asynchronous or retaining consumer would need separate ownership/copying; this
optimization supplies no permission to mutate a tensor during inference.

The new raw buffer preserves incoming float32 values, double-precision interpolation
arithmetic/operation order and float32 ring serialization. Reusing the contiguous
window preserves the current full-window normalization and neural graph. It removes
allocation at the targeted storage sites, while retaining the full window copy and
recomputed DSP. Savings cannot establish faster tail service, lower total heap/native
allocation, historical GC ownership or microphone/production latency.

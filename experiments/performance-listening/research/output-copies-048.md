# Unused live neural-output copies — experiment 048

2026-10-05, **GPT-6.1-Sol (high) in Codex**. Bounded copy/ownership research.

[ECMAScript TypedArray slice](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-%typedarray%.prototype.slice)
creates a destination array; same-type element copying preserves the source representation.
[TypedArray set](https://tc39.es/ecma262/multipage/indexed-collections.html#sec-%typedarray%.prototype.set)
copies elements into existing storage. These rules motivate exact destination backing-byte
and copy-element counts, not total allocator or garbage-collection estimates.
[Node worker_threads](https://nodejs.org/api/worker_threads.html) documents sharing memory
through SharedArrayBuffer. The v22 documentation link used by 047 failed in this bounded
web lookup; the current official documentation was read instead. The local installed
Node/runtime is recorded by the runner, and synchronization behavior is unchanged.

Local source evidence: frozen IncrementalModel041 slices note (88 bins), onset (88),
and contour (264) for each returned neural frame. Its worker copies all three into shared
storage. Frozen execute047 reads only maps.note. Therefore removing onset/contour bridge
copies, with the same graph and note snapshot ownership, should avoid 352/440 of the
explicit copied/output-slice bytes. This is local inference, tested on complete native
request tensors rather than accepted from source inspection. Offline @2 still needs all
three maps and its producer remains unchanged; no observation-seam contract is rewritten.

ONNX still computes and owns the original three result tensors. Counts do not include
that native allocation or claim less neural/DSP work. Fresh note slices remain independent
across later calls; using a shared borrowed note view would be a different optimization.
Timing differences are provisional host observations, never historical-stall attribution.

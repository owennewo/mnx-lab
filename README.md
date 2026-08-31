# MNX Lab

A test bench for the developing [W3C MNX](https://w3c-cg.github.io/mnx/) music-notation
format, with emphasis on guitar tab — live at **[mnx-lab.totai.uk](https://mnx-lab.totai.uk)**.

- **A scenario corpus** (`scenarios/`) of small MNX documents — the spec's own worked
  examples mirrored from the pinned submodule, plus our local scenarios — each with a
  committed layout golden and human-verified engraving status.
- **A rendering engine** (`src/engine/`) — custom SMuFL/SVG, no notation libraries —
  whose output ships as reference engravings on the MNX spec site.
- **Converters** (`converters/`) — lossless MusicXML ⇄ MNX and Guitar Pro ⇄ MNX.
- **A spec-loop pipeline** (`spec/`) — `sync:spec` mirrors the standard down;
  `push:proposal` packages our proposals (schema diff + scenarios + engravings) back up
  in the spec's native fixture format.
- **The workbench** (`src/workbench/`) — a review-first shell over all of it: attention queue,
  render/compare views, deep links.

```bash
git submodule update --init vendor/mnx   # spec sources (dev-time only)
npm install
npm run dev        # workbench + Worker API at localhost:5173
npm test           # harness suites over the corpus
```

Structure, conventions and the full command list: **[CLAUDE.md](CLAUDE.md)**. Planning
history: [roadmap/](roadmap/README.md). The repo was rebuilt fresh-slate in 2026-07
([roadmap/complete/lab-structure-lab.md](roadmap/complete/lab-structure-lab.md)); the previous
tree lives on the `pre-rebuild` tag (`git show pre-rebuild:<path>` — the `legacy` branch
that used to name the same commit was deleted 2026-08-15).

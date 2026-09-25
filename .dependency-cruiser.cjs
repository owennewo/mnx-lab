// Machine-enforced layer boundaries — roadmap/complete/lab-structure-lab.md.
// A violation is a red build (`npm run check:boundaries`, wired into build),
// not a review comment.
//
// The layer order:
//   model                                   (floor — imports nothing internal)
//   model → engine · audio · edit · corpus · storage · importers   (peers over the model;
//                                             importers also reach converters/)
//   edit  → assist                          (assist carries ops; edit owns them)
//   engine · audio · edit · model → elements   (the embeddable surface; edit since the
//                                             editor's mount was promoted — editorHost.ts)
//   elements → workbench                    (workbench shell — leaf)
//   workbench · elements → entries          (build faces)
//   worker: model + assist only             (sibling ceiling; DOM-free)
//   apps/studio: model · engine · audio · elements · storage   (the consumer shell — leaf)
//   harness: anything except the shells     (exercises the machinery headlessly)

/** Allow a layer to depend only on the listed layers (plus itself and node_modules). */
function layerRule(name, from, allowed) {
  return {
    name,
    severity: 'error',
    from: { path: `^${from}/` },
    to: {
      path: '^(src|worker|apps|harness|converters|experiments)/',
      // worker/generated/ is not worker logic — it is schema DATA precompiled
      // from spec/ (Workers disallow runtime codegen), importable from any
      // layer (model/pinnedErrors lazy-loads the validator in the browser).
      pathNot: `^(${[from, ...allowed].join('|')})/|^worker/generated/`
    }
  };
}

module.exports = {
  forbidden: [
    {
      name: 'viewer-and-player-do-not-reach-editor', severity: 'error',
      comment: 'Viewing and playback must not acquire editor dependencies through shared helpers.',
      from: { path: '^src/elements/(DocumentViewer|Player|playbackHost)\\.ts$' },
      to: { path: '^src/edit/', reachable: true }
    },
    {
      name: 'production-does-not-import-experiments', severity: 'error',
      from: { path: '^(src|worker|apps|converters)/' }, to: { path: '^experiments/' }
    },
    {
      name: 'listening-bench-consumes-audio-and-model-only', severity: 'error',
      from: { path: '^experiments/performance-listening/' },
      to: { path: '^(src|worker|apps|harness|converters)/', pathNot: '^src/(audio|model)/' }
    },
    {
      // The listener contract moves to src/listen/ by git mv (SEAM.md), so nothing in it
      // may reach the measuring bench or any other part of the experiment.
      name: 'listening-seam-imports-nothing-from-the-experiment', severity: 'error',
      from: { path: '^experiments/performance-listening/listen/' },
      to: { path: '^experiments/performance-listening/', pathNot: '^experiments/performance-listening/listen/' }
    },
    {
      name: 'native-audio-only-at-browser-boundary',
      severity: 'error',
      from: { path: '^(src|worker|harness)/', pathNot: '^src/(audio/native|elements|entries)/|^harness/browser/' },
      to: { path: '^src/audio/native/' }
    },
    layerRule('model-is-the-floor', 'src/model', []),
    layerRule('engine-over-model', 'src/engine', ['src/model']),
    layerRule('audio-over-model', 'src/audio', ['src/model']),
    layerRule('edit-over-model', 'src/edit', ['src/model']),
    layerRule('corpus-over-model', 'src/corpus', ['src/model']),
    layerRule('storage-over-model', 'src/storage', ['src/model']),
    layerRule('importers-over-model', 'src/importers', ['src/model', 'converters']),
    layerRule('assist-carries-ops', 'src/assist', ['src/model', 'src/edit']),
    // `src/edit` since 2026-09-17 (roadmap: core-editor-element-promotion): the
    // editor's MOUNT lives in elements/ so both shells share one. The viewer and
    // the player cannot reach edit/ — editorHost.ts and its editor surfaces can —
    // so an embed that views pays nothing for the editor.
    layerRule('elements-embeddable-surface', 'src/elements', [
      'src/model',
      'src/engine',
      'src/audio',
      'src/edit'
    ]),
    layerRule('workbench-is-a-leaf-consumer', 'src/workbench', [
      'src/model',
      'src/engine',
      'src/audio',
      'src/edit',
      'src/corpus',
      'src/storage',
      'src/importers',
      'src/assist',
      'src/elements'
    ]),
    layerRule('worker-model-and-assist-only', 'worker', ['src/model', 'src/assist']),
    {
      name: 'studio-consumes-neutral-surfaces',
      comment:
        'apps/studio is the consumer product (apps/studio/README.md). It reads elements/ ' +
        'and below, the typed library client, the importers and — since it makes pieces ' +
        '(roadmap: studio-campaign-authoring) — the DOM-free edit layer. Never the workbench, ' +
        'and never assist: the AI palette stays where it incubates. The editor\'s MOUNT still ' +
        'arrives through elements/ (roadmap: core-editor-element-promotion).',
      severity: 'error',
      from: { path: '^apps/studio/' },
      to: {
        path: '^(src|worker|apps|harness|converters|experiments)/',
        pathNot: '^apps/studio/|^src/(model|engine|audio|edit|elements|storage|importers)/|^worker/generated/'
      }
    },
    {
      name: 'nothing-imports-the-shells',
      comment:
        'workbench/, entries/ and apps/studio/ are leaves: anything two consumers want ' +
        'must first be promoted down into elements/ or below — a deliberate, reviewed move.',
      severity: 'error',
      from: { path: '^(src|worker|harness|apps|converters|experiments)/', pathNot: '^src/(workbench|entries)/|^apps/studio/' },
      to: { path: '^src/(workbench|entries)/|^apps/studio/' }
    },
    {
      name: 'harness-not-into-shells',
      comment: 'Node conformance stays headless; browser harnesses may exercise elements.',
      severity: 'error',
      from: { path: '^harness/', pathNot: '^harness/browser/' },
      to: { path: '^src/(workbench|entries|elements)/' }
    },
    {
      name: 'alphatab-only-in-file-codecs',
      comment:
        'alphaTab is a devDependency of converters/guitarpro-mnx, kept only as the ' +
        'differential-parity oracle for its tests. Nothing the app, the Worker or the ' +
        'harness loads may import it — the workbench reads Guitar Pro through the ' +
        'clean-room importer.',
      severity: 'error',
      from: { path: '^(src|worker|harness|apps|experiments)/' },
      to: { path: 'alphatab' }
    }
  ],
  options: {
    // Archived experiments are historical snapshots, not active source entry points.
    // Experiment output can contain generated bundles; dependencies are never entry points.
    exclude: { path: '^experiments/[^/]+/(output|dist)(/|$)|^experiments/performance-listening/archive(/|$)' },
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' }
  }
};

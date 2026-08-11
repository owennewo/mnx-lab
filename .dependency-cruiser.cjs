// Machine-enforced layer boundaries — roadmap/complete/lab-structure-lab.md.
// A violation is a red build (`npm run check:boundaries`, wired into build),
// not a review comment.
//
// The layer order:
//   model                                   (floor — imports nothing internal)
//   model → engine · audio · edit · corpus · storage   (peers over the model)
//   edit  → assist                          (assist carries ops; edit owns them)
//   engine · audio · model → elements       (the embeddable surface)
//   elements → workbench                    (workbench shell — leaf)
//   workbench · elements → entries          (build faces)
//   worker: model + assist only             (sibling ceiling; DOM-free)
//   harness: anything except the shells     (exercises the machinery headlessly)

/** Allow a layer to depend only on the listed layers (plus itself and node_modules). */
function layerRule(name, from, allowed) {
  return {
    name,
    severity: 'error',
    from: { path: `^${from}/` },
    to: {
      path: '^(src|worker)/',
      // worker/generated/ is not worker logic — it is schema DATA precompiled
      // from spec/ (Workers disallow runtime codegen), importable from any
      // layer (model/pinnedErrors lazy-loads the validator in the browser).
      pathNot: `^(${[from, ...allowed].join('|')})/|^worker/generated/`
    }
  };
}

module.exports = {
  forbidden: [
    layerRule('model-is-the-floor', 'src/model', []),
    layerRule('engine-over-model', 'src/engine', ['src/model']),
    layerRule('audio-over-model', 'src/audio', ['src/model']),
    layerRule('edit-over-model', 'src/edit', ['src/model']),
    layerRule('corpus-over-model', 'src/corpus', ['src/model']),
    layerRule('storage-over-model', 'src/storage', ['src/model']),
    layerRule('assist-carries-ops', 'src/assist', ['src/model', 'src/edit']),
    layerRule('elements-embeddable-surface', 'src/elements', [
      'src/model',
      'src/engine',
      'src/audio'
    ]),
    layerRule('workbench-is-a-leaf-consumer', 'src/workbench', [
      'src/model',
      'src/engine',
      'src/audio',
      'src/edit',
      'src/corpus',
      'src/storage',
      'src/assist',
      'src/elements'
    ]),
    layerRule('worker-model-and-assist-only', 'worker', ['src/model', 'src/assist']),
    {
      name: 'nothing-imports-the-shells',
      comment:
        'workbench/ and entries/ are leaves: anything two consumers want must first be ' +
        'promoted down into elements/ or below — a deliberate, reviewed move.',
      severity: 'error',
      from: { path: '^(src|worker|harness)/', pathNot: '^src/(workbench|entries)/' },
      to: { path: '^src/(workbench|entries)/' }
    },
    {
      name: 'harness-not-into-shells',
      comment: 'The harness exercises machinery headlessly, never the app shells.',
      severity: 'error',
      from: { path: '^harness/' },
      to: { path: '^src/(workbench|entries|elements)/' }
    },
    {
      name: 'no-alphatab-outside-converters',
      comment:
        'alphaTab is a file-format codec confined to converters/guitarpro-mnx ' +
        '(~13.7 MB unpacked) — it must never reach the client bundle.',
      severity: 'error',
      from: { path: '^(src|worker|harness)/' },
      to: { path: 'alphatab' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' }
  }
};

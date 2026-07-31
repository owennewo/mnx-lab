// Build face: the mnx-lab library (Vite lib mode → dist/lib; subpath exports
// mnx-lab/model · engine · audio · elements). The honest first surface —
// validate, layout, SVG, element registration — grows with real external
// demand; the recorded trigger for splitting into independently-versioned
// packages is an external consumer needing exactly that.
export * from './lib/model.ts';
export * from './lib/engine.ts';
export * from './lib/audio.ts';

// Build face: the embed (dist/embed/mnx-lab.js, IIFE + ESM) — one script tag
// registers the elements/ custom elements and nothing else. The workbench
// shell must never be reachable from here (the old embed was the app shell
// moonlighting as the component; that conflation is what this face unwinds).
import '../elements/ScoreViewer.ts';

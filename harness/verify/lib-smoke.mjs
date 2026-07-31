// Smoke test for the LIBRARY build face (structure-lab "done when"):
// `npm pack` must produce an installable mnx-lab whose `mnx-lab/engine`
// renders a scenario to SVG **in Node**, exactly as an external consumer
// would use it. Run via `npm run smoke:lib` (which builds dist/lib first).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'mnx-lab-smoke-'));

try {
  // 1. Pack the tarball (exports map + files list must hold up).
  const tarball = execFileSync('npm', ['pack', '--pack-destination', work], {
    cwd: ROOT,
    encoding: 'utf8'
  })
    .trim()
    .split('\n')
    .pop();

  // 2. Install it into a bare consumer package.
  fs.writeFileSync(
    path.join(work, 'package.json'),
    JSON.stringify({ name: 'smoke-consumer', private: true, type: 'module' })
  );
  execFileSync('npm', ['install', '--no-audit', '--no-fund', path.join(work, tarball)], {
    cwd: work,
    stdio: 'ignore'
  });

  // 3. Use it the way a consumer would: compute layout headlessly, then emit
  //    SVG with the four DOM calls the emitter needs faked in.
  const consumer = `
    import { ensureSmufl, computePrimitives, renderSvg, fitPxPerSp } from 'mnx-lab/engine';
    import fs from 'node:fs';
    import { createRequire } from 'node:module';
    const require = createRequire(import.meta.url);
    const glyphnames = JSON.parse(fs.readFileSync(require.resolve('mnx-lab/smufl/glyphnames.json'), 'utf8'));
    const metadata = JSON.parse(fs.readFileSync(require.resolve('mnx-lab/smufl/bravura_metadata.json'), 'utf8'));
    ensureSmufl(glyphnames, metadata);

    const score = ${JSON.stringify(
      fs.readFileSync(path.join(ROOT, 'scenarios/spec/hello-world/score.mnx.json'), 'utf8')
    )};
    const prims = computePrimitives(JSON.parse(score), 80);
    if (!prims.notation.primitives.length) throw new Error('no primitives');

    class El {
      constructor(name) { this.name = name; this.attrs = []; this.children = []; this.textContent = ''; }
      setAttribute(k, v) { this.attrs.push([k, String(v)]); }
      appendChild(c) { this.children.push(c); return c; }
      addEventListener() {}
      serialize() {
        const a = this.attrs.map(([k, v]) => \` \${k}="\${v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')}"\`).join('');
        return \`<\${this.name}\${a}>\${this.textContent}\${this.children.map(c => c.serialize()).join('')}</\${this.name}>\`;
      }
    }
    globalThis.document = { createElementNS: (_ns, name) => new El(name) };
    const container = new El('div');
    renderSvg({
      container,
      primitives: prims.notation.primitives,
      widthSp: prims.notation.widthSp,
      heightSp: prims.notation.heightSp,
      pxPerSp: fitPxPerSp(640, prims.notation.widthSp, 8)
    });
    const svg = container.children[0].serialize();
    if (!svg.startsWith('<svg') || !svg.includes('<text')) throw new Error('unexpected SVG: ' + svg.slice(0, 80));
    console.log('OK mnx-lab/engine rendered hello-world to SVG in Node (' + svg.length + ' bytes)');
  `;
  fs.writeFileSync(path.join(work, 'consume.mjs'), consumer);
  const out = execFileSync(process.execPath, [path.join(work, 'consume.mjs')], {
    cwd: work,
    encoding: 'utf8'
  });
  process.stdout.write(out);
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}

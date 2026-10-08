// The licence and third-party notices, from ONE inventory (core-campaign-synth.md, Phase 3):
// writes NOTICE.md (the repository) and notices/index.html (the site's /notices/ page).
// Full licence texts live in public/licenses/ (served at /licenses/). harness/conformance/
// notices.test.ts requires both outputs to be current and every production package in
// package-lock.json to be in the inventory, so the notices cannot fall behind the code.
//
//   node tools/notices.mjs           regenerate
//   node tools/notices.mjs --check   fail if NOTICE.md or notices/index.html is stale
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const SOURCE_URL = 'https://github.com/owennewo/mnx-lab';
export const HOLDER = 'Owen Williams';

/** Where a component reaches people: the site's browser code, its server, or only the repository. */
const SITE = 'the website (sent to browsers)';
const SYNTH = 'the synth (`/synth/`, sent to browsers)';
const WORKER = 'the server (the Cloudflare Worker; not sent to browsers)';
const REPO = 'the repository only (development; not deployed)';
const TYPES = 'type definitions only (not shipped)';

/** Every third-party component. `packages` are the npm packages it accounts for; `texts` are files in public/licenses/. */
export const COMPONENTS = [
  { name: 'Lit', packages: ['lit', 'lit-html', 'lit-element', '@lit/reactive-element', '@lit/context', '@lit-labs/ssr-dom-shim'],
    licence: 'BSD-3-Clause', copyright: 'Copyright (c) 2017 Google LLC', url: 'https://lit.dev', ships: SITE, texts: ['BSD-3-Clause-Lit.txt'] },
  { name: 'Trusted Types type definitions', packages: ['@types/trusted-types'], licence: 'MIT', copyright: 'Copyright (c) Microsoft Corporation',
    url: 'https://github.com/DefinitelyTyped/DefinitelyTyped', ships: TYPES, texts: [] },
  { name: 'Archivo (typeface)', packages: ['@fontsource/archivo'], licence: 'OFL-1.1', copyright: 'Copyright 2020 The Archivo Project Authors',
    url: 'https://github.com/Omnibus-Type/Archivo', ships: SITE, texts: ['OFL-1.1-Archivo.txt'] },
  { name: 'Bravura (SMuFL music font) and its metadata', files: ['public/smufl/Bravura.woff2', 'public/smufl/bravura_metadata.json'], licence: 'OFL-1.1',
    copyright: 'Copyright Steinberg Media Technologies GmbH', url: 'https://github.com/steinbergmedia/bravura', ships: SITE, texts: ['OFL-1.1-Bravura.txt'] },
  { name: 'SMuFL glyph names', files: ['public/smufl/glyphnames.json'], licence: 'W3C Music Notation Community Group (licence to confirm)',
    copyright: 'The SMuFL contributors, W3C Music Notation Community Group', url: 'https://github.com/w3c/smufl', ships: SITE, texts: [],
    note: 'The upstream repository carries no licence file; the terms are to be confirmed with the Community Group.' },
  { name: 'MNX schema and the mirrored specification examples', files: ['spec/mnx-schema.json', 'scenarios/spec/'], licence: 'W3C Music Notation Community Group (licence to confirm)',
    copyright: 'The MNX contributors, W3C Music Notation Community Group', url: 'https://github.com/w3c/mnx', ships: SITE, texts: [],
    note: 'The upstream repository carries no licence file; the terms are to be confirmed with the Community Group.' },
  { name: 'fflate', packages: ['fflate'], licence: 'MIT', copyright: 'Copyright (c) 2026 Arjun Barrett', url: 'https://github.com/101arrowz/fflate',
    ships: SITE, texts: ['MIT-fflate.txt'] },
  { name: 'xmldom', packages: ['@xmldom/xmldom'], licence: 'MIT', copyright: 'Copyright 2019 - present Christopher J. Brody and other contributors',
    url: 'https://github.com/xmldom/xmldom', ships: SITE, texts: ['MIT-xmldom.txt'] },
  { name: 'Instrument samples: Electric Guitar FSBS (clean)', files: ['public/samples/fender-guitar-v1/'], licence: 'CC0-1.0', copyright: 'Dedicated to the public domain',
    url: '/samples/fender-guitar-v1/SOURCE.txt', ships: SITE, texts: ['CC0-1.0.txt'] },
  { name: 'Instrument samples: GM Acoustic Guitar', files: ['public/samples/martin-guitar-v1/'], licence: 'CC0-1.0', copyright: 'Dedicated to the public domain',
    url: '/samples/martin-guitar-v1/SOURCE.txt', ships: SITE, texts: ['CC0-1.0.txt'] },
  { name: 'Instrument samples: Shiny Guitar', files: ['public/samples/shinyguitar-v1/'], licence: 'CC0-1.0', copyright: 'Dedicated to the public domain',
    url: '/samples/shinyguitar-v1/LICENSE', ships: SITE, texts: ['CC0-1.0.txt'] },
  { name: 'Instrument samples: Spanish classical guitar', files: ['public/samples/spanish-guitar-v1/'], licence: 'CC0-1.0', copyright: 'Dedicated to the public domain',
    url: '/samples/spanish-guitar-v1/SOURCE.txt', ships: SITE, texts: ['CC0-1.0.txt'] },
  { name: 'Instrument samples: Upright piano KW', files: ['public/samples/upright-piano-v1/'], licence: 'CC0-1.0', copyright: 'Dedicated to the public domain',
    url: '/samples/upright-piano-v1/SOURCE.txt', ships: SITE, texts: ['CC0-1.0.txt'] },
  { name: 'FAUST libraries (STK-licensed functions by Julius O. Smith III)', files: ['synth/web/generated/'], licence: 'STK-4.3 (MIT-style)',
    copyright: 'Copyright (C) 2003-2019 Julius O. Smith III', url: 'https://github.com/grame-cncm/faustlibraries', ships: SYNTH, texts: ['STK-4.3.txt'],
    note: 'Filters (fir, iir, lowpass, tf1, tf2, pole, bandpass, allpass_comb, …) and the zita_rev1 reverb, compiled into the synth’s WebAssembly by FAUST 2.81.10.' },
  { name: 'FAUST libraries (GRAME)', files: ['synth/web/generated/'], licence: 'LGPL-2.1-or-later WITH the FAUST library exception',
    copyright: 'Copyright (C) 2003-2016 GRAME, Centre National de Creation Musicale', url: 'https://github.com/grame-cncm/faustlibraries', ships: SYNTH,
    texts: ['FAUST-LGPL-exception.txt', 'LGPL-2.1.txt'],
    note: 'maths.lib, envelopes.lib and the other GRAME library functions compiled into the synth’s WebAssembly; the exception lets the compiled code carry its own licence.' },
  { name: 'V8 and fdlibm (tanh and expm1 operation sequence)', files: ['synth/web/audio/math-kernel.js'], licence: 'BSD-3-Clause (V8) and the fdlibm notice',
    copyright: 'Copyright the V8 project authors; Copyright (C) 1993-2004 Sun Microsystems, Inc.', url: 'https://github.com/v8/v8/blob/main/src/base/ieee754.cc',
    ships: SYNTH, texts: ['V8-LICENSE.txt', 'fdlibm-LICENSE.txt'], note: 'Ported to WebAssembly for the synth’s math kernel.' },
  { name: 'Hono', packages: ['hono'], licence: 'MIT', copyright: 'Copyright (c) 2021 - present, Yusuke Wada and Hono contributors', url: 'https://hono.dev',
    ships: WORKER, texts: ['MIT-Hono.txt'] },
  { name: 'jose', packages: ['jose'], licence: 'MIT', copyright: 'Copyright (c) 2018 Filip Skokan', url: 'https://github.com/panva/jose', ships: WORKER, texts: ['MIT-jose.txt'] },
  { name: 'MusicXML test suite', files: ['converters/fixtures/musicxml-suite/'], licence: 'MIT', copyright: 'The W3C Music Notation Community Group contributors',
    url: 'https://github.com/w3c-cg/musicxmlTestSuite', ships: REPO, texts: [], note: 'Its licence is kept verbatim beside the files.' },
  { name: 'MNX specification sources (git submodule)', files: ['vendor/mnx'], licence: 'W3C Music Notation Community Group (licence to confirm)',
    copyright: 'The MNX contributors, W3C Music Notation Community Group', url: 'https://github.com/w3c/mnx', ships: REPO, texts: [] }
];

const LEAD = [
  `Copyright © 2026 ${HOLDER}.`,
  'MNX Lab — including the synth in `synth/` — is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License, version 3 only** (AGPL-3.0-only), the text in [LICENSE.md](LICENSE.md). It is distributed WITHOUT ANY WARRANTY; see the licence for details.',
  `**Commercial licences** are available from the copyright holder for uses the AGPL does not suit; contact them through GitHub ([github.com/owennewo](https://github.com/owennewo)). The source is at ${SOURCE_URL}.`,
  'The AGPL covers all code and content in this repository **except** the third-party components below, which keep their own licences. Their full licence texts are in [public/licenses/](public/licenses/) (served at `/licenses/`).'
];

export function renderNotice() {
  const rows = COMPONENTS.map(c => `| ${c.name} | ${c.licence} | ${c.copyright} | ${c.ships} | ${[...(c.packages ?? []).map(p => `\`${p}\``), ...(c.files ?? []).map(f => `\`${f}\``)].join(', ')} | ${c.texts.map(t => `[${t}](public/licenses/${t})`).join(', ') || '—'}${c.note ? ` ${c.note}` : ''} |`);
  return ['<!-- Generated by tools/notices.mjs from its inventory; edit that, then run `node tools/notices.mjs`. -->', '', '# Notices', '', ...LEAD.flatMap(p => [p, '']),
    '## Third-party components', '', '| Component | Licence | Copyright | Reaches people through | Files or packages | Licence text and notes |', '|---|---|---|---|---|---|', ...rows, ''].join('\n');
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const md = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\[([^\]]+)\]\(LICENSE\.md\)/g, '<a href="/licenses/AGPL-3.0.txt">$1</a>').replace(/\[([^\]]+)\]\(public\/licenses\/\)/g, '<a href="#third-party">the links below</a>')
  .replace(/\[([^\]]+)\]\((https:[^)]+)\)/g, '<a href="$2">$1</a>').replace(new RegExp(SOURCE_URL.replace(/[.]/g, '\\.') + '(?!")', 'g'), `<a href="${SOURCE_URL}">${SOURCE_URL}</a>`);

export function renderPage() {
  const items = COMPONENTS.map(c => `      <li>
        <h3>${c.url.startsWith('/') ? esc(c.name) : `<a href="${esc(c.url)}">${esc(c.name)}</a>`}</h3>
        <p><span class="licence">${esc(c.licence)}</span> · ${esc(c.copyright)}</p>
        <p class="muted">Reaches people through ${md(c.ships)}.${c.note ? ` ${esc(c.note)}` : ''}${c.url.startsWith('/') ? ` <a href="${esc(c.url)}">Source</a>.` : ''}</p>
        ${c.texts.length ? `<p>${c.texts.map(t => `<a href="/licenses/${t}">${t}</a>`).join(' · ')}</p>` : ''}
      </li>`).join('\n');
  return `<!doctype html>
<!-- Generated by tools/notices.mjs from its inventory; edit that, then run \`node tools/notices.mjs\`. -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MNX Lab — licences and notices</title>
    <meta name="description" content="The licence of MNX Lab and the synth, and every third-party component the site ships." />
    <link rel="stylesheet" href="/site/site.css" />
  </head>
  <body>
    <main class="page">
      <p><a href="/">← MNX Lab</a></p>
      <h1>Licences and notices</h1>
${LEAD.map(p => `      <p>${md(p)}</p>`).join('\n')}
      <h2 id="third-party">Third-party components</h2>
      <ul class="notices">
${items}
      </ul>
    </main>
  </body>
</html>
`;
}

export const OUTPUTS = { 'NOTICE.md': renderNotice, 'notices/index.html': renderPage };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  for (const [file, render] of Object.entries(OUTPUTS)) {
    const target = path.join(ROOT, file), text = render();
    if (check) { if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) { console.error(`${file} is stale: run node tools/notices.mjs`); process.exitCode = 1; } }
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, text); console.log(`wrote ${file}`); }
  }
}

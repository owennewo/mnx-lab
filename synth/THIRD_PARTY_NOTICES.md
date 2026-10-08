# Third-party notices — the synth

Copyright © 2026 Owen Williams. The synth is part of MNX Lab and is licensed under the GNU
AGPL-3.0-only, with commercial licences available from the copyright holder (see the
repository's `LICENSE.md` and `NOTICE.md`, and the site's `/notices/` page, which list every
component with its full licence text). This file records what the synth's own DSP and code
contain.

## FAUST libraries in the compiled DSP

FAUST 2.81.10 and library hashes are pinned in dsp/faust-toolchain.json. Each
shipped generated/*.json records the used functions' author, copyright and
licence metadata in its `meta` array and the library hashes in `librarySha256`.
These metadata files are shipped alongside each WASM; do not remove them.

The metadata identifies GRAME libraries under LGPL with exception and
Julius O. Smith III filters under the MIT-style STK-4.3 licence, among other
function attributions. Licences are function-specific: the compiler's own
licence does not by itself describe all generated runtime code.

Inventory of the 0.2.0 DSP (8 Oct 2026, from each generated `.json` `meta` and the
pinned library sources):

- Explicitly **MIT-style STK-4.3** (Julius O. Smith III): `filters.lib` functions
  (`fir`, `iir`, `lowpass`, `tf1`, `tf2`, `pole`, `bandpass`, `allpass_comb`, …), and
  `reverbs.lib` `zita_rev1_stereo` (the Room bus), which sits in that library's
  "jos section" released under STK-4.3.
- Explicitly **LGPL with exception** (GRAME): `maths.lib`, `envelopes.lib`.
- Without a per-function licence in the metadata: `basics.lib/sAndH`,
  `delays.lib/fdelay4`, `fdelayltv`, `envelopes.lib/ar`, `filters.lib/highpass`,
  `lowpass0_highpass1`, `oscillators.lib/lf_sawpos`, `routes.lib/hadamard`. They fall
  under their library's header (GRAME LGPL with exception, or the JOS STK-4.3
  section); this still needs confirming function by function before any distribution.
- Not shipped: the fonts (`Instrument Sans`, `JetBrains Mono`) are named in CSS with
  system fallbacks, never bundled or fetched. The audition material (pieces, the
  "Eight-bar study" performance, seed 20261004) and the WAV comparisons are the
  project's own renders and generations.

Before external distribution, inventory every shipped function, preserve its
notice, include the applicable full licence/exception texts and resolve any
unlabelled metadata. The compiler itself is a build tool, not in these archives.

## V8 / fdlibm math routines

web/audio/math-kernel.js ports V8's fdlibm-derived tanh/expm1 operation sequence
to WebAssembly. Relevant upstream sources and notices:

- [V8 ieee754.cc](https://github.com/v8/v8/blob/main/src/base/ieee754.cc)
- [V8 fdlibm notice](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/LICENSE.fdlibm)
- [V8 licence](https://chromium.googlesource.com/v8/v8/+/refs/heads/main/LICENSE)

The fdlibm notice attributes Sun Microsystems (1993–2004) and requires its
notice to be preserved. Full applicable upstream notices and exact source
revision attribution still need to be incorporated before distribution.

## Project code

AGPL-3.0-only OR a commercial licence (`package.json`: `AGPL-3.0-only OR LicenseRef-Commercial`).

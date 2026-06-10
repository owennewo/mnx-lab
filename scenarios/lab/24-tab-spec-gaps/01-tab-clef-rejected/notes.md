# Notes

MusicXML 4.0 includes `TAB` in its clef-sign vocabulary, so every notation+tab guitar
score converted from MusicXML naturally wants to express a TAB clef. MNX v17 cannot:
`clef-sign` is `C | F | G`.

The exhibit is deliberately focused: `staffPosition: 0` is supplied so the **only**
validation error is the enum rejection — even though requiring `staffPosition` (a
pitch-to-line mapping) makes no conceptual sense for a tab staff, which has no pitch
axis. That second wrinkle is itself telling: the clef object's shape assumes pitched
staves throughout.

Our position (see [docs/tab-extension-spec.md](../../../../docs/tab-extension-spec.md)):
this is the *right* rejection for the wrong reason. Tab is a **view** of the same
semantic content, not a different clef — so the fix is not adding `TAB` to the enum but
giving MNX a way to declare staff presentation. Until the spec has one, the `_x.tab`
extension uses a part-level `staffKind` flag.

History: this project's MusicXML converter originally emitted TAB clefs, which made
every converted guitar score invalid and silently burned all LLM self-correction
retries. Fixed 2026-06-09 by the v2 single-source migration.

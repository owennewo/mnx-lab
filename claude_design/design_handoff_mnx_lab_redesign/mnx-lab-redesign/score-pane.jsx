// score-pane.jsx — scenario header, score toolbar, paper, JSON pane, state panels.
(() => {
  const NotationSVG = () => window.MNX_ENGRAVE.NotationSVG;
  const TabSVG = () => window.MNX_ENGRAVE.TabSVG;

  // ── JSON pane ──────────────────────────────────────────────────────
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function hlLine(line) {
    return esc(line).replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      m => {
        let cls = 'number';
        if (/^"/.test(m)) cls = /:$/.test(m) ? 'key' : 'string';
        else if (/true|false/.test(m)) cls = 'boolean';
        else if (/null/.test(m)) cls = 'null';
        return '<span class="json-' + cls + '">' + m + '</span>';
      });
  }

  function findAnchorLine(lines, a) {
    if (!a) return -1;
    let c = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(a.q)) { c++; if (c === a.n) return i; }
    }
    return -1;
  }

  function JsonPane({ text, anchors, selNote, onPickNote, errAnchor, errSelected, onClose }) {
    const bodyRef = React.useRef(null);
    const lines = React.useMemo(() => text.split('\n'), [text]);
    const lineToNote = React.useMemo(() => {
      const m = {};
      (anchors || []).forEach((a, i) => { const ln = findAnchorLine(lines, a); if (ln >= 0) m[ln] = i; });
      return m;
    }, [lines, anchors]);
    const errLine = React.useMemo(() => findAnchorLine(lines, errAnchor), [lines, errAnchor]);
    const selLine = errSelected ? errLine
      : (selNote != null && anchors && anchors[selNote] ? findAnchorLine(lines, anchors[selNote]) : -1);

    React.useEffect(() => {
      if (selLine < 0 || !bodyRef.current) return;
      const el = bodyRef.current.querySelector('[data-ln="' + selLine + '"]');
      if (el) bodyRef.current.scrollTop = Math.max(0, el.offsetTop - bodyRef.current.clientHeight / 2);
    }, [selLine]);

    return (
      <div className="json-pane" data-screen-label="Document pane (score.mnx.json)">
        <div className="json-hdr">
          <span>score.mnx.json</span>
          <span className="jh-count">{lines.length} lines</span>
          <span className="jh-x">
            <button className="tb-btn" style={{ height: 22, padding: '0 8px', fontSize: 11 }}
              onClick={() => navigator.clipboard && navigator.clipboard.writeText(text)}>copy</button>
            <button className="tb-btn" style={{ height: 22, padding: '0 8px', fontSize: 11 }} onClick={onClose} title="Close document pane">×</button>
          </span>
        </div>
        <div className="json-body" ref={bodyRef}>
          {lines.map((l, i) => {
            const noteIdx = lineToNote[i];
            const anchored = noteIdx !== undefined;
            const cls = 'jline' + (anchored ? ' anchored' : '') +
              (i === selLine ? (errSelected ? ' hl-err' : ' hl') : '');
            return (
              <div key={i} className={cls} data-ln={i}
                title={anchored ? 'Click to select this note in the score' : undefined}
                onClick={anchored && onPickNote ? (() => onPickNote(noteIdx)) : undefined}>
                <span className="ln">{i + 1}</span>
                <code dangerouslySetInnerHTML={{ __html: hlLine(l) || ' ' }}></code>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── scenario header ────────────────────────────────────────────────
  const LIFECYCLE = ['draft', 'valid', 'rendered', 'verified'];
  function Lifecycle({ status }) {
    const stage = LIFECYCLE.indexOf(status) + 1;
    return (
      <span className="lifecycle" title={'Lifecycle: draft → valid → rendered → verified. Only “verified” is a human assertion; the rest are recomputed by check-scenarios.'}>
        <span className="steps">
          {LIFECYCLE.map((st, i) => <i key={st} className={(i < stage ? 'f' : '') + (status === 'verified' && i < stage ? ' v' : '')}></i>)}
        </span>
        <span className="lc-t">{status}</span>
      </span>
    );
  }

  function stripMd(p) {
    return p.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
  }

  function ScenarioHeader({ cur, isSketch, onDiscard, onPickDef }) {
    const [notesOpen, setNotesOpen] = React.useState(false);
    const [defsOpen, setDefsOpen] = React.useState(false);
    React.useEffect(() => { setNotesOpen(false); setDefsOpen(false); }, [cur.id]);
    const featureSet = React.useMemo(() => new Set(cur.featureDefs || []), [cur.id]);
    return (
      <div className="scen-hdr" data-screen-label={'Scenario: ' + cur.id}>
        <div className="scen-id-row">
          <span className="scen-id">scenarios/{isSketch ? cur.baseId : cur.id}</span>
          {isSketch ? (
            <span className="vchip sketch">sketch — editable copy
              <button className="linky" style={{ color: 'inherit', textDecoration: 'underline', marginLeft: 4 }} onClick={onDiscard}>discard</button>
            </span>
          ) : null}
        </div>
        <h1 className="scen-title">{cur.title}</h1>
        <div className="badge-row">
          {cur.standard === 'invalid'
            ? <span className="vchip gap"><span className="vdot" style={{ background: 'var(--st-gap)' }}></span>MNX invalid · by design</span>
            : <span className="vchip ok"><span className="vdot" style={{ background: 'var(--st-rendered)' }}></span>MNX valid</span>}
          {cur.extension !== 'n/a'
            ? <span className={'vchip ' + (cur.extension === 'valid' ? 'ok' : 'gap')}>
                <span className="vdot" style={{ background: cur.extension === 'valid' ? 'var(--st-rendered)' : 'var(--st-gap)' }}></span>
                _x.tab {cur.extension}</span>
            : null}
          <Lifecycle status={cur.status} />
          <span className="vchip">{cur.source}</span>
          {cur.idRefs ? <span className="vchip" title="Exercises cross-referencing (note/event ids) — the scenarios most likely to break a renderer.">id-refs</span> : null}
          {typeof cur.defs === 'number' ? (
            <button className={'vchip clicky' + (defsOpen ? ' on' : '')}
              title="Schema $defs exercised by this document — the coverage axis"
              onClick={() => setDefsOpen(!defsOpen)}>{cur.defs} $defs {defsOpen ? '▴' : '▾'}</button>
          ) : null}
        </div>
        {defsOpen ? (
          <div className="defs-row">
            {(cur.coversDefs || []).map(d => featureSet.has(d)
              ? <button key={d} className="dchip live" title={'Shelve the library by $def and jump to “' + d + '”'}
                  onClick={() => onPickDef && onPickDef(d)}>{d}</button>
              : <span key={d} className="dchip" title="plumbing def — excluded from the coverage denominator">{d}</span>)}
            <span className="defs-hint">accented defs are feature defs — click one to shelve the library by it</span>
          </div>
        ) : null}
        <p className="scen-desc">{cur.desc}</p>
        <div className="scen-links">
          {cur.specRef ? <a href={cur.specRef} target="_blank" rel="noopener noreferrer">spec reference ↗</a> : null}
          {cur.issueRef ? <a href={cur.issueRef} target="_blank" rel="noopener noreferrer">w3c-cg/mnx#63 ↗</a> : null}
          {cur.notes ? (
            <button className="linky" onClick={() => setNotesOpen(!notesOpen)}>
              {notesOpen ? 'hide notes.md' : 'notes.md →'}
            </button>
          ) : null}
        </div>
        {notesOpen && cur.notes ? (
          <div className="notes-block">
            {cur.notes.map((p, i) => <p key={i}>{stripMd(p)}</p>)}
          </div>
        ) : null}
      </div>
    );
  }

  // ── state panels (rendered on paper) ───────────────────────────────
  function GapExhibit({ cur, onErrClick, errSelected }) {
    return (
      <div className="state-panel">
        <h3><span className="sp-dia"></span>Invalid by design — a spec-gap exhibit</h3>
        <p>
          This document is deliberately rejected by the official MNX schema. The validation
          errors below are pinned: if a schema bump makes this document start passing,
          the corpus tests flag it as a spec-evolution signal. Rendering is skipped — the
          document itself is the exhibit.
        </p>
        <div className="err-table">
          {cur.errors.map((e, i) => (
            <div key={i} className={'err-row'} onClick={() => onErrClick(i)}
              title="Click to locate the offending value in the document">
              <span className="er-rule">{e.rule}{errSelected ? ' · highlighted in document →' : ''}</span>
              <span className="er-msg">{e.msg}</span>
              <span className="er-path">{e.path}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function RenderFail({ cur }) {
    return (
      <div className="state-panel">
        <h3><span className="sp-warn"></span>Validates, doesn’t render yet</h3>
        <p>
          The document passes both verdicts, but the layout engine doesn’t support a feature
          it uses. That’s an honest gap, not an error — the uncovered def sits on the
          coverage backlog, and this scenario is its test fixture-in-waiting.
        </p>
        <code className="fail-code">{cur.renderError}</code>
      </div>
    );
  }

  // ── toolbar + pane ─────────────────────────────────────────────────
  function ScorePane(props) {
    const { cur, isSketch, view, setView, showJson, setShowJson, zoom, setZoom,
      noteSel, setNoteSel, playing, setPlaying, bpm, setBpm, playPos, glyphsOk, onDiscard, onPickDef } = props;
    const [errSel, setErrSel] = React.useState(false);
    React.useEffect(() => { setErrSel(false); }, [cur.id]);

    const Not = NotationSVG();
    const Tab = TabSVG();
    const hasTab = !!cur.tab;
    const canRender = !!cur.music;
    const invalid = cur.standard === 'invalid';

    const pickNote = idx => {
      setErrSel(false);
      setNoteSel(idx === noteSel ? null : idx);
      if (!showJson) setShowJson(true);
    };
    const pickErr = () => { setErrSel(true); setNoteSel(null); if (!showJson) setShowJson(true); };

    const svgProps = { music: cur.music, selected: noteSel, active: playPos, onNote: pickNote, glyphsOk };

    return (
      <div className="main" data-screen-label="Score pane">
        <ScenarioHeader cur={cur} isSketch={isSketch} onDiscard={onDiscard} onPickDef={onPickDef} />

        <div className="sc-toolbar">
          <div className="seg" role="group" aria-label="View mode">
            <button className={view === 'notation' ? 'on' : ''} disabled={!canRender} onClick={() => setView('notation')}>Notation</button>
            <button className={view === 'tab' ? 'on' : ''} disabled={!hasTab}
              title={hasTab ? undefined : 'No _x.tab part in this document'} onClick={() => setView('tab')}>Tab</button>
            <button className={view === 'both' ? 'on' : ''} disabled={!hasTab}
              title={hasTab ? undefined : 'No _x.tab part in this document'} onClick={() => setView('both')}>Both</button>
          </div>
          <div className="tb-spacer"></div>
          <div className="tb-group">
            <button className="tb-btn" disabled={zoom <= 0.75} onClick={() => setZoom(Math.max(0.75, zoom - 0.25))}>−</button>
            <span className="tb-mono">{Math.round(zoom * 100)}%</span>
            <button className="tb-btn" disabled={zoom >= 1.75} onClick={() => setZoom(Math.min(1.75, zoom + 0.25))}>+</button>
          </div>
          <div className="tb-div"></div>
          <div className="tb-group" title={canRender ? 'Playback is a pure function of the document (Tone.js)' : 'Nothing to play — document doesn’t render'}>
            <button className="tb-btn" disabled={!canRender} onClick={() => setPlaying(!playing)} aria-label={playing ? 'Stop' : 'Play'}>
              {playing
                ? <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="currentColor"></rect></svg>
                : <svg width="10" height="10" viewBox="0 0 10 10"><polygon points="2,1 9,5 2,9" fill="currentColor"></polygon></svg>}
            </button>
            <input className="bpm-in" type="number" min="40" max="220" value={bpm}
              onChange={e => setBpm(Math.max(40, Math.min(220, Number(e.target.value) || 96)))} />
            <span className="tb-mono" style={{ minWidth: 26, textAlign: 'left' }}>bpm</span>
          </div>
          <div className="tb-div"></div>
          <button className="tb-btn" onClick={() => navigator.clipboard && navigator.clipboard.writeText(cur.jsonText)} title="Copy score JSON">copy json</button>
          <button className={'tb-btn' + (showJson ? ' on' : '')} onClick={() => setShowJson(!showJson)}
            title="Show the MNX document beside the rendering">
            <svg width="12" height="10" viewBox="0 0 12 10"><rect x="0.5" y="0.5" width="11" height="9" rx="1.5" fill="none" stroke="currentColor"></rect><line x1="7" y1="0.5" x2="7" y2="9.5" stroke="currentColor"></line></svg>
            json
          </button>
        </div>

        <div className="score-area">
          <div className="paper-scroll">
            <div className="paper" style={{ width: 'min(100%, ' + Math.round(820 * zoom) + 'px)' }}>
              {invalid ? <GapExhibit cur={cur} onErrClick={pickErr} errSelected={errSel} />
                : !canRender ? <RenderFail cur={cur} />
                : (
                  <div>
                    {(view === 'notation' || view === 'both') ? (
                      <div>
                        {hasTab ? <p className="pane-cap">notation</p> : null}
                        <Not {...svgProps} />
                      </div>
                    ) : null}
                    {view === 'both' ? <div className="both-gap"></div> : null}
                    {(view === 'tab' || view === 'both') && hasTab ? (
                      <div>
                        <p className="pane-cap">tab · _x.tab</p>
                        <Tab music={cur.music} tab={cur.tab} selected={noteSel} active={playPos} onNote={pickNote} />
                      </div>
                    ) : null}
                  </div>
                )}
            </div>
          </div>
          {showJson && cur.jsonText ? (
            <JsonPane
              text={cur.jsonText}
              anchors={cur.anchors}
              selNote={noteSel}
              onPickNote={pickNote}
              errAnchor={cur.errorAnchor}
              errSelected={errSel}
              onClose={() => setShowJson(false)}
            />
          ) : null}
        </div>
      </div>
    );
  }

  window.MNXScorePane = ScorePane;
  window.MNXJsonPane = JsonPane;
})();

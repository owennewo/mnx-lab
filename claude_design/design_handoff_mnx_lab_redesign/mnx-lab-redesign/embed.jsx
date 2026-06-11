// embed.jsx — mock of <mnx-editor-app> as an embeddable component.
// In the real build this is one custom element + shadow root (P4); here the
// same React pieces are wrapped in a container that adapts to ITS OWN width
// (ResizeObserver — container-driven, never viewport-driven).
(() => {
  const D = window.MNX_DATA;
  const { NotationSVG, TabSVG } = window.MNX_ENGRAVE;

  function BrandMark() {
    return (
      <svg className="mark" width="14" height="14" viewBox="0 0 20 20">
        <line x1="1" y1="4" x2="19" y2="4"></line>
        <line x1="1" y1="7" x2="19" y2="7"></line>
        <line x1="1" y1="10" x2="19" y2="10"></line>
        <line x1="1" y1="13" x2="19" y2="13"></line>
        <line x1="1" y1="16" x2="19" y2="16"></line>
        <ellipse cx="13.5" cy="10" rx="3.1" ry="2.3" transform="rotate(-18 13.5 10)"></ellipse>
      </svg>
    );
  }

  // ── mode="viewer" ──────────────────────────────────────────────────
  // Compact behavior is pure CSS: .mnx-embed.viewer is a size container and
  // embed.css hides/tightens chrome below 420px container width — genuinely
  // container-driven, no JS measurement.
  function EmbedViewer({ scenario, view: v0, json: j0 = false, controls = true, theme = 'light', accent }) {
    const s = D.scenarios.find(x => x.id === scenario);
    const [view, setView] = React.useState(v0 || (s && s.tab ? 'both' : 'notation'));
    const [showJson, setShowJson] = React.useState(j0);
    const [noteSel, setNoteSel] = React.useState(null);
    if (!s) return <div className="mnx-embed">unknown scenario: {scenario}</div>;
    const hasTab = !!s.tab;
    const pick = i => { setNoteSel(i === noteSel ? null : i); if (!showJson) setShowJson(true); };
    const style = accent ? { '--accent': accent } : undefined;
    const JsonPane = window.MNXJsonPane;

    return (
      <div className="mnx-embed viewer" data-theme={theme} style={style}
        data-screen-label={'Embed viewer: ' + s.id}>
        <div className="emb-bar">
          {s.standard === 'invalid'
            ? <span className="gapdia"></span>
            : <span className="pip" data-st={s.status}></span>}
          <span className="emb-title">{s.title}</span>
          <span className="emb-id">{s.id}</span>
          <a className="emb-brand" href="MNX Lab Redesign.html" title="Rendered by MNX Lab">
            <BrandMark></BrandMark><span className="emb-brand-t">MNX Lab</span>
          </a>
        </div>

        {controls ? (
          <div className="emb-controls">
            <div className="seg mini" role="group" aria-label="View mode">
              <button className={view === 'notation' ? 'on' : ''} onClick={() => setView('notation')}>Notation</button>
              <button className={view === 'tab' ? 'on' : ''} disabled={!hasTab} onClick={() => setView('tab')}>Tab</button>
              <button className={view === 'both' ? 'on' : ''} disabled={!hasTab} onClick={() => setView('both')}>Both</button>
            </div>
            <span className="emb-spacer"></span>
            <button className={'tb-btn' + (showJson ? ' on' : '')} onClick={() => setShowJson(!showJson)}>json</button>
          </div>
        ) : null}

        <div className="emb-paper">
          {(view === 'notation' || view === 'both') ? (
            <div>
              {hasTab && view === 'both' ? <p className="pane-cap">notation</p> : null}
              <NotationSVG music={s.music} selected={noteSel} onNote={pick} glyphsOk={true}></NotationSVG>
            </div>
          ) : null}
          {view === 'both' && hasTab ? <div style={{ height: 12 }}></div> : null}
          {(view === 'tab' || view === 'both') && hasTab ? (
            <div>
              {view === 'both' ? <p className="pane-cap">tab · _x.tab</p> : null}
              <TabSVG music={s.music} tab={s.tab} selected={noteSel} onNote={pick}></TabSVG>
            </div>
          ) : null}
        </div>

        {showJson ? (
          <JsonPane text={s.jsonText} anchors={s.anchors} selNote={noteSel}
            onPickNote={pick} onClose={() => setShowJson(false)}></JsonPane>
        ) : null}

        <div className="emb-foot">
          <span className="emb-ver">MNX v{D.manifest.mnx}{s.extension !== 'n/a' ? ' · _x.tab v' + D.manifest.tab : ''}</span>
          <a href="MNX Lab Redesign.html">open in MNX Lab ↗</a>
        </div>
      </div>
    );
  }

  // ── mode="gallery" ─────────────────────────────────────────────────
  function EmbedGallery({ height = 600, initial = 'spec/accidentals', theme = 'light' }) {
    const [sel, setSel] = React.useState(initial);
    const [view, setView] = React.useState('notation');
    const [showJson, setShowJson] = React.useState(false);
    const [zoom, setZoom] = React.useState(1);
    const [noteSel, setNoteSel] = React.useState(null);
    const [filter, setFilter] = React.useState('all');
    const [query, setQuery] = React.useState('');
    const [groupBy, setGroupBy] = React.useState('category');
    const [idRefsOnly, setIdRefsOnly] = React.useState(false);
    const Rail = window.MNXRail;
    const ScorePane = window.MNXScorePane;
    const scenario = D.scenarios.find(s => s.id === sel) || null;
    const all = D.scenarios;
    const rendered = all.filter(s => s.status === 'rendered' || s.status === 'verified').length;
    const select = id => {
      setSel(id); setNoteSel(null);
      const sc = D.scenarios.find(x => x.id === id);
      if (sc) setView(sc.defaultView);
    };

    return (
      <div className="mnx-embed gallery" data-theme={theme} style={{ height: height + 'px' }}
        data-screen-label="Embed gallery">
        <div className="emb-bar">
          <a className="emb-brand" style={{ margin: 0, fontSize: '11px', color: 'var(--ink)' }} href="MNX Lab Redesign.html">
            <BrandMark></BrandMark>MNX Lab
          </a>
          <span className="emb-counts">{all.length} scenarios · {rendered} rendered · {D.coverage.covered}/{D.coverage.total} defs</span>
          <span className="emb-spacer"></span>
          <span className="emb-id">MNX v{D.manifest.mnx} · _x.tab v{D.manifest.tab}</span>
        </div>
        <div className="emb-mid">
          <Rail
            sel={sel} onSelect={select}
            filter={filter} setFilter={setFilter}
            query={query} setQuery={setQuery}
            groupBy={groupBy} setGroupBy={setGroupBy}
            idRefsOnly={idRefsOnly} setIdRefsOnly={setIdRefsOnly}
            open={false}
          ></Rail>
          {scenario ? (
            <ScorePane
              cur={scenario} isSketch={false}
              view={view} setView={setView}
              showJson={showJson} setShowJson={setShowJson}
              zoom={zoom} setZoom={setZoom}
              noteSel={noteSel} setNoteSel={setNoteSel}
              playing={false} setPlaying={() => {}}
              bpm={96} setBpm={() => {}}
              playPos={-1} glyphsOk={true}
              onDiscard={() => {}}
              onPickDef={d => { setGroupBy('def'); setFilter('all'); setQuery(d); }}
            ></ScorePane>
          ) : null}
        </div>
      </div>
    );
  }

  // mount every [data-embed] slot on the host page
  document.querySelectorAll('[data-embed]').forEach(el => {
    let cfg = {};
    try { cfg = JSON.parse(el.getAttribute('data-embed')); } catch (e) { /* noop */ }
    const root = ReactDOM.createRoot(el);
    root.render(cfg.mode === 'gallery'
      ? <EmbedGallery {...cfg}></EmbedGallery>
      : <EmbedViewer {...cfg}></EmbedViewer>);
  });

  window.MNX_EMBED = { EmbedViewer, EmbedGallery };
})();

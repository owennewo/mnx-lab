// app.jsx — MNX Lab redesign: shell, header, dashboard, assist drawer, footer.
(() => {
  const { useState, useEffect, useMemo, useRef } = React;
  const D = window.MNX_DATA;
  const BEATS = window.MNX_ENGRAVE.BEATS;

  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "accent": "#3E5C86",
    "paper": "warm",
    "density": "comfortable"
  }/*EDITMODE-END*/;

  // ── header ───────────────────────────────────────────────────────
  function Header({ query, setQuery, onHome, onAssist, assistOn, theme, onTheme, onBurger, searchRef }) {
    const all = D.scenarios;
    const rendered = all.filter(s => s.status === 'rendered' || s.status === 'verified').length;
    return (
      <header className="hdr" data-screen-label="Header">
        <button className="hdr-btn icon burger" onClick={onBurger} aria-label="Toggle library">
          <svg width="13" height="11" viewBox="0 0 13 11">
            <line x1="0" y1="1.5" x2="13" y2="1.5" stroke="currentColor" strokeWidth="1.4"></line>
            <line x1="0" y1="5.5" x2="13" y2="5.5" stroke="currentColor" strokeWidth="1.4"></line>
            <line x1="0" y1="9.5" x2="13" y2="9.5" stroke="currentColor" strokeWidth="1.4"></line>
          </svg>
        </button>
        <button className="wordmark" onClick={onHome} title="Coverage dashboard">
          <svg className="mark" width="20" height="20" viewBox="0 0 20 20">
            <line x1="1" y1="4" x2="19" y2="4"></line>
            <line x1="1" y1="7" x2="19" y2="7"></line>
            <line x1="1" y1="10" x2="19" y2="10"></line>
            <line x1="1" y1="13" x2="19" y2="13"></line>
            <line x1="1" y1="16" x2="19" y2="16"></line>
            <ellipse cx="13.5" cy="10" rx="3.1" ry="2.3" transform="rotate(-18 13.5 10)"></ellipse>
          </svg>
          <span className="wm-t">MNX <em>Lab</em></span>
        </button>
        <span className="env-chip">MNX v{D.manifest.mnx} · _x.tab v{D.manifest.tab}</span>
        <div className="hdr-spacer"></div>
        <button className="metric-chip" onClick={onHome} title="Open the coverage dashboard">
          <span className="mdot"></span>
          {rendered}/{all.length} rendered
          <span style={{ opacity: 0.45 }}>·</span>
          {D.coverage.covered}/{D.coverage.total} defs
        </button>
        <div className="hdr-search">
          <input ref={searchRef} value={query} placeholder="Filter scenarios…" onChange={e => setQuery(e.target.value)} />
          <kbd>/</kbd>
        </div>
        <button className={'hdr-btn' + (assistOn ? ' on' : '')} onClick={onAssist} title="AI editing — downstream; operates on sketches only">
          <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.2"></circle><circle cx="6" cy="6" r="1.4" fill="currentColor"></circle></svg>
          Assist
        </button>
        <button className="hdr-btn icon" onClick={onTheme} title="Toggle theme" aria-label="Toggle theme">
          <svg width="13" height="13" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.2"></circle>
            <path d="M7 1.5 a5.5 5.5 0 0 0 0 11 z" fill="currentColor"></path>
          </svg>
        </button>
      </header>
    );
  }

  // ── coverage dashboard (the empty state) ─────────────────────────
  function Overview({ onSelect }) {
    const all = D.scenarios;
    const n = all.length;
    const rendered = all.filter(s => s.status === 'rendered' || s.status === 'verified').length;
    const verified = all.filter(s => s.status === 'verified').length;
    const gaps = all.filter(s => s.standard === 'invalid').length;
    const cov = D.coverage;
    const STATUS_ORDER = [['verified', 'var(--st-verified)'], ['rendered', 'var(--st-rendered)'], ['valid', 'var(--st-valid)'], ['draft', 'var(--st-draft)']];

    const cats = D.LAB_CATEGORIES.map(([id, title]) => ({ id, title, items: all.filter(s => s.group === id) }))
      .concat([{ id: 'spec', title: 'MNX spec worked examples — W3C mirror', items: all.filter(s => s.ns === 'spec') }]);

    return (
      <div className="overview" data-screen-label="Coverage dashboard">
        <div className="ov-inner">
          <p className="ov-kicker">test bench · W3C MNX · guitar tab</p>
          <h1 className="ov-title">Turn any valid MNX into correct notation.</h1>
          <p className="ov-lede">
            The scenario library proves it: small MNX documents covering the spec, each with
            pinned verdicts, a committed layout snapshot, and a live render. Pick a scenario
            from the library — or start with the gaps the renderer hasn’t earned yet.
          </p>

          <div className="ov-tiles">
            <div className="ov-tile"><div className="t-num">{n}</div><div className="t-lab">scenarios</div></div>
            <div className="ov-tile"><div className="t-num">{rendered}</div><div className="t-lab"><span className="pip" data-st="rendered"></span>rendered</div></div>
            <div className="ov-tile"><div className="t-num">{verified}</div><div className="t-lab"><span className="pip" data-st="verified"></span>verified</div></div>
            <div className="ov-tile"><div className="t-num">{gaps}</div><div className="t-lab"><span className="gapdia"></span>spec gaps</div></div>
          </div>

          <div className="ov-sec">
            <h2>Feature-def coverage</h2>
            <p className="sec-sub">Measured against the schema’s $defs (plumbing excluded) — the uncovered list is the backlog.</p>
            <div className="defs-meta">
              <span>{cov.covered} of {cov.total} feature defs exercised</span>
              <span>{Math.round(100 * cov.covered / cov.total)}%</span>
            </div>
            <div className="defs-bar"><i style={{ width: (100 * cov.covered / cov.total) + '%' }}></i></div>
            <div className="defs-chips">
              {cov.uncovered.map(d => <span key={d} className="dchip">{d}</span>)}
            </div>
          </div>

          <div className="ov-sec">
            <h2>By category</h2>
            <p className="sec-sub">Status per shelf — categories are a filing convention; the data model stays flat and facet-driven.</p>
            <div className="cat-table">
              {cats.map(c => {
                const counts = STATUS_ORDER.map(([st]) => c.items.filter(s => s.status === st).length);
                const total = c.items.length;
                return (
                  <button key={c.id} className={'cat-row' + (total ? '' : ' empty')}
                    onClick={total ? (() => onSelect(c.items[0].id)) : undefined}>
                    <span className="cr-id">{c.id}/</span>
                    <span className="cr-bar">
                      {total ? STATUS_ORDER.map(([st, color], i) => counts[i]
                        ? <i key={st} style={{ width: (100 * counts[i] / total) + '%', background: color }}></i>
                        : null) : null}
                    </span>
                    <span className="cr-count">{total ? total : 'planned'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="ov-foot">
            spec/ mirrors the MNX Community Group’s worked examples verbatim (synced {D.manifest.synced},
            metadata generated — never hand-edited). W3C Community Group material, mirrored with attribution
            for conformance testing. Invalid-by-design exhibits feed w3c-cg/mnx#63.
          </p>
        </div>
      </div>
    );
  }

  // ── assist drawer ─────────────────────────────────────────────────
  function AssistDrawer({ cur, isSketch, sketch, busy, onFork, onSend, onClose }) {
    const [draft, setDraft] = useState('');
    const bodyRef = useRef(null);
    useEffect(() => {
      if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }, [sketch && sketch.messages.length, busy]);
    const send = text => { const t = (text || '').trim(); if (!t || busy) return; setDraft(''); onSend(t); };

    return (
      <div>
        <div className="drawer-veil" onClick={onClose}></div>
        <div className="drawer" data-screen-label="Assist drawer">
          <div className="drawer-hdr">
            <div>
              <div className="dh-t">Assist</div>
              <div className="dh-sub">AI edit · downstream · sketches only</div>
            </div>
            <button className="tb-btn dh-x" onClick={onClose}>close</button>
          </div>
          <div className="drawer-body" ref={bodyRef}>
            {!isSketch ? (
              <div>
                <div className="exhibit-note">
                  <h4><span className="gapdia"></span>Corpus documents are read-only</h4>
                  <p>
                    {cur
                      ? <span><b>{cur.title}</b> is a library exhibit — chat edits can never target the corpus. Fork it to a sketch to experiment; the scenario stays untouched.</span>
                      : 'Select a scenario first, then fork it to an editable sketch.'}
                  </p>
                  {cur && cur.music ? (
                    <button className="fork-btn" onClick={onFork}>Fork to a sketch →</button>
                  ) : cur ? <p>This exhibit doesn’t render — nothing to sketch from yet.</p> : null}
                </div>
                <p className="downstream-note">
                  Editing and AI are deliberately downstream (vision §goals 6–7): they assume the
                  renderer is already trustworthy. The assist loop is a pure function of the
                  document — it proposes a new MNX document; everything re-derives from it.
                </p>
              </div>
            ) : (
              <React.Fragment>
                {sketch.messages.map((m, i) => (
                  <div key={i} className={'msg ' + m.role}>
                    {m.text}
                    {m.tool ? <em className="tool">⤷ {m.tool}</em> : null}
                  </div>
                ))}
                {busy ? <div className="thinking">editing document <i>·</i><i>·</i><i>·</i></div> : null}
                {!busy && sketch.messages.length < 2 ? (
                  <div className="sugg-row">
                    {['raise everything a step', 'make the last note flat', 'lower it a third'].map(s => (
                      <button key={s} className="sugg" onClick={() => send(s)}>{s}</button>
                    ))}
                  </div>
                ) : null}
              </React.Fragment>
            )}
          </div>
          {isSketch ? (
            <div className="drawer-input">
              <textarea
                rows="1" value={draft} placeholder="Describe an edit to the sketch…"
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(draft); } }}
              ></textarea>
              <button className="send-btn" disabled={busy || !draft.trim()} onClick={() => send(draft)}>Send</button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── footer ────────────────────────────────────────────────────────
  function Footer({ cur, noteSel }) {
    return (
      <footer className="ftr" data-screen-label="Status bar">
        <span>MNX v{D.manifest.mnx} · _x.tab v{D.manifest.tab} · {D.scenarios.length} scenarios · spec/ synced {D.manifest.synced}</span>
        <span className="sel-info">
          {cur && noteSel != null && cur.noteList[noteSel]
            ? <span>selected <b>{cur.noteList[noteSel].label}</b> · measure {cur.noteList[noteSel].m} · highlighted in document</span>
            : (cur && cur.music ? 'click a notehead — or a note line in the JSON — to cross-locate it' : 'no selection')}
        </span>
      </footer>
    );
  }

  // ── canned sketch edit ───────────────────────────────────────────
  function applyEdit(music, text) {
    const m = JSON.parse(JSON.stringify(music));
    const all = [];
    m.measures.forEach(me => me.events.forEach(e => (e.notes || []).forEach(n => all.push(n))));
    const t = text.toLowerCase();
    let did = '';
    if (/flat|sharp/.test(t)) {
      const acc = /sharp/.test(t) ? '#' : 'b';
      const word = /sharp/.test(t) ? 'sharp' : 'flat';
      if (/last/.test(t) && all.length) {
        const n = all[all.length - 1]; n.acc = acc; delete n.lbl;
        did = 'Set the last note (' + 'n' + all.length + ') ' + word + ' — one alter field changed.';
      } else {
        all.forEach(n => { n.acc = acc; delete n.lbl; });
        did = 'Marked every note ' + word + ' (' + all.length + ' alter fields).';
      }
    } else {
      const dir = /down|lower/.test(t) ? -1 : 1;
      const steps = /third/.test(t) ? 2 : 1;
      all.forEach(n => { n.sp += dir * steps; delete n.lbl; delete n.acc; });
      did = (dir > 0 ? 'Raised' : 'Lowered') + ' all ' + all.length + ' notes by ' +
        (steps === 2 ? 'a third' : 'a step') + ' — pitches rewritten in place.';
    }
    return { music: m, did };
  }

  // ── app ───────────────────────────────────────────────────────────
  function App() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const [sel, setSel] = useState(null);
    const [view, setView] = useState('notation');
    const [showJson, setShowJson] = useState(true);
    const [zoom, setZoom] = useState(1);
    const [noteSel, setNoteSel] = useState(null);
    const [filter, setFilter] = useState('all');
    const [query, setQuery] = useState('');
    const [groupBy, setGroupBy] = useState('category');
    const [idRefsOnly, setIdRefsOnly] = useState(false);
    const [assistOpen, setAssistOpen] = useState(false);
    const [sketch, setSketch] = useState(null);
    const [busy, setBusy] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [playPos, setPlayPos] = useState(-1);
    const [bpm, setBpm] = useState(96);
    const [railOpen, setRailOpen] = useState(false);
    const [glyphsOk, setGlyphsOk] = useState(true);
    const searchRef = useRef(null);

    // theme / tweak side-effects
    useEffect(() => {
      const r = document.documentElement;
      r.dataset.theme = t.theme;
      r.dataset.density = t.density;
      r.style.setProperty('--accent', t.accent);
      r.style.setProperty('--paper', t.paper === 'cool' ? 'oklch(0.985 0.0035 250)' : 'oklch(0.985 0.006 85)');
    }, [t.theme, t.density, t.accent, t.paper]);

    // Bravura availability → glyph fallback
    useEffect(() => {
      let alive = true;
      if (document.fonts && document.fonts.load) {
        document.fonts.load('40px Bravura').then(() => document.fonts.ready).then(() => {
          if (alive) setGlyphsOk(document.fonts.check('40px Bravura'));
        }).catch(() => {});
      }
      return () => { alive = false; };
    }, []);

    const scenario = useMemo(() => D.scenarios.find(s => s.id === sel) || null, [sel]);

    // current doc = sketch (if any) else selected scenario
    const cur = useMemo(() => {
      if (sketch) {
        const json = D.h.genMnx(sketch.music);
        return {
          id: 'sketch/' + sketch.baseId.replace(/\//g, '-'),
          baseId: sketch.baseId,
          title: sketch.title,
          desc: 'Transient editable copy — never persisted to the corpus. Saved scores and scenarios are untouched.',
          status: 'draft', standard: 'valid', extension: sketch.tab ? 'valid' : 'n/a',
          source: 'sketch', bars: sketch.music.measures.length, idRefs: false, defs: '—',
          music: sketch.music, tab: sketch.tab,
          json, jsonText: JSON.stringify(json, null, 2),
          noteList: D.h.flatNotes(sketch.music),
          anchors: D.h.genAnchors(sketch.music)
        };
      }
      return scenario;
    }, [scenario, sketch]);

    const isSketch = !!sketch;

    const selectScenario = id => {
      setSketch(null); setBusy(false);
      setSel(id); setNoteSel(null); setPlaying(false); setRailOpen(false);
      const s = D.scenarios.find(x => x.id === id);
      if (s) setView(s.defaultView);
    };

    // playback: step through events at bpm
    useEffect(() => {
      if (!playing || !cur || !cur.music) { setPlayPos(-1); return; }
      const evs = [];
      cur.music.measures.forEach(m => m.events.forEach(e => evs.push(BEATS[e.dur] * (e.dot ? 1.5 : 1))));
      let i = 0, h = null, stop = false;
      const step = () => {
        if (stop) return;
        if (i >= evs.length) { setPlaying(false); return; }
        setPlayPos(i);
        h = setTimeout(step, evs[i++] * 60000 / bpm);
      };
      step();
      return () => { stop = true; clearTimeout(h); setPlayPos(-1); };
    }, [playing, cur && cur.id, bpm]);

    // keyboard: / focuses filter, ↑/↓ + j/k navigate, esc closes
    useEffect(() => {
      const onKey = e => {
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea') {
          if (e.key === 'Escape') e.target.blur();
          return;
        }
        if (e.key === '/') {
          e.preventDefault();
          if (searchRef.current) searchRef.current.focus();
          return;
        }
        if (e.key === 'Escape') {
          if (assistOpen) setAssistOpen(false);
          else setNoteSel(null);
          return;
        }
        if (['ArrowDown', 'ArrowUp', 'j', 'k'].includes(e.key)) {
          e.preventDefault();
          const vis = window.MNX_FILTER(D.scenarios, filter, query, idRefsOnly);
          if (!vis.length) return;
          const i = vis.findIndex(s => s.id === sel);
          const dir = (e.key === 'ArrowDown' || e.key === 'j') ? 1 : -1;
          const next = i < 0 ? (dir > 0 ? 0 : vis.length - 1) : Math.max(0, Math.min(vis.length - 1, i + dir));
          selectScenario(vis[next].id);
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [sel, filter, query, idRefsOnly, assistOpen]);

    const fork = () => {
      if (!scenario || !scenario.music) return;
      setSketch({
        baseId: scenario.id,
        title: scenario.title + ' — sketch',
        music: JSON.parse(JSON.stringify(scenario.music)),
        tab: scenario.tab || null,
        messages: [{
          role: 'assistant',
          text: 'Forked ' + scenario.id + ' into a transient sketch. The corpus scenario is untouched. Tell me an edit — I modify the document, and notation, tab, and JSON all re-derive from it.'
        }]
      });
      setNoteSel(null); setPlaying(false);
    };

    const sendChat = text => {
      if (!sketch) return;
      setSketch(s => ({ ...s, messages: [...s.messages, { role: 'user', text }] }));
      setBusy(true);
      setTimeout(() => {
        setSketch(s => {
          if (!s) return s;
          const { music, did } = applyEdit(s.music, text);
          return {
            ...s, music,
            messages: [...s.messages, {
              role: 'assistant',
              text: did + ' The score re-rendered from the new document — nothing else holds musical state.',
              tool: 'edit_notation · 1 tool call · document replaced'
            }]
          };
        });
        setBusy(false);
      }, 950);
    };

    const Rail = window.MNXRail;
    const ScorePane = window.MNXScorePane;

    return (
      <div className="app">
        <Header
          query={query} setQuery={setQuery} searchRef={searchRef}
          onHome={() => { setSketch(null); setSel(null); setNoteSel(null); setPlaying(false); }}
          onAssist={() => setAssistOpen(!assistOpen)} assistOn={assistOpen}
          theme={t.theme} onTheme={() => setTweak('theme', t.theme === 'light' ? 'dark' : 'light')}
          onBurger={() => setRailOpen(!railOpen)}
        />
        <div className="mid">
          <Rail
            sel={isSketch ? null : sel} onSelect={selectScenario}
            filter={filter} setFilter={setFilter}
            query={query} setQuery={setQuery}
            groupBy={groupBy} setGroupBy={setGroupBy}
            idRefsOnly={idRefsOnly} setIdRefsOnly={setIdRefsOnly}
            open={railOpen}
          />
          {cur ? (
            <ScorePane
              cur={cur} isSketch={isSketch}
              view={view} setView={setView}
              showJson={showJson} setShowJson={setShowJson}
              zoom={zoom} setZoom={setZoom}
              noteSel={noteSel} setNoteSel={setNoteSel}
              playing={playing} setPlaying={setPlaying}
              bpm={bpm} setBpm={setBpm}
              playPos={playPos} glyphsOk={glyphsOk}
              onDiscard={() => setSketch(null)}
              onPickDef={d => { setGroupBy('def'); setFilter('all'); setIdRefsOnly(false); setQuery(d); setRailOpen(true); }}
            />
          ) : (
            <Overview onSelect={selectScenario} />
          )}
        </div>
        {assistOpen ? (
          <AssistDrawer
            cur={scenario} isSketch={isSketch} sketch={sketch} busy={busy}
            onFork={fork} onSend={sendChat} onClose={() => setAssistOpen(false)}
          />
        ) : null}
        <Footer cur={cur} noteSel={noteSel} />

        <TweaksPanel>
          <TweakSection label="Theme" />
          <TweakRadio label="Mode" value={t.theme} options={['light', 'dark']} onChange={v => setTweak('theme', v)} />
          <TweakColor label="Accent" value={t.accent} options={['#3E5C86', '#9C4F33', '#2F6B4F']} onChange={v => setTweak('accent', v)} />
          <TweakRadio label="Paper" value={t.paper} options={['warm', 'cool']} onChange={v => setTweak('paper', v)} />
          <TweakSection label="Layout" />
          <TweakRadio label="Density" value={t.density} options={['comfortable', 'compact']} onChange={v => setTweak('density', v)} />
        </TweaksPanel>
      </div>
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
})();

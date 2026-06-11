// sidebar.jsx — the permanent library rail with faceted browsing.
// The data model is flat (04-scenario-library.md): "category" is just the
// default grouping facet. The rail can equally shelve by status, source, or
// schema $def — and the same flat filter feeds all of them.
(() => {
  const D = () => window.MNX_DATA;

  function matches(s, filter, query, idRefsOnly) {
    if (idRefsOnly && !s.idRefs) return false;
    if (filter === 'verified' && s.status !== 'verified') return false;
    if (filter === 'rendered' && !(s.status === 'rendered' || s.status === 'verified')) return false;
    if (filter === 'needs' && !((s.status === 'valid' || s.status === 'draft') && s.standard !== 'invalid')) return false;
    if (filter === 'gaps' && s.standard !== 'invalid') return false;
    if (query) {
      const q = query.toLowerCase();
      if (!(s.title.toLowerCase().includes(q) || s.id.toLowerCase().includes(q) ||
            (s.tags || []).some(t => t.toLowerCase().includes(q)) ||
            (s.coversDefs || []).some(d => d.toLowerCase().includes(q)))) return false;
    }
    return true;
  }

  window.MNX_FILTER = (list, filter, query, idRefsOnly) =>
    list.filter(s => matches(s, filter, query, idRefsOnly));

  function Row({ s, on, onSelect, sub }) {
    return (
      <button className={'srow' + (on ? ' on' : '')} title={s.desc} onClick={() => onSelect(s.id)}>
        {s.standard === 'invalid'
          ? <span className="gapdia"></span>
          : <span className="pip" data-st={s.status}></span>}
        <span className="srow-t">{s.title}{sub ? <span className="srow-sub"> · {sub}</span> : null}</span>
        {s.standard === 'invalid' ? <span className="mini-tag gap">gap</span> : null}
        {s.tab ? <span className="mini-tag">tab</span> : null}
      </button>
    );
  }

  function GroupHead({ id, count, title }) {
    return (
      <div className="cat-head" title={title || ''}>
        <span className="cat-id">{id}</span>
        <span className="cat-count">{count}</span>
      </div>
    );
  }

  function Rail({ sel, onSelect, filter, setFilter, query, setQuery, open,
                  groupBy, setGroupBy, idRefsOnly, setIdRefsOnly }) {
    const data = D();
    const all = data.scenarios;
    const counts = {
      all: all.length,
      verified: all.filter(s => s.status === 'verified').length,
      rendered: all.filter(s => s.status === 'rendered' || s.status === 'verified').length,
      needs: all.filter(s => (s.status === 'valid' || s.status === 'draft') && s.standard !== 'invalid').length,
      gaps: all.filter(s => s.standard === 'invalid').length
    };
    const CHIPS = [
      ['all', 'All'], ['verified', 'Verified'], ['rendered', 'Rendered'],
      ['needs', 'Needs work'], ['gaps', 'Spec gaps']
    ];
    const GROUPS = [['category', 'category'], ['status', 'status'], ['source', 'source'], ['def', '$def']];
    const filtering = filter !== 'all' || query !== '' || idRefsOnly;
    const vis = window.MNX_FILTER(all, filter, query, idRefsOnly);
    const cov = data.coverage;

    let body = null;

    if (groupBy === 'category') {
      const labCats = data.LAB_CATEGORIES.map(([id, title]) => {
        const items = all.filter(s => s.group === id);
        return { id, title, items, vis: items.filter(s => vis.includes(s)) };
      });
      const specVis = vis.filter(s => s.ns === 'spec');
      body = (
        <React.Fragment>
          <div className="ns-head">lab/ <span>hand-authored</span></div>
          {labCats.map(cat => {
            if (filtering && cat.vis.length === 0) return null;
            const renderedN = cat.items.filter(s => s.status === 'rendered' || s.status === 'verified').length;
            return (
              <div key={cat.id}>
                <GroupHead id={cat.id.replace('lab/', '')} title={cat.title}
                  count={cat.items.length ? renderedN + '/' + cat.items.length : ''} />
                {cat.items.length === 0
                  ? <div className="srow planned">planned — no scenarios yet</div>
                  : cat.vis.map(s => <Row key={s.id} s={s} on={sel === s.id} onSelect={onSelect} />)}
              </div>
            );
          })}
          {(!filtering || specVis.length > 0) ? (
            <div>
              <div className="ns-head">spec/ <span>W3C mirror · read-only · synced {data.manifest.synced}</span></div>
              {specVis.map(s => <Row key={s.id} s={s} on={sel === s.id} onSelect={onSelect} />)}
            </div>
          ) : null}
        </React.Fragment>
      );
    } else if (groupBy === 'status') {
      const shelves = [
        ['verified', 'human-approved'], ['rendered', 'snapshot committed'],
        ['valid', 'validates, no render'], ['draft', 'work in progress']
      ];
      body = (
        <React.Fragment>
          <div className="ns-head">by status <span>lifecycle: draft → valid → rendered → verified</span></div>
          {shelves.map(([st, sub]) => {
            const items = vis.filter(s => s.status === st && s.standard !== 'invalid');
            if (!items.length) return null;
            return (
              <div key={st}>
                <GroupHead id={st} title={sub} count={items.length} />
                {items.map(s => <Row key={s.id} s={s} on={sel === s.id} onSelect={onSelect} sub={s.id.split('/')[0]} />)}
              </div>
            );
          })}
          {(() => {
            const items = vis.filter(s => s.standard === 'invalid');
            return items.length ? (
              <div>
                <GroupHead id="invalid by design" title="spec-gap exhibits" count={items.length} />
                {items.map(s => <Row key={s.id} s={s} on={sel === s.id} onSelect={onSelect} sub={s.id.split('/')[0]} />)}
              </div>
            ) : null;
          })()}
        </React.Fragment>
      );
    } else if (groupBy === 'source') {
      const shelves = [
        ['spec-example', 'mirrored from w3c-cg/mnx'],
        ['hand-written', 'authored here'],
        ['converter', 'from real MusicXML — none yet'],
        ['llm', 'model-generated — none yet']
      ];
      body = (
        <React.Fragment>
          <div className="ns-head">by source <span>evidential weight for the CG post</span></div>
          {shelves.map(([src, sub]) => {
            const items = vis.filter(s => s.source === src);
            if (!items.length && filtering) return null;
            return (
              <div key={src}>
                <GroupHead id={src} title={sub} count={items.length || ''} />
                {items.length
                  ? items.map(s => <Row key={s.id} s={s} on={sel === s.id} onSelect={onSelect} sub={s.id.split('/')[0]} />)
                  : <div className="srow planned">{sub}</div>}
              </div>
            );
          })}
        </React.Fragment>
      );
    } else { // def
      const map = {};
      vis.forEach(s => (s.featureDefs || []).forEach(d => { (map[d] = map[d] || []).push(s); }));
      const defs = Object.keys(map).sort();
      body = (
        <React.Fragment>
          <div className="ns-head">by $def <span>feature defs only — plumbing excluded</span></div>
          {defs.map(d => (
            <div key={d}>
              <GroupHead id={d} count={map[d].length} title={'Scenarios exercising the “' + d + '” schema def'} />
              {map[d].map(s => <Row key={d + s.id} s={s} on={sel === s.id} onSelect={onSelect} sub={s.id.split('/')[0]} />)}
            </div>
          ))}
          {defs.length === 0 ? <div className="srow planned">no feature defs match</div> : null}
          {!filtering ? (
            <div>
              <div className="ns-head">uncovered <span>the backlog — no scenario yet</span></div>
              {cov.uncovered.map(d => (
                <div key={d} className="srow planned defrow">
                  <span className="pip" data-st="draft"></span>{d}
                </div>
              ))}
            </div>
          ) : null}
        </React.Fragment>
      );
    }

    return (
      <aside className={'rail' + (open ? ' open' : '')} data-screen-label="Library rail">
        <div className="rail-filters">
          <div className="hdr-search" style={{ width: '100%' }}>
            <input
              value={query}
              placeholder={groupBy === 'def' ? 'Filter — try “slur” or “tie”…' : 'Filter scenarios…'}
              onChange={e => setQuery(e.target.value)}
            />
            <kbd>/</kbd>
          </div>
          <div className="chiprow">
            {CHIPS.map(([k, label]) => (
              <button key={k} className={'fchip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
                {label} <b>{counts[k]}</b>
              </button>
            ))}
            <button className={'fchip' + (idRefsOnly ? ' on' : '')} onClick={() => setIdRefsOnly(!idRefsOnly)}
              title="Only scenarios exercising cross-references (ids) — the ones most likely to break a renderer">
              id-refs <b>{all.filter(s => s.idRefs).length}</b>
            </button>
          </div>
          <div className="chiprow grp-row">
            <span className="grp-label">shelve by</span>
            {GROUPS.map(([k, label]) => (
              <button key={k} className={'fchip' + (groupBy === k ? ' on' : '')} onClick={() => setGroupBy(k)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="rail-list">
          {body}
          {filtering && vis.length === 0 ? (
            <div className="srow planned">nothing matches — clear filters</div>
          ) : null}
        </div>

        <button className="rail-foot" onClick={() => onSelect(null)} title="Open the coverage dashboard">
          <span className="cov-label">
            <span>{cov.covered} / {cov.total} feature defs</span>
            <span>coverage →</span>
          </span>
          <span className="cov-bar"><i style={{ width: (100 * cov.covered / cov.total) + '%' }}></i></span>
        </button>
      </aside>
    );
  }

  window.MNXRail = Rail;
})();

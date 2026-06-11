// engrave.jsx — stand-in score renderer for the MNX Lab redesign prototype.
// The real renderer (layout → primitives → SVG) is out of scope; this draws
// plausible Bravura-engraved output so the surrounding chrome can be judged.
(() => {
  const SS = 10; // staff space (px); Bravura em = 4 spaces → font-size 40
  const BEATS = { w: 4, h: 2, q: 1, '8': 0.5 };
  const G = {
    clef: '\uE050', clef8: '\uE052',
    wh: '\uE0A2', hf: '\uE0A3', bk: '\uE0A4',
    sharp: '\uE262', flat: '\uE260', nat: '\uE261',
    flagU: '\uE240', flagD: '\uE241',
    restW: '\uE4E3', restH: '\uE4E4', restQ: '\uE4E5', rest8: '\uE4E6',
    digit: d => String.fromCharCode(0xE080 + d)
  };
  const FLATS_SPS = [4, 7, 3, 6, 2, 5, 1];
  const SHARPS_SPS = [8, 5, 9, 6, 3, 7, 4];

  function planLayout(music, width) {
    const left = 16;
    let x = left + 4;
    const clefX = x; x += 32;
    const acc = (music.keyFlats || 0) + (music.keySharps || 0);
    const keyX = x; x += acc * 9 + (acc ? 8 : 0);
    const timeX = x; x += music.time ? 30 : 0;
    const start = x + 10;
    const right = width - 18;
    const mW = (right - start) / music.measures.length;
    const measures = music.measures.map((m, i) => {
      const x0 = start + i * mW;
      const n = m.events.length;
      const pad = Math.min(30, mW * 0.16);
      // duration-proportional spacing
      const beats = m.events.map(e => BEATS[e.dur] * (e.dot ? 1.5 : 1));
      const total = beats.reduce((a, b) => a + b, 0);
      let cum = 0;
      const xs = m.events.map((e, j) => {
        const pos = n === 1 ? 0.5 * total : cum;
        cum += beats[j];
        return n === 1 ? x0 + mW / 2 : x0 + pad + (mW - 2 * pad - 14) * (pos / total);
      });
      return { x0, x1: x0 + mW, xs };
    });
    return { left, clefX, keyX, timeX, right, measures };
  }

  function Acc({ x, y, kind, ok }) {
    if (ok) {
      const g = kind === '#' ? G.sharp : kind === 'b' ? G.flat : G.nat;
      return <text className="glyph" x={x} y={y}>{g}</text>;
    }
    const c = kind === '#' ? '\u266F' : kind === 'b' ? '\u266D' : '\u266E';
    return <text className="fb-acc" x={x} y={y + 4}>{c}</text>;
  }

  function flatEvents(music, plan) {
    const evs = [];
    music.measures.forEach((m, mi) => m.events.forEach((ev, ei) => {
      evs.push(Object.assign({}, ev, { mi, x: plan.measures[mi].xs[ei] }));
    }));
    return evs;
  }

  function NotationSVG({ music, width = 760, selected = null, active = -1, onNote, glyphsOk = true }) {
    const plan = planLayout(music, width);
    let minSp = 0, maxSp = 8;
    music.measures.forEach(m => m.events.forEach(e => (e.notes || []).forEach(n => {
      if (n.sp < minSp) minSp = n.sp;
      if (n.sp > maxSp) maxSp = n.sp;
    })));
    const yTop = 36 + Math.max(0, (maxSp - 8)) * 5;
    const yOf = sp => yTop + (8 - sp) * 5;
    const height = yTop + (8 - Math.min(minSp, -1)) * 5 + 46;
    const els = [];

    for (let i = 0; i < 5; i++) {
      els.push(<line key={'st' + i} className="staffline" x1={plan.left} x2={plan.right} y1={yOf(i * 2)} y2={yOf(i * 2)} />);
    }
    els.push(glyphsOk
      ? <text key="clef" className="glyph" x={plan.clefX} y={yOf(2)}>{music.clef === 'g8vb' ? G.clef8 : G.clef}</text>
      : <text key="clef" className="fallback-clef" x={plan.clefX} y={yOf(2) + 5}>{music.clef === 'g8vb' ? 'G8' : 'G'}</text>);

    const flats = music.keyFlats || 0, sharps = music.keySharps || 0;
    for (let i = 0; i < flats; i++) els.push(<Acc key={'kf' + i} x={plan.keyX + i * 9} y={yOf(FLATS_SPS[i])} kind="b" ok={glyphsOk} />);
    for (let i = 0; i < sharps; i++) els.push(<Acc key={'ks' + i} x={plan.keyX + i * 9} y={yOf(SHARPS_SPS[i])} kind="#" ok={glyphsOk} />);

    if (music.time) {
      els.push(glyphsOk
        ? <g key="ts">
            <text className="glyph" x={plan.timeX} y={yOf(6)}>{G.digit(music.time[0])}</text>
            <text className="glyph" x={plan.timeX} y={yOf(2)}>{G.digit(music.time[1])}</text>
          </g>
        : <text key="ts" className="timesig-fb" x={plan.timeX} y={yOf(4) + 4}>{music.time[0]}/{music.time[1]}</text>);
    }

    plan.measures.forEach((m, i) => {
      if (i < plan.measures.length - 1) {
        els.push(<line key={'bl' + i} className="barline" x1={m.x1} x2={m.x1} y1={yOf(8)} y2={yOf(0)} />);
      }
    });
    els.push(<line key="fin1" className="barline" x1={plan.right - 6.5} x2={plan.right - 6.5} y1={yOf(8)} y2={yOf(0)} />);
    els.push(<rect key="fin2" className="barline-thick" x={plan.right - 3.5} y={yOf(8)} width={3.5} height={yOf(0) - yOf(8)} />);

    const evs = flatEvents(music, plan);
    const beamGroups = {};
    let noteIdx = 0;

    evs.forEach((ev, gi) => {
      const x = ev.x;
      if (ev.rest) {
        const restG = ev.dur === 'w' ? G.restW : ev.dur === 'h' ? G.restH : ev.dur === '8' ? G.rest8 : G.restQ;
        const ry = ev.dur === 'w' ? yOf(6) : yOf(4);
        els.push(glyphsOk
          ? <text key={'r' + gi} className="glyph" x={x - 5} y={ry}>{restG}</text>
          : <rect key={'r' + gi} className="beam" x={x - 5} y={ry - (ev.dur === 'w' ? 0 : 4)} width={10} height={4} />);
        return;
      }
      const sps = ev.notes.map(n => n.sp);
      const avg = sps.reduce((a, b) => a + b, 0) / sps.length;
      const stemUp = avg <= 3.5;
      const topSp = Math.max(...sps), botSp = Math.min(...sps);

      ev.notes.forEach(n => {
        const idx = noteIdx++;
        const y = yOf(n.sp);
        for (let L = -2; L >= n.sp; L -= 2) {
          els.push(<line key={'lg' + idx + L} className="ledger" x1={x - (ev.dur === 'w' ? 12 : 10)} x2={x + (ev.dur === 'w' ? 12 : 10)} y1={yOf(L)} y2={yOf(L)} />);
        }
        for (let L = 10; L <= n.sp; L += 2) {
          els.push(<line key={'lg' + idx + L} className="ledger" x1={x - 10} x2={x + 10} y1={yOf(L)} y2={yOf(L)} />);
        }
        if (n.acc) els.push(<Acc key={'ac' + idx} x={x - 17} y={y} kind={n.acc} ok={glyphsOk} />);
        const cls = 'note' + (selected === idx ? ' sel' : '') + (active === gi ? ' act' : '');
        els.push(
          <g key={'n' + idx} className={cls} onClick={onNote ? (() => onNote(idx)) : undefined}>
            {selected === idx ? <circle className="selring" cx={x} cy={y} r={10.5} /> : null}
            {glyphsOk
              ? <text className="glyph head" x={x - (ev.dur === 'w' ? 8.4 : 5.9)} y={y}>{ev.dur === 'w' ? G.wh : ev.dur === 'h' ? G.hf : G.bk}</text>
              : <ellipse className="fb-head" cx={x} cy={y} rx={5.6} ry={4.1}
                  fill={ev.dur === 'q' || ev.dur === '8' ? 'currentColor' : 'none'}
                  stroke="currentColor" strokeWidth="1.4"
                  transform={'rotate(-18 ' + x + ' ' + y + ')'} />}
            <rect className="hit" x={x - 12} y={y - 13} width={24} height={26} />
          </g>
        );
        if (ev.dot) els.push(<circle key={'dt' + idx} className="dot" cx={x + 11.5} cy={y - (((n.sp % 2) + 2) % 2 === 0 ? 3 : 0)} r={1.9} />);
      });

      if (ev.dur !== 'w') {
        const sx = stemUp ? x + 5.4 : x - 5.4;
        if (ev.beam) {
          const key = ev.mi + '/' + ev.beam;
          (beamGroups[key] = beamGroups[key] || []).push({
            x: sx, up: stemUp,
            yHead: stemUp ? yOf(botSp) : yOf(topSp),
            yFar: stemUp ? yOf(topSp) : yOf(botSp)
          });
        } else {
          const yEnd = stemUp ? yOf(topSp) - 33 : yOf(botSp) + 33;
          els.push(<line key={'sm' + gi} className="stem" x1={sx} x2={sx} y1={stemUp ? yOf(botSp) - 1.5 : yOf(topSp) + 1.5} y2={yEnd} />);
          if (ev.dur === '8') {
            els.push(glyphsOk
              ? <text key={'fl' + gi} className="glyph" x={sx} y={yEnd}>{stemUp ? G.flagU : G.flagD}</text>
              : <line key={'fl' + gi} className="stem" x1={sx} x2={sx + 7} y1={yEnd} y2={yEnd + (stemUp ? 9 : -9)} />);
          }
        }
      }

      if (ev.arc && gi + 1 < evs.length) {
        const nx = evs[gi + 1].x;
        const myTop = yOf(Math.max(...sps));
        const nextSps = (evs[gi + 1].notes || []).map(n => n.sp);
        const nTop = nextSps.length ? yOf(Math.max(...nextSps)) : myTop;
        const y0 = myTop - 9, y1 = nTop - 9;
        const cx = (x + nx) / 2, cy = Math.min(y0, y1) - 11;
        els.push(<path key={'arc' + gi} className="arc" d={'M ' + (x + 5) + ' ' + y0 + ' Q ' + cx + ' ' + cy + ' ' + (nx - 5) + ' ' + y1} />);
      }
    });

    Object.keys(beamGroups).forEach(k => {
      const g = beamGroups[k];
      const up = g[0].up;
      const beamY = up ? Math.min(...g.map(s => s.yFar)) - 31 : Math.max(...g.map(s => s.yFar)) + 31;
      g.forEach((s, i) => els.push(<line key={'bs' + k + i} className="stem" x1={s.x} x2={s.x} y1={s.yHead + (up ? -1.5 : 1.5)} y2={beamY} />));
      els.push(<rect key={'bm' + k} className="beam"
        x={Math.min(g[0].x, g[g.length - 1].x) - 0.6}
        y={up ? beamY : beamY - 4.5}
        width={Math.abs(g[g.length - 1].x - g[0].x) + 1.2} height={4.5} rx={1} />);
    });

    return (
      <svg className="score-svg" viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label="rendered notation (prototype stand-in)">
        {els}
      </svg>
    );
  }

  function TabSVG({ music, tab, width = 760, selected = null, active = -1, onNote, noteOffset = 0 }) {
    const plan = planLayout(music, width);
    const top = 22, gap = 9.5;
    const yS = s => top + (s - 1) * gap;
    const height = top + 5 * gap + 20;
    const els = [];

    for (let s = 1; s <= 6; s++) {
      els.push(<line key={'tl' + s} className="staffline" x1={plan.left} x2={plan.right} y1={yS(s)} y2={yS(s)} />);
    }
    ['T', 'A', 'B'].forEach((c, i) => {
      els.push(<text key={'tw' + i} className="tabword" x={plan.clefX + 2} y={yS(1.6 + i * 1.55) + 3}>{c}</text>);
    });

    plan.measures.forEach((m, i) => {
      if (i < plan.measures.length - 1) {
        els.push(<line key={'tb' + i} className="barline" x1={m.x1} x2={m.x1} y1={yS(1)} y2={yS(6)} />);
      }
    });
    els.push(<line key="tf1" className="barline" x1={plan.right - 6.5} x2={plan.right - 6.5} y1={yS(1)} y2={yS(6)} />);
    els.push(<rect key="tf2" className="barline-thick" x={plan.right - 3.5} y={yS(1)} width={3.5} height={yS(6) - yS(1)} />);

    let noteIdx = noteOffset;
    let gi = 0;
    tab.measures.forEach((m, mi) => m.events.forEach((ev, ei) => {
      const x = plan.measures[mi].xs[ei];
      const myEv = gi++;
      ev.frets.forEach(fr => {
        const idx = noteIdx++;
        const y = yS(fr.s);
        const cls = 'note' + (selected === idx ? ' sel' : '') + (active === myEv ? ' act' : '');
        els.push(
          <g key={'f' + idx} className={cls} onClick={onNote ? (() => onNote(idx)) : undefined}>
            {selected === idx ? <circle className="selring" cx={x} cy={y} r={8.5} /> : null}
            <rect className="knock" x={x - 5.5} y={y - 6} width={11} height={12} />
            <text className="fret" x={x} y={y + 4} textAnchor="middle">{fr.f}</text>
          </g>
        );
      });
    }));

    return (
      <svg className="score-svg" viewBox={'0 0 ' + width + ' ' + height} role="img" aria-label="rendered tablature (prototype stand-in)">
        {els}
      </svg>
    );
  }

  window.MNX_ENGRAVE = { NotationSVG, TabSVG, BEATS };
})();

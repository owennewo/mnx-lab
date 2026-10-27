"""The audio half of recording alignment (.claude/skills/sync-recording).

Run with the MuScriptor environment's Python (README: setting it up), isolated (-I), passing
paths — never from inside the directory holding downloaded audio:

    PY=~/.venvs/muscriptor/bin/python
    $PY -I tools/recording-align/align.py <command> --out <dir>

    transcribe   the recording → notes.json + transcription.mid (MuScriptor, medium)
                 reads audio/source.wav (else audio/mono.wav), or --audio <wav>;
                 --instruments g1,g2 tells MuScriptor what plays (default acoustic_guitar; add
                 voice for a singer) and --keep which of them to keep (default: all but voice);
                 [--half-speed]: transcribe a pitch-preserving half-speed stretch (Rubber Band,
                 crisp transients) and scale the times back — a Basic Pitch-era experiment, not
                 yet tried with MuScriptor; see RUNS.md before relying on it
    check        does the recording sound like the score at all: key/capo shift, tuning, density
    structure    which written bar is played when → structure.json + report.md
    selftest     the bar search against synthetic performances (no audio, no transcriber)

Reads score.json from align.ts. Every step writes what it found into --out.
"""
import argparse
import json
import math
import os
import sys

import numpy as np

PC_NAMES = 'C C# D Eb E F F# G Ab A Bb B'.split()


def load(out, name):
    with open(os.path.join(out, name)) as f:
        return json.load(f)


def save(out, name, value):
    with open(os.path.join(out, name), 'w') as f:
        json.dump(value, f, indent=1)


# ---------------------------------------------------------------- transcribe

HALF_SPEED_FILTER = 'rubberband=tempo=0.5:transients=crisp:detector=percussive'


MODEL = 'medium'   # small drops half the notes of a separated stem (RUNS.md run 7); large needs > 6 GB


def transcribe(out, half_speed=False, audio=None, instruments='acoustic_guitar', keep=None):
    """MuScriptor (Kyutai/Mirelo, CC-BY-NC weights: non-commercial use) from this environment. It is
    deterministic, gives no loudness (amp is 1) and ends every note at the next onset of any note, so
    a note's end is not its length. Tuning comes from the audio itself (librosa)."""
    import subprocess
    import librosa
    import mido
    wav = audio or next(p for p in (os.path.join(out, 'audio', 'source.wav'), os.path.join(out, 'audio', 'mono.wav')) if os.path.exists(p))
    scale = 1.0
    if half_speed:
        # Same pitch, twice as long: a fast passage heard as a slow one.
        os.makedirs(os.path.join(out, 'audio'), exist_ok=True)
        slow = os.path.join(out, 'audio', 'half.wav')
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', wav, '-af', HALF_SPEED_FILTER, slow], check=True)
        wav, scale = slow, 0.5
    groups = [g.strip() for g in instruments.split(',') if g.strip()]
    kept = set(keep.split(',')) if keep else {g for g in groups if g != 'voice'}
    events_path = os.path.join(out, 'transcription.events.json')
    cli = os.path.join(os.path.dirname(sys.executable), 'muscriptor')
    subprocess.run([cli, 'transcribe', wav, '-m', MODEL, '-f', 'json', '-o', events_path, '--instruments', ','.join(groups),
                    '--detect-tempo', 'false'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    events = load(out, 'transcription.events.json')
    starts = {e['index']: e for e in events if e['type'] == 'start'}
    heard = sorted(({'start': starts[e['start_event_index']]['start_time'] * scale, 'end': e['end_time'] * scale,
                     'pitch': int(starts[e['start_event_index']]['pitch']), 'amp': 1.0, 'bends': []}
                    for e in events if e['type'] == 'end' and e['start_event_index'] in starts
                    and starts[e['start_event_index']]['instrument'] in kept), key=lambda n: (n['start'], n['pitch']))
    save(out, 'notes.json', heard)
    midi = mido.MidiFile(ticks_per_beat=480)
    track = mido.MidiTrack(); midi.tracks.append(track)
    tick = lambda s: int(round(s * 960))   # 120 bpm: 960 ticks a second
    messages = sorted([(tick(n['start']), 1, n['pitch']) for n in heard] + [(tick(n['end']), 0, n['pitch']) for n in heard])
    now = 0
    for at, on, pitch in messages:
        track.append(mido.Message('note_on' if on else 'note_off', note=pitch, velocity=80 if on else 0, time=at - now)); now = at
    midi.save(os.path.join(out, 'transcription.mid'))
    y, sr = librosa.load(wav, sr=22050, mono=True)
    cents = float(librosa.estimate_tuning(y=y, sr=sr)) * 100
    save(out, 'transcription.json', {'listener': 'muscriptor', 'model': MODEL, 'instruments': groups, 'kept': sorted(kept),
                                     'speed': scale, 'filter': HALF_SPEED_FILTER if half_speed else None,
                                     'source': os.path.abspath(wav), 'tuningCents': round(cents, 1)})
    print(f'{len(heard)} notes over {heard[0]["start"]:.1f}–{max(n["end"] for n in heard):.1f} s'
          f'{" (transcribed at half speed, times scaled back)" if half_speed else ""}; tuning {cents:+.0f} cents' if heard else 'no notes heard')


# ---------------------------------------------------------------- check

def check(out):
    heard, score = load(out, 'notes.json'), load(out, 'score.json')
    if not heard:
        sys.exit('check: nothing was heard')
    ha, hs = np.zeros(12), np.zeros(12)
    for n in heard:
        ha[n['pitch'] % 12] += n['amp']
    for s in score['sounding']:
        hs[s['midi'] % 12] += 1
    ha /= np.linalg.norm(ha)
    hs /= np.linalg.norm(hs)
    fits = {k: float(ha @ np.roll(hs, k)) for k in range(-6, 6)}
    best = max(fits, key=fits.get)
    runner = max(v for k, v in fits.items() if k != best)
    # Tuning as transcribe measured it from the audio; a Basic Pitch-era run carries bends instead.
    meta = load(out, 'transcription.json') if os.path.exists(os.path.join(out, 'transcription.json')) else {}
    bends = [b for n in heard for b in n['bends']]
    cents = meta.get('tuningCents', float(np.median(bends)) * 100 / 3 if bends else 0.0)
    span = max(n['end'] for n in heard) - heard[0]['start']
    marked = score['tempo'][0]['bpm'] if score['tempo'] else None
    score_seconds = (score['measures'][-1]['position'] + score['measures'][-1]['duration']) * 4 * 60 / (marked or 120)
    result = {'shift': best, 'fit': fits[best], 'runnerUp': runner, 'fits': fits, 'tuningCents': cents,
              'heardNotes': len(heard), 'heardSeconds': span, 'notesPerSecond': len(heard) / max(span, 1e-6),
              'scoreNotes': len(score['sounding']), 'scoreSecondsAtMarkedTempo': score_seconds,
              'audioPitchClasses': {PC_NAMES[i]: round(float(ha[i]), 2) for i in np.argsort(-ha)[:7]},
              'scorePitchClasses': {PC_NAMES[i]: round(float(hs[i]), 2) for i in np.argsort(-hs)[:7]}}
    flags = []
    if best != 0:
        flags.append(f'the recording fits the score best {best:+d} semitones away: capo or tuning differs')
    # A fourth or fifth away shares all but one pitch class of a diatonic or modal tune, so
    # a runner-up near 0.8 is normal; only a near tie says the key is in doubt.
    if fits[best] - runner < 0.05:
        flags.append(f'the key fit is ambiguous ({fits[best]:.2f} vs {runner:.2f})')
    if abs(cents) > 35:
        flags.append(f'the instrument is {cents:+.0f} cents off concert pitch: semitone matches may slip')
    result['flags'] = flags
    save(out, 'check.json', result)
    print(f'key fit {best:+d} semitones: {fits[best]:.2f} (next best {runner:.2f}); tuning {cents:+.0f} cents')
    print(f'heard {len(heard)} notes over {span:.1f} s ({result["notesPerSecond"]:.1f}/s); score {len(score["sounding"])} notes, {score_seconds:.0f} s at its marked {marked} bpm')
    for f in flags:
        print(f'FLAG: {f}')


# ---------------------------------------------------------------- structure

def proximity(heard, T, dt):
    """For each pitch class and exact pitch, how close (0..1) an onset is at each frame."""
    radius = max(1, int(round(0.08 / dt)))
    kernel = np.exp(-((np.arange(-radius, radius + 1) * dt / 0.04) ** 2))
    pc = np.zeros((12, T), np.float32)
    exact = {}
    for n in heard:
        i = int(round(n['start'] / dt))
        lo, hi = max(0, i - radius), min(T, i + radius + 1)
        if lo >= hi:
            continue
        k = kernel[lo - i + radius: hi - i + radius] * min(1.0, 0.4 + n['amp'])
        np.maximum(pc[n['pitch'] % 12, lo:hi], k, out=pc[n['pitch'] % 12, lo:hi])
        e = exact.setdefault(n['pitch'], np.zeros(T, np.float32))
        np.maximum(e[lo:hi], k, out=e[lo:hi])
    return pc, exact


def segment_scores(written, bars, W, pc, exact, dt, T, miss=0.35):
    """seg[b, w, t]: what bar b scores if it starts at frame t with W[w] seconds a whole note."""
    zero = np.zeros(T, np.float32)
    seg = np.full((len(bars), len(W), T), -np.inf, np.float32)
    lengths = np.zeros((len(bars), len(W)), np.int32)
    for bi, b in enumerate(bars):
        wb = written[str(b)]
        for wi, w in enumerate(W):
            L = max(1, int(round(wb['duration'] * w / dt)))
            lengths[bi, wi] = L
            if L >= T:
                continue
            total = np.full(T - L, -miss * len(wb['notes']), np.float32)
            for off, midi in wb['notes']:
                o = int(round(off * w / dt))
                total += 0.6 * pc[midi % 12][o:o + T - L] + 0.4 * exact.get(midi, zero)[o:o + T - L]
            seg[bi, wi, :T - L] = total
    return seg, lengths


def search(score, heard, dt, W, steps, end_seconds, gap=0.6, structural=0.8, anywhere=3.0, start_free=None):
    """Which written bar is played when: the best path of bars over the audio frames.

    A bar follows its predecessor in the score's own performed order for free; a jump to a
    bar the score itself jumps to (a repeat start, an ending) costs `structural`; any other
    jump `anywhere`. Tempo moves at most `steps` grid steps a bar. Audio before the first bar
    and after the last costs `gap` a second. Returns rows of (bar, start, end, tempo index).
    """
    written = score['written']
    bars = sorted(int(b) for b in written)
    index = {b: i for i, b in enumerate(bars)}
    nb, nw = len(bars), len(W)
    T = int(end_seconds / dt) + 2
    pc, exact = proximity(heard, T, dt)
    seg, L = segment_scores(written, bars, W, pc, exact, dt, T)
    free = np.zeros((nb, nb), bool)                                   # [from, to]: the score's own steps
    for a, b in score['edges']:
        free[index[a], index[b]] = True
    for b in bars:
        if b + 1 in index:
            free[index[b], index[b + 1]] = True
    starts = np.array([b in set(score['structuralStarts']) for b in bars])
    first = index[score['order'][0]]
    start_cost = np.where(starts, structural, anywhere).astype(np.float32)
    start_cost[first] = 0
    NEG = np.float32(-1e9)
    V = np.full((nb, nw, T), NEG, np.float32)
    back_bar = np.full((nb, nw, T), -1, np.int16)
    back_w = np.full((nb, nw, T), -1, np.int16)
    best = (NEG, None)
    bar_idx = np.arange(nb)[:, None]
    w_idx = np.arange(nw)[None, :]
    start_limit = T if start_free is None else int(start_free / dt)
    for t in range(T):
        # Bars that END at t: started at t - L, scored there.
        s = t - L
        ok = s >= 0
        arrive = np.where(ok, V[bar_idx, w_idx, np.clip(s, 0, T - 1)] + seg[bar_idx, w_idx, np.clip(s, 0, T - 1)], NEG)
        if arrive.max() > NEG / 2:
            # Finish here: the rest of the audio unexplained.
            fin = arrive - gap * max(0.0, end_seconds - t * dt)
            k = np.unravel_index(np.argmax(fin), fin.shape)
            if fin[k] > best[0]:
                best = (fin[k], (k[0], k[1], t))
            # Tempo smoothing: the next bar's tempo within `steps` of this one's.
            M = np.full((nb, nw), NEG, np.float32)
            Mw = np.zeros((nb, nw), np.int16)
            for d in range(-steps, steps + 1):
                shifted = np.full((nb, nw), NEG, np.float32)
                if d >= 0:
                    shifted[:, d:] = arrive[:, :nw - d]
                else:
                    shifted[:, :d] = arrive[:, -d:]
                better = shifted > M
                M = np.where(better, shifted, M)
                Mw = np.where(better, (w_idx - d).astype(np.int16), Mw)
            # Free steps: the best predecessor along the score's own order.
            cand = np.where(free[:, :, None], M[:, None, :], NEG)        # [from, to, w]
            src = np.argmax(cand, axis=0)                                 # [to, w]
            val = np.take_along_axis(cand, src[None], axis=0)[0]
            # Jumps: from the best bar anywhere.
            top = np.argmax(M, axis=0)                                    # [w]
            topv = M[top, np.arange(nw)]
            jump = topv[None, :] - np.where(starts, structural, anywhere)[:, None]
            take_jump = jump > val
            val = np.where(take_jump, jump, val)
            src = np.where(take_jump, top[None, :], src)
            better = val > V[:, :, t]
            V[:, :, t] = np.where(better, val, V[:, :, t])
            back_bar[:, :, t] = np.where(better, src, back_bar[:, :, t])
            back_w[:, :, t] = np.where(better, Mw[src, np.arange(nw)[None, :]], back_w[:, :, t])
        if t < start_limit:
            # Start here: the audio before it unexplained.
            fresh = -gap * t * dt - start_cost[:, None]
            better = fresh > V[:, :, t]
            V[:, :, t] = np.where(better, fresh, V[:, :, t])
            back_bar[:, :, t] = np.where(better, -1, back_bar[:, :, t])
    if best[1] is None:
        return [], float(NEG)
    rows = []
    bi, wi, t_end = best[1]
    while True:
        start = t_end - L[bi, wi]
        rows.append((bars[bi], start * dt, t_end * dt, wi))
        pb, pw = back_bar[bi, wi, start], back_w[bi, wi, start]
        if pb < 0:
            break
        bi, wi, t_end = int(pb), int(pw), start
    rows.reverse()
    return rows, float(best[0])


def tempo_grid(low_bpm, high_bpm, ratio):
    """Seconds per whole note, geometric between two quarter-note tempos."""
    count = int(math.ceil(math.log(high_bpm / low_bpm) / math.log(ratio))) + 1
    return np.array([240 / (low_bpm * ratio ** i) for i in range(count)][::-1], np.float32)


def found_fraction(rows, written, heard_start, heard_pitch, shift=0.0, tol=0.07):
    ex = pcf = total = 0
    for bar, start, end, _ in rows:
        wb = written[str(bar)]
        w = (end - start) / wb['duration']
        for off, midi in wb['notes']:
            t = start + off * w + shift
            near = np.abs(heard_start - t) <= tol
            ex += bool(np.any(near & (heard_pitch == midi)))
            pcf += bool(np.any(near & (heard_pitch % 12 == midi % 12)))
            total += 1
    return ex / max(total, 1), pcf / max(total, 1), total


def find_path(score, heard, end_seconds):
    """The bar search, coarse then fine, then the ending it cannot reach on its own."""
    # Pass 1, coarse and wide: the score's marked tempo is not trusted.
    coarse = tempo_grid(40, 320, 1.05)
    rows, _ = search(score, heard, 0.03, coarse, 1, end_seconds)
    if not rows:
        sys.exit('structure: no path found')
    centre = float(np.median([240 / coarse[r[3]] for r in rows]))
    # Pass 2, fine, around what pass 1 heard.
    dt = 0.01 if end_seconds < 240 else 0.02
    rows, total = search(score, heard, dt, tempo_grid(centre / 1.3, centre * 1.3, 1.015), 2, end_seconds)
    rows, closed = close_ending(rows, score, heard)
    return rows, total, closed


def close_ending(rows, score, heard, missing_at_most=2, window=0.15):
    """A held-back ending. The search moves its tempo a step or two a bar, so a final
    ritardando or a chord placed late leaves it a bar or two short of the score's end. When
    the path follows the score's order and only that much is missing, each missing bar starts
    at the first onset where most of its downbeat's exact pitches sound within `window`
    (exact, not pitch class: the bar before often shares the chord's pitch classes), and the
    bar before ends there. Returns the rows and how many were placed this way."""
    order, written = score['order'], score['written']
    missing = len(order) - len(rows)
    if not 0 < missing <= missing_at_most or [r[0] for r in rows] != order[:len(rows)]:
        return rows, 0
    starts = np.array([n['start'] for n in heard])
    pitches = np.array([n['pitch'] for n in heard])
    rows, closed = list(rows), 0
    for bar in order[len(rows):]:
        prev, s0, e0, wi = rows[-1]
        down = {midi for off, midi in written[str(bar)]['notes'] if off == 0}
        if not down:
            break
        best = None
        for t in starts[(starts >= s0 + 0.6 * (e0 - s0)) & (starts <= e0 + (e0 - s0))]:
            sounding = set(pitches[(starts >= t - 0.01) & (starts <= t + window)].tolist()) & down
            if len(sounding) * 2 >= len(down) and (best is None or len(sounding) > best[1]):
                best = (float(t), len(sounding))
        if best is None:
            break
        whole = (e0 - s0) / written[str(prev)]['duration']
        rows[-1] = (prev, s0, best[0], wi)
        rows.append((bar, best[0], best[0] + written[str(bar)]['duration'] * whole, wi))
        closed += 1
    return rows, closed


def structure(out):
    score, heard = load(out, 'score.json'), load(out, 'notes.json')
    end_seconds = max(n['end'] for n in heard) + 0.5
    rows, total, closed = find_path(score, heard, end_seconds)
    heard_start = np.array([n['start'] for n in heard])
    heard_pitch = np.array([n['pitch'] for n in heard])
    written = score['written']
    report_rows = []
    for bar, start, end, wi in rows:
        wb = written[str(bar)]
        w = (end - start) / wb['duration']
        found = sum(1 for off, midi in wb['notes']
                    if np.any((np.abs(heard_start - (start + off * w)) <= 0.07) & (heard_pitch % 12 == midi % 12)))
        report_rows.append({'bar': bar, 'start': round(start, 3), 'end': round(end, 3), 'qbpm': round(240 / w, 1),
                            'notes': len(wb['notes']), 'found': found})
    ex, pcf, notes = found_fraction(rows, written, heard_start, heard_pitch)
    rng = np.random.default_rng(1)
    chance = float(np.mean([found_fraction(rows, written, heard_start, heard_pitch, rng.choice([-1, 1]) * rng.uniform(0.3, 0.9))[1] for _ in range(10)]))
    # Downbeats: how far the bar line sits from a heard note that belongs on it.
    offsets = []
    for r in report_rows:
        pcs = {midi % 12 for off, midi in written[str(r['bar'])]['notes'] if off == 0}
        near = [abs(h - r['start']) for h, p in zip(heard_start, heard_pitch) if p % 12 in pcs and abs(h - r['start']) <= 0.1]
        if near:
            offsets.append(min(near))
    order = score['order']
    follows = [r['bar'] for r in report_rows] == order[:len(report_rows)]
    departures = [i for i in range(1, len(report_rows)) if [report_rows[i - 1]['bar'], report_rows[i]['bar']] not in score['edges']
                  and report_rows[i]['bar'] != report_rows[i - 1]['bar'] + 1]
    tempos = [r['qbpm'] for r in report_rows]
    summary = {
        'bars': len(report_rows), 'start': report_rows[0]['start'], 'end': report_rows[-1]['end'], 'audioEnd': end_seconds - 0.5,
        'foundPitchClass': pcf, 'foundExact': ex, 'chance': chance, 'scoreNotes': notes,
        'downbeatsHeard': len(offsets), 'downbeatMedianMs': 1000 * float(np.median(offsets)) if offsets else None,
        'downbeat90Ms': 1000 * float(np.percentile(offsets, 90)) if offsets else None,
        'tempoMin': min(tempos), 'tempoMax': max(tempos), 'tempoMedian': float(np.median(tempos)),
        'followsScoreOrder': follows, 'performedOrdinals': len(order),
        'closedEnding': closed,
        'departures': [{'row': i, 'from': report_rows[i - 1]['bar'], 'to': report_rows[i]['bar']} for i in departures],
        'weakBars': [{'row': i, **r} for i, r in enumerate(report_rows) if r['notes'] >= 3 and r['found'] / r['notes'] < 0.6],
    }
    save(out, 'structure.json', {'summary': summary, 'rows': report_rows})
    speed = load(out, 'transcription.json').get('speed', 1.0) if os.path.exists(os.path.join(out, 'transcription.json')) else 1.0
    summary['transcriptionSpeed'] = speed
    lines = [f'# Alignment report', '',
             f"- **Transcribed at:** {'half speed (times scaled back)' if speed == 0.5 else 'full speed'}; {len(heard)} notes heard",
             f"- **Order:** {' '.join(str(r['bar']) for r in report_rows)}",
             f"- **Follows the score's performed order:** {'yes' if follows else 'NO'} ({len(report_rows)} of {len(order)} performed bars)",
             f"- **Span:** {summary['start']:.2f}–{summary['end']:.2f} s of {summary['audioEnd']:.2f} s heard",
             *([f"- **Held-back ending:** the last {closed} bar(s) placed at their downbeat's notes, past the search's reach"] if closed else []),
             f"- **Notes found:** {pcf:.0%} by pitch class, {ex:.0%} exact, of {notes}; chance {chance:.0%}",
             f"- **Downbeats:** {len(offsets)} heard, median {summary['downbeatMedianMs'] or 0:.0f} ms, 90th percentile {summary['downbeat90Ms'] or 0:.0f} ms",
             f"- **Tempo:** {summary['tempoMin']:.0f}–{summary['tempoMax']:.0f} bpm (median {summary['tempoMedian']:.0f})", '',
             '| row | bar | start | end | bpm | found |', '|---|---|---|---|---|---|']
    lines += [f"| {i} | {r['bar']} | {r['start']:.2f} | {r['end']:.2f} | {r['qbpm']:.0f} | {r['found']}/{r['notes']} |" for i, r in enumerate(report_rows)]
    with open(os.path.join(out, 'report.md'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    print('\n'.join(lines[:9 + bool(closed)]))
    if departures:
        print('DEPARTURES: ' + ', '.join(f"row {d['row']}: {d['from']}→{d['to']}" for d in summary['departures']))
    if summary['weakBars']:
        print('WEAK BARS: ' + ', '.join(f"row {w['row']} (bar {w['bar']}, {w['found']}/{w['notes']})" for w in summary['weakBars']))


# ---------------------------------------------------------------- selftest

def selftest(_out):
    """The bar search against synthetic performances with known answers: drift, a cut, a jump."""
    rng = np.random.default_rng(7)
    nb = 12
    written = {str(b): {'duration': 1.0 if b != 5 else 1.5,
                        'notes': [[k / 4, int(rng.integers(45, 70))] for k in range(4 if b != 5 else 6)]} for b in range(1, nb + 1)}
    for b in written.values():  # a bass note under each downbeat, as fingerstyle has
        b['notes'].append([0.0, int(rng.integers(38, 45))])
    order = list(range(1, 9)) + list(range(1, 9)) + list(range(9, 13))   # a repeat of 1–8
    score = {'written': written, 'order': order, 'structuralStarts': [1, 9],
             'edges': [[order[i], order[i + 1]] for i in range(len(order) - 1)]}
    failures = []
    cases = {
        'steady, as written': (order, 1.15, 0.0),
        'drifting tempo': (order, 1.05, 0.004),
        'stops early': (order[:13], 1.2, 0.0),
        'skips the repeat': (list(range(1, 13)), 1.1, 0.0),
        'holds back the end': (order, 1.15, 0.0, 1.5),
    }
    for name, (played, whole, drift, *held) in cases.items():
        heard, truth, t = [], [], 1.0 + rng.uniform(0, 1)
        for b in played:
            w = whole * (1 + drift) ** len(truth)
            if held and len(truth) >= len(played) - 2:
                w *= held[0]                                                   # a final ritardando: the last two bars
            truth.append((b, t))
            for off, midi in written[str(b)]['notes']:
                if rng.random() < 0.12:
                    continue                                                   # missed by the transcriber
                at = t + off * w + rng.normal(0, 0.012)
                pitch = midi + (12 if rng.random() < 0.08 else 0)              # octave errors
                heard.append({'start': at, 'end': at + 0.3, 'pitch': pitch, 'amp': 0.6, 'bends': []})
            for _ in range(rng.integers(0, 3)):                                # spurious notes
                at = t + rng.uniform(0, written[str(b)]['duration'] * w)
                heard.append({'start': at, 'end': at + 0.2, 'pitch': int(rng.integers(40, 80)), 'amp': 0.3, 'bends': []})
            t += written[str(b)]['duration'] * w
        heard.sort(key=lambda n: n['start'])
        end = t + 1.5
        rows, _, _ = find_path(score, heard, end)
        got = [r[0] for r in rows]
        worst = max(abs(r[1] - tt) for r, (_, tt) in zip(rows, truth)) if len(rows) == len(truth) else float('inf')
        ok = got == played and worst < 0.05
        print(f"{'ok  ' if ok else 'FAIL'} {name}: {len(got)} bars, worst bar line {worst * 1000:.0f} ms")
        if not ok:
            failures.append(name)
            print(f'     expected {played}\n     found    {got}')
    if failures:
        sys.exit(f'selftest: {len(failures)} case(s) failed')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=['transcribe', 'check', 'structure', 'selftest'])
    parser.add_argument('--out', default='.')
    parser.add_argument('--half-speed', action='store_true', help='transcribe: a half-speed stretch, times scaled back')
    parser.add_argument('--audio', help='transcribe: the audio to read instead of <out>/audio/source.wav (else mono.wav)')
    parser.add_argument('--instruments', default='acoustic_guitar',
                        help='transcribe: MuScriptor instrument groups playing (muscriptor list-instruments); add voice for a singer')
    parser.add_argument('--keep', help='transcribe: groups whose notes to keep (default: all of --instruments but voice)')
    a = parser.parse_args()
    out = os.path.abspath(a.out)
    if a.command == 'transcribe':
        transcribe(out, a.half_speed, a.audio and os.path.abspath(a.audio), a.instruments, a.keep)
    else:
        {'check': check, 'structure': structure, 'selftest': selftest}[a.command](out)

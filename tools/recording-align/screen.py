"""The score a video shows: find the notation panel on screen and save each page of it.

Many lesson and cover videos scroll the arranger's notation along the bottom of the frame.
When one does, reading that is far better than transcribing the audio — tab says string and
fret outright. This finds the panel (a large, bright, unsaturated rectangle present in many
frames), cuts the video into the stretches where the panel holds one page, and saves each
page at the video's full resolution, plus overlapping slices sized for close reading.

  python -I tools/recording-align/screen.py pages --video <file> --out <dir> [--slices 3] [--fps 4]

Writes <out>/screen/pages.json (when each page is on screen, the panel's box) and
<out>/screen/page-NN.png, page-NN-sK.png. Use the best video stream there is (yt-dlp
`-f 'bv*[height<=2160]'`): tab digits read cleanly from 1080p, best from 2160p.
"""
import argparse
import json
import os
import subprocess

import numpy as np

SMALL_W = 480


def probe(video):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                          '-of', 'csv=p=0', video], capture_output=True, text=True, check=True).stdout.strip()
    w, h = (int(x) for x in out.split(',')[:2])
    return w, h


def frames(video, fps, w, h):
    small_h = round(h * SMALL_W / w / 2) * 2
    raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', video, '-vf', f'fps={fps},scale={SMALL_W}:{small_h}',
                          '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, small_h, SMALL_W, 3).astype(np.float32), small_h


def paper(rgb):
    """Bright and unsaturated: notation paper, cream or white."""
    hi, lo = rgb.max(axis=-1), rgb.min(axis=-1)
    return (hi > 160) & ((hi - lo) < 0.3 * hi)


def runs(mask):
    """The longest run of True in a 1-D mask, as (start, end) inclusive-exclusive."""
    best, start = (0, 0), None
    for i, v in enumerate(list(mask) + [False]):
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start > best[1] - best[0]:
                best = (start, i)
            start = None
    return best


def panel_box(fr):
    """The rectangle that is paper in many frames: rows then columns by projection."""
    share = paper(fr).mean(axis=0)              # per pixel: how often it is paper
    steady = share > 0.25
    rows = runs(steady.mean(axis=1) > 0.35)
    cols = runs(steady[rows[0]:rows[1]].mean(axis=0) > 0.5)
    return rows, cols


def pages(video, out, fps=4.0, slices=3):
    w, h = probe(video)
    fr, small_h = frames(video, fps, w, h)
    (r0, r1), (c0, c1) = panel_box(fr)
    if r1 - r0 < 10 or c1 - c0 < 40:
        raise SystemExit('no notation panel found: nothing bright and steady covers enough of the frame')
    box = fr[:, r0:r1, c0:c1]
    shown = paper(box).mean(axis=(1, 2)) > 0.5
    gray = box.mean(axis=-1)
    change = np.r_[np.inf, np.abs(np.diff(gray, axis=0)).mean(axis=(1, 2))]
    # A page turn is a jump well above the frame-to-frame noise of a still page.
    quiet = np.median(change[1:][shown[1:] & shown[:-1]]) if shown.sum() > 2 else 1.0
    cut = change > max(6.0, 8 * quiet)
    found, start = [], None
    for i in range(len(fr) + 1):
        boundary = i == len(fr) or not shown[i] or cut[i]
        if boundary and start is not None:
            if (i - start) / fps >= 1.0:
                found.append((start / fps, i / fps))
            start = None
        if i < len(fr) and shown[i] and start is None:
            start = i
    scale = w / SMALL_W
    pad = 4  # small-frame pixels: the panel edge carries stems and markings the paper test can miss
    x, y = max(0, round((c0 - pad) * scale)), max(0, round((r0 - pad) * scale))
    cw, ch = min(w - x, round((c1 - c0 + 2 * pad) * scale)), min(h - y, round((r1 - r0 + 2 * pad) * scale))
    os.makedirs(os.path.join(out, 'screen'), exist_ok=True)
    listed = []
    for k, (t0, t1) in enumerate(found, 1):
        name = f'page-{k:02d}.png'
        path = os.path.join(out, 'screen', name)
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-ss', f'{(t0 + t1) / 2:.2f}', '-i', video, '-frames:v', '1',
                        '-vf', f'crop={cw}:{ch}:{x}:{y}', path], check=True)
        parts = []
        # Overlapping slices: each a third wider than its share, so no bar is only ever cut in two.
        step = cw / slices
        for s in range(slices):
            sx = max(0, round(s * step - step / 6))
            sw = min(cw - sx, round(step * 4 / 3))
            part = f'page-{k:02d}-s{s + 1}.png'
            subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', path, '-vf', f'crop={sw}:{ch}:{sx}:0',
                            os.path.join(out, 'screen', part)], check=True)
            parts.append(part)
        listed.append({'page': k, 'from': round(t0, 2), 'until': round(t1, 2), 'image': name, 'slices': parts})
        print(f'page {k:2d}: {t0:6.2f}–{t1:6.2f} s  {name}')
    shown_s = shown.sum() / fps
    print(f'panel {cw}×{ch} at ({x}, {y}) of {w}×{h}; on screen {shown_s:.0f} s of {len(fr) / fps:.0f} s; {len(found)} pages')
    with open(os.path.join(out, 'screen', 'pages.json'), 'w') as f:
        json.dump({'video': os.path.abspath(video), 'size': [w, h], 'panel': {'x': x, 'y': y, 'width': cw, 'height': ch},
                   'pages': listed}, f, indent=1)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('command', choices=['pages'])
    parser.add_argument('--video', required=True)
    parser.add_argument('--out', default='.')
    parser.add_argument('--fps', type=float, default=4.0)
    parser.add_argument('--slices', type=int, default=3)
    a = parser.parse_args()
    pages(a.video, a.out, a.fps, a.slices)


if __name__ == '__main__':
    main()

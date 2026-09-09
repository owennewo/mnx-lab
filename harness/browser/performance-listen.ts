// Static verification-page host: playback of the exact presented performance golden.
import '../../src/elements/Player.ts';
import type { Player } from '../../src/elements/Player.ts';
import { parsePerformance } from '../../src/audio/performance.ts';
import { chooseOrdinal } from '../../src/model/playback.ts';
import type { PlaybackUpdate } from '../../src/elements/mnxContext.ts';
const players: Player[] = [];
for (const section of document.querySelectorAll<HTMLElement>('section[data-listen]')) {
  const player = section.querySelector<Player>('mnx-player')!;
  player.performance = parsePerformance(section.querySelector('.performance-data')!.textContent!);
  player.document = JSON.parse(section.querySelector('.document-data')!.textContent!);
  player.documentId = section.id;
  players.push(player);
  let lastKey = '';
  let ordinal: number | null = null;
  const follow = section.querySelector<HTMLInputElement>('.listen-follow')!;
  player.addEventListener('playback-state-changed', (event) => {
    const detail = (event as CustomEvent<PlaybackUpdate>).detail;
    ordinal = detail.ordinal;
    if (player.snapshot?.state === 'playing')
      for (const other of players)
        if (other !== player && other.snapshot?.state === 'playing') other.pause();
    const keys = new Set(detail.highlight.map((w) => w.noteKey));
    for (const ink of section.querySelectorAll<SVGElement>('[data-source-id]'))
      ink.classList.toggle('playing', keys.has(ink.dataset.sourceId!));
    const ink = section.querySelector<SVGElement>('.playing');
    if (follow.checked && ink) {
      const box = ink.getBoundingClientRect();
      if (box.top < 0 || box.bottom > innerHeight) ink.scrollIntoView({ block: 'center' });
    }
  });
  section.addEventListener('click', (event) => {
    const ink = (event.target as Element).closest<SVGElement>('[data-source-id]');
    if (!ink) return;
    const key = ink.dataset.sourceId!,
      candidates = player
        .performance!.written.filter((w) => w.noteKey === key)
        .map((w) => w.ordinal);
    const target = chooseOrdinal(candidates, ordinal, {
      explicitSeek: true,
      cycle: lastKey === key,
    });
    lastKey = key;
    if (target !== null) player.seek(target);
  });
}
window.addEventListener(
  'pagehide',
  () => {
    for (const p of players) {
      p.stop();
      p.remove();
    }
  },
  { once: true },
);

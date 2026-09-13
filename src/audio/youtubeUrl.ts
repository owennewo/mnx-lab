/** No arbitrary iframe URLs: every accepted source becomes our own embed URL. */
export function youtubeVideoId(input: string): string {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Enter a YouTube video URL or video ID.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port ||
    !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'www.youtube-nocookie.com'].includes(url.hostname))
    throw new Error('Only YouTube video links are supported.');
  if (url.searchParams.has('list') || url.pathname.startsWith('/live')) throw new Error('Playlists and live links are not supported; choose a recorded video.');
  const parts = url.pathname.split('/').filter(Boolean);
  const id = url.hostname === 'youtu.be' && parts.length === 1 ? parts[0]
    : url.pathname === '/watch' ? url.searchParams.get('v')
    : parts.length === 2 && ['embed', 'shorts'].includes(parts[0]) ? parts[1] : null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('This link does not identify a supported YouTube video.');
  return id;
}

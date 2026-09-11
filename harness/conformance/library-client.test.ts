import { expect, it } from 'vitest';
import { LibraryClient, LibraryRequestError } from '../../src/storage/libraryClient.ts';
it('degrades to absent on static hosting, timeouts and unreachable routes', async () => {
  for (const fetcher of [async () => new Response('<html>static SPA</html>'), async () => new Response('', { status: 404 }), async () => { throw new Error('offline'); }]) {
    expect(await new LibraryClient(fetcher).available()).toBe(false);
  }
});
it('does not follow authentication redirects or store responses and encodes identifiers', async () => {
  const calls: {url:string; init:RequestInit|undefined}[] = [];
  const client = new LibraryClient(async (input, init) => {
    calls.push({url:String(input),init}); return new Response('',{status:302,headers:{Location:'https://team.cloudflareaccess.com'}});
  });
  await expect(client.mnx('id/other?owner=someone')).rejects.toMatchObject({status:401});
  expect(calls[0].url).toBe('/api/library/pieces/id%2Fother%3Fowner%3Dsomeone/mnx');
  expect(calls[0].init).toMatchObject({credentials:'same-origin',cache:'no-store',redirect:'manual'});
});
it('distinguishes expired identity from denied membership and unavailable conversion', async () => {
  for (const status of [401,403,409,503]) {
    const client = new LibraryClient(async () => new Response('',{status}));
    await expect(client.me()).rejects.toEqual(new LibraryRequestError(status));
  }
});

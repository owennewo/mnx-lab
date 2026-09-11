import type { R2Bucket } from '@cloudflare/workers-types';
import { LibraryError, type BlobInput } from './types.ts';

export async function describeBlob(prefix: 'renditions' | 'recordings', input: BlobInput) {
  const content = input.content.slice(0); // Caller mutation cannot change bytes after hashing.
  const digest = await crypto.subtle.digest('SHA-256', content);
  const sha256 = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
  if (input.sha256 !== undefined && input.sha256 !== sha256) throw new LibraryError('blob', 'SHA-256 mismatch');
  return { content, sha256, r2_key: `${prefix}/${sha256}`, bytes: content.byteLength };
}
export type PreparedBlob = Awaited<ReturnType<typeof describeBlob>>;

export async function storeBlob(bucket: R2Bucket, blob: PreparedBlob) {
  let head = await bucket.head(blob.r2_key);
  if (!head) {
    await bucket.put(blob.r2_key, blob.content, {
      onlyIf: { etagDoesNotMatch: '*' }, sha256: blob.sha256
    });
    head = await bucket.head(blob.r2_key);
  }
  if (!head || head.size !== blob.bytes) throw new LibraryError('blob', 'Stored blob size mismatch');
  // Check a reused object too: an externally corrupted hash key must not be trusted.
  const checksum = head.checksums.sha256;
  if (checksum) {
    const hex = [...new Uint8Array(checksum)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== blob.sha256) throw new LibraryError('blob', 'Stored blob checksum mismatch');
  } else {
    const object = await bucket.get(blob.r2_key);
    if (!object || object.size !== blob.bytes) throw new LibraryError('blob', 'Stored blob missing');
    await describeBlob(blob.r2_key.startsWith('renditions/') ? 'renditions' : 'recordings', {
      content: await object.arrayBuffer(), sha256: blob.sha256
    });
  }
}

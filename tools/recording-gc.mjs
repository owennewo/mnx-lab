#!/usr/bin/env node
// Offline operator maintenance. No runtime import, browser credential or automatic deletion.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
export async function recordingGc({ query, list, remove, apply = false, writersStopped = false, now = Date.now() }) {
  if (apply && !writersStopped) throw new Error('Stop and drain ALL library writers (including ingest), then pass --writers-stopped.');
  const cutoff = now - 86400000;
  const candidates = []; let cursor; const seen = new Set();
  do {
    const page = await list(cursor);
    if (!Array.isArray(page.result)) throw new Error('Invalid R2 listing.');
    for (const object of page.result) {
      if (!/^recordings\/[0-9a-f]{64}$/.test(object.key ?? '') || !(Date.parse(object.last_modified) < cutoff)) continue;
      const referenced = await query(`SELECT (SELECT count(*) FROM recordings WHERE r2_key=?) + (SELECT count(*) FROM recording_uploads WHERE sha256=? AND state='pending' AND expires_at>?) AS n`, [object.key, object.key.slice(11), new Date(now).toISOString()]);
      if (!referenced.length || typeof referenced[0].n !== 'number') throw new Error('Invalid reference count.');
      if (referenced[0].n) continue;
      candidates.push({ key: object.key, bytes: object.size });
      if (apply) await remove(object.key);
    }
    cursor = page.result_info?.is_truncated ? page.result_info.cursor : undefined;
    if (page.result_info?.is_truncated && (!cursor || seen.has(cursor))) throw new Error('Invalid R2 pagination.');
    if (cursor) seen.add(cursor);
  } while (cursor);
  // Completed receipts support lost-response retries for 24h. Expired pending
  // reservations no longer authorize uploads; deleting them cannot attach media.
  if (apply) await query('DELETE FROM recording_uploads WHERE expires_at < ?', [new Date(cutoff).toISOString()]);
  return candidates;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const flags = process.argv.slice(2); if (flags.some(f => !['--apply','--writers-stopped'].includes(f))) throw new Error('Usage: node tools/recording-gc.mjs [--apply --writers-stopped]');
    const token = process.env.CLOUDFLARE_API_TOKEN; if (!token) throw new Error('CLOUDFLARE_API_TOKEN with D1/R2 access is required.');
    const path = fileURLToPath(new URL('../wrangler.jsonc', import.meta.url));
    const { config, error } = ts.parseConfigFileTextToJson(path, fs.readFileSync(path,'utf8')); if (error) throw new Error('Invalid config.');
    const db=config.d1_databases.find(d=>d.binding==='LIBRARY_DB').database_id, bucket=config.r2_buckets.find(b=>b.binding==='LIBRARY_BUCKET').bucket_name;
    const api = async (path, method='GET', body) => {
      const r=await fetch(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(30000)});
      const result=await r.json(); if(!r.ok||!result.success)throw new Error(`Cloudflare ${method} failed (${r.status}); stopped without continuing.`); return result;
    };
    const query=async(sql,params)=>{const r=await api(`d1/database/${db}/query`,'POST',{sql,params});if(r.result?.[0]?.success!==true)throw new Error('D1 query failed.');return r.result[0].results;};
    const rows=await recordingGc({query,list:cursor=>api(`r2/buckets/${encodeURIComponent(bucket)}/objects?${new URLSearchParams({prefix:'recordings/',per_page:'100',...(cursor?{cursor}:{})})}`),remove:key=>api(`r2/buckets/${encodeURIComponent(bucket)}/objects/${encodeURIComponent(key)}`,'DELETE'),apply:flags.includes('--apply'),writersStopped:flags.includes('--writers-stopped')});
    console.log(JSON.stringify({mode:flags.includes('--apply')?'deleted':'dry-run',objects:rows},null,2));
  } catch(e) { console.error(e.message);process.exitCode=1; }
}

import * as alphaTab from '@coderline/alphatab';
import { scoreToMnx } from '../../converters/guitarpro-mnx/src/import/gp.ts';

interface GuitarProWorkerReply {
  ok: boolean;
  document?: ReturnType<typeof scoreToMnx>;
  warnings?: string[];
  error?: string;
}

globalThis.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  const warnings: string[] = [];
  let reply: GuitarProWorkerReply;
  try {
    const settings = new alphaTab.Settings();
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
      new Uint8Array(event.data),
      settings
    );
    reply = {
      ok: true,
      document: scoreToMnx(score, { onWarning: warning => warnings.push(warning) }),
      warnings
    };
  } catch (error) {
    reply = {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  globalThis.postMessage(reply);
};

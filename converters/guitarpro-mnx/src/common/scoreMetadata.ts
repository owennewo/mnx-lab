import { MnxLabCreator, MnxLabEncoding, MnxLabWork, MnxStructure } from './types.js';

/**
 * Guitar Pro score information ↔ `_x.mnxLab.work` (docs/mnx-extensions.md).
 *
 * Both Guitar Pro dialects state the same header, in the same order, under
 * different spellings: GPIF's `<Score>` children (`Title, SubTitle, Artist,
 * Album, Words, Music, WordsAndMusic, Copyright, Tabber, Instructions,
 * Notices`) and the GP3–5 binary preamble's eleven length-prefixed strings.
 * `GpScoreInfo` is that one header, so the mapping to MNX is written once and
 * both readers feed it.
 *
 * The interesting half is authorship. Guitar Pro splits it into up to three
 * fields where MNX carries a list of typed creators, so:
 *
 *   Music           → one `composer`
 *   Words           → one `lyricist`
 *   WordsAndMusic   → one `composer` AND one `lyricist` of the same name
 *
 * and export inverts it: a name credited as both collapses back into
 * `WordsAndMusic`. That is why the round trip is stated as semantic rather than
 * byte-for-byte — a file that redundantly names the same person in `Music` and
 * `Words` comes back using `WordsAndMusic`, which says the same thing.
 */

/** The Guitar Pro header, dialect-independent. Empty string = field absent. */
export interface GpScoreInfo {
  title: string;
  subtitle: string;
  artist: string;
  album: string;
  /** Lyricist. */
  words: string;
  /** Composer. GP5 added it; GP3/4 files have no such field. */
  music: string;
  /** One person credited with both. GPIF only. */
  wordsAndMusic: string;
  copyright: string;
  /** Who transcribed the tab ("Tabbed by"). */
  tabber: string;
  instructions: string;
  notices: string[];
}

export const EMPTY_SCORE_INFO: GpScoreInfo = {
  title: '',
  subtitle: '',
  artist: '',
  album: '',
  words: '',
  music: '',
  wordsAndMusic: '',
  copyright: '',
  tabber: '',
  instructions: '',
  notices: []
};

/** This converter's name, as stamped into `_x.mnxLab.encoding.software`. */
export const CONVERTER_NAME = 'guitarpro-mnx';

/** Kept in step with package.json by a test — the browser build cannot read it. */
export const CONVERTER_VERSION = '0.1.0';

/**
 * What wrote the MNX file in hand (w3c-cg/mnx#547).
 *
 * Stamped by whatever writes the document and never forwarded from a source
 * file: Guitar Pro's own `<Encoding>` describes the `.gp`, not the MNX derived
 * from it. So a round trip through any format replaces this block rather than
 * preserving it, which is why comparisons of a committed document against a
 * re-import exclude it.
 */
export function converterEncoding(date?: string): MnxLabEncoding {
  return {
    software: CONVERTER_NAME,
    version: CONVERTER_VERSION,
    ...(date ? { date } : {})
  };
}

function clean(value: string | undefined): string {
  return (value ?? '').trim();
}

/** Guitar Pro header → `work`, or undefined when the file states nothing. */
export function gpScoreInfoToWork(info: Partial<GpScoreInfo> | undefined): MnxLabWork | undefined {
  if (!info) return undefined;

  const creators: MnxLabCreator[] = [];
  const composer = clean(info.music);
  const lyricist = clean(info.words);
  const both = clean(info.wordsAndMusic);
  const transcriber = clean(info.tabber);
  if (composer) creators.push({ role: 'composer', name: composer });
  if (both) creators.push({ role: 'composer', name: both });
  if (lyricist) creators.push({ role: 'lyricist', name: lyricist });
  if (both) creators.push({ role: 'lyricist', name: both });
  if (transcriber) creators.push({ role: 'transcriber', name: transcriber });

  // `Notices` is a second free-text field MNX does not draft a home for; its
  // lines join `Instructions` after a blank line rather than being dropped.
  const noticeLines = (info.notices ?? []).map(clean).filter(line => line.length > 0);
  const instructions = clean(info.instructions);
  const notes = [instructions, noticeLines.join('\n')].filter(part => part.length > 0).join('\n\n');

  const work: MnxLabWork = {
    ...(clean(info.title) ? { title: clean(info.title) } : {}),
    ...(clean(info.subtitle) ? { subtitle: clean(info.subtitle) } : {}),
    ...(clean(info.artist) ? { artist: clean(info.artist) } : {}),
    ...(clean(info.album) ? { album: clean(info.album) } : {}),
    ...(creators.length > 0 ? { creators } : {}),
    ...(clean(info.copyright) ? { copyright: clean(info.copyright) } : {}),
    ...(notes ? { notes } : {})
  };
  return Object.keys(work).length > 0 ? work : undefined;
}

/** Roles Guitar Pro's header can carry. Anything else has nowhere to go. */
const GP_ROLES = new Set(['composer', 'lyricist', 'transcriber']);

/**
 * `work` → Guitar Pro header. `warn` is called for anything the format cannot
 * hold, so a lossy export says so rather than silently thinning the credits.
 */
export function workToGpScoreInfo(
  work: MnxLabWork | undefined,
  warn: (message: string) => void = () => {}
): GpScoreInfo {
  if (!work) return { ...EMPTY_SCORE_INFO };

  const named = (role: string): string[] => [
    ...new Set((work.creators ?? []).filter(c => c.role === role).map(c => c.name.trim()))
  ];
  const composers = named('composer');
  const lyricists = named('lyricist');
  const transcribers = named('transcriber');

  for (const creator of work.creators ?? []) {
    if (!GP_ROLES.has(creator.role)) {
      warn(
        `Guitar Pro has no field for a "${creator.role}" credit; "${creator.name}" is not written.`
      );
    }
  }

  // One name credited with both words and music is exactly what GP's third
  // authorship field is for; the rest join, since GP has one string per role.
  const both = composers.filter(name => lyricists.includes(name));
  const join = (names: string[]): string => {
    if (names.length > 1) {
      warn(`Guitar Pro holds one name per credit; joining ${names.length} into one field.`);
    }
    return names.join(', ');
  };

  if (work.source) {
    warn('Guitar Pro has no field for `work.source`; it is not written.');
  }

  return {
    title: work.title ?? '',
    subtitle: work.subtitle ?? '',
    artist: work.artist ?? '',
    album: work.album ?? '',
    words: join(lyricists.filter(name => !both.includes(name))),
    music: join(composers.filter(name => !both.includes(name))),
    wordsAndMusic: join(both),
    copyright: work.copyright ?? '',
    tabber: join(transcribers),
    instructions: work.notes ?? '',
    notices: []
  };
}

/** The document's `work`, or undefined. */
export function documentWork(mnx: MnxStructure | undefined): MnxLabWork | undefined {
  return mnx?._x?.mnxLab?.work;
}

/**
 * The root vendor dict for a freshly imported document: the source's `work`
 * plus our own `encoding` stamp. Omitted entirely when there is neither.
 */
export function rootExtension(
  work: MnxLabWork | undefined,
  encodingDate?: string
): MnxStructure['_x'] | undefined {
  const mnxLab = {
    ...(work ? { work } : {}),
    encoding: converterEncoding(encodingDate)
  };
  return { mnxLab };
}

import type { Document, Element } from './xml.js';
import { MnxLabCreator, MnxLabEncoding, MnxLabWork, MnxStructure } from './types.js';

/**
 * MusicXML score metadata ↔ `_x.mnxLab.work` (docs/mnx-extensions.md).
 *
 * MusicXML states the same facts in up to three places, and they do not mean
 * the same thing:
 *
 *   `<work>` / `<movement-title>`  the piece's identity
 *   `<identification>`            who made it, rights, provenance
 *   `<credit>`                    TEXT PRINTED ON THE PAGE, with a position
 *
 * Only the first two are metadata. `<credit>` is layout — a positioned,
 * styled string — so it is read only as a fallback for a document that prints
 * a title without declaring one (Finale and MuseScore both emit such files),
 * and written without any position so a consumer places it by its own rules.
 * Nothing in the model is shaped by it.
 *
 * `<encoding>` is deliberately NOT read. It describes the MusicXML file, not
 * the MNX derived from it; the importer stamps its own.
 */

/** This converter's name, as stamped into `_x.mnxLab.encoding.software`. */
export const CONVERTER_NAME = 'musicxml-mnx';

/** Kept in step with package.json by a test. */
export const CONVERTER_VERSION = '0.1.0';

/** Also written as `<software>`, so the two faces of the name stay together. */
export const SOFTWARE_LABEL = `${CONVERTER_NAME} ${CONVERTER_VERSION}`;

/**
 * MusicXML's `<creator type>` is open ("composer, lyricist and arranger are
 * typical"), and so is `work.creators[].role`, so roles pass through verbatim.
 * The one exception is `artist`: MusicXML has no performer concept, so the
 * round trip parks it in a creator of that type and lifts it back out.
 */
const ARTIST_TYPE = 'artist';

function text(parent: Element | null, tagName: string): string | null {
  if (!parent) return null;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).tagName === tagName) {
      const value = (node as Element).textContent?.trim();
      return value ? value : null;
    }
  }
  return null;
}

function elements(parent: Element | null, tagName: string): Element[] {
  const out: Element[] = [];
  if (!parent) return out;
  for (let i = 0; i < parent.childNodes.length; i++) {
    const node = parent.childNodes[i];
    if (node.nodeType === 1 && (node as Element).tagName === tagName) out.push(node as Element);
  }
  return out;
}

/** `<credit>` text by `credit-type`, joined when a credit has several words. */
function creditsByType(scoreEl: Element): Map<string, string[]> {
  const byType = new Map<string, string[]>();
  for (const credit of elements(scoreEl, 'credit')) {
    const words = elements(credit, 'credit-words')
      .map(el => el.textContent?.trim() ?? '')
      .filter(Boolean);
    if (words.length === 0) continue;
    // An untyped credit is filed under '' — usable only as a last-resort title.
    const type = text(credit, 'credit-type') ?? '';
    byType.set(type, [...(byType.get(type) ?? []), words.join(' ')]);
  }
  return byType;
}

/** MusicXML document → `work`, or undefined when it states no metadata. */
export function readWork(doc: Document): MnxLabWork | undefined {
  const scoreEl = doc.documentElement;
  if (!scoreEl) return undefined;

  const workEl = elements(scoreEl, 'work')[0] ?? null;
  const identificationEl = elements(scoreEl, 'identification')[0] ?? null;
  const credits = creditsByType(scoreEl);
  const credit = (type: string): string | undefined => credits.get(type)?.[0];

  const workTitle = text(workEl, 'work-title');
  const movementTitle = text(scoreEl, 'movement-title');

  // A document with no <work> may still print a title, either as a typed
  // credit, as <movement-title>, or as the only untyped credit on the page.
  const title = workTitle ?? credit('title') ?? movementTitle ?? credits.get('')?.[0];

  // <movement-title> is a subtitle only when it is not already the title.
  const subtitle = credit('subtitle') ?? (title !== movementTitle ? movementTitle : null);

  const creators: MnxLabCreator[] = [];
  let artist: string | undefined;
  for (const creator of elements(identificationEl, 'creator')) {
    const name = creator.textContent?.trim();
    if (!name) continue;
    const role = creator.getAttribute('type')?.trim() || 'composer';
    if (role === ARTIST_TYPE) artist = name;
    else creators.push({ role, name });
  }

  const misc = elements(identificationEl, 'miscellaneous')[0] ?? null;
  const miscField = (name: string): string | undefined => {
    for (const field of elements(misc, 'miscellaneous-field')) {
      if (field.getAttribute('name') === name) {
        const value = field.textContent?.trim();
        if (value) return value;
      }
    }
    return undefined;
  };

  const copyright = text(identificationEl, 'rights') ?? credit('rights');

  const work: MnxLabWork = {
    ...(title ? { title } : {}),
    ...(subtitle ? { subtitle } : {}),
    ...(artist ? { artist } : {}),
    ...(miscField('album') ? { album: miscField('album')! } : {}),
    ...(creators.length > 0 ? { creators } : {}),
    ...(copyright ? { copyright } : {}),
    ...(text(identificationEl, 'source') ? { source: text(identificationEl, 'source')! } : {}),
    ...(miscField('notes') ? { notes: miscField('notes')! } : {})
  };
  return Object.keys(work).length > 0 ? work : undefined;
}

/**
 * The root vendor dict for a freshly imported document: the source's `work`
 * plus our own `encoding` stamp (never the source's — see the header note).
 */
export function rootExtension(
  work: MnxLabWork | undefined,
  encodingDate?: string
): MnxStructure['_x'] {
  const encoding: MnxLabEncoding = {
    software: CONVERTER_NAME,
    version: CONVERTER_VERSION,
    ...(encodingDate ? { date: encodingDate } : {})
  };
  return { mnxLab: { ...(work ? { work } : {}), encoding } };
}

/** The document's `work`, or undefined. */
export function documentWork(mnx: MnxStructure | undefined): MnxLabWork | undefined {
  return mnx?._x?.mnxLab?.work;
}

/** Which creator roles get a printed credit block, and in what order. */
const CREDITED_ROLES = ['composer', 'lyricist', 'arranger'];

/**
 * Writes `<work>`, `<movement-title>`, `<identification>` and the `<credit>`
 * blocks into `scoreEl`, in the order the MusicXML 4.0 XSD requires (they must
 * precede `<part-list>`, which the caller appends next).
 *
 * `encodingDate` is stamped when given; the caller decides, because a date
 * makes derived output non-reproducible.
 */
export function writeMetadata(
  doc: Document,
  scoreEl: Element,
  mnx: MnxStructure,
  encodingDate?: string
): void {
  const work = documentWork(mnx);
  const append = (parent: Element, tagName: string, value: string): Element => {
    const el = doc.createElement(tagName);
    el.textContent = value;
    parent.appendChild(el);
    return el;
  };

  // 1. <work> — first child of <score-partwise> per the XSD.
  if (work?.title) {
    const workEl = doc.createElement('work');
    append(workEl, 'work-title', work.title);
    scoreEl.appendChild(workEl);
  }

  // 2. <identification>. Always present: it is where `<encoding>` lives, and
  //    every file this converter writes says what wrote it.
  const identificationEl = doc.createElement('identification');
  for (const role of CREDITED_ROLES) {
    for (const creator of work?.creators ?? []) {
      if (creator.role !== role) continue;
      append(identificationEl, 'creator', creator.name).setAttribute('type', role);
    }
  }
  // Roles MusicXML does not suggest are still legal — its `type` is open.
  for (const creator of work?.creators ?? []) {
    if (CREDITED_ROLES.includes(creator.role)) continue;
    append(identificationEl, 'creator', creator.name).setAttribute('type', creator.role);
  }
  if (work?.artist) {
    append(identificationEl, 'creator', work.artist).setAttribute('type', ARTIST_TYPE);
  }
  if (work?.copyright) append(identificationEl, 'rights', work.copyright);

  const encodingEl = doc.createElement('encoding');
  append(encodingEl, 'software', SOFTWARE_LABEL);
  if (encodingDate) append(encodingEl, 'encoding-date', encodingDate);
  identificationEl.appendChild(encodingEl);

  if (work?.source) append(identificationEl, 'source', work.source);

  // `album` and `notes` have no MusicXML element; <miscellaneous> is the
  // format's own answer for exactly this, and it survives its round trip.
  const miscellaneous = doc.createElement('miscellaneous');
  for (const [name, value] of [
    ['album', work?.album],
    ['notes', work?.notes]
  ] as const) {
    if (!value) continue;
    append(miscellaneous, 'miscellaneous-field', value).setAttribute('name', name);
  }
  if (miscellaneous.childNodes.length > 0) identificationEl.appendChild(miscellaneous);

  scoreEl.appendChild(identificationEl);

  // 3. <credit> — the printed page text. No position, no font: a consumer
  //    lays these out by its own defaults, which is the whole reason MNX keeps
  //    typography out of the document.
  const credits: [string, string | undefined][] = [
    ['title', work?.title],
    ['subtitle', work?.subtitle],
    ...CREDITED_ROLES.map(
      role =>
        [role, work?.creators?.find(creator => creator.role === role)?.name] as [
          string,
          string | undefined
        ]
    ),
    ['rights', work?.copyright]
  ];
  for (const [type, value] of credits) {
    if (!value) continue;
    const creditEl = doc.createElement('credit');
    append(creditEl, 'credit-type', type);
    append(creditEl, 'credit-words', value);
    scoreEl.appendChild(creditEl);
  }
}

// A clean-room XML reader and writer, sized to MusicXML.
//
// This replaces @xmldom/xmldom, which was the converter's ONLY runtime
// dependency (~124 kB). Two reasons it had to go, and bundle size is the
// weaker one:
//
//   - Node has no global DOMParser (checked on v22), so the "just use the
//     platform" adapter people reach for first yields an optional Node
//     dependency rather than none. A parser we own is the same in both.
//   - The cost was never really on the parse side. xmldom and a browser DOM
//     disagree about serialization — self-closing tags, entity escaping,
//     whitespace text nodes — so an adapter would have made the EXPORT output
//     depend on where it ran. Owning the writer is what fixes that.
//
// The surface is deliberately the eleven members the converter actually uses,
// not a DOM. Anything more would be a library nobody asked for; see
// roadmap/inprogress/core-musicxml-zero-dep.md.
//
// MusicXML's grammar is fixed and shallow, which is what makes this a file
// rather than a project: elements, attributes, text, comments, CDATA, and a
// DOCTYPE to skip. No namespaces (MusicXML uses none), and no entity
// declarations beyond the five predefined ones plus character references.

export const ELEMENT_NODE = 1;
export const TEXT_NODE = 3;
export const DOCUMENT_NODE = 9;

export interface XmlNode {
  nodeType: number;
  /** The DOM's own alias for a tag name; `#text` on a text node. */
  nodeName: string;
  textContent: string;
}

/** The five predefined entities, plus numeric character references. */
function decodeEntities(text: string): string {
  if (!text.includes('&')) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (whole, body: string) => {
    if (body.startsWith('#x')) return String.fromCodePoint(parseInt(body.slice(2), 16));
    if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    switch (body) {
      case 'amp':
        return '&';
      case 'lt':
        return '<';
      case 'gt':
        return '>';
      case 'quot':
        return '"';
      case 'apos':
        return "'";
      default:
        // An unknown entity is left verbatim rather than dropped: a converter
        // that silently eats `&mdash;` corrupts a lyric without saying so.
        return whole;
    }
  });
}

const escapeText = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const escapeAttribute = (text: string): string => escapeText(text).replace(/"/g, '&quot;');

export class XmlText implements XmlNode {
  readonly nodeType = TEXT_NODE;
  readonly nodeName = '#text';
  constructor(public data: string) {}
  get textContent(): string {
    return this.data;
  }
}

export class XmlElement implements XmlNode {
  readonly nodeType = ELEMENT_NODE;
  readonly childNodes: XmlNode[] = [];
  private readonly attributeMap = new Map<string, string>();

  constructor(public readonly tagName: string) {}

  /** DOM alias for `tagName`, which callers use interchangeably. */
  get nodeName(): string {
    return this.tagName;
  }

  appendChild<T extends XmlNode>(node: T): T {
    this.childNodes.push(node);
    return node;
  }

  setAttribute(name: string, value: string): void {
    this.attributeMap.set(name, String(value));
  }

  getAttribute(name: string): string | null {
    return this.attributeMap.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributeMap.has(name);
  }

  /** Attributes in insertion order — what makes serialization deterministic. */
  attributeEntries(): [string, string][] {
    return [...this.attributeMap.entries()];
  }

  get textContent(): string {
    let text = '';
    for (const child of this.childNodes) text += child.textContent;
    return text;
  }

  /** Assigning text REPLACES the children, as the DOM does. */
  set textContent(value: string) {
    this.childNodes.length = 0;
    const text = String(value);
    if (text !== '') this.childNodes.push(new XmlText(text));
  }

  /** Every descendant with this tag name, in document order. */
  getElementsByTagName(name: string): XmlElement[] {
    const found: XmlElement[] = [];
    const visit = (element: XmlElement): void => {
      for (const child of element.childNodes) {
        if (child.nodeType !== ELEMENT_NODE) continue;
        const el = child as XmlElement;
        if (el.tagName === name) found.push(el);
        visit(el);
      }
    };
    visit(this);
    return found;
  }
}

export class XmlDocument implements XmlNode {
  readonly nodeType = DOCUMENT_NODE;
  readonly nodeName = '#document';
  documentElement: XmlElement | null = null;
  /**
   * The `<?xml …?>` declaration verbatim, when the source had one.
   *
   * Kept and re-emitted rather than regenerated, because `converters/fixtures/`
   * holds committed derived `.xml` files: dropping it, or normalising its
   * spelling, would show every one of them as changed the next time anyone
   * re-derived them. It is the only part of the output that is not rebuilt from
   * the tree.
   */
  xmlDeclaration: string | null = null;

  createElement(tagName: string): XmlElement {
    return new XmlElement(tagName);
  }

  /** Includes the root itself, which a document-level lookup must. */
  getElementsByTagName(name: string): XmlElement[] {
    const root = this.documentElement;
    if (!root) return [];
    return [...(root.tagName === name ? [root] : []), ...root.getElementsByTagName(name)];
  }

  get textContent(): string {
    return this.documentElement?.textContent ?? '';
  }
}

/**
 * Parses an XML document.
 *
 * Whitespace between elements IS kept as text nodes, because the converter
 * walks `childNodes` and filters on `nodeType` — dropping it here would work
 * today and break the moment something reads mixed content.
 */
export function parseXML(source: string): XmlDocument {
  const doc = new XmlDocument();
  const stack: XmlElement[] = [];
  let index = 0;

  const fail = (message: string): never => {
    const line = source.slice(0, index).split('\n').length;
    throw new Error(`Invalid XML at line ${line}: ${message}`);
  };

  while (index < source.length) {
    const next = source.indexOf('<', index);
    if (next === -1) break;

    if (next > index && stack.length) {
      stack[stack.length - 1].appendChild(new XmlText(decodeEntities(source.slice(index, next))));
    }

    if (source.startsWith('<!--', next)) {
      const end = source.indexOf('-->', next);
      index = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith('<![CDATA[', next)) {
      const end = source.indexOf(']]>', next);
      if (end === -1) fail('unterminated CDATA');
      // CDATA is literal: no entity decoding.
      if (stack.length) stack[stack.length - 1].appendChild(new XmlText(source.slice(next + 9, end)));
      index = end + 3;
      continue;
    }
    if (source.startsWith('<?', next)) {
      const end = source.indexOf('?>', next);
      const whole = end === -1 ? source.slice(next) : source.slice(next, end + 2);
      if (doc.xmlDeclaration === null && /^<\?xml[\s?]/i.test(whole)) doc.xmlDeclaration = whole;
      index = end === -1 ? source.length : end + 2;
      continue;
    }
    if (source.startsWith('<!', next)) {
      // DOCTYPE, whose internal subset may contain `>` inside brackets.
      let cursor = next + 2;
      let depth = 0;
      while (cursor < source.length) {
        const char = source[cursor];
        if (char === '[') depth++;
        else if (char === ']') depth--;
        else if (char === '>' && depth <= 0) break;
        cursor++;
      }
      index = cursor + 1;
      continue;
    }

    if (source.startsWith('</', next)) {
      const end = source.indexOf('>', next);
      if (end === -1) fail('unterminated closing tag');
      const name = source.slice(next + 2, end).trim();
      const open = stack.pop();
      if (!open) fail(`closing tag </${name}> with nothing open`);
      else if (open.tagName !== name) fail(`</${name}> closes <${open.tagName}>`);
      index = end + 1;
      continue;
    }

    // An open tag: name, then attributes, then `>` or `/>`.
    const match = /^<([^\s/>]+)/.exec(source.slice(next));
    if (!match) fail('malformed tag');
    const element = new XmlElement(match![1]);
    let cursor = next + match![0].length;

    while (cursor < source.length) {
      while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
      if (source.startsWith('/>', cursor) || source[cursor] === '>') break;
      const attribute = /^([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/.exec(source.slice(cursor));
      if (!attribute) {
        // A valueless attribute is not XML, but advancing keeps a malformed
        // document from becoming an infinite loop.
        cursor++;
        continue;
      }
      element.setAttribute(attribute[1], decodeEntities(attribute[3] ?? attribute[4] ?? ''));
      cursor += attribute[0].length;
    }

    const selfClosing = source.startsWith('/>', cursor);
    index = cursor + (selfClosing ? 2 : 1);

    if (stack.length) stack[stack.length - 1].appendChild(element);
    else if (!doc.documentElement) doc.documentElement = element;
    if (!selfClosing) stack.push(element);
  }

  return doc;
}

/**
 * Serializes a node: one line, no indentation, `<tag/>` when it has no
 * children — which is what the previous DOM writer produced.
 *
 * Formatting is not cosmetic here. `converters/fixtures/*.xml` are committed
 * derived files, so a writer that indented differently would show the whole
 * corpus as changed the next time anyone re-derived them.
 */
export function serializeXML(node: XmlNode): string {
  if (node instanceof XmlDocument) {
    const body = node.documentElement ? serializeXML(node.documentElement) : '';
    return node.xmlDeclaration ? node.xmlDeclaration + body : body;
  }
  if (node instanceof XmlText) return escapeText(node.data);
  const element = node as XmlElement;
  let out = `<${element.tagName}`;
  for (const [name, value] of element.attributeEntries()) {
    out += ` ${name}="${escapeAttribute(value)}"`;
  }
  if (element.childNodes.length === 0) return `${out}/>`;
  out += '>';
  for (const child of element.childNodes) out += serializeXML(child);
  return `${out}</${element.tagName}>`;
}

// The converter's own names for these. They shadow the ambient DOM `Element`
// and `Document` inside the modules that import them, which is the point: the
// DOM lib is not in this package's `lib`, and only leaks in through a
// dependency's types. Binding to these makes the converter's XML layer the one
// the compiler checks against.
export type { XmlElement as Element, XmlDocument as Document };

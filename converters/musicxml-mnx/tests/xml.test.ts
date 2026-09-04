import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exportMusicXML } from '../src/index.js';
import { parseXML, serializeXML, ELEMENT_NODE } from '../src/common/xml.js';
import type { MnxStructure } from '../src/common/types.js';

/**
 * The clean-room XML layer that replaced @xmldom/xmldom.
 *
 * The load-bearing test is the last one: the writer must reproduce the
 * committed `.xml` fixtures byte for byte, because those are derived files. A
 * writer that merely produced *valid* XML would quietly rewrite the whole
 * corpus the next time anyone re-derived it.
 */
const FIXTURES = path.resolve(__dirname, '../../fixtures');

describe('parsing', () => {
  it('reads elements, attributes, text and self-closing tags', () => {
    const doc = parseXML('<a n="1"><b>text</b><c/></a>');
    const root = doc.documentElement!;
    expect(root.tagName).toBe('a');
    expect(root.getAttribute('n')).toBe('1');
    expect(root.getAttribute('missing')).toBeNull();
    expect(root.hasAttribute('n')).toBe(true);
    expect(root.getElementsByTagName('b')[0].textContent).toBe('text');
    expect(root.getElementsByTagName('c')).toHaveLength(1);
  });

  it('decodes the predefined entities and character references', () => {
    const doc = parseXML('<a t="x &amp; y">&lt;3 &#65;&#x42; &unknown;</a>');
    expect(doc.documentElement!.getAttribute('t')).toBe('x & y');
    expect(doc.documentElement!.textContent).toBe('<3 AB &unknown;');
  });

  it('keeps whitespace as text nodes, which nodeType filtering relies on', () => {
    const doc = parseXML('<a>\n  <b/>\n</a>');
    const root = doc.documentElement!;
    expect(root.childNodes.length).toBeGreaterThan(1);
    expect(root.childNodes.filter(n => n.nodeType === ELEMENT_NODE)).toHaveLength(1);
  });

  it('skips comments, CDATA markers, processing instructions and DOCTYPE', () => {
    const doc = parseXML(
      '<?xml version="1.0"?><!DOCTYPE a [<!ENTITY x "y">]><a><!-- note --><![CDATA[a<b]]></a>'
    );
    expect(doc.documentElement!.tagName).toBe('a');
    expect(doc.documentElement!.textContent).toBe('a<b');
  });

  it('refuses mismatched tags rather than guessing', () => {
    expect(() => parseXML('<a><b></a></b>')).toThrow(/closes/);
  });
});

describe('serializing', () => {
  it('escapes text and attributes, and self-closes empty elements', () => {
    const doc = parseXML('<r/>');
    const root = doc.documentElement!;
    const child = doc.createElement('c');
    child.setAttribute('q', 'a"b<c');
    child.textContent = 'x & y < z';
    root.appendChild(child);
    root.appendChild(doc.createElement('empty'));
    expect(serializeXML(root)).toBe(
      '<r><c q="a&quot;b&lt;c">x &amp; y &lt; z</c><empty/></r>'
    );
  });

  it('round-trips a document through parse and serialize unchanged', () => {
    const source = '<?xml version="1.0" encoding="UTF-8"?><a n="1"><b>t</b><c/></a>';
    expect(serializeXML(parseXML(source))).toBe(source);
  });

  it('replaces children when textContent is assigned, as the DOM does', () => {
    const doc = parseXML('<a><b/><c/></a>');
    const root = doc.documentElement!;
    root.textContent = 'only';
    expect(serializeXML(root)).toBe('<a>only</a>');
  });
});

describe('the committed fixtures', () => {
  it.each(['House-of-the-Rising-Sun', 'Vestapol', 'Sun-did-glide', 'Triplets-and-graces'])(
    'writes %s byte for byte as the previous serializer did',
    async name => {
      const mnx = JSON.parse(
        await fs.readFile(path.join(FIXTURES, `${name}.mnx.json`), 'utf-8')
      ) as MnxStructure;
      const committed = await fs.readFile(path.join(FIXTURES, `${name}.xml`), 'utf-8');
      // The encoding date is stamped at export time and is the one thing in the
      // output that is not derived from the document.
      const undated = (xml: string) =>
        xml.replace(/<encoding-date>[^<]*<\/encoding-date>/, '<encoding-date/>');
      // The committed files carry no trailing newline.
      expect(undated(exportMusicXML(mnx))).toBe(undated(committed));
    }
  );
});

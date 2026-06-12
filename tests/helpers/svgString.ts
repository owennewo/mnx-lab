// Runs the real SVG emitter (src/render/svg.ts) in Node by faking the tiny
// slice of DOM it touches, then serializes the result to a string. Using the
// real emitter means previews can't drift from what the browser renders.
import { renderSvg } from '../../src/render/svg.ts';
import type { Primitive } from '../../src/primitives.ts';

class FakeElement {
  name: string;
  attrs: [string, string][] = [];
  children: FakeElement[] = [];
  textContent = '';
  innerHTML = '';

  constructor(name: string) {
    this.name = name;
  }

  setAttribute(key: string, value: string) {
    this.attrs.push([key, String(value)]);
  }

  appendChild(child: FakeElement) {
    this.children.push(child);
    return child;
  }

  addEventListener() {
    // renderSvg only registers listeners when onSourceClick is passed; inert here.
  }

  serialize(): string {
    const attrs = this.attrs.map(([k, v]) => ` ${k}="${escapeXml(v)}"`).join('');
    // Text content and element children can coexist (e.g. a <text> node
    // carrying a <title> tooltip child).
    const body = escapeXml(this.textContent) + this.children.map(c => c.serialize()).join('');
    return `<${this.name}${attrs}>${body}</${this.name}>`;
  }
}

function escapeXml(s: string): string {
  return s.replace(/[&<>"]/g, ch =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;'
  );
}

export interface SvgStringOptions {
  primitives: readonly Primitive[];
  widthSp: number;
  heightSp: number;
  pxPerSp: number;
  viewBoxSp?: { x: number; y: number; w: number; h: number };
}

export function renderSvgToString(opts: SvgStringOptions): string {
  const g = globalThis as any;
  const hadDocument = 'document' in g;
  const savedDocument = g.document;
  g.document = { createElementNS: (_ns: string, name: string) => new FakeElement(name) };
  try {
    const container = new FakeElement('div');
    renderSvg({
      container: container as unknown as HTMLElement,
      primitives: opts.primitives,
      widthSp: opts.widthSp,
      heightSp: opts.heightSp,
      pxPerSp: opts.pxPerSp,
      viewBoxSp: opts.viewBoxSp
    });
    const svg = container.children[0];
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return svg.serialize();
  } finally {
    if (hadDocument) g.document = savedDocument;
    else delete g.document;
  }
}

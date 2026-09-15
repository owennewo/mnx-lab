import type { MnxStructure } from '../../../src/model/mnx.ts';
import { DocumentViewer } from '../../../src/elements/DocumentViewer.ts';
import { loadSmufl } from '../../../src/engine/smufl/smufl.ts';
import { readView, readDisplay, read, readNumber, UNROLLED_KEY, STAFF_SCALE_KEY, DENSITY_H_KEY, SPACING_MODE_KEY } from './scorePreferences.ts';

const PRINT_WIDTH_MM = 186;

/** A printable vector preview: the browser supplies its native Save as PDF. */
export function preparePdfView(title: string): Window {
  const preview = window.open('', '_blank');
  if (!preview) throw new Error('Allow pop-ups for Studio to open the PDF view.');
  preview.document.title = title;
  preview.document.body.textContent = 'Preparing PDF…';
  return preview;
}

export async function renderPdfView(preview: Window, mnx: MnxStructure, title: string): Promise<void> {
  const display = readDisplay();
  const viewer = new DocumentViewer();
  // Resolve the engraving in the print palette BEFORE copying computed SVG
  // styles. Making only the preview light leaves dark-theme ink baked in.
  viewer.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;display:block;color-scheme:light;--mnx-paper:#fff;--mnx-paper-ink:#111;--mnx-paper-line:#666;--font-family-sans:Archivo,sans-serif;--sans:Archivo,sans-serif;';
  viewer.view = readView();
  viewer.unrolled = read(UNROLLED_KEY) === 'true';
  viewer.zoom = readNumber(STAFF_SCALE_KEY);
  viewer.densityH = readNumber(DENSITY_H_KEY);
  viewer.spacingMode = read(SPACING_MODE_KEY) === 'natural' ? 'natural' : 'fill';
  viewer.lyrics = display.lyrics;
  viewer.timeSignatures = display.timeSignatures;
  viewer.clefs = display.clefs;
  viewer.scoreTitle = display.title;
  viewer.barNumbers = display.barNumbers;
  viewer.instrumentNames = display.instrumentNames;
  viewer.beams = display.beams;
  viewer.mnxDoc = { id: 'pdf-export', name: title, lastUpdated: Date.now(), mnxJson: mnx };
  try {
    await loadSmufl();
    await document.fonts.load('16px Bravura');
    await document.fonts.ready;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('The PDF score could not be rendered.')), 30_000);
      viewer.addEventListener('render-scale', () => { clearTimeout(timer); resolve(); }, { once: true });
      document.body.append(viewer);
    });
    if (preview.closed) throw new Error('The PDF view was closed.');
    const source = viewer.shadowRoot?.querySelector<SVGSVGElement>('#projection-container svg');
    if (!source) throw new Error('No score was rendered for PDF export.');
    const doc = preview.document;
    doc.body.replaceChildren();
    // Reuse the exact webfonts shipped with Studio. Resolve URLs before copying.
    for (const sheet of document.querySelectorAll('link[rel="stylesheet"], style')) {
      const copy = sheet.cloneNode(true) as HTMLElement;
      if (sheet instanceof HTMLLinkElement) copy.setAttribute('href', sheet.href);
      doc.head.append(copy);
    }
    // Keep the physical width used for pagination when Chrome changes margins.
    // Expanding an SVG also increases its height and can orphan the title.
    const style = doc.createElement('style');
    style.textContent = `
      @font-face { font-family: Bravura; src: url('${location.origin}/smufl/Bravura.woff2') format('woff2'); }
      @page { size: A4; margin: 12mm; }
      html { color-scheme: light; height: auto; }
      body { margin: 0; height: auto; overflow: auto; background: #eee; color: #111; font-family: Archivo, sans-serif; }
      header { padding: 16px; text-align: center; }
      button { font: inherit; padding: 8px 16px; cursor: pointer; }
      .page { box-sizing: border-box; width: ${PRINT_WIDTH_MM}mm; margin: 16px auto; padding: 0; background: white; break-after: page; }
      .page:last-child { break-after: auto; }
      h1 { font-size: 18px; text-align: center; margin: 0 0 16px; }
      svg { display: block; width: 100%; height: auto; color: #111; --font-family-sans: Archivo, sans-serif; }
      @media print { body { background: white; } header { display: none; } .page { margin: 0 auto; max-width: 100%; } }
    `;
    doc.head.append(style);
    const header = doc.createElement('header');
    const button = doc.createElement('button');
    button.textContent = 'Print / Save PDF';
    button.dataset.printPreview = '';
    button.disabled = true;
    header.append(button);
    const hint = doc.createElement('p');
    hint.textContent = `Staff: ${viewer.resolvedView() === 'tab' ? 'Tab' : viewer.resolvedView() === 'both' ? 'Staff + Tab' : 'Staff'}. Choose “Save as PDF” in the print dialog.`;
    header.append(hint); doc.body.append(header);

    // Copy computed ink styles out of shadow DOM; keep fonts as vector text.
    const svg = source.cloneNode(true) as SVGSVGElement;
    const originals = [source, ...source.querySelectorAll('*')];
    const copies = [svg, ...svg.querySelectorAll('*')];
    originals.forEach((element, index) => {
      const computed = getComputedStyle(element);
      for (const property of ['fill', 'stroke', 'stroke-width', 'font-family', 'font-size', 'font-weight', 'font-style', 'visibility', 'opacity']) {
        (copies[index] as SVGElement).style.setProperty(property, computed.getPropertyValue(property));
      }
    });
    const box = source.viewBox.baseVal;
    // Break in whitespace, never through ink. A tall indivisible band gets its
    // own fitted page, rather than clipping a staff at the paper edge.
    const bands = Array.from(source.querySelectorAll<SVGGraphicsElement>('path,line,rect,text,circle,ellipse,polygon,polyline'))
      .filter(node => getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none')
      .map(node => { const b = node.getBBox(); return [b.y - 2, b.y + b.height + 2]; })
      .sort((a, b) => a[0] - b[0]);
    const merged: number[][] = [];
    for (const band of bands) {
      const last = merged.at(-1);
      if (last && band[0] <= last[1]) last[1] = Math.max(last[1], band[1]);
      else merged.push([...band]);
    }
    const end = box.y + box.height;
    let y = box.y;
    let first = true;
    while (y < end) {
      const heading = first && display.title !== 'hide' ? viewer.shadowRoot?.querySelector('h1')?.textContent?.trim() : '';
      const capacity = box.width * (273 - (heading ? 14 : 0)) / PRINT_WIDTH_MM;
      let cut = Math.min(end, y + capacity);
      const crossing = merged.find(b => b[0] < cut && b[1] > cut);
      if (crossing) cut = crossing[0] > y + 1 ? crossing[0] : Math.min(end, crossing[1]);
      const page = doc.createElement('section'); page.className = 'page';
      if (heading) { const h1 = doc.createElement('h1'); h1.textContent = heading; page.append(h1); }
      const slice = svg.cloneNode(true) as SVGSVGElement;
      slice.setAttribute('viewBox', `${box.x} ${y} ${box.width} ${cut - y}`);
      slice.setAttribute('width', String(box.width)); slice.setAttribute('height', String(cut - y));
      if (cut - y > capacity) { slice.style.width = `${100 * capacity / (cut - y)}%`; slice.style.margin = 'auto'; }
      page.append(slice); doc.body.append(page);
      y = cut; first = false;
    }
    await Promise.all([doc.fonts.load('16px Bravura'), doc.fonts.load('16px Archivo')]);
    await doc.fonts.ready;
    // Own the handler in the preview, so a Studio reload cannot strand it.
    await new Promise<void>((resolve, reject) => {
      const script = doc.createElement('script');
      script.src = new URL('/studio/print-preview.js', location.href).href;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Could not load the PDF print control.'));
      doc.head.append(script);
    });
  } finally { viewer.remove(); }
}

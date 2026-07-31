import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

export function parseXML(xmlString: string): Document {
  return new DOMParser().parseFromString(xmlString, 'text/xml');
}

export function serializeXML(doc: Node): string {
  return new XMLSerializer().serializeToString(doc);
}

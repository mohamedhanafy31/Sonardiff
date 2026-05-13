import * as cheerio from 'cheerio';
import type { CheerioAPI, Cheerio } from 'cheerio';

export interface Fingerprint {
  tag: string;
  id: string | null;
  classes: string[];
  textPreview: string;
  parentTag: string | null;
  siblingCount: number;
  domPath: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioElem = Cheerio<any>;

export function extractFingerprint(elem: CheerioElem): Fingerprint {
  const node = elem.get(0) as any;
  if (!node) throw new Error('Empty element passed to extractFingerprint');

  const tag = (node.tagName ?? node.name ?? 'div').toLowerCase();
  const id: string | null = elem.attr('id') ?? null;
  const classAttr = elem.attr('class') ?? '';
  const classes = classAttr.split(/\s+/).filter(Boolean);
  const textPreview = elem.text().trim().slice(0, 100);
  const parent = elem.parent();
  const parentNode = parent.get(0) as any;
  const parentTag: string | null = parentNode ? (parentNode.tagName ?? parentNode.name ?? null)?.toLowerCase() ?? null : null;
  const siblingCount = parent.children().length;

  // Build a simple DOM path (up to 4 ancestors)
  const pathParts: string[] = [];
  let current: CheerioElem = elem;
  for (let i = 0; i < 4; i++) {
    const el = current.get(0) as any;
    if (!el) break;
    const elTag: string = (el.tagName ?? el.name ?? '').toLowerCase();
    if (elTag === 'body' || elTag === 'html' || !elTag) break;
    const elId: string | undefined = current.attr('id');
    const elClasses: string[] = (current.attr('class') ?? '').split(/\s+/).filter(Boolean);
    let part = elTag;
    if (elId) part += `#${elId}`;
    else if (elClasses.length > 0) part += `.${elClasses[0]}`;
    pathParts.unshift(part);
    current = current.parent() as CheerioElem;
  }
  const domPath = pathParts.join(' > ');

  return { tag, id, classes, textPreview, parentTag, siblingCount, domPath };
}

export function relocateElement($: CheerioAPI, fp: Fingerprint): CheerioElem {
  // 1. ID lookup
  if (fp.id) {
    const safeId = fp.id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
    const byId = $(`#${safeId}`);
    if (byId.length === 1) return byId;
  }

  // 2. Tag + all classes
  if (fp.classes.length > 0) {
    const safeClasses = fp.classes.map(c => c.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1'));
    const selector = `${fp.tag}.${safeClasses.join('.')}`;
    const byClass = $(selector);
    if (byClass.length === 1) return byClass;
  }

  // 3. domPath lookup
  if (fp.domPath) {
    try {
      const byPath = $(fp.domPath);
      if (byPath.length === 1) return byPath;
    } catch {
      // Invalid selector — skip
    }
  }

  // 4. Tag + text substring fuzzy match — only if exactly one candidate
  if (fp.textPreview) {
    const preview = fp.textPreview.toLowerCase();
    const candidates = $(fp.tag).filter((_i, el) => {
      return $(el).text().trim().toLowerCase().includes(preview);
    });
    if (candidates.length === 1) return candidates;
  }

  return $() as CheerioElem; // empty — not found
}

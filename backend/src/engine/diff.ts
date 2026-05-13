import * as diff from 'diff';
import type { Change } from 'diff';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../lib/config.js';

export interface DiffResult {
  diffPath: string;
  diffLines: Change[];
  diffHtml: string;
  changeSummary: string;
  changePercentage: number;
  delta: number;
  changed: boolean;
}

export function generateContentHash(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function applyExclusionRules(
  text: string,
  rules: { type: 'keyword' | 'regex'; value: string }[] | null
): string {
  if (!rules || rules.length === 0) return text;

  let cleaned = text;

  for (const rule of rules) {
    if (rule.type === 'keyword') {
      cleaned = cleaned
        .split('\n')
        .filter(line => !line.toLowerCase().includes(rule.value.toLowerCase()))
        .join('\n');
    } else if (rule.type === 'regex') {
      try {
        const regex = new RegExp(rule.value, 'gm');
        cleaned = cleaned.replace(regex, '');
      } catch (e) {
        console.warn('Invalid regex in exclusion rule:', rule.value);
      }
    }
  }

  return cleaned.trim();
}

export function renderDiffHtmlFragment(diffLines: Change[]): string {
  let html = `<table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 14px;">`;

  for (const part of diffLines) {
    if (!part.value.trim()) continue;

    let bgColor = 'transparent';
    let color = '#333';
    let prefix = '  ';

    if (part.added) {
      bgColor = '#e6ffed';
      color = '#22863a';
      prefix = '+ ';
    } else if (part.removed) {
      bgColor = '#ffeef0';
      color = '#cb2431';
      prefix = '- ';
    }

    const lines = part.value.split('\n');
    for (const line of lines) {
      if (line.trim() === '') continue;
      const safeLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `<tr><td style="padding: 4px 8px; background-color: ${bgColor}; color: ${color}; white-space: pre-wrap; word-break: break-all; border-bottom: 1px solid #f0f0f0;">${prefix}${safeLine}</td></tr>`;
    }
  }

  html += `</table>`;
  return html;
}

async function ensureDir(dirPath: string) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

export async function compareSnapshots(
  monitorId: string,
  oldText: string,
  newText: string,
  exclusionRules: any | null,
  threshold: number = 0
): Promise<DiffResult> {
  const diffsDir = path.join(config.dataDir, 'diffs');
  await ensureDir(diffsDir);

  let cleanOld = applyExclusionRules(oldText, exclusionRules);
  let cleanNew = applyExclusionRules(newText, exclusionRules);

  const diffLines = diff.diffLines(cleanOld, cleanNew);

  let addedLines = 0;
  let removedLines = 0;
  let totalLines = 0;

  for (const part of diffLines) {
    const lines = part.count || 0;
    if (part.added) addedLines += lines;
    else if (part.removed) removedLines += lines;
    else totalLines += lines;
  }

  const totalChanged = addedLines + removedLines;
  const baseTotal = totalLines + removedLines;
  const changePercentage = baseTotal > 0 ? (totalChanged / baseTotal) * 100 : (totalChanged > 0 ? 100 : 0);
  const delta = changePercentage / 100;
  const changed = delta > threshold;

  const diffHtml = renderDiffHtmlFragment(diffLines);

  const diffId = crypto.randomUUID();
  const diffPath = path.join(diffsDir, `${monitorId}_${diffId}.json`);
  await fs.writeFile(diffPath, JSON.stringify(diffLines), 'utf-8');

  const changeSummary = `+${addedLines} / -${removedLines} lines`;

  return {
    diffPath,
    diffLines,
    diffHtml,
    changeSummary,
    changePercentage: Math.round(changePercentage * 100) / 100,
    delta,
    changed,
  };
}

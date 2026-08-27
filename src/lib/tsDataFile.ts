// Generic read/write for the main site's src/data/*.ts structured-data
// files. Each file is: an `export interface X { ... }` block, then
// `export const name: X[] = [ ...records... ];`. We preserve everything
// up to and including the `= [` line verbatim (the interface, comments,
// imports) and regenerate only the array body from the parsed records —
// so hand-written grouping comments between records (e.g. "// 第一屆")
// don't survive a save made through the CMS. That's a deliberate
// trade-off: the live site's grouping is driven by the `generation`
// field, not by file layout, so losing the comment costs nothing
// functionally, and it's what makes round-tripping through a generic
// parser/serializer tractable at all.

import { parseObjectArray, type DataRecord } from './tsDataParser';

export interface LoadedDataFile {
  header: string; // everything through "...= [\n"
  records: DataRecord[];
}

const ARRAY_START = /^[\s\S]*?=\s*\[\s*\n/;

export function loadDataFile(raw: string): LoadedDataFile {
  const match = raw.match(ARRAY_START);
  const header = match ? match[0] : raw;
  return { header, records: parseObjectArray(raw) };
}

export interface FieldOrder {
  key: string;
  type: 'string' | 'number' | 'boolean';
}

function serializeValue(value: unknown, type: FieldOrder['type']): string {
  if (type === 'number') return String(Number(value ?? 0));
  if (type === 'boolean') return String(Boolean(value));
  const str = String(value ?? '');
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Regenerates the full file text from the preserved header + current records. */
export function serializeDataFile(
  header: string,
  records: DataRecord[],
  fields: FieldOrder[]
): string {
  const lines = records.map((record) => {
    const parts = fields
      .filter((f) => record[f.key] !== undefined)
      .map((f) => `${f.key}: ${serializeValue(record[f.key], f.type)}`);
    return `  { ${parts.join(', ')} },`;
  });
  return `${header}${lines.join('\n')}\n];\n`;
}

// Phase B reads src/data/*.ts directly from the repo (they're plain
// TypeScript array literals, one record per line — see how those files are
// written on the main site). This is a best-effort line parser, not a real
// TS parser: it only understands single-line `{ key: value, ... }` objects
// with string/number/boolean values. Good enough to preview; if the data
// files move to JSON/YAML data collections in Phase C, this goes away.

export type DataRecord = Record<string, string | number | boolean>;

export function parseObjectArray(raw: string): DataRecord[] {
  const records: DataRecord[] = [];
  const objectPattern = /\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = objectPattern.exec(raw))) {
    const body = match[1];
    const record: DataRecord = {};
    const pairPattern =
      /(\w+):\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|(-?\d+(?:\.\d+)?)|(true|false))/g;
    let pair: RegExpExecArray | null;
    let found = false;

    while ((pair = pairPattern.exec(body))) {
      found = true;
      const [, key, sq, dq, num, bool] = pair;
      if (sq !== undefined) record[key] = sq.replace(/\\'/g, "'");
      else if (dq !== undefined) record[key] = dq.replace(/\\"/g, '"');
      else if (num !== undefined) record[key] = Number(num);
      else if (bool !== undefined) record[key] = bool === 'true';
    }

    if (found) records.push(record);
  }

  return records;
}

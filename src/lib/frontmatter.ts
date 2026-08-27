// Minimal YAML-frontmatter parser — good enough for the flat key/value
// (plus one-level nested list) frontmatter our content collections use.
// Not a general YAML parser; if the schemas grow more complex, swap this
// for a real `yaml` package.

export interface ParsedMarkdown {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(raw: string): ParsedMarkdown {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const [, frontmatter, body] = match;
  const data: Record<string, unknown> = {};
  let currentListKey: string | null = null;

  for (const line of frontmatter.split(/\r?\n/)) {
    if (!line.trim()) continue;

    const listItemMatch = line.match(/^\s*-\s*(.*)$/);
    if (listItemMatch && currentListKey) {
      const arr = (data[currentListKey] as unknown[]) ?? [];
      arr.push(parseScalar(listItemMatch[1]));
      data[currentListKey] = arr;
      continue;
    }

    const kvMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kvMatch) {
      const [, key, rawValue] = kvMatch;
      if (rawValue === '') {
        currentListKey = key;
        data[key] = [];
      } else {
        currentListKey = null;
        data[key] = parseScalar(rawValue);
      }
    }
  }

  return { data, body: body.trim() };
}

/** Serializes a flat key/value object back into `---\nkey: value\n---\n` frontmatter. */
export function stringifyFrontmatter(data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([key, value]) => `${key}: ${stringifyScalar(value)}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

function stringifyScalar(value: unknown): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return quoteYamlString(String(value ?? ''));
}

/**
 * Double-quotes a string for a single line of this parser's frontmatter
 * (or a YAML list item). Exported so every call site building frontmatter
 * by hand — activities' extra fields included — goes through the same
 * escaping instead of re-deriving it.
 *
 * The parser above is line-based: a value containing a raw newline (e.g.
 * a stray Enter at the end of a textarea) produces a second physical line
 * it can't recognize as a continuation, corrupting the field on the next
 * read (this exact bug shipped once already). These fields are meant to
 * be one line of text, so embedded newlines/carriage returns are
 * collapsed rather than round-tripped.
 */
export function quoteYamlString(value: string): string {
  const singleLine = value.replace(/\r\n|\r|\n/g, ' ').trim();
  const escaped = singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim();
  if (/^".*"$/.test(trimmed)) return trimmed.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

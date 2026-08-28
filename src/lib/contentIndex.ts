import { listDir, fetchRaw } from './github';
import { parseFrontmatter } from './frontmatter';

export interface ContentItem {
  /** Filename without extension — matches the anchor id rendered on the
   *  public site (Astro's content-collection entry id for a one-file-per-
   *  record glob loader is just the filename minus its extension). */
  slug: string;
  title: string;
  order: number;
}

/** Lists every markdown record in a content-collection directory (news,
 *  activities) with just enough data for a link picker — title to display,
 *  order to sort by (matches the order items actually appear on the public
 *  page), and the slug to build a `#slug` deep link. */
export async function listContentItems(dir: string, token?: string): Promise<ContentItem[]> {
  const entries = await listDir(dir, token);
  const files = entries.filter((e) => e.name.endsWith('.md'));
  const items = await Promise.all(
    files.map(async (f) => {
      const raw = await fetchRaw(f.path, token);
      const { data } = parseFrontmatter(raw);
      return {
        slug: f.name.replace(/\.md$/, ''),
        title: String(data.title ?? f.name),
        order: Number(data.order ?? 0),
      };
    })
  );
  return items.sort((a, b) => a.order - b.order);
}

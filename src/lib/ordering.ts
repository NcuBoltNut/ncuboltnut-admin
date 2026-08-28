import { listDir, fetchRaw } from './github';
import { parseFrontmatter } from './frontmatter';

/**
 * Order value a brand-new item in a markdown content-collection directory
 * (news, activities — one file per record, order ascending = newest
 * first) should get so it sorts above every existing item, without
 * needing to touch any other file. One below the current lowest order in
 * use; empty directories start at 1.
 */
export async function nextTopOrder(dir: string, token?: string): Promise<number> {
  const entries = await listDir(dir, token);
  const files = entries.filter((e) => e.name.endsWith('.md'));
  if (files.length === 0) return 1;

  const orders = await Promise.all(
    files.map(async (f) => {
      const raw = await fetchRaw(f.path, token);
      const { data } = parseFrontmatter(raw);
      return Number(data.order ?? 0);
    })
  );
  return Math.min(...orders) - 1;
}

/** Same idea as {@link nextTopOrder}, but scoped to records sharing one
 *  `category` value within the directory — achievements keep `order`
 *  meaningful only within their own section (competition/robot/academic/
 *  milestone), not across the whole directory. */
export async function nextTopOrderInCategory(
  dir: string,
  category: string,
  token?: string
): Promise<number> {
  const entries = await listDir(dir, token);
  const files = entries.filter((e) => e.name.endsWith('.md'));
  if (files.length === 0) return 1;

  const orders = await Promise.all(
    files.map(async (f) => {
      const raw = await fetchRaw(f.path, token);
      const { data } = parseFrontmatter(raw);
      return data.category === category ? Number(data.order ?? 0) : null;
    })
  );
  const inCategory = orders.filter((o): o is number => o !== null);
  return inCategory.length === 0 ? 1 : Math.min(...inCategory) - 1;
}

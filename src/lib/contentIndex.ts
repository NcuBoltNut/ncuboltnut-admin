import { listDir, fetchRaw } from './github';
import { parseFrontmatter } from './frontmatter';
import { parseObjectArray } from './tsDataParser';

/** Shared with AchievementsView.vue/AchievementsEditView.vue/InternalLinkField.vue
 *  so the category label wording only needs to change in one place. */
export const ACHIEVEMENT_CATEGORY_LABELS: Record<string, string> = {
  competition: '競賽成績',
  robot: '競賽機器人',
  academic: '學術成就',
  milestone: '其他重要成果',
};

export interface ContentItem {
  /** Filename without extension — matches the anchor id rendered on the
   *  public site (Astro's content-collection entry id for a one-file-per-
   *  record glob loader is just the filename minus its extension). */
  slug: string;
  title: string;
  order: number;
  /** Present only for directories where records are grouped into
   *  sections (achievements: competition/robot/academic/milestone) —
   *  news/activities have no category, so this stays undefined there. */
  category?: string;
}

/** Lists every markdown record in a content-collection directory (news,
 *  activities, achievements) with just enough data for a link picker —
 *  title to display, order to sort by (matches the order items actually
 *  appear on the public page), and the slug to build a `#slug` deep link. */
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
        category: typeof data.category === 'string' ? data.category : undefined,
      };
    })
  );
  return items.sort((a, b) => {
    const catCompare = (a.category ?? '').localeCompare(b.category ?? '');
    return catCompare !== 0 ? catCompare : a.order - b.order;
  });
}

/** History isn't a content-collection directory — it's a single
 *  src/data/history.ts array, rendered inline on the /about page. Reads it
 *  the same way HistoryView.vue does, for the link picker's item list. */
export async function listHistoryItems(token?: string): Promise<ContentItem[]> {
  const raw = await fetchRaw('src/data/history.ts', token);
  const records = parseObjectArray(raw);
  return records
    .map((r) => ({
      slug: String(r.id ?? ''),
      title: String(r.title ?? ''),
      order: Number(r.order ?? 0),
    }))
    .filter((r) => r.slug)
    .sort((a, b) => a.order - b.order);
}

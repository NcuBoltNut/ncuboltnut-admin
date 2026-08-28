<script setup lang="ts">
import { ref, onMounted } from 'vue';
import draggable from 'vuedraggable';
import { listDir, fetchRaw, getFileSha, putFile, repoFileUrl } from '../lib/github';
import { parseFrontmatter, quoteYamlString } from '../lib/frontmatter';
import { ACHIEVEMENT_CATEGORY_LABELS } from '../lib/contentIndex';
import { useAuthStore } from '../stores/auth';

type Category = 'competition' | 'robot' | 'academic' | 'milestone';

const CATEGORY_LABELS = ACHIEVEMENT_CATEGORY_LABELS as Record<Category, string>;
const CATEGORY_ORDER: Category[] = ['competition', 'robot', 'academic', 'milestone'];

interface AchievementItem {
  category: Category;
  title: string;
  subtitle: string;
  date: string;
  rank: string;
  tags: string[];
  body: string;
  photo: string;
  photoStyle: string;
  order: number;
  path: string;
}

const auth = useAuthStore();
const DIR = 'src/content/achievements';
const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

const all = ref<AchievementItem[]>([]);
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');

// One reactive array per category, kept in sync with `all` so <draggable>
// in each section can reorder independently — same pattern MembersView
// uses per generation, since "order" only needs to be meaningful within
// one category's own section on the public page.
const groupLists = ref<Record<Category, AchievementItem[]>>({
  competition: [],
  robot: [],
  academic: [],
  milestone: [],
});

function rebuildGroupLists() {
  for (const cat of CATEGORY_ORDER) {
    groupLists.value[cat] = all.value
      .filter((item) => item.category === cat)
      .sort((a, b) => a.order - b.order);
  }
}

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const t = auth.token ?? undefined;
    const entries = await listDir(DIR, t);
    const files = entries.filter((e) => e.name.endsWith('.md'));
    const parsed = await Promise.all(
      files.map(async (entry) => {
        const raw = await fetchRaw(entry.path, t);
        const { data } = parseFrontmatter(raw);
        return {
          category: (data.category as Category) ?? 'competition',
          title: String(data.title ?? entry.name),
          subtitle: String(data.subtitle ?? ''),
          date: String(data.date ?? ''),
          rank: String(data.rank ?? ''),
          tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
          body: String(data.body ?? ''),
          photo: String(data.photo ?? ''),
          photoStyle: String(data.photoStyle ?? ''),
          order: Number(data.order ?? 0),
          path: entry.path,
        };
      })
    );
    all.value = parsed;
    rebuildGroupLists();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function buildFrontmatter(item: AchievementItem, order: number): string {
  const lines = [`category: ${quoteYamlString(item.category)}`, `title: ${quoteYamlString(item.title)}`];
  if (item.subtitle) lines.push(`subtitle: ${quoteYamlString(item.subtitle)}`);
  if (item.date) lines.push(`date: ${quoteYamlString(item.date)}`);
  if (item.rank) lines.push(`rank: ${quoteYamlString(item.rank)}`);
  if (item.tags.length) {
    lines.push('tags:');
    for (const t of item.tags) lines.push(`  - ${quoteYamlString(t)}`);
  }
  if (item.body) lines.push(`body: ${quoteYamlString(item.body)}`);
  if (item.photo) lines.push(`photo: ${quoteYamlString(item.photo)}`);
  if (item.photoStyle) lines.push(`photoStyle: ${quoteYamlString(item.photoStyle)}`);
  lines.push(`order: ${order}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

async function onReorderGroup(category: Category) {
  if (!auth.token) return;
  saving.value = true;
  saveError.value = '';
  try {
    const token = auth.token;
    const group = groupLists.value[category];
    const changed = group
      .map((item, i) => ({ item, newOrder: i + 1 }))
      .filter(({ item, newOrder }) => item.order !== newOrder);

    for (const { item, newOrder } of changed) {
      const content = buildFrontmatter(item, newOrder);
      const sha = await getFileSha(token, item.path);
      await putFile(token, item.path, content, `content: reorder achievement "${item.title}"`, sha);
      item.order = newOrder;
    }
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e);
    await load();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="header-row">
    <div>
      <h1 class="page-title">競賽成就</h1>
      <p class="page-subtitle">
        共 {{ all.length }} 筆，分四個分類各自排序{{
          auth.token ? '，拖曳可調整同分類內排序' : '（唯讀，登入後可編輯）'
        }}
        <span v-if="saving">· 儲存中…</span>
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/achievements/new" class="new-btn">+ 新增成就</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>
  <p v-if="saveError" class="error">排序儲存失敗：{{ saveError }}</p>

  <template v-else v-for="cat in CATEGORY_ORDER" :key="cat">
    <div v-if="groupLists[cat].length" class="card">
      <p class="card-title">{{ CATEGORY_LABELS[cat] }}</p>
      <draggable
        v-model="groupLists[cat]"
        item-key="path"
        :disabled="!auth.token || saving"
        handle=".drag-handle"
        @end="onReorderGroup(cat)"
      >
        <template #item="{ element: item }">
          <div class="row">
            <span v-if="auth.token" class="drag-handle" title="拖曳調整順序">⠿</span>
            <img
              v-if="item.photo"
              :src="RAW_BASE + item.photo"
              :alt="item.title"
              style="width: 72px; height: 54px; object-fit: cover; border-radius: 4px"
            />
            <div class="row-body">
              <p class="card-title">{{ item.title }}</p>
              <p v-if="item.subtitle || item.date || item.rank" class="meta">
                {{ [item.subtitle, item.date, item.rank].filter(Boolean).join(' · ') }}
              </p>
            </div>
            <div class="card-links">
              <a class="source-link" :href="repoFileUrl(item.path)" target="_blank" rel="noopener"
                >GitHub →</a
              >
              <RouterLink
                v-if="auth.token"
                :to="`/achievements/${item.path.split('/').pop()}`"
                class="edit-link"
                >編輯 →</RouterLink
              >
            </div>
          </div>
        </template>
      </draggable>
    </div>
  </template>
</template>

<style scoped>
.header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.new-btn {
  background: var(--orange);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 13px;
  padding: 8px 16px;
  border-radius: 4px;
  white-space: nowrap;
}
.card {
  margin-bottom: 20px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--line);
}
.row-body {
  flex: 1;
  min-width: 0;
}
.meta {
  font-size: 12px;
  color: var(--muted);
}
.card-links {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}
.edit-link {
  font-size: 12px;
  font-weight: 700;
}
.drag-handle {
  cursor: grab;
  color: var(--muted);
  font-size: 16px;
}
</style>

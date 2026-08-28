<script setup lang="ts">
import { ref, onMounted } from 'vue';
import draggable from 'vuedraggable';
import { listDir, fetchRaw, getFileSha, putFile, repoFileUrl } from '../lib/github';
import { parseFrontmatter, quoteYamlString } from '../lib/frontmatter';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const DIR = 'src/content/activities';

interface ActivityItem {
  title: string;
  dateLabel: string;
  photos: string[];
  summary: string;
  stats: { num: string; label: string }[];
  linkText: string;
  linkHref: string;
  order: number;
  path: string;
}

const items = ref<ActivityItem[]>([]);
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

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
        const stats = Array.isArray(data.stats)
          ? (data.stats as { num: string; label: string }[])
          : [];
        const photos = Array.isArray(data.photos)
          ? (data.photos as string[])
          : data.photo
            ? [String(data.photo)]
            : [];
        return {
          title: String(data.title ?? entry.name),
          dateLabel: String(data.dateLabel ?? ''),
          photos,
          summary: String(data.summary ?? ''),
          stats,
          linkText: String(data.linkText ?? ''),
          linkHref: String(data.linkHref ?? ''),
          order: Number(data.order ?? 0),
          path: entry.path,
        };
      })
    );
    items.value = parsed.sort((a, b) => a.order - b.order);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function statsLine(stats: { num: string; label: string }[]): string {
  return stats.map((s) => `${s.num} ${s.label}`).join(' · ');
}

function buildFrontmatter(item: ActivityItem, order: number): string {
  const lines = [
    `title: ${quoteYamlString(item.title)}`,
    `dateLabel: ${quoteYamlString(item.dateLabel)}`,
    'photos:',
    ...item.photos.map((p) => `  - ${quoteYamlString(p)}`),
    `summary: ${quoteYamlString(item.summary)}`,
  ];
  if (item.stats.length) {
    lines.push('stats:');
    for (const s of item.stats) {
      lines.push(`  - num: ${quoteYamlString(s.num)}`);
      lines.push(`    label: ${quoteYamlString(String(s.label))}`);
    }
  }
  if (item.linkText) lines.push(`linkText: ${quoteYamlString(item.linkText)}`);
  if (item.linkHref) lines.push(`linkHref: ${quoteYamlString(item.linkHref)}`);
  lines.push(`order: ${order}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

async function onReorder() {
  if (!auth.token) return;
  saving.value = true;
  saveError.value = '';
  try {
    const token = auth.token;
    const changed = items.value
      .map((item, i) => ({ item, newOrder: i + 1 }))
      .filter(({ item, newOrder }) => item.order !== newOrder);

    for (const { item, newOrder } of changed) {
      const content = buildFrontmatter(item, newOrder);
      const sha = await getFileSha(token, item.path);
      await putFile(token, item.path, content, `content: reorder activity "${item.title}"`, sha);
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
      <h1 class="page-title">活動成果</h1>
      <p class="page-subtitle">
        共 {{ items.length }} 個活動，依時間軸排列{{
          auth.token ? '，拖曳可調整順序' : '（唯讀，登入後可編輯）'
        }}
        <span v-if="saving">· 儲存中…</span>
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/activities/new" class="new-btn">+ 新增活動</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>
  <p v-if="saveError" class="error">排序儲存失敗：{{ saveError }}</p>

  <draggable
    v-model="items"
    item-key="path"
    :disabled="!auth.token || saving"
    handle=".drag-handle"
    @end="onReorder"
  >
    <template #item="{ element: item }">
      <div class="card">
        <div class="member-row">
          <span v-if="auth.token" class="drag-handle" title="拖曳調整順序">⠿</span>
          <img
            v-if="item.photos[0]"
            :src="RAW_BASE + item.photos[0]"
            :alt="item.title"
            style="width: 96px; height: 64px; object-fit: cover; border-radius: 4px"
          />
          <span v-if="item.photos.length > 1" class="photo-count">+{{ item.photos.length - 1 }}</span>
          <div>
            <div class="card-meta">
              <span>{{ item.dateLabel }}</span>
              <span class="tag">#{{ item.order }}</span>
            </div>
            <p class="card-title">{{ item.title }}</p>
          </div>
        </div>
        <p v-html="item.summary" style="margin-top: 10px"></p>
        <p v-if="item.stats.length" style="font-size: 12px; color: var(--muted)">
          {{ statsLine(item.stats) }}
        </p>
        <div class="card-links">
          <a class="source-link" :href="repoFileUrl(item.path)" target="_blank" rel="noopener"
            >在 GitHub 上檢視原始檔 →</a
          >
          <RouterLink
            v-if="auth.token"
            :to="`/activities/${item.path.split('/').pop()}`"
            class="edit-link"
            >編輯 →</RouterLink
          >
        </div>
      </div>
    </template>
  </draggable>
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
.card-links {
  display: flex;
  gap: 16px;
  margin-top: 6px;
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
.photo-count {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
}
</style>

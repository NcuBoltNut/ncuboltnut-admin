<script setup lang="ts">
import { ref, onMounted } from 'vue';
import draggable from 'vuedraggable';
import { listDir, fetchRaw, getFileSha, putFile, repoFileUrl } from '../lib/github';
import { parseFrontmatter, stringifyFrontmatter } from '../lib/frontmatter';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const DIR = 'src/content/news';

interface NewsItem {
  title: string;
  date: Date;
  summary: string;
  order: number;
  path: string;
}

const items = ref<NewsItem[]>([]);
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');

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
          title: String(data.title ?? entry.name),
          date: new Date(String(data.date ?? '')),
          summary: String(data.summary ?? ''),
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

async function onReorder() {
  if (!auth.token) return;
  saving.value = true;
  saveError.value = '';
  try {
    const token = auth.token;
    // One commit per file whose order actually changed, not the whole
    // list — most drags only move a couple of items past each other.
    const changed = items.value
      .map((item, i) => ({ item, newOrder: i + 1 }))
      .filter(({ item, newOrder }) => item.order !== newOrder);

    for (const { item, newOrder } of changed) {
      const content = stringifyFrontmatter({
        title: item.title,
        date: item.date,
        summary: item.summary,
        order: newOrder,
      });
      const sha = await getFileSha(token, item.path);
      await putFile(token, item.path, content, `content: reorder news "${item.title}"`, sha);
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
      <h1 class="page-title">最新動態</h1>
      <p class="page-subtitle">
        共 {{ items.length }} 則，依發布順序排列{{
          auth.token ? '，拖曳可調整順序' : '（唯讀，登入後可編輯）'
        }}
        <span v-if="saving">· 儲存中…</span>
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/news/new" class="new-btn">+ 新增動態</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>
  <p v-if="saveError" class="error">排序儲存失敗：{{ saveError }}</p>
  <p v-else-if="items.length === 0" class="empty">目前沒有任何動態。</p>

  <draggable
    v-model="items"
    item-key="path"
    :disabled="!auth.token || saving"
    handle=".drag-handle"
    @end="onReorder"
  >
    <template #item="{ element: item }">
      <div class="card">
        <div class="card-meta">
          <span v-if="auth.token" class="drag-handle" title="拖曳調整順序">⠿</span>
          <span>{{ item.date.toISOString().slice(0, 10) }}</span>
          <span class="tag">#{{ item.order }}</span>
        </div>
        <p class="card-title">{{ item.title }}</p>
        <p v-html="item.summary"></p>
        <div class="card-links">
          <a class="source-link" :href="repoFileUrl(item.path)" target="_blank" rel="noopener"
            >在 GitHub 上檢視原始檔 →</a
          >
          <RouterLink
            v-if="auth.token"
            :to="`/news/${item.path.split('/').pop()}`"
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
</style>

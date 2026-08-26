<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { listDir, fetchRaw, repoFileUrl } from '../lib/github';
import { parseFrontmatter } from '../lib/frontmatter';

interface NewsItem {
  title: string;
  date: string;
  summary: string;
  order: number;
  path: string;
}

const items = ref<NewsItem[]>([]);
const loading = ref(true);
const loadError = ref('');

onMounted(async () => {
  try {
    const dir = 'src/content/news';
    const entries = await listDir(dir);
    const files = entries.filter((e) => e.name.endsWith('.md'));
    const parsed = await Promise.all(
      files.map(async (entry) => {
        const raw = await fetchRaw(entry.path);
        const { data } = parseFrontmatter(raw);
        return {
          title: String(data.title ?? entry.name),
          date: String(data.date ?? ''),
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
});
</script>

<template>
  <h1 class="page-title">最新動態</h1>
  <p class="page-subtitle">共 {{ items.length }} 則，依發布順序排列（唯讀）</p>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>
  <p v-else-if="items.length === 0" class="empty">目前沒有任何動態。</p>

  <div v-for="item in items" :key="item.path" class="card">
    <div class="card-meta">
      <span>{{ item.date }}</span>
      <span class="tag">#{{ item.order }}</span>
    </div>
    <p class="card-title">{{ item.title }}</p>
    <p v-html="item.summary"></p>
    <a class="source-link" :href="repoFileUrl(item.path)" target="_blank" rel="noopener"
      >在 GitHub 上檢視原始檔 →</a
    >
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { listDir, fetchRaw, repoFileUrl } from '../lib/github';
import { parseFrontmatter } from '../lib/frontmatter';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

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
  <div class="header-row">
    <div>
      <h1 class="page-title">最新動態</h1>
      <p class="page-subtitle">
        共 {{ items.length }} 則，依發布順序排列{{ auth.token ? '' : '（唯讀，登入後可編輯）' }}
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/news/new" class="new-btn">+ 新增動態</RouterLink>
  </div>

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
    <div class="card-links">
      <a class="source-link" :href="repoFileUrl(item.path)" target="_blank" rel="noopener"
        >在 GitHub 上檢視原始檔 →</a
      >
      <RouterLink v-if="auth.token" :to="`/news/${item.path.split('/').pop()}`" class="edit-link"
        >編輯 →</RouterLink
      >
    </div>
  </div>
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
</style>

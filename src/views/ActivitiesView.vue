<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { listDir, fetchRaw, repoFileUrl } from '../lib/github';
import { parseFrontmatter } from '../lib/frontmatter';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

interface ActivityItem {
  title: string;
  dateLabel: string;
  photo: string;
  summary: string;
  stats: string[];
  order: number;
  path: string;
}

const items = ref<ActivityItem[]>([]);
const loading = ref(true);
const loadError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

onMounted(async () => {
  try {
    const entries = await listDir('src/content/activities');
    const files = entries.filter((e) => e.name.endsWith('.md'));
    const parsed = await Promise.all(
      files.map(async (entry) => {
        const raw = await fetchRaw(entry.path);
        const { data } = parseFrontmatter(raw);
        const stats = Array.isArray(data.stats)
          ? (data.stats as unknown[]).map((s) => String(s))
          : [];
        return {
          title: String(data.title ?? entry.name),
          dateLabel: String(data.dateLabel ?? ''),
          photo: String(data.photo ?? ''),
          summary: String(data.summary ?? ''),
          stats,
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
      <h1 class="page-title">活動成果</h1>
      <p class="page-subtitle">
        共 {{ items.length }} 個活動，依時間軸排列{{ auth.token ? '' : '（唯讀，登入後可編輯）' }}
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/activities/new" class="new-btn">+ 新增活動</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <div v-for="item in items" :key="item.path" class="card">
    <div class="member-row">
      <img
        v-if="item.photo"
        :src="RAW_BASE + item.photo"
        :alt="item.title"
        style="width: 96px; height: 64px; object-fit: cover; border-radius: 4px"
      />
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
      {{ item.stats.join(' · ') }}
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
</style>

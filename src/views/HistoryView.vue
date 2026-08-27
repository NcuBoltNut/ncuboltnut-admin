<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchRaw, repoFileUrl } from '../lib/github';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const items = ref<(DataRecord & { __index: number })[]>([]);
const loading = ref(true);
const loadError = ref('');

onMounted(async () => {
  try {
    const raw = await fetchRaw('src/data/history.ts');
    items.value = parseObjectArray(raw)
      .map((r, i): DataRecord & { __index: number } => ({ ...r, __index: i }))
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
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
      <h1 class="page-title">隊史</h1>
      <p class="page-subtitle">
        共 {{ items.length }} 則紀錄，依時間排列{{ auth.token ? '' : '（唯讀，登入後可編輯）' }}
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/history/new" class="new-btn">+ 新增紀錄</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <div v-for="item in items" :key="item.__index" class="card">
    <div class="card-meta">
      <span>{{ item.date }}</span>
      <span v-if="item.milestone" class="tag">里程碑</span>
    </div>
    <p class="card-title">{{ item.title }}</p>
    <p>{{ item.body }}</p>
    <RouterLink v-if="auth.token" :to="`/history/edit/${item.__index}`" class="edit-link"
      >編輯 →</RouterLink
    >
  </div>

  <a class="source-link" :href="repoFileUrl('src/data/history.ts')" target="_blank" rel="noopener"
    >在 GitHub 上檢視原始檔 →</a
  >
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
.edit-link {
  font-size: 12px;
  font-weight: 700;
  display: inline-block;
  margin-top: 6px;
}
</style>

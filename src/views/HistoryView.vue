<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchRaw, repoFileUrl } from '../lib/github';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';

const items = ref<DataRecord[]>([]);
const loading = ref(true);
const loadError = ref('');

onMounted(async () => {
  try {
    const raw = await fetchRaw('src/data/history.ts');
    items.value = parseObjectArray(raw).sort(
      (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)
    );
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <h1 class="page-title">隊史</h1>
  <p class="page-subtitle">共 {{ items.length }} 則紀錄，依時間排列（唯讀）</p>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <div v-for="(item, i) in items" :key="i" class="card">
    <div class="card-meta">
      <span>{{ item.date }}</span>
      <span v-if="item.milestone" class="tag">里程碑</span>
    </div>
    <p class="card-title">{{ item.title }}</p>
    <p>{{ item.body }}</p>
  </div>

  <a class="source-link" :href="repoFileUrl('src/data/history.ts')" target="_blank" rel="noopener"
    >在 GitHub 上檢視原始檔 →</a
  >
</template>

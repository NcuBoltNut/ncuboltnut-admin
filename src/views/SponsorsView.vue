<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchRaw, repoFileUrl } from '../lib/github';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';

const sponsors = ref<DataRecord[]>([]);
const loading = ref(true);
const loadError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

onMounted(async () => {
  try {
    const raw = await fetchRaw('src/data/sponsors.ts');
    sponsors.value = parseObjectArray(raw).sort(
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
  <h1 class="page-title">贊助商</h1>
  <p class="page-subtitle">共 {{ sponsors.length }} 個贊助商（唯讀）</p>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <div v-for="s in sponsors" :key="String(s.id)" class="card">
    <div class="member-row">
      <img :src="RAW_BASE + s.logo" :alt="String(s.name)" style="height: 40px; max-width: 120px; object-fit: contain" />
      <div>
        <p class="card-title">{{ s.name }}</p>
        <p class="card-meta">{{ s.nameEn }}</p>
      </div>
    </div>
    <p>{{ s.blurb }}</p>
  </div>

  <a class="source-link" :href="repoFileUrl('src/data/sponsors.ts')" target="_blank" rel="noopener"
    >在 GitHub 上檢視原始檔 →</a
  >
</template>

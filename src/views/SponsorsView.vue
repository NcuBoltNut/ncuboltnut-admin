<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { fetchRaw, repoFileUrl } from '../lib/github';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const sponsors = ref<(DataRecord & { __index: number })[]>([]);
const loading = ref(true);
const loadError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

onMounted(async () => {
  try {
    const raw = await fetchRaw('src/data/sponsors.ts', auth.token ?? undefined);
    sponsors.value = parseObjectArray(raw)
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
      <h1 class="page-title">贊助商</h1>
      <p class="page-subtitle">
        共 {{ sponsors.length }} 個贊助商{{ auth.token ? '' : '（唯讀，登入後可編輯）' }}
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/sponsors/new" class="new-btn">+ 新增贊助商</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <div v-for="s in sponsors" :key="s.__index" class="card">
    <div class="member-row">
      <img :src="RAW_BASE + s.logo" :alt="String(s.name)" style="height: 40px; max-width: 120px; object-fit: contain" />
      <div>
        <p class="card-title">{{ s.name }}</p>
        <p class="card-meta">{{ s.nameEn }}</p>
      </div>
    </div>
    <p>{{ s.blurb }}</p>
    <RouterLink v-if="auth.token" :to="`/sponsors/edit/${s.__index}`" class="edit-link"
      >編輯 →</RouterLink
    >
  </div>

  <a class="source-link" :href="repoFileUrl('src/data/sponsors.ts')" target="_blank" rel="noopener"
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

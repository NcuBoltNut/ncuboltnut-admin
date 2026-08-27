<script setup lang="ts">
import { ref, onMounted } from 'vue';
import draggable from 'vuedraggable';
import { fetchRaw, getFileSha, putFile, repoFileUrl } from '../lib/github';
import { loadDataFile, serializeDataFile } from '../lib/tsDataFile';
import { dataSchemas } from '../lib/dataSchemas';
import type { DataRecord } from '../lib/tsDataParser';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const PATH = 'src/data/history.ts';
const schema = dataSchemas.history;

const items = ref<DataRecord[]>([]);
let header = '';
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const raw = await fetchRaw(PATH, auth.token ?? undefined);
    const loaded = loadDataFile(raw);
    header = loaded.header;
    // Sorted by order, which — as long as every edit goes through this
    // page's reorder or the edit form — always matches file position, so
    // index-based edit links (history has no id field to key off) stay
    // correct.
    items.value = [...loaded.records].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
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
    const reordered = items.value.map((r, i) => ({ ...r, order: i + 1 }));
    const content = serializeDataFile(header, reordered, schema.fields);
    const sha = await getFileSha(auth.token, PATH);
    await putFile(auth.token, PATH, content, 'content: reorder history', sha);
    items.value = reordered;
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
      <h1 class="page-title">隊史</h1>
      <p class="page-subtitle">
        共 {{ items.length }} 則紀錄{{ auth.token ? '，拖曳可調整順序' : '（唯讀，登入後可編輯）' }}
        <span v-if="saving">· 儲存中…</span>
      </p>
    </div>
    <RouterLink v-if="auth.token" to="/history/new" class="new-btn">+ 新增紀錄</RouterLink>
  </div>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>
  <p v-if="saveError" class="error">排序儲存失敗：{{ saveError }}</p>

  <draggable
    v-model="items"
    item-key="title"
    :disabled="!auth.token || saving"
    handle=".drag-handle"
    @end="onReorder"
  >
    <template #item="{ element: item, index }">
      <div class="card">
        <div class="card-meta">
          <span v-if="auth.token" class="drag-handle" title="拖曳調整順序">⠿</span>
          <span>{{ item.date }}</span>
          <span v-if="item.milestone" class="tag">里程碑</span>
        </div>
        <p class="card-title">{{ item.title }}</p>
        <p>{{ item.body }}</p>
        <RouterLink v-if="auth.token" :to="`/history/edit/${index}`" class="edit-link"
          >編輯 →</RouterLink
        >
      </div>
    </template>
  </draggable>

  <a class="source-link" :href="repoFileUrl(PATH)" target="_blank" rel="noopener"
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
.drag-handle {
  cursor: grab;
  color: var(--muted);
  font-size: 16px;
}
</style>

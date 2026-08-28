<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRaw, getFileSha, putFile } from '../lib/github';
import { loadDataFile, serializeDataFile } from '../lib/tsDataFile';
import type { DataRecord } from '../lib/tsDataParser';
import { dataSchemas } from '../lib/dataSchemas';
import { useAuthStore } from '../stores/auth';
import ImageUploadField from '../components/ImageUploadField.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const typeKey = String(route.params.type);
const schema = dataSchemas[typeKey];
// Records with a real `id` field are looked up by that id, which stays
// correct no matter how the file's records get reordered (drag-to-reorder
// rewrites the whole file, changing every array position).
const usesIndex = schema.idField === 'order';
const keyParam = route.params.key === undefined ? null : String(route.params.key);
const isNew = keyParam === null;

function findRecordIndex(records: DataRecord[]): number {
  if (usesIndex) return Number(keyParam);
  return records.findIndex((r) => String(r[schema.idField]) === keyParam);
}

// Loosely typed on purpose: this form's shape is driven entirely by
// schema.fields at runtime (different fields per content type), so a
// precise type here would just fight the dynamic v-model bindings below
// without catching anything real.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const form = ref<Record<string, any>>({});
const loading = ref(true);
const saving = ref(false);
const deleting = ref(false);
const errorMsg = ref('');

const pageTitle = computed(() =>
  isNew ? `新增${schema.label}` : `編輯${schema.label}：${form.value[schema.titleField] ?? ''}`
);

onMounted(async () => {
  try {
    if (isNew) {
      for (const f of schema.fields) {
        form.value[f.key] = f.type === 'number' ? 0 : f.type === 'boolean' ? false : '';
      }
    } else {
      const raw = await fetchRaw(schema.path, auth.token ?? undefined);
      const { records } = loadDataFile(raw);
      const record = records[findRecordIndex(records)];
      if (!record) throw new Error('找不到這筆資料');
      form.value = { ...record };
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

async function save() {
  if (!auth.token) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    const raw = await fetchRaw(schema.path, auth.token ?? undefined);
    const { header, records } = loadDataFile(raw);
    const next = [...records];
    if (isNew) {
      next.push(form.value);
    } else {
      const idx = findRecordIndex(records);
      if (idx === -1) throw new Error('找不到這筆資料，可能已被刪除或修改');
      next[idx] = form.value;
    }
    const content = serializeDataFile(header, next, schema.fields);
    const sha = await getFileSha(auth.token, schema.path);
    await putFile(
      auth.token,
      schema.path,
      content,
      isNew
        ? `content: add ${schema.key} "${form.value[schema.titleField]}"`
        : `content: update ${schema.key} "${form.value[schema.titleField]}"`,
      sha
    );
    router.push(schema.listRoute);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!auth.token || isNew) return;
  if (!confirm(`確定要刪除「${form.value[schema.titleField]}」嗎？這會直接 commit 到 main。`)) return;
  deleting.value = true;
  errorMsg.value = '';
  try {
    const raw = await fetchRaw(schema.path, auth.token ?? undefined);
    const { header, records } = loadDataFile(raw);
    const idx = findRecordIndex(records);
    const next = records.filter((_, i) => i !== idx);
    const content = serializeDataFile(header, next, schema.fields);
    const sha = await getFileSha(auth.token, schema.path);
    await putFile(
      auth.token,
      schema.path,
      content,
      `content: remove ${schema.key} "${form.value[schema.titleField]}"`,
      sha
    );
    router.push(schema.listRoute);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <h1 class="page-title">{{ pageTitle }}</h1>
  <p class="page-subtitle">存檔會直接 commit 到 ncuboltnut.github.io 的 main 分支</p>

  <p v-if="!auth.token" class="error">請先登入才能編輯。</p>
  <template v-else>
    <p v-if="loading" class="loading">讀取中…</p>

    <form v-else class="card" @submit.prevent="save">
      <label v-for="f in schema.fields" :key="f.key" class="field">
        <span>{{ f.label }}<template v-if="f.help"> — {{ f.help }}</template></span>
        <ImageUploadField
          v-if="f.inputType === 'image'"
          v-model="form[f.key]"
        />
        <input
          v-else-if="f.inputType === 'checkbox'"
          v-model="form[f.key]"
          type="checkbox"
          style="width: auto"
        />
        <textarea
          v-else-if="f.inputType === 'textarea'"
          v-model="form[f.key]"
          rows="4"
        ></textarea>
        <input
          v-else-if="f.type === 'number'"
          v-model.number="form[f.key]"
          type="number"
        />
        <input v-else v-model="form[f.key]" type="text" />
      </label>

      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>

      <div class="actions">
        <button type="submit" class="save-btn" :disabled="saving">
          {{ saving ? '儲存中…' : '儲存' }}
        </button>
        <button
          v-if="!isNew"
          type="button"
          class="delete-btn"
          :disabled="deleting"
          @click="remove"
        >
          {{ deleting ? '刪除中…' : '刪除' }}
        </button>
        <RouterLink :to="schema.listRoute">取消</RouterLink>
      </div>
    </form>
  </template>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
  font-size: 13px;
  color: var(--muted);
}
.field input,
.field textarea {
  font-family: inherit;
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
}
.actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 8px;
}
.save-btn {
  background: var(--orange);
  color: #fff;
  border: none;
  padding: 10px 22px;
  border-radius: 4px;
  font-weight: 700;
  cursor: pointer;
}
.save-btn:disabled {
  opacity: 0.6;
}
.delete-btn {
  background: transparent;
  border: 1px solid #b3261e;
  color: #b3261e;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
}
</style>

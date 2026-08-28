<script setup lang="ts">
import { ref } from 'vue';
import draggable from 'vuedraggable';
import { getFileSha, putBinaryFile } from '../lib/github';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  modelValue: string[]; // repo-relative paths, e.g. /photos/activity-xxx.jpg
  /** Directory (relative to repo root, no leading/trailing slash) new uploads go into. */
  uploadDir?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();

const auth = useAuthStore();
const uploading = ref(false);
const uploadProgress = ref('');
const errorMsg = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'image'
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Uploaded one at a time (not Promise.all) so each PUT can fetch its own
// current SHA right before writing — parallel writes to the same directory
// would race on GitHub's per-file SHA check.
async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (files.length === 0 || !auth.token) return;

  uploading.value = true;
  errorMsg.value = '';
  const uploaded: string[] = [];
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      uploadProgress.value = `上傳中 ${i + 1}/${files.length}…`;
      const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
      const dir = props.uploadDir ?? 'photos';
      const targetPath = `public/${dir}/${slugify(file.name.replace(ext, ''))}-${Date.now()}-${i}${ext}`;
      const base64 = await readAsBase64(file);
      const sha = await getFileSha(auth.token, targetPath);
      await putBinaryFile(auth.token, targetPath, base64, `content: upload ${file.name}`, sha);
      uploaded.push(`/${dir}/${targetPath.split('/').pop()}`);
    }
    emit('update:modelValue', [...props.modelValue, ...uploaded]);
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : String(err);
  } finally {
    uploading.value = false;
    uploadProgress.value = '';
    if (fileInput.value) fileInput.value.value = '';
  }
}

function removeAt(index: number) {
  const next = props.modelValue.filter((_, i) => i !== index);
  emit('update:modelValue', next);
}

function onReorder(next: string[]) {
  emit('update:modelValue', next);
}

function keyOf(path: string) {
  return path;
}
</script>

<template>
  <div class="gallery-field">
    <draggable
      :model-value="modelValue"
      :item-key="keyOf"
      class="gallery-list"
      handle=".drag-handle"
      @update:model-value="onReorder"
    >
      <template #item="{ element: path, index }">
        <div class="gallery-cell">
          <span class="drag-handle" title="拖曳調整順序">⠿</span>
          <img :src="RAW_BASE + path" alt="" />
          <button type="button" class="remove-btn" title="移除這張照片" @click="removeAt(index)">✕</button>
        </div>
      </template>
    </draggable>

    <p v-if="modelValue.length === 0" class="empty">尚未上傳任何照片。</p>

    <div class="upload-row">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        :disabled="uploading"
        @change="onFileChange"
      />
      <span v-if="uploading" class="uploading">{{ uploadProgress }}</span>
    </div>
    <p v-if="errorMsg" class="upload-error">{{ errorMsg }}</p>
  </div>
</template>

<style scoped>
.gallery-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.gallery-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.gallery-cell {
  position: relative;
  width: 120px;
  height: 90px;
  border-radius: 4px;
  border: 1px solid var(--line);
  overflow: hidden;
}
.gallery-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.drag-handle {
  position: absolute;
  top: 2px;
  left: 2px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  padding: 0 4px;
  border-radius: 2px;
  cursor: grab;
}
.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  border: none;
  font-size: 12px;
  width: 18px;
  height: 18px;
  line-height: 18px;
  border-radius: 2px;
  cursor: pointer;
}
.remove-btn:hover {
  background: #b3261e;
}
.empty {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.upload-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.uploading {
  font-size: 12px;
  color: var(--muted);
}
.upload-error {
  font-size: 12px;
  color: #b3261e;
  margin: 0;
}
</style>

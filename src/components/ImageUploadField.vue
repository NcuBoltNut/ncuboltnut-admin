<script setup lang="ts">
import { ref, computed } from 'vue';
import { getFileSha, putBinaryFile } from '../lib/github';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  modelValue: string; // repo-relative path, e.g. /photos/member-xxx.jpg
  /** Directory (relative to repo root, no leading/trailing slash) new uploads go into. */
  uploadDir?: string;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const auth = useAuthStore();
const uploading = ref(false);
const errorMsg = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';
const previewSrc = computed(() => (props.modelValue ? RAW_BASE + props.modelValue : ''));

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
      // reader.result is "data:<mime>;base64,<data>" — strip the prefix.
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file || !auth.token) return;

  uploading.value = true;
  errorMsg.value = '';
  try {
    const ext = file.name.includes('.') ? file.name.slice(file.name.lastIndexOf('.')) : '';
    const dir = props.uploadDir ?? 'photos';
    const targetPath = `public/${dir}/${slugify(file.name.replace(ext, ''))}-${Date.now()}${ext}`;
    const base64 = await readAsBase64(file);
    const sha = await getFileSha(auth.token, targetPath);
    await putBinaryFile(auth.token, targetPath, base64, `content: upload ${file.name}`, sha);
    // Site paths are repo-relative to public/, so drop that prefix.
    emit('update:modelValue', `/${dir}/${targetPath.split('/').pop()}`);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    uploading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}
</script>

<template>
  <div class="image-field">
    <div v-if="previewSrc" class="preview">
      <img :src="previewSrc" alt="" />
    </div>
    <input
      :value="modelValue"
      type="text"
      placeholder="/photos/xxx.jpg"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <div class="upload-row">
      <input ref="fileInput" type="file" accept="image/*" :disabled="uploading" @change="onFileChange" />
      <span v-if="uploading" class="uploading">上傳中…</span>
    </div>
    <p v-if="errorMsg" class="upload-error">{{ errorMsg }}</p>
  </div>
</template>

<style scoped>
.image-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.preview img {
  max-width: 160px;
  max-height: 120px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--line);
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

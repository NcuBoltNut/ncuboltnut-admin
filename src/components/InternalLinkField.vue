<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { sitePages } from '../lib/sitePages';

const props = defineProps<{
  modelValue: string; // href, e.g. /achievements or a custom/external URL
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const CUSTOM = '__custom__';

const knownHrefs = new Set(sitePages.map((p) => p.href));
// Existing content may hold a custom/external URL, or nothing yet — only
// preselect a known page when the current value actually matches one.
const mode = ref(props.modelValue && !knownHrefs.has(props.modelValue) ? CUSTOM : props.modelValue || '');
const customValue = ref(mode.value === CUSTOM ? props.modelValue : '');

watch(
  () => props.modelValue,
  (v) => {
    if (v === (mode.value === CUSTOM ? customValue.value : mode.value)) return;
    mode.value = v && !knownHrefs.has(v) ? CUSTOM : v || '';
    customValue.value = mode.value === CUSTOM ? v : '';
  }
);

const showCustomInput = computed(() => mode.value === CUSTOM);

function onSelect(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  mode.value = value;
  emit('update:modelValue', value === CUSTOM ? customValue.value : value);
}

function onCustomInput(e: Event) {
  customValue.value = (e.target as HTMLInputElement).value;
  emit('update:modelValue', customValue.value);
}
</script>

<template>
  <div class="link-field">
    <select :value="mode" @change="onSelect">
      <option value="">（不連結）</option>
      <option v-for="p in sitePages" :key="p.href" :value="p.href">{{ p.label }}（{{ p.href }}）</option>
      <option :value="CUSTOM">自訂網址…</option>
    </select>
    <input
      v-if="showCustomInput"
      :value="customValue"
      type="text"
      placeholder="/some-path 或 https://example.com"
      @input="onCustomInput"
    />
  </div>
</template>

<style scoped>
.link-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.link-field select,
.link-field input {
  font-family: inherit;
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--ink);
}
</style>

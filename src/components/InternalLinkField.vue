<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { sitePages } from '../lib/sitePages';
import { listContentItems, type ContentItem } from '../lib/contentIndex';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  modelValue: string; // href, e.g. /achievements, /activities#some-slug, or a custom/external URL
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const auth = useAuthStore();

const CUSTOM = '__custom__';
const NO_ITEM = '';

/** Pages backed by a content-collection directory — picking one of these
 *  reveals a second dropdown to deep-link a specific item instead of just
 *  the page itself. */
const ITEM_SOURCES: Record<string, string> = {
  '/news': 'src/content/news',
  '/activities': 'src/content/activities',
};

const knownHrefs = new Set(sitePages.map((p) => p.href));

function splitHref(href: string): { page: string; item: string } {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) return { page: href, item: '' };
  return { page: href.slice(0, hashIndex), item: href.slice(hashIndex + 1) };
}

const initial = splitHref(props.modelValue);
const mode = ref(props.modelValue && !knownHrefs.has(initial.page) ? CUSTOM : initial.page || '');
const customValue = ref(mode.value === CUSTOM ? props.modelValue : '');
const itemSlug = ref(mode.value !== CUSTOM ? initial.item : '');

const items = ref<ContentItem[]>([]);
const itemsLoading = ref(false);
const itemsError = ref('');

const itemSourceDir = computed(() => ITEM_SOURCES[mode.value]);

async function loadItems() {
  const dir = itemSourceDir.value;
  if (!dir) return;
  itemsLoading.value = true;
  itemsError.value = '';
  try {
    items.value = await listContentItems(dir, auth.token ?? undefined);
  } catch (e) {
    itemsError.value = e instanceof Error ? e.message : String(e);
  } finally {
    itemsLoading.value = false;
  }
}

function emitCurrent() {
  const base = mode.value === CUSTOM ? customValue.value : mode.value;
  if (mode.value !== CUSTOM && itemSlug.value) {
    emit('update:modelValue', `${base}#${itemSlug.value}`);
  } else {
    emit('update:modelValue', base);
  }
}

watch(
  () => props.modelValue,
  (v) => {
    const current = mode.value === CUSTOM ? customValue.value : itemSlug.value ? `${mode.value}#${itemSlug.value}` : mode.value;
    if (v === current) return;
    const split = splitHref(v);
    mode.value = v && !knownHrefs.has(split.page) ? CUSTOM : split.page || '';
    customValue.value = mode.value === CUSTOM ? v : '';
    itemSlug.value = mode.value !== CUSTOM ? split.item : '';
  }
);

function onSelectPage(e: Event) {
  const value = (e.target as HTMLSelectElement).value;
  mode.value = value;
  itemSlug.value = '';
  if (ITEM_SOURCES[value]) loadItems();
  emitCurrent();
}

function onSelectItem(e: Event) {
  itemSlug.value = (e.target as HTMLSelectElement).value;
  emitCurrent();
}

function onCustomInput(e: Event) {
  customValue.value = (e.target as HTMLInputElement).value;
  emitCurrent();
}

// Editing an existing link that already targets a news/activities item —
// load the item list up front so the second dropdown can show its label
// immediately instead of appearing empty until re-selected.
if (itemSourceDir.value) loadItems();
</script>

<template>
  <div class="link-field">
    <select :value="mode" @change="onSelectPage">
      <option value="">（不連結）</option>
      <option v-for="p in sitePages" :key="p.href" :value="p.href">{{ p.label }}（{{ p.href }}）</option>
      <option :value="CUSTOM">自訂網址…</option>
    </select>

    <input
      v-if="mode === CUSTOM"
      :value="customValue"
      type="text"
      placeholder="/some-path 或 https://example.com"
      @input="onCustomInput"
    />

    <template v-if="itemSourceDir">
      <select :value="itemSlug" @change="onSelectItem" :disabled="itemsLoading">
        <option :value="NO_ITEM">（整個頁面，不指定特定項目）</option>
        <option v-for="item in items" :key="item.slug" :value="item.slug">{{ item.title }}</option>
      </select>
      <p v-if="itemsLoading" class="hint">載入項目中…</p>
      <p v-if="itemsError" class="hint error">{{ itemsError }}</p>
    </template>
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
.hint {
  font-size: 12px;
  color: var(--muted);
  margin: 0;
}
.hint.error {
  color: #b3261e;
}
</style>

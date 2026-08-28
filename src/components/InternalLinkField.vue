<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { sitePages } from '../lib/sitePages';
import {
  listContentItems,
  listHistoryItems,
  ACHIEVEMENT_CATEGORY_LABELS,
  type ContentItem,
} from '../lib/contentIndex';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  modelValue: string; // href, e.g. /achievements, /activities#some-slug, or a custom/external URL
}>();

const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const auth = useAuthStore();

const CUSTOM = '__custom__';
const NO_ITEM = '';

type ItemSource = { kind: 'collection'; dir: string } | { kind: 'history' };

/** Pages backed by content this admin manages item-by-item — picking one
 *  of these reveals a second dropdown to deep-link a specific item
 *  instead of just the page itself. `/about` doesn't have its own content
 *  collection, but the 隊史 timeline rendered on it (src/data/history.ts)
 *  is the one part of that page with stable per-item anchors. */
const ITEM_SOURCES: Record<string, ItemSource> = {
  '/news': { kind: 'collection', dir: 'src/content/news' },
  '/activities': { kind: 'collection', dir: 'src/content/activities' },
  '/achievements': { kind: 'collection', dir: 'src/content/achievements' },
  '/about': { kind: 'history' },
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

const itemSource = computed(() => ITEM_SOURCES[mode.value]);

// Grouped by category when items carry one (achievements) — otherwise a
// single unlabeled group, rendered as a flat list of <option>s.
const groupedItems = computed(() => {
  const groups = new Map<string, ContentItem[]>();
  for (const item of items.value) {
    const key = item.category ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }
  return Array.from(groups.entries()).map(([category, groupItems]) => ({
    label: ACHIEVEMENT_CATEGORY_LABELS[category] ?? '',
    items: groupItems,
  }));
});

async function loadItems() {
  const source = itemSource.value;
  if (!source) return;
  itemsLoading.value = true;
  itemsError.value = '';
  try {
    items.value =
      source.kind === 'history'
        ? await listHistoryItems(auth.token ?? undefined)
        : await listContentItems(source.dir, auth.token ?? undefined);
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

// Editing an existing link that already targets a specific item — load
// the item list up front so the second dropdown can show its label
// immediately instead of appearing empty until re-selected.
if (itemSource.value) loadItems();
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

    <template v-if="itemSource">
      <select :value="itemSlug" @change="onSelectItem" :disabled="itemsLoading">
        <option :value="NO_ITEM">（整個頁面，不指定特定項目）</option>
        <template v-for="group in groupedItems" :key="group.label || '_'">
          <optgroup v-if="group.label" :label="group.label">
            <option v-for="item in group.items" :key="item.slug" :value="item.slug">{{ item.title }}</option>
          </optgroup>
          <template v-else>
            <option v-for="item in group.items" :key="item.slug" :value="item.slug">{{ item.title }}</option>
          </template>
        </template>
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

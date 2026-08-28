<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRaw, getFileSha, putFile, deleteFile } from '../lib/github';
import { parseFrontmatter, quoteYamlString } from '../lib/frontmatter';
import { nextTopOrder } from '../lib/ordering';
import { useAuthStore } from '../stores/auth';
import ImageGalleryField from '../components/ImageGalleryField.vue';
import InternalLinkField from '../components/InternalLinkField.vue';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isNew = route.params.file === undefined;
const fileName = ref(String(route.params.file ?? ''));
const dir = 'src/content/activities';

const title = ref('');
const dateLabel = ref('');
const photos = ref<string[]>([]);
const summary = ref('');
const statsText = ref(''); // one "num|label" per line
const linkText = ref('');
const linkHref = ref('');
const order = ref(1);

const saving = ref(false);
const deleting = ref(false);
const loading = ref(!isNew);
const errorMsg = ref('');

const pageTitle = computed(() => (isNew ? '新增活動' : `編輯：${title.value || fileName.value}`));

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w一-鿿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

function parseStats(text: string): { num: string; label: string }[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [num, ...rest] = line.split('|');
      return { num: (num ?? '').trim(), label: rest.join('|').trim() };
    });
}

onMounted(async () => {
  if (isNew) {
    // New items sort at the top — see NewsEditView's comment on
    // nextTopOrder for why.
    try {
      order.value = await nextTopOrder(dir, auth.token ?? undefined);
    } catch {
      order.value = 1;
    }
    return;
  }

  try {
    const path = `${dir}/${fileName.value}`;
    const raw = await fetchRaw(path, auth.token ?? undefined);
    const { data } = parseFrontmatter(raw);
    title.value = String(data.title ?? '');
    dateLabel.value = String(data.dateLabel ?? '');
    // Older items may still carry the single `photo` field from before
    // the gallery/carousel upgrade — treat it as a one-photo gallery.
    photos.value = Array.isArray(data.photos)
      ? (data.photos as string[])
      : data.photo
        ? [String(data.photo)]
        : [];
    summary.value = String(data.summary ?? '');
    linkText.value = String(data.linkText ?? '');
    linkHref.value = String(data.linkHref ?? '');
    order.value = Number(data.order ?? 1);
    const stats = Array.isArray(data.stats) ? (data.stats as { num: string; label: string }[]) : [];
    statsText.value = stats.map((s) => `${s.num}|${s.label}`).join('\n');
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

function buildFrontmatter(): string {
  const lines = [
    `title: ${quoteYamlString(title.value)}`,
    `dateLabel: ${quoteYamlString(dateLabel.value)}`,
    'photos:',
    ...photos.value.map((p) => `  - ${quoteYamlString(p)}`),
    `summary: ${quoteYamlString(summary.value)}`,
  ];
  const stats = parseStats(statsText.value);
  if (stats.length) {
    lines.push('stats:');
    for (const s of stats) {
      lines.push(`  - num: ${quoteYamlString(s.num)}`);
      lines.push(`    label: ${quoteYamlString(s.label)}`);
    }
  }
  if (linkText.value) lines.push(`linkText: ${quoteYamlString(linkText.value)}`);
  if (linkHref.value) lines.push(`linkHref: ${quoteYamlString(linkHref.value)}`);
  lines.push(`order: ${order.value}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

async function save() {
  if (!auth.token) return;
  if (photos.value.length === 0) {
    errorMsg.value = '請至少上傳一張照片';
    return;
  }
  saving.value = true;
  errorMsg.value = '';
  try {
    const targetFile = isNew ? `${slugify(title.value)}.md` : fileName.value;
    const path = `${dir}/${targetFile}`;
    const content = buildFrontmatter();
    const sha = await getFileSha(auth.token, path);
    await putFile(
      auth.token,
      path,
      content,
      isNew
        ? `content: add activity "${title.value}"`
        : `content: update activity "${title.value}"`,
      sha
    );
    router.push('/activities');
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!auth.token) return;
  if (!confirm(`確定要刪除「${title.value}」嗎？這會直接 commit 到 main。`)) return;
  deleting.value = true;
  errorMsg.value = '';
  try {
    const path = `${dir}/${fileName.value}`;
    const sha = await getFileSha(auth.token, path);
    if (!sha) throw new Error('找不到這個檔案的 SHA，可能已經被刪除了');
    await deleteFile(auth.token, path, `content: remove activity "${title.value}"`, sha);
    router.push('/activities');
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
      <label class="field"><span>標題</span><input v-model="title" required /></label>
      <label class="field"
        ><span>日期標籤（例如 2026.03 · Tainan · NCKU）</span
        ><input v-model="dateLabel" required
      /></label>
      <label class="field">
        <span>照片（可上傳多張，拖曳可調整順序，會以輪播呈現）</span>
        <ImageGalleryField v-model="photos" />
      </label>
      <label class="field"
        ><span>內容摘要（可用簡單 HTML）</span
        ><textarea v-model="summary" rows="4" required></textarea
      ></label>
      <label class="field">
        <span>統計數字（選填，每行一組，格式：數字|說明，例如 95%|出席率）</span>
        <textarea v-model="statsText" rows="3" placeholder="95%|出席率&#10;4.7/5|滿意度"></textarea>
      </label>
      <label class="field"><span>延伸連結文字（選填）</span><input v-model="linkText" /></label>
      <label class="field">
        <span>延伸連結目的地（選填）</span>
        <InternalLinkField v-model="linkHref" />
      </label>
      <label class="field"
        ><span>排序（數字越小越前面）</span
        ><input v-model.number="order" type="number" min="1" required
      /></label>

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
          {{ deleting ? '刪除中…' : '刪除這個活動' }}
        </button>
        <RouterLink to="/activities">取消</RouterLink>
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

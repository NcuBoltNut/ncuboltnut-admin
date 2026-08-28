<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRaw, getFileSha, putFile, deleteFile } from '../lib/github';
import { parseFrontmatter, quoteYamlString } from '../lib/frontmatter';
import { nextTopOrderInCategory } from '../lib/ordering';
import { ACHIEVEMENT_CATEGORY_LABELS } from '../lib/contentIndex';
import { useAuthStore } from '../stores/auth';
import ImageUploadField from '../components/ImageUploadField.vue';

type Category = 'competition' | 'robot' | 'academic' | 'milestone';

const CATEGORY_LABELS = ACHIEVEMENT_CATEGORY_LABELS as Record<Category, string>;

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isNew = route.params.file === undefined;
const fileName = ref(String(route.params.file ?? ''));
const dir = 'src/content/achievements';

const category = ref<Category>('competition');
const title = ref('');
const subtitle = ref('');
const date = ref('');
const rank = ref('');
const tagsText = ref(''); // one tag per line
const body = ref('');
const photo = ref('');
const photoStyle = ref('');
const order = ref(1);

const saving = ref(false);
const deleting = ref(false);
const loading = ref(!isNew);
const errorMsg = ref('');

const pageTitle = computed(() => (isNew ? '新增成就' : `編輯：${title.value || fileName.value}`));

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w一-鿿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

function parseTags(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

async function loadDefaultOrder() {
  try {
    order.value = await nextTopOrderInCategory(dir, category.value, auth.token ?? undefined);
  } catch {
    order.value = 1;
  }
}

onMounted(async () => {
  if (isNew) {
    await loadDefaultOrder();
    return;
  }

  try {
    const path = `${dir}/${fileName.value}`;
    const raw = await fetchRaw(path, auth.token ?? undefined);
    const { data } = parseFrontmatter(raw);
    category.value = (data.category as Category) ?? 'competition';
    title.value = String(data.title ?? '');
    subtitle.value = String(data.subtitle ?? '');
    date.value = String(data.date ?? '');
    rank.value = String(data.rank ?? '');
    tagsText.value = Array.isArray(data.tags) ? (data.tags as string[]).join('\n') : '';
    body.value = String(data.body ?? '');
    photo.value = String(data.photo ?? '');
    photoStyle.value = String(data.photoStyle ?? '');
    order.value = Number(data.order ?? 1);
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});

// Switching category on a new (unsaved) record should re-anchor "order" to
// the top of the newly chosen section, not keep whatever the old section's
// top was.
watch(category, () => {
  if (isNew) loadDefaultOrder();
});

function buildFrontmatter(): string {
  const lines = [`category: ${quoteYamlString(category.value)}`, `title: ${quoteYamlString(title.value)}`];
  if (subtitle.value) lines.push(`subtitle: ${quoteYamlString(subtitle.value)}`);
  if (date.value) lines.push(`date: ${quoteYamlString(date.value)}`);
  if (rank.value) lines.push(`rank: ${quoteYamlString(rank.value)}`);
  const tags = parseTags(tagsText.value);
  if (tags.length) {
    lines.push('tags:');
    for (const t of tags) lines.push(`  - ${quoteYamlString(t)}`);
  }
  if (body.value) lines.push(`body: ${quoteYamlString(body.value)}`);
  if (photo.value) lines.push(`photo: ${quoteYamlString(photo.value)}`);
  if (photoStyle.value) lines.push(`photoStyle: ${quoteYamlString(photoStyle.value)}`);
  lines.push(`order: ${order.value}`);
  return `---\n${lines.join('\n')}\n---\n`;
}

async function save() {
  if (!auth.token) return;
  saving.value = true;
  errorMsg.value = '';
  try {
    const targetFile = isNew ? `${category.value}-${slugify(title.value)}.md` : fileName.value;
    const path = `${dir}/${targetFile}`;
    const content = buildFrontmatter();
    const sha = await getFileSha(auth.token, path);
    await putFile(
      auth.token,
      path,
      content,
      isNew ? `content: add achievement "${title.value}"` : `content: update achievement "${title.value}"`,
      sha
    );
    router.push('/achievements');
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
    await deleteFile(auth.token, path, `content: remove achievement "${title.value}"`, sha);
    router.push('/achievements');
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
      <label class="field">
        <span>分類</span>
        <select v-model="category" :disabled="!isNew">
          <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>

      <label class="field"><span>標題</span><input v-model="title" required /></label>

      <label v-if="category === 'competition' || category === 'robot'" class="field">
        <span>{{ category === 'competition' ? '賽事名稱' : '副標題' }}</span>
        <input v-model="subtitle" />
      </label>

      <label v-if="category === 'competition'" class="field">
        <span>日期（自由格式，例如 2026年3月28日）</span>
        <input v-model="date" />
      </label>

      <label v-if="category === 'academic'" class="field">
        <span>名次／獎項</span>
        <input v-model="rank" />
      </label>

      <label v-if="category === 'robot'" class="field">
        <span>標籤（選填，每行一個）</span>
        <textarea v-model="tagsText" rows="3" placeholder="自動任務型&#10;國研盃智慧機械競賽"></textarea>
      </label>

      <label class="field">
        <span>內容（選填，可用簡單 HTML，例如 &lt;strong&gt;）</span>
        <textarea v-model="body" rows="4"></textarea>
      </label>

      <label v-if="category === 'robot' || category === 'academic'" class="field">
        <span>照片（選填）</span>
        <ImageUploadField v-model="photo" />
      </label>

      <label v-if="(category === 'robot' || category === 'academic') && photo" class="field">
        <span>照片位置微調（選填，CSS object-position，例如 center 30%;）</span>
        <input v-model="photoStyle" placeholder="object-position:center 30%;" />
      </label>

      <label class="field"
        ><span>排序（數字越小越前面，僅在同分類內比較）</span
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
          {{ deleting ? '刪除中…' : '刪除這筆成就' }}
        </button>
        <RouterLink to="/achievements">取消</RouterLink>
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
.field textarea,
.field select {
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

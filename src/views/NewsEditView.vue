<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { fetchRaw, getFileSha, putFile, deleteFile, listDir } from '../lib/github';
import { parseFrontmatter, stringifyFrontmatter } from '../lib/frontmatter';
import { useAuthStore } from '../stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isNew = route.params.file === undefined;
const fileName = ref(String(route.params.file ?? ''));
const dir = 'src/content/news';

const title = ref('');
const date = ref('');
const summary = ref('');
const order = ref(1);

const saving = ref(false);
const deleting = ref(false);
const loading = ref(!isNew);
const errorMsg = ref('');
const currentSha = ref<string | null>(null);

const pageTitle = computed(() => (isNew ? '新增動態' : `編輯：${title.value || fileName.value}`));

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\w一-鿿]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item'
  );
}

onMounted(async () => {
  if (isNew) {
    // Default order = current max + 1, so new items sort last unless edited.
    try {
      const entries = await listDir(dir);
      order.value = entries.filter((e) => e.name.endsWith('.md')).length + 1;
    } catch {
      order.value = 1;
    }
    date.value = new Date().toISOString().slice(0, 10);
    return;
  }

  try {
    const path = `${dir}/${fileName.value}`;
    const [raw, sha] = await Promise.all([
      fetchRaw(path),
      auth.token ? getFileSha(auth.token, path) : Promise.resolve(null),
    ]);
    const { data } = parseFrontmatter(raw);
    title.value = String(data.title ?? '');
    date.value = String(data.date ?? '').slice(0, 10);
    summary.value = String(data.summary ?? '');
    order.value = Number(data.order ?? 1);
    currentSha.value = sha;
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
    const targetFile = isNew ? `${date.value}-${slugify(title.value)}.md` : fileName.value;
    const path = `${dir}/${targetFile}`;
    const frontmatter = stringifyFrontmatter({
      title: title.value,
      date: new Date(date.value),
      summary: summary.value,
      order: order.value,
    });
    const sha = isNew ? await getFileSha(auth.token, path) : currentSha.value;
    await putFile(
      auth.token,
      path,
      frontmatter,
      isNew ? `content: add news "${title.value}"` : `content: update news "${title.value}"`,
      sha
    );
    router.push('/news');
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e);
  } finally {
    saving.value = false;
  }
}

async function remove() {
  if (!auth.token || !currentSha.value) return;
  if (!confirm(`確定要刪除「${title.value}」嗎？這會直接 commit 到 main。`)) return;
  deleting.value = true;
  errorMsg.value = '';
  try {
    await deleteFile(
      auth.token,
      `${dir}/${fileName.value}`,
      `content: remove news "${title.value}"`,
      currentSha.value
    );
    router.push('/news');
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
        <span>標題</span>
        <input v-model="title" required />
      </label>
      <label class="field">
        <span>日期</span>
        <input v-model="date" type="date" required />
      </label>
      <label class="field">
        <span>內容摘要（可用簡單 HTML，例如 &lt;strong&gt;）</span>
        <textarea v-model="summary" rows="4" required></textarea>
      </label>
      <label class="field">
        <span>排序（數字越小越前面）</span>
        <input v-model.number="order" type="number" min="1" required />
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
          {{ deleting ? '刪除中…' : '刪除這則動態' }}
        </button>
        <RouterLink to="/news">取消</RouterLink>
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

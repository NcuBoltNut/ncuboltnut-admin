<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import draggable from 'vuedraggable';
import { fetchRaw, getFileSha, putFile, repoFileUrl } from '../lib/github';
import { loadDataFile, serializeDataFile } from '../lib/tsDataFile';
import { dataSchemas } from '../lib/dataSchemas';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const MEMBERS_PATH = 'src/data/members.ts';

const members = ref<DataRecord[]>([]);
const generations = ref<DataRecord[]>([]);
const advisors = ref<DataRecord[]>([]);
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const saveError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

// One reactive array per generation, kept in sync with `members` so
// <draggable> in each group can reorder independently, then we merge the
// group's new order back into the full members array on save.
const groupLists = ref<Record<string, DataRecord[]>>({});

function rebuildGroupLists() {
  const byGen: Record<string, DataRecord[]> = {};
  for (const gen of generations.value) {
    byGen[String(gen.id)] = members.value
      .filter((m) => m.generation === gen.id)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
  }
  groupLists.value = byGen;
}

const sortedGenerations = computed(() =>
  [...generations.value].sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
);

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const t = auth.token ?? undefined;
    const [membersRaw, generationsRaw, advisorsRaw] = await Promise.all([
      fetchRaw(MEMBERS_PATH, t),
      fetchRaw('src/data/generations.ts', t),
      fetchRaw('src/data/advisors.ts', t),
    ]);
    members.value = parseObjectArray(membersRaw);
    generations.value = parseObjectArray(generationsRaw);
    advisors.value = parseObjectArray(advisorsRaw);
    rebuildGroupLists();
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function onReorderGroup(genId: string) {
  if (!auth.token) return;
  saving.value = true;
  saveError.value = '';
  try {
    const reorderedGroup = groupLists.value[genId].map((m, i) => ({ ...m, order: i + 1 }));
    // Rebuild the full members array: keep every other generation's
    // members untouched, splice in this group's new order.
    const others = members.value.filter((m) => m.generation !== genId);
    const nextMembers = [...others, ...reorderedGroup];

    const raw = await fetchRaw(MEMBERS_PATH, auth.token);
    const { header } = loadDataFile(raw);
    const content = serializeDataFile(header, nextMembers, dataSchemas.members.fields);
    const sha = await getFileSha(auth.token, MEMBERS_PATH);
    await putFile(auth.token, MEMBERS_PATH, content, `content: reorder members in ${genId}`, sha);

    members.value = nextMembers;
    rebuildGroupLists();
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : String(e);
    await load();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <h1 class="page-title">成員</h1>
  <p class="page-subtitle">
    共 {{ members.length }} 位成員 + {{ advisors.length }} 位指導老師{{
      auth.token ? '，拖曳可調整同屆內排序' : '（唯讀，登入後可編輯）'
    }}
    <span v-if="saving">· 儲存中…</span>
  </p>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>
  <p v-if="saveError" class="error">排序儲存失敗：{{ saveError }}</p>

  <template v-if="!loading && !loadError">
    <div class="card">
      <div class="section-head-row">
        <p class="card-title">指導老師</p>
        <RouterLink v-if="auth.token" to="/advisors/new" class="new-btn">+ 新增</RouterLink>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>姓名</th>
            <th>職稱</th>
            <th>Email</th>
            <th v-if="auth.token"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in advisors" :key="String(a.id)">
            <td><img class="member-photo" :src="RAW_BASE + a.photo" :alt="String(a.name)" /></td>
            <td>{{ a.name }}</td>
            <td>{{ a.title }}</td>
            <td>{{ a.email }}</td>
            <td v-if="auth.token">
              <RouterLink :to="`/advisors/edit/${a.id}`" class="edit-link">編輯</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card">
      <div class="section-head-row">
        <p class="card-title">屆別</p>
        <RouterLink v-if="auth.token" to="/generations/new" class="new-btn">+ 新增屆別</RouterLink>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>名稱</th>
            <th>年級</th>
            <th v-if="auth.token"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in sortedGenerations" :key="String(g.id)">
            <td>{{ g.id }}</td>
            <td>{{ g.label }}</td>
            <td>{{ g.year }}</td>
            <td v-if="auth.token">
              <RouterLink :to="`/generations/edit/${g.id}`" class="edit-link">編輯</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-for="gen in sortedGenerations" :key="String(gen.id)" class="card">
      <div class="section-head-row">
        <p class="card-title">{{ gen.label }} · {{ gen.year }}</p>
        <RouterLink v-if="auth.token" to="/members/new" class="new-btn">+ 新增成員</RouterLink>
      </div>
      <table>
        <thead>
          <tr>
            <th v-if="auth.token"></th>
            <th></th>
            <th>姓名</th>
            <th>班級</th>
            <th>職位</th>
            <th v-if="auth.token"></th>
          </tr>
        </thead>
        <draggable
          v-model="groupLists[String(gen.id)]"
          tag="tbody"
          item-key="id"
          :disabled="!auth.token || saving"
          handle=".drag-handle"
          @end="onReorderGroup(String(gen.id))"
        >
          <template #item="{ element: m }">
            <tr>
              <td v-if="auth.token"><span class="drag-handle" title="拖曳調整順序">⠿</span></td>
              <td><img class="member-photo" :src="RAW_BASE + m.photo" :alt="String(m.name)" /></td>
              <td>{{ m.name }} <span v-if="m.isLeader" class="tag">隊長</span></td>
              <td>{{ m.class }}</td>
              <td>{{ m.role }}</td>
              <td v-if="auth.token">
                <RouterLink :to="`/members/edit/${m.id}`" class="edit-link">編輯</RouterLink>
              </td>
            </tr>
          </template>
        </draggable>
      </table>
    </div>

    <a class="source-link" :href="repoFileUrl(MEMBERS_PATH)" target="_blank" rel="noopener"
      >在 GitHub 上檢視原始檔 →</a
    >
  </template>
</template>

<style scoped>
.section-head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.new-btn {
  background: var(--orange);
  color: #fff;
  text-decoration: none;
  font-weight: 700;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 4px;
  white-space: nowrap;
}
.edit-link {
  font-size: 12px;
  font-weight: 700;
}
.drag-handle {
  cursor: grab;
  color: var(--muted);
  font-size: 16px;
}
</style>

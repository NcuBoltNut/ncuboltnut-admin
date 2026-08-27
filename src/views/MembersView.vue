<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchRaw, repoFileUrl } from '../lib/github';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();

// Keep each record's position in its source file as __index, so edit links
// point at the same index DataRecordEditView will load/replace — the
// sorted/grouped views below must never be used for indexing.
const members = ref<(DataRecord & { __index: number })[]>([]);
const generations = ref<(DataRecord & { __index: number })[]>([]);
const advisors = ref<(DataRecord & { __index: number })[]>([]);
const loading = ref(true);
const loadError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

function withIndex(records: DataRecord[]) {
  return records.map((r, i) => ({ ...r, __index: i }));
}

const groups = computed(() => {
  const gens = [...generations.value].sort(
    (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)
  );
  return gens.map((gen) => ({
    gen,
    members: members.value
      .filter((m) => m.generation === gen.id)
      .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0)),
  }));
});

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [membersRaw, generationsRaw, advisorsRaw] = await Promise.all([
      fetchRaw('src/data/members.ts'),
      fetchRaw('src/data/generations.ts'),
      fetchRaw('src/data/advisors.ts'),
    ]);
    members.value = withIndex(parseObjectArray(membersRaw));
    generations.value = withIndex(parseObjectArray(generationsRaw));
    advisors.value = withIndex(parseObjectArray(advisorsRaw));
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <h1 class="page-title">成員</h1>
  <p class="page-subtitle">
    共 {{ members.length }} 位成員 + {{ advisors.length }} 位指導老師{{
      auth.token ? '' : '（唯讀，登入後可編輯）'
    }}
  </p>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <template v-else>
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
          <tr v-for="a in advisors" :key="a.__index">
            <td><img class="member-photo" :src="RAW_BASE + a.photo" :alt="String(a.name)" /></td>
            <td>{{ a.name }}</td>
            <td>{{ a.title }}</td>
            <td>{{ a.email }}</td>
            <td v-if="auth.token">
              <RouterLink :to="`/advisors/edit/${a.__index}`" class="edit-link">編輯</RouterLink>
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
          <tr v-for="g in generations" :key="g.__index">
            <td>{{ g.id }}</td>
            <td>{{ g.label }}</td>
            <td>{{ g.year }}</td>
            <td v-if="auth.token">
              <RouterLink :to="`/generations/edit/${g.__index}`" class="edit-link">編輯</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-for="group in groups" :key="String(group.gen.id)" class="card">
      <div class="section-head-row">
        <p class="card-title">{{ group.gen.label }} · {{ group.gen.year }}</p>
        <RouterLink v-if="auth.token" to="/members/new" class="new-btn">+ 新增成員</RouterLink>
      </div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>姓名</th>
            <th>班級</th>
            <th>職位</th>
            <th v-if="auth.token"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in group.members" :key="m.__index">
            <td><img class="member-photo" :src="RAW_BASE + m.photo" :alt="String(m.name)" /></td>
            <td>{{ m.name }} <span v-if="m.isLeader" class="tag">隊長</span></td>
            <td>{{ m.class }}</td>
            <td>{{ m.role }}</td>
            <td v-if="auth.token">
              <RouterLink :to="`/members/edit/${m.__index}`" class="edit-link">編輯</RouterLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <a class="source-link" :href="repoFileUrl('src/data/members.ts')" target="_blank" rel="noopener"
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
</style>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { fetchRaw, repoFileUrl } from '../lib/github';
import { parseObjectArray, type DataRecord } from '../lib/tsDataParser';

const members = ref<DataRecord[]>([]);
const generations = ref<DataRecord[]>([]);
const advisors = ref<DataRecord[]>([]);
const loading = ref(true);
const loadError = ref('');

const RAW_BASE = 'https://raw.githubusercontent.com/NcuBoltNut/ncuboltnut.github.io/main';

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

onMounted(async () => {
  try {
    const [membersRaw, generationsRaw, advisorsRaw] = await Promise.all([
      fetchRaw('src/data/members.ts'),
      fetchRaw('src/data/generations.ts'),
      fetchRaw('src/data/advisors.ts'),
    ]);
    members.value = parseObjectArray(membersRaw);
    generations.value = parseObjectArray(generationsRaw);
    advisors.value = parseObjectArray(advisorsRaw);
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <h1 class="page-title">成員</h1>
  <p class="page-subtitle">共 {{ members.length }} 位成員 + {{ advisors.length }} 位指導老師（唯讀）</p>

  <p v-if="loading" class="loading">讀取中…</p>
  <p v-else-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <template v-else>
    <div class="card">
      <p class="card-title">指導老師</p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>姓名</th>
            <th>職稱</th>
            <th>Email</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="a in advisors" :key="String(a.id)">
            <td><img class="member-photo" :src="RAW_BASE + a.photo" :alt="String(a.name)" /></td>
            <td>{{ a.name }}</td>
            <td>{{ a.title }}</td>
            <td>{{ a.email }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-for="group in groups" :key="String(group.gen.id)" class="card">
      <p class="card-title">{{ group.gen.label }} · {{ group.gen.year }}</p>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>姓名</th>
            <th>班級</th>
            <th>職位</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in group.members" :key="String(m.id)">
            <td><img class="member-photo" :src="RAW_BASE + m.photo" :alt="String(m.name)" /></td>
            <td>{{ m.name }} <span v-if="m.isLeader" class="tag">隊長</span></td>
            <td>{{ m.class }}</td>
            <td>{{ m.role }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <a class="source-link" :href="repoFileUrl('src/data/members.ts')" target="_blank" rel="noopener"
      >在 GitHub 上檢視原始檔 →</a
    >
  </template>
</template>

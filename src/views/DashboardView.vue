<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { listDir, fetchRaw } from '../lib/github';

const newsCount = ref<number | null>(null);
const activitiesCount = ref<number | null>(null);
const membersCount = ref<number | null>(null);
const sponsorsCount = ref<number | null>(null);
const historyCount = ref<number | null>(null);
const loadError = ref('');

function countRecords(raw: string): number {
  return (raw.match(/\{\s*id:/g) ?? []).length;
}

onMounted(async () => {
  try {
    const [news, activities, membersRaw, sponsorsRaw, historyRaw] = await Promise.all([
      listDir('src/content/news'),
      listDir('src/content/activities'),
      fetchRaw('src/data/members.ts'),
      fetchRaw('src/data/sponsors.ts'),
      fetchRaw('src/data/history.ts'),
    ]);
    newsCount.value = news.filter((e) => e.name.endsWith('.md')).length;
    activitiesCount.value = activities.filter((e) => e.name.endsWith('.md')).length;
    membersCount.value = countRecords(membersRaw);
    sponsorsCount.value = countRecords(sponsorsRaw);
    historyCount.value = (historyRaw.match(/\{ date:/g) ?? []).length;
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
});
</script>

<template>
  <h1 class="page-title">總覽</h1>
  <p class="page-subtitle">
    唯讀後台(Phase B)— 直接讀取
    <a href="https://github.com/NcuBoltNut/ncuboltnut.github.io" target="_blank" rel="noopener"
      >ncuboltnut.github.io</a
    >
    的公開內容。目前還不能編輯，存檔功能要等 Phase C 接上 GitHub 登入才會開放。
  </p>

  <p v-if="loadError" class="error">讀取失敗：{{ loadError }}</p>

  <div class="grid">
    <RouterLink to="/news" class="stat-card">
      <div class="stat-num">{{ newsCount ?? '…' }}</div>
      <div class="stat-label">則最新動態</div>
    </RouterLink>
    <RouterLink to="/activities" class="stat-card">
      <div class="stat-num">{{ activitiesCount ?? '…' }}</div>
      <div class="stat-label">個活動成果</div>
    </RouterLink>
    <RouterLink to="/members" class="stat-card">
      <div class="stat-num">{{ membersCount ?? '…' }}</div>
      <div class="stat-label">位成員</div>
    </RouterLink>
    <RouterLink to="/sponsors" class="stat-card">
      <div class="stat-num">{{ sponsorsCount ?? '…' }}</div>
      <div class="stat-label">個贊助商</div>
    </RouterLink>
    <RouterLink to="/history" class="stat-card">
      <div class="stat-num">{{ historyCount ?? '…' }}</div>
      <div class="stat-label">則隊史紀錄</div>
    </RouterLink>
  </div>
</template>

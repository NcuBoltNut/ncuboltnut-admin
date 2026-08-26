<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="layout">
    <aside class="sidebar">
      <div class="sidebar-brand">Bolt<span>Nut</span> CMS</div>
      <nav>
        <RouterLink to="/">總覽</RouterLink>
        <RouterLink to="/news">最新動態</RouterLink>
        <RouterLink to="/activities">活動成果</RouterLink>
        <RouterLink to="/members">成員</RouterLink>
        <RouterLink to="/sponsors">贊助商</RouterLink>
        <RouterLink to="/history">隊史</RouterLink>
      </nav>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

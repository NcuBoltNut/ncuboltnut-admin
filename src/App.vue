<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
import { useAuthStore } from './stores/auth';

const auth = useAuthStore();
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
      <div class="sidebar-auth">
        <template v-if="auth.user">
          <img :src="auth.user.avatar_url" class="avatar" :alt="auth.user.login" />
          <span class="who">{{ auth.user.name ?? auth.user.login }}</span>
          <button class="logout-btn" @click="auth.logout()">登出</button>
        </template>
        <template v-else>
          <button class="login-btn" :disabled="auth.loading" @click="auth.login()">
            {{ auth.loading ? '登入中…' : '用 GitHub 登入' }}
          </button>
          <p v-if="auth.error" class="auth-error">{{ auth.error }}</p>
        </template>
      </div>
    </aside>
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.sidebar-auth {
  margin-top: auto;
  padding: 16px 24px 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}
.who {
  font-size: 13px;
  color: #fff;
}
.login-btn,
.logout-btn {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--orange);
  border: none;
  border-radius: 4px;
  padding: 8px 14px;
  cursor: pointer;
  width: 100%;
}
.logout-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
}
.login-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
.auth-error {
  font-size: 12px;
  color: #ff9d5c;
  margin: 0;
}
</style>

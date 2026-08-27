import { defineStore } from 'pinia';
import { ref } from 'vue';
import { login as githubLogin, getStoredToken, clearStoredToken } from '../lib/auth';

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getStoredToken());
  const user = ref<GitHubUser | null>(null);
  const loading = ref(false);
  const error = ref('');

  async function fetchUser() {
    if (!token.value) return;
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token.value}` },
    });
    if (!res.ok) {
      logout();
      return;
    }
    user.value = (await res.json()) as GitHubUser;
  }

  async function login() {
    loading.value = true;
    error.value = '';
    try {
      token.value = await githubLogin();
      await fetchUser();
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  function logout() {
    token.value = null;
    user.value = null;
    clearStoredToken();
  }

  if (token.value) {
    fetchUser();
  }

  return { token, user, loading, error, login, logout };
});

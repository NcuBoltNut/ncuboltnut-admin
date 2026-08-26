import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
    { path: '/news', name: 'news', component: () => import('../views/NewsView.vue') },
    {
      path: '/activities',
      name: 'activities',
      component: () => import('../views/ActivitiesView.vue'),
    },
    { path: '/members', name: 'members', component: () => import('../views/MembersView.vue') },
    { path: '/sponsors', name: 'sponsors', component: () => import('../views/SponsorsView.vue') },
    { path: '/history', name: 'history', component: () => import('../views/HistoryView.vue') },
  ],
});

export default router;

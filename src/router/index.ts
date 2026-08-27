import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'dashboard', component: () => import('../views/DashboardView.vue') },
    { path: '/news', name: 'news', component: () => import('../views/NewsView.vue') },
    { path: '/news/new', name: 'news-new', component: () => import('../views/NewsEditView.vue') },
    {
      path: '/news/:file',
      name: 'news-edit',
      component: () => import('../views/NewsEditView.vue'),
    },
    {
      path: '/activities',
      name: 'activities',
      component: () => import('../views/ActivitiesView.vue'),
    },
    {
      path: '/activities/new',
      name: 'activities-new',
      component: () => import('../views/ActivitiesEditView.vue'),
    },
    {
      path: '/activities/:file',
      name: 'activities-edit',
      component: () => import('../views/ActivitiesEditView.vue'),
    },
    { path: '/members', name: 'members', component: () => import('../views/MembersView.vue') },
    { path: '/sponsors', name: 'sponsors', component: () => import('../views/SponsorsView.vue') },
    { path: '/history', name: 'history', component: () => import('../views/HistoryView.vue') },
    {
      path: '/:type(members|generations|advisors|sponsors|history)/new',
      name: 'data-new',
      component: () => import('../views/DataRecordEditView.vue'),
    },
    {
      path: '/:type(members|generations|advisors|sponsors|history)/edit/:index',
      name: 'data-edit',
      component: () => import('../views/DataRecordEditView.vue'),
    },
  ],
});

export default router;

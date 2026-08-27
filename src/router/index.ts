import { createRouter, createWebHashHistory } from 'vue-router';

// Hash history, not createWebHistory: GitHub Pages is a static file host
// with no server-side rewrite support, so a direct request for e.g.
// /ncuboltnut-admin/members (a bookmark, a refresh) would 404 before the
// SPA ever gets a chance to route it client-side. Hash routing keeps
// everything after the "#" purely client-side, so the server only ever
// sees a request for index.html.
const router = createRouter({
  history: createWebHashHistory(),
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
      path: '/:type(members|generations|advisors|sponsors|history)/edit/:key',
      name: 'data-edit',
      component: () => import('../views/DataRecordEditView.vue'),
    },
  ],
});

export default router;

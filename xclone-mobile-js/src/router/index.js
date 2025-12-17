import { createRouter, createWebHistory } from '@ionic/vue-router';
import { Capacitor } from '@capacitor/core';
import LoginPage from '../views/LoginPage.vue';
import RegisterPage from '../views/RegisterPage.vue';
import TabsPage from '../views/TabsPage.vue';
import FeedPage from '../views/FeedPage.vue';
import FollowPage from '../views/FollowPage.vue';
import DMPage from '../views/DMPage.vue';
import ProfilePage from '../views/ProfilePage.vue';
import NotificationsPage from '../views/NotificationsPage.vue';

const routes = [
  { 
    path: '/', 
    redirect: '/tabs/feed' 
  },
  { 
    path: '/login', 
    component: LoginPage,
    meta: { requiresAuth: false }
  },
  { 
    path: '/register', 
    component: RegisterPage,
    meta: { requiresAuth: false }
  },
  { 
    path: '/tabs/', 
    component: TabsPage,
    meta: { requiresAuth: false },
    children: [
      { 
        path: '', 
        redirect: '/tabs/feed' 
      },
      { 
        path: 'feed', 
        component: FeedPage,
        meta: { requiresAuth: false }
      },
      { 
        path: 'follow', 
        component: FollowPage,
        meta: { requiresAuth: true }
      },
      { 
        path: 'dm', 
        component: DMPage,
        meta: { requiresAuth: true }
      },
      {
        path: 'notifications',
        component: NotificationsPage,
        meta: { requiresAuth: true }
      },
      { 
        path: 'profile/:username?', 
        component: ProfilePage,
        meta: { requiresAuth: true }
      }
    ]
  }
];

// Use createWebHistory for Capacitor
const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
});

// Navigation guard
router.beforeEach((to, from, next) => {
  console.log('🧭 Navigating to:', to.path);
  
  const userId = localStorage.getItem('userId');
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  
  if (requiresAuth && !userId) {
    console.log('🔒 Auth required, redirecting to login');
    next('/login');
  } else if ((to.path === '/login' || to.path === '/register') && userId) {
    console.log('✅ Already logged in, redirecting to feed');
    next('/tabs/feed');
  } else {
    next();
  }
});

export default router;
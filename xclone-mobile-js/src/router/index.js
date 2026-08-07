import { createRouter, createWebHistory, createWebHashHistory } from '@ionic/vue-router';
import { Capacitor } from '@capacitor/core';
import LoginPage from '../views/LoginPage.vue';
import RegisterPage from '../views/RegisterPage.vue';
import TabsPage from '../views/TabsPage.vue';
import FeedPage from '../views/FeedPage.vue';
import FollowPage from '../views/FollowPage.vue';
import DMPage from '../views/DMPage.vue';
import ProfilePage from '../views/ProfilePage.vue';
import NotificationsPage from '../views/NotificationsPage.vue';
import UserFollowListPage from '../views/UserFollowListPage.vue';
import FraternityDiscoverPage from '../views/FraternityDiscoverPage.vue';
import FraternityPage from '../views/FraternityPage.vue';
import VerificationPortal from '../views/VerificationPortal.vue';
import VideoFeedPage from '../views/VideoFeedPage.vue';

import NoticeBoardPage from '../views/NoticeBoardPage.vue';
import OrgBoardPage from '../views/OrgBoardPage.vue';
import OrgAuthPage from '../views/OrgAuthPage.vue';

const standaloneOrg = import.meta.env.VITE_STANDALONE_ORG || null;

// Runtime check: launched from an installed home-screen icon (separate window, no URL bar)
function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

// The installed "Bugema Notice" app only serves the Bugema noticeboard
const noticeSlug = () => standaloneOrg || 'bugema';

const routes = [
  {
    path: '/',
    redirect: () => {
      if (standaloneOrg) return `/notices/${standaloneOrg}`;
      if (isStandaloneMode()) return `/notices/${noticeSlug()}`;
      return '/tabs/feed';
    }
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
    path: '/notices/:slug/login',
    component: OrgAuthPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/notices/:slug/register',
    component: OrgAuthPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/notices/:slug',
    component: OrgBoardPage,
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
      },
      {
        path: 'profile/:username/following',
        component: UserFollowListPage,
        meta: { requiresAuth: true, type: 'following' }
      },
      {
        path: 'profile/:username/followers',
        component: UserFollowListPage,
        meta: { requiresAuth: true, type: 'followers' }
      },
      {
        path: 'fraternity',
        component: FraternityDiscoverPage,
        meta: { requiresAuth: false }
      },
      {
        path: 'fraternity/:slug',
        component: FraternityPage,
        meta: { requiresAuth: false }
      },
      {
        path: 'notices',
        component: NoticeBoardPage,
        meta: { requiresAuth: false }
      },
      {
        path: 'notices/:slug',
        component: OrgBoardPage,
        meta: { requiresAuth: false }
      },
      {
        path: 'notices/:slug/login',
        component: OrgAuthPage,
        meta: { requiresAuth: false }
      },
      {
        path: 'notices/:slug/register',
        component: OrgAuthPage,
        meta: { requiresAuth: false }
      },
      {
        path: 'verify',
        component: VerificationPortal,
        meta: { requiresAuth: true }
      },
      {
        path: 'videos',
        component: VideoFeedPage,
        meta: { requiresAuth: false }
      }
    ]
  }
];

// Use hash history for Capacitor native (Android/iOS) to prevent white screen
// Web history works great in browsers but can fail in Android WebView
const history = Capacitor.isNativePlatform()
  ? createWebHashHistory()
  : createWebHistory(import.meta.env.BASE_URL);

const router = createRouter({
  history,
  routes
});

// Navigation guard
router.beforeEach((to, from, next) => {
  console.log('🧭 Navigating to:', to.path);

  if (standaloneOrg || isStandaloneMode()) {
    // In standalone mode, only allow the org notice board and its login/register pages
    const org = noticeSlug();
    const allowedPrefixes = [`/notices/${org}`, `/tabs/notices/${org}`];
    const isAllowed = allowedPrefixes.some(p => to.path.startsWith(p));
    if (!isAllowed) {
      return next(`/notices/${org}`);
    }
  }

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
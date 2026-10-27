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
import TalksPage from '../views/TalksPage.vue';

import NoticeBoardPage from '../views/NoticeBoardPage.vue';
import OrgBoardPage from '../views/OrgBoardPage.vue';
import OrgAuthPage from '../views/OrgAuthPage.vue';
import TalkRoomView from '../views/TalkRoomView.vue';
import NexRoomsPage from '../views/NexRoomsPage.vue';
import NexRoomsAuthPage from '../views/NexRoomsAuthPage.vue';

const standaloneOrg = (import.meta.env.VITE_STANDALONE_ORG || '').trim() || null;
const standaloneApp = (import.meta.env.VITE_STANDALONE_APP || '').trim().toLowerCase();

// Standalone NexRooms check (via Vercel env var, custom domain like rooms.nexfi.org.uk, or ?app=rooms query)
export const isRoomsStandalone = () => {
  if (standaloneApp === 'rooms' || import.meta.env.VITE_STANDALONE_ROOMS === 'true') return true;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.startsWith('rooms.') || host.includes('nexrooms') || window.location.search.includes('app=rooms');
};

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
      if (isRoomsStandalone()) return '/rooms';
      if (standaloneOrg) return `/notices/${standaloneOrg}`;
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
    // Standalone meeting room: shareable link, guest-friendly, no tabs/feed
    path: '/talk/:code',
    component: TalkRoomView,
    meta: { requiresAuth: false }
  },
  {
    // NexRooms standalone — talks/meetings hub, no NexFi nav
    path: '/rooms',
    component: NexRoomsPage,
    meta: { requiresAuth: false }
  },
  {
    path: '/rooms/login',
    component: NexRoomsAuthPage,
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
      },
      {
        path: 'talks',
        component: TalksPage,
        meta: { requiresAuth: true }
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

  if (isRoomsStandalone()) {
    // In standalone NexRooms mode (e.g. rooms.nexfi.org.uk or nexrooms.vercel.app),
    // strictly isolate navigation to NexRooms & meeting rooms
    const allowed = ['/rooms', '/talk/'];
    const isAllowed = allowed.some(p => to.path.startsWith(p));
    if (!isAllowed) {
      return next('/rooms');
    }
  } else if (standaloneOrg || isStandaloneMode()) {
    // In standalone mode, only allow the org notice board and its login/register pages
    // plus standalone meeting rooms (shared talk links must open anywhere).
    const org = noticeSlug();
    const allowedPrefixes = [`/notices/${org}`, `/tabs/notices/${org}`, '/talk/', '/rooms'];
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

router.afterEach((to) => {
  if (typeof document === 'undefined') return;
  const isBugemaNotice = to.path.startsWith('/notices/bugema') || standaloneOrg === 'bugema';
  const isNexRooms = to.path.startsWith('/rooms') || isRoomsStandalone();

  const setMeta = (id, nameOrProp, val) => {
    let el = document.getElementById(id) || document.querySelector(`meta[property='${nameOrProp}']`) || document.querySelector(`meta[name='${nameOrProp}']`);
    if (el) {
      el.setAttribute('content', val);
    } else {
      const meta = document.createElement('meta');
      if (nameOrProp.startsWith('og:')) meta.setAttribute('property', nameOrProp);
      else meta.setAttribute('name', nameOrProp);
      meta.setAttribute('content', val);
      document.head.appendChild(meta);
    }
  };

  const updateHead = ({ iconUrl, manifestUrl, appName, title, desc }) => {
    document.title = title;

    // 1. Favicon links
    let favicon = document.getElementById('app-favicon') || document.querySelector("link[rel*='icon']");
    if (favicon) favicon.href = iconUrl;

    let shortcutIcon = document.querySelector("link[rel='shortcut icon']");
    if (shortcutIcon) shortcutIcon.href = iconUrl;

    // 2. Apple Touch Icon
    let appleIcon = document.getElementById('app-apple-touch-icon') || document.querySelector("link[rel='apple-touch-icon']");
    if (appleIcon) appleIcon.href = iconUrl;

    // 3. Manifest Link
    let manifest = document.getElementById('manifest-link') || document.querySelector("link[rel='manifest']");
    if (manifest) manifest.setAttribute('href', manifestUrl);

    // 4. App Name & OpenGraph Meta
    setMeta('meta-title', 'title', title);
    setMeta('og-title', 'og:title', title);
    setMeta('twitter-title', 'twitter:title', title);

    setMeta('meta-desc', 'description', desc);
    setMeta('og-desc', 'og:description', desc);
    setMeta('twitter-desc', 'twitter:description', desc);

    setMeta('og-image', 'og:image', iconUrl);
    setMeta('twitter-image', 'twitter:image', iconUrl);

    setMeta('apple-title', 'apple-mobile-web-app-title', appName);
    setMeta('app-name', 'application-name', appName);

    // Theme colour
    let themeColor = document.querySelector("meta[name='theme-color']");
    if (themeColor) themeColor.setAttribute('content', appName === 'NexRooms' ? '#000000' : (appName === 'Bugema Notice' ? '#daa520' : '#1208a1'));
  };

  if (isBugemaNotice) {
    updateHead({
      iconUrl: '/bugema-logo.png',
      manifestUrl: '/manifest-bugema.json',
      appName: 'Bugema Notice',
      title: 'Bugema University - Digital Notice Board',
      desc: 'Official Bugema University Digital Notice Board. View official announcements, academic notices, timetable updates, and campus news.'
    });
    document.documentElement.classList.remove('nexrooms-theme');
    document.body.classList.remove('nexrooms-theme');
  } else if (isNexRooms) {
    updateHead({
      iconUrl: '/nexrooms-logo.png',
      manifestUrl: '/manifest-nexrooms.json',
      appName: 'NexRooms',
      title: 'NexRooms — Instant Meetings & Scheduled Talks',
      desc: 'Create instant meetings, schedule talks, and join rooms — powered by NexFi. Black-and-white, distraction-free.'
    });
    document.documentElement.classList.add('nexrooms-theme');
    document.body.classList.add('nexrooms-theme');
  } else {
    updateHead({
      iconUrl: '/logo.png',
      manifestUrl: '/manifest.json',
      appName: 'NexFi',
      title: 'NexFi - Connect, Share & Communicate',
      desc: 'Connect, share updates, direct message, and communicate seamlessly on NexFi.'
    });
    document.documentElement.classList.remove('nexrooms-theme');
    document.body.classList.remove('nexrooms-theme');
  }
});

export default router;
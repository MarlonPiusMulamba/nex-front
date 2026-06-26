<template>
  <div class="widget notice-widget">
    <div class="widget-header" @click="goToNotices">
      <h3>Recent Notices</h3>
      <ion-icon :icon="chevronForwardOutline" class="go-icon"></ion-icon>
    </div>

    <div v-if="loading" class="widget-loading">
      <ion-spinner name="dots" color="gold"></ion-spinner>
    </div>

    <div v-else-if="notices.length === 0" class="widget-empty" @click="goToNotices">
      <ion-icon :icon="megaphoneOutline"></ion-icon>
      <p>No recent notices</p>
    </div>

    <div v-else class="notice-list">
      <div 
        v-for="notice in notices" 
        :key="notice.id"
        class="notice-item"
        @click="goToNoticeBoard(notice.org_slug)"
      >
        <div class="notice-meta">
          <img :src="notice.org_logo || defaultLogo" class="org-mini-pic" />
          <span class="org-name">{{ notice.org_name }}</span>
          <ion-badge :color="getCategoryColor(notice.category)" class="cat-badge">
            {{ notice.category }}
          </ion-badge>
        </div>
        <div class="notice-title">{{ notice.title }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { IonIcon, IonSpinner, IonBadge } from '@ionic/vue';
import { chevronForwardOutline, megaphoneOutline } from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'NoticeWidget',
  components: { IonIcon, IonSpinner, IonBadge },
  data() {
    return {
      chevronForwardOutline,
      megaphoneOutline,
      loading: true,
      notices: [],
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80',
    };
  },
  methods: {
    async fetchRecentNotices() {
      this.loading = true;
      try {
        const params = {};
        if (this.userId) {
          params.user_id = this.userId;
        }
        const res = await axios.get(`${this.API_URL}/api/boards/notices/recent`, { params });
        if (res.data.success) {
          this.notices = res.data.notices;
        }
      } catch (err) {
        console.error('Fetch recent notices error:', err);
      } finally {
        this.loading = false;
      }
    },
    goToNotices() {
      this.$router.push('/tabs/notices');
    },
    goToNoticeBoard(slug) {
      this.$router.push(`/tabs/notices/${slug}`);
    },
    getCategoryColor(cat) {
      const colors = {
        'Urgent': 'danger',
        'Academic': 'secondary',
        'Finance': 'success',
        'Events': 'tertiary',
        'General': 'medium'
      };
      return colors[cat] || 'primary';
    }
  },
  mounted() {
    this.fetchRecentNotices();
    if (window.appSocket) {
      window.appSocket.on('notice:new', () => {
        this.fetchRecentNotices();
      });
    }
  }
};
</script>

<style scoped>
.widget {
  background: var(--ion-background-color, #fff);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 20px;
  border: 1px solid var(--ion-border-color, #eff3f4);
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.widget-header:hover {
  opacity: 0.8;
}

.widget-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--ion-text-color, #0f1419);
}

.go-icon {
  font-size: 1.2rem;
  opacity: 0.5;
  color: var(--ion-color-medium, #536471);
}

.widget-loading, .widget-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  opacity: 0.6;
  color: var(--ion-color-medium, #536471);
}

.widget-empty {
  cursor: pointer;
  transition: opacity 0.2s;
}

.widget-empty:hover {
  opacity: 1;
}

.notice-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.notice-item {
  background: var(--ion-color-light, #f7f9f9);
  padding: 12px;
  border-radius: 12px;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.02);
  transition: transform 0.2s, background-color 0.2s, border-color 0.2s;
}

.notice-item:hover {
  background: rgba(218, 165, 32, 0.05);
  border-color: rgba(218, 165, 32, 0.2);
  transform: translateX(4px);
}

.notice-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.org-mini-pic {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  object-fit: cover;
}

.org-name {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cat-badge {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 700;
}

.notice-title {
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1.35;
  color: var(--ion-text-color, #1a1a1a);
}
</style>

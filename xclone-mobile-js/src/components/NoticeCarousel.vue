<template>
  <div v-if="latestNotice" class="banner-container">
    <div class="banner-card" @click="goToBoard(latestNotice.org_slug)">
      <div class="banner-header">
        <div class="org-info">
          <img :src="latestNotice.org_logo || defaultLogo" class="org-logo" />
          <div class="org-names">
            <span class="org-name">
              {{ latestNotice.org_name }}
              <span v-if="latestNotice.dept_name" class="dept-pipe-name"> | {{ latestNotice.dept_name }}</span>
            </span>
          </div>
        </div>
        <div class="header-right">
          <span class="category-badge" :style="getBadgeStyle(latestNotice.category)">
            {{ latestNotice.category }}
          </span>
        </div>
      </div>

      <div class="banner-body">
        <div class="banner-title-row">
          <ion-icon :icon="megaphoneOutline" class="announcement-icon"></ion-icon>
          <h3 class="notice-title">{{ latestNotice.title }}</h3>
        </div>
        <p class="notice-snippet" v-html="formatNoticeBody(truncateText(latestNotice.body, 120))"></p>
      </div>

      <div class="banner-footer">
        <span class="notice-date">{{ formatDate(latestNotice.created_at) }}</span>
        <button class="action-btn" @click.stop="goToBoard(latestNotice.org_slug)">
          View Board
          <ion-icon :icon="chevronForwardOutline"></ion-icon>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { IonIcon } from '@ionic/vue';
import { megaphoneOutline, chevronForwardOutline } from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';

export default {
  name: 'NoticeCarousel', // Keep same component registration name to prevent routing breakages
  components: { IonIcon },
  data() {
    return {
      megaphoneOutline,
      chevronForwardOutline,
      notices: [],
      loading: true,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80',
    };
  },
  computed: {
    latestNotice() {
      return this.notices.length > 0 ? this.notices[0] : null;
    }
  },
  methods: {
    formatNoticeBody(text) {
      if (!text) return '';

      const escapeHtml = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      let escaped = escapeHtml(text);

      escaped = escaped
        .replace(/&lt;b&gt;/gi, '<b>').replace(/&lt;\/b&gt;/gi, '</b>')
        .replace(/&lt;strong&gt;/gi, '<strong>').replace(/&lt;\/strong&gt;/gi, '</strong>')
        .replace(/&lt;i&gt;/gi, '<i>').replace(/&lt;\/i&gt;/gi, '</i>')
        .replace(/&lt;em&gt;/gi, '<em>').replace(/&lt;\/em&gt;/gi, '</em>')
        .replace(/&lt;u&gt;/gi, '<u>').replace(/&lt;\/u&gt;/gi, '</u>');

      const urlRegex = /(https?:\/\/[^\s<]+|ftp:\/\/[^\s<]+|www\.[^\s<]+)/ig;

      escaped = escaped.replace(urlRegex, (match) => {
        let mainUrl = match;
        let trailingPunct = '';
        const punctMatch = match.match(/^(.+?)([.,!?:;)\]]+)$/);
        if (punctMatch) {
          mainUrl = punctMatch[1];
          trailingPunct = punctMatch[2];
        }

        const lowerUrl = mainUrl.toLowerCase();
        const href = lowerUrl.startsWith('http://') || lowerUrl.startsWith('https://') || lowerUrl.startsWith('ftp://')
          ? mainUrl
          : `https://${mainUrl}`;

        return `<a href="${href}" class="post-link notice-link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${mainUrl}</a>${trailingPunct}`;
      });

      return escaped.replace(/\n/g, '<br>');
    },
    async fetchRecentNotices() {
      this.loading = true;
      try {
        const params = {};
        if (this.userId) {
          params.user_id = this.userId;
        }
        const res = await axios.get(`${this.API_URL}/api/boards/notices/recent`, { params });
        if (res.data.success) {
          this.notices = res.data.notices || [];
          this.$emit('notices-updated', this.notices);
        }
      } catch (err) {
        console.error('Fetch notices in banner error:', err);
      } finally {
        this.loading = false;
      }
    },
    goToBoard(slug) {
      if (slug) {
        this.$router.push(`/tabs/notices/${slug}`);
      } else {
        this.$router.push('/tabs/notices');
      }
    },
    truncateText(text, limit) {
      if (!text) return '';
      return text.length > limit ? text.slice(0, limit) + '...' : text;
    },
    formatDate(date) {
      if (!date) return '';
      const d = new Date(date);
      const now = new Date();
      const diff = now - d;
      const mins = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    },
    getBadgeStyle(cat) {
      const colors = {
        'Urgent': { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
        'Academic': { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
        'Finance': { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
        'Events': { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
        'General': { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' }
      };
      const match = colors[cat] || { bg: 'rgba(218, 165, 32, 0.15)', text: '#daa520' };
      return {
        backgroundColor: match.bg,
        color: match.text
      };
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
.banner-container {
  margin: 16px 0 8px 0;
  padding: 0 16px;
  width: 100%;
  box-sizing: border-box;
}

.banner-card {
  background: linear-gradient(135deg, #ffffff 0%, rgba(218, 165, 32, 0.04) 100%);
  border-radius: 16px;
  padding: 16px;
  border: none !important; /* No border colors */
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.banner-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

.banner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.org-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.org-logo {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
}

.org-names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.org-name {
  font-size: 0.8rem;
  font-weight: 800;
  color: var(--ion-text-color, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dept-pipe-name {
  font-size: 0.72rem;
  font-weight: 600;
  color: #daa520;
  opacity: 0.9;
}

.category-badge {
  font-size: 0.65rem;
  font-weight: 750;
  padding: 3px 8px;
  border-radius: 8px;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}

.banner-body {
  margin-bottom: 12px;
}

.banner-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.announcement-icon {
  font-size: 1.1rem;
  color: #daa520;
  flex-shrink: 0;
}

.notice-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--ion-text-color, #1a1a1a);
  line-height: 1.3;
}

.notice-snippet {
  margin: 0;
  font-size: 0.8rem;
  color: #555555;
  line-height: 1.45;
  opacity: 0.9;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.banner-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.notice-date {
  font-size: 0.7rem;
  color: #888888;
}

.action-btn {
  background: none;
  border: none;
  font-size: 0.75rem;
  font-weight: 700;
  color: #daa520;
  display: flex;
  align-items: center;
  gap: 2px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 12px;
  transition: background-color 0.2s;
}

.action-btn:hover {
  background-color: rgba(218, 165, 32, 0.08);
}

/* Modal Styling */
.modal-toolbar {
  --background: #ffffff;
  --border-color: rgba(0, 0, 0, 0.05);
}

.modal-close-btn {
  --color: #1a1a1a;
  --padding-start: 8px;
  --padding-end: 8px;
}

.modal-title {
  font-weight: 800;
  font-size: 1rem;
  color: #1a1a1a;
}

.modal-content {
  --background: #f9fafb;
}

.modal-body-container {
  max-width: 600px;
  margin: 0 auto;
}

.notice-org-banner {
  background: #ffffff;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.modal-org-logo {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  object-fit: cover;
}

.modal-org-info {
  flex: 1;
}

.modal-org-info h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  color: #1a1a1a;
}

.modal-org-info p {
  margin: 2px 0 0 0;
  font-size: 0.8rem;
  color: #666666;
}

.modal-cat-badge {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 10px;
}

.notice-main-content {
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.notice-detail-title {
  margin: 0 0 16px 0;
  font-size: 1.4rem;
  font-weight: 850;
  line-height: 1.35;
  color: #1a1a1a;
  letter-spacing: -0.5px;
}

.author-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

.author-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.author-info-text {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 0.8rem;
  font-weight: 700;
  color: #333333;
}

.post-time {
  font-size: 0.72rem;
  color: #888888;
}

.notice-detail-body {
  font-size: 0.95rem;
  line-height: 1.6;
  color: #2c3e50;
  white-space: normal;
}

.attachment-box {
  margin-top: 24px;
  background: rgba(218, 165, 32, 0.04);
  border: 1px dashed rgba(218, 165, 32, 0.3);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s;
}

.attachment-box:hover {
  background-color: rgba(218, 165, 32, 0.08);
  border-color: #daa520;
}

.attachment-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attachment-icon {
  font-size: 1.5rem;
  color: #daa520;
}

.attachment-text {
  display: flex;
  flex-direction: column;
}

.attachment-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #1a1a1a;
}

.attachment-subtitle {
  font-size: 0.72rem;
  color: #666666;
}

.attachment-arrow {
  font-size: 1.2rem;
  color: #daa520;
}
</style>

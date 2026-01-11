<template>
  <div class="trending-widget">
    <h3 class="widget-title">Trending</h3>
    
    <div v-if="loading" class="widget-loading">
      <ion-spinner name="crescent"></ion-spinner>
    </div>
    
    <div v-else-if="trends.length === 0" class="widget-empty">
      <p>No trending topics</p>
    </div>
    
    <div v-else class="trends-list">
      <div
        v-for="(trend, index) in trends.slice(0, 5)"
        :key="trend.type + '_' + trend.topic"
        class="trend-item"
        @click="onTrendClick(trend)"
      >
        <div class="trend-header">
          <span class="trend-rank">{{ index + 1 }}</span>
          <span class="trend-category">{{ trend.type === 'hashtag' ? 'Hashtag' : 'Trending' }}</span>
        </div>
        <div class="trend-topic">{{ formatTopic(trend) }}</div>
        <div class="trend-count">{{ trend.count }} posts</div>
      </div>
    </div>
  </div>
</template>

<script>
import { IonSpinner } from '@ionic/vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'TrendingWidget',
  components: {
    IonSpinner
  },
  data() {
    return {
      trends: [],
      loading: false,
      API_URL: config.api.baseURL
    };
  },
  methods: {
    async loadTrending() {
      try {
        this.loading = true;
        const res = await axios.get(`${this.API_URL}/api/trending`, {
          params: { limit: 10, days: 7, recent_limit: 2000 }
        });
        this.trends = res.data.topics || [];
      } catch (err) {
        console.error('Failed to load trending:', err);
        this.trends = [];
      } finally {
        this.loading = false;
      }
    },
    
    formatTopic(trend) {
      const raw = (trend?.topic || '').toString();
      if (!raw) return '';
      if (trend?.type === 'hashtag') return raw;
      const s = raw.charAt(0).toUpperCase() + raw.slice(1);
      return s.length > 40 ? s.slice(0, 37) + '...' : s;
    },
    
    onTrendClick(trend) {
      const query = trend?.type === 'hashtag' ? trend.topic : trend.topic;
      this.$router.push({ path: '/tabs/follow', query: { q: query } });
    }
  },
  mounted() {
    this.loadTrending();
    
    // Refresh every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadTrending();
    }, 5 * 60 * 1000);
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
};
</script>

<style scoped>
.trending-widget {
  background: var(--ion-background-color, #fff);
  border: 1px solid var(--ion-border-color, #eff3f4);
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 16px;
}

.widget-title {
  font-size: 20px;
  font-weight: 800;
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  color: var(--ion-text-color, #0f1419);
}

.widget-loading,
.widget-empty {
  padding: 32px;
  text-align: center;
  color: var(--ion-color-medium, #536471);
}

.trends-list {
  /* No padding, items have their own */
}

.trend-item {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
}

.trend-item:last-child {
  border-bottom: none;
}

.trend-item:hover {
  background-color: var(--ion-color-light, #f7f9f9);
}

.trend-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.trend-rank {
  font-size: 12px;
  font-weight: 700;
  color: var(--ion-color-primary, #1d9bf0);
  min-width: 20px;
}

.trend-category {
  font-size: 13px;
  color: var(--ion-color-medium, #536471);
}

.trend-topic {
  font-size: 15px;
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
  margin-bottom: 2px;
  word-break: break-word;
}

.trend-count {
  font-size: 13px;
  color: var(--ion-color-medium, #536471);
}
</style>

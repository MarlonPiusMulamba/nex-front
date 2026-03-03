<template>
  <ion-page>
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Fraternities</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showCreate = true" class="create-btn">
            <ion-icon name="add-outline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>

      <!-- Search Bar -->
      <ion-toolbar>
        <div class="search-wrap">
          <ion-searchbar
            v-model="searchQuery"
            placeholder="Search fraternities..."
            debounce="400"
            @ionInput="onSearch"
            class="frat-searchbar"
          ></ion-searchbar>
        </div>
      </ion-toolbar>

      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          v-for="tab in filterTabs"
          :key="tab.key"
          :class="['filter-tab', { active: activeFilter === tab.key }]"
          @click="setFilter(tab.key)"
        >{{ tab.label }}</button>
      </div>
    </ion-header>

    <ion-content ref="content">
      <!-- Loading -->
      <div v-if="loading" class="loading-grid">
        <div v-for="i in 6" :key="i" class="skeleton-card"></div>
      </div>

      <!-- My Fraternities -->
      <div v-if="activeFilter === 'mine' && myFraternities.length > 0" class="section">
        <h2 class="section-title">Your Spaces</h2>
        <div class="frat-grid">
          <FraternityCard
            v-for="f in myFraternities"
            :key="f.id"
            :fraternity="f"
          />
        </div>
      </div>

      <!-- Discover List -->
      <div v-if="activeFilter !== 'mine'" class="section">
        <h2 class="section-title" v-if="searchQuery">
          Results for "{{ searchQuery }}"
        </h2>
        <h2 class="section-title" v-else>Discover Spaces</h2>

        <div class="frat-grid" v-if="fraternities.length > 0">
          <FraternityCard
            v-for="f in fraternities"
            :key="f.id"
            :fraternity="f"
          />
        </div>

        <div v-else-if="!loading" class="empty-state">
          <div class="empty-icon">🛡</div>
          <h3>No Fraternities Yet</h3>
          <p>Be the first to create a space.</p>
          <ion-button @click="showCreate = true" color="primary" shape="round">
            Create Fraternity
          </ion-button>
        </div>
      </div>

      <!-- Load more -->
      <div v-if="hasMore && !loading" class="load-more-wrap">
        <ion-button fill="clear" @click="loadMore" :disabled="loadingMore">
          {{ loadingMore ? 'Loading...' : 'Load More' }}
        </ion-button>
      </div>
    </ion-content>

    <!-- Create Fraternity Modal -->
    <ion-modal :is-open="showCreate" @didDismiss="showCreate = false">
      <ion-header>
        <ion-toolbar>
          <ion-title>New Fraternity</ion-title>
          <ion-buttons slot="end">
            <ion-button @click="showCreate = false">Cancel</ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <ion-content class="create-modal-content">
        <div class="create-form">
          <!-- Emblem Upload -->
          <div class="emblem-upload-wrap" @click="triggerEmblemUpload">
            <div
              class="emblem-preview"
              :style="form.theme_color ? `--frat-color: ${form.theme_color}` : ''"
            >
              <img v-if="form.emblem_preview" :src="form.emblem_preview" alt="Emblem" />
              <span v-else>{{ form.name?.[0]?.toUpperCase() || '?' }}</span>
            </div>
            <p class="upload-hint">Tap to upload emblem/sigil</p>
            <input ref="emblemInput" type="file" accept="image/*" style="display:none" @change="onEmblemChange" />
          </div>

          <ion-item lines="none" class="form-item">
            <ion-label position="stacked">Name *</ion-label>
            <ion-input v-model="form.name" placeholder="e.g. Tech Sovereigns" maxlength="40"></ion-input>
          </ion-item>

          <ion-item lines="none" class="form-item">
            <ion-label position="stacked">Motto</ion-label>
            <ion-input v-model="form.motto" placeholder="e.g. Code is Power" maxlength="80"></ion-input>
          </ion-item>

          <ion-item lines="none" class="form-item">
            <ion-label position="stacked">Description</ion-label>
            <ion-textarea v-model="form.description" placeholder="What is your fraternity about?" rows="3" maxlength="300"></ion-textarea>
          </ion-item>

          <!-- Theme Color -->
          <div class="form-section-title">Theme Color</div>
          <div class="color-palette">
            <div
              v-for="color in themeColors"
              :key="color"
              class="color-swatch"
              :class="{ active: form.theme_color === color }"
              :style="{ background: color }"
              @click="form.theme_color = color"
            ></div>
          </div>

          <!-- Join Method -->
          <div class="form-section-title">Join Method</div>
          <div class="join-method-grid">
            <div
              v-for="m in joinMethods"
              :key="m.key"
              class="join-method-opt"
              :class="{ active: form.join_method === m.key }"
              @click="form.join_method = m.key"
            >
              <span class="jm-icon">{{ m.icon }}</span>
              <span class="jm-label">{{ m.label }}</span>
            </div>
          </div>

          <!-- Questions (if join_method = questions) -->
          <div v-if="form.join_method === 'questions'" class="questions-wrap">
            <div class="form-section-title">Entry Questions (up to 2)</div>
            <ion-item lines="none" class="form-item" v-for="(q, i) in form.join_questions" :key="i">
              <ion-label position="stacked">Question {{ i + 1 }}</ion-label>
              <ion-input v-model="form.join_questions[i]" :placeholder="`Question ${i + 1}`"></ion-input>
            </ion-item>
            <ion-button
              v-if="form.join_questions.length < 2"
              fill="clear"
              size="small"
              @click="form.join_questions.push('')"
            >+ Add Question</ion-button>
          </div>

          <ion-item lines="none" class="form-item toggle-item">
            <ion-label>Private Space</ion-label>
            <ion-toggle v-model="form.is_private" slot="end"></ion-toggle>
          </ion-item>

          <ion-button
            expand="block"
            shape="round"
            :disabled="!form.name.trim() || creating"
            @click="createFraternity"
            class="create-submit-btn"
            :style="{ '--frat-color': form.theme_color }"
          >
            {{ creating ? 'Creating...' : '🛡 Create Fraternity' }}
          </ion-button>
        </div>
      </ion-content>
    </ion-modal>
  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonButtons, IonIcon, IonSearchbar,
  IonModal, IonItem, IonLabel, IonInput, IonTextarea,
  IonToggle
} from '@ionic/vue';
import FraternityCard from '@/components/FraternityCard.vue';
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'FraternityDiscoverPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonButtons, IonIcon, IonSearchbar,
    IonModal, IonItem, IonLabel, IonInput, IonTextarea,
    IonToggle, FraternityCard
  },
  data() {
    return {
      API_URL: config.api.baseURL,
      userId: localStorage.getItem('userId'),
      fraternities: [],
      myFraternities: [],
      loading: false,
      loadingMore: false,
      hasMore: true,
      offset: 0,
      limit: 12,
      searchQuery: '',
      activeFilter: 'discover',
      showCreate: false,
      creating: false,
      filterTabs: [
        { key: 'discover', label: '🌐 Discover' },
        { key: 'mine', label: '🛡 Mine' },
        { key: 'energy', label: '⚡ High Energy' }
      ],
      form: {
        name: '',
        motto: '',
        description: '',
        theme_color: '#6366f1',
        bg_accent_style: 'pulse',
        join_method: 'open',
        join_questions: [],
        is_private: false,
        emblem: null,
        emblem_preview: null
      },
      themeColors: [
        '#6366f1', '#f43f5e', '#f59e0b', '#10b981',
        '#06b6d4', '#8b5cf6', '#ec4899', '#3b82f6',
        '#ef4444', '#22c55e'
      ],
      joinMethods: [
        { key: 'open', icon: '🔓', label: 'Open' },
        { key: 'request', icon: '📋', label: 'Request' },
        { key: 'questions', icon: '❓', label: 'Questions' },
        { key: 'invite', icon: '✉️', label: 'Invite' }
      ]
    };
  },
  async mounted() {
    await this.load();
  },
  methods: {
    async load() {
      this.loading = true;
      this.offset = 0;
      try {
        const [discRes, mineRes] = await Promise.all([
          axios.get(`${this.API_URL}/api/fraternity/discover`, {
            params: { user_id: this.userId, limit: this.limit, offset: 0 }
          }),
          this.userId
            ? axios.get(`${this.API_URL}/api/fraternity/mine`, { params: { user_id: this.userId } })
            : Promise.resolve({ data: { fraternities: [] } })
        ]);
        this.fraternities = discRes.data.fraternities || [];
        this.myFraternities = mineRes.data.fraternities || [];
        this.hasMore = this.fraternities.length >= this.limit;
        this.offset = this.fraternities.length;
      } catch (e) {
        console.error('Load fraternities error:', e);
      } finally {
        this.loading = false;
      }
    },
    async onSearch() {
      this.loading = true;
      this.offset = 0;
      try {
        const res = await axios.get(`${this.API_URL}/api/fraternity/discover`, {
          params: { user_id: this.userId, q: this.searchQuery, limit: this.limit, offset: 0 }
        });
        this.fraternities = res.data.fraternities || [];
        this.hasMore = this.fraternities.length >= this.limit;
        this.offset = this.fraternities.length;
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        this.loading = false;
      }
    },
    async loadMore() {
      this.loadingMore = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/fraternity/discover`, {
          params: { user_id: this.userId, q: this.searchQuery, limit: this.limit, offset: this.offset }
        });
        const more = res.data.fraternities || [];
        this.fraternities.push(...more);
        this.hasMore = more.length >= this.limit;
        this.offset += more.length;
      } catch (e) {
        console.error('Load more error:', e);
      } finally {
        this.loadingMore = false;
      }
    },
    setFilter(key) {
      this.activeFilter = key;
      if (key !== 'mine') this.load();
    },
    triggerEmblemUpload() {
      this.$refs.emblemInput.click();
    },
    onEmblemChange(evt) {
      const file = evt.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.form.emblem_preview = e.target.result;
        this.form.emblem = e.target.result;
      };
      reader.readAsDataURL(file);
    },
    async createFraternity() {
      if (!this.form.name.trim()) return;
      this.creating = true;
      try {
        const res = await axios.post(`${this.API_URL}/api/fraternity/create`, {
          user_id: this.userId,
          ...this.form,
          join_questions: this.form.join_questions.filter(q => q.trim())
        });
        if (res.data.success) {
          this.showCreate = false;
          this.$router.push(`/tabs/fraternity/${res.data.slug}`);
        } else {
          alert(res.data.error || 'Failed to create fraternity');
        }
      } catch (e) {
        console.error('Create error:', e);
        alert('Server error. Please try again.');
      } finally {
        this.creating = false;
      }
    }
  }
};
</script>

<style scoped>
ion-header ion-toolbar:first-child {
  --background: var(--ion-background-color);
}
.filter-tabs {
  display: flex;
  gap: 6px;
  padding: 8px 16px;
  overflow-x: auto;
  background: var(--ion-background-color);
}
.filter-tab {
  flex-shrink: 0;
  background: var(--ion-color-light, #f4f4f4);
  border: none;
  border-radius: 99px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--ion-color-medium);
  transition: all 0.2s;
}
.filter-tab.active {
  background: var(--ion-color-primary);
  color: #fff;
}
.loading-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 16px;
}
.skeleton-card {
  height: 180px;
  background: linear-gradient(90deg, #1a1a2e 25%, #252540 50%, #1a1a2e 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 20px;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.section { padding: 16px; }
.section-title {
  font-size: 18px;
  font-weight: 800;
  margin: 0 0 14px;
  color: var(--ion-text-color);
}
.frat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.empty-state {
  text-align: center;
  padding: 60px 24px;
}
.empty-icon { font-size: 48px; margin-bottom: 12px; }
.empty-state h3 { font-size: 20px; font-weight: 800; margin: 0 0 6px; }
.empty-state p { color: var(--ion-color-medium); margin: 0 0 20px; }
.load-more-wrap { text-align: center; padding: 16px; }
.create-btn { --color: var(--ion-color-primary); font-size: 22px; }
.create-modal-content { --padding-top: 0; }
.create-form { padding: 20px 16px 40px; }
.emblem-upload-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
  cursor: pointer;
}
.emblem-preview {
  width: 90px;
  height: 90px;
  border-radius: 22px;
  background: linear-gradient(135deg, var(--frat-color, #6366f1), #1a1a2e);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 900;
  color: #fff;
  overflow: hidden;
  margin-bottom: 8px;
  border: 2px dashed rgba(255,255,255,0.2);
}
.emblem-preview img { width: 100%; height: 100%; object-fit: cover; }
.upload-hint { font-size: 12px; color: var(--ion-color-medium); }
.form-item {
  --background: var(--ion-color-light, #f4f4f4);
  border-radius: 12px;
  margin-bottom: 10px;
}
.form-section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--ion-color-medium);
  margin: 16px 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.color-palette {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}
.color-swatch {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.color-swatch.active {
  transform: scale(1.25);
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px currentColor;
}
.join-method-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 4px;
}
.join-method-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--ion-color-light, #f4f4f4);
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}
.join-method-opt.active {
  border-color: var(--ion-color-primary);
  background: color-mix(in srgb, var(--ion-color-primary) 10%, transparent);
}
.jm-icon { font-size: 20px; }
.jm-label { font-size: 12px; font-weight: 600; }
.toggle-item { margin-top: 12px; }
.create-submit-btn {
  margin-top: 24px;
  --background: var(--frat-color, var(--ion-color-primary));
  --border-radius: 99px;
  height: 50px;
  font-size: 16px;
  font-weight: 700;
}
</style>

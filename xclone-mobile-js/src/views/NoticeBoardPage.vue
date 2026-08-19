<template>
  <ion-page>
    <ion-header>
      <ion-toolbar class="glass-toolbar">
        <ion-title>Notice Boards</ion-title>
        <ion-buttons slot="end" v-if="!isStandaloneMode">
          <ion-button @click="showApplyModal = true" class="apply-btn">
            <ion-icon slot="start" :icon="addOutline"></ion-icon>
            Register Org
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <ion-toolbar class="glass-toolbar">
        <ion-segment v-model="activeTab" color="gold">
          <ion-segment-button value="directory">
            <ion-label>Directory</ion-label>
          </ion-segment-button>
          <ion-segment-button value="my">
            <ion-label>My Boards</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <div class="board-directory">
        <div v-if="loading" class="loading-state">
          <ion-spinner name="crescent" color="gold"></ion-spinner>
          <p>Loading boards...</p>
        </div>

        <div v-else>
          <!-- Search Section -->
          <div class="search-section">
            <ion-searchbar 
              v-model="searchQuery" 
              placeholder="Search by name or domain..."
              class="custom-searchbar"
              debounce="300"
            ></ion-searchbar>
          </div>

          <!-- Frequently Visited (Only in Directory tab when not searching) -->
          <div v-if="activeTab === 'directory' && !searchQuery && frequentBoards.length > 0" class="frequent-section">
            <div class="section-header">
              <div class="section-title">Frequently Visited</div>
              <p class="section-desc">Notice boards you access most often.</p>
            </div>
            <div class="frequent-scroll">
              <div 
                v-for="board in frequentBoards" 
                :key="'freq-' + board.id" 
                class="freq-card"
                @click="goToBoard(board.slug)"
              >
                <img :src="board.logo_url || defaultLogo" class="freq-logo" />
                <span class="freq-name">{{ board.name }}</span>
              </div>
            </div>
          </div>

          <!-- Main List -->
          <div v-if="activeTab === 'directory'">
            <div class="section-header">
              <div class="section-title">{{ searchQuery ? 'Search Results' : 'Verified Institutions' }}</div>
              <p class="section-desc">Official announcement spaces for verified organizations.</p>
            </div>

            <div v-if="filteredDirectory.length === 0" class="empty-state">
              <ion-icon :icon="megaphoneOutline" class="empty-icon"></ion-icon>
              <p>{{ searchQuery ? 'No boards match your search.' : 'No verified organizations found yet.' }}</p>
            </div>

            <div v-else class="board-grid">
              <div 
                v-for="board in filteredDirectory" 
                :key="board.id" 
                class="board-card"
                @click="goToBoard(board.slug)"
              >
                <div class="board-header">
                  <div class="logo-wrapper">
                    <img :src="board.logo_url || defaultLogo" class="board-logo" />
                    <div class="verified-badge" v-if="board.verified">
                      <ion-icon :icon="checkmarkCircle" color="primary"></ion-icon>
                    </div>
                  </div>
                  <div class="board-info">
                    <h3>{{ board.name }}</h3>
                    <p class="domain">@{{ board.official_domain }}</p>
                  </div>
                </div>
                <div class="board-footer">
                  <span class="member-tag" v-if="board.my_membership">
                    {{ board.my_membership.status === 'approved' ? 'Member' : 'Requested' }}
                  </span>
                  <ion-icon :icon="chevronForwardOutline" class="go-icon"></ion-icon>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'my'">
            <div class="section-header">
              <div class="section-title">Your Memberships</div>
              <p class="section-desc">Notice boards you are a member of or are managing.</p>
            </div>

            <div v-if="filteredMyBoards.length === 0" class="empty-state">
              <ion-icon :icon="shieldOutline" class="empty-icon"></ion-icon>
              <p>{{ searchQuery ? 'No matching memberships.' : "You haven't joined any notice boards yet." }}</p>
              <ion-button v-if="!searchQuery" fill="clear" @click="activeTab = 'directory'" color="gold">
                Browse Directory
              </ion-button>
            </div>

            <div v-else class="board-grid">
              <div 
                v-for="board in filteredMyBoards" 
                :key="board.id" 
                class="board-card"
                @click="goToBoard(board.slug)"
              >
                <div class="board-header">
                  <img :src="board.logo_url || defaultLogo" class="board-logo" />
                  <div class="board-info">
                    <h3>{{ board.name }}</h3>
                    <p class="role-tag">{{ formatRole(board.role) }}</p>
                  </div>
                </div>
                <div class="board-footer">
                   <ion-badge color="warning" v-if="board.status === 'invited'">Invite Pending</ion-badge>
                   <ion-badge color="success" v-else-if="board.role === 'org_admin'">Admin</ion-badge>
                   <ion-icon :icon="chevronForwardOutline" class="go-icon"></ion-icon>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <OrgApplyModal 
        v-model:isOpen="showApplyModal"
        @success="handleApplySuccess"
      />
    </ion-content>
  </ion-page>
</template>

<script>
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, 
  IonSpinner, IonBadge, IonButtons, IonButton, IonIcon,
  IonSegment, IonSegmentButton, IonLabel, IonRefresher, IonRefresherContent
} from '@ionic/vue';
import { 
  addOutline, megaphoneOutline, shieldOutline, 
  checkmarkCircle, chevronForwardOutline 
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';
import { saveDirectoryOffline, getOfflineDirectory } from '@/utils/offlineDb.js';
import OrgApplyModal from '@/components/OrgApplyModal.vue';

export default {
  name: 'NoticeBoardPage',
  components: { 
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, 
    IonSpinner, IonBadge, IonButtons, IonButton, IonIcon,
    IonSegment, IonSegmentButton, IonLabel, IonRefresher, IonRefresherContent,
    OrgApplyModal
  },
  data() {
    return {
      addOutline, megaphoneOutline, shieldOutline, 
      checkmarkCircle, chevronForwardOutline,
      loading: true,
      activeTab: 'directory',
      searchQuery: '',
      directoryBoards: [],
      myBoards: [],
      showApplyModal: false,
      userId: localStorage.getItem('userId'),
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80'
    };
  },
  computed: {
    filteredDirectory() {
      if (!this.searchQuery) return this.directoryBoards;
      const q = this.searchQuery.toLowerCase();
      return this.directoryBoards.filter(b => 
        b.name.toLowerCase().includes(q) || 
        b.official_domain.toLowerCase().includes(q)
      );
    },
    filteredMyBoards() {
      if (!this.searchQuery) return this.myBoards;
      const q = this.searchQuery.toLowerCase();
      return this.myBoards.filter(b => 
        b.name.toLowerCase().includes(q)
      );
    },
    frequentBoards() {
      const stats = JSON.parse(localStorage.getItem('notice_board_visits') || '{}');
      // Sort IDs by visit count
      const sortedIds = Object.keys(stats)
        .sort((a, b) => stats[b] - stats[a])
        .slice(0, 5); // Top 5
      
      return this.directoryBoards.filter(b => sortedIds.includes(String(b.id)));
    },
    isStandaloneMode() {
      const path = this.$route?.path || '';
      return (
        Boolean(import.meta.env.VITE_STANDALONE_ORG) ||
        /^\/notices/.test(path) ||
        /^\/tabs\/notices/.test(path)
      );
    }
  },
  methods: {
    async fetchDirectory() {
      try {
        const res = await axios.get(`${this.API_URL}/api/boards`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.directoryBoards = res.data.boards;
          saveDirectoryOffline(this.directoryBoards, this.myBoards);
        }
      } catch (err) {
        console.error('Fetch directory error:', err);
        const cached = await getOfflineDirectory();
        if (cached && cached.directoryBoards && cached.directoryBoards.length > 0) {
          this.directoryBoards = cached.directoryBoards;
        }
      }
    },
    async fetchMyBoards() {
      try {
        const res = await axios.get(`${this.API_URL}/api/boards/my`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.myBoards = res.data.boards;
          saveDirectoryOffline(this.directoryBoards, this.myBoards);
        }
      } catch (err) {
        console.error('Fetch my boards error:', err);
        const cached = await getOfflineDirectory();
        if (cached && cached.myBoards && cached.myBoards.length > 0) {
          this.myBoards = cached.myBoards;
        }
      }
    },
    async loadAll() {
      this.loading = true;
      await Promise.all([this.fetchDirectory(), this.fetchMyBoards()]);
      this.loading = false;
    },
    async handleRefresh(event) {
      await this.loadAll();
      event.target.complete();
    },
    goToBoard(slug) {
      this.$router.push(`/tabs/notices/${slug}`);
    },
    formatRole(role) {
      if (!role) return '';
      return role.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },
    handleApplySuccess() {
      this.showApplyModal = false;
      this.activeTab = 'my';
      this.fetchMyBoards();
    }
  },
  mounted() {
    this.loadAll();
  }
};
</script>

<style scoped>
.glass-toolbar {
  --background: rgba(0, 0, 0, 0.7);
  --border-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px);
}

.apply-btn {
  --color: gold;
  font-weight: 600;
}

.board-directory {
  padding: 10px 20px 40px 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.search-section {
  margin-bottom: 20px;
}

.custom-searchbar {
  --background: rgba(255, 255, 255, 0.05);
  --border-radius: 12px;
  --color: white;
  --placeholder-color: rgba(255, 255, 255, 0.4);
  --icon-color: gold;
  padding: 0;
}

.frequent-section {
  margin-bottom: 30px;
}

.frequent-scroll {
  display: flex;
  gap: 15px;
  overflow-x: auto;
  padding: 10px 0;
  scrollbar-width: none;
}

.frequent-scroll::-webkit-scrollbar { display: none; }

.freq-card {
  flex: 0 0 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.freq-logo {
  width: 60px;
  height: 60px;
  border-radius: 18px;
  object-fit: cover;
  border: 2px solid rgba(212, 175, 55, 0.3);
  transition: transform 0.2s, border-color 0.2s;
}

.freq-card:hover .freq-logo {
  transform: scale(1.05);
  border-color: gold;
}

.freq-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.8;
}

.section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: gold;
  letter-spacing: -0.5px;
}

.section-desc {
  font-size: 0.85rem;
  opacity: 0.5;
  margin-top: 2px;
}

.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}

.board-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 20px;
  border: 1px solid var(--ion-border-color, #eff3f4);
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.board-card:hover {
  transform: translateY(-4px);
  border-color: #1208a1;
  box-shadow: 0 10px 24px rgba(18, 8, 161, 0.12);
}

.board-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.logo-wrapper {
  position: relative;
}

.board-logo {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.verified-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: white;
  border-radius: 50%;
  display: flex;
  font-size: 1rem;
}

.board-info h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
}

.domain {
  margin: 0;
  font-size: 0.85rem;
  opacity: 0.5;
  font-family: monospace;
}

.role-tag {
  margin: 2px 0 0 0;
  font-size: 0.8rem;
  color: gold;
  font-weight: 600;
}

.board-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.member-tag {
  font-size: 0.75rem;
  background: rgba(18, 8, 161, 0.1);
  color: gold;
  padding: 4px 10px;
  border-radius: 10px;
  font-weight: 700;
}

.go-icon {
  font-size: 1.3rem;
  opacity: 0.4;
  transition: opacity 0.2s;
}

.board-card:hover .go-icon {
  opacity: 1;
  color: gold;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  color: gold;
  opacity: 0.2;
  margin-bottom: 20px;
}

@media (max-width: 600px) {
  .board-grid {
    grid-template-columns: 1fr;
  }
}
</style>

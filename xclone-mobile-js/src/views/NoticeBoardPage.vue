<template>
  <ion-page class="dark-notice-page">
    <ion-header class="notice-header ion-no-border">
      <ion-toolbar class="header-main-toolbar">
        <ion-buttons slot="start">
          <ion-button @click="goToFeed" class="back-feed-btn" title="Back to Feed">
            <ion-icon slot="icon-only" :icon="arrowBack" class="back-feed-icon"></ion-icon>
          </ion-button>
        </ion-buttons>
        <div class="header-brand-row">
          <div class="header-title-wrap">
            <h1 class="header-main-title">Notice Boards</h1>
            <span class="header-sub-badge">NEXFI DIRECTORY</span>
          </div>
        </div>
      </ion-toolbar>

      <!-- Sleek NexFi Gold Tab Navigation Strip -->
      <div class="header-tabs-strip">
        <button 
          type="button"
          class="nav-tab-btn" 
          :class="{ active: activeTab === 'directory' }"
          @click="activeTab = 'directory'"
        >
          <ion-icon :icon="gridOutline" class="tab-icon"></ion-icon>
          <span class="tab-text">Directory</span>
          <div class="tab-indicator" v-if="activeTab === 'directory'"></div>
        </button>

        <button 
          type="button"
          class="nav-tab-btn" 
          :class="{ active: activeTab === 'my' }"
          @click="activeTab = 'my'"
        >
          <ion-icon :icon="bookmarkOutline" class="tab-icon"></ion-icon>
          <span class="tab-text">My Boards</span>
          <span v-if="myBoards.length > 0" class="tab-badge">{{ myBoards.length }}</span>
          <div class="tab-indicator" v-if="activeTab === 'my'"></div>
        </button>
      </div>
    </ion-header>

    <ion-content class="page-content">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Floating Action Button for easy 1-tap addition -->
      <ion-fab slot="fixed" vertical="bottom" horizontal="end" class="add-board-fab">
        <ion-fab-button class="gold-fab" @click="showApplyModal = true" title="Add Notice Board">
          <ion-icon :icon="addOutline"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <div class="board-directory">
        <!-- PROMINENT ADD NOTICE BOARD HERO BANNER -->
        <div class="create-board-hero" @click="showApplyModal = true">
          <div class="hero-left">
            <span class="hero-badge">NEXFI NOTICE BOARDS</span>
            <h2 class="hero-title">Create an Official Notice Board for Your Organization</h2>
            <p class="hero-desc">
              Launch a verified digital notice board for your company, institution, department, or student guild with real-time broadcast alerts and offline support.
            </p>
            <div class="hero-action-row">
              <ion-button class="hero-btn" @click.stop="showApplyModal = true">
                <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
                + Add Notice Board
              </ion-button>
              <span class="hero-subtext">Instant &amp; custom domain setup available</span>
            </div>
          </div>
          <div class="hero-graphic">
            <div class="hero-icon-bubble">
              <ion-icon :icon="businessOutline"></ion-icon>
            </div>
          </div>
        </div>

        <div v-if="loading" class="loading-state">
          <ion-spinner name="crescent" color="gold"></ion-spinner>
          <p>Loading notice boards...</p>
        </div>

        <div v-else>
          <!-- Search Section -->
          <div class="search-section">
            <ion-searchbar 
              v-model="searchQuery" 
              placeholder="Search by company, organization, department, or domain..."
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

          <!-- Directory Tab -->
          <div v-if="activeTab === 'directory'">
            <div class="section-header with-action">
              <div>
                <div class="section-title">{{ searchQuery ? 'Search Results' : 'Verified Notice Boards' }}</div>
                <p class="section-desc">Official announcement spaces for verified organizations and institutions.</p>
              </div>
              <ion-button size="small" fill="clear" color="gold" @click="showApplyModal = true" class="section-add-btn">
                <ion-icon slot="start" :icon="addOutline"></ion-icon>
                Add Board
              </ion-button>
            </div>

            <div v-if="filteredDirectory.length === 0" class="empty-state">
              <ion-icon :icon="megaphoneOutline" class="empty-icon"></ion-icon>
              <h3>{{ searchQuery ? 'No matching notice boards' : 'No verified notice boards yet' }}</h3>
              <p>{{ searchQuery ? 'Try another search term or register a board with that name.' : 'Be the first to launch an official notice board!' }}</p>
              <ion-button class="empty-create-btn" @click="showApplyModal = true">
                <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
                Create Notice Board
              </ion-button>
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
                      <ion-icon :icon="checkmarkCircle"></ion-icon>
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
                  <span class="member-tag public-tag" v-else>
                    Public Board
                  </span>
                  <ion-icon :icon="chevronForwardOutline" class="go-icon"></ion-icon>
                </div>
              </div>
            </div>
          </div>

          <!-- My Boards Tab -->
          <div v-else-if="activeTab === 'my'">
            <div class="section-header with-action">
              <div>
                <div class="section-title">Your Notice Boards &amp; Memberships</div>
                <p class="section-desc">Notice boards you manage or have joined as a member.</p>
              </div>
              <ion-button size="small" fill="outline" color="gold" @click="showApplyModal = true" class="section-add-btn">
                <ion-icon slot="start" :icon="addOutline"></ion-icon>
                + Add Board
              </ion-button>
            </div>

            <div v-if="filteredMyBoards.length === 0" class="empty-state">
              <ion-icon :icon="shieldOutline" class="empty-icon"></ion-icon>
              <h3>No Notice Boards Yet</h3>
              <p>{{ searchQuery ? 'No matching memberships found.' : "You haven't registered or joined any notice boards yet." }}</p>
              <div class="empty-actions">
                <ion-button class="empty-create-btn" fill="solid" @click="showApplyModal = true">
                  <ion-icon slot="start" :icon="addCircleOutline"></ion-icon>
                  Create a Notice Board
                </ion-button>
                <ion-button v-if="!searchQuery" fill="outline" color="light" @click="activeTab = 'directory'">
                  Browse Directory
                </ion-button>
              </div>
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

      <!-- Add Notice Board Modal -->
      <OrgApplyModal 
        v-model:isOpen="showApplyModal"
        @success="handleApplySuccess"
      />
    </ion-content>
  </ion-page>
</template>

<script>
import { 
  IonPage, IonHeader, IonToolbar, IonContent, 
  IonSpinner, IonBadge, IonButtons, IonButton, IonIcon,
  IonRefresher, IonRefresherContent,
  IonFab, IonFabButton, IonSearchbar
} from '@ionic/vue';
import { 
  addOutline, addCircleOutline, megaphoneOutline, shieldOutline, 
  checkmarkCircle, chevronForwardOutline, schoolOutline, businessOutline, searchOutline,
  gridOutline, bookmarkOutline, arrowBack
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config';
import { saveDirectoryOffline, getOfflineDirectory } from '@/utils/offlineDb.js';
import OrgApplyModal from '@/components/OrgApplyModal.vue';

export default {
  name: 'NoticeBoardPage',
  components: { 
    IonPage, IonHeader, IonToolbar, IonContent, 
    IonSpinner, IonBadge, IonButtons, IonButton, IonIcon,
    IonRefresher, IonRefresherContent,
    IonFab, IonFabButton, IonSearchbar,
    OrgApplyModal
  },
  data() {
    return {
      addOutline, addCircleOutline, megaphoneOutline, shieldOutline, 
      checkmarkCircle, chevronForwardOutline, schoolOutline, businessOutline, searchOutline,
      gridOutline, bookmarkOutline, arrowBack,
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
        (b.official_domain && b.official_domain.toLowerCase().includes(q))
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
      const sortedIds = Object.keys(stats)
        .sort((a, b) => stats[b] - stats[a])
        .slice(0, 5);
      
      return this.directoryBoards.filter(b => sortedIds.includes(String(b.id)));
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
    goToFeed() {
      this.$router.push('/tabs/feed');
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
      this.loadAll();
    }
  },
  mounted() {
    this.loadAll();
  }
};
</script>

<style scoped>
.dark-notice-page {
  --background: #0d0f18 !important;
  background: #0d0f18 !important;
}

/* ─── SLEEK NEXFI HEADER ───────────────────────────────── */
.notice-header {
  background: #0d0f18 !important;
  --background: #0d0f18 !important;
  box-shadow: none !important;
  border-bottom: 1px solid rgba(255, 215, 0, 0.2);
}

.header-main-toolbar {
  --background: #0d0f18 !important;
  --min-height: 48px;
  --padding-top: 6px;
  --padding-bottom: 4px;
  --padding-start: 12px;
  --padding-end: 16px;
  --border-width: 0 !important;
}

.back-feed-btn {
  --color: #ffd700;
  --background: rgba(255, 215, 0, 0.08);
  --border-radius: 50%;
  width: 38px;
  height: 38px;
  margin-right: 8px;
  transition: transform 0.2s, background-color 0.2s;
}

.back-feed-btn:hover {
  --background: rgba(255, 215, 0, 0.22);
  transform: translateX(-3px);
}

.back-feed-icon {
  font-size: 1.35rem;
  color: #ffd700;
}

.header-brand-row {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 4px 0;
}

.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-main-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.3px;
}

.header-sub-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: #ffd700;
  background: rgba(255, 215, 0, 0.12);
  border: 1px solid rgba(255, 215, 0, 0.3);
  padding: 2px 7px;
  border-radius: 6px;
}

/* ─── CUSTOM DARK & GOLD TAB STRIP ─────────────────────── */
.header-tabs-strip {
  display: flex;
  width: 100%;
  background: #0d0f18;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.nav-tab-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: transparent;
  border: none;
  padding: 12px 16px;
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  outline: none;
}

.nav-tab-btn .tab-icon {
  font-size: 1.1rem;
  color: #94a3b8;
  transition: color 0.2s ease;
}

.nav-tab-btn .tab-text {
  font-size: 0.92rem;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.2px;
  transition: color 0.2s ease;
}

.nav-tab-btn:hover .tab-text,
.nav-tab-btn:hover .tab-icon {
  color: #ffffff;
}

.nav-tab-btn.active .tab-icon,
.nav-tab-btn.active .tab-text {
  color: #ffd700;
  font-weight: 800;
}

.tab-badge {
  font-size: 0.7rem;
  font-weight: 800;
  color: #000000;
  background: #ffd700;
  padding: 1px 6px;
  border-radius: 10px;
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 3px;
  background: #ffd700;
  border-radius: 3px 3px 0 0;
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.7);
}

.page-content {
  --background: #0d0f18 !important;
  background: #0d0f18 !important;
}

.board-directory {
  padding: 16px 16px 80px 16px;
  max-width: 1200px;
  margin: 0 auto;
}

/* HERO BANNER - NEXFI GOLD & WHITE OVER SLEEK DARK */
.create-board-hero {
  background: linear-gradient(135deg, #171926 0%, #202234 50%, #0f101a 100%);
  border: 1px solid rgba(255, 215, 0, 0.4);
  border-radius: 20px;
  padding: 24px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  cursor: pointer;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 215, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
}

.create-board-hero:hover {
  transform: translateY(-2px);
  border-color: #ffd700;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.5), 0 0 28px rgba(255, 215, 0, 0.16);
}

.hero-left {
  flex: 1;
}

.hero-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 800;
  color: #000000;
  background: #ffd700;
  padding: 3px 10px;
  border-radius: 6px;
  letter-spacing: 0.6px;
  margin-bottom: 10px;
}

.hero-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #ffffff;
  margin: 0 0 8px 0;
  line-height: 1.3;
}

.hero-desc {
  font-size: 0.88rem;
  color: #e2e8f0;
  margin: 0 0 16px 0;
  line-height: 1.45;
  max-width: 650px;
}

.hero-action-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.hero-btn {
  --background: #ffd700;
  --color: #000000;
  font-weight: 800;
  --border-radius: 10px;
  font-size: 0.92rem;
  height: 44px;
  box-shadow: 0 4px 14px rgba(255, 215, 0, 0.35);
}

.hero-subtext {
  font-size: 0.8rem;
  color: #cbd5e1;
}

.hero-graphic {
  display: none;
}

@media (min-width: 768px) {
  .hero-graphic {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .hero-icon-bubble {
    width: 90px;
    height: 90px;
    border-radius: 26px;
    background: rgba(255, 215, 0, 0.08);
    border: 1px solid rgba(255, 215, 0, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .hero-icon-bubble ion-icon {
    font-size: 3rem;
    color: #ffd700;
  }
}

/* SEARCHBAR */
.search-section {
  margin-bottom: 24px;
}

.custom-searchbar {
  --background: #171926;
  --border-radius: 12px;
  --color: #ffffff;
  --placeholder-color: rgba(255, 255, 255, 0.5);
  --icon-color: #ffd700;
  padding: 0;
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 12px;
}

/* FREQUENT BOARDS */
.frequent-section {
  margin-bottom: 28px;
}

.frequent-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 8px 0;
  scrollbar-width: none;
}

.frequent-scroll::-webkit-scrollbar { display: none; }

.freq-card {
  flex: 0 0 90px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.freq-logo {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  object-fit: cover;
  border: 2px solid rgba(255, 215, 0, 0.4);
  transition: transform 0.2s, border-color 0.2s;
}

.freq-card:hover .freq-logo {
  transform: scale(1.05);
  border-color: #ffd700;
}

.freq-name {
  font-size: 0.75rem;
  font-weight: 600;
  text-align: center;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ffffff;
  opacity: 0.9;
}

/* SECTION HEADERS */
.section-header {
  margin-bottom: 16px;
}

.section-header.with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 1.2rem;
  font-weight: 800;
  color: #ffd700;
  letter-spacing: -0.3px;
}

.section-desc {
  font-size: 0.84rem;
  color: #cbd5e1;
  margin-top: 2px;
}

.section-add-btn {
  font-weight: 800;
  font-size: 0.84rem;
}

/* BOARD GRID */
.board-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 18px;
}

.board-card {
  background: #171926;
  border-radius: 18px;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.board-card:hover {
  transform: translateY(-4px);
  border-color: #ffd700;
  box-shadow: 0 10px 26px rgba(255, 215, 0, 0.18);
}

.board-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}

.logo-wrapper {
  position: relative;
}

.board-logo {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.verified-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: #ffd700;
  color: #000000;
  border-radius: 50%;
  display: flex;
  font-size: 1rem;
}

.board-info h3 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: #ffffff;
}

.domain {
  margin: 2px 0 0;
  font-size: 0.82rem;
  color: #ffd700;
  font-family: monospace;
}

.role-tag {
  margin: 2px 0 0 0;
  font-size: 0.8rem;
  color: #ffd700;
  font-weight: 700;
}

.board-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.member-tag {
  font-size: 0.72rem;
  background: rgba(255, 215, 0, 0.12);
  color: #ffd700;
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  border: 1px solid rgba(255, 215, 0, 0.25);
}

.member-tag.public-tag {
  background: rgba(255, 255, 255, 0.08);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.go-icon {
  font-size: 1.25rem;
  color: #ffffff;
  opacity: 0.5;
  transition: opacity 0.2s, color 0.2s;
}

.board-card:hover .go-icon {
  opacity: 1;
  color: #ffd700;
}

/* EMPTY & LOADING STATES */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 3.8rem;
  color: #ffd700;
  opacity: 0.5;
  margin-bottom: 16px;
}

.empty-state h3 {
  font-size: 1.25rem;
  font-weight: 800;
  margin: 0 0 8px;
  color: #ffffff;
}

.empty-state p {
  font-size: 0.9rem;
  color: #cbd5e1;
  max-width: 420px;
  margin: 0 0 20px;
}

.empty-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
}

.empty-create-btn {
  --background: #ffd700;
  --color: #000000;
  --border-radius: 10px;
  font-weight: 800;
  box-shadow: 0 4px 14px rgba(255, 215, 0, 0.3);
}

/* FLOATING ACTION BUTTON - NEXFI GOLD */
.add-board-fab {
  margin-bottom: 60px;
  margin-right: 12px;
}

.gold-fab {
  --background: #ffd700;
  --color: #000000;
  box-shadow: 0 6px 20px rgba(255, 215, 0, 0.45);
}

@media (max-width: 600px) {
  .board-grid {
    grid-template-columns: 1fr;
  }
  .create-board-hero {
    padding: 18px;
  }
  .hero-title {
    font-size: 1.15rem;
  }
  .hero-desc {
    font-size: 0.82rem;
  }
  .header-main-title {
    font-size: 1.2rem;
  }
}
</style>

<!-- Global override to eradicate Ionic light theme white bar leak on this view -->
<style>
ion-header.notice-header {
  background: #0d0f18 !important;
  --background: #0d0f18 !important;
}

ion-header.notice-header ion-toolbar {
  --background: #0d0f18 !important;
  background: #0d0f18 !important;
  --color: #ffffff !important;
  color: #ffffff !important;
  --border-width: 0 !important;
}

ion-header.notice-header::after {
  display: none !important;
  content: none !important;
}
</style>

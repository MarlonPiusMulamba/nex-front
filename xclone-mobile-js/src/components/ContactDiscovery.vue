<template>
  <div class="contact-discovery">
    <div class="discovery-header">
      <div class="header-content">
        <ion-icon :icon="peopleOutline" class="header-icon"></ion-icon>
        <div class="header-text">
          <h3>Find Your Friends</h3>
          <p>Connect with people from your contacts who are already on NexFi.</p>
        </div>
      </div>
      <ion-button 
        @click="syncContacts" 
        :disabled="syncing" 
        shape="round" 
        class="sync-btn"
      >
        <ion-spinner v-if="syncing" name="crescent"></ion-spinner>
        <template v-else>
          <ion-icon :icon="syncOutline" slot="start"></ion-icon>
          Sync Contacts
        </template>
      </ion-button>
    </div>

    <div v-if="discoveredUsers.length > 0" class="results-section">
      <h4 class="results-title">Friends on NexFi</h4>
      <div class="user-list">
        <div v-for="user in discoveredUsers" :key="user.id" class="user-card">
          <img 
            :src="getImageUrl(user.profile_pic)" 
            class="user-avatar" 
            @click="goToProfile(user.username)"
          />
          <div class="user-info" @click="goToProfile(user.username)">
            <div class="user-name">{{ user.display_name }}</div>
            <div class="user-handle">@{{ user.username }}</div>
            <div v-if="user.bio" class="user-bio">{{ user.bio }}</div>
          </div>
          <ion-button 
            size="small" 
            :fill="user.is_following ? 'clear' : 'solid'"
            :color="user.is_following ? 'medium' : 'primary'"
            @click="toggleFollow(user)"
            class="follow-btn"
          >
            {{ user.is_following ? 'Following' : 'Follow' }}
          </ion-button>
        </div>
      </div>
    </div>

    <div v-else-if="hasSynced && !syncing" class="empty-results">
      <div class="empty-icon">📍</div>
      <h4>No friends found yet</h4>
      <p>Tell your friends about NexFi so they can join the fraternity!</p>
      <ion-button fill="clear" size="small" @click="inviteFriends">Invite Friends</ion-button>
    </div>
  </div>
</template>

<script>
import { 
  IonButton, IonIcon, IonSpinner 
} from '@ionic/vue';
import { 
  peopleOutline, syncOutline 
} from 'ionicons/icons';
// import { Contacts } from '@capacitor-community/contacts'; // Moved to dynamic import inside syncContacts
import axios from 'axios';
import config from '@/config/index.js';

export default {
  name: 'ContactDiscovery',
  components: {
    IonButton, IonIcon, IonSpinner
  },
  data() {
    return {
      API_URL: config.api.baseURL,
      userId: localStorage.getItem('userId'),
      syncing: false,
      hasSynced: false,
      discoveredUsers: [],
      peopleOutline,
      syncOutline,
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E'
    };
  },
  async mounted() {
    this.checkAutoSync();
  },
  methods: {
    async checkAutoSync() {
      // Auto-sync every 24 hours if we have userId
      if (!this.userId) return;
      const lastSync = localStorage.getItem('last_contact_sync');
      const now = Date.now();
      const syncInterval = 24 * 60 * 60 * 1000;

      if (!lastSync || (now - parseInt(lastSync)) > syncInterval) {
        console.log("Triggering auto-sync for contacts...");
        await this.syncContacts(true); // true = silent mode
      } else {
        // Just fetch previously discovered users from backend if any
        this.fetchSuggestions();
      }
    },

    async fetchSuggestions() {
      try {
        const res = await axios.get(`${this.API_URL}/api/users/sync-contacts/results`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.discoveredUsers = res.data.users || [];
          if (this.discoveredUsers.length > 0) this.hasSynced = true;
        }
      } catch (e) {
        console.error('Fetch suggestions error:', e);
      }
    },
    getImageUrl(imageData) {
      if (!imageData) return this.defaultAvatar;
      if (imageData.startsWith('http') || imageData.startsWith('data:')) return imageData;
      return `${this.API_URL}${imageData.startsWith('/') ? '' : '/'}${imageData}`;
    },

    async syncContacts(silent = false) {
      this.syncing = true;
      try {
        let emails = [];
        let phoneNumbers = [];

        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
          // 1. Request Permission
          let Contacts;
          try {
            const mod = await import('@capacitor-community/contacts');
            Contacts = mod.Contacts;
          } catch (err) {
            console.error("Contacts plugin not installed:", err);
            if (!silent) alert("Contacts plugin not found. Please install @capacitor-community/contacts.");
            this.syncing = false;
            return;
          }

          // In silent mode, check permission first without requesting
          if (silent) {
            const status = await Contacts.checkPermissions();
            if (status.contacts !== 'granted') {
               this.syncing = false;
               return; // Exit silently
            }
          }

          const permission = await Contacts.requestPermissions();
          if (permission.contacts !== 'granted') {
            if (!silent) alert("Permission to access contacts was denied.");
            this.syncing = false;
            return;
          }

          // 2. Get Real Contacts
          const result = await Contacts.getContacts({
            projection: {
              emails: true,
              phones: true
            }
          });

          // 3. Extract emails and phones
          result.contacts.forEach(contact => {
            if (contact.emails) {
              contact.emails.forEach(e => {
                if (e.address) emails.push(e.address.toLowerCase().trim());
              });
            }
            if (contact.phones) {
              contact.phones.forEach(p => {
                if (p.number) {
                  // Basic normalization: remove spaces, dashes, etc.
                  const clean = p.number.replace(/[^0-9+]/g, '');
                  if (clean) phoneNumbers.push(clean);
                }
              });
            }
          });
        } else {
           // MOCK DATA for Web testing only
           console.warn("Using mock data on web. Use a physical device for real contact sync.");
           emails = ['test@example.com', 'friend@nexfi.com'];
           phoneNumbers = ['+256700000000', '+256788888888'];
        }

        const res = await axios.post(`${this.API_URL}/api/users/sync-contacts`, {
          user_id: this.userId,
          emails: emails,
          phone_numbers: phoneNumbers
        });

        if (res.data.success) {
          this.discoveredUsers = res.data.users || [];
          this.hasSynced = true;
          localStorage.setItem('last_contact_sync', Date.now().toString());
        }
      } catch (e) {
        console.error('Sync error:', e);
        if (!silent) alert("Failed to sync contacts. Ensure the Contacts plugin is installed.");
      } finally {
        this.syncing = false;
      }
    },

    async toggleFollow(user) {
      if (user.is_following) return; // Unfollow logic could go here
      
      try {
        const res = await axios.post(`${this.API_URL}/api/follow`, {
          follower_id: this.userId,
          following_username: user.username
        });
        if (res.data.success) {
          user.is_following = true;
        }
      } catch (e) {
        console.error('Follow error:', e);
      }
    },

    goToProfile(username) {
      this.$router.push(`/tabs/profile/${username}`);
    },

    inviteFriends() {
      // Logic to open share sheet
      alert("Sharing NexFi invite link...");
    }
  }
};
</script>

<style scoped>
.contact-discovery {
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 24px;
  padding: 20px;
  margin: 16px;
  border: 1px solid rgba(0,0,0,0.05);
}

.discovery-header {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  text-align: center;
}

.header-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 40px;
  color: var(--ion-color-primary);
  background: color-mix(in srgb, var(--ion-color-primary) 15%, transparent);
  padding: 12px;
  border-radius: 20px;
}

.header-text h3 {
  margin: 0;
  font-weight: 800;
  font-size: 18px;
}

.header-text p {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--ion-color-medium);
  line-height: 1.4;
}

.sync-btn {
  --border-radius: 99px;
  font-weight: 700;
  height: 44px;
  width: 100%;
}

.results-section {
  margin-top: 24px;
}

.results-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  margin-bottom: 12px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #fff;
  padding: 12px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.03);
}

.user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
  cursor: pointer;
}

.user-info {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.user-name {
  font-weight: 700;
  font-size: 15px;
  color: #000;
}

.user-handle {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.user-bio {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.follow-btn {
  --border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
  margin: 0;
  min-width: 80px;
}

.empty-results {
  text-align: center;
  padding: 20px 0;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
}

.empty-results h4 {
  margin: 0;
  font-weight: 700;
}

.empty-results p {
  font-size: 12px;
  color: var(--ion-color-medium);
  margin: 4px 0 12px;
}
</style>

<template>
  <ion-page>
    <ion-header class="board-header-wrapper">
      <ion-toolbar class="glass-toolbar">
        <ion-buttons slot="start" v-if="!isStandaloneMode">
          <ion-back-button default-href="/tabs/notices" class="back-btn"></ion-back-button>
        </ion-buttons>
        <div class="org-header-title centered-header" v-if="org">
          <div class="brand-title-row">
            <span class="brand-word-left">{{ orgNameFirstWord }}</span>
            <div class="mini-logo-wrap">
              <img :src="org.logo_url || defaultLogo" class="mini-logo" />
              <div class="mini-logo-ring"></div>
            </div>
            <span class="brand-word-right" v-if="orgNameRestWords">{{ orgNameRestWords }}</span>
          </div>
          <span class="board-subtitle">Digital Notice Board <template v-if="org.official_domain">• @{{ org.official_domain }}</template></span>
        </div>
        <div class="org-header-title centered-header" v-else>
          <div class="brand-title-row">
            <span class="brand-word-left">BUGEMA</span>
            <div class="mini-logo-wrap">
              <img src="/bugema-logo.png" class="mini-logo" />
              <div class="mini-logo-ring"></div>
            </div>
            <span class="brand-word-right">UNIVERSITY</span>
          </div>
          <span class="board-subtitle">Digital Notice Board • @bugemauniv.ac.ug</span>
        </div>
        <ion-buttons slot="end">
          <!-- Profile Avatar Icon (shown whenever logged in) -->
          <button 
            v-if="userId" 
            class="profile-icon-btn" 
            @click="showProfilePanel = true"
            title="My Profile"
          >
            <div class="profile-icon-wrap">
              <img 
                v-if="userProfile?.avatar_url" 
                :src="userProfile.avatar_url" 
                class="profile-thumb" 
                @error="e => e.target.style.display='none'"
              />
              <ion-icon v-else :icon="personOutline" class="profile-thumb-icon"></ion-icon>
            </div>
          </button>
          <!-- Admin settings gear -->
          <ion-button v-if="isAdmin" @click="showAdminPanel = true" class="settings-btn">
            <ion-icon slot="icon-only" :icon="settingsOutline"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      <!-- Admin tab switcher -->
      <ion-toolbar v-if="isAdmin && org && !locked" class="tab-toolbar">
        <ion-segment v-model="activeView" color="warning">
          <ion-segment-button value="notices">
            <ion-label>Notices</ion-label>
          </ion-segment-button>
          <ion-segment-button value="members">
            <ion-label>Members</ion-label>
            <ion-badge color="danger" v-if="allMembers.length > 0">{{ allMembers.length }}</ion-badge>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content class="board-content" :scroll-events="true" @ionScroll="handleScroll($event)">
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Offline Mode Banner -->
      <div v-if="isOfflineMode" class="offline-notice-banner">
        <ion-icon :icon="cloudOfflineOutline" class="offline-banner-icon"></ion-icon>
        <span>Offline Mode — Viewing cached notices</span>
      </div>

      <!-- Loading State with Centered Bugema Logo & Golden Spinner Ring -->
      <div v-if="loading && !org" class="loading-state">
        <div class="loading-logo-wrap">
          <img src="/bugema-logo.png" class="loading-center-logo" @error="e => e.target.src = defaultLogo" />
          <ion-spinner name="crescent" class="loading-spinner-ring"></ion-spinner>
        </div>
        <p class="loading-text">Loading Bugema Notice Board...</p>
      </div>

      <!-- Connection Error / Failed to Load State -->
      <div v-else-if="!org" class="locked-state" style="padding: 60px 20px; text-align: center;">
        <div class="lock-visual">
          <div class="lock-glow" style="background: rgba(239, 68, 68, 0.2);"></div>
          <div class="lock-circle" style="background: rgba(239, 68, 68, 0.15); border-color: rgba(239, 68, 68, 0.4);">
            <ion-icon :icon="alertCircleOutline" class="lock-icon" style="color: #ef4444;"></ion-icon>
          </div>
        </div>
        <h2 class="locked-title" style="color: #ef4444;">Server Connection Issue</h2>
        <p class="locked-desc">{{ errorMessage || 'Unable to connect to the Bugema Notice Board server. Please check your network connection.' }}</p>
        <div class="action-box">
          <ion-button @click="loadAll" class="join-btn" style="--background: linear-gradient(135deg, #d4af37, #ffd700); --color: #000; font-weight: 800;">
            <ion-icon :icon="refresh" slot="start"></ion-icon>
            Try Again
          </ion-button>
        </div>
      </div>

      <!-- Locked State -->
      <div v-else-if="locked" class="locked-state">
        <div class="lock-visual">
          <div class="lock-glow"></div>
          <div class="lock-circle">
            <ion-icon :icon="lockClosedOutline" class="lock-icon"></ion-icon>
          </div>
          <div class="pulse-ring ring-1"></div>
          <div class="pulse-ring ring-2"></div>
        </div>
        <h2 class="locked-title">Private Board</h2>
        <p class="locked-desc">This notice board is restricted to verified members of <strong>{{ org?.name }}</strong>.</p>
        
        <div class="action-box">
          <ion-button 
            v-if="!membership || membership.status === 'rejected'" 
            @click="requestToJoin" 
            class="join-btn"
            :disabled="joining"
          >
            <ion-spinner v-if="joining" name="crescent" style="margin-right:8px"></ion-spinner>
            <ion-icon v-else :icon="personAddOutline" slot="start"></ion-icon>
            Request Access
          </ion-button>
          
          <div v-else-if="membership.status === 'pending'" class="pending-badge">
            <ion-icon :icon="timeOutline"></ion-icon>
            <span>Awaiting Admin Approval</span>
          </div>

          <div v-else-if="membership.status === 'invited'" class="invite-box">
            <p>You have been invited to join this board.</p>
            <ion-button @click="acceptInvite" class="accept-btn">
              <ion-icon :icon="checkmarkCircle" slot="start"></ion-icon>
              Accept Invite
            </ion-button>
          </div>
        </div>
      </div>

      <!-- Board Feed -->

      <div v-else-if="isAdmin && activeView === 'members' && org && !locked" class="members-view">
        <div v-if="loadingMembers" class="members-loading">
          <ion-spinner name="crescent" color="warning"></ion-spinner>
          <p>Loading members…</p>
        </div>

        <div v-else>
          <!-- Summary bar -->
          <div class="members-summary">
            <div class="ms-pill">
              <ion-icon :icon="peopleOutline" class="ms-icon"></ion-icon>
              <span class="ms-val">{{ allMembers.length }}</span>
              <span class="ms-lab">Total Members</span>
            </div>
            <div class="ms-pill">
              <ion-icon :icon="businessOutline" class="ms-icon"></ion-icon>
              <span class="ms-val">{{ departments.length }}</span>
              <span class="ms-lab">Departments</span>
            </div>
            <div class="ms-pill">
              <ion-icon :icon="shieldCheckmarkOutline" class="ms-icon"></ion-icon>
              <span class="ms-val">{{ allMembers.filter(m => m.role === 'org_admin').length }}</span>
              <span class="ms-lab">Admins</span>
            </div>
          </div>

          <!-- Grouped by department -->
          <div
            v-for="group in membersGroupedByDept"
            :key="group.label"
            class="dept-group"
          >
            <div class="dept-group-header">
              <div class="dept-group-icon">
                <img
                  v-if="group.logo_url"
                  :src="group.logo_url.startsWith('/') ? API_URL + group.logo_url : group.logo_url"
                  class="dept-group-logo"
                  @error="e => e.target.style.display='none'"
                />
                <ion-icon v-else :icon="businessOutline"></ion-icon>
              </div>
              <div class="dept-group-info">
                <span class="dept-group-name">{{ group.label }}</span>
                <span class="dept-group-count">{{ group.members.length }} member{{ group.members.length !== 1 ? 's' : '' }}</span>
              </div>
            </div>

            <div class="member-list">
              <div
                v-for="member in group.members"
                :key="member.user_id"
                class="member-card"
              >
                <!-- Avatar + identity -->
                <div class="member-identity">
                  <div class="member-avatar-wrap">
                    <img :src="member.profile_pic || defaultAvatar" class="member-avatar" />
                    <div class="role-dot" :class="'role-dot--' + member.role"></div>
                  </div>
                  <div class="member-info">
                    <span class="member-name">
                      {{ member.first_name || member.username }}
                      {{ member.last_name || '' }}
                    </span>
                    <span class="member-handle">@{{ member.username }}</span>
                  </div>
                </div>

                <!-- Role badge -->
                <span class="role-badge" :class="'role-badge--' + member.role">
                  {{ formatRole(member.role) }}
                </span>

                <!-- Edit controls (shown when editing this member) -->
                <div v-if="editingMemberId === member.user_id" class="edit-controls">
                  <ion-select
                    v-model="editRole"
                    interface="popover"
                    placeholder="Role"
                    class="edit-select"
                  >
                    <ion-select-option value="dept_viewer">Viewer</ion-select-option>
                    <ion-select-option value="dept_manager">Manager</ion-select-option>
                    <ion-select-option value="org_admin">Admin</ion-select-option>
                  </ion-select>

                  <ion-select
                    v-model="editDeptId"
                    interface="popover"
                    placeholder="Department"
                    class="edit-select"
                  >
                    <ion-select-option :value="null">No Dept</ion-select-option>
                    <ion-select-option v-for="d in departments" :key="d.id" :value="d.id">
                      {{ d.name }}
                    </ion-select-option>
                  </ion-select>

                  <div class="edit-actions">
                    <ion-button size="small" color="warning" @click="saveRole(member.user_id)" :disabled="savingRole">
                      <ion-spinner v-if="savingRole" name="crescent" style="width:14px;height:14px"></ion-spinner>
                      <span v-else>Save</span>
                    </ion-button>
                    <ion-button size="small" fill="clear" @click="editingMemberId = null">Cancel</ion-button>
                  </div>
                </div>

                <!-- Edit trigger button -->
                <ion-button
                  v-else
                  fill="clear"
                  size="small"
                  class="edit-trigger"
                  @click="startEdit(member)"
                >
                  <ion-icon slot="icon-only" :icon="createOutline"></ion-icon>
                </ion-button>
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="allMembers.length === 0" class="members-empty">
            <ion-icon :icon="peopleOutline" class="empty-icon"></ion-icon>
            <p>No members yet. Invite people to get started.</p>
          </div>
        </div>
      </div>

      <!-- Board Feed (Notices view) — 3-column X-style layout on desktop -->
      <div v-else-if="org && !locked && activeView === 'notices'" class="board-feed">

        <!-- Pending Invitation Banner -->
        <div v-if="membership && membership.status === 'invited'" class="feed-invite-banner">
          <div class="banner-icon-wrap">
            <ion-icon :icon="mailOpenOutline" class="banner-icon"></ion-icon>
          </div>
          <div class="banner-text">
            <h4>You're Invited!</h4>
            <p>Join as {{ formatRole(membership.role) }}</p>
          </div>
          <ion-button @click="acceptInvite" class="accept-btn-sm">Accept</ion-button>
        </div>



        <!-- 3-Column Desktop Grid -->
        <div class="board-desktop-grid">

          <!-- ═══════════════════════════════════════════════════
               LEFT SIDEBAR — Departments Navigation
          ════════════════════════════════════════════════════ -->
          <aside class="dept-sidebar">

            <!-- Org identity mini card -->
            <div class="sidebar-org-card" v-if="org">
              <img :src="org.logo_url || defaultLogo" class="sidebar-org-logo" />
              <div class="sidebar-org-info">
                <span class="sidebar-org-name">{{ org.name }}</span>
                <span class="sidebar-org-domain" v-if="org.official_domain">
                  <ion-icon :icon="globeOutline"></ion-icon>
                  {{ org.official_domain }}
                </span>
              </div>
            </div>

            <!-- Departments nav -->
            <div class="sidebar-section">
              <h4 class="sidebar-section-title">
                <ion-icon :icon="businessOutline"></ion-icon>
                Departments
              </h4>
              <nav class="dept-nav">
                <!-- All Departments -->
                <button
                  class="dept-nav-item"
                  :class="{ 'dept-nav-item--active': selectedDept === null }"
                  @click="selectedDept = null; selectedCategory = 'All'"
                >
                  <div class="dept-nav-icon-wrap">
                    <ion-icon :icon="listOutline"></ion-icon>
                  </div>
                  <span class="dept-nav-label">All Departments</span>
                  <span class="dept-nav-count">{{ notices.length }}</span>
                </button>

                <!-- Individual departments -->
                <button
                  v-for="dept in departments"
                  :key="dept.id"
                  class="dept-nav-item"
                  :class="{ 'dept-nav-item--active': selectedDept === dept.id }"
                  @click="selectedDept = dept.id; selectedCategory = 'All'"
                >
                  <div class="dept-nav-icon-wrap">
                    <img
                      v-if="dept.logo_url"
                      :src="dept.logo_url.startsWith('/') ? API_URL + dept.logo_url : dept.logo_url"
                      class="dept-nav-logo"
                      @error="e => e.target.style.display='none'"
                    />
                    <ion-icon v-else :icon="businessOutline"></ion-icon>
                  </div>
                  <span class="dept-nav-label">{{ dept.name }}</span>
                  <span class="dept-nav-count">{{ noticesPerDept[dept.id] || 0 }}</span>
                </button>
              </nav>
            </div>

            <!-- Admin / Auth actions -->
            <div class="sidebar-auth-box" v-if="canPost">
              <ion-button @click="showComposer = true" expand="block" class="sidebar-post-btn">
                <ion-icon :icon="add" slot="start"></ion-icon>
                Post Notice
              </ion-button>
            </div>

          </aside>

          <!-- ═══════════════════════════════════════════════════
               MIDDLE COLUMN — Notice Feed
          ════════════════════════════════════════════════════ -->
          <main class="feed-col">

            <!-- 🔔 Floating Real-Time "New Notices" Notification Pill -->
            <transition name="pill-slide">
              <div v-if="showNewNoticesPill" class="new-notices-pill-wrap">
                <button class="new-notices-pill-btn" @click="loadPendingNoticesAndScroll">
                  <ion-icon :icon="arrowUpOutline" class="pill-icon"></ion-icon>
                  <span>{{ newNoticesCount === 1 ? '1 New Notice Posted' : `${newNoticesCount} New Notices Posted` }}</span>
                </button>
                <button class="new-notices-dismiss-btn" @click="dismissNewNoticesPill" title="Dismiss">
                  <ion-icon :icon="closeOutline"></ion-icon>
                </button>
              </div>
            </transition>

            <!-- Search & Category Filters -->
            <div class="filter-bar">
              <div class="search-wrap">
                <ion-searchbar
                  v-model="searchQuery"
                  placeholder="Search notices…"
                  class="notice-searchbar"
                ></ion-searchbar>
              </div>
              <div class="category-scroll">
                <button
                  v-for="cat in categories"
                  :key="cat"
                  class="cat-pill"
                  :class="{ 'cat-pill--active': selectedCategory === cat }"
                  @click="toggleCategory(cat)"
                >
                  <ion-icon :icon="getCategoryIcon(cat)" class="cat-icon"></ion-icon>
                  {{ cat }}
                </button>
              </div>
            </div>

            <!-- Active dept label (desktop only) -->
            <div class="active-dept-label" v-if="selectedDept">
              <ion-icon :icon="businessOutline"></ion-icon>
              <span>{{ departments.find(d => d.id === selectedDept)?.name }}</span>
              <button class="clear-dept-btn" @click="selectedDept = null">
                <ion-icon :icon="closeCircleOutline"></ion-icon>
              </button>
            </div>

            <!-- Notices List -->
            <div class="notice-list-container">
              <div v-if="fetchingNotices" class="feed-loading">
                <div class="skeleton-card" v-for="i in 4" :key="i">
                  <div class="skeleton-header">
                    <div class="skeleton-avatar"></div>
                    <div class="skeleton-lines">
                      <div class="skeleton-line w60"></div>
                      <div class="skeleton-line w40"></div>
                    </div>
                  </div>
                  <div class="skeleton-body">
                    <div class="skeleton-line w100"></div>
                    <div class="skeleton-line w80"></div>
                    <div class="skeleton-line w50"></div>
                  </div>
                </div>
              </div>

              <div v-else-if="filteredNotices.length === 0" class="empty-feed">
                <div class="empty-visual">
                  <ion-icon :icon="documentTextOutline" class="empty-icon"></ion-icon>
                </div>
                <h3 class="empty-title">{{ searchQuery ? 'No matching notices' : 'No notices published yet' }}</h3>
                <p class="empty-desc">{{ searchQuery ? 'Try adjusting your search keywords or category filters.' : 'Check back later for official announcements.' }}</p>
              </div>

              <div
                v-for="(notice, index) in filteredNotices"
                :key="notice.id"
                :id="'notice-' + notice.id"
                class="notice-card"
                :class="{
                  'notice-card--urgent': notice.category === 'Urgent',
                  'notice-card--pinned': notice.is_pinned,
                  'notice-card--academic': notice.category === 'Academic',
                  'notice-card--finance': notice.category === 'Finance',
                  'notice-card--events': notice.category === 'Events',
                }"
                :style="{ '--delay': index * 60 + 'ms' }"
              >
                <div class="pinned-bar" v-if="notice.is_pinned">
                  <ion-icon :icon="pushOutline"></ion-icon>
                  <span>Pinned Notice</span>
                </div>

                <div class="notice-header">
                  <div class="author-info">
                    <div class="avatar-wrap">
                      <img :src="getNoticeAvatar(notice)" @error="onAvatarError" class="auth-pic" />
                      <div class="avatar-ring"></div>
                    </div>
                    <div class="auth-meta">
                      <span class="auth-name">{{ notice.dept_name || notice.org_name || 'General Office' }}</span>
                    </div>
                  </div>
                  <div class="notice-badges">
                    <span class="cat-badge" :class="'cat-badge--' + (notice.category || 'general').toLowerCase()">
                      {{ notice.category || 'General' }}
                    </span>
                  </div>
                </div>

                <div class="notice-body">
                  <h3 class="notice-title">{{ notice.title }}</h3>
                  <p class="notice-text" v-html="formatNoticeBody(notice.body)" @click="handleContentClick($event)"></p>
                </div>

                <!-- ── X-style image grid ───────────────────── -->
                <div
                  v-if="notice.media_urls && notice.media_urls.length > 0"
                  class="notice-media-grid"
                  :class="`nm-count-${Math.min(notice.media_urls.length, 4)}`"
                >
                  <div
                    v-for="(url, mi) in notice.media_urls.slice(0, 4)"
                    :key="mi"
                    class="nm-cell"
                    @click="openLightbox(notice.media_urls, mi)"
                  >
                    <img :src="url" class="nm-img" loading="lazy" />
                    <div v-if="mi === 3 && notice.media_urls.length > 4" class="nm-more-overlay">
                      +{{ notice.media_urls.length - 4 }}
                    </div>
                  </div>
                </div>

                <!-- ── PDF / Doc attachment row ─────────────── -->
                <div v-if="notice.attachment_url" class="notice-attachment" @click="openAttachment(notice.attachment_url)">
                  <div class="attach-icon-wrap">
                    <ion-icon :icon="documentOutline"></ion-icon>
                  </div>
                  <span>View Official Document / Attachment</span>
                  <ion-icon :icon="chevronForwardOutline" class="attach-arrow"></ion-icon>
                </div>


                <div class="notice-footer">
                  <div class="notice-date">
                    <ion-icon :icon="timeOutline" class="date-icon"></ion-icon>
                    {{ formatDate(notice.created_at) }}
                  </div>
                  <ion-button fill="clear" size="small" v-if="isAdmin || isAuthor(notice)" @click="deleteNotice(notice.id)" class="delete-btn">
                    <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
                  </ion-button>
                </div>
              </div>

              <!-- Official Board Footer -->
              <div class="noticeboard-footer" v-if="org">
                <div class="footer-badge">
                  <ion-icon :icon="shieldCheckmarkOutline"></ion-icon>
                  <span>{{ org.name }} • Official Digital Notice Board</span>
                </div>
                <p class="footer-note">All announcements posted here are verified official institutional communications.</p>
              </div>
            </div>

          </main>

          <!-- ═══════════════════════════════════════════════════
               RIGHT SIDEBAR — High Impact Widgets
          ════════════════════════════════════════════════════ -->
          <aside class="widgets-col">

            <!-- 🚨 URGENT NOTICES CALL TO ACTION WIDGET (Max 3) -->
            <div class="widget widget--urgent-cta" v-if="urgentNotices.length > 0">
              <div class="widget-header widget-header--urgent">
                <div class="urgent-pulse-icon">
                  <ion-icon :icon="alertCircleOutline"></ion-icon>
                </div>
                <span>Urgent Announcements</span>
                <span class="widget-count urgent-count">TOP {{ Math.min(3, urgentNotices.length) }}</span>
              </div>
              <div class="widget-body">
                <div
                  v-for="n in urgentNotices.slice(0, 3)"
                  :key="'urg-' + n.id"
                  class="widget-notice-item widget-notice-item--urgent"
                  @click="scrollToNotice(n.id)"
                  title="Click to view full notice"
                >
                  <div class="wni-dot wni-dot--urgent"></div>
                  <div class="wni-info">
                    <span class="wni-title">{{ n.title }}</span>
                    <div class="wni-sub-row">
                      <span class="wni-dept">{{ n.dept_name || 'General' }}</span>
                      <span class="wni-meta">• {{ formatDate(n.created_at) }}</span>
                    </div>
                  </div>
                  <div class="wni-cta-action">
                    <span>View</span>
                    <ion-icon :icon="chevronForwardOutline"></ion-icon>
                  </div>
                </div>
              </div>
            </div>

            <!-- 📌 PINNED NOTICES WIDGET (24 Hours Expiry - Status Style) -->
            <div class="widget widget--pinned" v-if="pinnedNotices.length > 0">
              <div class="widget-header">
                <ion-icon :icon="pushOutline"></ion-icon>
                <span>Active Status (24h)</span>
                <span class="widget-count">{{ pinnedNotices.length }}</span>
              </div>
              <div class="widget-body">
                <div
                  v-for="n in pinnedNotices.slice(0, 5)"
                  :key="'pin-' + n.id"
                  class="widget-notice-item widget-notice-item--pinned"
                  @click="scrollToNotice(n.id)"
                  title="Click to view full notice"
                >
                  <div class="status-ring-wrap">
                    <img :src="getNoticeAvatar(n)" @error="onAvatarError" class="status-avatar" />
                    <div class="status-ring"></div>
                  </div>
                  <div class="wni-info">
                    <span class="wni-title">{{ n.title }}</span>
                    <span class="wni-meta">24h Status • {{ formatDate(n.created_at) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 🕐 RECENT NOTICES WIDGET (Top 5 Bulletins) -->
            <div class="widget widget--recent">
              <div class="widget-header">
                <ion-icon :icon="timeOutline"></ion-icon>
                <span>Recent Bulletins</span>
                <span class="widget-count" v-if="recentNotices.length > 0">{{ Math.min(5, recentNotices.length) }}</span>
              </div>
              <div class="widget-body">
                <div
                  v-for="n in recentNotices.slice(0, 5)"
                  :key="'rec-' + n.id"
                  class="widget-notice-item"
                  @click="scrollToNotice(n.id)"
                  title="Click to view full notice"
                >
                  <div class="wni-dot"></div>
                  <div class="wni-info">
                    <span class="wni-title">{{ n.title }}</span>
                    <div class="wni-sub-row">
                      <span class="wni-dept">{{ n.dept_name || 'General' }}</span>
                      <span class="wni-meta">• {{ formatDate(n.created_at) }}</span>
                    </div>
                  </div>
                </div>
                <div v-if="recentNotices.length === 0" class="widget-empty">
                  No recent notices published yet.
                </div>
              </div>
            </div>

          </aside>
        </div>

        <!-- 📱 Static Mobile Bottom Navigation Bar (X-Style) -->
        <nav class="mobile-bottom-nav">
          <!-- All Notices (Home) -->
          <button 
            class="mobile-nav-btn"
            :class="{ 'mobile-nav-btn--active': selectedCategory === 'All' && !selectedDept }"
            @click="goHomeNotices"
          >
            <ion-icon :icon="listOutline"></ion-icon>
            <span>Notices</span>
          </button>

          <!-- Urgent Notices with Red Count Badge -->
          <button 
            class="mobile-nav-btn"
            :class="{ 'mobile-nav-btn--active': selectedCategory === 'Urgent' }"
            @click="goUrgentNotices"
          >
            <div class="nav-badge-wrap">
              <ion-icon :icon="alertCircleOutline" class="urgent-nav-icon"></ion-icon>
              <span class="nav-red-badge" v-if="urgentNotices.length > 0">{{ urgentNotices.length }}</span>
            </div>
            <span>Urgent</span>
          </button>

          <!-- Department Quick Switcher -->
          <div class="mobile-nav-btn dept-nav-select-wrap" :class="{ 'mobile-nav-btn--active': selectedDept !== null }">
            <ion-icon :icon="businessOutline"></ion-icon>
            <span>{{ selectedDept ? (departments.find(d=>d.id===selectedDept)?.name || 'Dept') : 'Depts' }}</span>
            <ion-select 
              v-model="selectedDept" 
              interface="popover" 
              placeholder="Dept"
              class="mobile-overlay-select"
            >
              <ion-select-option :value="null">All Departments</ion-select-option>
              <ion-select-option 
                v-for="dept in departments" 
                :key="dept.id" 
                :value="dept.id"
              >
                {{ dept.name }}
              </ion-select-option>
            </ion-select>
          </div>

          <!-- Post Notice (Admins/Managers only) -->
          <button v-if="canPost" class="mobile-nav-btn mobile-post-nav-btn" @click="showComposer = true">
            <div class="post-icon-wrap">
              <ion-icon :icon="add"></ion-icon>
            </div>
            <span>Post</span>
          </button>
        </nav>
      </div>

      <!-- Admin Panel Modal -->
      <OrgAdminPanel 
        v-if="org"
        v-model:isOpen="showAdminPanel"
        :org="org"
        :membership="membership"
        @refresh="loadAll"
      />

      <!-- Notice Composer Modal -->
      <NoticeComposerModal 
        v-if="org"
        v-model:isOpen="showComposer"
        :org="org"
        :membership="membership"
        :departments="departments"
        @success="fetchNotices"
      />

      <!-- 👤 Profile Panel (slide-in from right) -->
      <Teleport to="body">
        <div v-if="showProfilePanel" class="profile-panel-overlay" @click.self="showProfilePanel = false">
          <div class="profile-panel">
            <div class="profile-panel-header">
              <button class="profile-panel-close" @click="showProfilePanel = false">
                <ion-icon :icon="closeCircleOutline"></ion-icon>
              </button>
            </div>
            <div class="profile-panel-body">
              <!-- Avatar -->
              <div class="profile-avatar-area">
                <div class="profile-big-avatar">
                  <img 
                    v-if="userProfile?.avatar_url" 
                    :src="userProfile.avatar_url" 
                    class="profile-big-img"
                    @error="e => e.target.style.display='none'"
                  />
                  <ion-icon v-else :icon="personOutline" class="profile-big-icon"></ion-icon>
                </div>
              </div>
              <!-- User Info -->
              <div class="profile-info-area">
                <h2 class="profile-display-name">
                  {{ userProfile?.first_name ? `${userProfile.first_name} ${userProfile.last_name || ''}` : (userProfile?.username || username || 'User') }}
                </h2>
                <span class="profile-username" v-if="userProfile?.username || username">@{{ userProfile?.username || username }}</span>
                <span class="profile-email" v-if="userProfile?.email">{{ userProfile.email }}</span>
              </div>

              <!-- Membership Details Card: Role & Department -->
              <div class="profile-details-card" v-if="membership">
                <div class="profile-detail-item">
                  <span class="detail-label">Role</span>
                  <span class="detail-value role-value">{{ formatRole(membership.role) }}</span>
                </div>
                <div class="profile-detail-item">
                  <span class="detail-label">Department</span>
                  <span class="detail-value">{{ userDeptName }}</span>
                </div>
                <div class="profile-detail-item" v-if="org?.name">
                  <span class="detail-label">Board</span>
                  <span class="detail-value">{{ org.name }}</span>
                </div>
              </div>

              <!-- Logout Action Button -->
              <div class="profile-actions">
                <button class="profile-action-btn profile-action-btn--danger" @click="signOut">
                  <ion-icon :icon="logInOutline" style="transform: rotate(180deg)"></ion-icon>
                  Log Out / Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </ion-content>

    <!-- Fixed notice post button — teleported to body so it's never clipped by ion-page -->
    <Teleport to="body">
      <button v-if="canPost" class="notice-post-btn" @click="showComposer = true">
        <ion-icon :icon="add"></ion-icon>
      </button>
    </Teleport>

    <!-- ── Lightbox overlay ────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="lightbox.show" class="lightbox-overlay" @click.self="closeLightbox">
        <!-- Close button -->
        <button class="lb-close" @click="closeLightbox">
          <ion-icon :icon="closeCircle"></ion-icon>
        </button>
        <!-- Counter -->
        <div class="lb-counter" v-if="lightbox.images.length > 1">
          {{ lightbox.index + 1 }} / {{ lightbox.images.length }}
        </div>
        <!-- Image -->
        <img :src="lightbox.images[lightbox.index]" class="lb-img" />
        <!-- Prev/Next -->
        <button v-if="lightbox.index > 0" class="lb-nav lb-nav--prev" @click="lightboxPrev">&#8249;</button>
        <button v-if="lightbox.index < lightbox.images.length - 1" class="lb-nav lb-nav--next" @click="lightboxNext">&#8250;</button>
      </div>
    </Teleport>

  </ion-page>
</template>

<script>
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonBackButton, IonSpinner, IonButton, IonIcon, IonBadge, IonChip,
  IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
  IonLabel, IonSearchbar, alertController, toastController
} from '@ionic/vue';
import { 
  settingsOutline, lockClosedOutline, megaphoneOutline, 
  attachOutline, timeOutline, checkmarkCircle, documentTextOutline,
  pushOutline, trashOutline, add, personAddOutline, globeOutline,
  shieldCheckmarkOutline, mailOpenOutline, personOutline,
  chevronForwardOutline, alertCircleOutline, schoolOutline,
  cashOutline, calendarOutline, listOutline,
  createOutline, peopleOutline, businessOutline, logInOutline, searchOutline,
  closeCircleOutline, documentOutline, closeCircle, expandOutline,
  arrowUpOutline, closeOutline, refresh, cloudOfflineOutline
} from 'ionicons/icons';
import api from '@/utils/api.js';
import config from '@/config';
import { saveBoardOffline, getOfflineBoard } from '@/utils/offlineDb.js';
import OrgAdminPanel from '../components/OrgAdminPanel.vue';
import NoticeComposerModal from '../components/NoticeComposerModal.vue';

export default {
  name: 'OrgBoardPage',
  components: { 
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonBackButton, IonSpinner, IonButton, IonIcon, IonBadge, IonChip,
    IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
    IonLabel, IonSearchbar,
    OrgAdminPanel,
    NoticeComposerModal
  },
  data() {
    return {
      settingsOutline, lockClosedOutline, megaphoneOutline, attachOutline,
      timeOutline, checkmarkCircle, documentTextOutline, pushOutline,
      trashOutline, add, personAddOutline, globeOutline,
      shieldCheckmarkOutline, mailOpenOutline, personOutline,
      chevronForwardOutline, alertCircleOutline, schoolOutline,
      cashOutline, calendarOutline, listOutline,
      createOutline, peopleOutline, businessOutline, logInOutline, searchOutline,
      closeCircleOutline, documentOutline, closeCircle, expandOutline, arrowUpOutline, closeOutline, refresh, cloudOfflineOutline,
      isOfflineMode: false,
      newNoticesCount: 0,
      pendingNotices: [],
      showNewNoticesPill: false,
      isScrolledDown: false,
      lightbox: { show: false, images: [], index: 0 },
      searchQuery: '',
      activeView: 'notices',
      allMembers: [],
      loadingMembers: false,
      editingMemberId: null,
      editRole: null,
      editDeptId: null,
      savingRole: false,
      loading: true,
      org: null,
      notices: [],
      allNotices: [],
      membership: null,
      departments: [],
      locked: false,
      joining: false,
      selectedCategory: 'All',
      selectedDept: null,
      categories: ['All', 'General', 'Academic', 'Finance', 'Events', 'Urgent'],
      showAdminPanel: false,
      showComposer: false,
      showProfilePanel: false,
      userProfile: null,
      userId: localStorage.getItem('userId'),
      username: localStorage.getItem('username'),
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80',
      defaultAvatar: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjZjNmNGY2Ii8+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiByeD0iMTgiIHN0cm9rZT0iI2RhYTUyMCIgc3Ryb2tlLXdpZHRoPSIzIiBzdHJva2Utb3BhY2l0eT0iMC40IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTUwIDIyTDIwIDM4djhoNjB2LThMNTAgMjJ6bS0yMiAyNnYyNGg4VjQ4aC04em0xNSAwdjI0aDhWNDhoLTh6bTE1IDB2MjRoOFY0OGgtOHptMTUgMHYyNGg4VjQ4aC04ek0xNiA3NnY2aDY4di02SDE2eiIgZmlsbD0iI2RhYTUyMCIvPjwvc3ZnPg==',
      fetchingNotices: false,
      originalFavicon: null,
      originalTitle: '',
      errorMessage: null,
      _pollInterval: null,
      _lastKnownNoticeId: null,
    };
  },
  computed: {
    orgNameFirstWord() {
      if (!this.org?.name) return 'BUGEMA';
      const parts = this.org.name.trim().split(/\s+/);
      return parts[0].toUpperCase();
    },
    orgNameRestWords() {
      if (!this.org?.name) return 'UNIVERSITY';
      const parts = this.org.name.trim().split(/\s+/);
      return parts.length > 1 ? parts.slice(1).join(' ').toUpperCase() : '';
    },
    userDeptName() {
      if (this.membership?.dept_name) return this.membership.dept_name;
      if (this.membership?.dept_id) {
        const d = (this.departments || []).find(x => String(x.id) === String(this.membership.dept_id));
        if (d) return d.name;
      }
      if (this.userProfile?.dept_name) return this.userProfile.dept_name;
      return 'General Board';
    },
    isAdmin() {
      return this.membership?.role === 'org_admin';
    },
    canPost() {
      return ['org_admin', 'dept_manager'].includes(this.membership?.role);
    },
    filteredNotices() {
      let list = this.allNotices.length ? this.allNotices : (this.notices || []);
      // Filter by selected department
      if (this.selectedDept) {
        list = list.filter(n => n.dept_id === this.selectedDept);
      }
      // Filter by selected category
      if (this.selectedCategory && this.selectedCategory !== 'All') {
        list = list.filter(n => n.category === this.selectedCategory);
      }
      // Filter by search query
      if (this.searchQuery && this.searchQuery.trim()) {
        const q = this.searchQuery.toLowerCase().trim();
        list = list.filter(n =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.body && n.body.toLowerCase().includes(q)) ||
          (n.dept_name && n.dept_name.toLowerCase().includes(q)) ||
          (n.author_username && n.author_username.toLowerCase().includes(q)) ||
          (n.category && n.category.toLowerCase().includes(q))
        );
      }
      return list;
    },
    isStandaloneMode() {
      const path = this.$route?.path || '';
      return (
        Boolean(import.meta.env.VITE_STANDALONE_ORG) ||
        /^\/notices/.test(path) ||
        /^\/tabs\/notices/.test(path)
      );
    },
    membersGroupedByDept() {
      const groups = {};
      // Build a fast dept-id → logo_url lookup
      const deptLogoMap = {};
      this.departments.forEach(d => { deptLogoMap[d.name] = d.logo_url || null; });
      // First pass: build dept groups
      this.allMembers.forEach(m => {
        const key = m.dept_name || '__none__';
        const label = m.dept_name || 'General / No Department';
        if (!groups[key]) {
          groups[key] = {
            label,
            logo_url: m.dept_name ? (deptLogoMap[m.dept_name] || null) : null,
            members: []
          };
        }
        groups[key].members.push(m);
      });
      // Sort: named depts first, then "no dept"
      return Object.values(groups).sort((a, b) => {
        if (a.label === 'General / No Department') return 1;
        if (b.label === 'General / No Department') return -1;
        return a.label.localeCompare(b.label);
      });
    },
    urgentNotices() {
      return (this.allNotices.length ? this.allNotices : this.notices)
        .filter(n => n.category === 'Urgent')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    pinnedNotices() {
      const now = new Date().getTime();
      const DAY_MS = 24 * 60 * 60 * 1000;
      return (this.allNotices.length ? this.allNotices : this.notices)
        .filter(n => n.is_pinned && (now - new Date(n.created_at).getTime()) <= DAY_MS)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    recentNotices() {
      return [...(this.allNotices.length ? this.allNotices : this.notices)]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    academicNotices() {
      return (this.allNotices.length ? this.allNotices : this.notices)
        .filter(n => n.category === 'Academic')
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    noticesPerDept() {
      const map = {};
      (this.allNotices.length ? this.allNotices : this.notices).forEach(n => {
        if (n.dept_id) map[n.dept_id] = (map[n.dept_id] || 0) + 1;
      });
      return map;
    },
  },
  watch: {
    '$route'(to, from) {
      this.refreshAuthState();
    },
    selectedCategory() { this.fetchNotices(); },
    activeView(val) {
      if (val === 'members' && this.isAdmin && this.allMembers.length === 0) {
        this.fetchMembers();
      }
    }
  },
  methods: {
    handleScroll(event) {
      const scrollTop = event?.detail?.scrollTop || window.scrollY || document.documentElement.scrollTop || 0;
      this.isScrolledDown = scrollTop > 100;
      if (!this.isScrolledDown && this.showNewNoticesPill && this.pendingNotices.length > 0) {
        this.loadPendingNoticesAndScroll();
      }
    },
    handleSocketNoticeNew(payload) {
      if (!payload) return;
      const currentSlug = this.$route?.params?.slug || this.org?.slug || import.meta.env.VITE_STANDALONE_ORG || 'bugema';
      if (payload.org_slug && payload.org_slug !== currentSlug) return;

      console.log('📢 OrgBoardPage received live notice:new payload:', payload);
      const newNotice = payload.notice || null;

      if (this.isScrolledDown) {
        this.newNoticesCount++;
        if (newNotice) {
          const exists = this.pendingNotices.some(n => n.id === newNotice.id);
          if (!exists) this.pendingNotices.unshift(newNotice);
        }
        this.showNewNoticesPill = true;
      } else {
        if (newNotice) {
          const exists = this.allNotices.some(n => n.id === newNotice.id);
          if (!exists) {
            this.allNotices.unshift(newNotice);
            if (!this.notices.some(n => n.id === newNotice.id)) {
              this.notices.unshift(newNotice);
            }
          }
        }
        this.fetchNoticesSilent();
        this.newNoticesCount = 0;
        this.pendingNotices = [];
        this.showNewNoticesPill = false;
      }
    },
    handleSocketNoticeDelete(payload) {
      if (!payload || !payload.notice_id) return;
      const id = payload.notice_id;
      this.allNotices = this.allNotices.filter(n => n.id !== id);
      this.notices = this.notices.filter(n => n.id !== id);
      this.pendingNotices = this.pendingNotices.filter(n => n.id !== id);
      if (this.pendingNotices.length === 0) {
        this.newNoticesCount = 0;
        this.showNewNoticesPill = false;
      }
    },
    handleSocketNoticePin(payload) {
      if (!payload || !payload.notice_id) return;
      const item = this.allNotices.find(n => n.id === payload.notice_id);
      if (item) item.is_pinned = payload.pin;
    },
    async fetchNoticesSilent() {
      if (this.locked || !this.org) return;
      try {
        const res = await api.get(`/api/boards/${this.org.slug}/notices`, {
          params: { user_id: this.userId, category: null, dept_id: null }
        });
        if (res.data.success) {
          this.notices = res.data.notices || [];
          this.allNotices = res.data.notices || [];
          this.isOfflineMode = false;
          saveBoardOffline(this.org.slug, {
            org: this.org,
            membership: this.membership,
            locked: this.locked,
            notices: this.notices,
            departments: this.departments
          });
        }
      } catch (err) {
        console.error('Silent fetch notices error:', err);
      }
    },
    loadPendingNoticesAndScroll() {
      if (this.pendingNotices.length > 0) {
        this.pendingNotices.forEach(n => {
          if (!this.allNotices.some(x => x.id === n.id)) {
            this.allNotices.unshift(n);
          }
          if (!this.notices.some(x => x.id === n.id)) {
            this.notices.unshift(n);
          }
        });
        const firstId = this.pendingNotices[0]?.id;
        this.pendingNotices = [];
        this.newNoticesCount = 0;
        this.showNewNoticesPill = false;

        this.scrollToTop();
        if (firstId) {
          this.$nextTick(() => this.scrollToNotice(firstId));
        }
      } else {
        this.fetchNoticesSilent();
        this.newNoticesCount = 0;
        this.showNewNoticesPill = false;
        this.scrollToTop();
      }
    },
    dismissNewNoticesPill() {
      this.showNewNoticesPill = false;
    },
    scrollToTop() {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const contentEl = document.querySelector('ion-content');
      if (contentEl && contentEl.scrollToTop) {
        contentEl.scrollToTop(300);
      }
    },
    formatNoticeBody(text) {
      if (!text) return '';

      // Step 1: HTML-escape the entire text first to prevent XSS
      const escapeHtml = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const escaped = escapeHtml(text);

      // Step 2: Convert newlines to <br> ONCE across the whole string.
      // (Previously the split/map approach could convert \n → <br> twice:
      //  once in the whitespace-token branch AND again in the word fallback,
      //  which caused the visible double-spacing after posting.)
      const withBreaks = escaped.replace(/\n/g, '<br>');

      // Step 3: Inline URL / hashtag / mention decoration on each word.
      // We split on spaces only (not \n, already converted) so we don't
      // accidentally fragment <br> tags.
      const urlRegex =
        /^(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\/[^\s]*)?)$/i;

      return withBreaks
        .split(' ')
        .map((word) => {
          // Each 'word' may still contain <br> from Step 2 — keep those intact
          if (!word || word === '<br>') return word;

          let mainToken = word;
          let trailingPunct = '';
          const punctMatch = word.match(/^(.+?)([.,!?:;)\]]+)$/);
          if (punctMatch && urlRegex.test(punctMatch[1])) {
            mainToken = punctMatch[1];
            trailingPunct = punctMatch[2];
          }

          if (urlRegex.test(mainToken) && !mainToken.startsWith('@') && !mainToken.startsWith('#')) {
            const href = mainToken.startsWith('http://') || mainToken.startsWith('https://')
              ? mainToken
              : `https://${mainToken}`;
            return `<a href="${href}" class="post-link notice-link" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${mainToken}</a>${trailingPunct}`;
          }

          if (mainToken.startsWith('#') && mainToken.length > 1) {
            return `<span class="hashtag" data-hashtag="${mainToken}" style="color:#daa520;font-weight:600;cursor:pointer">${mainToken}</span>${trailingPunct}`;
          }

          if (mainToken.startsWith('@') && mainToken.length > 1) {
            const username = mainToken.slice(1);
            return `<span class="mention" data-mention="${username}" style="color:#daa520;font-weight:600;cursor:pointer">${mainToken}</span>${trailingPunct}`;
          }

          return word;
        })
        .join(' ');
    },
    handleContentClick(event) {
      const target = event.target.closest('a');
      if (target) {
        event.stopPropagation();
      }
    },
    refreshAuthState() {
      const currentUserId = localStorage.getItem('userId');
      const currentUsername = localStorage.getItem('username');
      if (currentUserId !== this.userId || currentUsername !== this.username || !this.org) {
        this.userId = currentUserId;
        this.username = currentUsername;
        this.loadAll();
      }
    },
    async loadAll() {
      this.loading = true;
      this.errorMessage = null;
      const slug = this.$route?.params?.slug || import.meta.env.VITE_STANDALONE_ORG || 'bugema';
      try {
        const res = await api.get(`/api/boards/${slug}`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.org = res.data.org;
          this.membership = res.data.org.my_membership;
          this.locked = res.data.locked;
          this.notices = res.data.notices || [];
          this.allNotices = res.data.notices || [];
          this.departments = res.data.departments || [];
          this.isOfflineMode = false;
          this.trackVisit();
          // Save to offline storage
          saveBoardOffline(slug, {
            org: this.org,
            membership: this.membership,
            locked: this.locked,
            notices: this.notices,
            departments: this.departments
          });
          // Update browser tab favicon and title to org branding
          this.updateDynamicFaviconAndTitle(this.org);
          // Fetch logged-in user profile if signed in
          if (this.userId) this.fetchUserProfile();
          // Pre-load members if admin
          if (this.membership?.role === 'org_admin') {
            this.fetchMembers();
          }
        }
      } catch (err) {
        console.error('Load board error:', err);
        // Offline / network failure fallback: Load cached notices from offline storage
        const cached = await getOfflineBoard(slug);
        if (cached && cached.org) {
          console.log(`📦 Loaded notice board '${slug}' from offline cache`);
          this.org = cached.org;
          this.membership = cached.membership;
          this.locked = cached.locked || false;
          this.notices = cached.notices || [];
          this.allNotices = cached.notices || [];
          this.departments = cached.departments || [];
          this.isOfflineMode = true;
          this.errorMessage = null;
        } else {
          const detail = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Network error';
          const activeUrl = api?.defaults?.baseURL || 'https://ssp.bugemauniv.ac.ug';
          this.errorMessage = `${detail} (Backend: ${activeUrl})`;
        }
      } finally {
        this.loading = false;
      }
    },
    async fetchMembers() {
      this.loadingMembers = true;
      try {
        const res = await api.get(`/api/boards/${this.org.slug}/members`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          this.allMembers = res.data.members;
        }
      } catch (err) {
        console.error('Fetch members error:', err);
      } finally {
        this.loadingMembers = false;
      }
    },
    startEdit(member) {
      this.editingMemberId = member.user_id;
      this.editRole = member.role;
      this.editDeptId = member.dept_id || null;
    },
    async saveRole(userId) {
      this.savingRole = true;
      try {
        const res = await api.patch(
          `/api/boards/${this.org.slug}/members/${userId}/role`,
          { user_id: this.userId, role: this.editRole, dept_id: this.editDeptId }
        );
        if (res.data.success) {
          // Update local state
          const m = this.allMembers.find(x => x.user_id === userId);
          if (m) {
            m.role = this.editRole;
            m.dept_id = this.editDeptId;
            const dept = this.departments.find(d => d.id === this.editDeptId);
            m.dept_name = dept ? dept.name : null;
          }
          this.editingMemberId = null;
          const toast = await toastController.create({ message: 'Role updated!', duration: 1800, color: 'success', position: 'bottom' });
          await toast.present();
        }
      } catch (err) {
        const toast = await toastController.create({ message: 'Failed to update role.', duration: 2000, color: 'danger', position: 'bottom' });
        await toast.present();
      } finally {
        this.savingRole = false;
      }
    },
    trackVisit() {
      if (!this.org) return;
      const stats = JSON.parse(localStorage.getItem('notice_board_visits') || '{}');
      const id = String(this.org.id);
      stats[id] = (stats[id] || 0) + 1;
      localStorage.setItem('notice_board_visits', JSON.stringify(stats));
    },
    async fetchNotices() {
      if (this.locked) return;
      this.fetchingNotices = true;
      try {
        // Always fetch all notices (filtering is done client-side)
        const res = await api.get(`/api/boards/${this.org.slug}/notices`, {
          params: { 
            user_id: this.userId,
            category: null,  // fetch all categories; client-side filter handles it
            dept_id: null     // fetch all depts; client-side filter handles it
          }
        });
        if (res.data.success) {
          this.notices = res.data.notices;
          this.allNotices = res.data.notices;
        }
      } catch (err) {
        console.error('Fetch notices error:', err);
      } finally {
        this.fetchingNotices = false;
      }
    },
    async handleRefresh(event) {
      await this.loadAll();
      event.target.complete();
    },
    async requestToJoin() {
      this.joining = true;
      try {
        const res = await api.post(`/api/boards/${this.org.slug}/join`, {
          user_id: this.userId
        });
        if (res.data.success) {
          if (res.data.status === 'approved') {
            this.loadAll();
          } else {
             this.membership = { status: 'pending' };
          }
        }
      } catch (err) {
        alert('Failed to send request');
      } finally {
        this.joining = false;
      }
    },
    async acceptInvite() {
      try {
        const res = await api.post(`/api/boards/${this.org.slug}/accept-invite`, {
          user_id: this.userId
        });
        if (res.data.success) {
          this.loadAll();
        }
      } catch (err) {
        alert('Failed to accept invite');
      }
    },
    async deleteNotice(id) {
      const alert = await alertController.create({
        header: 'Delete Notice',
        message: 'Are you sure you want to permanently delete this notice?',
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Delete',
            role: 'destructive',
            handler: () => {
              // Trigger deletion and return synchronously so Ionic dismisses the alert immediately
              this.performDeleteNotice(id);
            }
          }
        ]
      });
      await alert.present();
    },
    async performDeleteNotice(id) {
      // Optimistic deletion: remove from local state immediately
      const prevNotices = [...this.notices];
      const prevAllNotices = [...this.allNotices];

      this.notices = this.notices.filter(n => n.id !== id);
      this.allNotices = this.allNotices.filter(n => n.id !== id);

      try {
        const res = await api.delete(`${this.API_URL}/api/boards/notices/${id}`, {
          params: { user_id: this.userId }
        });
        if (res.data.success) {
          const toast = await toastController.create({
            message: 'Notice deleted successfully.',
            duration: 2000,
            color: 'success',
            position: 'bottom'
          });
          await toast.present();
        } else {
          // Revert optimistic delete if server rejected request
          this.notices = prevNotices;
          this.allNotices = prevAllNotices;
          const toast = await toastController.create({
            message: res.data.error || 'Could not delete notice.',
            duration: 3000,
            color: 'danger',
            position: 'bottom'
          });
          await toast.present();
        }
      } catch (err) {
        // Revert optimistic delete on network error
        this.notices = prevNotices;
        this.allNotices = prevAllNotices;
        const msg = err.response?.data?.error || err.message || 'Delete failed';
        const toast = await toastController.create({
          message: 'Error: ' + msg,
          duration: 3000,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    },
    toggleCategory(cat) {
      this.selectedCategory = cat;
    },
    getCategoryIcon(cat) {
      const icons = {
        'All': this.listOutline,
        'General': this.megaphoneOutline,
        'Academic': this.schoolOutline,
        'Finance': this.cashOutline,
        'Events': this.calendarOutline,
        'Urgent': this.alertCircleOutline,
      };
      return icons[cat] || this.listOutline;
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
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },
    openAttachment(url) {
      window.open(url, '_blank');
    },
    openLightbox(images, index = 0) {
      this.lightbox = { show: true, images: images || [], index };
    },
    lightboxPrev() {
      if (this.lightbox.index > 0) this.lightbox.index--;
    },
    lightboxNext() {
      if (this.lightbox.index < this.lightbox.images.length - 1) this.lightbox.index++;
    },
    closeLightbox() {
      this.lightbox.show = false;
    },
    isAuthor(notice) {
      return String(notice.author_id) === String(this.userId);
    },
    goToLogin() {
      const slug = this.$route?.params?.slug || 'bugema';
      const isTabs = this.$route?.path?.includes('/tabs/');
      const targetPath = isTabs ? `/tabs/notices/${slug}/login` : `/notices/${slug}/login`;
      this.$router.push(targetPath);
    },
    updateDynamicFaviconAndTitle(org) {
      if (!org) return;
      this.originalTitle = document.title;
      document.title = `${org.name} - Digital Notice Board`;

      const logo = org.logo_url || this.defaultLogo;
      let link = document.querySelector("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'shortcut icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      this.originalFavicon = link.href;
      link.href = logo;
    },
    restoreFaviconAndTitle() {
      if (this.originalTitle) document.title = this.originalTitle;
      if (this.originalFavicon) {
        const link = document.querySelector("link[rel*='icon']");
        if (link) link.href = this.originalFavicon;
      }
    },
    formatRole(role) {
      if (!role) return '';
      return role.replace('dept_', '').replace('org_', '').toUpperCase();
    },
    async fetchUserProfile() {
      if (!this.userId) return;
      try {
        const res = await api.get(`/api/profile/${this.userId}`);
        if (res.data.user) {
          this.userProfile = res.data.user;
        }
      } catch (err) {
        // Profile fetch is non-critical; silently ignore
      }
    },
    signOut() {
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      this.userId = null;
      this.username = null;
      this.userProfile = null;
      this.membership = null;
      this.showProfilePanel = false;
      // Reload the board as a guest
      this.loadAll();
    },
    getNoticeAvatar(notice) {
      // Prefer department logo when the notice belongs to a dept
      if (notice && notice.dept_logo) {
        let url = notice.dept_logo;
        if (url.startsWith('/')) url = `${this.API_URL}${url}`;
        return url;
      }
      if (!notice || !notice.author_avatar) return this.defaultAvatar;
      let url = notice.author_avatar;
      if (url.startsWith('/')) url = `${this.API_URL}${url}`;
      return url;
    },
    onAvatarError(event) {
      if (event && event.target) {
        event.target.src = this.defaultAvatar;
      }
    },
    goHomeNotices() {
      this.selectedCategory = 'All';
      this.selectedDept = null;
      this.searchQuery = '';
      const content = document.querySelector('.board-content');
      if (content) content.scrollToTop(400);
    },
    goUrgentNotices() {
      this.selectedCategory = 'Urgent';
      this.selectedDept = null;
      const content = document.querySelector('.board-content');
      if (content) content.scrollToTop(400);
    },
    scrollToNotice(id) {
      // Clear filters so the target notice is visible in the middle feed
      this.selectedDept = null;
      this.selectedCategory = 'All';
      this.searchQuery = '';

      this.$nextTick(() => {
        const el = document.getElementById(`notice-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('notice-card--highlight');
          setTimeout(() => el.classList.remove('notice-card--highlight'), 2500);
        }
      });
    },
    async _pollForNewNotices() {
      if (this.locked || !this.org) return;
      try {
        const res = await api.get(`/api/boards/${this.org.slug}/notices`, {
          params: { user_id: this.userId, category: null, dept_id: null }
        });
        if (res.data.success && Array.isArray(res.data.notices)) {
          const freshNotices = res.data.notices;
          // Find notices not yet shown in allNotices
          const newItems = freshNotices.filter(n => !this.allNotices.some(x => x.id === n.id));
          if (newItems.length > 0) {
            console.log(`📡 Poller found ${newItems.length} new notice(s)! Updating board...`);
            this.allNotices = freshNotices;
            this.notices = freshNotices;
            // Fire full notification (tray + sound + vibration) for each new item
            if (window.notificationService) {
              for (const notice of newItems) {
                await window.notificationService.triggerNoticeNotification({
                  org_slug: this.org?.slug || 'bugema',
                  org_name: this.org?.name || 'Notice Board',
                  dept_name: notice.dept_name || 'General Office',
                  title: notice.title || 'New Announcement',
                  body: notice.body || '',
                  notice_id: notice.id
                });
              }
            }
          }
        }
      } catch (err) {
        // Silent fail for polling background errors
      }
    },
    _registerSocketListeners() {
      const socket = window.appSocket || this.$socketService?.socket || this.$socket;
      if (!socket) return;
      socket.on('board:join_resolved', this._socketJoinResolvedHandler);
      socket.on('notice:new', this.handleSocketNoticeNew);
      socket.on('notice:delete', this.handleSocketNoticeDelete);
      socket.on('notice:pin', this.handleSocketNoticePin);
    }
  },
  ionViewWillEnter() {
    this.refreshAuthState();
  },
  mounted() {
    this.loadAll();

    window.addEventListener('scroll', this.handleScroll, { passive: true });

    // Window-level event listener for notice:new (fires from socketService)
    this._windowNoticeNewHandler = (e) => {
      if (e && e.detail) {
        this.handleSocketNoticeNew(e.detail);
      }
    };
    window.addEventListener('notice:new', this._windowNoticeNewHandler);

    // Register socket listeners (and re-register after socket connects if needed)
    this._registerSocketListeners();

    // Listen for socket connect event to re-register listeners
    this._onSocketConnect = () => {
      this._registerSocketListeners();
    };
    const svc = this.$socketService || window.socketService;
    if (svc && svc.socket) {
      svc.socket.on('connect', this._onSocketConnect);
    }

    // ── Polling fallback ─────────────────────────────────────────────────────
    // Polls every 15s so notices appear automatically even when socket fails
    // (LAN environment, backend restart, etc.)
    this._pollInterval = setInterval(() => {
      this._pollForNewNotices();
    }, 15000);
  },
  unmounted() {
    window.removeEventListener('scroll', this.handleScroll);
    if (this._windowNoticeNewHandler) {
      window.removeEventListener('notice:new', this._windowNoticeNewHandler);
    }
    const socket = window.appSocket || this.$socketService?.socket || this.$socket;
    if (socket) {
      if (this._socketJoinResolvedHandler) {
        socket.off('board:join_resolved', this._socketJoinResolvedHandler);
      }
      socket.off('notice:new', this.handleSocketNoticeNew);
      socket.off('notice:delete', this.handleSocketNoticeDelete);
      socket.off('notice:pin', this.handleSocketNoticePin);
    }
    this.restoreFaviconAndTitle();
  }
};
</script>

<style scoped>
/* ─── Toolbar ─────────────────────────────────────────────── */
.glass-toolbar {
  --background: rgba(255, 255, 255, 0.92);
  --border-color: rgba(218, 165, 32, 0.15);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 1px 0 rgba(218, 165, 32, 0.12);
}

.org-header-title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.org-header-title.centered-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex: 1;
  width: 100%;
  margin: 0 auto;
  padding: 4px 0;
}

.brand-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.brand-word-left,
.brand-word-right {
  font-size: 0.92rem;
  font-weight: 900;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  color: var(--ion-text-color, #000000);
}

.mini-logo-wrap {
  position: relative;
  flex-shrink: 0;
}

.mini-logo {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.mini-logo-ring {
  position: absolute;
  inset: -2px;
  border-radius: 50%;
  border: 2px solid rgba(218, 165, 32, 0.6);
  pointer-events: none;
}

.header-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.1;
}

.board-title {
  font-size: 1rem;
  font-weight: 800;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.board-subtitle {
  font-size: 0.68rem;
  color: #daa520;
  font-weight: 600;
  opacity: 0.9;
  letter-spacing: 0.2px;
  margin-top: 2px;
}

.official-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(218, 165, 32, 0.12);
  color: #c0921c;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  border: 1px solid rgba(218, 165, 32, 0.3);
  text-transform: uppercase;
}

.institution-header-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(218, 165, 32, 0.12);
  color: #b38209;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 12px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.login-btn-sm {
  --color: #daa520;
  --border-radius: 10px;
  font-weight: 700;
  font-size: 0.8rem;
}

.board-domain {
  font-size: 0.7rem;
  color: #daa520;
  font-weight: 500;
  opacity: 0.8;
}

.back-btn {
  --color: #daa520;
}

.settings-btn {
  --color: #888;
}

/* ─── Board Content ────────────────────────────────────────── */
.board-content {
  --background: #f5f5f7;
}

/* ─── Loading ──────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 65vh;
  gap: 20px;
  background: #ffffff;
}

.loading-logo-wrap {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-center-logo {
  width: 62px;
  height: 62px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(218, 165, 32, 0.3);
  z-index: 2;
  border: 2px solid #ffffff;
}

.loading-spinner-ring {
  position: absolute;
  inset: -8px;
  width: 116px;
  height: 116px;
  color: #d4af37;
  --color: #d4af37;
  z-index: 3;
}

.loading-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: #555555;
  margin: 0;
  letter-spacing: 0.3px;
}

/* ─── Locked State ─────────────────────────────────────────── */
.locked-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  text-align: center;
  padding: 40px 30px;
}

.lock-visual {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
}

.lock-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, rgba(218, 165, 32, 0.2) 0%, transparent 70%);
  border-radius: 50%;
}

.lock-circle {
  width: 84px;
  height: 84px;
  background: linear-gradient(135deg, #d4af37, #ffd700);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(218, 165, 32, 0.4);
  z-index: 2;
}

.lock-icon {
  font-size: 42px;
  color: #fff;
}

.pulse-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(218, 165, 32, 0.4);
}

.ring-1 {
  width: 110px;
  height: 110px;
  animation: ringPulse 2s ease-out infinite;
}

.ring-2 {
  width: 140px;
  height: 140px;
  animation: ringPulse 2s ease-out 0.6s infinite;
}

@keyframes ringPulse {
  0% { transform: scale(0.7); opacity: 0.6; }
  100% { transform: scale(1); opacity: 0; }
}

.locked-title {
  font-size: 1.8rem;
  font-weight: 800;
  margin: 0 0 10px 0;
  color: #1a1a1a;
}

.locked-desc {
  color: #666;
  font-size: 0.95rem;
  line-height: 1.6;
  max-width: 280px;
  margin: 0 0 28px 0;
}

.join-btn {
  --background: linear-gradient(135deg, #d4af37, #ffd700);
  --background-activated: #c0921c;
  --color: #000;
  --border-radius: 14px;
  --padding-start: 28px;
  --padding-end: 28px;
  font-weight: 800;
  font-size: 1rem;
  height: 52px;
  box-shadow: 0 8px 24px rgba(218, 165, 32, 0.35);
}

.pending-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(218, 165, 32, 0.08);
  border: 1.5px dashed rgba(218, 165, 32, 0.5);
  color: #c0921c;
  padding: 14px 24px;
  border-radius: 16px;
  font-weight: 600;
  font-size: 0.95rem;
}

.invite-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.accept-btn {
  --background: linear-gradient(135deg, #2ecc71, #27ae60);
  --color: #fff;
  --border-radius: 14px;
  font-weight: 700;
}

/* ─── Hero Banner ──────────────────────────────────────────── */
.hero-banner {
  position: relative;
  padding: 28px 20px 20px 20px;
  overflow: hidden;
  background: #fff;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.hero-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

.hero-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    rgba(218, 165, 32, 0.06) 0%,
    rgba(255, 215, 0, 0.03) 50%,
    rgba(192, 146, 28, 0.06) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 18px;
}

.org-logo-large-wrap {
  position: relative;
  flex-shrink: 0;
}

.org-logo-large {
  width: 72px;
  height: 72px;
  border-radius: 20px;
  object-fit: cover;
  display: block;
  box-shadow: 0 6px 20px rgba(0,0,0,0.12);
}

.org-logo-ring {
  position: absolute;
  inset: -3px;
  border-radius: 23px;
  background: linear-gradient(135deg, #d4af37, #ffd700, #c0921c);
  z-index: -1;
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.org-name {
  font-size: 1.3rem;
  font-weight: 900;
  margin: 0 0 4px 0;
  color: #1a1a1a;
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-domain {
  font-size: 0.78rem;
  color: #daa520;
  font-family: 'SF Mono', monospace;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.domain-icon {
  font-size: 11px;
}

.hero-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stat-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-val {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
}

.stat-lab {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #888;
  margin-top: 2px;
  font-weight: 600;
}

.stat-divider {
  width: 1px;
  height: 28px;
  background: rgba(0,0,0,0.08);
}

.member-pill {
  background: rgba(218, 165, 32, 0.08);
  padding: 4px 10px;
  border-radius: 20px;
  flex-direction: row;
  gap: 5px;
  align-items: center;
}

.member-icon {
  color: #daa520;
  font-size: 14px;
}

/* ─── Invite Banner ────────────────────────────────────────── */
.feed-invite-banner {
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(135deg, rgba(46, 204, 113, 0.08), rgba(46, 204, 113, 0.04));
  border: 1.5px solid rgba(46, 204, 113, 0.25);
  border-radius: 18px;
  padding: 14px 16px;
  margin: 14px 16px;
}

.banner-icon-wrap {
  width: 40px;
  height: 40px;
  background: rgba(46, 204, 113, 0.12);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.banner-icon {
  font-size: 20px;
  color: #2ecc71;
}

.banner-text {
  flex: 1;
  min-width: 0;
}

.banner-text h4 {
  margin: 0 0 2px 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #27ae60;
}

.banner-text p {
  margin: 0;
  font-size: 0.78rem;
  color: #555;
}

.accept-btn-sm {
  --background: #2ecc71;
  --color: #fff;
  --border-radius: 10px;
  --padding-start: 16px;
  --padding-end: 16px;
  font-weight: 700;
  font-size: 0.85rem;
  flex-shrink: 0;
  height: 38px;
}

/* ─── Filter Bar ───────────────────────────────────────────── */
.filter-bar {
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

.category-scroll {
  display: flex;
  padding: 12px 14px 10px;
  gap: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.category-scroll::-webkit-scrollbar { display: none; }

.cat-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 7px 14px;
  border-radius: 20px;
  border: 1.5px solid rgba(0,0,0,0.09);
  background: #f7f7f7;
  font-size: 0.8rem;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  outline: none;
  flex-shrink: 0;
}

.cat-pill .cat-icon {
  font-size: 13px;
}

.cat-pill:hover {
  border-color: rgba(218, 165, 32, 0.4);
  color: #daa520;
  background: rgba(218, 165, 32, 0.05);
}

.cat-pill--active {
  background: linear-gradient(135deg, #d4af37, #ffd700);
  color: #000;
  border-color: transparent;
  font-weight: 800;
  box-shadow: 0 3px 12px rgba(218, 165, 32, 0.3);
  transform: translateY(-1px);
}

.dept-selector {
  padding: 0 14px 10px;
}

.custom-select {
  --background: #f7f7f7;
  --border-radius: 12px;
  --padding-start: 12px;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 12px;
  font-size: 0.85rem;
}

/* ─── Notice List ──────────────────────────────────────────── */
.notice-list {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* Skeleton Loading */
.skeleton-card {
  background: #fff;
  border-radius: 18px;
  padding: 18px;
  margin-bottom: 12px;
  animation: shimmer 1.4s ease-in-out infinite;
  border: 1px solid rgba(0,0,0,0.04);
}

.skeleton-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #e8e8e8;
  flex-shrink: 0;
}

.skeleton-lines {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 12px;
  background: #e8e8e8;
  border-radius: 6px;
}
.w100 { width: 100%; }
.w80  { width: 80%; }
.w60  { width: 60%; }
.w40  { width: 40%; }
.w50  { width: 50%; }

@keyframes shimmer {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Empty State */
.empty-feed {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-visual {
  width: 90px;
  height: 90px;
  background: rgba(218, 165, 32, 0.06);
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty-icon {
  font-size: 40px;
  color: #daa520;
  opacity: 0.5;
}

.empty-title {
  font-size: 1.2rem;
  font-weight: 800;
  margin: 0 0 8px 0;
  color: #1a1a1a;
}

.empty-desc {
  font-size: 0.9rem;
  color: #888;
  margin: 0;
}

/* ─── Global Font & Notice Card ────────────────────────── */
.board-content,
.board-feed,
.notice-card,
.notice-title,
.notice-text,
.auth-name,
.board-title,
.board-subtitle,
.cat-pill,
.dept-nav-label {
  font-family: Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif !important;
}

.notice-card {
  font-family: Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif !important;
  background: #fff;
  border-radius: 18px;
  padding: 0;
  margin-bottom: 12px;
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  animation: cardIn 0.35s ease both;
  animation-delay: var(--delay, 0ms);
}

@keyframes cardIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}

.notice-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
}

/* Card type accents — borders removed, category shown via badge only */

/* Pinned bar */
.pinned-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(90deg, rgba(218, 165, 32, 0.08), transparent);
  padding: 7px 18px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #c0921c;
  border-bottom: 1px solid rgba(218, 165, 32, 0.1);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.pinned-bar ion-icon {
  font-size: 13px;
  transform: rotate(-45deg);
}

/* Card internals */
.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 16px 0 16px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.auth-pic {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}

.avatar-ring {
  position: absolute;
  inset: -2px;
  border-radius: 14px;
  border: 1.5px solid rgba(218, 165, 32, 0.3);
  pointer-events: none;
}

.auth-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.auth-name {
  font-weight: 700;
  font-size: 0.9rem;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.auth-sub {
  font-size: 0.72rem;
  color: #999;
  display: flex;
  align-items: center;
  margin-top: 1px;
}

/* Category badge */
.cat-badge {
  font-size: 0.7rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}

.cat-badge--general  { background: #f3f4f6; color: #6b7280; }
.cat-badge--academic { background: rgba(99, 102, 241, 0.1); color: #6366f1; }
.cat-badge--finance  { background: rgba(16, 185, 129, 0.1); color: #10b981; }
.cat-badge--events   { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }
.cat-badge--urgent   { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

/* Body */
.notice-body {
  padding: 12px 16px 4px;
}

.notice-text {
  margin: 0;
  padding: 0;
  /* Match textarea's natural single line-height — 1.5 is the browser default
     for <textarea> and prevents the double-spacing that occurs when the
     <p> element's own margins stack with the <br> line breaks. */
  line-height: 1.5;
  white-space: normal;   /* allow wrapping, but don't add extra space */
  word-break: break-word;
  font-size: 0.97rem;
  color: #1a1a1a;
}

.notice-title {
  font-family: 'Tahoma', 'Segoe UI', Geneva, Verdana, sans-serif;
  margin: 0 0 8px 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #1a1a1a;
  letter-spacing: -0.2px;
  line-height: 1.3;
}

.search-wrap {
  padding: 10px 14px 4px 14px;
}

.notice-searchbar {
  --background: #f4f4f6;
  --border-radius: 12px;
  --box-shadow: none;
  --placeholder-color: #888;
  --icon-color: #daa520;
  padding: 0;
}

.notice-list-container {
  padding: 16px;
  max-width: 920px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.notice-text {
  font-family: 'Tahoma', 'Segoe UI', Geneva, Verdana, sans-serif;
  margin: 0;
  font-size: 0.94rem;
  line-height: 1.65;
  color: #333;
  white-space: pre-wrap;
  word-break: break-word;
}

.notice-text :deep(a),
.notice-text a,
.notice-link,
.post-link {
  color: #2563eb !important;
  text-decoration: underline !important;
  font-weight: 600 !important;
  word-break: break-all;
  overflow-wrap: anywhere;
  cursor: pointer;
  transition: color 0.15s ease, text-decoration 0.15s ease;
}

.notice-text :deep(a:hover),
.notice-text a:hover,
.notice-link:hover,
.post-link:hover {
  color: #1d4ed8 !important;
  text-decoration: underline !important;
}

.notice-text :deep(a:focus),
.notice-text a:focus,
.notice-link:focus,
.post-link:focus {
  outline: 2px auto #2563eb;
  outline-offset: 2px;
}

/* Official Noticeboard Footer */
.noticeboard-footer {
  margin-top: 40px;
  margin-bottom: 30px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 16px;
  border-top: 1px dashed rgba(0,0,0,0.1);
}

.footer-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(218, 165, 32, 0.08);
  color: #b38209;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 6px 14px;
  border-radius: 20px;
}

.footer-note {
  font-size: 0.78rem;
  color: #888;
  margin: 0;
}

/* Attachment */
.notice-attachment {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(218, 165, 32, 0.04);
  border: 1px solid rgba(218, 165, 32, 0.15);
  border-radius: 12px;
  padding: 10px 14px;
  margin: 10px 16px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  color: #c0921c;
  transition: background 0.2s;
}

.notice-attachment:hover {
  background: rgba(218, 165, 32, 0.1);
}

.attach-icon-wrap {
  width: 32px;
  height: 32px;
  background: rgba(218, 165, 32, 0.1);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.attach-arrow {
  margin-left: auto;
  font-size: 14px;
  opacity: 0.5;
}

/* Footer */
.notice-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px 14px;
  border-top: 1px solid rgba(0,0,0,0.05);
  margin-top: 10px;
}

.notice-date {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: #aaa;
  font-weight: 500;
}

.date-icon {
  font-size: 13px;
}

.delete-btn {
  --color: #ef4444;
  --padding-start: 8px;
  --padding-end: 8px;
  height: 30px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

/* ─── Tab Toolbar ───────────────────────────────────────────── */
.tab-toolbar {
  --background: #fff;
  --border-color: rgba(0,0,0,0.06);
}

/* ─── Members View ──────────────────────────────────────────── */
.members-view {
  padding: 14px;
  background: #f5f5f7;
  min-height: 60vh;
}

.members-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  gap: 14px;
  color: #888;
  font-size: 0.9rem;
}

/* Summary bar */
.members-summary {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
  background: #fff;
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.ms-pill {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.ms-icon {
  font-size: 18px;
  color: #daa520;
  margin-bottom: 2px;
}

.ms-val {
  font-size: 1.3rem;
  font-weight: 900;
  color: #1a1a1a;
  line-height: 1;
}

.ms-lab {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: #999;
  font-weight: 600;
  text-align: center;
}

/* Department group */
.dept-group {
  margin-bottom: 18px;
}

.dept-group-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: linear-gradient(90deg, rgba(218,165,32,0.08), transparent);
  border-radius: 12px;
  margin-bottom: 8px;
  border-left: 3px solid #daa520;
}

.dept-group-icon {
  width: 32px;
  height: 32px;
  background: rgba(218,165,32,0.12);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0921c;
  font-size: 16px;
  flex-shrink: 0;
}

.dept-group-info {
  display: flex;
  flex-direction: column;
}

.dept-group-name {
  font-size: 0.92rem;
  font-weight: 800;
  color: #1a1a1a;
}

.dept-group-count {
  font-size: 0.72rem;
  color: #888;
  font-weight: 500;
}

/* Member list */
.member-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  border: 1px solid rgba(0,0,0,0.05);
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  transition: box-shadow 0.2s;
}

.member-card:hover {
  box-shadow: 0 4px 14px rgba(0,0,0,0.08);
}

/* Identity */
.member-identity {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.member-avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.member-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

/* Role dot */
.role-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
}
.role-dot--org_admin    { background: #daa520; }
.role-dot--dept_manager { background: #6366f1; }
.role-dot--dept_viewer  { background: #10b981; }

.member-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.member-handle {
  font-size: 0.72rem;
  color: #999;
}

/* Role badge */
.role-badge {
  font-size: 0.68rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  white-space: nowrap;
  flex-shrink: 0;
}
.role-badge--org_admin    { background: rgba(218,165,32,0.12); color: #c0921c; }
.role-badge--dept_manager { background: rgba(99,102,241,0.1);  color: #6366f1; }
.role-badge--dept_viewer  { background: rgba(16,185,129,0.1);  color: #10b981; }

/* Edit trigger */
.edit-trigger {
  --color: #aaa;
  --padding-start: 8px;
  --padding-end: 8px;
  height: 32px;
  flex-shrink: 0;
}

.edit-trigger:hover {
  --color: #daa520;
}

/* Edit controls */
.edit-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding-top: 10px;
  border-top: 1px solid rgba(0,0,0,0.05);
  margin-top: 4px;
  animation: slideDown 0.2s ease;
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.edit-select {
  --background: #f7f7f7;
  --border-radius: 10px;
  border: 1.5px solid rgba(0,0,0,0.08);
  border-radius: 10px;
  font-size: 0.85rem;
  width: 100%;
}

.edit-actions {
  display: flex;
  gap: 8px;
}

/* Members empty */
.members-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
  color: #888;
}

.members-empty .empty-icon {
  font-size: 3rem;
  color: #daa520;
  opacity: 0.3;
  margin-bottom: 14px;
}

/* ═══════════════════════════════════════════════════
   3-COLUMN X-STYLE DESKTOP LAYOUT
   ═══════════════════════════════════════════════════ */

/* Mobile dept pills — show only on mobile */
.mobile-dept-pills {
  display: flex;
  gap: 8px;
  padding: 10px 14px 6px;
  overflow-x: auto;
  scrollbar-width: none;
  background: #fff;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.mobile-dept-pills::-webkit-scrollbar { display: none; }

.dept-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 13px;
  border-radius: 20px;
  border: 1.5px solid rgba(0,0,0,0.09);
  background: #f7f7f7;
  font-size: 0.78rem;
  font-weight: 600;
  color: #555;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  outline: none;
  flex-shrink: 0;
}
.dept-pill ion-icon { font-size: 12px; }
.dept-pill--active {
  background: linear-gradient(135deg, #d4af37, #ffd700);
  color: #000;
  border-color: transparent;
  font-weight: 800;
  box-shadow: 0 3px 10px rgba(218,165,32,0.3);
}

/* Desktop grid — 3 columns */
.board-desktop-grid {
  display: flex;
  min-height: calc(100vh - 120px);
  background: #f3f4f6;
}

/* ── Left Sidebar (Desktop/Tablet only) ───────────── */
.dept-sidebar {
  display: none !important; /* strictly hidden on mobile */
  width: 300px;
  min-width: 260px;
  max-width: 320px;
  flex-shrink: 0;
  padding: 16px 14px;
  border-right: 1px solid rgba(0,0,0,0.07);
  background: #fff;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 0;
  height: calc(100vh - 112px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(218,165,32,0.2) transparent;
}
.dept-sidebar::-webkit-scrollbar { width: 4px; }
.dept-sidebar::-webkit-scrollbar-thumb { background: rgba(218,165,32,0.25); border-radius: 4px; }

.sidebar-org-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(218,165,32,0.06), rgba(255,215,0,0.03));
  border: 1px solid rgba(218,165,32,0.15);
  border-radius: 14px;
  margin-bottom: 4px;
}
.sidebar-org-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.sidebar-org-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sidebar-org-name {
  font-size: 0.85rem;
  font-weight: 800;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidebar-org-domain {
  font-size: 0.7rem;
  color: #daa520;
  display: flex;
  align-items: center;
  gap: 3px;
  margin-top: 2px;
  font-weight: 600;
}

.sidebar-section-title {
  font-size: 0.72rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: #888;
  margin: 0 0 8px 0;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}
.sidebar-section-title ion-icon { font-size: 13px; }

/* Department nav items */
.dept-nav {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.dept-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.18s;
  color: #444;
}
.dept-nav-item:hover {
  background: rgba(218,165,32,0.07);
  color: #c0921c;
}
.dept-nav-item--active {
  background: linear-gradient(135deg, rgba(218,165,32,0.12), rgba(255,215,0,0.06));
  color: #b38209;
  font-weight: 700;
}
.dept-nav-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(218,165,32,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  color: #c0921c;
  transition: background 0.18s;
}
.dept-nav-item--active .dept-nav-icon-wrap {
  background: rgba(218,165,32,0.18);
}
.dept-nav-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 7px;
}
.dept-group-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}
.dept-nav-label {
  flex: 1;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.dept-nav-count {
  font-size: 0.7rem;
  font-weight: 700;
  background: rgba(0,0,0,0.06);
  color: #888;
  padding: 2px 7px;
  border-radius: 10px;
  flex-shrink: 0;
}
.dept-nav-item--active .dept-nav-count {
  background: rgba(218,165,32,0.15);
  color: #b38209;
}

.sidebar-auth-box {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.05);
}
.sidebar-post-btn {
  --background: linear-gradient(135deg, #d4af37, #ffd700);
  --color: #000;
  --border-radius: 12px;
  font-weight: 800;
  font-size: 0.9rem;
  height: 44px;
}
.sidebar-login-btn {
  --color: #daa520;
  --border-radius: 12px;
  --border-color: rgba(218,165,32,0.4);
  font-weight: 700;
  font-size: 0.85rem;
  height: 44px;
}

/* ── Middle Feed Column ───────────────────────────── */
.feed-col {
  flex: 1;
  min-width: 0;
  background: #f3f4f6;
  display: flex;
  flex-direction: column;
}

.active-dept-label {
  display: none; /* hidden on mobile */
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(218,165,32,0.06);
  border-bottom: 1px solid rgba(218,165,32,0.12);
  font-size: 0.82rem;
  font-weight: 700;
  color: #c0921c;
}
.active-dept-label ion-icon { font-size: 14px; }
.clear-dept-btn {
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;
  color: #aaa;
  font-size: 16px;
  display: flex;
  align-items: center;
  transition: color 0.18s;
  padding: 0;
}
.clear-dept-btn:hover { color: #ef4444; }

/* ── Right Widgets Column (Desktop only) ─────────── */
.widgets-col {
  display: none !important; /* strictly hidden on mobile and tablet */
  width: 320px;
  min-width: 280px;
  max-width: 360px;
  flex-shrink: 0;
  padding: 16px 14px;
  border-left: 1px solid rgba(0,0,0,0.07);
  background: #f9f9fb;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 0;
  height: calc(100vh - 112px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(218,165,32,0.2) transparent;
}
.widgets-col::-webkit-scrollbar { width: 4px; }
.widgets-col::-webkit-scrollbar-thumb { background: rgba(218,165,32,0.25); border-radius: 4px; }

/* Widget card */
.widget {
  background: #fff;
  border-radius: 16px;
  border: 1px solid rgba(0,0,0,0.06);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  overflow: hidden;
}
.widget-header {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 12px 14px 10px;
  font-size: 0.8rem;
  font-weight: 800;
  color: #444;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.widget-header ion-icon { font-size: 15px; color: #daa520; }
.widget-header--urgent { color: #c0392b; }
.widget-header--urgent ion-icon { color: #ef4444; }
.widget-count {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 800;
  background: rgba(218,165,32,0.12);
  color: #c0921c;
  padding: 2px 7px;
  border-radius: 10px;
}
.urgent-count {
  background: rgba(239,68,68,0.1);
  color: #ef4444;
}
.widget-body {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.widget-empty {
  font-size: 0.78rem;
  color: #aaa;
  text-align: center;
  padding: 10px 0;
}

/* Widget notice item */
.widget-notice-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 7px 6px;
  border-radius: 10px;
  transition: background 0.15s;
  cursor: default;
}
.widget-notice-item:hover { background: rgba(0,0,0,0.03); }
.widget-notice-item--urgent {
  background: rgba(239,68,68,0.04);
}
.wni-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(218,165,32,0.4);
  flex-shrink: 0;
  margin-top: 5px;
}
.wni-dot--urgent  { background: #ef4444; }
.wni-dot--pinned  { background: #daa520; }
.wni-dot--academic { background: #6366f1; }
.wni-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}
.wni-title {
  font-size: 0.8rem;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.wni-meta {
  font-size: 0.68rem;
  color: #aaa;
  font-weight: 500;
}
.wni-dept {
  font-size: 0.68rem;
  color: #daa520;
  font-weight: 600;
}

.wni-sub-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Urgent CTA Widget High Impact Styles */
.widget--urgent-cta {
  border: 1.5px solid rgba(239, 68, 68, 0.35);
  box-shadow: 0 4px 18px rgba(239, 68, 68, 0.12);
  background: linear-gradient(180deg, rgba(254, 242, 242, 0.7) 0%, #ffffff 100%);
}

.urgent-pulse-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulseGlow 1.8s infinite;
}

.urgent-pulse-icon ion-icon {
  font-size: 14px;
  color: #dc2626 !important;
}

@keyframes pulseGlow {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.widget-notice-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 12px;
  transition: all 0.2s ease;
  cursor: pointer;
  border: 1px solid transparent;
}

.widget-notice-item:hover {
  background: rgba(218, 165, 32, 0.08);
  border-color: rgba(218, 165, 32, 0.2);
  transform: translateX(2px);
}

.widget-notice-item--urgent {
  background: rgba(254, 226, 226, 0.5);
  border: 1px solid rgba(252, 165, 165, 0.4);
}

.widget-notice-item--urgent:hover {
  background: rgba(254, 202, 202, 0.6);
  border-color: rgba(239, 68, 68, 0.5);
}

.wni-cta-action {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  font-size: 0.7rem;
  font-weight: 800;
  color: #dc2626;
  background: rgba(239, 68, 68, 0.1);
  padding: 3px 8px;
  border-radius: 12px;
  flex-shrink: 0;
}

.wni-cta-action ion-icon {
  font-size: 11px;
}

/* WhatsApp Status Style Pinned Notices (24h Expiry) */
.widget--pinned {
  border: 1px solid rgba(218, 165, 32, 0.25);
  background: linear-gradient(180deg, rgba(254, 252, 232, 0.6) 0%, #ffffff 100%);
}

.status-ring-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.status-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  position: absolute;
  top: 2px;
  left: 2px;
}

.status-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px dashed #daa520;
  animation: statusRotate 12s linear infinite;
}

@keyframes statusRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Card scroll highlight animation */
.notice-card--highlight {
  animation: highlightPulse 2.5s ease;
}

@keyframes highlightPulse {
  0% {
    box-shadow: 0 0 0 4px rgba(218, 165, 32, 0.6), 0 8px 30px rgba(218, 165, 32, 0.3);
    transform: scale(1.01);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(218, 165, 32, 0.6), 0 8px 30px rgba(218, 165, 32, 0.3);
    transform: scale(1.01);
  }
  100% {
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transform: scale(1);
  }
}

/* ── RESPONSIVE: show columns only on desktop ─────── */
@media (min-width: 1024px) {
  .mobile-dept-pills {
    display: none !important;
  }
  .board-desktop-grid {
    display: flex;
    gap: 0;
  }
  .dept-sidebar {
    display: flex !important;
  }
  .widgets-col {
    display: flex !important;
  }
  .active-dept-label {
    display: flex !important;
  }
  .filter-bar {
    border-radius: 0;
  }
}

/* Tablet: show dept sidebar only, hide right widgets */
@media (min-width: 768px) and (max-width: 1023px) {
  .mobile-dept-pills {
    display: none !important;
  }
  .board-desktop-grid {
    display: flex;
  }
  .dept-sidebar {
    display: flex !important;
    width: 240px;
    min-width: 210px;
  }
  .widgets-col {
    display: none !important;
  }
  .active-dept-label {
    display: flex !important;
  }
}

/* ── Mobile Static Bottom Navigation Bar ─────────── */
.mobile-bottom-nav {
  display: none;
}

@media (max-width: 767px) {
  .board-content {
    --padding-bottom: 70px;
  }

  .mobile-bottom-nav {
    display: flex;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
    z-index: 9999;
    align-items: center;
    justify-content: space-around;
    padding: 4px 8px;
  }

  .mobile-nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    padding: 6px 12px;
    border-radius: 12px;
    cursor: pointer;
    color: #666;
    font-size: 0.68rem;
    font-weight: 600;
    gap: 2px;
    flex: 1;
    position: relative;
    transition: all 0.2s ease;
  }

  .mobile-nav-btn ion-icon {
    font-size: 20px;
    color: #666;
    transition: color 0.2s;
  }

  .mobile-nav-btn--active {
    color: #b38209;
    font-weight: 800;
  }

  .mobile-nav-btn--active ion-icon {
    color: #daa520;
  }

  .nav-badge-wrap {
    position: relative;
    display: inline-flex;
  }

  .nav-red-badge {
    position: absolute;
    top: -4px;
    right: -8px;
    background: #ef4444;
    color: #fff;
    font-size: 0.62rem;
    font-weight: 900;
    padding: 1px 5px;
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.4);
    min-width: 16px;
    text-align: center;
    line-height: 1.2;
  }

  .dept-nav-select-wrap {
    position: relative;
  }

  .mobile-overlay-select {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .mobile-post-nav-btn .post-icon-wrap {
    width: 26px;
    height: 26px;
    background: linear-gradient(135deg, #d4af37, #ffd700);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(218, 165, 32, 0.4);
  }

  .mobile-post-nav-btn .post-icon-wrap ion-icon {
    color: #000;
    font-size: 18px;
  }
}
</style>

<!-- Unscoped: must be global so Teleport renders it correctly outside ion-page -->
<style>
.notice-post-btn {
  position: fixed !important;
  bottom: 90px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #d4af37, #f5e06e);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(212, 175, 55, 0.5);
  z-index: 99999;
  transition: transform 0.2s, box-shadow 0.2s;
  color: #000;
  font-size: 28px;
}

.notice-post-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 28px rgba(212, 175, 55, 0.7);
}

.notice-post-btn ion-icon {
  font-size: 28px;
  color: #000;
}

/* ── Profile Icon Button in Top Bar ─────────── */
.profile-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  display: flex;
  align-items: center;
}
.profile-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid rgba(218, 165, 32, 0.7);
  background: rgba(218, 165, 32, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.profile-icon-btn:hover .profile-icon-wrap {
  border-color: #daa520;
  box-shadow: 0 0 10px rgba(218, 165, 32, 0.45);
}
.profile-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-thumb-icon {
  font-size: 18px;
  color: #daa520;
}
</style>

<!-- Global styles for the Teleported profile panel (not scoped) -->
<style>
/* ── Profile Panel Overlay ─────────────────────────── */
.profile-panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  z-index: 999999;
  display: flex;
  justify-content: flex-end;
  animation: fadeInOverlay 0.2s ease;
}

@keyframes fadeInOverlay {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.profile-panel {
  width: 320px;
  max-width: 90vw;
  height: 100%;
  background: linear-gradient(165deg, #1a1a2e 0%, #16213e 50%, #0d1117 100%);
  border-left: 1px solid rgba(218,165,32,0.25);
  display: flex;
  flex-direction: column;
  animation: slideInPanel 0.28s cubic-bezier(0.32, 0.72, 0, 1);
  box-shadow: -8px 0 40px rgba(0,0,0,0.6);
}

@keyframes slideInPanel {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

.profile-panel-header {
  display: flex;
  justify-content: flex-end;
  padding: 16px 16px 0;
}

.profile-panel-close {
  background: rgba(255,255,255,0.08);
  border: none;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #aaa;
  font-size: 20px;
  transition: background 0.2s, color 0.2s;
}
.profile-panel-close:hover {
  background: rgba(218,165,32,0.18);
  color: #daa520;
}

.profile-panel-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 28px 32px;
  gap: 16px;
  flex: 1;
  overflow-y: auto;
}

/* Avatar */
.profile-avatar-area {
  position: relative;
}
.profile-big-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  background: rgba(218,165,32,0.1);
  border: 3px solid #daa520;
  box-shadow: 0 0 24px rgba(218,165,32,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.profile-big-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-big-icon {
  font-size: 44px;
  color: #daa520;
}

/* Info */
.profile-info-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.profile-display-name {
  font-size: 1.2rem;
  font-weight: 700;
  color: #f0e6c0;
  margin: 0;
  font-family: 'Tahoma', sans-serif;
}
.profile-username {
  font-size: 0.85rem;
  color: #daa520;
  font-weight: 500;
}
.profile-email {
  font-size: 0.78rem;
  color: #8892a4;
  margin-top: 2px;
}

/* Membership badge */
.profile-membership-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(218,165,32,0.1);
  border: 1px solid rgba(218,165,32,0.3);
  border-radius: 24px;
  padding: 6px 14px;
  font-size: 0.8rem;
  color: #d4af37;
  font-weight: 500;
  flex-wrap: wrap;
  justify-content: center;
}
.membership-role {
  background: rgba(218,165,32,0.2);
  border-radius: 10px;
  padding: 1px 8px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #f0c040;
}

/* Actions */
.profile-actions {
  width: 100%;
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.profile-action-btn {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s, transform 0.15s;
  font-family: 'Tahoma', sans-serif;
}
.profile-action-btn--danger {
  background: rgba(220, 53, 69, 0.12);
  border: 1px solid rgba(220, 53, 69, 0.35);
  color: #ff6b7a;
}
.profile-action-btn--danger:hover {
  background: rgba(220, 53, 69, 0.22);
  transform: scale(1.02);
}

/* ── X-Style Notice Media Grid ────────────────────────── */
.notice-media-grid {
  display: grid;
  gap: 3px;
  border-radius: 14px;
  overflow: hidden;
  margin: 12px 0;
  cursor: pointer;
}
.notice-media-grid.nm-count-1 {
  grid-template-columns: 1fr;
  max-height: 380px;
}
.notice-media-grid.nm-count-2 {
  grid-template-columns: 1fr 1fr;
  height: 240px;
}
.notice-media-grid.nm-count-3 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 260px;
}
.notice-media-grid.nm-count-3 .nm-cell:first-child {
  grid-row: 1 / span 2;
}
.notice-media-grid.nm-count-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  height: 260px;
}
.nm-cell {
  position: relative;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}
.nm-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.2s ease;
}
.nm-cell:hover .nm-img {
  transform: scale(1.03);
}
.nm-more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Lightbox Overlay ────────────────────────────────── */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0, 0, 0, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(8px);
}
.lb-img {
  max-width: 92vw;
  max-height: 88vh;
  object-fit: contain;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
}
.lb-close {
  position: absolute;
  top: 20px;
  right: 20px;
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  cursor: pointer;
  transition: background 0.2s;
}
.lb-close:hover {
  background: rgba(255,255,255,0.3);
}
.lb-counter {
  position: absolute;
  top: 25px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255,255,255,0.8);
  font-size: 0.9rem;
  font-weight: 600;
  background: rgba(0,0,0,0.5);
  padding: 4px 14px;
  border-radius: 20px;
}
.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.15);
  border: none;
  color: #fff;
  font-size: 2.5rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  line-height: 1;
  transition: background 0.2s;
}
.lb-nav:hover {
  background: rgba(255,255,255,0.3);
}
.lb-nav--prev { left: 20px; }
.lb-nav--next { right: 20px; }

/* ── Real-Time Floating "New Notices" Notification Pill ── */
.new-notices-pill-wrap {
  position: fixed;
  top: 75px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 4px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  color: #ffffff;
  padding: 4px 8px 4px 14px;
  border-radius: 30px;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 1.5px solid rgba(255, 255, 255, 0.3);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  cursor: pointer;
  animation: pillPop 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

@keyframes pillPop {
  0% {
    opacity: 0;
    transform: translate(-50%, -20px) scale(0.85);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

.new-notices-pill-btn {
  background: transparent;
  border: none;
  color: #ffffff;
  font-family: Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif;
  font-size: 0.84rem;
  font-weight: 750;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 6px;
}

.pill-icon {
  font-size: 1.1rem;
  color: #ffd700;
  animation: bounceUp 1.2s infinite ease-in-out;
}

@keyframes bounceUp {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.new-notices-dismiss-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #ffffff;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  padding: 0;
  margin-left: 2px;
}

.new-notices-dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.35);
  transform: scale(1.1);
}

.notice-card--highlight {
  animation: noticeHighlight 2.5s ease-out forwards;
}

@keyframes noticeHighlight {
  0% {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.6), 0 8px 24px rgba(37, 99, 235, 0.25);
    transform: translateY(-2px);
  }
  70% {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.3);
  }
  100% {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(0);
  }
}

.offline-notice-banner {
  background: linear-gradient(135deg, #d4af37, #b8860b);
  color: #000;
  padding: 10px 16px;
  font-size: 0.85rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.offline-banner-icon {
  font-size: 1.2rem;
  color: #000;
}

.profile-details-card {
  background: rgba(218, 165, 32, 0.08);
  border: 1px solid rgba(218, 165, 32, 0.2);
  border-radius: 12px;
  padding: 12px 16px;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}

.detail-label {
  color: #666;
  font-weight: 600;
}

.detail-value {
  color: #000;
  font-weight: 700;
}

.role-value {
  color: #b8860b;
  background: rgba(218, 165, 32, 0.15);
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}
</style>




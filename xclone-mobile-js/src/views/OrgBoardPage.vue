<template>
  <ion-page>
    <ion-header class="board-header-wrapper">
      <ion-toolbar class="glass-toolbar">
        <div class="header-brand-card">
          <div class="header-card-start" v-if="!isStandaloneMode">
            <ion-buttons>
              <ion-back-button default-href="/tabs/notices" class="back-btn"></ion-back-button>
            </ion-buttons>
          </div>
          
          <div class="org-header-title centered-header" v-if="org">
            <div class="brand-title-row">
              <span class="brand-word-left">{{ orgNameFirstWord }}</span>
              <div class="mini-logo-wrap">
                <img :src="org.logo_url || defaultLogo" class="mini-logo" />
              </div>
              <span class="brand-word-right" v-if="orgNameRestWords">{{ orgNameRestWords }}</span>
            </div>
          </div>

          <div class="org-header-title centered-header" v-else>
            <div class="brand-title-row">
              <span class="brand-word-left">BUGEMA</span>
              <div class="mini-logo-wrap">
                <img src="/bugema-logo.png" class="mini-logo" />
              </div>
              <span class="brand-word-right">UNIVERSITY</span>
            </div>
          </div>

          <div class="header-card-end">
            <!-- Language & Theme Settings (Desktop/Tablet) -->
            <button
              class="header-settings-btn desktop-header-settings"
              @click="showSettingsModal = true"
              title="Language & Theme"
            >
              <ion-icon :icon="globeOutline" class="header-settings-icon"></ion-icon>
            </button>
            <!-- Profile Avatar Icon -->
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
            <button v-if="isAdmin" @click="showAdminPanel = true" class="header-admin-gear-btn" title="Admin Settings">
              <ion-icon :icon="settingsOutline"></ion-icon>
            </button>
          </div>
        </div>
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
            <ion-icon :icon="cloudOfflineOutline" class="lock-icon" style="color: #ef4444;"></ion-icon>
          </div>
        </div>
        <h2 class="locked-title" style="color: #ef4444;">Oops! Internet Connection Needed 📶</h2>
        <p class="locked-desc">Oops! Please check your internet connection and try again.</p>
        <div class="action-box">
          <ion-button @click="loadAll" class="join-btn" style="--background: #1208a1; --color: #000; font-weight: 800;">
            <ion-icon :icon="refresh" slot="start"></ion-icon>
            Retry Connection
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
                  <span class="dept-nav-count" v-if="canPost">{{ notices.length }}</span>
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
                  <span
                    class="pref-pin-badge"
                    :class="{ 'pref-pin-badge--active': Number(preferredDeptId) === Number(dept.id) }"
                    @click.stop="togglePreferredDept(dept.id)"
                    :title="Number(preferredDeptId) === Number(dept.id) ? 'Click to unpin default department' : 'Set as default department on this device'"
                  >
                    {{ Number(preferredDeptId) === Number(dept.id) ? '📌 Saved' : '📌 Pin' }}
                  </span>
                  <span class="dept-nav-count" v-if="canPost">{{ noticesPerDept[dept.id] || 0 }}</span>
                </button>
              </nav>
            </div>

            <!-- Admin / Auth actions -->
            <div class="sidebar-auth-box" v-if="canPost">
              <ion-button @click="openNewComposer()" expand="block" class="sidebar-post-btn">
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
              <div class="search-row">
                <div class="search-wrap">
                  <ion-searchbar
                    v-model="searchQuery"
                    placeholder="Search notices…"
                    class="notice-searchbar"
                  ></ion-searchbar>
                </div>
                <!-- Mobile Department Dropdown Selector -->
                <div class="mobile-dept-dropdown-wrap" v-if="departments && departments.length > 0">
                  <ion-select
                    v-model="selectedDept"
                    interface="popover"
                    class="mobile-dept-select-box"
                    placeholder="Department ▾"
                  >
                    <ion-select-option :value="null">All Depts</ion-select-option>
                    <ion-select-option v-for="dept in departments" :key="dept.id" :value="dept.id">
                      {{ dept.name }}
                    </ion-select-option>
                  </ion-select>
                </div>
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

            <!-- Active Department Banner with Pin / Unpin Button (Mobile Portrait & Landscape & Desktop) -->
            <div class="active-dept-label" v-if="selectedDept">
              <div class="active-dept-title-box">
                <ion-icon :icon="businessOutline"></ion-icon>
                <span class="active-dept-name">{{ departments.find(d => d.id === selectedDept)?.name }}</span>
              </div>
              <div class="active-dept-actions">
                <button
                  class="pin-my-dept-btn"
                  :class="{ 'pin-my-dept-btn--active': Number(preferredDeptId) === Number(selectedDept) }"
                  @click="togglePreferredDept(selectedDept)"
                  :title="Number(preferredDeptId) === Number(selectedDept) ? 'Click to unpin this default department' : 'Pin as your default department on this device'"
                >
                  {{ Number(preferredDeptId) === Number(selectedDept) ? '📌 Pinned (Unpin)' : '📌 Pin as My Dept' }}
                </button>
                <button class="clear-dept-btn" @click="selectedDept = null" title="Clear department filter">
                  <ion-icon :icon="closeCircleOutline"></ion-icon>
                </button>
              </div>
            </div>

            <!-- 🚨 Urgent Notice Ticker Banner (appears right before notices) -->
            <div v-if="urgentNotices && urgentNotices.length > 0 && !dismissedTicker" class="urgent-ticker-banner" @click="scrollToNotice(urgentNotices[0].id)">
              <div class="ticker-inner">
                <ion-icon :icon="alertCircleOutline" class="ticker-icon"></ion-icon>
                <div class="ticker-text-container">
                  <span class="ticker-text">
                    <strong>URGENT:</strong> {{ urgentNotices[0].title }}
                  </span>
                </div>
              </div>
              <div class="ticker-right-controls">
                <ion-icon :icon="chevronForwardOutline" class="ticker-arrow"></ion-icon>
                <button class="ticker-dismiss-btn" @click.stop="dismissedTicker = true" title="Dismiss">
                  <ion-icon :icon="closeOutline"></ion-icon>
                </button>
              </div>
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
                  <p class="notice-text" v-html="getNoticeBodyHtml(notice.body, notice.id)" @click="handleContentClick($event, notice)"></p>
                </div>

                <!-- ── Pictures / Photo Grid (Facebook / X style) ─────────────── -->
                <div
                  v-if="getNoticeImages(notice) && getNoticeImages(notice).length > 0"
                  class="notice-media-grid"
                  :class="`nm-count-${Math.min(getNoticeImages(notice).length, 4)}`"
                >
                  <div
                    v-for="(url, mi) in getNoticeImages(notice).slice(0, 4)"
                    :key="mi"
                    class="nm-cell"
                    @click="openLightbox(getNoticeImages(notice), mi)"
                  >
                    <img :src="url" class="nm-img" loading="lazy" />
                    <div v-if="mi === 3 && getNoticeImages(notice).length > 4" class="nm-more-overlay">
                      +{{ getNoticeImages(notice).length - 4 }}
                    </div>
                  </div>
                </div>

                <!-- ── Document Attachment Card (PDFs, Word Docs, PPT, Excel etc. - Entire Card Clickable) ──── -->
                <div 
                  v-if="notice.attachment_url && !getAttachmentInfo(notice.attachment_url).isImage" 
                  class="notice-attachment-card"
                  @click="openAttachment(notice.attachment_url, 'download')"
                  title="Click anywhere on card to download attachment"
                >
                  <div class="attach-card-left">
                    <div class="attach-card-icon" :class="'attach-icon--' + getAttachmentInfo(notice.attachment_url).ext">
                      <ion-icon :icon="documentOutline"></ion-icon>
                    </div>
                    <div class="attach-card-info">
                      <span class="attach-filename">{{ getAttachmentInfo(notice.attachment_url).name }}</span>
                      <div class="attach-meta-row">
                        <span class="attach-format-badge" :class="'fmt-' + getAttachmentInfo(notice.attachment_url).ext">{{ getAttachmentInfo(notice.attachment_url).ext.toUpperCase() }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="attach-card-actions">
                    <button class="attach-action-btn attach-download-btn" @click.stop="openAttachment(notice.attachment_url, 'download')" title="Download file">
                      <ion-icon :icon="cloudDownloadOutline"></ion-icon>
                      <span>Download</span>
                    </button>
                  </div>
                </div>


                <div class="notice-footer">
                  <div class="notice-date">
                    <ion-icon :icon="timeOutline" class="date-icon"></ion-icon>
                    {{ formatDate(notice.created_at) }}
                  </div>

                  <div class="footer-right-actions">
                    <!-- 🖼️ Export Institutional Flyer Button -->
                    <button 
                      class="export-flyer-btn"
                      @click="exportNoticeFlyer(notice)"
                      title="Download high-resolution official institutional flyer image"
                    >
                      <ion-icon :icon="downloadOutline" class="flyer-btn-icon"></ion-icon>
                      <span class="flyer-btn-text">Flyer</span>
                    </button>

                    <!-- 🔗 Share Notice Button -->
                    <button 
                      class="share-notice-btn"
                      @click="shareNotice(notice)"
                      title="Share announcement via WhatsApp, Telegram, or Copy Link"
                    >
                      <ion-icon :icon="shareSocialOutline" class="share-btn-icon"></ion-icon>
                      <span class="share-btn-text">Share</span>
                    </button>

                    <!-- 🗓️ Add to Calendar Button (Events, Academic, Urgent, or all notices) -->
                    <button 
                      class="add-calendar-btn"
                      @click="addToCalendar(notice)"
                      title="Add announcement to Google Calendar or download iCal (.ics)"
                    >
                      <ion-icon :icon="calendarOutline" class="cal-btn-icon"></ion-icon>
                      <span class="cal-btn-text">Add to Cal</span>
                    </button>

                    <!-- 🔊 Text-to-Speech Audio Reader Button -->
                    <button 
                      class="audio-reader-btn" 
                      :class="{ 'audio-reader-btn--active': speakingNoticeId === notice.id }"
                      @click="toggleAudioReader(notice)"
                      :title="speakingNoticeId === notice.id ? 'Stop reading' : `Listen to announcement in ${i18nState.lang === 'fr' ? 'French' : i18nState.lang === 'sw' ? 'Swahili' : 'English'}`"
                    >
                      <ion-icon :icon="speakingNoticeId === notice.id ? volumeHigh : volumeMediumOutline" class="audio-btn-icon"></ion-icon>
                      <span class="audio-btn-text">{{ speakingNoticeId === notice.id ? 'Reading...' : 'Listen' }}</span>
                      <span v-if="speakingNoticeId === notice.id" class="audio-wave-dot"></span>
                    </button>

                    <ion-button fill="clear" size="small" v-if="canEditNotice(notice)" @click="editNotice(notice)" class="edit-btn" title="Edit Announcement">
                      <ion-icon slot="icon-only" :icon="createOutline"></ion-icon>
                    </ion-button>

                    <ion-button fill="clear" size="small" v-if="isAdmin || isAuthor(notice)" @click="deleteNotice(notice.id)" class="delete-btn">
                      <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
                    </ion-button>
                  </div>
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
          <button v-if="canPost" class="mobile-nav-btn mobile-post-nav-btn" @click="openNewComposer()">
            <div class="post-icon-wrap">
              <ion-icon :icon="add"></ion-icon>
            </div>
            <span>Post</span>
          </button>

          <!-- Settings (Language & Theme) -->
          <button class="mobile-nav-btn" @click="showSettingsModal = true">
            <ion-icon :icon="globeOutline"></ion-icon>
            <span>{{ t('settings') }}</span>
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

      <!-- Settings Modal (Language & Theme) -->
      <SettingsModal v-model:isOpen="showSettingsModal" />

      <!-- Notice Composer Modal -->
      <NoticeComposerModal 
        v-if="org"
        v-model:isOpen="showComposer"
        :org="org"
        :membership="membership"
        :departments="departments"
        :notice-to-edit="noticeToEdit"
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
      <button v-if="canPost" class="notice-post-btn" @click="openNewComposer()">
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

    <ion-action-sheet
      :is-open="showHeaderActionSheet"
      :buttons="boardActionSheetButtons"
      @didDismiss="showHeaderActionSheet = false"
    ></ion-action-sheet>

  </ion-page>
</template>

<script>
import { 
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
  IonBackButton, IonSpinner, IonButton, IonIcon, IonBadge, IonChip,
  IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
  IonLabel, IonSearchbar, IonActionSheet, alertController, toastController
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
  arrowUpOutline, closeOutline, refresh, cloudOfflineOutline,
  volumeHigh, volumeMediumOutline, shareSocialOutline, downloadOutline,
  ellipsisVertical, notificationsCircleOutline, refreshOutline, phonePortraitOutline, close,
  eyeOutline, cloudDownloadOutline, imageOutline
} from 'ionicons/icons';
import api from '@/utils/api.js';
import config from '@/config';
import { saveBoardOffline, getOfflineBoard } from '@/utils/offlineDb.js';
import notificationService from '@/utils/notificationService.js';
import { i18nState, t } from '@/utils/i18n.js';
import { translateNotice } from '@/utils/translationService.js';
import OrgAdminPanel from '../components/OrgAdminPanel.vue';
import NoticeComposerModal from '../components/NoticeComposerModal.vue';
import SettingsModal from '../components/SettingsModal.vue';
import html2canvas from 'html2canvas';

export default {
  name: 'OrgBoardPage',
  components: { 
    IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, 
    IonBackButton, IonSpinner, IonButton, IonIcon, IonBadge, IonChip,
    IonSelect, IonSelectOption, IonRefresher, IonRefresherContent,
    IonLabel, IonSearchbar, IonActionSheet,
    OrgAdminPanel,
    NoticeComposerModal,
    SettingsModal
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
      volumeHigh, volumeMediumOutline, shareSocialOutline, downloadOutline,
      ellipsisVertical, notificationsCircleOutline, refreshOutline, phonePortraitOutline, close,
      eyeOutline, cloudDownloadOutline, imageOutline,
      showHeaderActionSheet: false,
      notificationPermission: 'default',
      dismissedTicker: false,
      lastVisitTimestamp: null,
      isOfflineMode: false,
      newNoticesCount: 0,
      pendingNotices: [],
      showNewNoticesPill: false,
      isScrolledDown: false,
      lightbox: { show: false, images: [], index: 0 },
      docViewer: { show: false, url: '', title: '', ext: '' },
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
      preferredDeptId: null,
      categories: ['All', 'General', 'Academic', 'Finance', 'Events', 'Urgent'],
      showAdminPanel: false,
      showComposer: false,
      noticeToEdit: null,
      showProfilePanel: false,
      showSettingsModal: false,
      i18nState,
      userProfile: null,
      userId: localStorage.getItem('userId'),
      username: localStorage.getItem('username'),
      API_URL: config.api.baseURL,
      defaultLogo: 'https://images.unsplash.com/photo-1562564055-71e051d33c19?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80',
      defaultAvatarBlue: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjZjFmNWY5Ii8+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiByeD0iMTgiIHN0cm9rZT0iIzEyMDhhMSIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1vcGFjaXR5PSIwLjMiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNNTAgMjJMMjAgMzh2OGg2MHYtOEw1MCAyMnptLTIyIDI2djI0aDhWNDhoLTh6bTE1IDB2MjRoOFY0OGgtOHptMTUgMHYyNGg4VjQ4aC04em0xNSAwdjI0aDhWNDhoLTh6TTE2IDc2djZoNjh2LTZIMTZ6IiBmaWxsPSIjMTIwOGExIi8+PC9zdmc+',
      defaultAvatarGold: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjIwIiBmaWxsPSIjMWUyNDMwIi8+PHJlY3QgeD0iMiIgeT0iMiIgd2lkdGg9Ijk2IiBoZWlnaHQ9Ijk2IiByeD0iMTgiIHN0cm9rZT0iI2ZmZDcwMCIgc3Ryb2tlLXdpZHRoPSIyLjUiIHN0cm9rZS1vcGFjaXR5PSIwLjQiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNNTAgMjJMMjAgMzh2OGg2MHYtOEw1MCAyMnptLTIyIDI2djI0aDhWNDhoLTh6bTE1IDB2MjRoOFY0OGgtOHptMTUgMHYyNGg4VjQ4aC04em0xNSAwdjI0aDhWNDhoLTh6TTE2IDc2djZoNjh2LTZIMTZ6IiBmaWxsPSIjZmZkNzAwIi8+PC9zdmc+',
      fetchingNotices: false,
      originalFavicon: null,
      originalTitle: '',
      errorMessage: null,
      _pollInterval: null,
      _lastKnownNoticeId: null,
      expandedNotices: {},
      speakingNoticeId: null,
      readNoticeIds: new Set(),
      _ttsAudio: null,
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
    boardActionSheetButtons() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      const boardTitle = this.org ? (this.org.name || 'Notice Board') : 'Bugema Notice Board';

      const buttons = [
        {
          text: 'Refresh Notice Board',
          icon: refreshOutline,
          handler: () => {
            this.fetchOrgData();
          }
        },
        {
          text: 'Trigger Test Notification',
          icon: notificationsCircleOutline,
          handler: () => {
            this.triggerTestNotification();
          }
        }
      ];

      if (!isStandalone) {
        buttons.push({
          text: `Install ${boardTitle}`,
          icon: isIOS ? phonePortraitOutline : downloadOutline,
          handler: () => {
            this.installPWA('bugema');
          }
        });
      }

      buttons.push({
        text: 'Cancel',
        role: 'cancel',
        icon: close
      });

      return buttons;
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
      const now = new Date().getTime();
      const DAY_MS = 24 * 60 * 60 * 1000;
      return (this.allNotices.length ? this.allNotices : this.notices)
        .filter(n => {
          if (n.category !== 'Urgent') return false;
          const expiryTime = n.expires_at
            ? new Date(n.expires_at).getTime()
            : new Date(n.created_at).getTime() + DAY_MS;
          return now < expiryTime;
        })
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
    unreadNoticesCount() {
      const list = this.allNotices.length ? this.allNotices : (this.notices || []);
      if (!this.lastVisitTimestamp) return list.length;
      return list.filter(n => this.isNoticeUnread(n)).length;
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
    },
    'i18nState.lang'() {
      this.applyAutoTranslate();
    },
    'i18nState.autoTranslate'() {
      this.applyAutoTranslate();
    }
  },
  methods: {
    getNoticeImages(notice) {
      if (!notice) return [];
      const images = Array.isArray(notice.media_urls) ? [...notice.media_urls] : [];
      if (notice.attachment_url && this.getAttachmentInfo(notice.attachment_url).isImage) {
        if (!images.includes(notice.attachment_url)) {
          images.push(notice.attachment_url);
        }
      }
      return images;
    },
    installPWA(target = 'bugema') {
      const isBugema = target === 'bugema' || this.$route.path.includes('/bugema');
      const appName = isBugema ? 'Bugema Notice Board' : 'NexFi App';
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      try {
        let manifestTag = document.getElementById('manifest-link');
        if (!manifestTag) {
          manifestTag = document.querySelector('link[rel="manifest"]');
        }
        if (manifestTag) {
          manifestTag.setAttribute('href', isBugema ? '/manifest-bugema.json' : '/manifest.json');
        }
      } catch (_) {}
      
      const promptEvent = window._pwaInstallPrompt;
      if (promptEvent) {
        console.log(`✨ Triggering native PWA install prompt for ${appName}...`);
        promptEvent.prompt();
        promptEvent.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log(`✅ User accepted ${appName} PWA install`);
          } else {
            console.log(`❌ User dismissed ${appName} PWA install`);
          }
          window._pwaInstallPrompt = null;
        });
      } else if (isIOS) {
        alert(`📱 To install ${appName} on your iPhone/iPad:\n\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap Add at the top right.`);
      } else {
        const isSecure = window.isSecureContext;
        if (!isSecure && window.location.hostname !== 'localhost') {
            alert(`🔐 Security Requirement: PWA installation requires a secure HTTPS connection. Please ensure you are using https:// and not an IP address.`);
        } else {
            alert(`ℹ️ Installation Tip for ${appName}:\n\nIf the "Install" button didn't trigger automatically:\n1. Open your browser menu (three dots at the top right).\n2. Look for "Install app" or "Add to Home screen".`);
        }
      }
    },

    async triggerTestNotification() {
      try {
        if ('Notification' in window && Notification.permission !== 'granted') {
          await Notification.requestPermission();
        }
        const title = this.org ? `${this.org.name} Notice Test` : 'Bugema Notice Test';
        notificationService.sendNotification(title, {
          body: '🔔 Test notice notification triggered successfully!',
          icon: this.org?.logo_url || '/bugema-logo.png',
          url: window.location.href
        });
      } catch (e) {
        console.error('Test notification error:', e);
      }
    },

    isNoticeUnread(notice) {
      if (!notice) return false;
      if (notice.is_read || (this.readNoticeIds && this.readNoticeIds.has(notice.id))) return false;
      if (!notice.created_at) return false;
      if (!this.lastVisitTimestamp) return true;
      const createdTime = new Date(notice.created_at).getTime();
      return createdTime > Number(this.lastVisitTimestamp);
    },
    async markNoticeAsRead(notice) {
      if (!notice || !notice.id) return;
      if (!this.readNoticeIds) this.readNoticeIds = new Set();
      this.readNoticeIds.add(notice.id);
      notice.is_read = true;
      try {
        await axios.post(`${this.API_URL}/api/boards/mark-read`, {
          user_id: this.userId,
          notice_id: notice.id
        });
        window.dispatchEvent(new Event('notifications-refresh'));
      } catch (e) {
        console.warn('markNoticeAsRead error:', e);
      }
    },
    async markAllNoticesAsRead() {
      const slug = this.org?.slug || this.$route?.params?.slug || 'bugema';
      const now = Date.now();
      localStorage.setItem('last_visit_' + slug, String(now));
      this.lastVisitTimestamp = now;
      if (!this.readNoticeIds) this.readNoticeIds = new Set();
      const list = this.allNotices.length ? this.allNotices : (this.notices || []);
      list.forEach(n => {
        n.is_read = true;
        this.readNoticeIds.add(n.id);
      });
      try {
        await axios.post(`${this.API_URL}/api/boards/mark-read`, {
          user_id: this.userId,
          org_slug: slug,
          all: true
        });
        window.dispatchEvent(new Event('notifications-refresh'));
      } catch (e) {
        console.warn('markAllNoticesAsRead error:', e);
      }
      toastController.create({
        message: '✨ Marked all notices as read!',
        duration: 2000,
        color: 'success',
        position: 'bottom'
      }).then(t => t.present());
    },
    async exportNoticeFlyer(notice) {
      if (!notice) return;

      const orgName = this.org?.name || 'BUGEMA UNIVERSITY';
      const deptName = notice.dept_name || notice.org_name || 'General Office';
      const category = notice.category || 'General';
      const title = notice.title || 'Official Announcement';
      const noticeDate = this.formatDate(notice.created_at || Date.now());
      
      const baseUrl = window.location.origin + window.location.pathname;
      const noticeUrl = `${baseUrl}#notice-${notice.id}`;
      const avatarSrc = this.getNoticeAvatar(notice);
      const isDark = i18nState.theme === 'dark' || document.body.classList.contains('dark');

      const toastLoading = await toastController.create({
        message: '🖼️ Capturing Official Post Screenshot Flyer...',
        duration: 2500,
        color: 'warning',
        position: 'bottom'
      });
      await toastLoading.present();

      // Convert image URLs to Base64 to guarantee CORS rendering in html2canvas
      const toBase64 = async (url) => {
        if (!url || url.startsWith('data:')) return url;
        try {
          const res = await fetch(url, { mode: 'cors' });
          const blob = await res.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(url);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return url;
        }
      };

      const base64Avatar = await toBase64(avatarSrc);
      const base64Media = (notice.media_urls && notice.media_urls.length > 0)
        ? await Promise.all(notice.media_urls.map(url => toBase64(url)))
        : [];

      // Create high-resolution screenshot container
      const wrapper = document.createElement('div');
      wrapper.className = `flyer-snapshot-container ${isDark ? 'dark-theme' : 'light-theme'}`;
      
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = '800px';
      wrapper.style.zIndex = '-9999';
      wrapper.style.background = isDark ? '#0b0f14' : '#f3f4f6';
      wrapper.style.padding = '32px';
      wrapper.style.boxSizing = 'border-box';
      wrapper.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
      wrapper.style.color = isDark ? '#e7e9ea' : '#0f1419';

      const bodyHtml = this.getNoticeBodyHtml(notice.body, notice.id);

      // Media Grid HTML
      let mediaGridHtml = '';
      if (base64Media.length > 0) {
        const displayCount = Math.min(base64Media.length, 4);
        const gridCells = base64Media.slice(0, 4).map((url, mi) => `
          <div style="position:relative; overflow:hidden; border-radius:12px; background:${isDark ? '#202429' : '#e5e7eb'}; height: 100%;">
            <img src="${url}" style="width:100%; height:100%; object-fit:cover; display:block;" />
            ${mi === 3 && base64Media.length > 4 ? `
              <div style="position:absolute; inset:0; background:rgba(0,0,0,0.65); color:#ffffff; display:flex; align-items:center; justify-content:center; font-size:26px; font-weight:bold;">
                +${base64Media.length - 4}
              </div>
            ` : ''}
          </div>
        `).join('');

        const gridStyle = displayCount === 1 ? 'grid-template-columns: 1fr; height: 380px;' :
                          displayCount === 2 ? 'grid-template-columns: 1fr 1fr; height: 280px;' :
                          displayCount === 3 ? 'grid-template-columns: 1fr 1fr; height: 320px;' :
                          'grid-template-columns: 1fr 1fr; height: 340px;';

        mediaGridHtml = `
          <div style="display:grid; gap:10px; margin-top:20px; border-radius:16px; overflow:hidden; ${gridStyle}">
            ${gridCells}
          </div>
        `;
      }

      // Attachment HTML
      let attachmentHtml = '';
      if (notice.attachment_url) {
        attachmentHtml = `
          <div style="display:flex; align-items:center; gap:12px; padding:14px 20px; margin-top:20px; background:${isDark ? '#1d2127' : '#f0f4f8'}; border:1.5px solid ${isDark ? '#2f3336' : '#cbd5e1'}; border-radius:14px; color:${isDark ? '#60a5fa' : '#1208a1'}; font-weight:700; font-size:15px;">
            <span style="font-size:22px;">📄</span>
            <span>View Official Document / Attachment</span>
          </div>
        `;
      }

      // Category color mapping
      const catColor = category === 'Urgent' ? '#ef4444' : 
                       category === 'Academic' ? '#3b82f6' : 
                       category === 'Finance' ? '#10b981' : 
                       category === 'Events' ? '#8b5cf6' : '#1208a1';

      // Complete Snapshot Card HTML
      wrapper.innerHTML = `
        <div style="background: ${isDark ? '#16181c' : '#ffffff'}; border: 2.5px solid ${isDark ? '#2f3336' : '#e5e7eb'}; border-radius: 26px; overflow: hidden; box-shadow: 0 16px 40px rgba(0,0,0,0.3);">
          
          <!-- Institutional Header Banner -->
          <div style="background: linear-gradient(135deg, #0b0f14 0%, #1e2430 50%, #0b0f14 100%); padding: 26px 36px; border-bottom: 4px solid #1208a1; text-align: center; color: #ffffff;">
            <div style="font-size: 28px; font-weight: 900; letter-spacing: 1.5px; color: #3b82f6; text-transform: uppercase;">
              🏛️ ${orgName.toUpperCase()}
            </div>
            <div style="font-size: 13px; font-weight: 800; letter-spacing: 2px; color: #cbd5e1; margin-top: 6px; text-transform: uppercase;">
              OFFICIAL DIGITAL NOTICE BOARD • POST SNAPSHOT
            </div>
          </div>

          <!-- Post Card Content -->
          <div style="padding: 32px 36px;">
            
            ${notice.is_pinned ? `
              <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(18, 8, 161,0.15); color:#1208a1; padding:6px 16px; border-radius:20px; font-size:13px; font-weight:800; margin-bottom:20px; border:1px solid rgba(18, 8, 161,0.35);">
                📌 Pinned Notice
              </div>
            ` : ''}

            <!-- Author Header -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 22px;">
              <div style="display: flex; align-items: center; gap: 16px;">
                <div style="position: relative; width: 56px; height: 56px; border-radius: 50%; padding: 2px; background: #1208a1; flex-shrink: 0;">
                  <img src="${base64Avatar}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; background: #222;" />
                </div>
                <div>
                  <div style="font-size: 20px; font-weight: 800; color: ${isDark ? '#ffffff' : '#0f1419'};">
                    ${deptName}
                  </div>
                  <div style="font-size: 13px; color: #888888; margin-top: 2px; font-weight: 600;">
                    Official Institutional Publisher
                  </div>
                </div>
              </div>

              <!-- Category Badge -->
              <div style="background: ${catColor}; color: #ffffff; padding: 7px 18px; border-radius: 20px; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                ${category}
              </div>
            </div>

            <!-- Notice Title -->
            <h2 style="font-size: 26px; font-weight: 800; line-height: 1.35; margin: 0 0 18px 0; color: ${isDark ? '#ffffff' : '#0f1419'};">
              ${title}
            </h2>

            <!-- Notice Body (Exact HTML formatting, links, bold text, emojis) -->
            <div class="notice-text-content" style="font-size: 17px; line-height: 1.7; color: ${isDark ? '#d1d5db' : '#374151'}; margin-bottom: 22px; overflow-wrap: break-word;">
              ${bodyHtml}
            </div>

            <!-- Media Grid -->
            ${mediaGridHtml}

            <!-- Attachment Bar -->
            ${attachmentHtml}

            <!-- Timestamp -->
            <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid ${isDark ? '#26292e' : '#f1f5f9'}; font-size: 14px; color: #888888; display: flex; align-items: center; gap: 6px; font-weight: 600;">
              <span>🕒 Posted on: ${noticeDate}</span>
            </div>

          </div>

          <!-- Bottom Verification Footer -->
          <div style="background: ${isDark ? '#111317' : '#f8fafc'}; padding: 20px 36px; border-top: 2px solid ${isDark ? '#2f3336' : '#e2e8f0'}; display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 15px; font-weight: 800; color: #1208a1; display: flex; align-items: center; gap: 8px;">
              <span>🏛️ ${orgName} • Digital Notice Board</span>
            </div>
            <div style="font-size: 12px; color: ${isDark ? '#9ca3af' : '#64748b'}; word-break: break-all; font-family: monospace;">
              🔗 ${noticeUrl}
            </div>
            <div style="font-size: 11px; color: #888888; font-style: italic; margin-top: 2px;">
              🛡️ Verified Institutional Post Snapshot • Generated on ${new Date().toLocaleString()}
            </div>
          </div>

        </div>
      `;

      document.body.appendChild(wrapper);

      try {
        const canvas = await html2canvas(wrapper, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          backgroundColor: isDark ? '#0b0f14' : '#f3f4f6',
          logging: false
        });

        document.body.removeChild(wrapper);

        const imageURI = canvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        const safeFilename = `${orgName.replace(/\s+/g, '_')}_Notice_${notice.id}.png`;
        downloadLink.href = imageURI;
        downloadLink.download = safeFilename;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        const toastSuccess = await toastController.create({
          message: `📥 Official Post Screenshot Flyer downloaded: ${safeFilename}`,
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toastSuccess.present();
      } catch (err) {
        console.error('Error generating flyer snapshot:', err);
        if (document.body.contains(wrapper)) {
          document.body.removeChild(wrapper);
        }
        const toastErr = await toastController.create({
          message: '❌ Failed to capture post screenshot flyer. Please try again.',
          duration: 3000,
          color: 'danger',
          position: 'bottom'
        });
        await toastErr.present();
      }
    },
    async shareNotice(notice) {
      if (!notice) return;

      const orgName = this.org?.name || 'Bugema University';
      const deptName = notice.dept_name || notice.org_name || 'General Board';
      const title = notice.title || 'Official Announcement';
      const cleanBody = (notice.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const summary = cleanBody.length > 140 ? cleanBody.substring(0, 140) + '...' : cleanBody;
      
      const frontendBase = (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes('localhost'))
        ? window.location.origin
        : 'https://bugema-notice.vercel.app';
      const noticeShareUrl = `${frontendBase}/share/notice/${notice.id}`;
      const shareText = `📢 *${orgName.toUpperCase()} DIGITAL NOTICE BOARD*\n📌 *Dept:* ${deptName}\n\n*Title:* ${title}\n\n${summary}\n\n🔗 *Read Full Notice:* ${noticeShareUrl}`;

      const canWebShare = typeof navigator !== 'undefined' && Boolean(navigator.share);

      const alert = await alertController.create({
        header: '🔗 Share Announcement',
        subHeader: title,
        message: 'Choose how you want to share this notice:',
        buttons: [
          {
            text: '💚 Share via WhatsApp',
            handler: () => {
              const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
              if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
                window.open(waUrl, '_system');
              } else {
                window.open(waUrl, '_blank', 'noopener,noreferrer');
              }
            }
          },
          {
            text: '✈️ Share via Telegram',
            handler: () => {
              const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(noticeShareUrl)}&text=${encodeURIComponent(`📢 *${orgName}* - ${title}`)}`;
              if (typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform()) {
                window.open(tgUrl, '_system');
              } else {
                window.open(tgUrl, '_blank', 'noopener,noreferrer');
              }
            }
          },
          {
            text: '📋 Copy Direct Link',
            handler: async () => {
              try {
                await navigator.clipboard.writeText(noticeShareUrl);
                const toast = await toastController.create({
                  message: '📋 Direct notice link copied to clipboard!',
                  duration: 2500,
                  color: 'success',
                  position: 'bottom'
                });
                await toast.present();
              } catch (e) {
                console.warn('Clipboard copy error:', e);
              }
            }
          },
          ...(canWebShare ? [{
            text: '📱 Device Native Share Sheet',
            handler: async () => {
              try {
                await navigator.share({
                  title: `${orgName} - ${title}`,
                  text: shareText,
                  url: noticeShareUrl
                });
              } catch (e) {
                if (e.name !== 'AbortError') {
                  console.warn('Native share error:', e);
                }
              }
            }
          }] : []),
          {
            text: 'Cancel',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
    },
    async addToCalendar(notice) {
      if (!notice) return;

      const title = notice.title || 'Bugema Notice Board Announcement';
      const cleanBody = (notice.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const deptName = notice.dept_name || notice.org_name || 'Bugema University';
      const location = `${deptName} - Digital Notice Board`;

      // Event Date: Default to expires_at if set, otherwise notice created_at
      const eventDate = notice.expires_at ? new Date(notice.expires_at) : new Date(notice.created_at || Date.now());
      const endDate = new Date(eventDate.getTime() + 60 * 60 * 1000); // 1 hour event duration

      const formatISOForCalendar = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
      };

      const startISO = formatISOForCalendar(eventDate);
      const endISO = formatISOForCalendar(endDate);

      const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(cleanBody)}&location=${encodeURIComponent(location)}&dates=${startISO}/${endISO}`;

      const alert = await alertController.create({
        header: '🗓️ Add to Calendar',
        subHeader: title,
        message: 'Save announcement date to your preferred calendar:',
        buttons: [
          {
            text: '📅 Google Calendar',
            handler: () => {
              window.open(googleUrl, '_blank', 'noopener,noreferrer');
            }
          },
          {
            text: '📥 Download iCal (.ics)',
            handler: () => {
              this.downloadIcsFile(title, cleanBody, location, eventDate, endDate);
            }
          },
          {
            text: 'Cancel',
            role: 'cancel'
          }
        ]
      });
      await alert.present();
    },
    downloadIcsFile(title, details, location, startDate, endDate) {
      const formatIcsDate = (date) => {
        return date.toISOString().replace(/-|:|\.\d+/g, '');
      };

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//NEXFI//Bugema Digital Notice Board//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VEVENT',
        `SUMMARY:${title.replace(/\n/g, ' ')}`,
        `DESCRIPTION:${details.replace(/\n/g, ' ')}`,
        `LOCATION:${location}`,
        `DTSTART:${formatIcsDate(startDate)}`,
        `DTEND:${formatIcsDate(endDate)}`,
        `DTSTAMP:${formatIcsDate(new Date())}`,
        'STATUS:CONFIRMED',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_event.ics`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    stopAudioReader() {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      if (this._ttsAudio) {
        try {
          this._ttsAudio.pause();
          this._ttsAudio.currentTime = 0;
        } catch (_) {}
        this._ttsAudio = null;
      }
      this.speakingNoticeId = null;
    },
    async toggleAudioReader(notice) {
      if (!notice) return;

      if (this.speakingNoticeId === notice.id) {
        this.stopAudioReader();
        return;
      }

      this.stopAudioReader();
      this.speakingNoticeId = notice.id;

      const targetLang = i18nState.lang || 'en'; // 'en', 'sw', 'fr'

      let rawTitle = notice.title || '';
      let rawBody = (notice.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

      let readTitle = rawTitle;
      let readBody = rawBody;

      if (targetLang !== 'en') {
        try {
          const translated = await translateNotice({ title: rawTitle, body: rawBody }, targetLang);
          if (translated && translated.title) {
            readTitle = translated.title;
            readBody = (translated.body || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
          }
        } catch (e) {
          console.warn('TTS translation fallback:', e);
        }
      }

      const textToRead = `${readTitle}. ${readBody}`;

      // Tier 1: Try Native Web Speech API
      const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;

      let nativeStarted = false;

      if (hasSpeech) {
        try {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(textToRead);
          const langCodeMap = { en: 'en-US', sw: 'sw-KE', fr: 'fr-FR' };
          const targetCode = langCodeMap[targetLang] || 'en-US';
          utterance.lang = targetCode;
          utterance.rate = 0.92;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          const voices = window.speechSynthesis.getVoices();
          if (voices && voices.length) {
            const matchedVoice = voices.find(v =>
              v.lang.toLowerCase() === targetCode.toLowerCase() ||
              v.lang.toLowerCase().startsWith(targetLang)
            );
            if (matchedVoice) utterance.voice = matchedVoice;
          }

          utterance.onstart = () => {
            nativeStarted = true;
            console.log('🗣️ Native Web Speech API started');
          };

          utterance.onend = () => {
            if (this.speakingNoticeId === notice.id) {
              this.speakingNoticeId = null;
            }
          };

          utterance.onerror = (err) => {
            console.warn('Native SpeechSynthesis error, switching to Audio fallback:', err);
            if (!nativeStarted && this.speakingNoticeId === notice.id) {
              this.playAudioTTSFallback(textToRead, targetLang, notice.id);
            } else if (this.speakingNoticeId === notice.id) {
              this.speakingNoticeId = null;
            }
          };

          window.speechSynthesis.speak(utterance);

          // Verify if speech starts within 800ms (Android WebView silent voice bug fallback)
          setTimeout(() => {
            if (!nativeStarted && this.speakingNoticeId === notice.id) {
              if (window.speechSynthesis.speaking) {
                return;
              }
              console.log('⚠️ Native SpeechSynthesis silent timeout — triggering Audio TTS fallback');
              try { window.speechSynthesis.cancel(); } catch (_) {}
              this.playAudioTTSFallback(textToRead, targetLang, notice.id);
            }
          }, 800);

          return;
        } catch (err) {
          console.warn('Native TTS execution failed:', err);
        }
      }

      // Tier 2 Fallback: Online Audio TTS player
      this.playAudioTTSFallback(textToRead, targetLang, notice.id);
    },
    playAudioTTSFallback(text, lang, noticeId) {
      if (this.speakingNoticeId !== noticeId) return;

      const langCodeMap = { en: 'en', sw: 'sw', fr: 'fr' };
      const tl = langCodeMap[lang] || 'en';

      const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
      const chunks = [];
      let current = '';

      for (const sentence of sentences) {
        if ((current + ' ' + sentence).length < 140) {
          current += (current ? ' ' : '') + sentence;
        } else {
          if (current) chunks.push(current);
          current = sentence;
        }
      }
      if (current) chunks.push(current);

      let chunkIndex = 0;

      const playNextChunk = () => {
        if (this.speakingNoticeId !== noticeId || chunkIndex >= chunks.length) {
          this.speakingNoticeId = null;
          this._ttsAudio = null;
          return;
        }

        const chunkText = chunks[chunkIndex];
        chunkIndex++;

        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(chunkText)}`;

        this._ttsAudio = new Audio(ttsUrl);
        this._ttsAudio.volume = 1.0;

        this._ttsAudio.onended = () => {
          playNextChunk();
        };

        this._ttsAudio.onerror = (e) => {
          console.warn('Audio TTS chunk playback error:', e);
          playNextChunk();
        };

        this._ttsAudio.play().catch(err => {
          console.warn('Audio play blocked:', err);
          this.speakingNoticeId = null;
          this._ttsAudio = null;
          toastController.create({
            message: '🔊 Tap anywhere on screen to enable audio.',
            duration: 2000,
            color: 'warning',
            position: 'bottom'
          }).then(t => t.present());
        });
      };

      playNextChunk();
    },
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

      // 🔕 Targeted Department Live Filter
      const targetDeptId = payload.dept_id;
      const savedPref = localStorage.getItem('pref_dept_' + currentSlug);
      if (targetDeptId && savedPref && Number(targetDeptId) !== Number(savedPref)) {
        console.log(`🔇 Live notice for dept ${targetDeptId} ignored (user pinned dept ${savedPref})`);
        return;
      }

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
    handleSocketNoticeUpdate(payload) {
      if (!payload) return;
      const updated = payload.notice || payload;
      if (!updated || !updated.id) return;
      const updateInList = (list) => {
        const idx = list.findIndex(n => n.id === updated.id);
        if (idx !== -1) {
          list.splice(idx, 1, { ...list[idx], ...updated });
        }
      };
      updateInList(this.allNotices);
      updateInList(this.notices);
      updateInList(this.pendingNotices);
    },
    canEditNotice(notice) {
      if (!notice) return false;
      if (this.isAdmin) return true;
      if (this.isAuthor(notice)) return true;
      const isDeptManager = this.membership?.role === 'dept_manager';
      if (isDeptManager) {
        if (!notice.dept_id || notice.dept_id === this.membership?.dept_id) {
          return true;
        }
      }
      return false;
    },
    editNotice(notice) {
      this.noticeToEdit = notice;
      this.showComposer = true;
    },
    openNewComposer() {
      this.noticeToEdit = null;
      this.showComposer = true;
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
          this.applyAutoTranslate();
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

        this.applyAutoTranslate();
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

      let escaped = escapeHtml(text);

      // Step 1b: Restore safe text formatting tags (Bold, Italic, Underline)
      escaped = escaped
        .replace(/&lt;b&gt;/gi, '<b>').replace(/&lt;\/b&gt;/gi, '</b>')
        .replace(/&lt;strong&gt;/gi, '<strong>').replace(/&lt;\/strong&gt;/gi, '</strong>')
        .replace(/&lt;i&gt;/gi, '<i>').replace(/&lt;\/i&gt;/gi, '</i>')
        .replace(/&lt;em&gt;/gi, '<em>').replace(/&lt;\/em&gt;/gi, '</em>')
        .replace(/&lt;u&gt;/gi, '<u>').replace(/&lt;\/u&gt;/gi, '</u>');

      // Step 2: Auto-link plain text URLs (https://, http://, ftp://, www.)
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

      // Step 3: Auto-format hashtags (#tag) and mentions (@user)
      escaped = escaped.replace(/(^|\s)(#[a-zA-Z0-9_]+)/g, '$1<span class="hashtag" data-hashtag="$2" class="hashtag" style="font-weight:700;cursor:pointer">$2</span>');
      escaped = escaped.replace(/(^|\s)(@[a-zA-Z0-9_]+)/g, '$1<span class="mention" data-mention="$2" class="hashtag" style="font-weight:700;cursor:pointer">$2</span>');

      // Step 4: Convert newlines to <br>
      return escaped.replace(/\n/g, '<br>');
    },
    t,
    // 🌐 Auto-translate all loaded notices to the chosen language (in place)
    async applyAutoTranslate() {
      const lang = i18nState.lang;
      const enabled = i18nState.autoTranslate;
      const target = enabled && lang !== 'en' ? lang : 'en';

      // Deduplicate across allNotices + notices (same objects referenced in both)
      const merged = {};
      [this.allNotices, this.notices].forEach(list => {
        (list || []).forEach(n => {
          if (n && n.id != null) merged[n.id] = n;
        });
      });
      const notices = Object.values(merged);
      if (notices.length === 0) return;

      // Revert to originals when auto-translate is off or English is selected
      if (target === 'en') {
        notices.forEach(n => {
          if (n._isTranslated) {
            n.title = n._origTitle || n.title;
            n.body = n._origBody || n.body;
            n._isTranslated = false;
            n._translatedLang = null;
          }
        });
        return;
      }

      await Promise.all(notices.map(async (n) => {
        if ((n._isTranslated && n._translatedLang === target) || n._translating) return;
        n._translating = true;
        try {
          if (!n._origTitle) n._origTitle = n.title;
          if (!n._origBody) n._origBody = n.body;
          const translated = await translateNotice(n, target);
          n.title = translated.title;
          n.body = translated.body;
          n._isTranslated = true;
          n._translatedLang = target;
        } catch (err) {
          console.warn('Auto-translate error for notice', n.id, err);
        } finally {
          n._translating = false;
        }
      }));
    },
    async toggleNoticeTranslation(notice) {
      if (!notice) return;
      if (notice._isTranslated) {
        notice.title = notice._origTitle || notice.title;
        notice.body = notice._origBody || notice.body;
        notice._isTranslated = false;
        return;
      }
      if (!notice._origTitle) notice._origTitle = notice.title;
      if (!notice._origBody) notice._origBody = notice.body;

      notice._translating = true;
      try {
        const targetLang = i18nState.lang || 'sw';
        const translated = await translateNotice(notice, targetLang);
        notice.title = translated.title;
        notice.body = translated.body;
        notice._isTranslated = true;
      } catch (err) {
        console.warn('Notice translation error:', err);
      } finally {
        notice._translating = false;
      }
    },
    handleContentClick(event, notice) {
      const target = event.target.closest('a, .hashtag, .mention');
      if (target) {
        event.stopPropagation();
        return;
      }
      // X-style "Read more" / "Show less" inline link
      if (event.target.closest('.read-more')) {
        event.preventDefault();
        event.stopPropagation();
        this.toggleExpandNotice(notice.id);
        return;
      }
      if (notice && notice.body && notice.body.length > 300) {
        this.toggleExpandNotice(notice.id);
      }
    },
    isNoticeExpanded(noticeId) {
      return !!this.expandedNotices[noticeId];
    },
    toggleExpandNotice(noticeId) {
      this.expandedNotices = {
        ...this.expandedNotices,
        [noticeId]: !this.expandedNotices[noticeId]
      };
    },
    getNoticeBodyHtml(body, noticeId) {
      if (!body) return '';
      const MAX_BODY_CHARS = 300;
      const expanded = this.isNoticeExpanded(noticeId);

      if (body.length <= MAX_BODY_CHARS) {
        return this.formatNoticeBody(body);
      }

      if (expanded) {
        // Full body + inline "Show less" to collapse back (X-style)
        return this.formatNoticeBody(body) + ' <span class="read-more" title="Click to collapse notice">Show less ▴</span>';
      }

      // Truncate at the last word boundary within the window
      let truncated = body.substring(0, MAX_BODY_CHARS);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > MAX_BODY_CHARS * 0.6) {
        truncated = truncated.substring(0, lastSpace);
      }

      return this.formatNoticeBody(truncated) + '... <span class="read-more" title="Click to read full notice">Read more ▾</span>';
    },
    scrollToNotice(id) {
      if (!id) return;
      this.expandedNotices = { ...this.expandedNotices, [id]: true };
      this.$nextTick(() => {
        const el = document.getElementById('notice-' + id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('notice-highlight');
          setTimeout(() => el.classList.remove('notice-highlight'), 2000);
        }
      });
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
    async togglePreferredDept(deptId) {
      if (Number(this.preferredDeptId) === Number(deptId)) {
        await this.savePreferredDept(null);
      } else {
        await this.savePreferredDept(deptId);
      }
    },
    async savePreferredDept(deptId) {
      const slug = this.org?.slug || this.$route?.params?.slug || 'bugema';
      if (deptId === null) {
        localStorage.removeItem('pref_dept_' + slug);
        this.preferredDeptId = null;
        this.selectedDept = null;
        notificationService.updateDeptPreference(null);
        const toast = await toastController.create({
          message: 'Cleared default department view.',
          duration: 2000,
          color: 'warning',
          position: 'bottom'
        });
        await toast.present();
        return;
      }
      localStorage.setItem('pref_dept_' + slug, String(deptId));
      this.preferredDeptId = Number(deptId);
      this.selectedDept = Number(deptId);
      this.selectedCategory = 'All';
      notificationService.updateDeptPreference(deptId);
      const deptObj = (this.departments || []).find(d => Number(d.id) === Number(deptId));
      const deptName = deptObj ? deptObj.name : 'Department';
      const toast = await toastController.create({
        message: `📌 Saved '${deptName}' as your default department on this device!`,
        duration: 2500,
        color: 'success',
        position: 'bottom'
      });
      await toast.present();
    },
    async loadAll() {
      this.loading = true;
      this.errorMessage = null;
      const slug = this.$route?.params?.slug || import.meta.env.VITE_STANDALONE_ORG || 'bugema';
      const savedLastVisit = localStorage.getItem('last_visit_' + slug);
      this.lastVisitTimestamp = savedLastVisit ? Number(savedLastVisit) : null;
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

          // 📌 Zero-Login Department Auto-Focus
          const savedPref = localStorage.getItem('pref_dept_' + slug);
          if (savedPref && this.selectedDept === null) {
            const matchedDept = (this.departments || []).find(d => Number(d.id) === Number(savedPref));
            if (matchedDept) {
              this.selectedDept = matchedDept.id;
              this.preferredDeptId = matchedDept.id;
            }
          }
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
          this.applyAutoTranslate();
        }
      } catch (err) {
        console.error('Load board error:', err);
        // Offline / network failure fallback: Load cached notices from offline storage
        const cached = await getOfflineBoard(slug);
        if (cached && (cached.org || (cached.notices && cached.notices.length > 0))) {
          console.log(`📦 Loaded notice board '${slug}' from offline cache`);
          this.org = cached.org || { name: 'Bugema Notice Board', slug: 'bugema' };
          this.membership = cached.membership || null;
          this.locked = cached.locked || false;
          this.notices = cached.notices || [];
          this.allNotices = cached.notices || [];
          this.departments = cached.departments || [];
          this.isOfflineMode = true;
          this.errorMessage = null;
          this.applyAutoTranslate();
        } else {
          this.isOfflineMode = true;
          this.errorMessage = 'Oops! Please check your internet connection and try again.';
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
          this.applyAutoTranslate();
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
    openAttachment(url, mode = 'view') {
      if (!url) return;
      const info = this.getAttachmentInfo(url);
      const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform();

      if (mode === 'download') {
        // Always trigger a download via anchor tag
        const a = document.createElement('a');
        a.href = url;
        a.download = url.split('/').pop().split('?')[0] || 'attachment';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      if (mode === 'view-external') {
        // Explicit fallback: open in browser
        window.open(url, '_blank', 'noopener,noreferrer');
        return;
      }

      // Images: use existing lightbox (works perfectly on all platforms)
      if (info.isImage) {
        this.lightbox = { show: true, images: [url], index: 0 };
        return;
      }

      // PDFs and documents: open in-app viewer using Google Docs Viewer
      // Google Docs Viewer renders PDFs/DOC/XLS/PPT inside an iframe — works in Android WebView
      const googleDocsUrl = `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(url)}`;
      this.docViewer = {
        show: true,
        url,
        iframeSrc: googleDocsUrl,
        title: info.name + '.' + info.ext,
        ext: info.ext,
        loading: true
      };
    },
    closeDocViewer() {
      this.docViewer = { show: false, url: '', iframeSrc: '', title: '', ext: '', loading: false };
    },
    getAttachmentInfo(url) {
      if (!url) return { name: 'Attachment', ext: 'file', isImage: false };
      const raw = url.split('/').pop().split('?')[0] || 'attachment';
      const parts = raw.split('.');
      const ext = parts.length > 1 ? parts.pop().toLowerCase() : 'file';
      // Decode URI and truncate for display
      let name = decodeURIComponent(parts.join('.') || raw);
      if (name.length > 32) name = name.substring(0, 29) + '...';
      const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'heic'];
      const isImage = imageExts.includes(ext);
      return { name: name || 'Attachment', ext, isImage };
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
      const titleText = `${org.name} - Digital Notice Board`;
      const descText = `Official Digital Notice Board for ${org.name}. View official announcements, academic notices, and campus communications.`;
      const isBugema = (org.slug === 'bugema') || (org.name && org.name.toLowerCase().includes('bugema'));
      const logoUrl = org.logo_url || (isBugema ? '/bugema-logo.png' : '/logo.png');
      const manifestUrl = isBugema ? '/manifest-bugema.json' : '/manifest.json';
      const appName = isBugema ? 'Bugema Notice' : `${org.name} Notice`;

      this.originalTitle = document.title;
      document.title = titleText;

      const setMeta = (id, prop, val) => {
        let el = document.getElementById(id) || document.querySelector(`meta[property='${prop}']`) || document.querySelector(`meta[name='${prop}']`);
        if (el) {
          el.setAttribute('content', val);
        } else {
          const meta = document.createElement('meta');
          if (prop.startsWith('og:')) meta.setAttribute('property', prop);
          else meta.setAttribute('name', prop);
          meta.setAttribute('content', val);
          document.head.appendChild(meta);
        }
      };

      setMeta('meta-title', 'title', titleText);
      setMeta('og-title', 'og:title', titleText);
      setMeta('twitter-title', 'twitter:title', titleText);

      setMeta('meta-desc', 'description', descText);
      setMeta('og-desc', 'og:description', descText);
      setMeta('twitter-desc', 'twitter:description', descText);

      setMeta('og-image', 'og:image', logoUrl);
      setMeta('twitter-image', 'twitter:image', logoUrl);

      setMeta('apple-title', 'apple-mobile-web-app-title', appName);
      setMeta('app-name', 'application-name', appName);

      // Favicon
      let link = document.getElementById('app-favicon') || document.querySelector("link[rel*='icon']");
      if (link) {
        this.originalFavicon = link.href;
        link.href = logoUrl;
      }

      // Apple Touch Icon (Critical for iOS PWA Home Screen icon!)
      let appleIcon = document.getElementById('app-apple-touch-icon') || document.querySelector("link[rel='apple-touch-icon']");
      if (appleIcon) {
        appleIcon.href = logoUrl;
      }

      // Manifest link
      let manifest = document.getElementById('manifest-link') || document.querySelector("link[rel='manifest']");
      if (manifest) {
        manifest.setAttribute('href', manifestUrl);
      }
    },
    restoreFaviconAndTitle() {
      if (this.originalTitle) document.title = this.originalTitle;
      const link = document.getElementById('app-favicon') || document.querySelector("link[rel*='icon']");
      if (link) link.href = this.originalFavicon || '/logo.png';

      const appleIcon = document.getElementById('app-apple-touch-icon') || document.querySelector("link[rel='apple-touch-icon']");
      if (appleIcon) appleIcon.href = '/logo.png';

      const manifest = document.getElementById('manifest-link') || document.querySelector("link[rel='manifest']");
      if (manifest) manifest.setAttribute('href', '/manifest.json');
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
      const isDark = i18nState.theme === 'dark' || (typeof document !== 'undefined' && document.body.classList.contains('dark'));
      const fallback = isDark ? this.defaultAvatarGold : this.defaultAvatarBlue;
      if (notice && notice.dept_logo) {
        let url = notice.dept_logo;
        if (url.startsWith('/')) url = `${this.API_URL}${url}`;
        return url;
      }
      if (!notice || !notice.author_avatar) return fallback;
      let url = notice.author_avatar;
      if (url.startsWith('/')) url = `${this.API_URL}${url}`;
      return url;
    },
    onAvatarError(event) {
      if (event && event.target) {
        const isDark = i18nState.theme === 'dark' || (typeof document !== 'undefined' && document.body.classList.contains('dark'));
        event.target.src = isDark ? this.defaultAvatarGold : this.defaultAvatarBlue;
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
            this.applyAutoTranslate();
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
      socket.on('notice:update', this.handleSocketNoticeUpdate);
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

    // Network status change listeners
    this._handleOnline = () => {
      console.log('🌐 Network online detected. Refreshing Bugema Notice Board...');
      this.isOfflineMode = false;
      this.loadAll();
    };
    this._handleOffline = () => {
      console.log('📶 Network offline detected. Switching to cached notices mode...');
      this.isOfflineMode = true;
    };
    window.addEventListener('online', this._handleOnline);
    window.addEventListener('offline', this._handleOffline);

    // ── Polling fallback ─────────────────────────────────────────────────────
    // Polls every 15s so notices appear automatically even when socket fails
    // (LAN environment, backend restart, etc.)
    this._pollInterval = setInterval(() => {
      this._pollForNewNotices();
    }, 15000);
  },
  unmounted() {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    window.removeEventListener('scroll', this.handleScroll);
    if (this._handleOnline) window.removeEventListener('online', this._handleOnline);
    if (this._handleOffline) window.removeEventListener('offline', this._handleOffline);
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
      socket.off('notice:update', this.handleSocketNoticeUpdate);
    }
    this.restoreFaviconAndTitle();
  }
};
</script>

<style scoped>
/* ─── Toolbar ─────────────────────────────────────────────── */
.glass-toolbar {
  --background: transparent;
  --border-width: 0;
  --min-height: 30px;
  padding: 3px 8px 2px 8px;
  contain: none;
}

.header-brand-card {
  background: transparent;
  border-radius: 8px;
  border: none;
  box-shadow: none;
  padding: 3px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  box-sizing: border-box;
}

.header-card-start,
.header-card-end {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.header-admin-gear-btn {
  background: transparent;
  border: none;
  color: #1208a1;
  font-size: 0.9rem;
  padding: 2px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.org-header-title {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.org-header-title.centered-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex: 1;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  padding: 0;
  overflow: hidden;
}

.brand-title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  max-width: 100%;
}

.brand-word-left,
.brand-word-right {
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: #1208a1;
  line-height: 1;
  white-space: nowrap;
}

.mini-logo-wrap {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.mini-logo {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}

.mini-logo-ring {
  display: none;
}

.header-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1;
}

.board-title {
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.board-subtitle {
  font-size: 0.6rem;
  color: #64748b;
  font-weight: 600;
  letter-spacing: 0.2px;
  margin-top: 0;
}

.official-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: rgba(18, 8, 161, 0.12);
  color: #1208a1;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  border: 1px solid rgba(18, 8, 161, 0.3);
  text-transform: uppercase;
}

.institution-header-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(18, 8, 161, 0.12);
  color: #1208a1;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 4px 10px;
  border-radius: 12px;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.login-btn-sm {
  --color: #1208a1;
  --border-radius: 10px;
  font-weight: 700;
  font-size: 0.8rem;
}

.board-domain {
  font-size: 0.7rem;
  color: #1208a1;
  font-weight: 500;
  opacity: 0.8;
}

.back-btn {
  --color: #1208a1;
}

.settings-btn {
  --color: #888;
}

/* Language & Theme settings button in the board header (desktop/tablet only) */
.header-settings-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: #666;
  transition: all 0.2s ease;
}

.header-settings-btn:hover {
  background: rgba(18, 8, 161, 0.12);
  color: #1208a1;
}

.header-settings-icon {
  font-size: 1.3rem;
}

@media (max-width: 767px) {
  .desktop-header-settings {
    display: none;
  }
}

/* ─── Board Content ────────────────────────────────────────── */
.board-content {
  --background: var(--ion-background-color, #ffffff);
  --color: var(--ion-text-color, #111827);
}

/* ─── Loading ──────────────────────────────────────────────── */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 65vh;
  gap: 20px;
  background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #111827);
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
  box-shadow: 0 4px 16px rgba(18, 8, 161, 0.3);
  z-index: 2;
  border: 2px solid #ffffff;
}

.loading-spinner-ring {
  position: absolute;
  inset: -8px;
  width: 116px;
  height: 116px;
  color: #1208a1;
  --color: #1208a1;
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
  background: radial-gradient(circle, rgba(18, 8, 161, 0.2) 0%, transparent 70%);
  border-radius: 50%;
}

.lock-circle {
  width: 84px;
  height: 84px;
  background: #1208a1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(18, 8, 161, 0.4);
  z-index: 2;
}

.lock-icon {
  font-size: 42px;
  color: #fff;
}

.pulse-ring {
  position: absolute;
  border-radius: 50%;
  border: 2px solid rgba(18, 8, 161, 0.4);
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
  --background: #1208a1;
  --background-activated: #1208a1;
  --color: #000;
  --border-radius: 14px;
  --padding-start: 28px;
  --padding-end: 28px;
  font-weight: 800;
  font-size: 1rem;
  height: 52px;
  box-shadow: 0 8px 24px rgba(18, 8, 161, 0.35);
}

.pending-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(18, 8, 161, 0.08);
  border: 1.5px dashed rgba(18, 8, 161, 0.5);
  color: #1208a1;
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
  background: var(--ion-card-background, #ffffff);
  border-bottom: 1px solid var(--ion-border-color, rgba(0,0,0,0.06));
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
    rgba(18, 8, 161, 0.06) 0%,
    rgba(18, 8, 161, 0.03) 50%,
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
  background: #ffffff;
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
  color: var(--ion-text-color, #1a1a1a);
  letter-spacing: -0.3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.org-domain {
  font-size: 0.78rem;
  color: #1208a1;
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
  color: var(--ion-text-color, #1a1a1a);
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
  background: rgba(18, 8, 161, 0.08);
  padding: 4px 10px;
  border-radius: 20px;
  flex-direction: row;
  gap: 5px;
  align-items: center;
}

.member-icon {
  color: #1208a1;
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
  background: var(--ion-card-background, #ffffff);
  position: sticky;
  top: 0;
  z-index: 10;
  border-bottom: 1px solid var(--ion-border-color, rgba(0,0,0,0.06));
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}

.category-scroll {
  display: flex;
  padding: 4px 12px 6px;
  gap: 7px;
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
  border-color: rgba(18, 8, 161, 0.4);
  color: #1208a1;
  background: rgba(18, 8, 161, 0.05);
}

.cat-pill--active {
  background: #1208a1;
  color: #ffffff;
  border-color: transparent;
  font-weight: 800;
  box-shadow: 0 3px 12px rgba(18, 8, 161, 0.3);
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
  background: rgba(18, 8, 161, 0.06);
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}

.empty-icon {
  font-size: 40px;
  color: #1208a1;
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
  background: #ffffff !important;
  color: var(--ion-text-color, #1a1a1a);
  border-radius: 16px;
  padding: 0;
  margin-bottom: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
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
  background: linear-gradient(90deg, rgba(18, 8, 161, 0.08), transparent);
  padding: 7px 18px;
  font-size: 0.72rem;
  font-weight: 700;
  color: #1208a1;
  border-bottom: 1px solid rgba(18, 8, 161, 0.1);
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
  border: 1.5px solid rgba(18, 8, 161, 0.3);
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
  color: var(--ion-text-color, #1a1a1a);
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

/* Notice title & body font sizes */
.notice-title {
  font-size: 0.87rem;
  font-weight: 700;
  color: var(--ion-text-color, #1a1a1a);
  margin: 0 0 4px 0;
  line-height: 1.3;
  white-space: normal;
}

.notice-text {
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--ion-text-color, #1a1a1a);
  margin: 0;
  word-break: break-word;
}

/* Body */
.notice-body {
  padding: 10px 14px 4px;
}

.show-more-toggle {
  color: #1208a1;
  font-size: 0.92rem;
  cursor: pointer;
  margin-top: 6px;
  font-weight: 600;
  display: inline-block;
  user-select: none;
}

.show-more-toggle:hover {
  text-decoration: underline;
  color: #1208a1;
}

/* ── Link and Read-More styles (Clean text, no bg/borders) ──── */
.show-more-toggle,
.notice-text :deep(.read-more),
:deep(.read-more) {
  color: #1208a1 !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  font-weight: 750 !important;
  font-size: 0.88rem !important;
  padding: 0 !important;
  margin-left: 4px !important;
  cursor: pointer !important;
  display: inline !important;
  user-select: none !important;
  text-decoration: underline !important;
  transition: opacity 0.15s ease !important;
}

.notice-text :deep(.read-more:hover),
:deep(.read-more:hover),
.show-more-toggle:hover {
  color: #1208a1 !important;
  text-decoration: underline !important;
  background: none !important;
  box-shadow: none !important;
  opacity: 0.85 !important;
}

.notice-text :deep(a),
.notice-text :deep(.notice-link),
.notice-text :deep(.post-link),
:deep(a.notice-link),
:deep(a.post-link),
.hashtag,
.mention {
  color: #1208a1 !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
  font-weight: 700 !important;
  word-break: break-all !important;
  cursor: pointer !important;
  text-decoration: underline !important;
  display: inline !important;
}

.notice-text :deep(a:hover),
.notice-text :deep(.notice-link:hover),
.notice-text :deep(.post-link:hover),
:deep(a.notice-link:hover),
:deep(a.post-link:hover) {
  color: #1208a1 !important;
  text-decoration: underline !important;
  background: none !important;
  box-shadow: none !important;
  opacity: 0.85 !important;
}

.notice-attachment-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid rgba(0, 0, 0, 0.07);
  border-radius: 12px;
  padding: 10px 14px;
  margin: 10px 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.notice-attachment-card:hover {
  background: #f1f5f9;
  border-color: rgba(18, 8, 161, 0.3);
  transform: translateY(-1px);
}

.attach-filename {
  font-size: 0.88rem;
  font-weight: 750;
  color: #111827 !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

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
  background: rgba(18, 8, 161, 0.08);
  color: #1208a1;
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
/* ── Notice Media & Flyers ──────────────────────────── */
.notice-media-grid {
  margin: 10px 16px;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(18, 8, 161, 0.18);
  background: #080c10;
  display: grid;
  gap: 2px;
}

.notice-media-grid.nm-count-1 {
  grid-template-columns: 1fr;
  max-height: 650px;
}

.notice-media-grid.nm-count-1 .nm-cell {
  width: 100%;
  max-height: 650px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #080c10;
}

.notice-media-grid.nm-count-1 .nm-img {
  width: 100%;
  height: auto;
  max-height: 650px;
  object-fit: contain !important;
  display: block;
}

.notice-media-grid.nm-count-2 {
  grid-template-columns: 1fr 1fr;
  max-height: 380px;
}

.notice-media-grid.nm-count-3,
.notice-media-grid.nm-count-4 {
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  max-height: 420px;
}

.nm-cell {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  background: #080c10;
}

.nm-count-2 .nm-cell,
.nm-count-3 .nm-cell,
.nm-count-4 .nm-cell {
  height: 190px;
}

.nm-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.25s ease;
}

.nm-cell:hover .nm-img {
  transform: scale(1.02);
}

.nm-more-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  color: #ffffff;
  font-size: 1.4rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* ── Attachment Card ───────────────────────────────── */
.notice-attachment-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 10px 12px;
  margin: 10px 14px;
  transition: background 0.2s;
}

.notice-attachment-card:hover {
  background: #f1f5f9;
}

.attach-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.attach-card-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 20px;
  background: rgba(18, 8, 161, 0.12);
  color: #1208a1;
}

/* Format-specific icon colours */
.attach-icon--pdf  { background: rgba(239,68,68,0.12);  color: #ef4444; }
.attach-icon--doc,
.attach-icon--docx { background: rgba(18, 8, 161,0.12); color: #3b82f6; }
.attach-icon--xls,
.attach-icon--xlsx { background: rgba(16,185,129,0.12); color: #10b981; }
.attach-icon--ppt,
.attach-icon--pptx { background: rgba(249,115,22,0.12); color: #f97316; }
.attach-icon--png,
.attach-icon--jpg,
.attach-icon--jpeg,
.attach-icon--gif,
.attach-icon--webp { background: rgba(139,92,246,0.12); color: #8b5cf6; }

.attach-card-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attach-filename {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--text-primary, #e2e8f0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 160px;
}

.attach-meta-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.attach-format-badge {
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 5px;
  text-transform: uppercase;
  background: rgba(18, 8, 161,0.15);
  color: #1208a1;
}

/* Format-specific badge colours */
.fmt-pdf  { background: rgba(239,68,68,0.15);  color: #ef4444; }
.fmt-doc, .fmt-docx { background: rgba(18, 8, 161,0.15); color: #3b82f6; }
.fmt-xls, .fmt-xlsx { background: rgba(16,185,129,0.15); color: #10b981; }
.fmt-ppt, .fmt-pptx { background: rgba(249,115,22,0.15); color: #f97316; }
.fmt-png, .fmt-jpg, .fmt-jpeg, .fmt-gif, .fmt-webp { background: rgba(139,92,246,0.15); color: #8b5cf6; }

.attach-label-text {
  font-size: 0.72rem;
  color: var(--text-muted, #64748b);
  font-weight: 500;
}

.attach-card-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.attach-action-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 11px;
  border-radius: 9px;
  border: none;
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}

.attach-view-btn {
  background: rgba(18, 8, 161,0.12);
  color: #1208a1;
  border: 1px solid rgba(18, 8, 161,0.25);
}

.attach-view-btn:hover {
  background: rgba(18, 8, 161,0.22);
  transform: translateY(-1px);
}

.attach-download-btn {
  background: rgba(16,185,129,0.12);
  color: #10b981;
  border: 1px solid rgba(16,185,129,0.25);
}

.attach-download-btn:hover {
  background: rgba(16,185,129,0.22);
  transform: translateY(-1px);
}

.attach-action-btn ion-icon {
  font-size: 14px;
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
  background: var(--ion-background-color, #f5f5f7);
  color: var(--ion-text-color, #111827);
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
  background: var(--ion-card-background, #fff);
  color: var(--ion-text-color, #111827);
  border-radius: 16px;
  padding: 14px 16px;
  border: 1px solid var(--ion-border-color, rgba(0,0,0,0.05));
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
  color: #1208a1;
  margin-bottom: 2px;
}

.ms-val {
  font-size: 1.3rem;
  font-weight: 900;
  color: var(--ion-text-color, #1a1a1a);
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
  background: linear-gradient(90deg, rgba(18, 8, 161,0.08), transparent);
  border-radius: 12px;
  margin-bottom: 8px;
  border-left: 3px solid #1208a1;
}

.dept-group-icon {
  width: 32px;
  height: 32px;
  background: rgba(18, 8, 161,0.12);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #1208a1;
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
.role-dot--org_admin    { background: #1208a1; }
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
.role-badge--org_admin    { background: rgba(18, 8, 161,0.12); color: #1208a1; }
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
  --color: #1208a1;
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
  color: #1208a1;
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
  background: var(--ion-card-background, #fff);
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
  background: #1208a1;
  color: #ffffff;
  border-color: transparent;
  font-weight: 800;
  box-shadow: 0 3px 10px rgba(18, 8, 161,0.3);
}

/* Desktop grid — 3 columns, X-style: centered canvas with white space at the
   screen edges, and a feed column that never gets too wide on large displays. */
.board-desktop-grid {
  display: flex;
  max-width: 1280px;
  margin: 0 auto;
  min-height: calc(100vh - 120px);
  background: transparent;
}

/* ── Left Sidebar (Desktop/Tablet only) ───────────── */
.dept-sidebar {
  display: none !important; /* strictly hidden on mobile */
  width: 300px;
  min-width: 260px;
  max-width: 320px;
  flex-shrink: 0;
  padding: 16px 14px;
  border-right: 1px solid var(--ion-border-color, rgba(0,0,0,0.07));
  background: var(--ion-background-color, #ffffff);
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 0;
  height: calc(100vh - 112px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(18, 8, 161,0.2) transparent;
}
.dept-sidebar::-webkit-scrollbar { width: 4px; }
.dept-sidebar::-webkit-scrollbar-thumb { background: rgba(18, 8, 161,0.25); border-radius: 4px; }

.sidebar-org-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(18, 8, 161,0.06), rgba(18, 8, 161,0.03));
  border: 1px solid rgba(18, 8, 161,0.15);
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
  color: #1208a1;
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
  color: var(--ion-color-medium, #888);
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
  color: var(--ion-text-color, #444);
}
.dept-nav-item:hover {
  background: rgba(18, 8, 161,0.07);
  color: #1208a1;
}
.dept-nav-item--active {
  background: linear-gradient(135deg, rgba(18, 8, 161,0.12), rgba(18, 8, 161,0.06));
  color: #1208a1;
  font-weight: 700;
}
.dept-nav-icon-wrap {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  background: rgba(18, 8, 161,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  flex-shrink: 0;
  color: #1208a1;
  transition: background 0.18s;
}
.dept-nav-item--active .dept-nav-icon-wrap {
  background: rgba(18, 8, 161,0.18);
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
  background: rgba(18, 8, 161,0.15);
  color: #1208a1;
}

.sidebar-auth-box {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(0,0,0,0.05);
}
.sidebar-post-btn {
  --background: #1208a1;
  --color: #ffffff;
  --border-radius: 12px;
  font-weight: 800;
  font-size: 0.9rem;
  height: 44px;
}
.sidebar-login-btn {
  --color: #1208a1;
  --border-radius: 12px;
  --border-color: rgba(18, 8, 161,0.4);
  font-weight: 700;
  font-size: 0.85rem;
  height: 44px;
}

/* ── Middle Feed Column ───────────────────────────── */
.feed-col {
  flex: 1;
  min-width: 0;
  max-width: 600px;
  margin: 0 auto;
  background: var(--ion-background-color, #f3f4f6);
  display: flex;
  flex-direction: column;
}

.active-dept-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(18, 8, 161,0.1);
  border: 1.5px solid rgba(18, 8, 161,0.35);
  border-radius: 12px;
  margin: 10px 14px 14px 14px;
  font-size: 0.88rem;
  font-weight: 700;
  color: #1208a1;
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
  background: #ffffff;
  flex-direction: column;
  gap: 14px;
  position: sticky;
  top: 0;
  height: calc(100vh - 112px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(18, 8, 161,0.2) transparent;
}
.widgets-col::-webkit-scrollbar { width: 4px; }
.widgets-col::-webkit-scrollbar-thumb { background: rgba(18, 8, 161,0.25); border-radius: 4px; }

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
.widget-header ion-icon { font-size: 15px; color: #1208a1; }
.widget-header--urgent { color: #c0392b; }
.widget-header--urgent ion-icon { color: #ef4444; }
.widget-count {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 800;
  background: rgba(18, 8, 161,0.12);
  color: #1208a1;
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
  background: rgba(18, 8, 161,0.4);
  flex-shrink: 0;
  margin-top: 5px;
}
.wni-dot--urgent  { background: #ef4444; }
.wni-dot--pinned  { background: #1208a1; }
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
  color: #1208a1;
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
  background: var(--ion-card-background, #ffffff);
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
  color: var(--ion-text-color, #1a1a1a);
}

.widget-notice-item:hover {
  background: rgba(18, 8, 161, 0.08);
  border-color: rgba(18, 8, 161, 0.2);
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
  border: 1px solid rgba(18, 8, 161, 0.25);
  background: var(--ion-card-background, #ffffff);
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
  border: 2px dashed #1208a1;
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
    box-shadow: 0 0 0 4px rgba(18, 8, 161, 0.6), 0 8px 30px rgba(18, 8, 161, 0.3);
    transform: scale(1.01);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(18, 8, 161, 0.6), 0 8px 30px rgba(18, 8, 161, 0.3);
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
  .widgets-col,
  .board-widgets-col {
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
    width: 100vw;
    max-width: 100vw;
    box-sizing: border-box;
    height: 60px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.06);
    z-index: 9999;
    align-items: center;
    justify-content: space-around;
    padding: 4px 4px;
    overflow: hidden;
  }

  .mobile-nav-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    padding: 4px 4px;
    border-radius: 10px;
    cursor: pointer;
    color: #64748b;
    font-size: 0.65rem;
    font-weight: 600;
    gap: 2px;
    flex: 1;
    min-width: 0;
    position: relative;
    transition: all 0.2s ease;
    overflow: hidden;
  }

  .mobile-nav-btn span {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-nav-btn ion-icon {
    font-size: 20px;
    color: #666;
    transition: color 0.2s;
  }

  .mobile-nav-btn--active {
    color: #1208a1;
    font-weight: 800;
  }

  .mobile-nav-btn--active ion-icon {
    color: #1208a1;
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
    background: #1208a1;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(18, 8, 161, 0.4);
  }

  .mobile-post-nav-btn .post-icon-wrap ion-icon {
    color: #ffffff;
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
  background: #1208a1;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(18, 8, 161, 0.4);
  z-index: 99999;
  transition: transform 0.2s, box-shadow 0.2s;
  color: #ffffff;
  font-size: 28px;
}

.notice-post-btn:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 28px rgba(18, 8, 161, 0.6);
}

.notice-post-btn ion-icon {
  font-size: 28px;
  color: #ffffff;
}

@media (max-width: 767px) {
  .notice-post-btn {
    display: none !important;
  }
}

/* ── Profile Icon Button in Top Bar ─────────── */
.profile-icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 1px 4px;
  display: flex;
  align-items: center;
}
.profile-icon-wrap {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  border: 1.5px solid rgba(18, 8, 161, 0.7);
  background: rgba(18, 8, 161, 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.profile-icon-btn:hover .profile-icon-wrap {
  border-color: #1208a1;
  box-shadow: 0 0 6px rgba(18, 8, 161, 0.45);
}
.profile-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-thumb-icon {
  font-size: 13px;
  color: #1208a1;
}
/* Compact Ionic searchbar */
.notice-searchbar {
  --min-height: 36px !important;
  height: 36px !important;
  --padding-top: 0px !important;
  --padding-bottom: 0px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
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
  border-left: 1px solid rgba(18, 8, 161,0.25);
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
  background: rgba(18, 8, 161,0.18);
  color: #1208a1;
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
  background: rgba(18, 8, 161,0.1);
  border: 3px solid #1208a1;
  box-shadow: 0 0 24px rgba(18, 8, 161,0.35);
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
  color: #1208a1;
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
  color: #1208a1;
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
  background: rgba(18, 8, 161,0.1);
  border: 1px solid rgba(18, 8, 161,0.3);
  border-radius: 24px;
  padding: 6px 14px;
  font-size: 0.8rem;
  color: #1208a1;
  font-weight: 500;
  flex-wrap: wrap;
  justify-content: center;
}
.membership-role {
  background: rgba(18, 8, 161,0.2);
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
  background: #1208a1;
  color: #ffffff;
  padding: 4px 8px 4px 14px;
  border-radius: 30px;
  box-shadow: 0 8px 24px rgba(18, 8, 161, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15);
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
  color: #3b82f6;
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
    box-shadow: 0 0 0 3px rgba(18, 8, 161, 0.6), 0 8px 24px rgba(18, 8, 161, 0.25);
    transform: translateY(-2px);
  }
  70% {
    box-shadow: 0 0 0 3px rgba(18, 8, 161, 0.3);
  }
  100% {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transform: translateY(0);
  }
}

.offline-notice-banner {
  background: #1208a1;
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
  background: rgba(18, 8, 161, 0.08);
  border: 1px solid rgba(18, 8, 161, 0.2);
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
  color: #1208a1;
  background: rgba(18, 8, 161, 0.15);
  padding: 3px 10px;
  border-radius: 8px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* 📌 Zero-Login Department Preference Pins */
.pref-pin-badge {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.05);
  color: #666;
  cursor: pointer;
  margin-left: auto;
  margin-right: 6px;
  transition: all 0.2s ease;
  user-select: none;
}

.pref-pin-badge:hover {
  background: rgba(18, 8, 161, 0.18);
  color: #1208a1;
}

.pref-pin-badge--active {
  background: rgba(18, 8, 161, 0.22) !important;
  color: #1208a1 !important;
  border: 1px solid rgba(18, 8, 161, 0.4) !important;
  font-weight: 800 !important;
}

.pin-my-dept-btn {
  background: rgba(18, 8, 161, 0.12);
  border: 1px solid rgba(18, 8, 161, 0.35);
  color: #1208a1;
  font-size: 0.75rem;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  margin-left: 10px;
  transition: all 0.2s ease;
}

.pin-my-dept-btn:hover {
  background: rgba(18, 8, 161, 0.22);
  transform: translateY(-1px);
}

.pin-my-dept-btn--active {
  background: #1208a1;
  color: #000;
  font-weight: 800;
  border-color: #1208a1;
}

/* 📱 Mobile Department Selector Pills & Pin Controls */
.dept-mobile-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 8px 4px 4px 4px;
  margin-top: 6px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.dept-mobile-scroll::-webkit-scrollbar {
  display: none;
}

.mobile-dept-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: var(--ion-background-color, #ffffff);
  color: var(--ion-text-color, #333);
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mobile-dept-pill:hover {
  background: rgba(18, 8, 161, 0.1);
  border-color: rgba(18, 8, 161, 0.4);
}

.mobile-dept-pill--active {
  background: rgba(18, 8, 161, 0.15) !important;
  border-color: #1208a1 !important;
  color: #1208a1 !important;
  font-weight: 800 !important;
}

.mobile-dept-pill--saved {
  border-color: rgba(18, 8, 161, 0.6) !important;
}

.mobile-pin-btn {
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.06);
  color: #555;
  margin-left: 4px;
  transition: all 0.15s ease;
}

.mobile-pin-btn--saved {
  background: #1208a1 !important;
  color: #000 !important;
  font-weight: 800 !important;
}

/* 🏷️ Active Department Banner (Mobile Portrait & Landscape & Desktop) */
.active-dept-label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 10px 14px;
  background: rgba(18, 8, 161, 0.1);
  border: 1.5px solid rgba(18, 8, 161, 0.35);
  border-radius: 12px;
  margin: 10px 0 16px 0;
  font-size: 0.88rem;
  font-weight: 700;
  color: #1208a1;
}

.active-dept-title-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.active-dept-title-box ion-icon {
  font-size: 1.2rem;
  color: #1208a1;
  flex-shrink: 0;
}

.active-dept-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.active-dept-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.pin-my-dept-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1.5px solid rgba(18, 8, 161, 0.5);
  background: rgba(18, 8, 161, 0.12);
  color: #1208a1;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.pin-my-dept-btn:hover {
  background: rgba(18, 8, 161, 0.25);
}

.pin-my-dept-btn--active {
  background: #1208a1 !important;
  color: #000000 !important;
  border-color: transparent !important;
  font-weight: 800 !important;
  box-shadow: 0 2px 8px rgba(18, 8, 161, 0.3) !important;
}

.clear-dept-btn {
  background: transparent;
  border: none;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 1.2rem;
  padding: 2px;
}
.clear-dept-btn:hover {
  color: #ef4444;
}

/* 📱 Mobile Search & Department Select Row */
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 100%;
  padding: 4px 10px 2px 10px;
  box-sizing: border-box;
}

.search-wrap {
  flex: 1;
  min-width: 0;
}

.mobile-dept-dropdown-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.mobile-dept-select-box {
  --background: rgba(18, 8, 161, 0.08);
  --border-radius: 12px;
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  color: #1208a1;
  border: 1px solid rgba(18, 8, 161, 0.3);
  border-radius: 12px;
  max-width: 110px;
  height: 40px;
}

/* 🌙 DARK MODE OVERRIDES FOR NOTICE BOARD & APP */
body.dark .board-content,
body.dark .board-feed,
body.dark .notice-card,
body.dark .modal-content,
body.dark .notice-detail-card {
  background-color: #16181c !important;
  color: #f3f4f6 !important;
  border-color: #2f3336 !important;
}

body.dark .notice-title,
body.dark .auth-name,
body.dark .empty-title,
body.dark .board-subtitle,
body.dark .dept-name,
body.dark .member-name,
body.dark .role-title {
  color: #f3f4f6 !important;
}

body.dark .notice-text,
body.dark .empty-desc,
body.dark .auth-handle,
body.dark .notice-date {
  color: #9ca3af !important;
}

body.dark .dept-sidebar,
body.dark .dept-nav,
body.dark .dept-nav-item, html.dark .dept-nav-item, .dark .dept-nav-item { background: #0f1419 !important; color: #f3f4f6 !important; border-color: #2f3336 !important; }

body.dark .cat-pill, html.dark .cat-pill, .dark .cat-pill { background: #21262d !important; color: #c9d1d9 !important; border-color: #30363d !important; }

body.dark .cat-pill--active, html.dark .cat-pill--active, .dark .cat-pill--active { background: #ffd700 !important; color: #000000 !important; font-weight: 800 !important; box-shadow: 0 2px 10px rgba(255, 215, 0, 0.4) !important; }

body.dark .members-table-container,
body.dark .members-table,
body.dark .notice-detail-content {
  background: #16181c !important;
  color: #f3f4f6 !important;
}

/* 🖼️ Export Institutional Flyer Button */
.export-flyer-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 18px;
  border: 1.5px solid rgba(18, 8, 161, 0.4);
  background: rgba(18, 8, 161, 0.08);
  color: #1208a1;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  white-space: nowrap;
}

.export-flyer-btn:hover {
  background: rgba(18, 8, 161, 0.2);
  border-color: #1208a1;
  transform: translateY(-1px);
}

.flyer-btn-icon {
  font-size: 0.95rem;
}

body.dark .export-flyer-btn, html.dark .export-flyer-btn, .dark .export-flyer-btn { background: rgba(255, 215, 0, 0.12) !important; color: #ffd700 !important; border-color: rgba(255, 215, 0, 0.35) !important; }

/* 🔗 One-Click Share Notice Button */
.share-notice-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 18px;
  border: 1.5px solid rgba(16, 185, 129, 0.4);
  background: rgba(16, 185, 129, 0.08);
  color: #059669;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  white-space: nowrap;
}

.share-notice-btn:hover {
  background: rgba(16, 185, 129, 0.18);
  border-color: #10b981;
  transform: translateY(-1px);
}

.share-btn-icon {
  font-size: 0.95rem;
}

body.dark .share-notice-btn {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-color: rgba(52, 211, 153, 0.4);
}

/* 🗓️ Add to Calendar Button */
.add-calendar-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 18px;
  border: 1.5px solid rgba(18, 8, 161, 0.4);
  background: rgba(18, 8, 161, 0.08);
  color: #1208a1;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  white-space: nowrap;
}

.add-calendar-btn:hover {
  background: rgba(18, 8, 161, 0.18);
  border-color: #1208a1;
  transform: translateY(-1px);
}

.cal-btn-icon {
  font-size: 0.95rem;
}

body.dark .add-calendar-btn, html.dark .add-calendar-btn, .dark .add-calendar-btn { background: rgba(255, 215, 0, 0.12) !important; color: #ffd700 !important; border-color: rgba(255, 215, 0, 0.35) !important; }

/* 🔊 Text-to-Speech Audio Reader Button */
.footer-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.audio-reader-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 18px;
  border: 1.5px solid rgba(18, 8, 161, 0.4);
  background: rgba(18, 8, 161, 0.08);
  color: #1208a1;
  font-size: 0.8rem;
  font-weight: 750;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
}

.audio-reader-btn:hover {
  background: rgba(18, 8, 161, 0.2);
  border-color: #1208a1;
  transform: translateY(-1px);
}

.audio-reader-btn--active {
  background: #1208a1 !important;
  color: #000000 !important;
  border-color: transparent !important;
  box-shadow: 0 3px 12px rgba(18, 8, 161, 0.4) !important;
  animation: audioPulse 1.5s infinite ease-in-out;
}

@keyframes audioPulse {
  0% { box-shadow: 0 0 0 0 rgba(18, 8, 161, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(18, 8, 161, 0); }
  100% { box-shadow: 0 0 0 0 rgba(18, 8, 161, 0); }
}

.audio-btn-icon {
  font-size: 1rem;
}

.audio-wave-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #000000;
  animation: waveDot 0.8s infinite alternate;
}

@keyframes waveDot {
  0% { transform: scale(0.6); opacity: 0.5; }
  100% { transform: scale(1.3); opacity: 1; }
}

body.dark .audio-reader-btn, html.dark .audio-reader-btn, .dark .audio-reader-btn { background: rgba(255, 215, 0, 0.12) !important; color: #ffd700 !important; border-color: rgba(255, 215, 0, 0.35) !important; }

body.dark .audio-reader-btn--active {
  background: #1208a1 !important;
  color: #000000 !important;
}

/* 🚨 Sticky Urgent Notice Banner (NEXFi Feeds Style) */
.urgent-ticker-banner {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(239, 68, 68, 0.08);
  border-bottom: 1px solid rgba(239, 68, 68, 0.15);
  padding: 8px 14px;
  cursor: pointer;
  animation: urgentPulse 3s infinite ease-in-out;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  border-radius: 0;
  transition: background-color 0.2s ease;
}

.urgent-ticker-banner:hover {
  background: rgba(239, 68, 68, 0.12);
}

@keyframes urgentPulse {
  0% { background-color: rgba(239, 68, 68, 0.08); }
  50% { background-color: rgba(239, 68, 68, 0.14); }
  100% { background-color: rgba(239, 68, 68, 0.08); }
}

.ticker-inner {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.ticker-icon {
  font-size: 1.2rem;
  color: #ef4444;
  animation: flashIcon 1.2s infinite alternate ease-in-out;
  flex-shrink: 0;
}

@keyframes flashIcon {
  from { opacity: 0.7; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1.04); }
}

.ticker-text-container {
  min-width: 0;
  flex: 1;
}

.ticker-text {
  font-size: 0.8rem;
  font-weight: 750;
  color: #b91c1c;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  letter-spacing: 0.2px;
  text-transform: uppercase;
}

.ticker-right-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  margin-left: 8px;
}

.ticker-arrow {
  font-size: 1.1rem;
  color: #ef4444;
  opacity: 0.85;
}

.ticker-dismiss-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  opacity: 0.6;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  font-size: 1.05rem;
  transition: opacity 0.2s;
}

.ticker-dismiss-btn:hover {
  opacity: 1;
}

body.dark .urgent-ticker-banner {
  background: rgba(239, 68, 68, 0.15) !important;
  border-color: rgba(239, 68, 68, 0.3) !important;
}

body.dark .ticker-text {
  color: #fca5a5 !important;
}


.new-unread-badge {
  background: linear-gradient(135deg, #10b981, #059669);
  color: #ffffff;
  font-size: 0.68rem;
  font-weight: 850;
  padding: 3px 8px;
  border-radius: 12px;
  letter-spacing: 0.4px;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
  animation: badgePop 0.4s ease-out;
}

.read-done-badge {
  color: #10b981;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

@keyframes badgePop {
  0% { transform: scale(0.7); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}



/* 📱 Responsive Mobile Action Buttons: Hide text labels on small screens, show icons only */
@media (max-width: 767px) {
  .flyer-btn-text,
  .share-btn-text,
  .cal-btn-text,
  .audio-btn-text {
    display: none !important;
  }

  .export-flyer-btn,
  .share-notice-btn,
  .add-calendar-btn,
  .audio-reader-btn {
    padding: 6px 9px !important;
    border-radius: 50% !important;
    width: 34px !important;
    height: 34px !important;
    min-width: 34px !important;
    justify-content: center !important;
  }

  .flyer-btn-icon,
  .share-btn-icon,
  .cal-btn-icon,
  .audio-btn-icon {
    font-size: 1.15rem !important;
    margin: 0 !important;
  }

  .footer-right-actions {
    gap: 6px !important;
  }
}
</style>





<style>
/* Force Ionic toolbar to respect our compact height */
ion-toolbar.glass-toolbar {
  --min-height: 30px !important;
  --padding-top: 3px !important;
  --padding-bottom: 2px !important;
  --padding-start: 8px !important;
  --padding-end: 8px !important;
  --background: transparent !important;
}

/* Borderless / transparent header wrapper */
ion-header.board-header-wrapper {
  --background: transparent !important;
  background: transparent !important;
  box-shadow: none !important;
  border-bottom: none !important;
}

ion-header.board-header-wrapper::after {
  display: none !important;
  content: none !important;
}

/* 📱 Responsive Mobile Hardening: Prevent horizontal cutoff */
ion-page,
ion-content,
.board-content,
.board-desktop-grid,
.feed-col {
  max-width: 100vw !important;
  box-sizing: border-box !important;
}

@media (max-width: 767px) {
  .board-desktop-grid {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }
  
  .feed-col {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .notice-card {
  font-family: Tahoma, 'Segoe UI', Geneva, Verdana, sans-serif !important;
  background: #ffffff !important;
  color: var(--ion-text-color, #1a1a1a);
  border-radius: 16px;
  padding: 0;
  margin-bottom: 12px;
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
  overflow: hidden;
  transition: transform 0.2s, box-shadow 0.2s;
  animation: cardIn 0.35s ease both;
  animation-delay: var(--delay, 0ms);
}

  .notice-header {
    padding: 12px 12px 0 12px !important;
  }

  .notice-body {
    padding: 10px 12px 4px !important;
  }

  .notice-attachment-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 10px 12px;
  margin: 10px 14px;
  transition: background 0.2s;
}

  .attach-filename {
    max-width: 120px !important;
  }

  .notice-footer {
    padding: 8px 10px 10px !important;
  }
}

/* ==========================================================================
   🌙 DARK THEME COMPLETE GOLD / YELLOW STYLING OVERRIDES
   ========================================================================== */

/* Header in dark mode */
body.dark .header-brand-card,
html.dark .header-brand-card,
.dark .header-brand-card {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
}

body.dark .brand-word-left,
body.dark .brand-word-right,
html.dark .brand-word-left,
html.dark .brand-word-right,
.dark .brand-word-left,
.dark .brand-word-right {
  color: #ffd700 !important;
}

body.dark .board-subtitle,
html.dark .board-subtitle,
.dark .board-subtitle {
  color: #9ca3af !important;
}

body.dark .header-admin-gear-btn,
html.dark .header-admin-gear-btn,
.dark .header-admin-gear-btn,
body.dark .header-settings-icon,
html.dark .header-settings-icon,
.dark .header-settings-icon {
  color: #ffd700 !important;
}

/* Category & Filter Pills in dark mode */
body.dark .cat-pill,
html.dark .cat-pill,
.dark .cat-pill {
  background: #16181c !important;
  color: #9ca3af !important;
  border-color: #2f3336 !important;
}

body.dark .cat-pill:hover,
html.dark .cat-pill:hover,
.dark .cat-pill:hover {
  border-color: rgba(255, 215, 0, 0.4) !important;
  color: #ffd700 !important;
  background: rgba(255, 215, 0, 0.08) !important;
}

body.dark .cat-pill--active,
html.dark .cat-pill--active,
.dark .cat-pill--active,
body.dark .dept-pill--active,
html.dark .dept-pill--active,
.dark .dept-pill--active {
  background: #ffd700 !important;
  color: #000000 !important;
  font-weight: 800 !important;
  border-color: transparent !important;
  box-shadow: 0 2px 10px rgba(255, 215, 0, 0.35) !important;
}

/* Pinned Notice bar */
body.dark .pinned-bar,
html.dark .pinned-bar,
.dark .pinned-bar {
  color: #ffd700 !important;
  background: rgba(255, 215, 0, 0.08) !important;
  border-bottom-color: rgba(255, 215, 0, 0.2) !important;
}

body.dark .pinned-bar ion-icon,
html.dark .pinned-bar ion-icon,
.dark .pinned-bar ion-icon {
  color: #ffd700 !important;
}

/* Notice Links, Hashtags, Mentions, Read-More */
body.dark .show-more-toggle,
body.dark .notice-text :deep(.read-more),
body.dark :deep(.read-more),
body.dark .notice-text :deep(a),
body.dark .notice-text :deep(.notice-link),
body.dark .notice-text :deep(.post-link),
body.dark :deep(a.notice-link),
body.dark :deep(a.post-link),
body.dark .hashtag,
body.dark .mention,
html.dark .show-more-toggle,
html.dark .notice-text :deep(.read-more),
html.dark :deep(.read-more),
html.dark .notice-text :deep(a),
html.dark .notice-text :deep(.notice-link),
html.dark .notice-text :deep(.post-link),
html.dark :deep(a.notice-link),
html.dark :deep(a.post-link),
html.dark .hashtag,
html.dark .mention,
.dark .show-more-toggle,
.dark .notice-text :deep(.read-more),
.dark :deep(.read-more),
.dark .notice-text :deep(a),
.dark .notice-text :deep(.notice-link),
.dark .notice-text :deep(.post-link),
.dark :deep(a.notice-link),
.dark :deep(a.post-link),
.dark .hashtag,
.dark .mention {
  color: #ffd700 !important;
  background: none !important;
  border: none !important;
  box-shadow: none !important;
  text-decoration: underline !important;
}

/* Notice card Attachment in dark mode */
body.dark .notice-attachment-card,
html.dark .notice-attachment-card,
.dark .notice-attachment-card {
  background: #1e2430 !important;
  border: 1px solid #2f3336 !important;
}

body.dark .notice-attachment-card:hover,
html.dark .notice-attachment-card:hover,
.dark .notice-attachment-card:hover {
  background: #252d3d !important;
  border-color: rgba(255, 215, 0, 0.4) !important;
}

body.dark .attach-filename,
html.dark .attach-filename,
.dark .attach-filename {
  color: #f3f4f6 !important;
}

/* Notice Card Action Buttons */
body.dark .export-flyer-btn,
html.dark .export-flyer-btn,
.dark .export-flyer-btn {
  background: rgba(255, 215, 0, 0.1) !important;
  color: #ffd700 !important;
  border-color: rgba(255, 215, 0, 0.3) !important;
}

body.dark .add-calendar-btn,
html.dark .add-calendar-btn,
.dark .add-calendar-btn {
  background: rgba(255, 215, 0, 0.1) !important;
  color: #ffd700 !important;
  border-color: rgba(255, 215, 0, 0.3) !important;
}

body.dark .audio-reader-btn,
html.dark .audio-reader-btn,
.dark .audio-reader-btn {
  background: rgba(255, 215, 0, 0.1) !important;
  color: #ffd700 !important;
  border-color: rgba(255, 215, 0, 0.3) !important;
}

/* Mobile Department dropdown & Bottom Nav */
body.dark .mobile-dept-select-box,
html.dark .mobile-dept-select-box,
.dark .mobile-dept-select-box {
  background: rgba(255, 215, 0, 0.08) !important;
  color: #ffd700 !important;
  border-color: rgba(255, 215, 0, 0.35) !important;
}

body.dark .mobile-nav-btn--active,
html.dark .mobile-nav-btn--active,
.dark .mobile-nav-btn--active,
body.dark .mobile-nav-btn--active ion-icon,
html.dark .mobile-nav-btn--active ion-icon,
.dark .mobile-nav-btn--active ion-icon {
  color: #ffd700 !important;
}

body.dark .mobile-post-nav-btn .post-icon-wrap,
html.dark .mobile-post-nav-btn .post-icon-wrap,
.dark .mobile-post-nav-btn .post-icon-wrap {
  background: #ffd700 !important;
  box-shadow: 0 2px 8px rgba(255, 215, 0, 0.4) !important;
}

body.dark .mobile-post-nav-btn .post-icon-wrap ion-icon,
html.dark .mobile-post-nav-btn .post-icon-wrap ion-icon,
.dark .mobile-post-nav-btn .post-icon-wrap ion-icon {
  color: #000000 !important;
}

body.dark .notice-post-btn,
html.dark .notice-post-btn,
.dark .notice-post-btn {
  background: #ffd700 !important;
  color: #000000 !important;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.4) !important;
}

body.dark .notice-post-btn ion-icon,
html.dark .notice-post-btn ion-icon,
.dark .notice-post-btn ion-icon {
  color: #000000 !important;
}

body.dark .sidebar-post-btn,
html.dark .sidebar-post-btn,
.dark .sidebar-post-btn {
  --background: #ffd700 !important;
  --color: #000000 !important;
}

/* Left Sidebar Department navigation items */
body.dark .dept-nav-item,
html.dark .dept-nav-item,
.dark .dept-nav-item {
  background: #16181c !important;
  color: #f3f4f6 !important;
  border-color: #2f3336 !important;
}

body.dark .dept-nav-item:hover,
html.dark .dept-nav-item:hover,
.dark .dept-nav-item:hover {
  background: rgba(255, 215, 0, 0.08) !important;
  color: #ffd700 !important;
}

body.dark .dept-nav-item--active,
html.dark .dept-nav-item--active,
.dark .dept-nav-item--active {
  background: rgba(255, 215, 0, 0.12) !important;
  color: #ffd700 !important;
  border-color: rgba(255, 215, 0, 0.4) !important;
}

body.dark .dept-nav-item--active .dept-nav-icon-wrap,
html.dark .dept-nav-item--active .dept-nav-icon-wrap,
.dark .dept-nav-item--active .dept-nav-icon-wrap {
  background: rgba(255, 215, 0, 0.2) !important;
  color: #ffd700 !important;
}

body.dark .dept-nav-item--active .dept-nav-count,
html.dark .dept-nav-item--active .dept-nav-count,
.dark .dept-nav-item--active .dept-nav-count {
  background: #ffd700 !important;
  color: #000000 !important;
}

/* Right Sidebar Bulletins & Widgets */
body.dark .widget-card,
html.dark .widget-card,
.dark .widget-card {
  background: #16181c !important;
  border-color: #2f3336 !important;
}

body.dark .widget-header,
html.dark .widget-header,
.dark .widget-header {
  color: #ffd700 !important;
}

body.dark .widget-count,
html.dark .widget-count,
.dark .widget-count {
  background: rgba(255, 215, 0, 0.18) !important;
  color: #ffd700 !important;
}

body.dark .bullet-dot,
html.dark .bullet-dot,
.dark .bullet-dot {
  background: #ffd700 !important;
  box-shadow: 0 0 6px rgba(255, 215, 0, 0.6) !important;
}

body.dark .wni-cat,
html.dark .wni-cat,
.dark .wni-cat {
  color: #ffd700 !important;
}

body.dark .bulletin-item:hover,
html.dark .bulletin-item:hover,
.dark .bulletin-item:hover {
  border-color: rgba(255, 215, 0, 0.35) !important;
}

body.dark .notice-searchbar,
html.dark .notice-searchbar,
.dark .notice-searchbar {
  --icon-color: #ffd700 !important;
}

body.dark .avatar-ring,
html.dark .avatar-ring,
.dark .avatar-ring {
  border-color: rgba(255, 215, 0, 0.4) !important;
}

body.dark .status-ring,
html.dark .status-ring,
.dark .status-ring {
  border-color: #ffd700 !important;
}

/* Dark mode – profile icon turns gold */
body.dark .profile-icon-wrap,
html.dark .profile-icon-wrap,
.dark .profile-icon-wrap {
  border-color: rgba(255, 215, 0, 0.8) !important;
  background: rgba(255, 215, 0, 0.12) !important;
}
body.dark .profile-thumb-icon,
html.dark .profile-thumb-icon,
.dark .profile-thumb-icon {
  color: #ffd700 !important;
}
body.dark .back-btn,
html.dark .back-btn,
.dark .back-btn {
  --color: #ffd700 !important;
}
body.dark .notice-title,
html.dark .notice-title,
.dark .notice-title {
  color: #f3f4f6 !important;
}
body.dark .notice-text,
html.dark .notice-text,
.dark .notice-text {
  color: #d1d5db !important;
}
</style>

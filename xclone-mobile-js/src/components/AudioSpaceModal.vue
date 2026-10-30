<template>
  <ion-modal :is-open="isOpen" @did-dismiss="closeModal" class="audio-space-modal">
    <div class="space-container" @mousemove="pokeControls" @touchstart.passive="pokeControls">
      <!-- Top Header -->
      <div class="meeting-header">
        <div class="header-left">
          <div class="live-indicator">
            <div class="dot"></div>
            <span>LIVE</span>
          </div>
          <h2 class="meeting-title">{{ space?.title || 'NexFi Talk' }}</h2>
          <div class="timer-badge" v-if="formattedTime">{{ formattedTime }}</div>
          <div class="recording-badge" v-if="isRecording || remoteRecording">
            <div class="rec-dot"></div> REC
          </div>
        </div>
        <div class="header-right">
          <!-- Pending Requests -->
          <ion-button v-if="isHost && pendingRequests.length > 0" fill="clear" @click="showRequests = true" class="badge-btn">
             <ion-icon :icon="notificationsOutline"></ion-icon>
             <span class="badge-count">{{ pendingRequests.length }}</span>
          </ion-button>
          
          <!-- Sidebar Toggles -->
          <ion-button fill="clear" @click="toggleSidebar('participants')" :class="{ 'active-btn': activeSidebar === 'participants' }">
            <ion-icon :icon="peopleOutline"></ion-icon>
            <span class="btn-label">{{ participantCount }}</span>
          </ion-button>
          <ion-button fill="clear" @click="toggleSidebar('chat')" :class="{ 'active-btn': activeSidebar === 'chat' }">
            <ion-icon :icon="chatbubbleOutline"></ion-icon>
            <div v-if="unreadChatCount > 0" class="unread-dot"></div>
          </ion-button>

          <!-- Breakout rooms (BBB-style) -->
          <ion-button v-if="isHost || breakouts.length > 0" fill="clear" @click="showRoomsPanel = !showRoomsPanel" :class="{ 'active-btn': showRoomsPanel }" title="Breakout rooms">
            <ion-icon :icon="gridOutline"></ion-icon>
            <span v-if="breakouts.length > 0" class="btn-label">{{ breakouts.length }}</span>
          </ion-button>

          <!-- Live polls -->
          <ion-button fill="clear" @click="toggleSidebar('polls')" :class="{ 'active-btn': activeSidebar === 'polls' }" title="Polls">
            <ion-icon :icon="statsChartOutline"></ion-icon>
            <div v-if="hasOpenPoll && activeSidebar !== 'polls'" class="unread-dot"></div>
          </ion-button>

          <!-- Attendance (host) -->
          <ion-button v-if="isHost" fill="clear" @click="openAttendance" :class="{ 'active-btn': activeSidebar === 'attendance' }" title="Attendance">
            <ion-icon :icon="timeOutline"></ion-icon>
          </ion-button>

          <!-- Copy shareable invite link (anyone in the room) -->
          <ion-button fill="clear" @click="copyInviteLink" title="Copy invite link">
            <ion-icon :icon="linkOutline"></ion-icon>
          </ion-button>
          
          <ion-button fill="clear" @click="minimize" class="icon-only-btn minimize-btn">
            <ion-icon :icon="chevronDownOutline"></ion-icon>
          </ion-button>
        </div>
      </div>

      <!-- Breakout room strip (when inside a breakout room) -->
      <div v-if="isInBreakout" class="breakout-strip">
        <div class="breakout-strip-left">
          <ion-icon :icon="gridOutline"></ion-icon>
          <span class="breakout-strip-title">{{ space?.title }}</span>
          <span v-if="breakoutLeft" class="breakout-timer">
            <ion-icon :icon="timeOutline"></ion-icon> {{ breakoutLeft }}
          </span>
        </div>
        <button v-if="!isHost && !helpSent" class="breakout-help-btn" @click="askHostForHelp">
          <ion-icon :icon="helpCircleOutline"></ion-icon> Need help?
        </button>
        <span v-if="!isHost && helpSent" class="help-sent">Host notified ✓</span>
        <button class="breakout-return-btn" @click="returnToMain">Return to main room</button>
      </div>

      <!-- Host help-request banner -->
      <div v-if="helpBanner" class="help-banner">
        <ion-icon :icon="helpCircleOutline"></ion-icon>
        <div class="help-banner-text">
          <strong>@{{ helpBanner.username }}</strong> needs help in {{ helpBanner.room_title }}
        </div>
        <button class="invite-join-btn" @click="gotoRoom(helpBanner.room_id, helpBanner.room_title); helpBanner = null;">Jump in</button>
        <button class="invite-later-btn" @click="helpBanner = null">Dismiss</button>
      </div>

      <!-- Breakout invitation -->
      <div v-if="breakoutInvite" class="breakout-invite">
        <div class="breakout-invite-card">
          <div class="breakout-invite-title">You've been assigned to {{ breakoutInvite.room_title }}</div>
          <div class="breakout-invite-sub">The host split this meeting into breakout rooms</div>
          <div class="breakout-invite-actions">
            <button class="invite-join-btn" @click="gotoRoom(breakoutInvite.room_id, breakoutInvite.room_title)">Join room</button>
            <button class="invite-later-btn" @click="breakoutInvite = null">Later</button>
          </div>
        </div>
      </div>

      <!-- Host broadcast toast -->
      <div v-if="broadcastMsg" class="breakout-broadcast">
        <ion-icon :icon="megaphoneOutline"></ion-icon>
        <span>{{ broadcastMsg }}</span>
      </div>

      <!-- Network / quality toast -->
      <div v-if="netToast" class="breakout-broadcast net-toast">
        <ion-icon :icon="wifiOutline"></ion-icon>
        <span>{{ netToast }}</span>
      </div>

      <!-- Breakout rooms panel -->
      <div v-if="showRoomsPanel" class="rooms-panel">
        <div class="rooms-panel-header">
          <h3>Breakout rooms</h3>
          <button @click="showRoomsPanel = false" class="close-sidebar-btn"><ion-icon :icon="closeOutline"></ion-icon></button>
        </div>
        <div class="rooms-panel-body">
          <!-- Host creation form (main room only) -->
          <div v-if="isHost && !isInBreakout" class="rooms-create">
            <div class="rooms-row">
              <label>Rooms</label>
              <div class="stepper">
                <button @click="breakoutCount = Math.max(2, breakoutCount - 1)">−</button>
                <span>{{ breakoutCount }}</span>
                <button @click="breakoutCount = Math.min(8, breakoutCount + 1)">+</button>
              </div>
            </div>
            <div class="rooms-row">
              <label>Duration</label>
              <div class="duration-pills">
                <button v-for="m in [5, 10, 15, 30, 60]" :key="m" :class="{ active: breakoutMinutes === m }" @click="breakoutMinutes = m">{{ m }}m</button>
              </div>
            </div>
            <button class="rooms-create-btn" @click="createBreakouts">
              {{ breakouts.length > 0 ? 'Recreate rooms' : 'Create rooms' }}
            </button>
            <p class="rooms-hint">Everyone in the main room is split automatically. You stay in the main room.</p>
          </div>

          <!-- Room list -->
          <div v-if="breakouts.length === 0" class="rooms-empty">No breakout rooms yet.</div>
          <div v-else v-for="room in breakouts" :key="room.id" class="breakout-room-item">
            <div class="breakout-room-top">
              <span class="breakout-room-name">{{ room.title }}</span>
              <span class="breakout-room-count">{{ membersOf(room.id).length }}</span>
            </div>
            <div class="breakout-room-members">
              <span v-for="m in membersOf(room.id)" :key="m.user_id" class="breakout-member">
                {{ m.first_name || m.username }}
              </span>
              <span v-if="membersOf(room.id).length === 0" class="breakout-member empty">Empty</span>
            </div>
            <button v-if="isHost && String(room.id) !== String(space?.id)" class="room-join-btn" @click="gotoRoom(room.id, room.title)">
              {{ isInBreakout && String(space?.id) === String(room.id) ? 'You are here' : 'Join' }}
            </button>
          </div>

          <!-- Host tools -->
          <div v-if="isHost && breakouts.length > 0" class="rooms-host-tools">
            <div class="broadcast-row">
              <input v-model="broadcastInput" placeholder="Announce to all rooms…" @keyup.enter="broadcastToRooms" />
              <button @click="broadcastToRooms"><ion-icon :icon="sendOutline"></ion-icon></button>
            </div>
            <button class="rooms-end-btn" @click="endAllBreakouts()">End all rooms</button>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content">
        <!-- Video Grid -->
        <div class="meeting-viewport" :class="[gridClass, { 'sidebar-open': activeSidebar }]">
          
          <!-- Floating Reactions -->
          <div class="floating-reactions">
            <transition-group name="float-up">
              <div v-for="r in activeReactions" :key="r.id" class="floating-emoji" :style="{ left: r.left + '%' }">
                {{ r.emoji }}
                <span class="reactor-name">{{ r.username }}</span>
              </div>
            </transition-group>
          </div>

          <!-- Local Participant -->
          <div class="participant-tile local" :class="{ 'is-speaking': isSpeaking }">
            <div class="video-wrapper">
               <video ref="localVideo" autoplay playsinline muted v-show="isVideoOn"></video>
               <div class="avatar-fallback" v-if="!isVideoOn">
                 <img :src="getAvatarUrl(currentUser?.profile_pic)" />
               </div>
               
               <div class="tile-overlays">
                 <div class="participant-label">
                   <ion-icon v-if="isHost" :icon="star" class="role-icon host"></ion-icon>
                   You
                 </div>
                 <div class="tile-badges">
                   <div v-if="handRaised" class="badge hand-badge"><ion-icon :icon="handLeft"></ion-icon></div>
                   <div v-if="isMuted" class="badge mute-badge"><ion-icon :icon="micOff"></ion-icon></div>
                 </div>
               </div>
            </div>
          </div>

          <!-- Remote Participants -->
          <div 
            v-for="p in remoteParticipants" 
            :key="p.id" 
            class="participant-tile"
            :class="{ 'is-speaking': p.isSpeaking }"
          >
            <div class="video-wrapper">
               <video :ref="el => setRemoteVideo(el, p.id)" autoplay playsinline v-show="p.isVideoOn && !remoteScreenOn[p.id]"></video>
               <video :ref="el => setRemoteScreen(el, p.id)" autoplay playsinline v-show="remoteScreenOn[p.id]" class="screen-share-video"></video>
               <div class="avatar-fallback" v-if="!p.isVideoOn && !remoteScreenOn[p.id]">
                 <img :src="getAvatarUrl(p.profile_pic)" />
               </div>
               <div v-if="remoteScreenOn[p.id]" class="sharing-label">
                 <ion-icon :icon="desktopOutline"></ion-icon> {{ p.first_name || p.username }}'s screen
               </div>
               
               <div class="tile-overlays">
                 <div class="participant-label">
                   <ion-icon v-if="String(p.id) === String(space?.host_user_id)" :icon="star" class="role-icon host"></ion-icon>
                   {{ p.first_name || p.username }}
                 </div>
                 <div class="tile-badges">
                   <div v-if="p.handRaised" class="badge hand-badge"><ion-icon :icon="handLeft"></ion-icon></div>
                   <div v-if="p.isMuted" class="badge mute-badge"><ion-icon :icon="micOff"></ion-icon></div>
                 </div>
               </div>
               
               <!-- Host Controls Overlay -->
               <div v-if="isHost" class="host-controls-overlay">
                 <button @click.stop="forceMute(p.id)" title="Force Mute" class="hc-btn"><ion-icon :icon="micOff"></ion-icon></button>
                 <button @click.stop="removeParticipant(p.id)" title="Remove" class="hc-btn danger"><ion-icon :icon="closeOutline"></ion-icon></button>
               </div>
            </div>
          </div>
        </div>

        <!-- Right Sidebar -->
        <div class="sidebar-panel" v-if="activeSidebar">
          <div class="sidebar-header">
            <h3>{{ activeSidebar === 'participants' ? 'Participants' : activeSidebar === 'polls' ? 'Polls' : activeSidebar === 'attendance' ? 'Attendance' : 'In-call Messages' }}</h3>
            <button @click="activeSidebar = null" class="close-sidebar-btn"><ion-icon :icon="closeOutline"></ion-icon></button>
          </div>
          
          <!-- Participants List -->
          <div class="sidebar-body" v-if="activeSidebar === 'participants'">
             <div v-if="isHost" class="invite-row">
               <input v-model="inviteName" placeholder="@username to invite" class="invite-input" @keyup.enter="inviteMember" />
               <button class="invite-btn" @click="inviteMember" :disabled="inviting || !inviteName.trim()">
                 {{ inviting ? '…' : 'Invite' }}
               </button>
             </div>
             <p v-if="inviteMsg" class="invite-msg">{{ inviteMsg }}</p>
             <div class="participant-list-item local-user">
               <img :src="getAvatarUrl(currentUser?.profile_pic)" class="p-avatar" />
               <div class="p-info">
                 <span class="p-name">You ({{ currentUser?.username }})</span>
                 <span class="p-role" v-if="isHost">Host</span>
               </div>
               <div class="p-status">
                 <ion-icon v-if="handRaised" :icon="handLeft" class="text-warning"></ion-icon>
                 <ion-icon :icon="isMuted ? micOff : mic" :class="isMuted ? 'text-danger' : 'text-success'"></ion-icon>
               </div>
             </div>
             
             <div v-for="p in sortedRemoteParticipants" :key="p.id" class="participant-list-item">
               <img :src="getAvatarUrl(p.profile_pic)" class="p-avatar" />
               <div class="p-info">
                 <span class="p-name">{{ p.first_name || p.username }}</span>
                 <span class="p-role" v-if="String(p.id) === String(space?.host_user_id)">Host</span>
               </div>
               <div class="p-status">
                 <ion-icon v-if="p.handRaised" :icon="handLeft" class="text-warning"></ion-icon>
                 <ion-icon :icon="p.isMuted ? micOff : mic" :class="p.isMuted ? 'text-danger' : 'text-success'"></ion-icon>
               </div>
               
               <div class="p-actions" v-if="isHost">
                 <ion-button fill="clear" size="small" @click="forceMute(p.id)" :disabled="p.isMuted">
                   <ion-icon :icon="micOff" slot="icon-only"></ion-icon>
                 </ion-button>
                 <ion-button fill="clear" size="small" color="danger" @click="removeParticipant(p.id)">
                   <ion-icon :icon="logOutOutline" slot="icon-only"></ion-icon>
                 </ion-button>
               </div>
             </div>
          </div>
          
          <!-- Chat -->
          <div class="sidebar-body chat-body" v-if="activeSidebar === 'chat'">
             <div class="chat-messages" ref="chatContainer">
               <div v-if="chatMessages.length === 0" class="empty-chat">
                 <ion-icon :icon="chatbubblesOutline"></ion-icon>
                 <p>Messages sent here will be seen by everyone in the call.</p>
               </div>
               <div v-for="(msg, idx) in chatMessages" :key="idx" class="chat-message" :class="{'my-message': String(msg.sender.user_id) === String(currentUser?.id)}">
                 <div class="msg-header">
                   <span class="msg-sender">{{ String(msg.sender.user_id) === String(currentUser?.id) ? 'You' : msg.sender.username }}</span>
                   <span class="msg-time">{{ formatChatTime(msg.timestamp) }}</span>
                 </div>
                 <div class="msg-bubble">{{ msg.message }}</div>
               </div>
             </div>
             <div class="chat-input-area">
               <input v-model="chatInput" @keyup.enter="sendChatMessage" placeholder="Send a message..." class="chat-input" />
               <button @click="sendChatMessage" class="send-btn" :disabled="!chatInput.trim()">
                 <ion-icon :icon="sendOutline"></ion-icon>
               </button>
             </div>
          </div>

          <!-- Live polls -->
          <div class="sidebar-body" v-if="activeSidebar === 'polls'">
             <button v-if="isHost && !showPollCreate" class="rooms-create-btn" @click="showPollCreate = true">New poll</button>
             <div v-if="isHost && showPollCreate" class="poll-create">
               <input v-model="pollQuestion" placeholder="Ask something…" class="poll-q-input" />
               <div v-for="(opt, i) in pollOptions" :key="i" class="poll-opt-row">
                 <input v-model="pollOptions[i]" :placeholder="`Option ${i + 1}`" class="poll-opt-input" />
                 <button v-if="pollOptions.length > 2" class="poll-opt-x" @click="pollOptions.splice(i, 1)">✕</button>
               </div>
               <button v-if="pollOptions.length < 6" class="poll-add-opt" @click="pollOptions.push('')">+ Add option</button>
               <div class="poll-create-actions">
                 <button class="rooms-create-btn" @click="createPoll">Start poll</button>
                 <button class="invite-later-btn" @click="showPollCreate = false">Cancel</button>
               </div>
             </div>
             <div v-if="polls.length === 0" class="rooms-empty">No polls yet.</div>
             <div v-for="poll in polls" :key="poll.id" class="poll-card">
               <div class="poll-q">{{ poll.question }}
                 <span v-if="poll.status !== 'open'" class="poll-closed">closed</span>
                 <span v-else class="poll-live-dot">live</span>
               </div>
               <button
                 v-for="o in poll.options" :key="o.id"
                 class="poll-opt" :class="{ mine: poll.my_option_id === o.id }"
                 :disabled="poll.status !== 'open'"
                 @click="votePoll(poll, o.id)"
               >
                 <div class="poll-bar" :style="{ width: pollPct(poll, o) + '%' }"></div>
                 <span class="poll-opt-text">{{ o.option_text }}</span>
                 <span class="poll-opt-pct">{{ pollPct(poll, o) }}%</span>
               </button>
               <div class="poll-foot">
                 <span>{{ poll.total_votes }} vote{{ poll.total_votes === 1 ? '' : 's' }}</span>
                 <button v-if="isHost && poll.status === 'open'" class="poll-end-btn" @click="closePoll(poll)">End poll</button>
               </div>
             </div>
          </div>

          <!-- Attendance register (host) -->
          <div class="sidebar-body" v-if="activeSidebar === 'attendance'">
             <button class="rooms-create-btn" @click="fetchAttendance">
               {{ attendanceLoading ? 'Refreshing…' : 'Refresh' }}
             </button>
             <button class="room-join-btn" @click="downloadAttendanceCsv" :disabled="attendanceRows.length === 0">
               Download CSV
             </button>
             <div v-if="attendanceTotals.length === 0 && !attendanceLoading" class="rooms-empty">No attendance yet.</div>
             <div v-for="t in attendanceTotals" :key="t.user_id" class="attend-row">
               <div class="attend-top">
                 <span class="attend-name">{{ t.name }}</span>
                 <span v-if="t.present" class="attend-present">in room</span>
               </div>
               <div v-if="t.email" class="attend-email">{{ t.email }}</div>
               <div class="attend-sub">{{ t.sessions }} session{{ t.sessions === 1 ? '' : 's' }} · {{ fmtDur(t.seconds) }}</div>
             </div>
          </div>
        </div>
      </div>

      <!-- Controls Bar -->
      <div class="meeting-controls-wrapper" :class="{ 'controls-hidden': !controlsVisible }">
        <div class="meeting-controls">
          <div class="controls-left">
             <span class="meeting-time">{{ formattedTime }}</span>
          </div>
          
          <div class="controls-center">
            <button class="ctrl-btn main-btn labeled-btn" :class="{ 'danger': isMuted }" @click="toggleMic" :title="isMuted ? 'Turn on microphone' : 'Turn off microphone'">
              <ion-icon :icon="isMuted ? micOffOutline : micOutline"></ion-icon>
              <span class="ctrl-label">{{ isMuted ? 'Unmute' : 'Mute' }}</span>
            </button>
            <button class="ctrl-btn main-btn" :class="{ 'danger': !isVideoOn }" @click="toggleCamera" :title="isVideoOn ? 'Turn off camera' : 'Turn on camera'">
              <ion-icon :icon="isVideoOn ? videocamOutline : videocamOffOutline"></ion-icon>
            </button>
            <button class="ctrl-btn" :class="{ 'active-share': isScreenSharing }" @click="toggleScreenShare" title="Present now">
              <ion-icon :icon="desktopOutline"></ion-icon>
            </button>
            <button class="ctrl-btn" :class="{ 'active-hand': handRaised }" @click="toggleHand" title="Raise hand">
              <ion-icon :icon="handLeftOutline"></ion-icon>
            </button>
            <button class="ctrl-btn" :class="{ 'active-share': bwMode !== 'auto' }" @click="cycleBwMode" :title="bwLabel">
              <ion-icon :icon="bwMode === 'audio' ? leafOutline : wifiOutline"></ion-icon>
            </button>
            
            <div class="reactions-container">
              <button class="ctrl-btn" @click="showReactions = !showReactions" title="Send reaction">
                <ion-icon :icon="happyOutline"></ion-icon>
              </button>
              <div class="reactions-popup" v-if="showReactions">
                <button v-for="emoji in ['👍', '❤️', '😂', '🔥', '👏', '😮', '🎉', '🙌']" :key="emoji" @click="sendReaction(emoji)" class="reaction-btn">
                  {{ emoji }}
                </button>
              </div>
            </div>
            
            <!-- Host Record Button -->
            <button
              v-if="isHost"
              class="ctrl-btn labeled-btn"
              :class="{ 'rec-active-btn': isRecording }"
              @click="toggleRecording"
              :title="isRecording ? 'Stop recording' : 'Record meeting'"
            >
              <span class="rec-dot-icon" :class="{ 'pulsing': isRecording }"></span>
              <span class="ctrl-label">{{ isRecording ? 'Rec ON' : 'Record' }}</span>
            </button>
                        <button class="ctrl-btn end-btn labeled-btn" @click="confirmEnd" v-if="isHost" title="End call for everyone">
              <ion-icon :icon="powerOutline"></ion-icon>
              <span class="ctrl-label">End</span>
            </button>
            <button class="ctrl-btn leave-btn labeled-btn" @click="confirmLeave" v-else title="Leave call">
              <ion-icon :icon="logOutOutline"></ion-icon>
              <span class="ctrl-label">Leave</span>
            </button>
          </div>
          
          <div class="controls-right">
             <!-- Sidebar toggles also available here -->
             <button class="ctrl-btn small-btn" @click="toggleSidebar('participants')" :class="{ 'active-btn': activeSidebar === 'participants' }">
                <ion-icon :icon="peopleOutline"></ion-icon>
             </button>
             <button class="ctrl-btn small-btn" @click="toggleSidebar('chat')" :class="{ 'active-btn': activeSidebar === 'chat' }">
                <ion-icon :icon="chatbubbleOutline"></ion-icon>
             </button>
          </div>
        </div>
      </div>
      
      <!-- Locked Talk Requests Overlay -->
      <div v-if="showRequests" class="requests-overlay" @click="showRequests = false">
        <div class="requests-panel" @click.stop>
          <div class="panel-header">
            <h3>Join Requests</h3>
            <ion-button fill="clear" @click="showRequests = false">
              <ion-icon :icon="close"></ion-icon>
            </ion-button>
          </div>
          <div class="requests-list">
            <div v-for="req in pendingRequests" :key="req.id" class="request-item">
              <div class="user-info">
                <img :src="getAvatarUrl(req.profile_pic)" class="req-avatar" />
                <div class="user-names">
                  <span class="full-name">{{ req.first_name }} {{ req.last_name }}</span>
                  <span class="username">@{{ req.username }}</span>
                </div>
              </div>
              <div class="req-actions">
                <button class="req-btn approve" @click="handleRequest(req.id, 'approved')">Admit</button>
                <button class="req-btn deny" @click="handleRequest(req.id, 'denied')">Deny</button>
              </div>
            </div>
            <div v-if="pendingRequests.length === 0" class="no-requests">No pending requests</div>
          </div>
        </div>
      </div>

      <!-- Waiting for Approval Guest State -->
      <div v-if="!isHost && space?.is_locked && !isApproved" class="waiting-overlay">
        <div class="waiting-content">
          <div class="loading-pulse"></div>
          <h3>Asking to join...</h3>
          <p>You'll join the call when someone lets you in.</p>
          <button class="cancel-join-btn" @click="confirmLeave">Return to Home</button>
        </div>
      </div>

      <!-- Pre-join device check -->
      <div v-if="stage === 'prejoin'" class="prejoin-overlay">
        <div class="prejoin-card">
          <h3>Check your devices</h3>
          <p class="prejoin-sub">{{ space?.title }}</p>
          <div class="prejoin-preview">
            <video ref="prejoinVideo" autoplay playsinline muted v-show="prejoinVideoOn"></video>
            <div v-if="!prejoinVideoOn" class="avatar-fallback">
              <img :src="getAvatarUrl(currentUser?.profile_pic)" />
            </div>
          </div>
          <div class="prejoin-mic-row">
            <ion-icon :icon="prejoinMuted ? micOff : mic"></ion-icon>
            <div class="mic-meter"><div class="mic-meter-fill" :style="{ width: micLevel + '%' }"></div></div>
          </div>
          <div class="prejoin-toggles">
            <button :class="{ off: prejoinMuted }" @click="prejoinMuted = !prejoinMuted; applyPrejoinToggles()" title="Microphone">
              <ion-icon :icon="prejoinMuted ? micOff : mic"></ion-icon>
              <span>{{ prejoinMuted ? 'Muted' : 'Mic on' }}</span>
            </button>
            <button :class="{ off: !prejoinVideoOn }" @click="prejoinVideoOn = !prejoinVideoOn; applyPrejoinToggles()" title="Camera">
              <ion-icon :icon="prejoinVideoOn ? videocamOutline : videocamOffOutline"></ion-icon>
              <span>{{ prejoinVideoOn ? 'Camera on' : 'Camera off' }}</span>
            </button>
            <button @click="speakerTest()" title="Test speaker">
              <ion-icon :icon="volumeHighOutline"></ion-icon>
              <span>Test speaker</span>
            </button>
          </div>
          <div class="prejoin-actions">
            <button class="prejoin-join-btn" @click="finishPrejoin(true)">Join now</button>
            <button class="prejoin-cancel-btn" @click="finishPrejoin(false)">Cancel</button>
          </div>
        </div>
      </div>

    </div>
  
      <!-- Saving recording indicator -->
      <div v-if="isSavingRecording" class="saving-rec-overlay">
        <div class="saving-rec-box">
          <span class="rec-dot-icon pulsing"></span>
          <span>Finalizing and saving meeting recording...</span>
        </div>
      </div>

    </ion-modal>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { IonModal, IonButton, IonIcon } from '@ionic/vue';
import {
  chevronDownOutline, powerOutline, mic, micOff,
  micOutline, micOffOutline, handLeftOutline, handLeft,
  videocamOutline, videocamOffOutline, desktopOutline, logOutOutline, closeOutline,
  notificationsOutline, close, peopleOutline, chatbubbleOutline, chatbubblesOutline,
  sendOutline, happyOutline, star, gridOutline, timeOutline, megaphoneOutline,
  volumeHighOutline, statsChartOutline, wifiOutline, leafOutline,
  helpCircleOutline, linkOutline
} from 'ionicons/icons';
import axios from 'axios';
import config from '@/config/index.js';
import socketService from '@/utils/socketService.js';

const API_URL = config.api.baseURL;

const props = defineProps({
  isOpen: Boolean,
  space: Object,
  currentUser: Object
});

const emit = defineEmits(['close', 'minimize', 'leave', 'switch-space']);

// Media State
const isMuted = ref(true);
const isVideoOn = ref(false);
const isScreenSharing = ref(false);
const handRaised = ref(false);
const isSpeaking = ref(false);

const localStream = ref(null);
const localVideo = ref(null);
const remoteParticipants = ref([]);

// Audio Analysis for speaking indicator
let audioContext = null;
let analyser = null;
let microphone = null;
let audioCheckInterval = null;

// UI State
const activeSidebar = ref(null); // 'participants', 'chat', null
const showReactions = ref(false);
const activeReactions = ref([]);
const chatMessages = ref([]);
const chatInput = ref('');
const unreadChatCount = ref(0);
const chatContainer = ref(null);

// Timer State
const startTime = ref(null);
const formattedTime = ref('00:00');
let timerInterval = null;

// Recording
const mediaRecorder = ref(null);
const recordedChunks = [];
const isRecording = ref(false);

// Locked State
const pendingRequests = ref([]);
const showRequests = ref(false);
const isApproved = ref(false);

// Breakout rooms (BBB-style)
const breakouts = ref([]);const breakoutMembers = ref([]);
const showRoomsPanel = ref(false);
const breakoutCount = ref(3);
const breakoutMinutes = ref(15);
const breakoutInvite = ref(null);
const broadcastInput = ref('');
const broadcastMsg = ref(null);
let broadcastTimer = null;
const breakoutLeft = ref('');
let breakoutTick = null;
const roomActive = ref(false);
const leftRoom = ref(false);
let enteringRoom = false;

// Meet-style controls: visible on activity, fade out when idle
const controlsVisible = ref(true);
let controlsIdleTimer = null;
const pokeControls = () => {
  controlsVisible.value = true;
  if (controlsIdleTimer) clearTimeout(controlsIdleTimer);
  controlsIdleTimer = setTimeout(() => {
    if (roomActive.value && stage.value === 'meeting') controlsVisible.value = false;
  }, 4000);
};
const clearControlsIdle = () => {
  if (controlsIdleTimer) { clearTimeout(controlsIdleTimer); controlsIdleTimer = null; }
  controlsVisible.value = true;
};

// Live polls
const polls = ref([]);
const showPollCreate = ref(false);
const pollQuestion = ref('');
const pollOptions = ref(['', '']);
const hasOpenPoll = computed(() => polls.value.some(p => p.status === 'open'));

// Breakout help requests
const helpBanner = ref(null);
const helpSent = ref(false);

// Attendance register
const attendanceRows = ref([]);
const attendanceLoading = ref(false);
const attendanceTotals = computed(() => {
  const map = {};
  const now = Date.now();
  attendanceRows.value.forEach(s => {
    const uid = String(s.user_id);
    if (!map[uid]) {
      map[uid] = {
        user_id: uid,
        name: [s.first_name, s.last_name].filter(Boolean).join(' ') || s.username || `User ${uid}`,
        email: s.contact_email || '',
        sessions: 0,
        seconds: 0,
        present: false
      };
    }
    if (s.contact_email && !map[uid].email) map[uid].email = s.contact_email;
    const start = new Date(s.joined_at).getTime();
    const end = s.left_at ? new Date(s.left_at).getTime() : now;
    if (!isNaN(start)) {
      map[uid].sessions++;
      map[uid].seconds += Math.max(0, Math.round(((isNaN(end) ? now : end) - start) / 1000));
      if (!s.left_at) map[uid].present = true;
    }
  });
  return Object.values(map).sort((a, b) => b.seconds - a.seconds);
});

const fmtDur = (totalSeconds) => {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = (h > 0 ? String(m).padStart(2, '0') : String(m));
  return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
};

const fmtTime = (iso) => {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return '';
  }
};

// Pre-join device check (mic/camera/speaker test before entering)
const stage = ref('meeting'); // 'prejoin' | 'meeting'
const prejoinDone = ref(false);
const prejoinStream = ref(null);
const prejoinVideo = ref(null);
const prejoinMuted = ref(true);
const prejoinVideoOn = ref(false);
const micLevel = ref(0);
let micMeterInterval = null;
let prejoinResolve = null;

const startMicMeter = () => {
  stopMicMeter();
  try {
    const stream = prejoinStream.value;
    if (!stream || !stream.getAudioTracks().length) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    prejoinStream.value._meterCtx = ctx;
    micMeterInterval = setInterval(() => {
      try {
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        micLevel.value = Math.min(100, Math.round((sum / data.length) * 2));
      } catch (_) { /* non-fatal */ }
    }, 150);
  } catch (err) {
    console.warn('mic meter failed', err);
  }
};

const stopMicMeter = () => {
  if (micMeterInterval) { clearInterval(micMeterInterval); micMeterInterval = null; }
  try {
    if (prejoinStream.value && prejoinStream.value._meterCtx) {
      prejoinStream.value._meterCtx.close().catch(() => {});
      delete prejoinStream.value._meterCtx;
    }
  } catch (_) { /* non-fatal */ }
  micLevel.value = 0;
};

const stopPrejoinPreview = () => {
  stopMicMeter();
  if (prejoinStream.value) {
    try { prejoinStream.value.getTracks().forEach(t => t.stop()); } catch (_) { /* non-fatal */ }
    prejoinStream.value = null;
  }
};

const startPrejoinPreview = async () => {
  stopPrejoinPreview();
  try {
    try {
      prejoinStream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    } catch (_) {
      // Camera denied/blocked: fall back to audio-only preview
      prejoinVideoOn.value = false;
      prejoinStream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    if (prejoinVideo.value) {
      prejoinVideo.value.srcObject = prejoinStream.value;
      prejoinVideo.value.play().catch(() => {});
    }
    applyPrejoinToggles();
    startMicMeter();
  } catch (e) {
    console.error('prejoin preview failed', e);
  }
};

const applyPrejoinToggles = () => {
  const s = prejoinStream.value;
  if (!s) return;
  s.getAudioTracks().forEach(t => { t.enabled = !prejoinMuted.value; });
  s.getVideoTracks().forEach(t => { t.enabled = prejoinVideoOn.value; });
};

const speakerTest = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.2;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close().catch(() => {});
  } catch (err) {
    console.warn('speaker test failed', err);
  }
};

const runPrejoin = () => {
  stage.value = 'prejoin';
  startPrejoinPreview();
  return new Promise((resolve) => { prejoinResolve = resolve; });
};

const finishPrejoin = (join) => {
  stopMicMeter();
  const done = (val) => {
    stage.value = 'meeting';
    if (prejoinResolve) {
      const r = prejoinResolve;
      prejoinResolve = null;
      r(val);
    }
  };
  if (!join) {
    stopPrejoinPreview();
    done(false);
    return;
  }
  // Carry choices + the already-permitted stream into the meeting
  isMuted.value = prejoinMuted.value;
  isVideoOn.value = prejoinVideoOn.value;
  const s = prejoinStream.value;
  if (s) {
    if (!prejoinVideoOn.value) {
      s.getVideoTracks().forEach(t => { try { t.stop(); } catch (_) { /* non-fatal */ } });
    } else {
      s.getVideoTracks().forEach(t => { t.enabled = true; });
    }
    s.getAudioTracks().forEach(t => { t.enabled = !prejoinMuted.value; });
    localStream.value = s;
    setupAudioAnalysis(s);
    if (localVideo.value) {
      localVideo.value.srcObject = s;
      localVideo.value.play().catch(() => {});
    }
    prejoinStream.value = null;
  }
  prejoinDone.value = true;
  done(true);
};

// Computed
const isHost = computed(() => props.currentUser && props.space && String(props.currentUser.id) === String(props.space.host_user_id));
const participantCount = computed(() => 1 + remoteParticipants.value.length);
const sortedRemoteParticipants = computed(() => {
   return [...remoteParticipants.value].sort((a, b) => {
      if (a.handRaised && !b.handRaised) return -1;
      if (!a.handRaised && b.handRaised) return 1;
      return 0;
   });
});

const gridClass = computed(() => {
  const count = participantCount.value;
  if (count === 1) return 'grid-1';
  if (count === 2) return 'grid-2';
  if (count <= 4) return 'grid-4';
  if (count <= 6) return 'grid-6';
  return 'grid-many';
});

// Breakout helpers
const isInBreakout = computed(() => !!(props.space && props.space.parent_space_id));
const mainRoomId = computed(() => {
  if (!props.space) return null;
  return props.space.parent_space_id || props.space.id;
});

// Participant video ref management
const remoteVideoRefs = {};
const setRemoteVideo = (el, id) => {
  if (el) remoteVideoRefs[id] = el;
};
const remoteScreenRefs = {};
const setRemoteScreen = (el, id) => {
  if (el) remoteScreenRefs[id] = el;
};

// ── Mesh WebRTC (v1: full-mesh P2P for 2–6 people) ──────────────────────
// Joiner-offers protocol: newcomer fetches the roster and sends an offer to
// each existing member over the `space:signal` socket relay; members answer.
// ICE trickles peer-to-peer through the same relay.
const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const peerConnections = {};    // userId -> RTCPeerConnection
const remoteMediaStreams = {}; // userId -> MediaStream (camera + mic)
const remoteScreenStreams = {}; // userId -> MediaStream (screen share)
const remoteScreenOn = ref({}); // userId -> true (reactive, drives template)
const pendingIce = {};         // userId -> [candidate, ...]
const peerStreamGroups = {};   // userId -> [streamId,...] (camera vs screen)
let screenStream = null;
let meshStarted = false;
let meshAudioCtx = null;
const remoteWatchers = {};     // userId -> interval id

const meshSend = (toId, kind, payload) => {
  const sock = socketService.socket;
  if (!sock || !props.space || !props.currentUser) return;
  sock.emit('space:signal', {
    space_id: String(props.space.id),
    from_user_id: String(props.currentUser.id),
    to_user_id: String(toId),
    kind,
    payload: payload || {}
  });
};

const allLocalTracks = () => {
  const tracks = localStream.value ? [...localStream.value.getTracks()] : [];
  if (screenStream) {
    screenStream.getVideoTracks().forEach(t => { if (!tracks.includes(t)) tracks.push(t); });
  }
  return tracks.filter(t => t.readyState === 'live');
};

const kindOfTrack = (t) => {
  if (screenStream && screenStream.getVideoTracks().includes(t)) return 'screen';
  return t.kind === 'video' ? 'cam' : 'mic';
};

const attachLocalTracks = (pc) => {
  const stream = localStream.value || screenStream;
  allLocalTracks().forEach(t => {
    const kind = kindOfTrack(t);
    const tagged = pc.getSenders().find(s => s._nexfiKind === kind);
    if (tagged) {
      if (tagged.track !== t) { try { tagged.replaceTrack(t); } catch (_) { /* non-fatal */ } }
      return;
    }
    const byTrack = pc.getSenders().find(s => s.track === t);
    if (byTrack) {
      byTrack._nexfiKind = byTrack._nexfiKind || kind;
      return;
    }
    try {
      const sender = pc.addTrack(t, stream || undefined);
      sender._nexfiKind = kind;
    } catch (_) { /* non-fatal */ }
  });
};

// ── Low-bandwidth / data-saver mode ─────────────────────────────────────
// 'auto' watches the connection and drops to audio-only on weak networks.
// Manual modes stick until changed; turning the camera on returns to auto.
const bwMode = ref('auto'); // 'auto' | 'audio' | 'low' | 'hd'
const bwAutoOff = ref(false);
const netToast = ref(null);
let netToastTimer = null;
let bwStatsTimer = null;
let bwPoorStreak = 0;
let bwGoodStreak = 0;
let savedCamTrack = null;

const bwLabel = computed(() => {
  if (bwMode.value === 'audio') return 'Audio-only mode (tap to change)';
  if (bwMode.value === 'low') return 'Low-data video (tap to change)';
  if (bwMode.value === 'hd') return 'HD video (tap to change)';
  return bwAutoOff.value ? 'Auto (degraded to audio)' : 'Auto quality';
});

const showNetToast = (msg) => {
  netToast.value = msg;
  if (netToastTimer) clearTimeout(netToastTimer);
  netToastTimer = setTimeout(() => { netToast.value = null; }, 5000);
};

const camSenders = () => {
  const out = [];
  Object.values(peerConnections).forEach(pc => {
    pc.getSenders().forEach(s => { if (s._nexfiKind === 'cam') out.push(s); });
  });
  return out;
};

const setCamSending = async (on) => {
  const senders = camSenders();
  if (on) {
    const track = (savedCamTrack && savedCamTrack.readyState === 'live')
      ? savedCamTrack
      : (localStream.value ? localStream.value.getVideoTracks()[0] : null);
    for (const s of senders) {
      try { await s.replaceTrack(track); } catch (_) { /* non-fatal */ }
    }
    if (track) savedCamTrack = track;
    syncState({ is_video_on: isVideoOn.value });
  } else {
    for (const s of senders) {
      try {
        if (s.track && s.track.readyState === 'live' && !savedCamTrack) savedCamTrack = s.track;
        await s.replaceTrack(null);
      } catch (_) { /* non-fatal */ }
    }
    syncState({ is_video_on: false });
  }
};

const setCaptureWidth = async (w) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: w } }, audio: false });
    const nt = stream.getVideoTracks()[0];
    if (!nt) return;
    if (localStream.value) {
      localStream.value.getVideoTracks().forEach(t => {
        try { t.stop(); } catch (_) { /* non-fatal */ }
        try { localStream.value.removeTrack(t); } catch (_) { /* non-fatal */ }
      });
      localStream.value.addTrack(nt);
    }
    for (const s of camSenders()) {
      try { await s.replaceTrack(nt); } catch (_) { /* non-fatal */ }
    }
    savedCamTrack = nt;
    if (localVideo.value && localStream.value) {
      localVideo.value.srcObject = localStream.value;
      localVideo.value.play().catch(() => {});
    }
  } catch (err) {
    console.warn('capture width switch failed', err);
  }
};

const applyBwMode = async (mode, silent) => {
  bwMode.value = mode;
  bwAutoOff.value = false;
  bwPoorStreak = 0;
  bwGoodStreak = 0;
  if (mode === 'audio') {
    await setCamSending(false);
    if (!silent) showNetToast('Audio-only mode — others see your avatar, you still see them');
  } else {
    if (mode === 'low') await setCaptureWidth(320);
    else if (mode === 'hd') await setCaptureWidth(1280);
    if (isVideoOn.value) await setCamSending(true);
    else syncState();
    if (!silent) showNetToast(mode === 'low' ? 'Low-data video on' : mode === 'hd' ? 'HD video on' : 'Auto quality on');
  }
};

const cycleBwMode = () => {
  const order = ['auto', 'audio', 'low', 'hd'];
  const next = order[(order.indexOf(bwMode.value) + 1) % order.length];
  applyBwMode(next);
};

const checkBwStats = async () => {
  if (!roomActive.value || bwMode.value !== 'auto' || Object.keys(peerConnections).length === 0) return;
  try {
    const pc = Object.values(peerConnections)[0];
    const stats = await pc.getStats();
    let rtt = null, lost = 0, total = 0;
    stats.forEach(r => {
      if (r.type === 'candidate-pair' && (r.nominated || r.selected)) {
        if (typeof r.currentRoundTripTime === 'number') rtt = r.currentRoundTripTime * 1000;
      }
      if (r.type === 'inbound-rtp' && !r.isRemote) {
        lost += r.packetsLost || 0;
        total += r.packetsReceived || 0;
      }
    });
    const poor = (rtt != null && rtt > 450) || (total > 50 && total > 0 && (lost / total) > 0.05);
    if (poor) {
      bwPoorStreak++;
      bwGoodStreak = 0;
    } else {
      bwGoodStreak++;
      bwPoorStreak = 0;
    }
    if (bwPoorStreak >= 2 && !bwAutoOff.value) {
      bwAutoOff.value = true;
      await setCamSending(false);
      showNetToast('Weak connection — switched you to audio-only');
    } else if (bwAutoOff.value && bwGoodStreak >= 4 && isVideoOn.value) {
      bwAutoOff.value = false;
      bwPoorStreak = 0;
      await setCamSending(true);
      showNetToast('Connection recovered — camera back on');
    }
  } catch (_) { /* non-fatal */ }
};

const startBwWatch = () => {
  stopBwWatch();
  bwPoorStreak = 0;
  bwGoodStreak = 0;
  bwStatsTimer = setInterval(checkBwStats, 5000);
};

const stopBwWatch = () => {
  if (bwStatsTimer) { clearInterval(bwStatsTimer); bwStatsTimer = null; }
};

const createPeer = (userId) => {
  if (peerConnections[userId]) return peerConnections[userId];
  const pc = new RTCPeerConnection(ICE_CONFIG);
  peerConnections[userId] = pc;
  pendingIce[userId] = pendingIce[userId] || [];
  pc.onicecandidate = (e) => {
    if (e.candidate) meshSend(userId, 'ice', { candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
  };
  pc.ontrack = (e) => onRemoteTrack(userId, e.track, e.streams && e.streams[0]);
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') closePeer(userId);
  };
  return pc;
};

const flushPendingIce = async (userId) => {
  const pc = peerConnections[userId];
  const queue = pendingIce[userId] || [];
  pendingIce[userId] = [];
  for (const cand of queue) {
    try { if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) { /* non-fatal */ }
  }
};

const attachRemoteVideo = (userId) => {
  nextTick(() => {
    const el = remoteVideoRefs[userId];
    const stream = remoteMediaStreams[userId];
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  });
};

const attachRemoteScreen = (userId) => {
  nextTick(() => {
    const el = remoteScreenRefs[userId];
    const stream = remoteScreenStreams[userId];
    if (el && stream && el.srcObject !== stream) {
      el.srcObject = stream;
      el.play().catch(() => {});
    }
  });
};

const onRemoteTrack = (userId, track, stream) => {
  // Tracks arrive grouped by sender stream: the first group is camera+mic
  // (published at join), later groups are screen shares.
  const sid = (stream && stream.id) || track.id;
  peerStreamGroups[userId] = peerStreamGroups[userId] || [];
  let idx = peerStreamGroups[userId].indexOf(sid);
  if (idx === -1) {
    peerStreamGroups[userId].push(sid);
    idx = peerStreamGroups[userId].length - 1;
  }
  if (idx === 0) {
    if (!remoteMediaStreams[userId]) remoteMediaStreams[userId] = new MediaStream();
    try { remoteMediaStreams[userId].addTrack(track); } catch (_) { /* non-fatal */ }
    attachRemoteVideo(userId);
    if (track.kind === 'audio') {
      startRemoteAudioWatch(userId);
      // Fold late joiners into an in-progress recording mix
      mixStreamIntoRecording(remoteMediaStreams[userId]);
    }
  } else {
    if (!remoteScreenStreams[userId]) remoteScreenStreams[userId] = new MediaStream();
    try { remoteScreenStreams[userId].addTrack(track); } catch (_) { /* non-fatal */ }
    remoteScreenOn.value = { ...remoteScreenOn.value, [userId]: true };
    attachRemoteScreen(userId);
    track.onended = () => { remoteScreenOn.value = { ...remoteScreenOn.value, [userId]: false }; };
    track.onmute = () => { remoteScreenOn.value = { ...remoteScreenOn.value, [userId]: false }; };
    track.onunmute = () => { remoteScreenOn.value = { ...remoteScreenOn.value, [userId]: true }; attachRemoteScreen(userId); };
  }
};

const startRemoteAudioWatch = (userId) => {  try {
    if (remoteWatchers[userId]) return;
    if (!meshAudioCtx) meshAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (meshAudioCtx.state === 'suspended') meshAudioCtx.resume();
    const stream = remoteMediaStreams[userId];
    if (!stream || !stream.getAudioTracks().length) return;
    const src = meshAudioCtx.createMediaStreamSource(stream);
    const an = meshAudioCtx.createAnalyser();
    an.fftSize = 256;
    src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    remoteWatchers[userId] = setInterval(() => {
      try {
        an.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const speaking = (sum / data.length) > 12;
        const p = remoteParticipants.value.find(x => String(x.id) === String(userId));
        if (p) p.isSpeaking = speaking;
      } catch (_) { /* non-fatal */ }
    }, 300);
  } catch (err) {
    console.warn('remote audio watch failed', userId, err);
  }
};

const stopRemoteAudioWatch = (userId) => {
  if (remoteWatchers[userId]) {
    clearInterval(remoteWatchers[userId]);
    delete remoteWatchers[userId];
  }
};

const handleSpaceSignal = async (e) => {
  const d = (e && e.detail) || {};
  if (!props.space || String(d.space_id) !== String(props.space.id)) return;
  const me = String(props.currentUser?.id);
  const fromId = String(d.from_user_id || '');
  const toId = String(d.to_user_id || 'all');
  if (!fromId || fromId === me) return;
  if (toId !== 'all' && toId !== me) return;
  try {
    if (d.kind === 'offer') {
      const pc = createPeer(fromId);
      attachLocalTracks(pc);
      await pc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      await flushPendingIce(fromId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      meshSend(fromId, 'answer', { sdp: pc.localDescription });
    } else if (d.kind === 'answer') {
      const pc = peerConnections[fromId];
      if (pc && pc.signalingState !== 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
        await flushPendingIce(fromId);
      }
    } else if (d.kind === 'ice') {
      const cand = d.payload && d.payload.candidate;
      if (!cand) return;
      const pc = peerConnections[fromId];
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) { /* non-fatal */ }
      } else {
        (pendingIce[fromId] = pendingIce[fromId] || []).push(cand);
      }
    } else if (d.kind === 'bye') {
      closePeer(fromId);
    }
  } catch (err) {
    console.error('space signal error', d.kind, err);
  }
};

const upsertParticipants = (parts) => {
  (parts || []).forEach(p => {
    const pid = String(p.user_id ?? p.id);
    if (pid === String(props.currentUser?.id)) return;
    const existing = remoteParticipants.value.find(x => String(x.id) === String(pid));
    const info = {
      id: pid,
      username: p.username || `User ${pid}`,
      first_name: p.first_name || p.username || `User ${pid}`,
      profile_pic: p.profile_pic || '',
      isMuted: p.is_muted ?? p.isMuted ?? true,
      isVideoOn: p.is_video_on ?? p.isVideoOn ?? false,
      handRaised: p.hand_raised ?? p.handRaised ?? false,
      isSpeaking: existing ? existing.isSpeaking : false
    };
    if (existing) Object.assign(existing, info);
    else remoteParticipants.value.push(info);
  });
};

const refreshRoster = async () => {
  if (!props.space) return;
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}`, {
      params: { user_id: props.currentUser?.id }
    });
    upsertParticipants(res.data?.space?.participants || res.data?.participants || []);
  } catch (err) {
    console.warn('roster refresh failed', err);
  }
};

const ensureLocalAudio = async () => {
  if (!localStream.value) {
    localStream.value = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStream.value.getAudioTracks().forEach(t => { t.enabled = !isMuted.value; });
    setupAudioAnalysis(localStream.value);
  }
  return localStream.value;
};

const renegotiateAll = async () => {
  for (const [pid, pc] of Object.entries(peerConnections)) {
    try {
      attachLocalTracks(pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      meshSend(pid, 'offer', { sdp: pc.localDescription });
    } catch (err) {
      console.warn('renegotiate failed for', pid, err);
    }
  }
};

const joinMesh = async () => {
  if (meshStarted || !props.space || !props.currentUser) return;
  meshStarted = true;
  try {
    await ensureLocalAudio();
    await refreshRoster();
    for (const p of remoteParticipants.value) {
      const pid = String(p.id);
      try {
        const pc = createPeer(pid);
        attachLocalTracks(pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        meshSend(pid, 'offer', { sdp: pc.localDescription });
      } catch (err) {
        console.warn('offer to', pid, 'failed', err);
      }
    }
  } catch (err) {
    console.error('joinMesh error', err);
  }
};

const closePeer = (userId) => {
  const pc = peerConnections[userId];
  if (pc) {
    try { pc.close(); } catch (_) { /* non-fatal */ }
    delete peerConnections[userId];
  }
  delete pendingIce[userId];
  delete peerStreamGroups[userId];
  stopRemoteAudioWatch(userId);
  const el = remoteVideoRefs[userId];
  if (el) { try { el.srcObject = null; } catch (_) { /* non-fatal */ } }
  const sel = remoteScreenRefs[userId];
  if (sel) { try { sel.srcObject = null; } catch (_) { /* non-fatal */ } }
  if (remoteMediaStreams[userId]) {
    try { remoteMediaStreams[userId].getTracks().forEach(t => { try { t.stop(); } catch (_) { /* non-fatal */ } }); } catch (_) { /* non-fatal */ }
    delete remoteMediaStreams[userId];
  }
  if (remoteScreenStreams[userId]) {
    try { remoteScreenStreams[userId].getTracks().forEach(t => { try { t.stop(); } catch (_) { /* non-fatal */ } }); } catch (_) { /* non-fatal */ }
    delete remoteScreenStreams[userId];
  }
  if (remoteScreenOn.value[userId]) {
    const next = { ...remoteScreenOn.value };
    delete next[userId];
    remoteScreenOn.value = next;
  }
};

const leaveMesh = () => {
  stopBwWatch();
  Object.keys(peerConnections).forEach(pid => {
    try { meshSend(pid, 'bye', {}); } catch (_) { /* non-fatal */ }
  });
  Object.keys(peerConnections).forEach(closePeer);
  if (screenStream) {
    try { screenStream.getTracks().forEach(t => t.stop()); } catch (_) { /* non-fatal */ }
    screenStream = null;
  }
  isScreenSharing.value = false;
  Object.keys(remoteWatchers).forEach(stopRemoteAudioWatch);
  if (meshAudioCtx && meshAudioCtx.state !== 'closed') {
    meshAudioCtx.close().catch(() => {});
    meshAudioCtx = null;
  }
  meshStarted = false;
};

// State update function (patch overrides individual flags for cases like
// bandwidth-forced video-off, without touching the user's own toggles)
const syncState = async (patch) => {
  if (!props.space || !props.currentUser) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/state`, {
      user_id: props.currentUser.id,
      state: {
        is_muted: patch?.is_muted ?? isMuted.value,
        is_video_on: patch?.is_video_on ?? isVideoOn.value,
        is_screen_sharing: patch?.is_screen_sharing ?? isScreenSharing.value,
        hand_raised: patch?.hand_raised ?? handRaised.value
      }
    });
  } catch (err) {
    console.error('Failed to sync state:', err);
  }
};

// Best-effort membership calls: joining opens an attendance session and
// puts us on the roster; leaving closes the session and frees the slot.
const joinRoomApi = async () => {
  if (!props.space || !props.currentUser) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/join`, {
      user_id: props.currentUser.id,
      role: isHost.value ? 'host' : 'speaker'
    });
  } catch (err) {
    console.warn('room join api (non-fatal):', err?.response?.data?.message || err.message);
  }
};

const leaveRoomApi = async (roomId) => {
  const rid = roomId || props.space?.id;
  if (!rid || !props.currentUser) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${rid}/leave`, {
      user_id: props.currentUser.id
    });
  } catch (err) {
    console.warn('room leave api (non-fatal):', err?.response?.data?.message || err.message);
  }
};

const setupAudioAnalysis = (stream) => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    
    // Check if stream has audio tracks
    if (stream.getAudioTracks().length > 0) {
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        audioCheckInterval = setInterval(() => {
          if (isMuted.value) {
            isSpeaking.value = false;
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          isSpeaking.value = average > 15; // Threshold for speaking
        }, 200);
    }
  } catch (err) {
    console.error("Audio analysis setup failed:", err);
  }
};

const stopAudioAnalysis = () => {
    if (audioCheckInterval) clearInterval(audioCheckInterval);
    if (microphone) microphone.disconnect();
    if (audioContext && audioContext.state !== 'closed') audioContext.close();
    audioContext = null;
};

// Handlers
const toggleSidebar = (panel) => {
   if (activeSidebar.value === panel) {
      activeSidebar.value = null;
   } else {
      activeSidebar.value = panel;
      if (panel === 'chat') {
         unreadChatCount.value = 0;
         scrollToBottom();
      } else if (panel === 'attendance') {
         fetchAttendance();
      }
   }
};

const openAttendance = () => {
  activeSidebar.value = 'attendance';
  fetchAttendance();
};

const formatChatTime = (isoString) => {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const scrollToBottom = () => {
   nextTick(() => {
      if (chatContainer.value) {
         chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
      }
   });
};

const sendChatMessage = async () => {
  if (!chatInput.value.trim()) return;
  const msg = chatInput.value;
  chatInput.value = '';
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/chat`, {
      user_id: props.currentUser.id,
      message: msg
    });
  } catch (err) {
    console.error('Chat error:', err);
  }
};

const sendReaction = async (emoji) => {
   showReactions.value = false;
   try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/reaction`, {
      user_id: props.currentUser.id,
      reaction: emoji
    });
  } catch (err) {
    console.error('Reaction error:', err);
  }
};

const forceMute = async (targetId) => {
   if (!isHost.value) return;
   try {
      await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/force-mute`, {
         host_id: props.currentUser.id,
         target_user_id: targetId
      });
   } catch (err) {
      console.error('Force mute error:', err);
   }
};

const removeParticipant = async (targetId) => {
   if (!isHost.value) return;
   if (!confirm("Remove this participant from the call?")) return;
   try {
      await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/remove-participant`, {
         host_id: props.currentUser.id,
         target_user_id: targetId
      });
      remoteParticipants.value = remoteParticipants.value.filter(p => String(p.id) !== String(targetId));
   } catch (err) {
      console.error('Remove error:', err);
   }
};

// Requests
const fetchPendingRequests = async () => {
    if (!isHost.value || !props.space) return;
    try {
        const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/requests`, {
            params: { host_id: props.currentUser.id }
        });
        if (res.data.success) {
            pendingRequests.value = res.data.requests;
        }
    } catch (err) {
        console.error('Fetch requests error:', err);
    }
};

const handleRequest = async (requestId, status) => {
    try {
        const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/requests/${requestId}/approve`, {
            host_id: props.currentUser.id,
            status: status
        });
        if (res.data.success) {
            pendingRequests.value = pendingRequests.value.filter(r => r.id !== requestId);
        }
    } catch (err) {
        console.error('Handle request error:', err);
    }
};

const checkMyApproval = async () => {
    if (isHost.value || !props.space || !props.currentUser) return;
    try {
        const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/request_status`, {
            params: { user_id: props.currentUser.id }
        });
        if (res.data.success && res.data.status === 'approved') {
            isApproved.value = true;
        }
    } catch (err) {
        console.error('Check approval error:', err);
    }
};

// ── Breakout rooms (BBB-style) ──────────────────────────────────────────
const fetchBreakouts = async () => {
  const pid = mainRoomId.value;
  if (!pid) return;
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${pid}/breakouts`);
    if (res.data?.success) {
      breakouts.value = res.data.rooms || [];
      breakoutMembers.value = res.data.members || [];
    }
  } catch (err) {
    console.warn('fetch breakouts failed', err);
  }
};

const membersOf = (roomId) => {
  return breakoutMembers.value.filter(m => String(m.room_id) === String(roomId));
};

const createBreakouts = async () => {
  if (!isHost.value || !props.space) return;
  try {
    const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/breakouts`, {
      host_id: props.currentUser.id,
      count: breakoutCount.value,
      duration_minutes: breakoutMinutes.value
    });
    if (res.data?.success) {
      showRoomsPanel.value = true;
      await fetchBreakouts();
    } else {
      alert(res.data?.message || 'Could not create breakout rooms');
    }
  } catch (err) {
    console.error('create breakouts error', err);
    alert('Could not create breakout rooms');
  }
};

const endAllBreakouts = async (silent) => {
  const pid = mainRoomId.value;
  if (!pid) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${pid}/breakouts/end`, {
      host_id: props.currentUser.id
    });
    if (!silent) await fetchBreakouts();
  } catch (err) {
    console.error('end breakouts error', err);
  }
};

const broadcastToRooms = async () => {
  const msg = (broadcastInput.value || '').trim();
  if (!msg || !mainRoomId.value) return;
  broadcastInput.value = '';
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${mainRoomId.value}/breakouts/broadcast`, {
      host_id: props.currentUser.id,
      message: msg
    });
  } catch (err) {
    console.error('breakout broadcast error', err);
  }
};

// Ask the parent (FeedPage) to swap this modal into another room.
const gotoRoom = (roomId, roomTitle) => {
  breakoutInvite.value = null;
  showRoomsPanel.value = false;
  // Stop the recorder now so the clip uploads against THIS room,
  // not the one we're about to enter.
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    try { mediaRecorder.value.stop(); } catch (_) { /* non-fatal */ }
  }
  isRecording.value = false;
  emit('switch-space', { id: roomId, title: roomTitle });
};

const returnToMain = () => {
  // Stop the recorder now so the clip uploads against THIS room,
  // not the main room we're about to re-enter.
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    try { mediaRecorder.value.stop(); } catch (_) { /* non-fatal */ }
  }
  isRecording.value = false;
  emit('switch-space', { id: mainRoomId.value, __returnMain: true });
};

const updateBreakoutCountdown = () => {
  const endsAt = props.space?.ends_at;
  if (!endsAt || !isInBreakout.value) {
    breakoutLeft.value = '';
    return;
  }
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) {
    breakoutLeft.value = '00:00';
    if (breakoutTick) { clearInterval(breakoutTick); breakoutTick = null; }
    onBreakoutExpired();
    return;
  }
  const m = Math.floor(ms / 60000).toString().padStart(2, '0');
  const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
  breakoutLeft.value = `${m}:${s}`;
};

const onBreakoutExpired = async () => {
  // Time's up: host closes everything, everyone heads back to main.
  if (isHost.value) {
    await endAllBreakouts(true);
  }
  returnToMain();
};

const handleBreakoutAssigned = (e) => {
  const d = e.detail || {};
  if (String(d.parent_id) !== String(mainRoomId.value)) return;
  if (isInBreakout.value && String(props.space.id) === String(d.room_id)) {
    breakoutInvite.value = null;
    return;
  }
  breakoutInvite.value = {
    room_id: d.room_id,
    room_title: d.room_title || `Room ${d.room_id}`,
    ends_at: d.ends_at
  };
  fetchBreakouts();
};

const handleBreakoutsChanged = (e) => {
  const d = e.detail || {};
  const pid = d.parent_id != null ? String(d.parent_id) : null;
  if (pid && pid !== String(mainRoomId.value)) return;
  fetchBreakouts();
  if (e.type === 'space:breakouts_ended') {
    breakouts.value = [];
    breakoutMembers.value = [];
    if (isInBreakout.value) {
      // Our room was closed: back to the main room
      returnToMain();
    }
  }
};

const handleBreakoutBroadcast = (e) => {
  const d = e.detail || {};
  if (String(d.parent_id) !== String(mainRoomId.value)) return;
  broadcastMsg.value = d.message || '';
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => { broadcastMsg.value = null; }, 9000);
};

// ── Live polls ────────────────────────────────────────────────────────
const fetchPolls = async () => {
  if (!props.space) return;
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/polls`, {
      params: { user_id: props.currentUser?.id }
    });
    if (res.data?.success) polls.value = res.data.polls || [];
  } catch (err) {
    console.warn('fetch polls failed', err);
  }
};

const pollPct = (poll, opt) => {
  const total = Math.max(poll.total_votes || 0, 1);
  return Math.round(((opt.vote_count || 0) / total) * 100);
};

const createPoll = async () => {
  const q = (pollQuestion.value || '').trim();
  const opts = pollOptions.value.map(o => (o || '').trim()).filter(Boolean);
  if (!q || opts.length < 2) {
    alert('Add a question and at least 2 options');
    return;
  }
  try {
    const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/polls`, {
      host_id: props.currentUser.id,
      question: q,
      options: opts
    });
    if (res.data?.success) {
      pollQuestion.value = '';
      pollOptions.value = ['', ''];
      showPollCreate.value = false;
      fetchPolls();
    } else {
      alert(res.data?.message || 'Could not start poll');
    }
  } catch (err) {
    console.error('create poll error', err);
  }
};

const votePoll = async (poll, optionId) => {
  if (!poll || poll.status !== 'open') return;
  try {
    await axios.post(`${API_URL}/api/space-polls/${poll.id}/vote`, {
      user_id: props.currentUser.id,
      option_id: optionId
    });
    // Authoritative results arrive via space:poll_updated
  } catch (err) {
    console.error('vote error', err);
  }
};

const closePoll = async (poll) => {
  try {
    await axios.post(`${API_URL}/api/space-polls/${poll.id}/close`, {
      host_id: props.currentUser.id
    });
  } catch (err) {
    console.error('close poll error', err);
  }
};

const handlePollUpdated = (e) => {
  const d = (e && e.detail) || {};
  if (!props.space || String(d.space_id) !== String(props.space.id) || !d.poll) return;
  const i = polls.value.findIndex(p => String(p.id) === String(d.poll.id));
  if (i >= 0) polls.value[i] = d.poll;
  else polls.value.unshift(d.poll);
};

// ── Breakout help requests ────────────────────────────────────────────
const askHostForHelp = async () => {
  if (!props.space || !props.currentUser) return;
  try {
    await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/help`, {
      user_id: props.currentUser.id
    });
    helpSent.value = true;
    setTimeout(() => { helpSent.value = false; }, 4000);
  } catch (err) {
    console.error('help request error', err);
  }
};

const handleHelpRequested = (e) => {
  const d = (e && e.detail) || {};
  if (!isHost.value || !props.space) return;
  if (String(d.parent_id) !== String(mainRoomId.value)) return;
  if (String(d.user_id) === String(props.currentUser?.id)) return;
  helpBanner.value = {
    room_id: d.room_id,
    room_title: d.room_title || `Room ${d.room_id}`,
    username: d.username || 'Someone'
  };
};

// ── Attendance register ───────────────────────────────────────────────
const fetchAttendance = async () => {
  if (!props.space || !isHost.value) return;
  attendanceLoading.value = true;
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/attendance`, {
      params: { user_id: props.currentUser.id }
    });
    if (res.data?.success) attendanceRows.value = res.data.report.sessions || [];
  } catch (err) {
    console.warn('fetch attendance failed', err);
  } finally {
    attendanceLoading.value = false;
  }
};

const downloadAttendanceCsv = () => {
  const rows = [['Name', 'Contact email', 'Sessions', 'Total time', 'Currently present']];
  attendanceTotals.value.forEach(t => {
    rows.push([t.name, t.email, String(t.sessions), fmtDur(t.seconds), t.present ? 'Yes' : 'No']);
  });
  rows.push([]);
  rows.push(['Session detail']);
  rows.push(['Name', 'Contact email', 'Joined', 'Left / still in', 'Duration']);
  attendanceRows.value.forEach(s => {
    const name = [s.first_name, s.last_name].filter(Boolean).join(' ') || s.username || `User ${s.user_id}`;
    const start = new Date(s.joined_at).getTime();
    const end = s.left_at ? new Date(s.left_at).getTime() : Date.now();
    rows.push([name, s.contact_email || '', fmtTime(s.joined_at), s.left_at ? fmtTime(s.left_at) : 'Still in', fmtDur((end - start) / 1000)]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `attendance-${props.space?.id || 'room'}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

// Shareable invite link (anyone inside the room can invite, BBB-style)
const copyInviteLink = async () => {
  if (!props.space || !props.currentUser) return;
  try {
    const res = await axios.get(`${API_URL}/api/audio-spaces/${props.space.id}/invite`, {
      params: { user_id: props.currentUser.id }
    });
    if (res.data?.success) {
      const url = `${window.location.origin}/talk/${res.data.code}`;
      try {
        await navigator.clipboard.writeText(url);
        showNetToast('Invite link copied — share it anywhere');
      } catch (_) {
        window.prompt('Copy your invite link:', url);
      }
    } else {
      showNetToast(res.data?.message || 'Could not create invite link');
    }
  } catch (err) {
    console.error('invite link error', err);
    showNetToast('Could not create invite link');
  }
};

// Host invite-by-username (locked + unlisted rooms)
const inviteName = ref('');
const inviting = ref(false);
const inviteMsg = ref('');

const inviteMember = async () => {
  const name = (inviteName.value || '').trim();
  if (!name || !props.space || inviting.value) return;
  inviting.value = true;
  inviteMsg.value = '';
  try {
    const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/invite-user`, {
      host_id: props.currentUser.id,
      username: name
    });
    if (res.data?.success) {
      inviteMsg.value = `Invited @${res.data.username}`;
      inviteName.value = '';
    } else {
      inviteMsg.value = res.data?.message || 'Invite failed';
    }
  } catch (err) {
    inviteMsg.value = err.response?.data?.message || 'Invite failed';
  } finally {
    inviting.value = false;
  }
};
const handleSpaceEnded = (e) => {
  if (String(e.detail.space_id) === String(props.space?.id)) {
    markLeftAndLeave();
  }
};

const handleParticipantJoined = (e) => {
  if (String(e.detail.space_id) === String(props.space?.id)) {
    if (String(e.detail.user_id) !== String(props.currentUser?.id)) {
       console.log('New participant joined:', e.detail.user_id);
       // Pull the roster so the tile has profile info; their offer
       // arrives via space:signal and builds the peer connection.
       refreshRoster();
    }
  }
};

const handleParticipantLeft = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        closePeer(String(e.detail.user_id));
        remoteParticipants.value = remoteParticipants.value.filter(p => String(p.id) !== String(e.detail.user_id));
    }
};

const handleStateUpdated = (e) => {
  if (String(e.detail.space_id) === String(props.space?.id)) {
    const { user_id, state } = e.detail;
    if (String(user_id) === String(props.currentUser?.id)) return;

    const p = remoteParticipants.value.find(p => String(p.id) === String(user_id));
    if (p) {
      if (state.is_muted !== undefined) p.isMuted = state.is_muted;
      if (state.is_video_on !== undefined) p.isVideoOn = state.is_video_on;
      if (state.hand_raised !== undefined) p.handRaised = state.hand_raised;
    } else {
       // Participant might be new, fetch details or add placeholder
       remoteParticipants.value.push({
           id: user_id,
           username: `User ${user_id}`,
           first_name: `User`,
           profile_pic: '',
           isMuted: state.is_muted ?? true,
           isVideoOn: state.is_video_on ?? false,
           handRaised: state.hand_raised ?? false,
           isSpeaking: false
       });
    }
  }
};

const handleForceMuted = (e) => {
   if (String(e.detail.space_id) === String(props.space?.id)) {
      if (!isMuted.value) {
         toggleMic(); // Turn off mic
         alert("You have been muted by the host.");
      }
   }
};

const handleRemoved = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
       alert("You have been removed from the call by the host.");
       markLeftAndLeave();
    }
};

const handleChatMessage = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        chatMessages.value.push(e.detail);
        if (activeSidebar.value !== 'chat') {
            unreadChatCount.value++;
        } else {
            scrollToBottom();
        }
    }
};

const handleReaction = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        const id = Date.now() + Math.random();
        activeReactions.value.push({
            id,
            emoji: e.detail.reaction,
            username: e.detail.username,
            left: Math.floor(Math.random() * 80) + 10 // Random horizontal position
        });
        setTimeout(() => {
            activeReactions.value = activeReactions.value.filter(r => r.id !== id);
        }, 4000);
    }
};

const handleJoinRequest = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        fetchPendingRequests();
    }
};

const handleJoinRequestStatus = (e) => {
    if (String(e.detail.space_id) === String(props.space?.id)) {
        if (e.detail.status === 'approved') {
            isApproved.value = true;
            syncState();
            joinRoomApi();
            joinMesh();
        } else if (e.detail.status === 'denied') {
            alert('Your request to join was denied.');
            markLeftAndLeave();
        }
    }
};

const updateTimer = () => {
   if (!startTime.value) return;
   const diff = Math.floor((Date.now() - startTime.value) / 1000);
   const m = Math.floor(diff / 60).toString().padStart(2, '0');
   const s = (diff % 60).toString().padStart(2, '0');
   formattedTime.value = `${m}:${s}`;
};

const enterRoom = async () => {
  if (!props.isOpen || !props.space || !props.currentUser || roomActive.value || enteringRoom) return;
  enteringRoom = true;
  try {
    socketService.joinRoom(`space_${props.space.id}`);
    // Personal room + presence: critical for guests (approvals, DMs) whose
    // accounts were never registered at app startup.
    socketService.registerUser(props.currentUser.id);

    startTime.value = new Date(props.space.created_at || Date.now()).getTime();
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(updateTimer, 1000);
    updateTimer();

    // Reset per-room UI
    remoteParticipants.value = [];
    chatMessages.value = [];
    unreadChatCount.value = 0;
    activeReactions.value = [];
    activeSidebar.value = null;
    breakoutInvite.value = null;
    showRoomsPanel.value = false;
    broadcastMsg.value = null;
    polls.value = [];
    showPollCreate.value = false;
    attendanceRows.value = [];
    helpBanner.value = null;
    helpSent.value = false;
    remoteRecording.value = false;
    // Fresh approval per room: a grant for one locked room must never
    // carry over into the next room.
    isApproved.value = false;

    // Device check before anything media-related happens
    if (!prejoinDone.value) {
      const ok = await runPrejoin();
      if (!ok) {
        emit('close');
        return;
      }
    }

    if (props.space?.is_locked) {
    if (isHost.value) {
      fetchPendingRequests();
    } else {
      await checkMyApproval();
    }
  }

  await syncState();
  fetchBreakouts();
  fetchPolls();

  updateBreakoutCountdown();
  if (breakoutTick) clearInterval(breakoutTick);
  breakoutTick = setInterval(updateBreakoutCountdown, 1000);

  const needsApproval = props.space?.is_locked && !isHost.value && !isApproved.value;
  if (!needsApproval) {
    await joinRoomApi();
    await joinMesh();
    startBwWatch();
    if (isHost.value && props.space?.is_record_enabled) startRecording();
  }
  roomActive.value = true;
  pokeControls();
  } finally {
    enteringRoom = false;
  }
};

const exitRoom = () => {
  clearControlsIdle();
  if (prejoinResolve) {
    const r = prejoinResolve;
    prejoinResolve = null;
    stage.value = 'meeting';
    r(false);
  }
  stopPrejoinPreview();
  prejoinDone.value = false;
  stopBwWatch();
  bwMode.value = 'auto';
  bwAutoOff.value = false;
  savedCamTrack = null;
  if (netToastTimer) { clearTimeout(netToastTimer); netToastTimer = null; }
  netToast.value = null;
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    try { mediaRecorder.value.stop(); } catch (_) { /* non-fatal */ }
  }
  isRecording.value = false;
  leaveMesh();
  stopTracks();
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (breakoutTick) { clearInterval(breakoutTick); breakoutTick = null; }
  if (broadcastTimer) { clearTimeout(broadcastTimer); broadcastTimer = null; }
  roomActive.value = false;
  remoteParticipants.value = [];
  breakouts.value = [];
  breakoutMembers.value = [];
  breakoutInvite.value = null;
  breakoutLeft.value = '';
  broadcastMsg.value = null;
  polls.value = [];
  attendanceRows.value = [];
  helpBanner.value = null;
  remoteRecording.value = false;
  isApproved.value = false;
};

const markLeftAndLeave = () => {
  // Full exit: stop everything, tell the parent to close us.
  const rid = props.space?.id;
  exitRoom();
  leftRoom.value = true;
  if (rid) leaveRoomApi(rid);
  emit('leave');
};

onMounted(() => {
  window.addEventListener('space:ended', handleSpaceEnded);
  window.addEventListener('space:participant_joined', handleParticipantJoined);
  window.addEventListener('space:participant_left', handleParticipantLeft);
  window.addEventListener('space:state_updated', handleStateUpdated);
  window.addEventListener('space:signal', handleSpaceSignal);
  window.addEventListener('space:breakout_assigned', handleBreakoutAssigned);
  window.addEventListener('space:breakouts_started', handleBreakoutsChanged);
  window.addEventListener('space:breakouts_updated', handleBreakoutsChanged);
  window.addEventListener('space:breakouts_ended', handleBreakoutsChanged);
  window.addEventListener('space:breakout_broadcast', handleBreakoutBroadcast);
  window.addEventListener('space:poll_updated', handlePollUpdated);
  window.addEventListener('space:help_requested', handleHelpRequested);
  window.addEventListener('space:recording', handleRecordingState);
  window.addEventListener('space:force_muted', handleForceMuted);
  window.addEventListener('space:removed', handleRemoved);
  window.addEventListener('space:chat_message', handleChatMessage);
  window.addEventListener('space:reaction', handleReaction);
  window.addEventListener('join_request', handleJoinRequest);
  window.addEventListener('join_request_status', handleJoinRequestStatus);

  if (props.isOpen && props.space) {
    enterRoom();
  }
});

let compCanvas = null;
let compCtx2d = null;
let compRaf = 0;
let compAudioCtx = null;
let compDest = null; // live mix bus while recording (late joiners are added as they arrive)
const remoteRecording = ref(false); // someone else (host) is recording this room

const mixStreamIntoRecording = (s) => {
  try {
    if (!compAudioCtx || !compDest || !s || !s.getAudioTracks().length) return;
    const src = compAudioCtx.createMediaStreamSource(s);
    const gain = compAudioCtx.createGain();
    gain.gain.value = 1.0;
    src.connect(gain);
    gain.connect(compDest);
  } catch (_) { /* non-fatal */ }
};

const announceRecording = (on) => {
  try {
    const sock = socketService.socket;
    if (sock && props.space && props.currentUser) {
      sock.emit('space:recording', {
        space_id: String(props.space.id),
        from_user_id: String(props.currentUser.id),
        recording: !!on
      });
    }
  } catch (_) { /* non-fatal */ }
};

const handleRecordingState = (e) => {
  const d = (e && e.detail) || {};
  if (!props.space || String(d.space_id) !== String(props.space.id)) return;
  if (String(d.from_user_id) === String(props.currentUser?.id)) return;
  remoteRecording.value = !!d.recording;
};

const stopComposite = () => {
  if (compRaf) { cancelAnimationFrame(compRaf); compRaf = 0; }
  if (compAudioCtx && compAudioCtx.state !== 'closed') {
    compAudioCtx.close().catch(() => {});
    compAudioCtx = null;
  }
  compDest = null;
  compCanvas = null;
  compCtx2d = null;
};

// Build one recording stream: grid of every tile (camera + screens,
// labeled placeholders where video is off) plus mixed audio from all peers.
const buildCompositeStream = () => {
  try {
    compCanvas = document.createElement('canvas');
    compCanvas.width = 1280;
    compCanvas.height = 720;
    compCtx2d = compCanvas.getContext('2d');

    compAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    compDest = compAudioCtx.createMediaStreamDestination();
    mixStreamIntoRecording(localStream.value);
    Object.values(remoteMediaStreams).forEach(mixStreamIntoRecording);

    const tiles = () => {
      const list = [{ kind: 'local', label: 'You' }];
      remoteParticipants.value.forEach(p => {
        list.push({ kind: 'camera', id: p.id, label: p.first_name || p.username || 'Guest' });
        if (remoteScreenOn.value[p.id]) {
          list.push({ kind: 'screen', id: p.id, label: (p.first_name || p.username || 'Guest') + "'s screen" });
        }
      });
      return list;
    };
    const tileVideo = (t) => {
      if (t.kind === 'local') return localVideo.value;
      if (t.kind === 'camera') return remoteVideoRefs[t.id];
      return remoteScreenRefs[t.id];
    };

    const draw = () => {
      if (!compCanvas) return;
      const ctx = compCtx2d;
      const W = compCanvas.width, H = compCanvas.height;
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, W, H);
      const list = tiles();
      const n = Math.max(list.length, 1);
      const cols = Math.ceil(Math.sqrt(n));
      const rows = Math.ceil(n / cols);
      const cw = W / cols, ch = H / rows;
      list.forEach((t, i) => {
        const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
        const el = tileVideo(t);
        let drawn = false;
        if (el && el.videoWidth && el.readyState >= 2) {
          try {
            // contain-fit draw
            const vr = el.videoWidth / el.videoHeight;
            const cr = cw / ch;
            let dw, dh;
            if (vr > cr) { dw = cw; dh = cw / vr; } else { dh = ch; dw = ch * vr; }
            ctx.fillStyle = '#000';
            ctx.fillRect(x, y, cw, ch);
            ctx.drawImage(el, x + (cw - dw) / 2, y + (ch - dh) / 2, dw, dh);
            drawn = true;
          } catch (_) { /* non-fatal */ }
        }
        if (!drawn) {
          ctx.fillStyle = '#161b22';
          ctx.fillRect(x + 2, y + 2, cw - 4, ch - 4);
          ctx.fillStyle = '#8b949e';
          ctx.font = '28px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText((t.label || '?').slice(0, 1).toUpperCase(), x + cw / 2, y + ch / 2);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(x + 2, y + ch - 30, Math.min(cw - 4, 260), 24);
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(String(t.label || '').slice(0, 28), x + 10, y + ch - 13);
      });
      compRaf = requestAnimationFrame(draw);
    };
    draw();

    // Guarantee valid audio track in destination so recorder encodes audio track
    if (compDest.stream.getAudioTracks().length === 0 && compAudioCtx) {
      try {
        const osc = compAudioCtx.createOscillator();
        const silent = compAudioCtx.createGain();
        silent.gain.value = 0.001; // nearly silent baseline to keep track active
        osc.connect(silent);
        silent.connect(compDest);
        osc.start();
      } catch (_) {}
    }

    const out = compCanvas.captureStream(30);
    compDest.stream.getAudioTracks().forEach(t => out.addTrack(t));
    return out;
  } catch (err) {
    console.warn('composite build failed, falling back to local', err);
    stopComposite();
    return null;
  }
};

const toggleRecording = () => {
  if (isRecording.value) {
    if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
      try {
        mediaRecorder.value.stop();
      } catch (_) {}
    }
    isRecording.value = false;
    announceRecording(false);
  } else {
    startRecording();
  }
};

const isSavingRecording = ref(false);

const startRecording = () => {
  if (isRecording.value) return;
  const recStream = buildCompositeStream() || localStream.value;
  if (!recStream) return;
  try {
    recordedChunks.length = 0;
    let mimeType = '';
    const candidates = [
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4'
    ];
    for (const cand of candidates) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(cand)) {
        mimeType = cand;
        break;
      }
    }
    const options = mimeType ? { mimeType } : {};
    mediaRecorder.value = new MediaRecorder(recStream, options);
    mediaRecorder.value.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };
    mediaRecorder.value.onstop = () => {
      stopComposite();
      uploadRecording();
    };
    // Force browser to deliver chunks every 1 second
    mediaRecorder.value.start(1000);
    isRecording.value = true;
    announceRecording(true);
  } catch (err) {
    console.error('Failed to start recording:', err);
    stopComposite();
  }
};

const uploadRecording = async () => {
    announceRecording(false);
    if (recordedChunks.length === 0) return;
    isSavingRecording.value = true;
    const mime = (mediaRecorder.value && mediaRecorder.value.mimeType) || 'video/webm';
    const blob = new Blob(recordedChunks, { type: mime });
    const formData = new FormData();
    formData.append('file', blob, 'meeting_recording.webm');
    try {
        await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/recording`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        console.log('Recording uploaded successfully for space:', props.space.id);
    } catch (err) {
        console.error('Failed to upload recording:', err);
    } finally {
        isSavingRecording.value = false;
    }
};

const stopAndUploadRecording = () => {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        isRecording.value = false;
        isSavingRecording.value = false;
        resolve();
      }
    };

    // 5-second safety timer so the UI NEVER hangs forever
    const timer = setTimeout(() => {
      console.warn('stopAndUploadRecording safety timeout triggered');
      stopComposite();
      finish();
    }, 5000);

    if (!mediaRecorder.value || mediaRecorder.value.state === 'inactive') {
      clearTimeout(timer);
      finish();
      return;
    }

    mediaRecorder.value.onstop = async () => {
      clearTimeout(timer);
      stopComposite();
      try {
        await uploadRecording();
      } catch (err) {
        console.error('Upload error in onstop:', err);
      }
      finish();
    };

    try {
      if (mediaRecorder.value.state === 'recording') {
        try { mediaRecorder.value.requestData(); } catch (_) {}
      }
      mediaRecorder.value.stop();
    } catch (e) {
      console.warn('mediaRecorder stop error:', e);
      clearTimeout(timer);
      finish();
    }
  });
};

const stopTracks = () => {
  if (localStream.value) {
    localStream.value.getTracks().forEach(track => track.stop());
    localStream.value = null;
  }
  stopAudioAnalysis();
};

onUnmounted(() => {
  exitRoom();
  window.removeEventListener('space:ended', handleSpaceEnded);
  window.removeEventListener('space:participant_joined', handleParticipantJoined);
  window.removeEventListener('space:participant_left', handleParticipantLeft);
  window.removeEventListener('space:state_updated', handleStateUpdated);
  window.removeEventListener('space:signal', handleSpaceSignal);
  window.removeEventListener('space:breakout_assigned', handleBreakoutAssigned);
  window.removeEventListener('space:breakouts_started', handleBreakoutsChanged);
  window.removeEventListener('space:breakouts_updated', handleBreakoutsChanged);
  window.removeEventListener('space:breakouts_ended', handleBreakoutsChanged);
  window.removeEventListener('space:breakout_broadcast', handleBreakoutBroadcast);
  window.removeEventListener('space:poll_updated', handlePollUpdated);
  window.removeEventListener('space:help_requested', handleHelpRequested);
  window.removeEventListener('space:recording', handleRecordingState);
  window.removeEventListener('space:force_muted', handleForceMuted);
  window.removeEventListener('space:removed', handleRemoved);
  window.removeEventListener('space:chat_message', handleChatMessage);
  window.removeEventListener('space:reaction', handleReaction);
  window.removeEventListener('join_request', handleJoinRequest);
  window.removeEventListener('join_request_status', handleJoinRequestStatus);
});

watch(() => props.space, async (newSpace, oldSpace) => {
  if (!newSpace || !roomActive.value) {
    if (newSpace) remoteParticipants.value = [];
    return;
  }
  if (oldSpace && String(newSpace.id) === String(oldSpace.id)) return;
  // Room switch (main <-> breakout): keep mic/camera, stop recorder upload
  // for the old room first, drop old peer connections, re-enter fresh.
  if (mediaRecorder.value && mediaRecorder.value.state !== 'inactive') {
    try { mediaRecorder.value.stop(); } catch (_) { /* non-fatal */ }
  }
  isRecording.value = false;
  leaveRoomApi(oldSpace.id);
  leaveMesh();
  roomActive.value = false;
  await enterRoom();
});

watch(() => props.isOpen, (open) => {
  if (open && props.space && !roomActive.value) {
    leftRoom.value = false;
    enterRoom();
  } else if (!open && roomActive.value && leftRoom.value) {
    leftRoom.value = false;
    exitRoom();
  }
});

const getAvatarUrl = (path) => {
  if (!path) return 'https://ionicframework.com/docs/img/demos/avatar.svg';
  if (path.startsWith('http')) return path;
  return `${API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

const closeModal = () => emit('close');
const minimize = () => emit('minimize');
const confirmLeave = () => { if (confirm('Leave this call?')) markLeftAndLeave(); };

const toggleMic = async () => {
    // If we don't have a stream yet, get one
    if (!localStream.value) {
        try {
            localStream.value = await navigator.mediaDevices.getUserMedia({ video: isVideoOn.value, audio: true });
            if (localVideo.value) localVideo.value.srcObject = localStream.value;
            setupAudioAnalysis(localStream.value);
            isMuted.value = false;
            await renegotiateAll();
        } catch (e) {
            console.error("Mic error", e);
            alert("Microphone access required.");
            return;
        }
    } else {
        isMuted.value = !isMuted.value;
        localStream.value.getAudioTracks().forEach(t => t.enabled = !isMuted.value);
    }
    syncState();
};

const toggleCamera = async () => {
    try {
      if (!isVideoOn.value) {
        // Manual camera toggle always returns quality control to auto
        bwMode.value = 'auto';
        bwAutoOff.value = false;
        await ensureLocalAudio();
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && localStream.value) {
           // Drop any old (ended) video tracks, publish the fresh one
           localStream.value.getVideoTracks().forEach(t => {
             try { t.stop(); } catch (_) { /* non-fatal */ }
             try { localStream.value.removeTrack(t); } catch (_) { /* non-fatal */ }
           });
           localStream.value.addTrack(videoTrack);
           await renegotiateAll();
        }
        if (localVideo.value) localVideo.value.srcObject = localStream.value;
        isVideoOn.value = true;

        if (props.space?.host_user_id === props.currentUser?.id && !isRecording.value && props.space?.is_record_enabled) {
            startRecording();
        }
      } else {
        // Disable (don't stop) so re-enabling is instant and peers just see
        // the avatar fallback via the synced state flag.
        if (localStream.value) localStream.value.getVideoTracks().forEach(t => { t.enabled = false; });
        isVideoOn.value = false;
      }
      syncState();
    } catch (err) {
      console.error('Camera error:', err);
      alert('Camera access failed');
    }
};

const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing.value) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        isScreenSharing.value = true;
        // Publish the screen track to every peer (arrives as a second
        // stream group remote-side and renders in the screen tile).
        await renegotiateAll();
        screenStream.getVideoTracks()[0].onended = () => {
           stopScreenShare();
        };
      } else {
        stopScreenShare();
      }
      syncState();
    } catch (err) {
       console.error('Screen sharing error:', err);
    }
};

const stopScreenShare = async () => {
  if (screenStream) {
    const tracks = screenStream.getVideoTracks();
    // Detach from all peer connections so remotes drop the screen tile
    Object.values(peerConnections).forEach(pc => {
      pc.getSenders().forEach(sender => {
        if (sender.track && tracks.includes(sender.track)) {
          try { pc.removeTrack(sender); } catch (_) { /* non-fatal */ }
        }
      });
    });
    try { tracks.forEach(t => t.stop()); } catch (_) { /* non-fatal */ }
    screenStream = null;
  }
  if (isScreenSharing.value) {
    isScreenSharing.value = false;
    await renegotiateAll();
    syncState();
  }
};

const toggleHand = () => {
    handRaised.value = !handRaised.value;
    syncState();
};

const endSpace = async () => {
    if (isRecording.value) {
        isSavingRecording.value = true;
        await stopAndUploadRecording();
    }
    try {
        const res = await axios.post(`${API_URL}/api/audio-spaces/${props.space.id}/end`, {
            user_id: props.currentUser.id
        });
        if (res.data.success) markLeftAndLeave();
        else markLeftAndLeave();
    } catch (err) {
        console.error('End space error:', err);
        markLeftAndLeave();
    } finally {
        isSavingRecording.value = false;
    }
};

const confirmEnd = () => {
    if (confirm('End this meeting for everyone?')) endSpace();
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.audio-space-modal {
  --background: #0d1117;
  --height: 100%;
  --width: 100%;
  font-family: 'Inter', sans-serif;
}

.space-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #0d1117;
  color: #fff;
  overflow: hidden;
  position: relative;
}

/* Header */
.meeting-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  z-index: 10;
  height: 60px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(220, 38, 38, 0.15);
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid rgba(220, 38, 38, 0.3);
}

.live-indicator .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: #ef4444; box-shadow: 0 0 8px #ef4444;
  animation: pulse 1.5s infinite;
}

.live-indicator span { font-size: 11px; font-weight: 700; color: #ef4444; }

.meeting-title { margin: 0; font-size: 16px; font-weight: 600; color: #e6edf3; }

.timer-badge { font-size: 14px; font-weight: 500; color: #8b949e; border-left: 1px solid #30363d; padding-left: 12px; font-variant-numeric: tabular-nums; }

.recording-badge {
  display: flex; align-items: center; gap: 4px;
  font-size: 11px; font-weight: 600; color: #8b949e;
}
.rec-dot { width: 6px; height: 6px; background: #8b949e; border-radius: 50%; }

.header-right { display: flex; align-items: center; gap: 8px; }

.header-right ion-button {
  --color: #8b949e;
  font-size: 20px;
  margin: 0;
  position: relative;
}
.header-right ion-button.active-btn { --color: #58a6ff; background: rgba(88,166,255,0.1); border-radius: 8px; }

.badge-count {
  position: absolute; top: 4px; right: 4px;
  background: #ef4444; color: #fff; font-size: 10px;
  padding: 2px 5px; border-radius: 10px; font-weight: 700;
}
.unread-dot {
  position: absolute; top: 6px; right: 6px;
  width: 8px; height: 8px; border-radius: 50%; background: #58a6ff;
}
.btn-label { font-size: 12px; margin-left: 4px; font-weight: 600; }

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
  position: relative;
}

.meeting-viewport {
  flex: 1;
  display: grid;
  padding: 16px;
  gap: 16px;
  align-content: stretch;
  grid-auto-rows: minmax(0, 1fr);
  transition: all 0.3s ease;
  position: relative;
  min-height: 0;
}

.grid-1 { grid-template-columns: 1fr; max-width: 800px; margin: 0 auto; width: 100%; }
.grid-2 { grid-template-columns: 1fr 1fr; }
.grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
.grid-6 { grid-template-columns: repeat(3, 1fr); grid-template-rows: 1fr 1fr; }
.grid-many { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }

.sidebar-panel {
  width: 320px;
  background: #161b22;
  border-left: 1px solid #30363d;
  display: flex;
  flex-direction: column;
  z-index: 5;
}

.sidebar-header {
  padding: 16px; border-bottom: 1px solid #30363d;
  display: flex; justify-content: space-between; align-items: center;
}
.sidebar-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: #e6edf3; }
.close-sidebar-btn { background: none; border: none; color: #8b949e; font-size: 20px; cursor: pointer; }

.sidebar-body { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; }

/* Participants List */
.participant-list-item {
  display: flex; align-items: center; padding: 8px; border-radius: 8px; gap: 12px;
}
.participant-list-item:hover { background: rgba(255,255,255,0.05); }
.p-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #21262d; }
.p-info { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.p-name { font-size: 14px; font-weight: 500; color: #e6edf3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.p-role { font-size: 11px; color: #8b949e; }
.p-status { display: flex; gap: 8px; font-size: 16px; }
.text-warning { color: #f59e0b; }
.text-danger { color: #f87171; }
.text-success { color: #34d399; }
.p-actions { display: flex; gap: 4px; margin-left: 8px; }

/* Chat */
.chat-body { padding: 0; }
.chat-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
.empty-chat { text-align: center; color: #8b949e; margin-top: 40px; font-size: 14px; }
.empty-chat ion-icon { font-size: 40px; margin-bottom: 12px; opacity: 0.5; }
.chat-message { display: flex; flex-direction: column; align-items: flex-start; max-width: 90%; }
.chat-message.my-message { align-self: flex-end; align-items: flex-end; }
.msg-header { display: flex; gap: 8px; align-items: baseline; margin-bottom: 4px; }
.msg-sender { font-size: 13px; font-weight: 600; color: #e6edf3; }
.msg-time { font-size: 11px; color: #8b949e; }
.msg-bubble { background: #21262d; padding: 8px 12px; border-radius: 0 12px 12px 12px; font-size: 14px; line-height: 1.4; color: #c9d1d9; word-break: break-word; }
.my-message .msg-bubble { background: #1f6feb; color: #fff; border-radius: 12px 0 12px 12px; }
.chat-input-area { padding: 12px 16px; border-top: 1px solid #30363d; display: flex; gap: 8px; background: #161b22; }
.chat-input { flex: 1; background: #0d1117; border: 1px solid #30363d; border-radius: 20px; padding: 8px 16px; color: #e6edf3; font-size: 14px; outline: none; }
.chat-input:focus { border-color: #58a6ff; }
.send-btn { background: #1f6feb; color: #fff; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
.send-btn:disabled { background: #30363d; color: #8b949e; cursor: not-allowed; }

/* Participant Tiles */
.participant-tile {
  background: #21262d;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  transition: all 0.2s ease;
  aspect-ratio: 16/9;
  height: 100%;
  min-height: 0;
  min-width: 0;
  border: 3px solid transparent;
}
.participant-tile.is-speaking { border-color: #22c55e; box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.4); }

.video-wrapper { width: 100%; height: 100%; position: relative; display: flex; align-items: center; justify-content: center; }
.video-wrapper video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.video-wrapper video.screen-share-video { object-fit: contain; transform: none; background: #000; }
.sharing-label {
  position: absolute; top: 8px; left: 8px; z-index: 5;
  display: flex; align-items: center; gap: 6px;
  background: rgba(13, 17, 23, 0.75); padding: 4px 10px; border-radius: 6px;
  font-size: 12px; font-weight: 600; color: #7dd3fc; pointer-events: none;
}

/* ── Breakout rooms ── */
.breakout-strip {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 8px 16px;
  background: #1a2233; border-bottom: 1px solid #30363d; z-index: 9;
}
.breakout-strip-left { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #c9d1d9; min-width: 0; }
.breakout-strip-left ion-icon { color: #7dd3fc; font-size: 16px; }
.breakout-strip-title { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.breakout-timer { display: flex; align-items: center; gap: 4px; color: #fbbf24; font-variant-numeric: tabular-nums; font-weight: 600; }
.breakout-timer ion-icon { font-size: 14px; }
.breakout-return-btn {
  background: #238636; color: #fff; border: none; border-radius: 6px;
  padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
}
.breakout-return-btn:active { transform: scale(0.97); }

.breakout-invite {
  position: absolute; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.6); padding: 24px;
}
.breakout-invite-card {
  background: #161b22; border: 1px solid #30363d; border-radius: 12px;
  padding: 24px; max-width: 340px; width: 100%; text-align: center;
}
.breakout-invite-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
.breakout-invite-sub { font-size: 13px; color: #8b949e; margin-bottom: 18px; }
.breakout-invite-actions { display: flex; gap: 10px; }
.invite-join-btn {
  flex: 1; background: #238636; color: #fff; border: none; border-radius: 8px;
  padding: 11px; font-size: 14px; font-weight: 700; cursor: pointer;
}
.invite-later-btn {
  flex: 1; background: transparent; color: #c9d1d9; border: 1px solid #30363d;
  border-radius: 8px; padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer;
}

.breakout-broadcast {
  position: absolute; top: 68px; left: 50%; transform: translateX(-50%); z-index: 55;
  display: flex; align-items: center; gap: 8px; max-width: calc(100% - 32px);
  background: rgba(26, 34, 51, 0.97); border: 1px solid #7dd3fc; border-radius: 10px;
  padding: 10px 16px; font-size: 13px; font-weight: 500; color: #e6edf3;
}
.breakout-broadcast ion-icon { color: #7dd3fc; font-size: 18px; flex-shrink: 0; }

.rooms-panel {
  position: absolute; top: 60px; right: 0; bottom: 0; width: 320px; max-width: 88vw; z-index: 40;
  background: #0d1117; border-left: 1px solid #30363d;
  display: flex; flex-direction: column;
}
.rooms-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #21262d;
}
.rooms-panel-header h3 { margin: 0; font-size: 15px; font-weight: 700; }
.rooms-panel-body { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.rooms-create { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; }
.rooms-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.rooms-row label { font-size: 13px; color: #8b949e; font-weight: 600; }
.stepper { display: flex; align-items: center; gap: 12px; }
.stepper button {
  width: 30px; height: 30px; border-radius: 50%; border: 1px solid #30363d;
  background: #21262d; color: #fff; font-size: 17px; cursor: pointer; line-height: 1;
}
.stepper span { font-size: 16px; font-weight: 700; min-width: 20px; text-align: center; }
.duration-pills { display: flex; gap: 6px; }
.duration-pills button {
  background: #21262d; color: #8b949e; border: 1px solid #30363d; border-radius: 20px;
  padding: 5px 11px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.duration-pills button.active { background: #1f6feb; border-color: #1f6feb; color: #fff; }
.rooms-create-btn {
  width: 100%; background: #1f6feb; color: #fff; border: none; border-radius: 8px;
  padding: 10px; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 2px;
}
.rooms-hint { font-size: 12px; color: #8b949e; margin: 8px 0 0; line-height: 1.5; }
.rooms-empty { text-align: center; color: #8b949e; font-size: 13px; padding: 18px 0; }
.breakout-room-item { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; }
.breakout-room-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.breakout-room-name { font-size: 14px; font-weight: 700; }
.breakout-room-count {
  background: #21262d; border-radius: 12px; padding: 2px 10px;
  font-size: 12px; font-weight: 700; color: #7dd3fc;
}
.breakout-room-members { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
.breakout-member {
  background: #21262d; border-radius: 12px; padding: 3px 10px; font-size: 12px; color: #c9d1d9;
}
.breakout-member.empty { color: #6e7681; font-style: italic; }
.room-join-btn {
  width: 100%; background: transparent; color: #58a6ff; border: 1px solid #1f6feb;
  border-radius: 8px; padding: 8px; font-size: 13px; font-weight: 700; cursor: pointer;
}
.rooms-host-tools { display: flex; flex-direction: column; gap: 8px; }
.broadcast-row { display: flex; gap: 8px; }
.broadcast-row input {
  flex: 1; background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
  padding: 9px 12px; color: #fff; font-size: 13px; outline: none; min-width: 0;
}
.broadcast-row input:focus { border-color: #1f6feb; }
.broadcast-row button {
  background: #1f6feb; color: #fff; border: none; border-radius: 8px;
  width: 40px; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;
}
.rooms-end-btn {
  background: rgba(220, 38, 38, 0.15); color: #f87171; border: 1px solid rgba(220, 38, 38, 0.4);
  border-radius: 8px; padding: 10px; font-size: 13px; font-weight: 700; cursor: pointer;
}

.breakout-help-btn {
  display: flex; align-items: center; gap: 6px;
  background: transparent; color: #7dd3fc; border: 1px solid #7dd3fc;
  border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: 700;
  cursor: pointer; white-space: nowrap;
}
.breakout-help-btn ion-icon { font-size: 15px; }
.help-sent { font-size: 12px; color: #22c55e; font-weight: 600; white-space: nowrap; }

.help-banner {
  position: absolute; top: 68px; left: 50%; transform: translateX(-50%); z-index: 56;
  display: flex; align-items: center; gap: 10px; max-width: calc(100% - 32px);
  background: rgba(26, 34, 51, 0.98); border: 1px solid #fbbf24; border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: #e6edf3;
}
.help-banner ion-icon { color: #fbbf24; font-size: 20px; flex-shrink: 0; }
.help-banner-text { flex: 1; min-width: 0; }
.help-banner .invite-join-btn, .help-banner .invite-later-btn {
  padding: 7px 12px; font-size: 12px; white-space: nowrap;
}

.net-toast { border-color: #22c55e; }
.net-toast ion-icon { color: #22c55e; }

/* ── Pre-join device check ── */
.prejoin-overlay {
  position: absolute; inset: 0; z-index: 70;
  display: flex; align-items: center; justify-content: center;
  background: #0d1117; padding: 20px; overflow-y: auto;
}
.prejoin-card { width: 100%; max-width: 380px; text-align: center; }
.prejoin-card h3 { margin: 0 0 4px; font-size: 18px; font-weight: 700; }
.prejoin-sub { font-size: 13px; color: #8b949e; margin: 0 0 16px; }
.prejoin-preview {
  width: 100%; aspect-ratio: 16/9; border-radius: 12px; overflow: hidden;
  background: #161b22; border: 1px solid #30363d; margin-bottom: 14px;
  display: flex; align-items: center; justify-content: center;
}
.prejoin-preview video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
.prejoin-mic-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; color: #8b949e; }
.prejoin-mic-row ion-icon { font-size: 18px; }
.mic-meter { flex: 1; height: 8px; border-radius: 4px; background: #21262d; overflow: hidden; }
.mic-meter-fill { height: 100%; background: linear-gradient(90deg, #22c55e, #fbbf24); border-radius: 4px; transition: width 0.12s; }
.prejoin-toggles { display: flex; gap: 8px; margin-bottom: 18px; }
.prejoin-toggles button {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
  background: #161b22; border: 1px solid #22c55e; color: #fff; border-radius: 10px;
  padding: 12px 6px; font-size: 12px; font-weight: 600; cursor: pointer;
}
.prejoin-toggles button.off { border-color: #30363d; color: #8b949e; }
.prejoin-toggles button ion-icon { font-size: 22px; }
.prejoin-actions { display: flex; gap: 10px; }
.prejoin-join-btn {
  flex: 2; background: #238636; color: #fff; border: none; border-radius: 10px;
  padding: 13px; font-size: 15px; font-weight: 700; cursor: pointer;
}
.prejoin-cancel-btn {
  flex: 1; background: transparent; color: #c9d1d9; border: 1px solid #30363d;
  border-radius: 10px; padding: 13px; font-size: 14px; font-weight: 600; cursor: pointer;
}

/* ── Live polls ── */
.poll-create { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; margin-bottom: 4px; }
.poll-q-input, .poll-opt-input {
  width: 100%; background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
  padding: 9px 12px; color: #fff; font-size: 13px; outline: none; margin-bottom: 8px;
}
.poll-q-input:focus, .poll-opt-input:focus { border-color: #1f6feb; }
.poll-opt-row { display: flex; gap: 6px; }
.poll-opt-row .poll-opt-input { flex: 1; }
.poll-opt-x { background: transparent; border: none; color: #f87171; font-size: 15px; cursor: pointer; padding: 0 6px; }
.poll-add-opt { background: transparent; border: none; color: #58a6ff; font-size: 13px; font-weight: 600; cursor: pointer; padding: 4px 0 8px; }
.poll-create-actions { display: flex; gap: 8px; }
.poll-create-actions .rooms-create-btn { flex: 2; }
.poll-create-actions .invite-later-btn { flex: 1; }
.poll-card { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; }
.poll-q { font-size: 14px; font-weight: 700; margin-bottom: 10px; }
.poll-live-dot { color: #22c55e; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-left: 6px; }
.poll-closed { color: #8b949e; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-left: 6px; }
.poll-opt {
  position: relative; display: flex; align-items: center; justify-content: space-between;
  width: 100%; background: #0d1117; border: 1px solid #30363d; color: #fff;
  border-radius: 8px; padding: 9px 12px; font-size: 13px; margin-bottom: 6px;
  cursor: pointer; overflow: hidden; text-align: left;
}
.poll-opt:disabled { cursor: default; }
.poll-opt.mine { border-color: #1f6feb; }
.poll-bar { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(31, 111, 235, 0.28); pointer-events: none; }
.poll-opt-text, .poll-opt-pct { position: relative; z-index: 1; }
.poll-opt-pct { font-weight: 700; color: #7dd3fc; }
.poll-foot { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #8b949e; margin-top: 4px; }
.poll-end-btn { background: transparent; border: 1px solid #30363d; color: #c9d1d9; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }

/* ── Attendance ── */
.attend-row { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 10px 12px; }
.attend-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px; }
.attend-name { font-size: 14px; font-weight: 700; }
.attend-present { font-size: 11px; font-weight: 700; color: #22c55e; text-transform: uppercase; }
.attend-sub { font-size: 12px; color: #8b949e; }
.attend-email { font-size: 12px; color: #7dd3fc; word-break: break-all; }

/* Host invite-by-username row */
.invite-row { display: flex; gap: 8px; margin-bottom: 4px; }
.invite-input {
  flex: 1; background: #0d1117; border: 1px solid #30363d; border-radius: 8px;
  padding: 8px 10px; color: #fff; font-size: 13px; outline: none; min-width: 0;
}
.invite-input:focus { border-color: #1f6feb; }
.invite-btn {
  background: #238636; color: #fff; border: none; border-radius: 8px;
  padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
}
.invite-btn:disabled { opacity: 0.5; }
.invite-msg { font-size: 12px; color: #4ade80; margin: 0 0 4px; }

.avatar-fallback { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
.avatar-fallback img { width: clamp(72px, 24%, 128px); aspect-ratio: 1/1; height: auto; border-radius: 50%; object-fit: cover; background: #30363d; }

.tile-overlays {
  position: absolute; inset: 0; pointer-events: none;
  display: flex; flex-direction: column; justify-content: space-between; padding: 12px;
}
.participant-label {
  align-self: flex-start; margin-top: auto;
  background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  padding: 4px 10px; border-radius: 6px; font-size: 13px; font-weight: 500;
  display: flex; align-items: center; gap: 6px; color: #fff;
}
.role-icon { font-size: 12px; }
.role-icon.host { color: #f59e0b; }

.tile-badges { align-self: flex-end; display: flex; gap: 6px; margin-bottom: auto; }
.badge { width: 28px; height: 28px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.hand-badge { color: #f59e0b; background: #fff; }
.mute-badge { color: #ef4444; }

.host-controls-overlay {
  position: absolute; top: 12px; left: 12px; display: none; gap: 8px; z-index: 10;
}
.participant-tile:hover .host-controls-overlay { display: flex; }
.hc-btn { width: 32px; height: 32px; border-radius: 8px; background: rgba(0,0,0,0.7); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; backdrop-filter: blur(4px); transition: 0.2s; }
.hc-btn:hover { background: #30363d; }
.hc-btn.danger:hover { background: #ef4444; }

/* Reactions */
.floating-reactions { position: absolute; bottom: 0; left: 0; right: 0; height: 200px; pointer-events: none; z-index: 50; overflow: hidden; }
.floating-emoji {
  position: absolute; bottom: 0; font-size: 40px; display: flex; flex-direction: column; align-items: center;
  animation: floatUp 4s ease-out forwards;
}
.reactor-name { font-size: 11px; background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 4px; color: #fff; margin-top: 4px; white-space: nowrap; }

@keyframes floatUp {
  0% { transform: translateY(50px) scale(0.5); opacity: 0; }
  10% { transform: translateY(0) scale(1.2); opacity: 1; }
  20% { transform: translateY(-20px) scale(1); opacity: 1; }
  100% { transform: translateY(-300px) scale(1); opacity: 0; }
}

/* Controls Bar */
.meeting-controls-wrapper {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 10px 12px calc(12px + env(safe-area-inset-bottom, 0px));
  background: none;
  border-top: none;
  pointer-events: none;
  transition: opacity var(--nx-dur-med, 0.25s) ease, transform var(--nx-dur-med, 0.25s) ease;
}
.meeting-controls-wrapper > * {
  pointer-events: auto;
}
/* Meet-style idle fade: the bar hides until you move the mouse / touch */
.meeting-controls-wrapper.controls-hidden {
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none !important;
}
.meeting-controls-wrapper.controls-hidden > * {
  pointer-events: none !important;
}
.meeting-controls {
  background: rgba(22, 27, 34, 0.94);
  border: 1px solid #3d444d;
  border-radius: 28px;
  padding: 8px 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  width: 100%;
  max-width: 1100px;
}
@supports (backdrop-filter: blur(16px)) {
  .meeting-controls {
    backdrop-filter: blur(16px) saturate(1.2);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
  }
}
.meeting-controls { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto; width: 100%; }

.controls-left, .controls-right { display: flex; gap: 8px; flex: 1; align-items: center; }
.controls-right { justify-content: flex-end; }
.controls-center {
  display: flex; gap: 12px; justify-content: center; align-items: center; flex: 2;
  max-width: 100%; overflow-x: auto; scrollbar-width: none; padding: 2px;
}
.controls-center::-webkit-scrollbar { display: none; }
.controls-center .ctrl-btn { flex-shrink: 0; }

.meeting-time { font-size: 14px; font-weight: 500; color: #e6edf3; }

.ctrl-btn { width: 44px; height: 44px; border-radius: 50%; border: none; background: #30363d; color: #e6edf3; font-size: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
.ctrl-btn:hover { background: #484f58; }
.ctrl-btn.danger { background: #da3633; color: #fff; }
.ctrl-btn.danger:hover { background: #b3261e; }
.ctrl-btn.active-share { background: #58a6ff; color: #000; }
.ctrl-btn.active-hand { background: #f59e0b; color: #000; }

.end-btn, .leave-btn { width: auto; padding: 0 16px; border-radius: 24px; font-size: 24px; }
.end-btn { background: #da3633; color: #fff; }
.end-btn:hover { background: #b3261e; }
.leave-btn { background: #30363d; color: #e6edf3; }

/* Labeled action pills: icon + text so Mute / End / Leave are unmistakable */
.labeled-btn {
  width: auto;
  height: 44px;
  padding: 0 16px 0 12px;
  border-radius: 22px;
  gap: 7px;
  font-size: 20px;
}
.ctrl-label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.2px;
  white-space: nowrap;
}

.reactions-container { position: relative; }
.reactions-popup { position: absolute; bottom: 56px; left: 50%; transform: translateX(-50%); background: #21262d; border: 1px solid #30363d; border-radius: 12px; padding: 8px; display: flex; gap: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.reaction-btn { background: none; border: none; font-size: 24px; cursor: pointer; padding: 4px; transition: 0.2s; border-radius: 8px; }
.reaction-btn:hover { background: #30363d; transform: scale(1.2); }

/* Overlays */
.requests-overlay, .waiting-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.requests-panel { background: #161b22; border: 1px solid #30363d; border-radius: 16px; width: 100%; max-width: 400px; max-height: 80vh; display: flex; flex-direction: column; }
.panel-header { padding: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #30363d; }
.panel-header h3 { margin: 0; font-size: 16px; color: #e6edf3; }
.requests-list { padding: 12px; overflow-y: auto; }
.request-item { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: #21262d; border-radius: 8px; margin-bottom: 8px; }
.user-info { display: flex; align-items: center; gap: 12px; }
.req-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
.user-names { display: flex; flex-direction: column; }
.full-name { font-weight: 500; font-size: 14px; color: #e6edf3; }
.username { font-size: 12px; color: #8b949e; }
.req-actions { display: flex; gap: 8px; }
.req-btn { padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer; border: none; }
.req-btn.approve { background: #238636; color: #fff; }
.req-btn.deny { background: transparent; border: 1px solid #8b949e; color: #c9d1d9; }

.waiting-content { text-align: center; }
.loading-pulse { width: 40px; height: 40px; border: 3px solid #58a6ff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
@keyframes spin { to { transform: rotate(360deg); } }
.waiting-content h3 { color: #e6edf3; font-size: 20px; margin: 0 0 8px; }
.waiting-content p { color: #8b949e; margin-bottom: 24px; }
.cancel-join-btn { background: #21262d; border: 1px solid #30363d; color: #c9d1d9; padding: 8px 16px; border-radius: 8px; font-weight: 500; cursor: pointer; }

@media (max-width: 768px) {
  .main-content { flex-direction: column; }
  .sidebar-panel { width: 100%; height: 40vh; border-left: none; border-top: 1px solid #30363d; }

  /* Phone video layout: vertical stack of full-width 16:9 tiles that fills
     the screen instead of one small tile floating in black. The last tile
     gets bottom clearance for the floating control dock. */
  .meeting-viewport {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    align-content: unset;
    overflow-y: auto;
    gap: 10px;
    padding: 10px 10px 120px;
  }
  .meeting-viewport.grid-1,
  .meeting-viewport.grid-2,
  .meeting-viewport.grid-4,
  .meeting-viewport.grid-6,
  .meeting-viewport.grid-many {
    grid-template-columns: unset;
    grid-template-rows: unset;
    max-width: none;
    margin: 0;
  }
  .participant-tile {
    width: 100%;
    height: auto;
    flex-shrink: 0;
    aspect-ratio: 16/9;
  }
  .grid-many { grid-template-columns: 1fr 1fr; }
}

/* Compact meeting header for narrow screens: truncate the title to one
   line, shrink chrome, keep every action reachable. */
@media (max-width: 640px) {
  .meeting-header {
    padding: 8px 10px;
    height: auto;
    min-height: 52px;
    gap: 8px;
  }
  .header-left {
    gap: 7px;
    min-width: 0;
    flex: 1;
  }
  .meeting-title {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .live-indicator { padding: 3px 6px; }
  .live-indicator span { display: none; }
  .timer-badge {
    font-size: 12px;
    padding-left: 8px;
    white-space: nowrap;
  }
  .recording-badge { font-size: 0; gap: 0; }
  .header-right { gap: 0; flex-shrink: 0; }
  .header-right ion-button {
    font-size: 17px;
    --padding-start: 6px;
    --padding-end: 6px;
  }
  .btn-label { font-size: 10px; margin-left: 2px; }
  .meeting-controls { gap: 6px; padding: 8px 10px; }
  .controls-center { gap: 8px; }
}

.rec-active-btn {
  background: rgba(239, 68, 68, 0.2) !important;
  border-color: #ef4444 !important;
  color: #ef4444 !important;
}
.rec-dot-icon {
  width: 10px;
  height: 10px;
  background-color: #ef4444;
  border-radius: 50%;
  display: inline-block;
  margin-bottom: 2px;
}
.rec-dot-icon.pulsing {
  animation: recPulse 1.2s infinite ease-in-out;
}
@keyframes recPulse {
  0% { transform: scale(0.9); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
  100% { transform: scale(0.9); opacity: 0.6; }
}

.saving-rec-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(6px);
  z-index: 999999;
  display: flex;
  align-items: center;
  justify-content: center;
}
.saving-rec-box {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 12px;
  padding: 20px 28px;
  display: flex;
  align-items: center;
  gap: 14px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
</style>

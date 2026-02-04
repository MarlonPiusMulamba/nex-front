<template>
  <ion-page>
    <ion-header :translucent="true" class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-button @click="goToProfile">
            <img src="/logo.png" class="header-logo-img" alt="Logo" />
          </ion-button>
        </ion-buttons>
        <ion-title class="feed-title">NexFi</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showHeaderActionSheet = true">
            <ion-icon :icon="ellipsisVertical"></ion-icon>
            <span v-if="notificationPermission !== 'granted'" class="perm-badge">!</span>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
      
      <ion-toolbar class="feed-tabs">
        <div class="tabs-container">
          <div 
            :class="['feed-tab', { active: activeTab === 'foryou' }]"
            @click="setActiveTab('foryou')">
            <span>For you</span>
            <div class="tab-indicator"></div>
          </div>
          <div 
            :class="['feed-tab', { active: activeTab === 'following' }]"
            @click="setActiveTab('following')">
            <span>Following</span>
            <div class="tab-indicator"></div>
          </div>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" ref="content" :scroll-events="true" @ionScroll="onFeedScroll">
      <ion-refresher slot="fixed" @ionRefresh="refreshFeed($event, true)">
        <ion-refresher-content 
          pulling-icon="chevron-down-circle-outline"
          refreshing-spinner="crescent">
        </ion-refresher-content>
      </ion-refresher>

      <div v-if="showNewPostsBanner" class="new-posts-banner" @click="viewNewPosts">
        Click to view new posts
      </div>

      <!-- Loading Indicator -->
      <div v-if="isLoading && posts.length === 0" class="skeleton-container">
        <div v-for="i in 3" :key="i" class="skeleton-post">
          <div class="skeleton-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-text-container">
              <div class="skeleton-text skeleton-username"></div>
              <div class="skeleton-text skeleton-handle"></div>
            </div>
          </div>
          <div class="skeleton-content">
            <div class="skeleton-text skeleton-line"></div>
            <div class="skeleton-text skeleton-line"></div>
            <div class="skeleton-text skeleton-line-short"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="errorMessage && posts.length === 0" class="error-state">
        <ion-icon :icon="alertCircle" class="error-icon"></ion-icon>
        <h2>Connection Issue</h2>
        <p>{{ errorMessage }}</p>
        <ion-button @click="refreshFeed(null, true)" fill="solid">
          <ion-icon :icon="refresh" slot="start"></ion-icon>
          Try Again
        </ion-button>
      </div>

      <!-- Empty State -->
      <div v-if="!isLoading && !errorMessage && posts.length === 0" class="empty-state">
        <ion-icon :icon="chatbubbles" class="empty-icon"></ion-icon>
        <h2>No posts yet</h2>
        <p>Be the first to post something!</p>
        <ion-button @click="showPostModal = true" fill="solid">
          Create Post
        </ion-button>
      </div>

      <!-- Feed Posts -->
      <div class="feed-container" v-if="posts.length > 0">
        <div v-for="post in posts" :key="(post.item_type || 'post') + '_' + post.post_id + '_' + (post.repost_id || '')" class="post-item">
          <div class="post-avatar" @click="openProfile(post)">
            <img
              :src="getImageUrl(post.profile_pic)"
              class="avatar-img"
              alt="Profile"
              @error="handleImageError"
            />
          </div>
          
          <div class="post-content-wrapper">
            <div v-if="post.item_type === 'repost'" class="repost-context">
              <ion-icon :icon="repeat" class="repost-icon"></ion-icon>
              <span class="repost-text">Reposted by @{{ post.reposted_by_username }}</span>
            </div>

            <div v-if="post.item_type === 'repost' && (post.quote_text || (post.quote_media && post.quote_media.length))" class="quote-container">
              <div v-if="post.quote_text" class="quote-text" v-html="formatPostContent(post.quote_text)"></div>
              <div v-if="post.quote_media && post.quote_media.length" class="quote-media">
                <div class="media-grid" :class="`count-${Math.min(post.quote_media.length, 4)}`">
                  <div
                    v-for="(item, index) in post.quote_media.slice(0, 4)"
                    :key="index"
                    class="media-item"
                    @click="openMedia(post, item)"
                  >
                    <img
                      v-if="item.type === 'image'"
                      :src="getImageUrl(item.data)"
                      class="media-img"
                      alt="Quote media"
                      @error="handleImageError"
                    />
                    <VideoPlayer
                      v-else-if="item.type === 'video'"
                      :src="getImageUrl(item.data)"
                      :poster="item.thumbnail ? getImageUrl(item.thumbnail) : ''"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="post-header">
              <div class="post-user-info" @click="openProfile(post)">
                <span class="username">
                  {{ (post.first_name || post.last_name) ? (post.first_name + ' ' + post.last_name).trim() : post.username }}
                </span>
                <span class="handle">@{{ post.username }}</span>
                <span class="separator">·</span>
                <span class="timestamp">{{ formatRelativeTime(post.timestamp) }}</span>
              </div>
              <ion-button 
                v-if="post.user_id === userId" 
                fill="clear" 
                size="small" 
                class="more-btn"
                @click="deletePost(post.post_id)">
                <ion-icon :icon="ellipsisHorizontal"></ion-icon>
              </ion-button>
            </div>

            <div 
              class="post-text" 
              v-if="post.content" 
              @click="onPostTextClick($event, post)"
              v-html="formatPostContent(getPostDisplayContent(post.content, post.post_id))">
            </div>
            <div v-if="post.content && post.content.length > 500" class="show-more-toggle" @click.stop="toggleExpandPost(post.post_id)">
              {{ isExpanded(post.post_id) ? 'Show less' : 'Show more' }}
            </div>

            <div 
              class="post-media" 
              v-if="post.media && post.media.length"
            >
              <div 
                class="media-grid" 
                :class="`count-${Math.min(post.media.length, 4)}`"
              >
                <div
                  v-for="(item, index) in post.media.slice(0, 4)"
                  :key="index"
                  class="media-item"
                  @click="openMedia(post, item)"
                >
                  <img
                    v-if="item.type === 'image'"
                    :src="getImageUrl(item.data)"
                    class="media-img"
                    alt="Post media"
                    @error="handleImageError"
                  />
                  <VideoPlayer
                    v-else-if="item.type === 'video'"
                    :src="getImageUrl(item.data)"
                    :poster="item.thumbnail ? getImageUrl(item.thumbnail) : ''"
                  />
                </div>
              </div>
            </div>

            <div class="post-actions">
              <ion-button fill="clear" size="small" @click="openComments(post)" class="action-btn">
                <ion-icon :icon="chatbubbleOutline"></ion-icon>
                <span v-if="post.comments">{{ post.comments }}</span>
              </ion-button>
              
              <ion-button
                fill="clear"
                size="small"
                @click="openRepostOptions(post)"
                :class="['action-btn', 'retweet-btn', { 'reposted': post.is_reposted_by_me }]"
              >
                <ion-icon :icon="repeat"></ion-icon>
              </ion-button>
              
              <ion-button 
                fill="clear" 
                size="small" 
                @click="toggleLike(post.post_id, post.liked)" 
                :class="['action-btn', 'like-btn', { 'liked': post.liked }]">
                <ion-icon :icon="post.liked ? heart : heartOutline"></ion-icon>
                <span v-if="post.likes > 0">{{ post.likes }}</span>
              </ion-button>
              
              <ion-button fill="clear" size="small" @click="share(post)" class="action-btn">
                <ion-icon :icon="shareOutline"></ion-icon>
              </ion-button>
            </div>
          </div>
        </div>

        <ion-infinite-scroll
          v-if="hasMorePosts"
          :disabled="loadingMore"
          threshold="120px"
          @ionInfinite="loadMorePosts">
          <ion-infinite-scroll-content loading-spinner="crescent" loading-text="Loading more posts..."></ion-infinite-scroll-content>
        </ion-infinite-scroll>
      </div>

      <!-- Floating Action Button -->
      <ion-fab vertical="bottom" horizontal="end" slot="fixed">
        <ion-fab-button @click="openPostComposer" class="gold-fab">
          <ion-icon :icon="add"></ion-icon>
        </ion-fab-button>
      </ion-fab>

      <ion-action-sheet
        :is-open="showRepostSheet"
        header="Repost"
        :buttons="repostSheetButtons"
        @didDismiss="showRepostSheet = false"
      ></ion-action-sheet>

      <ion-action-sheet
        :is-open="showUndoRepostSheet"
        header="Repost"
        :buttons="undoRepostSheetButtons"
        @didDismiss="showUndoRepostSheet = false"
      ></ion-action-sheet>

      <ion-modal :is-open="showQuoteRepostModal" @did-dismiss="closeQuoteRepostModal">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closeQuoteRepostModal" color="medium">Cancel</ion-button>
            </ion-buttons>
            <ion-title>Quote Repost</ion-title>
            <ion-buttons slot="end">
              <ion-button
                @click="submitQuoteRepost"
                :disabled="quotePosting || (!quoteText.trim() && quoteMedia.length === 0)"
                :strong="true"
                color="primary"
              >
                {{ quotePosting ? 'Posting...' : 'Post' }}
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <ion-textarea
            v-model="quoteText"
            placeholder="Add a comment"
            :auto-grow="true"
            :rows="3"
          ></ion-textarea>

          <div class="media-actions" style="margin-top: 12px;">
            <input
              type="file"
              ref="quoteMediaInput"
              accept="image/*,video/*"
              multiple
              style="display:none"
              @change="onQuoteMediaChange"
            />
            <ion-button fill="outline" size="small" @click="$refs.quoteMediaInput.click()" :disabled="quoteMedia.length >= 4">
              <ion-icon :icon="image" slot="start"></ion-icon>
              Add media
            </ion-button>
          </div>

          <div v-if="quoteMediaPreviews.length" class="quote-preview" style="margin-top: 12px;">
            <div class="media-grid" :class="`count-${Math.min(quoteMediaPreviews.length, 4)}`">
              <div v-for="(m, idx) in quoteMediaPreviews.slice(0,4)" :key="idx" class="media-item">
                <img v-if="m.type==='image'" :src="m.src" class="media-img" alt="Preview" />
                <VideoPlayer v-else-if="m.type==='video'" :src="m.src" :poster="m.thumbnail || ''" />
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Create Post Modal -->
      <ion-modal :is-open="showPostModal" @did-dismiss="closePostModal">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closePostModal" color="medium">Cancel</ion-button>
            </ion-buttons>
            <ion-title>New Post</ion-title>
            <ion-buttons slot="end">
              <ion-button 
                @click="submitPost" 
                :disabled="!canPost || isPosting"
                :strong="true"
                color="primary">
                {{ isPosting ? 'Posting...' : 'Post' }}
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div class="compose-container">
            <div class="compose-avatar">
              <img :src="getImageUrl(userAvatar)" class="avatar-img" alt="Your avatar" />
            </div>
            <div class="compose-input">
              <ion-textarea
                v-model="postContent"
                placeholder="What's happening?"
                :auto-grow="true"
                :rows="3"
                @ionInput="onPostInput"
                class="compose-textarea"
              ></ion-textarea>
              
              <div v-if="mediaPreviews.length" class="preview-grid">
                <div 
                  v-for="(preview, index) in mediaPreviews" 
                  :key="index"
                  class="preview-item"
                  :class="`count-${mediaPreviews.length}`">
                  <img v-if="preview.type === 'image'" :src="preview.src" class="preview-img" alt="Preview"/>
                  <VideoPlayer
                    v-else-if="preview.type === 'video'"
                    :src="preview.src"
                    :poster="preview.thumbnail || ''"
                  />
                  <ion-button 
                    fill="clear" 
                    size="small" 
                    class="remove-img-btn"
                    @click.stop="removeMedia(index)">
                    <ion-icon :icon="close"></ion-icon>
                  </ion-button>
                </div>
              </div>
              
              <div class="compose-toolbar">
                <input 
                  type="file" 
                  accept="image/*,video/*" 
                  multiple
                  @change="onMediaChange" 
                  ref="fileInput"
                  style="display: none;"
                />
                <ion-button fill="clear" size="small" @click="$refs.fileInput.click()">
                  <ion-icon :icon="image"></ion-icon>
                </ion-button>
                <div class="emoji-wrapper">
                  <ion-button fill="clear" size="small" @click="toggleEmojiPicker">
                    <ion-icon :icon="happy"></ion-icon>
                  </ion-button>
                  <EmojiPicker v-if="showEmojiPicker" @select="addEmoji" class="composer-emoji-picker" />
                </div>
                <span class="char-count" :class="{ 'over-limit': postContent.length > 1000 }">
                  {{ postContent.length }}/1000
                </span>
              </div>
              <div 
                v-if="showMentionSuggestions && mentionSuggestions.length" 
                class="mention-suggestions">
                <div 
                  v-for="user in mentionSuggestions" 
                  :key="user.user_id"
                  class="mention-item"
                  @click="selectMention(user)">
                  <img :src="getImageUrl(user.profile_pic)" class="mention-avatar" alt="avatar" />
                  <div class="mention-meta">
                    <div class="mention-name">{{ user.full_name || user.username }}</div>
                    <div class="mention-handle">@{{ user.username }}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Post Detail Modal -->
      <ion-modal :is-open="showPostDetail" @did-dismiss="closePostDetail">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closePostDetail" color="medium">Close</ion-button>
            </ion-buttons>
            <ion-title>Post</ion-title>
            <ion-buttons slot="end">
              <ion-button v-if="detailPost" @click="openComments(detailPost)">
                <ion-icon :icon="chatbubbleOutline" slot="start"></ion-icon>
                <span>{{ detailPost?.comments || 0 }}</span>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div v-if="detailPost" class="detail-post">
            <div class="detail-header" @click="openProfile(detailPost)">
              <img :src="getImageUrl(detailPost.profile_pic)" class="avatar-img" alt="Profile" />
              <div>
                <div class="detail-name">{{ (detailPost.first_name || detailPost.last_name) ? (detailPost.first_name + ' ' + detailPost.last_name).trim() : detailPost.username }}</div>
                <div class="detail-handle">@{{ detailPost.username }}</div>
              </div>
            </div>
            <div 
              class="detail-text" 
              v-if="detailPost.content"
              @click="onPostTextClick($event, detailPost)"
              v-html="formatPostContent(detailPost.content)">
            </div>
            <div 
              class="post-media" 
              v-if="detailPost.media && detailPost.media.length"
            >
              <div 
                class="media-grid" 
                :class="`count-${Math.min(detailPost.media.length, 4)}`"
              >
                <div
                  v-for="(item, index) in detailPost.media.slice(0, 4)"
                  :key="index"
                  class="media-item"
                  @click="openMedia(detailPost, item)"
                >
                  <img
                    v-if="item.type === 'image'"
                    :src="getImageUrl(item.data)"
                    class="media-img"
                    alt="Post media"
                    @error="handleImageError"
                  />
                  <video
                    v-else-if="item.type === 'video'"
                    class="media-video"
                    :src="getImageUrl(item.data)"
                    controls
                    playsinline
                  ></video>
                </div>
              </div>
            </div>
            <div class="detail-media" v-else-if="detailPost.image">
              <img :src="getImageUrl(detailPost.image)" alt="Post media" />
            </div>
            <div class="detail-timestamp">
              {{ formatRelativeTime(detailPost.timestamp) }}
            </div>
            <div class="post-actions">
              <ion-button fill="clear" size="small" @click="openComments(detailPost)" class="action-btn">
                <ion-icon :icon="chatbubbleOutline"></ion-icon>
                <span v-if="detailPost.comments">{{ detailPost.comments }}</span>
              </ion-button>
              <ion-button fill="clear" size="small" @click="retweet(detailPost.post_id)" class="action-btn retweet-btn">
                <ion-icon :icon="repeat"></ion-icon>
              </ion-button>
              <ion-button 
                fill="clear" 
                size="small" 
                @click="toggleLike(detailPost.post_id, detailPost.liked)" 
                :class="['action-btn', 'like-btn', { 'liked': detailPost.liked }]">
                <ion-icon :icon="detailPost.liked ? heart : heartOutline"></ion-icon>
                <span v-if="detailPost.likes > 0">{{ detailPost.likes }}</span>
              </ion-button>
              <ion-button fill="clear" size="small" @click="share(detailPost)" class="action-btn">
                <ion-icon :icon="shareOutline"></ion-icon>
              </ion-button>
            </div>

            <div class="detail-comments">
              <div class="section-title" style="margin: 16px 0 8px; font-size: 16px;">Comments</div>

              <div v-if="loadingDetailComments" class="loading-container" style="padding: 18px 0;">
                <ion-spinner></ion-spinner>
              </div>

              <div v-else>
                <div v-if="detailComments.length === 0" class="empty-state" style="padding: 18px 0;">
                  <p>No comments yet.</p>
                </div>

                <div v-else class="detail-comments-list">
                  <div
                    v-for="c in detailComments"
                    :key="c.id"
                    class="detail-comment-item"
                    :class="{ 'is-reply': !!c.parent_comment_id }"
                    :style="{ paddingLeft: `${Math.min((c.depth || 0) * 16, 64)}px` }"
                  >
                    <div class="detail-comment-avatar">
                      <img :src="getImageUrl(c.profile_pic)" class="avatar-img" alt="Profile" />
                    </div>
                    <div class="detail-comment-body">
                      <div class="detail-comment-meta">
                        <span class="detail-comment-username">@{{ c.username }}</span>
                        <span class="separator">·</span>
                        <span class="detail-comment-time">{{ formatRelativeTime(c.created_at || c.timestamp) }}</span>
                      </div>
                      <div v-if="c.parent" class="detail-comment-parent">
                        Replying to <span class="detail-comment-parent-user">@{{ c.parent.username }}</span>
                      </div>
                      <div
                        class="detail-comment-text"
                        v-if="c.content"
                        @click="onCommentTextClick($event)"
                        v-html="formatPostContent(getPostDisplayContent(c.content, c.id))"
                      ></div>
                      <div v-if="c.content && c.content.length > 500" class="show-more-toggle" @click.stop="toggleExpandPost(c.id)">
                        {{ isExpanded(c.id) ? 'Show less' : 'Show more' }}
                      </div>
                      <img v-if="c.image" :src="getImageUrl(c.image)" class="detail-comment-image" alt="Comment" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Media Lightbox Modal -->
      <ion-modal :is-open="showMediaModal" @did-dismiss="closeMediaModal" class="full-screen-modal">
        <ion-header class="ion-no-border">
          <ion-toolbar color="dark">
            <ion-buttons slot="start">
              <ion-button @click="closeMediaModal" color="light">
                <ion-icon :icon="arrowBack" slot="start"></ion-icon>
                <span>Back</span>
              </ion-button>
            </ion-buttons>
            <ion-title color="light">View Media</ion-title>
            <ion-buttons slot="end">
              <ion-button @click="mediaZoom = Math.max(1, mediaZoom - 0.5)" color="light">
                <ion-icon :icon="remove" slot="icon-only"></ion-icon>
              </ion-button>
              <ion-button @click="mediaZoom += 0.5" color="light">
                <ion-icon :icon="add" slot="icon-only"></ion-icon>
              </ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="media-modal" color="dark">
          <div class="media-lightbox">
            <div class="zoom-container" :style="{ transform: `scale(${mediaZoom})` }">
              <img v-if="mediaSrc" :src="mediaSrc" alt="Media" @click="closeMediaModal" />
            </div>
          </div>
        </ion-content>
      </ion-modal>

      <!-- Comments Modal -->
      <ion-modal :is-open="showCommentsModal" @did-dismiss="closeComments">
        <ion-header>
          <ion-toolbar>
            <ion-buttons slot="start">
              <ion-button @click="closeComments" color="medium">Close</ion-button>
            </ion-buttons>
            <ion-title>Comments</ion-title>
          </ion-toolbar>
        </ion-header>
        <ion-content class="ion-padding">
          <div v-if="loadingComments" class="loading-container">
            <ion-spinner></ion-spinner>
          </div>
          <div v-else>
            <div v-if="comments.length === 0" class="empty-state">
              <p>No comments yet. Be the first to comment.</p>
            </div>
            <div v-if="activeCommentPost" class="context-post">
              <div class="post-item">
                <div class="post-avatar" @click="openProfile(activeCommentPost)">
                  <img :src="getImageUrl(activeCommentPost.profile_pic)" class="avatar-img" alt="Profile" />
                </div>
                <div class="post-content-wrapper">
                  <div class="post-header">
                    <div class="post-user-info" @click="openProfile(activeCommentPost)">
                      <span class="username">
                        {{ (activeCommentPost.first_name || activeCommentPost.last_name) ? (activeCommentPost.first_name + ' ' + activeCommentPost.last_name).trim() : activeCommentPost.username }}
                      </span>
                      <span class="handle">@{{ activeCommentPost.username }}</span>
                      <span class="separator">·</span>
                      <span class="timestamp">{{ formatRelativeTime(activeCommentPost.timestamp) }}</span>
                    </div>
                  </div>
                  <div 
                    class="post-text" 
                    v-if="activeCommentPost.content"
                    @click="onPostTextClick($event, activeCommentPost)"
                    v-html="formatPostContent(activeCommentPost.content)">
                  </div>
                  <div 
                    class="post-media" 
                    v-if="activeCommentPost.media && activeCommentPost.media.length"
                  >
                    <div 
                      class="media-grid" 
                      :class="`count-${Math.min(activeCommentPost.media.length, 4)}`"
                    >
                      <div
                        v-for="(item, index) in activeCommentPost.media.slice(0, 4)"
                        :key="index"
                        class="media-item"
                        @click="openMedia(activeCommentPost, item)"
                      >
                        <img
                          v-if="item.type === 'image'"
                          :src="getImageUrl(item.data)"
                          class="media-img"
                          alt="Post media"
                          @error="handleImageError"
                        />
                        <VideoPlayer
                          v-else-if="item.type === 'video'"
                          :src="getImageUrl(item.data)"
                          :poster="item.thumbnail ? getImageUrl(item.thumbnail) : ''"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="comments-list">
              <div 
                v-for="c in comments" 
                :key="c.id" 
                class="comment-card"
                :style="{ marginLeft: (Math.min(c.depth || 0, 3) * 16) + 'px' }">
                <div class="comment-avatar" @click="goToCommentUser(c)">
                  <img :src="getImageUrl(c.profile_pic)" class="avatar-img" alt="Avatar" />
                </div>
                <div class="comment-content-wrapper">
                  <div class="comment-header">
                    <span class="username" @click="goToCommentUser(c)">{{ c.display_name || c.username }}</span>
                    <span class="handle">@{{ c.username }}</span>
                    <span class="separator">·</span>
                    <span class="timestamp">{{ formatRelativeTime(c.created_at) }}</span>
                  </div>
                  <div v-if="c.parent" class="parent-preview">
                    <span class="parent-username">@{{ c.parent.username }}</span>
                    <span class="parent-snippet">{{ c.parent.content }}</span>
                    <span v-if="c.parent.image" class="parent-media-indicator">· media</span>
                  </div>
                  <div class="comment-text">{{ c.content }}</div>
                  <div class="comment-media" v-if="c.image">
                    <img 
                      v-if="!isVideo(c.image)"
                      :src="getMediaSrc(c.image)"
                      class="comment-img"
                      alt="Comment media"
                      @error="handleImageError"
                    />
                    <VideoPlayer
                      v-else
                      :src="getMediaSrc(c.image)"
                      :poster="c.thumbnail ? getMediaSrc(c.thumbnail) : ''"
                    />
                  </div>
                  <div class="comment-actions">
                    <ion-button fill="clear" size="small" class="action-btn" @click="replyToComment(c)">
                      <ion-icon :icon="chatbubbleOutline"></ion-icon>
                      <span v-if="c.replies">{{ c.replies }}</span>
                    </ion-button>
                    <ion-button 
                      fill="clear" 
                      size="small" 
                      :class="['action-btn', 'like-btn', { liked: c.liked }]" 
                      @click="toggleCommentLike(c)">
                      <ion-icon :icon="c.liked ? heart : heartOutline"></ion-icon>
                      <span v-if="(c.likes || 0) > 0">{{ c.likes }}</span>
                    </ion-button>
                    <ion-button fill="clear" size="small" class="action-btn retweet-btn" @click="reshareComment(c)">
                      <ion-icon :icon="repeat"></ion-icon>
                    </ion-button>
                    <ion-button fill="clear" size="small" class="action-btn" @click="shareComment(c)">
                      <ion-icon :icon="shareOutline"></ion-icon>
                    </ion-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ion-content>
        <ion-footer>
          <ion-toolbar>
            <div class="comment-input-row">
              <ion-textarea
                v-model="newComment"
                placeholder="Add a comment"
                :auto-grow="true"
                :rows="1"
                class="comment-textarea"
                ref="commentInput"
              ></ion-textarea>
              <input 
                type="file" 
                accept="image/*,video/*"
                @change="onCommentMediaChange"
                ref="commentFileInput"
                style="display: none;"
              />
              <ion-button fill="clear" size="small" @click="$refs.commentFileInput.click()">
                <ion-icon :icon="image"></ion-icon>
              </ion-button>
              <div v-if="commentMediaPreview" class="comment-preview">
                <img v-if="commentMedia && commentMedia.type==='image'" :src="commentMediaPreview" class="comment-preview-img" alt="Preview"/>
                <VideoPlayer v-else-if="commentMedia && commentMedia.type==='video'" :src="commentMediaPreview" :poster="commentMedia.thumbnail || ''" />
                <ion-button 
                  fill="clear" 
                  size="small" 
                  class="remove-img-btn"
                  @click.stop="removeCommentMedia">
                  <ion-icon :icon="close"></ion-icon>
                </ion-button>
              </div>
              <ion-button 
                fill="clear" 
                size="small" 
                :disabled="(!newComment.trim() && !commentMedia) || postingComment"
                @click="submitComment">
                <ion-spinner v-if="postingComment" name="crescent"></ion-spinner>
                <span v-else>Post</span>
              </ion-button>
            </div>
          </ion-toolbar>
        </ion-footer>
      </ion-modal>
    </ion-content>

    <ion-action-sheet
      :is-open="showHeaderActionSheet"
      @didDismiss="showHeaderActionSheet = false"
      header="Feed Actions"
      :buttons="headerActionButtons"
    ></ion-action-sheet>

    <ion-action-sheet
      :is-open="showShareActionSheet"
      @didDismiss="showShareActionSheet = false"
      header="Share Post"
      :buttons="shareActionSheetButtons"
    ></ion-action-sheet>

  </ion-page>
</template>

<script>
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonFab, IonFabButton, IonIcon, IonModal, IonTextarea, 
  IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent,
  IonActionSheet
} from '@ionic/vue';
import { 
  add, heart, heartOutline, chatbubbleOutline, shareOutline, sunny, moon, 
  ellipsisHorizontal, ellipsisVertical, repeat, refresh, image, close, chatbubbles, logOut,
  alertCircle, remove, arrowBack, notificationsCircleOutline, downloadOutline, phonePortraitOutline, happy
} from 'ionicons/icons';
import axios from 'axios';
import VideoPlayer from '@/components/VideoPlayer.vue';
import EmojiPicker from '@/components/EmojiPicker.vue';
import config from '@/config/index.js';
import notificationService from '@/utils/notificationService.js';
import { savePostsOffline, getOfflinePosts, isNetworkOffline } from '@/utils/offlineDb.js';

export default {
  name: 'FeedPage',
  components: {
    IonPage, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonFab, IonFabButton, IonIcon, IonModal, IonTextarea, 
    IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent,
    IonActionSheet, VideoPlayer, EmojiPicker
  },
  data() {
    const API_URL = config.api.baseURL;
    
    return {
      userId: localStorage.getItem('userId'),
      userAvatar: localStorage.getItem('userAvatar') || '',
      posts: [],
      postContent: '',
      postMedia: [],  // [{ type, data }]
      mediaPreviews: [], // data URLs for UI
      showPostModal: false,
      isLoading: false,
      isPosting: false,
      activeTab: 'foryou',
      API_URL: API_URL,
      add, heart, heartOutline, chatbubbleOutline, shareOutline, sunny, moon, 
      ellipsisHorizontal, ellipsisVertical, repeat, refresh, image, close, chatbubbles, logOut,
      alertCircle, remove, arrowBack, notificationsCircleOutline, downloadOutline, phonePortraitOutline, happy,
      theme: window.theme || 'light',
      defaultAvatar: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23cbd5e0"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E',
      lastFetchTime: 0,
      CACHE_DURATION: 120000,  // 2 minutes cache (matches backend)
      retryCount: 0,
      MAX_RETRIES: 2,  // Reduced to 2 retries
      requestController: null,
      errorMessage: '',
      fastMode: true,  // Enable ultra-fast mode
      showPostDetail: false,
      detailPost: null,
      showMediaModal: false,
      mediaSrc: '',
      // Comments section
      showCommentsModal: false,
      comments: [],
      loadingComments: false,
      postingComment: false,
      newComment: '',
      activeCommentPost: null,
      commentMedia: null,
      commentMediaPreview: '',
      replyToCommentId: null,
      // Mention suggestions
      mentionSuggestions: [],
      showMentionSuggestions: false,
      mentionQuery: '',

      // Pagination + new post banner
      pageLimit: 20,
      pageOffset: 0,
      hasMorePosts: true,
      loadingMore: false,
      latestPostId: null,
      showNewPostsBanner: false,
      _newPostsInterval: null,
      _isNearTop: true,

      showRepostSheet: false,
      repostTarget: null,
      showQuoteRepostModal: false,
      quoteText: '',
      quoteMedia: [],
      quoteMediaPreviews: [],
      quotePosting: false,

      showUndoRepostSheet: false,

      // Post detail comments
      detailComments: [],
      loadingDetailComments: false,
      mediaZoom: 1,
      showEmojiPicker: false,
      notificationPermission: 'default',
      showHeaderActionSheet: false,
      deferredPrompt: null,
      
      // Share action sheet
      showShareActionSheet: false,
      shareActionSheetButtons: [],
      expandedPosts: {} // Track which posts are expanded
    };
  },
  computed: {
    headerActionButtons() {
      const buttons = [
        {
          text: 'Refresh Feed',
          icon: refresh,
          handler: () => {
             this.refreshFeed(null, true);
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

      // Add Install button if browser supports it or if we are on iOS
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

      if (!isStandalone) {
        buttons.push({
          text: 'Install NexFi App',
          icon: isIOS ? phonePortraitOutline : downloadOutline,
          handler: () => {
            this.installPWA();
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
    repostSheetButtons() {
      return [
        {
          text: 'Repost',
          handler: () => this.doRepost()
        },
        {
          text: 'Quote Repost',
          handler: () => this.openQuoteRepost()
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ];
    },
    undoRepostSheetButtons() {
      return [
        {
          text: 'Undo Repost',
          role: 'destructive',
          handler: () => this.undoRepost()
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ];
    },
    canPost() {
      return (this.postContent.trim().length > 0 || this.postMedia.length > 0) && 
             this.postContent.length <= 1000;
    }
  },
  methods: {
    isExpanded(postId) {
      return !!this.expandedPosts[postId];
    },
    toggleExpandPost(postId) {
      this.expandedPosts[postId] = !this.expandedPosts[postId];
    },
    getPostDisplayContent(content, postId) {
      if (!content) return '';
      if (content.length <= 500 || this.isExpanded(postId)) {
        return content;
      }
      return content.substring(0, 500) + '...';
    },
    async setActiveTab(tab) {
      if (this.activeTab === tab) return;
      this.activeTab = tab;

      // Force refresh when switching tabs so 'following' isn't using cached 'for you'
      this.lastFetchTime = 0;
      this.pageOffset = 0;
      this.hasMorePosts = true;
      this.showNewPostsBanner = false;
      await this.refreshFeed(null, true);
    },
    formatPostContent(text) {
      if (!text) return '';

      // Safety check: Detect if content looks like binary/garbage (often from decompression errors)
      // If more than 30% of characters are non-printable/control chars, it's likely garbage.
      const garbageCheck = (str) => {
        if (!str || str.length < 20) return false;
        let nonPrintable = 0;
        for (let i = 0; i < Math.min(str.length, 500); i++) {
          const code = str.charCodeAt(i);
          if ((code < 32 && code !== 10 && code !== 13) || code > 126) {
            nonPrintable++;
          }
        }
        return (nonPrintable / Math.min(str.length, 500)) > 0.3;
      };

      if (garbageCheck(text)) {
        return '<i style="color:var(--ion-color-medium);">[Content unavailable due to formatting error]</i>';
      }

      const escapeHtml = (str) =>
        str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      const urlRegex = /^(https?:\/\/[^\s]+|www\.[^\s]+|[a-z0-9-]+\.[a-z0-9.-]+\.[a-z]{2,}(\/[^\s]*)?)$/i;
      const parts = text.split(/(\s+)/); // keep spaces

      return parts
        .map((part) => {
          if (/\s+/.test(part)) return part; // whitespace

          const escaped = escapeHtml(part);

          // URL
          if (urlRegex.test(part) && !part.startsWith('@') && !part.startsWith('#')) {
            const href = part.startsWith('http') ? part : `https://${part}`;
            return `<a href="${href}" class="post-link" target="_blank" rel="noopener noreferrer">${escaped}</a>`;
          }

          // Hashtag
          if (part.startsWith('#') && part.length > 1) {
            return `<span class="hashtag" data-hashtag="${escaped}" style="color:#daa520;">${escaped}</span>`;
          }

          // Mention
          if (part.startsWith('@') && part.length > 1) {
            const username = escaped.slice(1);
            return `<span class="mention" data-mention="${username}" style="color:#daa520;">${escaped}</span>`;
          }

          return escaped;
        })
        .join('');
    },

    onPostTextClick(event, post) {
      const target = event.target;

      if (target.classList.contains('mention') && target.dataset.mention) {
        const username = target.dataset.mention;
        this.$router.push(`/tabs/profile/${username}`);
        return;
      }

      if (target.classList.contains('hashtag')) {
        const tag = target.dataset.hashtag?.replace('#', '') || '';
        this.$router.push({ path: '/tabs/follow', query: { q: `#${tag}` } });
        return;
      }

      // Default: open full post view
      this.openPostDetail(post);
    },
    openProfile(post) {
      if (!post || !post.username) return;
      this.$router.push(`/tabs/profile/${post.username}`);
    },

    openPostDetail(post) {
      this.detailPost = post;
      this.showPostDetail = true;
      this.loadDetailComments(post?.post_id);
    },

    closePostDetail() {
      this.showPostDetail = false;
      this.detailPost = null;
      this.detailComments = [];
      this.loadingDetailComments = false;
    },

    async loadDetailComments(postId) {
      if (!postId) return;
      this.loadingDetailComments = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/comments/${postId}`, {
          params: { limit: 100 }
        });
        const raw = (res.data.comments || []).map(c => ({
          ...c,
          id: String(c.id),
          parent_comment_id: c.parent_comment_id ? String(c.parent_comment_id) : null
        }));
        const byId = new Map(raw.map(c => [c.id, c]));
        const replyCounts = {};
        raw.forEach(c => {
          if (c.parent_comment_id) {
            replyCounts[c.parent_comment_id] = (replyCounts[c.parent_comment_id] || 0) + 1;
          }
        });
        const computeDepth = (c, depth = 0, visited = new Set()) => {
          if (!c || !c.parent_comment_id) return depth;
          if (visited.has(c.id)) return depth;
          visited.add(c.id);
          const parent = byId.get(c.parent_comment_id);
          return computeDepth(parent, Math.min(depth + 1, 8), visited);
        };
        this.detailComments = raw.map(c => {
          const parent = c.parent_comment_id ? byId.get(c.parent_comment_id) : null;
          return {
            ...c,
            liked: !!c.liked,
            likes: c.likes || 0,
            replies: replyCounts[c.id] || 0,
            parent: parent ? { id: String(parent.id), username: parent.username, content: parent.content || '', image: parent.image || '' } : null,
            depth: computeDepth(c)
          };
        });
      } catch (err) {
        console.error('Failed to load detail comments:', err);
        this.detailComments = [];
      } finally {
        this.loadingDetailComments = false;
      }
    },

    onCommentTextClick(event) {
      const target = event.target;
      if (!target?.classList) return;

      if (target.classList.contains('mention') && target.dataset.mention) {
        const username = target.dataset.mention;
        this.$router.push(`/tabs/profile/${username}`);
        return;
      }

      if (target.classList.contains('hashtag')) {
        const tag = target.dataset.hashtag?.replace('#', '') || '';
        this.$router.push({ path: '/tabs/follow', query: { q: `#${tag}` } });
        return;
      }
    },

    openMedia(post, mediaItem) {
      const src = mediaItem?.data ? this.getImageUrl(mediaItem.data) : (post && post.image ? this.getImageUrl(post.image) : '');
      if (!src) return;
      this.mediaSrc = src;
      this.showMediaModal = true;
      this.mediaZoom = 1;
    },

    closeMediaModal() {
      this.showMediaModal = false;
      this.mediaSrc = '';
      this.mediaZoom = 1;
    },

    async onPostInput(e) {
      const text = this.postContent || '';
      // Find the last @word fragment
      const match = text.match(/@([a-zA-Z0-9_]{1,20})$/);
      if (match) {
        const query = match[1];
        this.mentionQuery = query;
        await this.fetchMentionSuggestions(query);
      } else {
        this.mentionQuery = '';
        this.mentionSuggestions = [];
        this.showMentionSuggestions = false;
      }
    },

    async loadMorePosts(ev) {
      if (this.loadingMore || !this.hasMorePosts) {
        if (ev?.target) ev.target.complete();
        return;
      }

      try {
        this.loadingMore = true;
        const nextOffset = this.pageOffset + this.pageLimit;
        const result = await this.fetchFeedUltraFast(nextOffset, this.pageLimit);

        const nextPosts = (result?.posts || []).map(p => ({
          ...p,
          liked: false,
          comments: p.comments_count || 0
        }));

        if (nextPosts.length === 0) {
          this.hasMorePosts = false;
        } else {
          const existing = new Set(this.posts.map(p => p.post_id));
          const deduped = nextPosts.filter(p => !existing.has(p.post_id));
          this.posts = this.posts.concat(deduped);
          this.pageOffset = nextOffset;
          if (nextPosts.length < this.pageLimit) this.hasMorePosts = false;
        }
      } catch (err) {
        console.error('Failed to load more posts:', err);
      } finally {
        this.loadingMore = false;
        if (ev?.target) ev.target.complete();
      }
    },

    onFeedScroll(ev) {
      const top = ev?.detail?.scrollTop ?? 0;
      this._isNearTop = top < 200;
      if (this._isNearTop) this.showNewPostsBanner = false;
    },

    async checkForNewPosts() {
      if (!this.latestPostId) return;

      try {
        const result = await this.fetchFeedUltraFast(0, 1);
        const newestId = result?.posts?.[0]?.post_id;
        if (newestId && newestId !== this.latestPostId) {
          if (this._isNearTop) {
            await this.refreshFeed(null, true);
          } else {
            this.showNewPostsBanner = true;
          }
        }
      } catch (_) {}
    },

    async viewNewPosts() {
      this.showNewPostsBanner = false;

      try {
        if (this.$refs.content?.scrollToTop) {
          await this.$refs.content.scrollToTop(250);
        } else if (this.$refs.content?.$el?.scrollToTop) {
          await this.$refs.content.$el.scrollToTop(250);
        }
      } catch (_) {}

      await this.refreshFeed(null, true);
    },

    async fetchMentionSuggestions(query) {
      if (!query || query.length < 1) {
        this.mentionSuggestions = [];
        this.showMentionSuggestions = false;
        return;
      }
      try {
        const res = await axios.get(`${this.API_URL}/api/search/users`, {
          params: { q: query, limit: 8, user_id: this.userId }
        });
        const users = res.data.users || [];
        this.mentionSuggestions = users;
        this.showMentionSuggestions = users.length > 0;
      } catch (err) {
        console.error('Mention lookup error:', err);
        this.mentionSuggestions = [];
        this.showMentionSuggestions = false;
      }
    },

    selectMention(user) {
      if (!user || !user.username) return;
      const text = this.postContent || '';
      // Replace the last @fragment with the selected username
      const updated = text.replace(/@([a-zA-Z0-9_]{1,20})$/, `@${user.username} `);
      this.postContent = updated;
      this.mentionSuggestions = [];
      this.showMentionSuggestions = false;
      this.mentionQuery = '';
    },
    openProfile(post) {
      if (!post || !post.username) return;
      this.$router.push(`/tabs/profile/${post.username}`);
    },

    openMedia(post, mediaItem) {
      const src = mediaItem?.data ? this.getImageUrl(mediaItem.data) : (post && post.image ? this.getImageUrl(post.image) : '');
      if (!src) return;
      this.mediaSrc = src;
      this.showMediaModal = true;
    },

    closeMediaModal() {
      this.showMediaModal = false;
      this.mediaSrc = '';
      this.mediaZoom = 1;
    },

    ensureAuthenticated() {
      if (!this.userId) {
        this.$router.push('/login');
        return false;
      }
      return true;
    },

    goToProfile() {
      if (!this.ensureAuthenticated()) return;
      this.$router.push('/tabs/profile');
    },
    getImageUrl(imageData) {
      if (!imageData || imageData === '') return this.defaultAvatar;
      if (typeof imageData !== 'string') return this.defaultAvatar;
      if (imageData.startsWith('http')) return imageData;
      if (imageData.startsWith('data:image')) return imageData;
      if (imageData.startsWith('/static/')) return `${this.API_URL}${imageData}`;
      return `data:image/png;base64,${imageData}`;
    },
    
    handleImageError(event) {
      event.target.src = this.defaultAvatar;
    },
    
    formatRelativeTime(timestamp) {
      try {
        // Normalize timestamp to a timezone-aware Date so local offsets don't skew the
        // relative time (previously showed ~3h for fresh posts).
        const normalizeTimestamp = (value) => {
          if (typeof value === 'number') {
            // Unix timestamp (seconds or ms)
            return value > 1000000000000 ? new Date(value) : new Date(value * 1000);
          }

          if (typeof value === 'string') {
            const trimmed = value.trim();
            const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
            const looksIso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(trimmed);

            if (looksIso && !hasZone) {
              // Treat naive timestamps from backend as UTC and add Z
              const iso = trimmed.replace(' ', 'T') + 'Z';
              return new Date(iso);
            }

            // ISO or other parseable formats (already include zone info)
            return new Date(trimmed);
          }

          return new Date();
        };

        const postDate = normalizeTimestamp(timestamp);
        const now = new Date();
        const diffMs = now - postDate;
        
        if (isNaN(diffMs) || diffMs < 0) {
          return 'now';
        }
        
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHr = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHr / 24);

        if (diffSec < 10) return 'now';
        if (diffSec < 60) return `${diffSec}s`;
        if (diffMin < 60) return `${diffMin}m`;
        if (diffHr < 24) return `${diffHr}h`;
        if (diffDay < 7) return `${diffDay}d`;
        return postDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch (err) {
        console.error('Timestamp error:', err, timestamp);
        return '';
      }
    },
    
    async refreshFeed(event = null, forceRefresh = false) {
      console.log('⚡ ULTRA-FAST refreshFeed', { userId: this.userId, forceRefresh });

      const now = Date.now();
      
      // Check cache (2 minutes)
      if (!forceRefresh && this.posts.length > 0 && (now - this.lastFetchTime) < this.CACHE_DURATION) {
        console.log('⚡ CACHE HIT: Using cached posts:', this.posts.length);
        if (event) event.target.complete();
        return;
      }

      // Cancel any pending request
      if (this.requestController) {
        this.requestController.abort();
      }

      try {
        this.isLoading = true;
        this.errorMessage = '';
        this.retryCount = 0;

        // Reset paging
        this.pageOffset = 0;
        this.hasMorePosts = true;
        this.showNewPostsBanner = false;
        
        // Try offline first if network is down
        if (isNetworkOffline()) {
          console.log('📡 Device is OFFLINE, loading from IndexedDB...');
          const offlinePosts = await getOfflinePosts();
          if (offlinePosts && offlinePosts.length > 0) {
            this.posts = offlinePosts;
            this.isLoading = false;
            if (event) event.target.complete();
            return;
          } else {
            this.errorMessage = 'You are offline and no cached posts were found.';
            this.isLoading = false;
            if (event) event.target.complete();
            return;
          }
        }

        const result = await this.fetchFeedUltraFast(this.pageOffset, this.pageLimit);
        
        if (result.success && result.posts) {
          this.posts = result.posts.map(p => ({
            ...p,
            liked: false,
            comments: p.comments_count || 0
          }));

          // Save to offline DB
          await savePostsOffline(this.posts);

          this.latestPostId = this.posts[0]?.post_id || null;
          if (!result.posts || result.posts.length < this.pageLimit) {
            this.hasMorePosts = false;
          }
          
          this.lastFetchTime = now;
          console.log(`⚡ LOADED ${this.posts.length} posts in ULTRA-FAST mode`);
        } else {
          // Fallback to offline if request failed
          const offlinePosts = await getOfflinePosts();
          if (offlinePosts && offlinePosts.length > 0) {
             console.log('📡 Request failed, falling back to offline data');
             this.posts = offlinePosts;
          } else {
            this.errorMessage = result.error || 'Failed to load feed';
            throw new Error(this.errorMessage);
          }
        }
      } catch (err) {
        console.error('❌ Feed error:', err);
        // Last resort: check offline data again
        const offlinePosts = await getOfflinePosts();
        if (offlinePosts && offlinePosts.length > 0) {
          this.posts = offlinePosts;
        } else {
          this.handleFeedError(err);
        }
      } finally {
        this.isLoading = false;
        if (event) event.target.complete();
      }
    },
    
    async fetchFeedUltraFast(offset = 0, limit = 20) {
      // ULTRA-FAST: Single attempt with aggressive timeout
      const timeout = 30000;  // Increased to 30s for production stability
      
      console.log(`⚡ ULTRA-FAST fetch (timeout: ${timeout}ms)`);
      
      this.requestController = new AbortController();
      
      const timeoutId = setTimeout(() => {
        console.log(`⏱️ Timeout after ${timeout}ms`);
        this.requestController.abort();
      }, timeout);
      
      try {
        const res = await axios.post(
          `${this.API_URL}/api/feed`,
          { 
            user_id: this.userId || 0,
            mode: this.activeTab === 'following' ? 'following' : 'foryou',
            limit: limit,
            offset: offset
          },
          {
            signal: this.requestController.signal,
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: timeout
          }
        );
        
        clearTimeout(timeoutId);
        
        console.log('⚡ Response received:', res.data);
        
        if (res.data && res.data.posts !== undefined) {
          return { success: true, posts: res.data.posts };
        } else {
          return { success: false, error: 'Invalid response' };
        }
      } catch (err) {
        clearTimeout(timeoutId);
        
        console.error('❌ Request failed:', err.message);
        
        // ONE retry only
        if ((err.code === 'ECONNABORTED' || err.name === 'AbortError') && this.retryCount < 1) {
          this.retryCount++;
          console.log(`🔄 Retry 1/1...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          return await this.fetchFeedUltraFast(offset, limit);
        }
        
        return { success: false, error: err.message };
      }
    },
    
    handleFeedError(err) {
      if (err.code === 'ECONNABORTED' || err.name === 'AbortError') {
        this.errorMessage = 'Connection timeout. Backend might be starting up. Please wait 30 seconds and try again.';
      } else if (err.response?.status === 401) {
        this.$router.push('/login');
      } else if (!err.response) {
        this.errorMessage = 'Network error. Check your internet connection.';
      } else {
        this.errorMessage = 'Failed to load feed. Pull down to retry.';
      }
    },
    
    openPostComposer() {
      if (!this.ensureAuthenticated()) return;
      this.showPostModal = true;
    },

    async submitPost() {
      if (!this.ensureAuthenticated()) return;
      if (!this.canPost || this.isPosting) return;
      
      try {
        this.isPosting = true;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);  // 30 seconds
        
        const res = await axios.post(
          `${this.API_URL}/api/post`, 
          {
            user_id: this.userId,
            content: this.postContent,
            // Keep legacy image for backwards compatibility (first image), but send full media list
            image: this.postMedia.find(m => m.type === 'image')?.data || null,
            media: this.postMedia
          },
          { 
            signal: controller.signal,
            timeout: 300000 // 5 minutes for large media uploads
          }
        );
        
        clearTimeout(timeoutId);
        
        if (res.data.success) {
          this.closePostModal();
          // Force refresh after posting
          await this.refreshFeed(null, true);
        } else {
          alert(res.data.message || 'Failed to create post');
        }
      } catch (err) {
        console.error('❌ Post error:', err);
        alert('Failed to create post. Please try again.');
      } finally {
        this.isPosting = false;
      }
    },
    
    async onMediaChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      const remainingSlots = 4 - this.postMedia.length;
      const toAdd = files.slice(0, remainingSlots);

      for (const file of toAdd) {
        const isVideo = file.type.startsWith('video');
        const maxSize = isVideo ? 150 * 1024 * 1024 : 50 * 1024 * 1024; // 150MB for videos, 50MB for images

        if (file.size > maxSize) {
          alert(`${isVideo ? 'Video' : 'Image'} must be less than ${isVideo ? '150' : '50'}MB`);
          continue;
        }

        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          
          // For videos, generate thumbnail
          let thumbnail = null;
          if (isVideo) {
            try {
              thumbnail = await this.extractVideoThumbnail(file);
            } catch (err) {
              console.error('Failed to generate video thumbnail:', err);
            }
          }
          
          // Send full dataUrl to backend to aid in media/type detection
          this.postMedia.push({
            type: isVideo ? 'video' : 'image',
            data: dataUrl,
            thumbnail: thumbnail // Only set for videos
          });

          this.mediaPreviews.push({
            type: isVideo ? 'video' : 'image',
            src: dataUrl,
            thumbnail: thumbnail
          });
        };
        reader.readAsDataURL(file);
      }

      // Reset input so selecting the same file again works
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },
    
    async extractVideoThumbnail(file) {
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        video.src = URL.createObjectURL(file);
        
        video.onloadedmetadata = () => {
          // Seek to 1 second or middle of video, whichever is smaller
          video.currentTime = Math.min(1, video.duration / 2);
        };
        
        video.onseeked = () => {
          try {
            // Set canvas size to video dimensions
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Draw current video frame to canvas
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Convert canvas to base64 JPEG (0.8 quality for good balance)
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            
            // Clean up
            URL.revokeObjectURL(video.src);
            resolve(thumbnail);
          } catch (err) {
            URL.revokeObjectURL(video.src);
            reject(err);
          }
        };
        
        video.onerror = (err) => {
          URL.revokeObjectURL(video.src);
          reject(err);
        };
      });
    },
    
    removeMedia(index) {
      this.postMedia.splice(index, 1);
      this.mediaPreviews.splice(index, 1);
    },
    
    closePostModal() {
      this.showPostModal = false;
      this.postContent = '';
      this.postMedia = [];
      this.mediaPreviews = [];
      this.showEmojiPicker = false;
      if (this.$refs.fileInput) {
        this.$refs.fileInput.value = '';
      }
    },

    toggleEmojiPicker() {
      this.showEmojiPicker = !this.showEmojiPicker;
    },

    addEmoji(emoji) {
      this.postContent += emoji;
    },
    
    async toggleLike(postId, liked) {
      if (!this.ensureAuthenticated()) return;
      const post = this.posts.find(p => p.post_id === postId);
      if (!post) return;
      
      const previousLiked = post.liked;
      const previousLikes = post.likes;
      
      post.liked = !liked;
      post.likes += liked ? -1 : 1;
      
      try {
        await axios.post(
          `${this.API_URL}/api/like`, 
          { 
            post_id: postId, 
            increment: !liked 
          },
          { timeout: 5000 }  // 5 second timeout
        );
      } catch (err) {
        post.liked = previousLiked;
        post.likes = previousLikes;
        console.error('❌ Like error:', err);
      }
    },
    
    async deletePost(postId) {
      if (!confirm('Delete this post?')) return;
      
      try {
        const res = await axios.post(
          `${this.API_URL}/api/delete_post`, 
          { 
            post_id: postId, 
            user_id: this.userId 
          },
          { timeout: 5000 }
        );
        
        if (res.data.success) {
          this.posts = this.posts.filter(p => p.post_id !== postId);
        } else {
          alert(res.data.message || 'Failed to delete post');
        }
      } catch (err) {
        console.error('❌ Delete error:', err);
        alert('Failed to delete post');
      }
    },
    
    openRepostOptions(post) {
      if (!this.ensureAuthenticated()) return;
      this.repostTarget = post;
      if (post?.is_reposted_by_me) {
        this.showUndoRepostSheet = true;
      } else {
        this.showRepostSheet = true;
      }
    },

    async undoRepost() {
      try {
        if (!this.ensureAuthenticated()) return;
        const post = this.repostTarget;
        if (!post?.post_id) return;
        this.showUndoRepostSheet = false;
        const res = await axios.post(`${this.API_URL}/api/repost/undo`, {
          user_id: this.userId,
          post_id: post.post_id
        });
        if (res.data?.success) {
          await this.refreshFeed(null, true);
        } else {
          alert(res.data?.message || 'Failed to undo repost');
        }
      } catch (e) {
        console.error('Undo repost failed:', e);
        alert('Failed to undo repost. Please try again.');
      }
    },

    async doRepost() {
      try {
        if (!this.ensureAuthenticated()) return;
        const post = this.repostTarget;
        if (!post?.post_id) return;
        this.showRepostSheet = false;
        const res = await axios.post(`${this.API_URL}/api/repost`, {
          user_id: this.userId,
          post_id: post.post_id
        });
        if (res.data?.success) {
          await this.refreshFeed(null, true);
        } else {
          alert(res.data?.message || 'Failed to repost');
        }
      } catch (e) {
        console.error('Repost failed:', e);
        alert('Failed to repost. Please try again.');
      }
    },

    openQuoteRepost() {
      this.showRepostSheet = false;
      this.showQuoteRepostModal = true;
      this.quoteText = '';
      this.quoteMedia = [];
      this.quoteMediaPreviews = [];
    },

    closeQuoteRepostModal() {
      this.showQuoteRepostModal = false;
      this.quoteText = '';
      this.quoteMedia = [];
      this.quoteMediaPreviews = [];
      this.quotePosting = false;
      if (this.$refs.quoteMediaInput) this.$refs.quoteMediaInput.value = '';
    },

    async onQuoteMediaChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const remaining = 4 - this.quoteMedia.length;
      const toAdd = files.slice(0, remaining);

      for (const file of toAdd) {
        const isVideo = file.type.startsWith('video/');
        const maxSize = isVideo ? 150 * 1024 * 1024 : 50 * 1024 * 1024;
        
        if (file.size > maxSize) {
          alert(`${isVideo ? 'Video' : 'Image'} must be less than ${isVideo ? '150' : '50'}MB`);
          continue;
        }
        
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUrl = ev.target.result;
          const type = isVideo ? 'video' : 'image';
          
          // Generate thumbnail for videos
          let thumbnail = null;
          if (isVideo) {
            try {
              thumbnail = await this.extractVideoThumbnail(file);
            } catch (err) {
              console.error('Failed to generate video thumbnail:', err);
            }
          }
          
          this.quoteMedia.push({ type, data: dataUrl, thumbnail });
          this.quoteMediaPreviews.push({ type, src: dataUrl, thumbnail });
        };
        reader.readAsDataURL(file);
      }

      if (this.$refs.quoteMediaInput) this.$refs.quoteMediaInput.value = '';
    },

    async submitQuoteRepost() {
      try {
        if (!this.ensureAuthenticated()) return;
        const post = this.repostTarget;
        if (!post?.post_id) return;

        if (this.quotePosting) return;
        this.quotePosting = true;

        const res = await axios.post(`${this.API_URL}/api/repost`, {
          user_id: this.userId,
          post_id: post.post_id,
          quote_text: this.quoteText,
          quote_media: this.quoteMedia
        });

        if (res.data?.success) {
          this.closeQuoteRepostModal();
          await this.refreshFeed(null, true);
        } else {
          alert(res.data?.message || 'Failed to quote repost');
        }
      } catch (e) {
        console.error('Quote repost failed:', e);
        alert('Failed to quote repost. Please try again.');
      } finally {
        this.quotePosting = false;
      }
    },
    
    openComments(post) {
      if (!this.ensureAuthenticated()) return;
      this.activeCommentPost = post;
      this.replyToCommentId = null;
      this.newComment = '';
      this.commentMedia = null;
      this.commentMediaPreview = '';
      this.showCommentsModal = true;
      this.loadComments(post.post_id);
    },

    closeComments() {
      this.showCommentsModal = false;
      this.comments = [];
      this.newComment = '';
      this.activeCommentPost = null;
      this.replyToCommentId = null;
      this.commentMedia = null;
      this.commentMediaPreview = '';
      if (this.$refs.commentFileInput) this.$refs.commentFileInput.value = '';
    },

    async loadComments(postId) {
      this.loadingComments = true;
      try {
        const res = await axios.get(`${this.API_URL}/api/comments/${postId}`, {
          params: { limit: 100 }
        });
        const raw = (res.data.comments || []).map(c => ({
          ...c,
          id: String(c.id),
          parent_comment_id: c.parent_comment_id ? String(c.parent_comment_id) : null
        }));
        const byId = new Map(raw.map(c => [c.id, c]));
        const replyCounts = {};
        raw.forEach(c => {
          if (c.parent_comment_id) {
            replyCounts[c.parent_comment_id] = (replyCounts[c.parent_comment_id] || 0) + 1;
          }
        });
        const computeDepth = (c, depth = 0, visited = new Set()) => {
          if (!c || !c.parent_comment_id) return depth;
          if (visited.has(c.id)) return depth; // guard
          visited.add(c.id);
          const parent = byId.get(c.parent_comment_id);
          return computeDepth(parent, Math.min(depth + 1, 8), visited);
        };
        this.comments = raw.map(c => {
          const parent = c.parent_comment_id ? byId.get(c.parent_comment_id) : null;
          return {
            ...c,
            liked: !!c.liked,
            likes: c.likes || 0,
            replies: replyCounts[c.id] || 0,
            parent: parent ? { id: parent.id, username: parent.username, content: parent.content || '', image: parent.image || '' } : null,
            depth: computeDepth(c)
          };
        });
      } catch (err) {
        console.error('Load comments error:', err);
        this.comments = [];
      } finally {
        this.loadingComments = false;
      }
    },

    async submitComment() {
      if (!this.ensureAuthenticated()) return;
      if ((!this.newComment.trim() && !this.commentMedia) || !this.activeCommentPost || this.postingComment) return;

      try {
        this.postingComment = true;
        const postId = this.activeCommentPost.post_id;
        const content = this.newComment.trim();
        const image = this.commentMedia ? this.commentMedia.src : null;

        const res = await axios.post(`${this.API_URL}/api/comments`, {
          user_id: this.userId,
          post_id: postId,
          content,
          image,
          parent_comment_id: this.replyToCommentId
        });

        // Defensive: Handle both res.data.success and res.success
        // Note: axios returns full response, so res.data.success is correct
        // but we add fallback for consistency
        const success = res.data?.success !== undefined ? res.data.success : res.success;
        
        console.log('Comment submission response:', { success, res });

        if (success) {
          // Reload comments or optimistically add
          await this.loadComments(postId);
          this.newComment = '';
          this.replyToCommentId = null;
          this.commentMedia = null;
          this.commentMediaPreview = '';

          // Update comment count on the post
          const post = this.posts.find(p => p.post_id === postId);
          if (post) {
            post.comments = (post.comments || 0) + 1;
          }
        } else {
          const errorMsg = res.data?.message || res.message || 'Failed to add comment';
          alert(errorMsg);
          console.error('Comment submission failed:', errorMsg, res);
        }
      } catch (err) {
        console.error('Submit comment error:', err);
        console.error('Error response:', err.response?.data);
        const errorMsg = err.response?.data?.message || err.message || 'Failed to add comment';
        alert(errorMsg);
      } finally {
        this.postingComment = false;
      }
    },

    goToCommentUser(comment) {
      if (!comment || !comment.username) return;
      this.$router.push(`/tabs/profile/${comment.username}`);
    },
    
    replyToComment(c) {
      if (!c || !c.username) return;
      const mention = `@${c.username} `;
      if (!this.newComment.startsWith(mention)) {
        this.newComment = mention + this.newComment;
      }
      this.replyToCommentId = c.id;
      const ref = this.$refs.commentInput;
      if (ref && typeof ref.setFocus === 'function') {
        ref.setFocus();
      }
    },
    async onCommentMediaChange(e) {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const file = files[0];
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? 150 * 1024 * 1024 : 50 * 1024 * 1024;
      
      if (file.size > maxSize) {
        alert(`${isVideo ? 'Video' : 'Image'} must be less than ${isVideo ? '150' : '50'}MB`);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        
        // Generate thumbnail for videos
        let thumbnail = null;
        if (isVideo) {
          try {
            thumbnail = await this.extractVideoThumbnail(file);
          } catch (err) {
            console.error('Failed to generate video thumbnail:', err);
          }
        }
        
        this.commentMedia = {
          type: isVideo ? 'video' : 'image',
          src: dataUrl,
          thumbnail
        };
        this.commentMediaPreview = dataUrl;
      };
      reader.readAsDataURL(file);
      if (this.$refs.commentFileInput) this.$refs.commentFileInput.value = '';
    },
    removeCommentMedia() {
      this.commentMedia = null;
      this.commentMediaPreview = '';
      if (this.$refs.commentFileInput) this.$refs.commentFileInput.value = '';
    },
    isVideo(media) {
      const v = String(media || '');
      return v.startsWith('data:video') || /\.mp4($|\?)/i.test(v);
    },
    getMediaSrc(media) {
      const v = String(media || '');
      if (v.startsWith('data:') || v.startsWith('http')) return v;
      return this.getImageUrl(v);
    },
    toggleCommentLike(c) {
      if (!c) return;
      const liked = !!c.liked;
      const likes = c.likes || 0;
      c.liked = !liked;
      c.likes = Math.max(0, likes + (liked ? -1 : 1));
    },
    reshareComment(c) {
      console.log('Reshare comment', c?.id);
    },
    async shareComment(c) {
      if (!c) return;
      
      const shareUrl = `${window.location.origin}/tabs/feed?comment=${c.id}`;
      const fullText = `${c.content || 'Check out this comment on NexFi!'}\n\n🔗 ${shareUrl}`;
      const shareData = {
        title: `NexFi - Comment by @${c.username}`,
        text: fullText,
        url: shareUrl
      };

      if (navigator.share) {
        try {
          if (c.image) {
            const mediaUrl = this.getImageUrl(c.image);
            const response = await fetch(mediaUrl);
            const blob = await response.blob();
            const file = new File([blob], 'comment-image.jpg', { type: blob.type });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              shareData.files = [file];
            }
          }
          await navigator.share(shareData);
        } catch (err) {
          console.log('❌ Comment share failed/cancelled:', err);
        }
      } else {
        // Fallback for browsers without navigator.share
        try {
          await navigator.clipboard.writeText(shareUrl);
          alert('🔗 Link copied to clipboard!');
        } catch (err) {
          console.error('❌ Failed to copy link:', err);
          alert('Unable to share. Please copy the URL manually.');
        }
      }
    },
    
    async share(post) {
      if (!post) return;
      
      // Backend share URL for rich link previews (WhatsApp, Facebook, etc.)
      const backendShareUrl = `${this.API_URL}/share/post/${post.post_id}`;
      
      // Frontend URL for direct access (cleaner for clipboard)
      const frontendUrl = `${window.location.origin}/tabs/feed?post=${post.post_id}`;
      
      const shareData = {
        title: `NexFi - Post by @${post.username}`,
        text: post.content || 'Check out this post on NexFi!',
        url: backendShareUrl  // Use backend URL for native share (better previews)
      };

      // Check if native share is available
      if (navigator.share) {
        try {
          await navigator.share(shareData);
          console.log('✅ Post shared successfully');
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('❌ Share failed:', err);
          }
        }
      } else {
        // Fallback: Show action sheet with share options
        const buttons = [
          {
            text: 'Share to WhatsApp',
            icon: 'logo-whatsapp',
            handler: () => {
              // Use backend URL for WhatsApp to get rich preview
              const whatsappText = encodeURIComponent(`${shareData.text}\n\n${backendShareUrl}`);
              window.open(`https://wa.me/?text=${whatsappText}`, '_blank');
            }
          },
          {
            text: 'Copy Link',
            icon: 'copy-outline',
            handler: async () => {
              try {
                // Use frontend URL for clipboard (cleaner, user-friendly)
                await navigator.clipboard.writeText(frontendUrl);
                alert('🔗 Link copied to clipboard!');
              } catch (err) {
                console.error('❌ Failed to copy:', err);
                alert('Unable to copy link');
              }
            }
          },
          {
            text: 'Cancel',
            role: 'cancel'
          }
        ];
        
        // Create and show action sheet
        this.shareActionSheetButtons = buttons;
        this.showShareActionSheet = true;
      }
    },
    
    toggleTheme() {
      this.$root.toggleTheme?.();
    },
    
    logout() {
      if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('userId');
        localStorage.removeItem('username');
        localStorage.removeItem('userAvatar');
        this.$router.push('/login');
      }
    },

    async triggerTestNotification() {
      if (!this.userId) return;
      
      // Mobile & Security Check
      const isSecure = window.isSecureContext;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      
      // If permission is denied/default, try to request it first
      if (this.notificationPermission !== 'granted') {
          console.log('🔔 Requesting permission before test...');
          await notificationService.requestWebPermission();
          this.updateNotificationPermission();
          
          if (this.notificationPermission !== 'granted') {
              if (!isSecure && window.location.hostname !== 'localhost') {
                  alert('❌ Security Error: Browser notifications require HTTPS. Please use a secure connection or localhost.');
              } else if (isIOS && !window.navigator.standalone) {
                  alert('📱 iOS Requirement: To see notifications in the tray, you must "Add to Home Screen" (Share button > Add to Home Screen) and open the app from your home screen.');
              } else {
                  alert('Please enable notifications in your browser settings (usually in the site info/lock icon next to the URL) to see alerts in the tray.');
              }
              return;
          }
      }

      console.log('🧪 Triggering test notification for user:', this.userId);
      try {
        const res = await axios.post(`${this.API_URL}/api/test/notification`, {
          user_id: this.userId
        }, { timeout: 10000 });
        
        if (res.data.success) {
          console.log('✅ Test notification triggered successfully');
        } else {
          console.error('❌ Backend returned success:false:', res.data.error);
          alert(`Server Error: ${res.data.error || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('❌ Test notification Axios error:', err);
        if (err.response) {
          console.error('   Status:', err.response.status);
          console.error('   Data:', err.response.data);
          alert(`Error: ${err.response.status} - ${err.response.data?.error || 'Server error'}`);
        } else if (err.request) {
          console.error('   No response received. Network issue or CORS?');
          alert('Network Error: No response from server. Check CORS or if server is running.');
        } else {
          console.error('   Message:', err.message);
          alert(`Request Error: ${err.message}`);
        }
      }
    },

    updateNotificationPermission() {
      this.notificationPermission = notificationService.getPermissionStatus();
      console.log('🔔 Current notification permission:', this.notificationPermission);
    },

    installPWA() {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      
      if (this.deferredPrompt) {
        console.log('✨ Triggering native PWA install prompt...');
        this.deferredPrompt.prompt();
        this.deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('✅ User accepted PWA install');
          } else {
            console.log('❌ User dismissed PWA install');
          }
          this.deferredPrompt = null;
        });
      } else if (isIOS) {
        alert('📱 To install NexFi on your iPhone/iPad:\n\n1. Tap the Share button (square with arrow)\n2. Scroll down and tap "Add to Home Screen"\n3. Tap Add at the top right.');
      } else {
        // Broad fallback for Android/Chrome/Desktop when beforeinstallprompt hasn't fired
        const isSecure = window.isSecureContext;
        if (!isSecure && window.location.hostname !== 'localhost') {
            alert('🔐 Security Requirement: PWA installation requires a secure HTTPS connection. Please ensure you are using https:// and not an IP address.');
        } else {
            alert('ℹ️ Installation Tip:\n\nIf the "Install" button didn\'t trigger automatically:\n1. Open your browser menu (three dots at the top right).\n2. Look for "Install app" or "Add to Home screen".');
        }
      }
    },

    async handleDeepLinks() {
      const postId = this.$route.query.post;
      if (postId) {
        console.log('🔗 Deep link detected for post:', postId);
        
        // 1. Try to find in existing loaded posts
        let targetPost = this.posts.find(p => String(p.post_id) === String(postId));
        
        // 2. If not found, fetch specifically
        if (!targetPost) {
          try {
            // this.isLoading = true; // Optional: avoid full screen loader if possible
            const res = await axios.get(`${this.API_URL}/api/posts/${postId}`);
            if (res.data.success) {
              targetPost = res.data.post;
            }
          } catch (err) {
            console.error('❌ Failed to fetch deep linked post:', err);
          } finally {
            this.isLoading = false;
          }
        }
        
        // 3. Open the modal
        if (targetPost) {
           this.openPostDetail(targetPost);
        }
      }
    }
  },
  
  async mounted() {
    console.log('⚡ FeedPage mounted - ULTRA-FAST MODE');
    console.log('👤 UserId:', this.userId);
    console.log('🌐 API_URL:', this.API_URL);
    
    // Always load feed, even for guests (userId may be null)
    console.log('⚡ Loading public feed...');
    this.refreshFeed(null, true);

    this.updateNotificationPermission();
    
    // Check for deep links (e.g., share links)
    this.handleDeepLinks();

    // PWA Install Prompt Listener
    if (window._deferredPrompt) {
      this.deferredPrompt = window._deferredPrompt;
      console.log('✨ PWA install prompt already captured globally!');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('✨ PWA install prompt captured!');
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      this.deferredPrompt = e;
      window._deferredPrompt = e; // Keep a global reference just in case
    });

    window.addEventListener('appinstalled', () => {
      console.log('🚀 NexFi app was installed!');
      this.deferredPrompt = null;
    });

    // Realtime feed updates via Socket.IO
    try {
      const socket = this.$socket;
      if (socket) {
        this._socketNewPostHandler = async (payload) => {
          try {
            const incomingPostId = payload?.post_id;
            if (incomingPostId && this.latestPostId && String(incomingPostId) === String(this.latestPostId)) {
              return;
            }

            if (this._isNearTop) {
              await this.refreshFeed(null, true);
            } else {
              this.showNewPostsBanner = true;
            }
          } catch (e) {
            console.error('Socket feed:new_post handler error:', e);
          }
        };

        socket.on('feed:new_post', this._socketNewPostHandler);
      }
    } catch (e) {
      console.error('Feed socket setup failed:', e);
    }

    this._newPostsInterval = setInterval(() => {
      this.checkForNewPosts();
    }, 5000);
    
    window.addEventListener('themeChanged', (e) => {
      this.theme = e.detail;
    });

    this._globalPostHandler = () => {
      this.openPostComposer();
    };
    window.addEventListener('open-post-modal', this._globalPostHandler);
  },
  
  beforeUnmount() {
    if (this.requestController) {
      this.requestController.abort();
    }

    if (this._newPostsInterval) {
      clearInterval(this._newPostsInterval);
      this._newPostsInterval = null;
    }

    try {
      const socket = this.$socket;
      if (socket && this._socketNewPostHandler) {
        socket.off('feed:new_post', this._socketNewPostHandler);
        this._socketNewPostHandler = null;
      }
    } catch (_) {}

    if (this._globalPostHandler) {
      window.removeEventListener('open-post-modal', this._globalPostHandler);
      this._globalPostHandler = null;
    }
  }
}
</script>

<style scoped>
/* Header */
ion-header {
  --background: var(--ion-background-color, #fff);
}

ion-toolbar {
  --background: var(--ion-background-color, #fff);
  --border-width: 0;
  --min-height: 40px;
}

.feed-title {
  font-family: "Times New Roman", Times, serif !important;
  font-weight: 700;
  font-size: 24px;
  text-align: center;
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: -1; /* Place behind buttons */
}

.new-posts-banner {
  position: sticky;
  top: 0;
  z-index: 50;
  width: fit-content;
  margin: 10px auto;
  padding: 10px 14px;
  background: #daa520;
  color: #000;
  border-radius: 999px;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(218, 165, 32, 0.35);
}

.gold-fab {
  --background: linear-gradient(135deg, #daa520 0%, #ffd700 100%);
  --background-activated: #b8860b;
  --background-hover: #ffd700;
  --color: #000;
  --box-shadow: 0 4px 12px rgba(218, 165, 32, 0.4);
}

.perm-badge {
  position: absolute;
  top: 0;
  right: 0;
  background: #ff4961;
  color: white;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  font-size: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid white;
}

.header-logo-img {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
  padding: 2px;
}

/* Feed Tabs */
.feed-tabs {
  --background: var(--ion-background-color, #fff);
  --border-width: 0;
  padding: 0;
}

.tabs-container {
  display: flex;
  width: 100%;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
}

.feed-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  cursor: pointer;
  position: relative;
  transition: background-color 0.2s;
}

.feed-tab:hover {
  background-color: var(--ion-color-light, rgba(0, 0, 0, 0.03));
}

.feed-tab span {
  font-size: 15px;
  font-weight: 500;
  color: var(--ion-color-medium, #536471);
  transition: color 0.2s;
}

.feed-tab.active span {
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
}

.tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--ion-color-primary, #daa520);
  border-radius: 4px 4px 0 0;
  opacity: 0;
  transition: opacity 0.2s;
}

.feed-tab.active .tab-indicator {
  opacity: 1;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spin {
  animation: spin 1s linear infinite;
}

.show-more-toggle {
  color: #daa520;
  font-size: 14px;
  cursor: pointer;
  margin-top: 4px;
  font-weight: 500;
}

.show-more-toggle:hover {
  text-decoration: underline;
}

/* Feed Container */
.feed-container {
  max-width: 600px;
  margin: 0 auto;
}

/* Post Item */
.post-item {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  transition: background-color 0.2s;
}

.post-item:hover {
  background-color: var(--ion-color-light, rgba(0, 0, 0, 0.03));
}

.post-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.avatar-img {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.post-content-wrapper {
  flex: 1;
  min-width: 0;
}

/* Post Header */
.post-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 4px;
}

.post-user-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.username {
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
  font-size: 15px;
}

.handle, .separator, .timestamp {
  color: var(--ion-color-medium, #536471);
  font-size: 15px;
}

.more-btn {
  --padding-start: 8px;
  --padding-end: 8px;
  margin: -8px -8px 0 0;
  color: var(--ion-color-medium, #536471);
}

/* Post Content */
.post-text {
  font-size: 15px;
  line-height: 20px;
  color: var(--ion-text-color, #0f1419);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 8px;
}

.post-text .post-link {
  color: #daa520;
  text-decoration: none;
}

.post-text .post-link:hover {
  text-decoration: underline;
}

.post-text .hashtag,
.post-text .mention {
  color: #daa520;
  cursor: pointer;
}

.detail-text .post-link {
  color: #daa520;
  text-decoration: none;
}

.detail-text .post-link:hover {
  text-decoration: underline;
}

.detail-text .hashtag,
.detail-text .mention {
  color: #daa520;
  cursor: pointer;
}

.mention-suggestions {
  margin-top: 8px;
  border: 1px solid var(--ion-border-color, #e5e7eb);
  border-radius: 12px;
  background: var(--ion-background-color, #fff);
  box-shadow: 0 8px 24px rgba(0,0,0,0.08);
  max-height: 240px;
  overflow-y: auto;
}

.mention-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  gap: 10px;
  cursor: pointer;
}

.mention-item:hover {
  background: var(--ion-color-light, #f3f4f6);
}

.mention-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.mention-name {
  font-weight: 700;
  font-size: 14px;
}

.mention-handle {
  font-size: 12px;
  color: var(--ion-color-medium);
}

.post-media {
  margin: 8px 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--ion-border-color, #eff3f4);
}

.media-img {
  width: 100%;
  display: block;
  max-height: 500px;
  object-fit: cover;
}

.media-grid {
  display: grid;
  gap: 2px;
}

.media-grid.count-1 {
  grid-template-columns: 1fr;
}

.media-grid.count-2 {
  grid-template-columns: 1fr 1fr;
}

.media-grid.count-3,
.media-grid.count-4 {
  grid-template-columns: 1fr 1fr;
}

.media-item {
  position: relative;
  overflow: hidden;
}

.media-item img,
.media-item video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.detail-post {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-header {
  display: flex;
  gap: 10px;
  align-items: center;
  cursor: pointer;
}

.detail-name {
  font-weight: 700;
}

.detail-handle {
  color: var(--ion-color-medium);
  font-size: 14px;
}

.detail-text {
  font-size: 16px;
  line-height: 22px;
}

.detail-text .post-link {
  color: #daa520;
  text-decoration: none;
}

.detail-text .post-link:hover {
  text-decoration: underline;
}

.detail-text .hashtag,
.detail-text .mention {
  color: #daa520;
  cursor: pointer;
}

.detail-media img {
  width: 100%;
  border-radius: 16px;
  object-fit: contain;
  background: #000;
}

.detail-timestamp {
  color: var(--ion-color-medium);
  font-size: 14px;
}

.media-modal {
  --background: #000;
}

.media-lightbox {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: auto;
}

.zoom-container {
  transition: transform 0.2s ease-out;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 100%;
  min-height: 100%;
}

.media-lightbox img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

/* Full screen modal for media */
.full-screen-modal {
  --width: 100%;
  --height: 100%;
}

/* Post Actions */
.post-actions {
  display: flex;
  justify-content: space-between;
  max-width: 425px;
  margin-top: 4px;
}

.repost-context {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--ion-color-medium, #6b7280);
  font-size: 12px;
}

.repost-icon {
  font-size: 14px;
}

.quote-container {
  border: 1px solid var(--ion-border-color, #e5e7eb);
  border-radius: 12px;
  padding: 10px;
  margin-bottom: 10px;
  background: var(--ion-color-light, #f3f4f6);
}

.quote-text {
  color: var(--ion-text-color, #111827);
  font-size: 14px;
  line-height: 1.35;
  margin-bottom: 8px;
}

.detail-comments {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--ion-border-color, #e5e7eb);
}

.detail-comment-item {
  display: flex;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
}

.detail-comment-item.is-reply {
  position: relative;
}

.detail-comment-item.is-reply::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--ion-border-color, #e5e7eb);
  border-radius: 999px;
}

.detail-comment-avatar {
  width: 36px;
  flex: 0 0 36px;
}

.detail-comment-avatar .avatar-img {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.detail-comment-body {
  flex: 1;
  min-width: 0;
}

.detail-comment-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--ion-color-medium, #536471);
}

.detail-comment-username {
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
}

.detail-comment-text {
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.35;
  color: var(--ion-text-color, #0f1419);
  white-space: pre-wrap;
}

.detail-comment-text :deep(.hashtag),
.detail-comment-text :deep(.mention) {
  color: #daa520 !important;
}

.detail-comment-parent {
  margin-top: 6px;
  font-size: 12px;
  color: var(--ion-color-medium, #536471);
}

.detail-comment-parent-user {
  color: #daa520;
  font-weight: 700;
}

.detail-comment-image {
  margin-top: 8px;
  width: 100%;
  border-radius: 12px;
}

.action-btn {
  --padding-start: 0;
  --padding-end: 0;
  margin: 0;
  color: var(--ion-color-medium, #536471);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.retweet-btn.reposted {
  color: #22c55e;
}

.action-btn ion-icon {
  font-size: 18px;
}

.action-btn:hover {
  color: var(--ion-color-primary, #daa520);
}

.like-btn:hover, .like-btn.liked {
  color: #daa520;
}

.retweet-btn:hover {
  color: #00ba7c;
}

/* Compose Modal */
.compose-container {
  display: flex;
  gap: 12px;
}

.compose-avatar {
  flex-shrink: 0;
}

.compose-input {
  flex: 1;
}

.compose-textarea {
  --padding-start: 0;
  --padding-top: 0;
  font-size: 20px;
  min-height: 120px;
}

.preview-container {
  position: relative;
  margin: 12px 0;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid var(--ion-border-color, #eff3f4);
}

.preview-img {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  display: block;
}

.preview-grid {
  display: grid;
  gap: 4px;
  margin: 12px 0;
}

.preview-item {
  position: relative;
  overflow: hidden;
}

.preview-item.count-1 {
  grid-column: 1 / -1;
}

.preview-item img,
.preview-item video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.remove-img-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  --background: rgba(0, 0, 0, 0.75);
  --border-radius: 50%;
  --color: white;
  width: 32px;
  height: 32px;
}

.compose-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--ion-border-color, #eff3f4);
  margin-top: 12px;
}

.char-count {
  font-size: 13px;
  color: var(--ion-color-medium, #536471);
}

.char-count.over-limit {
  color: #f4212e;
}

/* Error State */
.error-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ion-color-medium, #536471);
}

.error-icon {
  font-size: 64px;
  color: var(--ion-color-danger, #eb445a);
  margin-bottom: 16px;
}

.error-state h2 {
  font-size: 24px;
  font-weight: 700;
  color: var(--ion-text-color, #0f1419);
  margin: 16px 0;
}

.error-state p {
  font-size: 15px;
  margin-bottom: 20px;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: var(--ion-color-medium, #536471);
}

.empty-icon {
  font-size: 64px;
  color: var(--ion-color-medium, #536471);
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 31px;
  font-weight: 800;
  color: var(--ion-text-color, #0f1419);
  margin: 16px 0;
}

/* Skeleton Loading */
.skeleton-container {
  max-width: 600px;
  margin: 0 auto;
}

.skeleton-post {
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
}

.skeleton-header {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
}

.skeleton-text-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-text {
  height: 12px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
}

.skeleton-username {
  width: 120px;
}

.skeleton-handle {
  width: 80px;
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 52px;
}

.skeleton-line {
  width: 100%;
}

.skeleton-line-short {
  width: 60%;
}

@keyframes loading {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Comments */
.comments-list {
  max-width: 600px;
  margin: 0 auto;
}

.comment-card {
  display: flex;
  padding: 12px 16px;
  border-bottom: 1px solid var(--ion-border-color, #eff3f4);
  transition: background-color 0.2s;
}

.comment-card:hover {
  background-color: var(--ion-color-light, rgba(0, 0, 0, 0.03));
}

.comment-avatar {
  margin-right: 12px;
  flex-shrink: 0;
}

.comment-content-wrapper {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.comment-text {
  font-size: 15px;
  line-height: 20px;
  color: var(--ion-text-color, #0f1419);
  white-space: pre-wrap;
  word-wrap: break-word;
  margin-bottom: 8px;
}

.comment-actions {
  display: flex;
  justify-content: space-between;
  max-width: 425px;
  margin-top: 4px;
}

/* Comment input row */
.comment-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.comment-textarea {
  --padding-start: 0;
  --padding-top: 0;
  font-size: 16px;
  width: 100%;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .skeleton-avatar, .skeleton-text {
    background: linear-gradient(90deg, #2a2a2a 25%, #3a3a3a 50%, #2a2a2a 75%);
    background-size: 200% 100%;
  }
}
</style>
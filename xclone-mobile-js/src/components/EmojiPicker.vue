<template>
  <div class="emoji-picker" @click.stop>
    <div class="emoji-categories">
      <button 
        v-for="(cat, name) in categories" 
        :key="name"
        :class="['category-btn', { active: currentCategory === name }]"
        @click="currentCategory = name"
        :title="name">
        {{ cat.icon }}
      </button>
    </div>
    <div class="emoji-grid">
      <span 
        v-for="emoji in categories[currentCategory].emojis" 
        :key="emoji"
        class="emoji-item"
        @click="selectEmoji(emoji)">
        {{ emoji }}
      </span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EmojiPicker',
  data() {
    return {
      currentCategory: 'smileys',
      categories: {
        smileys: {
          icon: '😀',
          emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '🤨', '🧐', '🤓']
        },
        gestures: {
          icon: '👍',
          emojis: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾']
        },
        hearts: {
          icon: '❤️',
          emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟']
        },
        activities: {
          icon: '⚽',
          emojis: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸', '🥌', '🎿', '⛷', '🏂', '🪂', '🏋️‍♀️', '🏋️‍♂️', '🤼‍♀️', '🤼‍♂️']
        },
        travel: {
          icon: '🚗',
          emojis: ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛵', '🏍', '🛺', '🚲', '🛴', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛳', '⛴', '🚢', '✈️', '🛫', '🛬']
        }
      }
    };
  },
  methods: {
    selectEmoji(emoji) {
      this.$emit('select', emoji);
    }
  }
};
</script>

<style scoped>
.emoji-picker {
  background: var(--ion-card-background, #fff);
  border: 1px solid var(--ion-border-color, #e5e7eb);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  width: 280px;
  max-height: 320px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 1000;
}

.emoji-categories {
  display: flex;
  background: var(--ion-background-color, #f9fafb);
  border-bottom: 1px solid var(--ion-border-color, #e5e7eb);
  padding: 4px;
}

.category-btn {
  flex: 1;
  background: none;
  border: none;
  padding: 8px 0;
  font-size: 18px;
  cursor: pointer;
  border-radius: 6px;
  transition: background 0.2s;
}

.category-btn:hover {
  background: rgba(0,0,0,0.05);
}

.category-btn.active {
  background: rgba(0,0,0,0.1);
}

.emoji-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  padding: 8px;
  overflow-y: auto;
  flex: 1;
}

.emoji-item {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  padding: 8px 0;
  cursor: pointer;
  border-radius: 4px;
  transition: transform 0.1s;
}

.emoji-item:hover {
  background: rgba(0,0,0,0.05);
  transform: scale(1.2);
}

/* Dark mode adjustments */
:host-context(.dark) .category-btn:hover,
:host-context(.dark) .emoji-item:hover {
  background: rgba(255,255,255,0.1);
}
</style>

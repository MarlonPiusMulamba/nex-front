<template>
  <ion-modal 
    :is-open="isOpen" 
    @did-dismiss="close"
    class="type-selector-modal"
    :initial-breakpoint="breakpoint"
    :breakpoints="[0, 0.4, 0.7, 0.9]"
    @ionBreakpointDidChange="onBreakpointChange"
  >
    <div class="selector-container">
      <div class="selector-header">
        <div class="drag-handle"></div>
        <h2 class="selector-title">What's the vibe today?</h2>
        <p class="selector-subtitle">Choose how you want to connect with the NexFi community.</p>
      </div>

      <div class="options-scroller">
        <div class="options-grid">
          <div 
            v-for="option in options" 
            :key="option.id" 
            class="option-card"
            @click="select(option.id)"
          >
            <div class="option-icon-wrap" :style="{ background: option.color }">
              <ion-icon :icon="option.icon"></ion-icon>
            </div>
            <div class="option-content">
              <h3 class="option-name">{{ option.name }}</h3>
              <p class="option-desc">{{ option.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="selector-footer">
        <button class="selector-cancel" @click="close">Maybe later</button>
      </div>
    </div>
  </ion-modal>
</template>

<script>
import { IonModal, IonIcon } from '@ionic/vue';
import { 
  chatbubblesOutline, 
  radioOutline, 
  barChartOutline, 
  micOutline
} from 'ionicons/icons';

export default {
  name: 'PostTypeSelectorModal',
  components: { IonModal, IonIcon },
  props: {
    isOpen: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:isOpen', 'select'],
  data() {
    return {
      breakpoint: 0.7,
      options: [
        {
          id: 'post',
          name: 'Post',
          desc: 'Share text, images, or high-res video.',
          icon: chatbubblesOutline,
          color: 'linear-gradient(135deg, #daa520 0%, #ffcc33 100%)'
        },
        {
          id: 'talk',
          name: 'NexFi Talk',
          desc: 'Host a live audio space for your fans.',
          icon: radioOutline,
          color: 'linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)'
        },
        {
          id: 'poll',
          name: 'Poll',
          desc: 'Standard or Battle polls to settle it.',
          icon: barChartOutline,
          color: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
        },
        {
          id: 'ama',
          name: 'AMA',
          desc: 'Ask Me Anything - open the floor.',
          icon: micOutline,
          color: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)'
        }
      ]
    };
  },
  methods: {
    close() {
      this.$emit('update:isOpen', false);
    },
    select(type) {
      this.$emit('select', type);
      this.close();
    },
    onBreakpointChange(e) {
      this.breakpoint = e.detail.breakpoint;
    }
  }
};
</script>

<style scoped>
.type-selector-modal {
  --border-radius: 32px 32px 0 0;
  --background: rgba(18, 18, 24, 0.95);
  backdrop-filter: blur(25px);
}

.selector-container {
  padding: 12px 20px 20px;
  background: transparent;
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #fff;
}

.drag-handle {
  width: 40px;
  height: 5px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
  margin: 0 auto 16px;
}

.selector-header {
  text-align: center;
  padding-bottom: 24px;
}

.selector-title {
  font-size: 24px;
  font-weight: 900;
  margin: 0 0 8px;
  background: linear-gradient(to right, #fff, #daa520);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.selector-subtitle {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  line-height: 1.5;
}

.options-scroller {
  flex: 1;
  overflow-y: auto;
  padding: 0 4px 24px;
  min-height: 250px; /* Ensure content area doesn't collapse */
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding-bottom: 20px;
}

.option-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  padding: 20px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  aspect-ratio: 1/1;
  justify-content: center;
}

.option-card:hover {
  background: rgba(218, 165, 32, 0.12);
  border-color: rgba(218, 165, 32, 0.4);
  transform: translateY(-4px);
}

.option-card:active {
  transform: scale(0.96);
}

.option-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 6px 15px rgba(0,0,0,0.3);
}

.option-icon-wrap ion-icon {
  font-size: 24px;
  color: #fff;
}

.option-content {
  width: 100%;
}

.option-name {
  font-size: 16px;
  font-weight: 800;
  margin: 0 0 4px;
  color: #fff;
}

.option-desc {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin: 0;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.selector-footer {
  padding-top: 10px;
}

.selector-cancel {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
  text-decoration: underline;
  cursor: pointer;
}
</style>


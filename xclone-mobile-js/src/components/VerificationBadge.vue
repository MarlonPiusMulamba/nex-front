<template>
  <span v-if="isValidTier" class="verification-badge" :title="title">
    <svg v-if="tier === 'blue'" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.9998 2.00012L2.73047 6.44284V11.5173C2.73047 16.637 6.64366 21.4398 11.9998 22.6105C17.356 21.4398 21.2691 16.637 21.2691 11.5173V6.44284L11.9998 2.00012Z" fill="#1D9BF0"/>
      <path d="M10.5 15.5L6.5 11.5L7.9 10.1L10.5 12.7L16.1 7.1L17.5 8.5L10.5 15.5Z" fill="white"/>
    </svg>
    <svg v-else-if="tier === 'silver'" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2Z" fill="#C0C0C0"/>
      <path d="M16 8L10 16L7 12.5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <svg v-else-if="tier === 'gold'" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 1.5L14.6 6.7L20.5 7.6L16.2 11.8L17.2 17.5L12 14.8L6.8 17.5L7.8 11.8L3.5 7.6L9.4 6.7L12 1.5Z" fill="#FFD700"/>
      <circle cx="12" cy="12" r="5" fill="#B8860B"/>
      <path d="M10.5 12L11.5 13L14 10" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </span>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'VerificationBadge',
  props: {
    tier: {
      type: String,
      default: 'none'
    }
  },
  setup(props) {
    const isValidTier = computed(() => {
      return ['blue', 'silver', 'gold'].includes(props.tier);
    });

    const title = computed(() => {
      if (props.tier === 'blue') return 'Verified Citizen';
      if (props.tier === 'silver') return 'Notable Creator';
      if (props.tier === 'gold') return 'Verified Business';
      return '';
    });

    return { isValidTier, title };
  }
};
</script>

<style scoped>
.verification-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-left: 4px;
}
</style>

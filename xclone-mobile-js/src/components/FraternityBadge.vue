<template>
  <span
    v-if="fraternity"
    class="frat-badge"
    :style="{ '--frat-color': fraternity.theme_color || '#6366f1' }"
    @click.stop="open"
  >
    <span class="frat-emblem">
      <img v-if="fraternity.emblem_url" :src="fraternity.emblem_url" alt="" />
      <span v-else class="frat-emblem-icon">⚡</span>
    </span>
    <span class="frat-name">{{ fraternity.name }}</span>
  </span>
</template>

<script>
export default {
  name: 'FraternityBadge',
  props: {
    fraternity: {
      type: Object,
      default: null
    }
  },
  methods: {
    open() {
      if (this.fraternity?.slug) {
        this.$router.push(`/tabs/fraternity/${this.fraternity.slug}`);
      }
    }
  }
};
</script>

<style scoped>
.frat-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: color-mix(in srgb, var(--frat-color) 15%, transparent);
  color: var(--frat-color);
  border: 1px solid color-mix(in srgb, var(--frat-color) 35%, transparent);
  border-radius: 20px;
  padding: 2px 8px 2px 4px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s, transform 0.15s;
  vertical-align: middle;
  max-width: 160px;
  white-space: nowrap;
  overflow: hidden;
}
.frat-badge:hover {
  background: color-mix(in srgb, var(--frat-color) 25%, transparent);
  transform: scale(1.03);
}
.frat-emblem {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.frat-emblem img {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  object-fit: cover;
}
.frat-emblem-icon {
  font-size: 12px;
}
.frat-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

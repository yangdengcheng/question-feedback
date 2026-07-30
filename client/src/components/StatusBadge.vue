<template>
  <span class="status-pill" :class="`status-pill--${status}`">
    <i class="status-pill__dot" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
});

const statusMap = {
  pending: "待处理",
  processing: "处理中",
  resolved: "已解决",
  closed: "已关闭",
};

const label = computed(() => statusMap[props.status] || props.status);
</script>

<style scoped>
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 9px;
  border-radius: 4px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.status-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.status-pill--pending {
  color: var(--st-pending);
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(245, 158, 11, 0.1);
}

.status-pill--processing {
  color: var(--st-processing);
  border-color: rgba(56, 189, 248, 0.35);
  background: rgba(56, 189, 248, 0.1);
}
.status-pill--processing .status-pill__dot {
  animation: pulse-dot 1.6s ease-in-out infinite;
}

.status-pill--resolved {
  color: var(--st-resolved);
  border-color: rgba(52, 211, 153, 0.35);
  background: rgba(52, 211, 153, 0.1);
}

.status-pill--closed {
  color: var(--st-closed);
  border-color: rgba(100, 116, 139, 0.4);
  background: rgba(100, 116, 139, 0.12);
}
</style>

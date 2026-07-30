<template>
  <div class="glass-card p-5 cursor-pointer" @click="goDetail">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <span class="text-xs text-slate-500 font-mono">{{
          ticket.ticketNo
        }}</span>
        <el-tag size="small" effect="plain" :type="typeTagType">{{
          typeLabel
        }}</el-tag>
      </div>
      <StatusBadge :status="ticket.status" />
    </div>

    <h3 class="text-base font-medium text-slate-200 mb-2 line-clamp-1">
      {{ ticket.title }}
    </h3>

    <div class="flex items-center justify-between text-xs text-slate-500">
      <div class="flex items-center gap-4">
        <span>
          <el-icon class="mr-1"><Flag /></el-icon>
          {{ priorityLabel }}
        </span>
        <span v-if="ticket.assignee">
          处理人：{{ ticket.assignee.realName }}
        </span>
      </div>
      <span>{{ formatTime(ticket.updatedAt) }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";
import StatusBadge from "./StatusBadge.vue";

const props = defineProps({
  ticket: {
    type: Object,
    required: true,
  },
});

const router = useRouter();

const typeMap = {
  bug: { label: "Bug", type: "danger" },
  question: { label: "使用问题", type: "warning" },
  suggestion: { label: "功能建议", type: "success" },
};

const priorityMap = {
  low: "低",
  medium: "中",
  high: "高",
};

const typeLabel = computed(
  () => typeMap[props.ticket.type]?.label || props.ticket.type,
);
const typeTagType = computed(() => typeMap[props.ticket.type]?.type || "info");
const priorityLabel = computed(
  () => priorityMap[props.ticket.priority] || props.ticket.priority,
);

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function goDetail() {
  router.push(`/tickets/${props.ticket.id}`);
}
</script>

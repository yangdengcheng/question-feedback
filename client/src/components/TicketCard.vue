<template>
  <div class="panel panel-hover p-5 cursor-pointer" @click="goDetail">
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-3">
        <span class="text-xs text-ink-text-3">{{
          ticket.ticketNo
        }}</span>
        <el-tag
          size="small"
          effect="light"
          :type="ticket.isPublic ? 'success' : 'danger'"
        >{{ ticket.isPublic ? "公开" : "非公开" }}</el-tag>
        <el-tag size="small" effect="plain" :type="typeTagType">{{
          typeLabel
        }}</el-tag>
      </div>
      <StatusBadge :status="ticket.status" />
    </div>

    <h3 class="text-base font-medium text-ink-text mb-2 line-clamp-1">
      {{ ticket.title }}
    </h3>

    <div class="flex items-center justify-between text-xs text-ink-text-3">
      <div class="flex items-center gap-4">
        <span :class="priorityClass">
          <el-icon class="mr-1"><Flag /></el-icon>
          {{ priorityLabel }}
        </span>
        <span v-if="ticket.systemCode">
          所属系统：<span class="text-bold">{{ ticket.systemCode }}</span>
        </span>
        <span v-if="ticket.creator">
          提交人：<span class="text-bold">{{ ticket.creator.realName }}</span>
        </span>
        <span v-if="ticket.assignee">
          处理人：<span class="text-bold">{{ ticket.assignee.realName }}</span>
        </span>
      </div>
      <span>{{ formatTime(ticket.createdAt) }}</span>
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
// 优先级颜色：低=绿 中=黄 高=红
const priorityColorMap = {
  low: "priority-low",
  medium: "priority-medium",
  high: "priority-high",
};
const priorityClass = computed(
  () => priorityColorMap[props.ticket.priority] || "",
);

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function goDetail() {
  router.push(`/tickets/${props.ticket.id}`);
}
</script>

<style scoped>
/* 优先级：低=绿 中=黄 高=红，文字加粗 */
.priority-low {
  color: #16a34a;
  font-weight: 600;
}
.priority-medium {
  color: #ca8a04;
  font-weight: 600;
}
.priority-high {
  color: #dc2626;
  font-weight: 600;
}
/* 所属系统/提交人/处理人 文本值加粗且纯黑 */
.text-bold {
  font-weight: 600;
  color: #000000;
}
</style>

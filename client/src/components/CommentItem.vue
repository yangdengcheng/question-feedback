<template>
  <div class="flex" :class="isOwn ? 'justify-end' : 'justify-start'">
    <div class="max-w-[80%]" :class="isOwn ? 'order-1' : ''">
      <div
        class="flex items-center gap-2 mb-1"
        :class="isOwn ? 'justify-end' : ''"
      >
        <span class="text-xs font-medium text-slate-400">{{
          comment.author?.realName
        }}</span>
        <span class="text-xs text-slate-600">{{
          formatTime(comment.createdAt)
        }}</span>
      </div>
      <div
        class="rounded-xl px-4 py-3 text-sm leading-relaxed"
        :class="
          isOwn
            ? 'bg-indigo-600/20 border border-indigo-500/30 text-slate-200'
            : 'glass-card-static text-slate-300'
        "
      >
        <p class="whitespace-pre-wrap">{{ comment.content }}</p>

        <div
          v-if="comment.attachments && comment.attachments.length > 0"
          class="mt-3 space-y-2"
        >
          <template v-for="att in comment.attachments" :key="att.id">
            <el-image
              v-if="att.fileType.startsWith('image/')"
              :src="`/api/attachments/${att.id}`"
              :preview-src-list="[`/api/attachments/${att.id}`]"
              class="max-w-[200px] rounded-lg"
              fit="contain"
            />
            <a
              v-else
              :href="`/api/attachments/${att.id}`"
              target="_blank"
              class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <el-icon><Document /></el-icon>
              {{ att.fileName }}
            </a>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useAuthStore } from "../stores/auth";

const props = defineProps({
  comment: {
    type: Object,
    required: true,
  },
});

const authStore = useAuthStore();
const isOwn = computed(() => props.comment.userId === authStore.user?.id);

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>

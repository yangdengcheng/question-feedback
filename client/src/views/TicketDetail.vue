<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-6">
      <router-link
        to="/"
        class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← 返回工单列表
      </router-link>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-indigo-400" :size="32"
        ><Loading
      /></el-icon>
    </div>

    <template v-else-if="ticket">
      <!-- 工单信息卡片 -->
      <div class="glass-card-static p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="text-xs text-slate-500 font-mono">{{
                ticket.ticketNo
              }}</span>
              <el-tag size="small" effect="plain" :type="typeTagType">{{
                typeLabel
              }}</el-tag>
              <StatusBadge :status="ticket.status" />
            </div>
            <h1 class="text-lg font-bold text-slate-200">{{ ticket.title }}</h1>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span class="text-slate-500">优先级</span>
            <p class="text-slate-300 mt-1">{{ priorityLabel }}</p>
          </div>
          <div>
            <span class="text-slate-500">提交人</span>
            <p class="text-slate-300 mt-1">{{ ticket.creator?.realName }}</p>
          </div>
          <div>
            <span class="text-slate-500">处理人</span>
            <p class="text-slate-300 mt-1">
              {{ ticket.assignee?.realName || "未分配" }}
            </p>
          </div>
          <div>
            <span class="text-slate-500">创建时间</span>
            <p class="text-slate-300 mt-1">
              {{ formatTime(ticket.createdAt) }}
            </p>
          </div>
        </div>

        <div
          v-if="ticket.description"
          class="mt-4 pt-4 border-t border-indigo-500/10"
        >
          <p class="text-sm text-slate-400 whitespace-pre-wrap">
            {{ ticket.description }}
          </p>
        </div>

        <div
          v-if="ticket.attachments && ticket.attachments.length > 0"
          class="mt-4 pt-4 border-t border-indigo-500/10"
        >
          <span class="text-sm text-slate-500 mb-2 block">附件</span>
          <div class="flex flex-wrap gap-3">
            <template v-for="att in ticket.attachments" :key="att.id">
              <el-image
                v-if="att.fileType.startsWith('image/')"
                :src="`/api/attachments/${att.id}`"
                :preview-src-list="[`/api/attachments/${att.id}`]"
                class="w-20 h-20 rounded-lg"
                fit="cover"
              />
              <a
                v-else
                :href="`/api/attachments/${att.id}`"
                target="_blank"
                class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 glass-card-static px-3 py-2 rounded-lg transition-colors"
              >
                <el-icon><Document /></el-icon>
                {{ att.fileName }}
              </a>
            </template>
          </div>
        </div>

        <!-- 状态操作按钮 -->
        <div
          v-if="
            ticket.status === 'resolved' && ticket.userId === authStore.user?.id
          "
          class="mt-4 pt-4 border-t border-indigo-500/10 flex gap-3"
        >
          <el-button type="success" @click="handleStatusChange('closed')">
            <el-icon class="mr-1"><Check /></el-icon>确认解决
          </el-button>
          <el-button type="warning" @click="handleStatusChange('processing')">
            <el-icon class="mr-1"><RefreshRight /></el-icon>未解决，继续讨论
          </el-button>
        </div>
      </div>

      <!-- 讨论区 -->
      <div class="glass-card-static p-6">
        <h2 class="text-base font-semibold text-slate-200 mb-6">讨论记录</h2>

        <div v-if="comments.length === 0" class="text-center py-10">
          <p class="text-slate-500 text-sm">暂无讨论，发表第一条评论吧</p>
        </div>

        <div v-else class="space-y-6">
          <CommentItem
            v-for="comment in comments"
            :key="comment.id"
            :comment="comment"
          />
        </div>

        <!-- 评论输入区 -->
        <div class="mt-8 pt-6 border-t border-indigo-500/10">
          <el-input
            v-model="newComment"
            type="textarea"
            :rows="3"
            placeholder="输入您的评论..."
            class="mb-3"
          />
          <div class="flex items-center justify-between">
            <FileUpload v-model:attachment-ids="commentAttachmentIds" />
            <button
              class="btn-gradient px-6 py-2 ml-4 shrink-0"
              :disabled="!newComment.trim() || submitting"
              @click="submitComment"
            >
              {{ submitting ? "发送中..." : "发送" }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import {
  getTicketDetail,
  updateTicketStatus,
  listComments,
  createComment,
} from "../api/tickets";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notification";
import StatusBadge from "../components/StatusBadge.vue";
import CommentItem from "../components/CommentItem.vue";
import FileUpload from "../components/FileUpload.vue";

const route = useRoute();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const ticket = ref(null);
const comments = ref([]);
const loading = ref(false);
const newComment = ref("");
const commentAttachmentIds = ref([]);
const submitting = ref(false);

const typeMap = {
  bug: { label: "Bug", type: "danger" },
  question: { label: "使用问题", type: "warning" },
  suggestion: { label: "功能建议", type: "success" },
};

const priorityMap = { low: "低", medium: "中", high: "高" };

const typeLabel = computed(() => typeMap[ticket.value?.type]?.label || "");
const typeTagType = computed(() => typeMap[ticket.value?.type]?.type || "info");
const priorityLabel = computed(() => priorityMap[ticket.value?.priority] || "");

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

onMounted(() => {
  fetchTicket();
  fetchComments();
});

async function fetchTicket() {
  loading.value = true;
  try {
    ticket.value = await getTicketDetail(route.params.id);
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function fetchComments() {
  try {
    comments.value = await listComments(route.params.id);
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function handleStatusChange(status) {
  try {
    await updateTicketStatus(route.params.id, status);
    ElMessage.success("状态更新成功");
    notificationStore.fetchUnreadCount();
    fetchTicket();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function submitComment() {
  if (!newComment.value.trim()) return;

  submitting.value = true;
  try {
    await createComment(route.params.id, {
      content: newComment.value,
      attachmentIds: commentAttachmentIds.value,
    });
    newComment.value = "";
    commentAttachmentIds.value = [];
    ElMessage.success("评论发送成功");
    fetchComments();
    fetchTicket();
    notificationStore.fetchUnreadCount();
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    submitting.value = false;
  }
}
</script>

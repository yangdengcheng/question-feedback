<template>
  <div class="max-w-4xl mx-auto">
    <div class="mb-6">
      <router-link to="/" class="text-sm text-slate-500 hover:text-slate-300 transition-colors">
        ← 返回工单列表
      </router-link>
    </div>

    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-indigo-400" :size="32"><Loading /></el-icon>
    </div>

    <template v-else-if="ticket">
      <!-- 工单信息卡片 -->
      <div class="glass-card-static p-6 mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="flex items-center gap-3 mb-2">
              <span class="text-xs text-slate-500 font-mono">{{ ticket.ticketNo }}</span>
              <el-tag size="small" effect="plain" :type="typeTagType">{{ typeLabel }}</el-tag>
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
            <p class="text-slate-300 mt-1">{{ ticket.assignee?.realName || "未分配" }}</p>
          </div>
          <div>
            <span class="text-slate-500">创建时间</span>
            <p class="text-slate-300 mt-1">{{ formatTime(ticket.createdAt) }}</p>
          </div>
        </div>

        <div v-if="ticket.description" class="mt-4 pt-4 border-t border-indigo-500/10">
          <p class="text-sm text-slate-400 whitespace-pre-wrap">{{ ticket.description }}</p>
        </div>

        <div v-if="ticket.attachments && ticket.attachments.length > 0" class="mt-4 pt-4 border-t border-indigo-500/10">
          <span class="text-sm text-slate-500 mb-2 block">附件</span>
          <div class="flex flex-wrap gap-3">
            <template v-for="att in ticket.attachments" :key="att.id">
              <img v-if="att.fileType.startsWith('image/')" :src="`/api/attachments/${att.id}`" class="w-20 h-20 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity" @click="openAttachmentPreview(ticket.attachments.filter(a => a.fileType.startsWith('image/')).indexOf(att))" />
              <a v-else :href="`/api/attachments/${att.id}`" target="_blank" class="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 glass-card-static px-3 py-2 rounded-lg transition-colors">
                <el-icon><Document /></el-icon>
                {{ att.fileName }}
              </a>
            </template>
          </div>
        </div>

        <!-- 操作按钮区 -->
        <div class="mt-4 pt-4 border-t border-indigo-500/10 flex flex-wrap gap-3">
          <!-- 客户：确认解决 / 继续讨论 -->
          <template v-if="!isInternal && ticket.status === 'resolved' && ticket.userId === authStore.user?.id">
            <el-button type="success" @click="handleStatusChange('closed')">
              <el-icon class="mr-1"><Check /></el-icon>确认解决
            </el-button>
            <el-button type="warning" @click="handleStatusChange('processing')">
              <el-icon class="mr-1"><RefreshRight /></el-icon>未解决，继续讨论
            </el-button>
          </template>

          <!-- 内部角色：状态变更 -->
          <template v-if="isInternal">
            <el-dropdown trigger="click" @command="handleStatusChange">
              <el-button type="primary" plain>
                {{ ticket.status === 'closed' ? '重新打开' : '变更状态' }}<el-icon class="ml-1"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pending" :disabled="ticket.status === 'pending'">待处理</el-dropdown-item>
                  <el-dropdown-item command="processing" :disabled="ticket.status === 'processing'">处理中</el-dropdown-item>
                  <el-dropdown-item command="resolved" :disabled="ticket.status === 'resolved'">已解决</el-dropdown-item>
                  <el-dropdown-item command="closed" :disabled="ticket.status === 'closed'">已关闭</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>

            <!-- 转工单按钮 -->
            <el-button type="warning" plain @click="showTransferDialog = true">
              <el-icon class="mr-1"><Sort /></el-icon>转工单
            </el-button>
          </template>

          <!-- 客户：已关闭工单可重新打开 -->
          <template v-if="!isInternal && ticket.status === 'closed' && ticket.userId === authStore.user?.id">
            <el-button type="primary" @click="handleStatusChange('processing')">
              <el-icon class="mr-1"><RefreshRight /></el-icon>重新打开
            </el-button>
          </template>
        </div>
      </div>

      <!-- 工单流转记录 -->
      <div v-if="ticket.logs && ticket.logs.length > 0" class="glass-card-static p-6 mb-6">
        <h2 class="text-base font-semibold text-slate-200 mb-4">流转记录</h2>
        <el-timeline>
          <el-timeline-item
            v-for="log in ticket.logs"
            :key="log.id"
            :timestamp="formatTime(log.createdAt)"
            placement="top"
            :type="logActionColor(log.action)"
          >
            <div class="text-sm text-slate-300">
              <span class="text-indigo-400 font-medium">{{ log.operator?.realName }}</span>
              {{ logActionText(log) }}
            </div>
            <div v-if="log.content" class="text-xs text-slate-500 mt-1 pl-1 border-l-2 border-indigo-500/30 ml-0.5">
              {{ log.content }}
            </div>
            <div v-if="log.attachments && log.attachments.length > 0" class="mt-2 flex flex-wrap gap-2">
              <template v-for="att in log.attachments" :key="att.id">
                <img v-if="att.fileType.startsWith('image/')" :src="`/api/attachments/${att.id}`" class="w-16 h-16 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity" @click="openLogPreview(log, att)" />
                <a v-else :href="`/api/attachments/${att.id}`" target="_blank" class="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 glass-card-static px-2 py-1 rounded-lg transition-colors">
                  <el-icon><Document /></el-icon>{{ att.fileName }}
                </a>
              </template>
            </div>
          </el-timeline-item>
        </el-timeline>
      </div>

      <!-- 讨论区 -->
      <div class="glass-card-static p-6">
        <h2 class="text-base font-semibold text-slate-200 mb-6">讨论记录</h2>

        <div v-if="comments.length === 0" class="text-center py-10">
          <p class="text-slate-500 text-sm">暂无讨论，发表第一条评论吧</p>
        </div>

        <div v-else class="space-y-6">
          <CommentItem v-for="comment in comments" :key="comment.id" :comment="comment" />
        </div>

        <!-- 评论输入区 -->
        <div class="mt-8 pt-6 border-t border-indigo-500/10">
          <el-input v-model="newComment" type="textarea" :rows="3" placeholder="输入您的评论..." class="mb-3" />
          <div class="flex items-center justify-between">
            <FileUpload ref="commentFileUploadRef" />
            <button class="btn-gradient px-6 py-2 ml-4 shrink-0" :disabled="!newComment.trim() || submitting" @click="submitComment">
              {{ submitting ? "发送中..." : "发送" }}
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 转工单对话框 -->
    <el-dialog v-model="showTransferDialog" title="转工单" width="480px">
      <el-form label-position="top">
        <el-form-item label="转交给">
          <el-select v-model="transferForm.toUserId" placeholder="选择转交人" filterable style="width: 100%">
            <el-option v-for="u in internalUsers" :key="u.id" :label="`${u.realName}（${roleLabel(u.role)}）`" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="转交说明（必填）">
          <el-input v-model="transferForm.content" type="textarea" :rows="3" placeholder="请说明转交原因..." />
        </el-form-item>
        <el-form-item label="附件（可选）">
          <FileUpload ref="transferFileUploadRef" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTransferDialog = false">取消</el-button>
        <el-button type="primary" :loading="transferring" @click="handleTransfer">确认转交</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览 -->
    <ImageViewer v-model:visible="attachmentPreviewVisible" :images="attachmentPreviewImages" :initial-index="attachmentPreviewIndex" />
    <ImageViewer v-model:visible="logPreviewVisible" :images="logPreviewImages" :initial-index="logPreviewIndex" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ElMessage } from "element-plus";
import { getTicketDetail, updateTicketStatus, transferTicket, listComments, createComment, listAssignees } from "../api/tickets";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notification";
import StatusBadge from "../components/StatusBadge.vue";
import CommentItem from "../components/CommentItem.vue";
import FileUpload from "../components/FileUpload.vue";
import ImageViewer from "../components/ImageViewer.vue";

const route = useRoute();
const authStore = useAuthStore();
const notificationStore = useNotificationStore();

const ticket = ref(null);
const comments = ref([]);
const loading = ref(false);
const newComment = ref("");
const commentFileUploadRef = ref(null);
const submitting = ref(false);
const showTransferDialog = ref(false);
const transferring = ref(false);
const internalUsers = ref([]);
const transferForm = ref({ toUserId: null, content: "" });
const transferFileUploadRef = ref(null);

// Attachment image preview
const attachmentPreviewVisible = ref(false);
const attachmentPreviewIndex = ref(0);
const attachmentPreviewImages = computed(() => {
  if (!ticket.value?.attachments) return [];
  return ticket.value.attachments
    .filter(a => a.fileType.startsWith("image/"))
    .map(a => ({ url: `/api/attachments/${a.id}`, name: a.fileName }));
});
function openAttachmentPreview(idx) {
  attachmentPreviewIndex.value = idx;
  attachmentPreviewVisible.value = true;
}

// 流转记录附件预览
const logPreviewVisible = ref(false);
const logPreviewIndex = ref(0);
const logPreviewImages = ref([]);
function openLogPreview(log, att) {
  const imgs = (log.attachments || []).filter(a => a.fileType.startsWith("image/"));
  logPreviewImages.value = imgs.map(a => ({ url: `/api/attachments/${a.id}`, name: a.fileName }));
  logPreviewIndex.value = imgs.indexOf(att);
  logPreviewVisible.value = true;
}

const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
const isInternal = computed(() => INTERNAL_ROLES.includes(authStore.user?.role));

const roleMap = {
  customer: "客户",
  data_maintenance: "数据维护",
  dev_lead: "系统开发主管",
  developer: "系统开发",
  tester: "测试",
  admin: "管理员",
};
function roleLabel(role) { return roleMap[role] || role; }

const typeMap = { bug: { label: "Bug", type: "danger" }, question: { label: "使用问题", type: "warning" } };
const priorityMap = { low: "低", medium: "中", high: "高" };
const typeLabel = computed(() => typeMap[ticket.value?.type]?.label || "");
const typeTagType = computed(() => typeMap[ticket.value?.type]?.type || "info");
const priorityLabel = computed(() => priorityMap[ticket.value?.priority] || "");

const statusLabelMap = { pending: "待处理", processing: "处理中", resolved: "已解决", closed: "已关闭" };

function logActionText(log) {
  switch (log.action) {
    case "created": return " 创建了工单";
    case "assigned": return ` 将工单分配给 ${log.toAssignee?.realName || ""}`;
    case "transferred": return ` 将工单转交给 ${log.toAssignee?.realName || ""}`;
    case "status_changed": return ` 将状态从「${statusLabelMap[log.fromStatus] || log.fromStatus}」变更为「${statusLabelMap[log.toStatus] || log.toStatus}」`;
    case "commented": return " 发表了评论";
    default: return ` ${log.action}`;
  }
}

function logActionColor(action) {
  const map = { created: "primary", assigned: "warning", transferred: "warning", status_changed: "success", commented: "info" };
  return map[action] || "info";
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

onMounted(() => {
  fetchTicket();
  fetchComments();
  if (isInternal.value) fetchInternalUsers();
});

async function fetchTicket() {
  loading.value = true;
  try { ticket.value = await getTicketDetail(route.params.id); } catch (e) {} finally { loading.value = false; }
}

async function fetchComments() {
  try { comments.value = await listComments(route.params.id); } catch (e) {}
}

async function fetchInternalUsers() {
  try {
    const users = await listAssignees();
    internalUsers.value = users.filter(u => u.id !== authStore.user?.id);
  } catch (e) {}
}

async function handleStatusChange(status) {
  if (status === ticket.value.status) return;
  try {
    await updateTicketStatus(route.params.id, status);
    ElMessage.success("状态更新成功");
    notificationStore.fetchUnreadCount();
    fetchTicket();
  } catch (e) {}
}

async function handleTransfer() {
  if (!transferForm.value.toUserId) { ElMessage.warning("请选择转交人"); return; }
  if (!transferForm.value.content.trim()) { ElMessage.warning("请填写转交说明"); return; }
  transferring.value = true;
  try {
    const attachmentIds = transferFileUploadRef.value ? await transferFileUploadRef.value.uploadAll() : [];
    await transferTicket(route.params.id, { ...transferForm.value, attachmentIds });
    ElMessage.success("转工单成功");
    showTransferDialog.value = false;
    transferForm.value = { toUserId: null, content: "" };
    if (transferFileUploadRef.value) transferFileUploadRef.value.reset();
    notificationStore.fetchUnreadCount();
    fetchTicket();
  } catch (e) {} finally { transferring.value = false; }
}

async function submitComment() {
  if (!newComment.value.trim()) return;
  submitting.value = true;
  try {
    const attachmentIds = commentFileUploadRef.value ? await commentFileUploadRef.value.uploadAll() : [];
    await createComment(route.params.id, { content: newComment.value, attachmentIds });
    newComment.value = "";
    if (commentFileUploadRef.value) commentFileUploadRef.value.reset();
    ElMessage.success("评论发送成功");
    fetchComments();
    fetchTicket();
    notificationStore.fetchUnreadCount();
  } catch (e) {} finally { submitting.value = false; }
}
</script>

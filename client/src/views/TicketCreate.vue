<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-6">
      <router-link
        to="/"
        class="text-sm text-ink-text-3 hover:text-ink-text-2 transition-colors"
      >
        ← 返回工单列表
      </router-link>
      <h1 class="text-xl font-bold text-ink-text mt-2">新建工单</h1>
    </div>

    <div class="flex items-start gap-6">
      <!-- 左侧：相似工单（防重复提交） -->
      <aside class="similar-aside panel p-4 hidden lg:block">
        <div class="flex items-center gap-2 mb-3">
          <el-icon class="text-accent-text"><Search /></el-icon>
          <span class="text-sm font-semibold text-ink-text">相似工单</span>
        </div>
        <div v-if="similarLoading" class="text-xs text-ink-text-3 py-8 text-center">检索中…</div>
        <div
          v-else-if="similarList.length === 0"
          class="text-xs text-ink-text-3 leading-relaxed py-8 px-2 text-center"
        >
          输入标题后，这里会展示相似的已有工单，<br />先看看是否已有人提交过。
        </div>
        <ul v-else class="space-y-2">
          <li v-for="t in similarList" :key="t.id">
            <button type="button" class="similar-item w-full text-left" @click="openSimilar(t.id)">
              <el-tooltip :content="t.title" placement="top" :show-after="200">
                <span class="similar-item__title">{{ t.title }}</span>
              </el-tooltip>
              <el-tag :type="statusType(t.status)" size="small" effect="plain" class="shrink-0">
                {{ statusLabel(t.status) }}
              </el-tag>
            </button>
          </li>
        </ul>
      </aside>

      <!-- 右侧：表单 -->
      <div class="panel p-8 flex-1 min-w-0">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <el-form-item label="标题" prop="title">
            <div class="flex items-center gap-4 w-full">
              <el-input
                v-model="form.title"
                placeholder="简要描述您遇到的问题"
                maxlength="200"
                show-word-limit
                size="large"
                class="flex-1"
              />
              <div class="flex items-center gap-2 shrink-0">
                <span
                  class="text-sm transition-colors"
                  :class="form.isPublic ? 'text-ink-text-3' : 'font-semibold text-[#F56C6C]'"
                >非公开</span>
                <el-tooltip
                  :content="form.isPublic ? '此工单所有人可见' : '仅工单创建人和处理人可见'"
                  placement="top"
                >
                  <el-switch
                    v-model="form.isPublic"
                    active-color="#67C23A"
                    inactive-color="#F56C6C"
                  />
                </el-tooltip>
                <span
                  class="text-sm transition-colors"
                  :class="form.isPublic ? 'font-semibold text-[#67C23A]' : 'text-ink-text-3'"
                >公开</span>
              </div>
            </div>
          </el-form-item>

          <el-form-item label="类型" prop="type">
            <el-radio-group v-model="form.type">
              <el-radio-button value="bug">Bug</el-radio-button>
              <el-radio-button value="question">使用问题</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="优先级" prop="priority">
            <el-radio-group v-model="form.priority">
              <el-radio-button value="low">低</el-radio-button>
              <el-radio-button value="medium">中</el-radio-button>
              <el-radio-button value="high">高</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="详细描述" prop="description">
            <el-input
              v-model="form.description"
              type="textarea"
              :rows="6"
              placeholder="请详细描述问题，包括操作步骤、预期结果和实际结果"
            />
          </el-form-item>

          <el-form-item label="附件（可选）">
            <FileUpload ref="fileUploadRef" />
          </el-form-item>

          <el-form-item>
            <button
              type="submit"
              class="btn-accent px-8 py-3"
              :disabled="loading"
            >
              {{ loading ? "提交中..." : "提交工单" }}
            </button>
          </el-form-item>
        </el-form>
      </div>
    </div>

    <!-- 相似工单详情抽屉：左侧拉出，点击空白遮罩关闭；完整详情面板（含重新打开等操作） -->
    <el-drawer v-model="drawerVisible" direction="ltr" size="45%" :with-header="false" destroy-on-close>
      <div class="p-5">
        <TicketDetailPanel :ticket-id="drawerTicketId" :navigate-to-home-on-reopen="true" />
      </div>
    </el-drawer>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Search } from "@element-plus/icons-vue";
import { createTicket, listSimilarTickets } from "../api/tickets";
import FileUpload from "../components/FileUpload.vue";
import TicketDetailPanel from "../components/TicketDetailPanel.vue";

const router = useRouter();
const formRef = ref(null);
const fileUploadRef = ref(null);
const loading = ref(false);

const form = reactive({
  title: "",
  type: "bug",
  priority: "medium",
  description: "",
  isPublic: true, // 滑块开关：false=非公开 true=公开（默认）
});

const rules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  description: [{ required: true, message: "请填写详细描述", trigger: "blur" }],
};

// ---------- 相似工单 ----------
const similarList = ref([]);
const similarLoading = ref(false);
let similarTimer = null;

watch(
  () => form.title,
  (val) => {
    clearTimeout(similarTimer);
    const kw = (val || "").trim();
    if (kw.length < 2) {
      similarList.value = [];
      return;
    }
    similarLoading.value = true;
    similarTimer = setTimeout(async () => {
      try {
        similarList.value = await listSimilarTickets(kw);
      } catch (error) {
        similarList.value = [];
      } finally {
        similarLoading.value = false;
      }
    }, 300);
  }
);

// ---------- 相似工单列表展示辅助 ----------
const STATUS_MAP = {
  pending: { label: "待处理", type: "warning" },
  processing: { label: "处理中", type: "" },
  resolved: { label: "已解决", type: "success" },
  closed: { label: "已关闭", type: "info" },
};
function statusLabel(s) { return STATUS_MAP[s]?.label || s; }
function statusType(s) { return STATUS_MAP[s]?.type ?? "info"; }

// ---------- 相似工单详情抽屉 ----------
const drawerVisible = ref(false);
const drawerTicketId = ref(null);

function openSimilar(id) {
  drawerTicketId.value = id;
  drawerVisible.value = true;
}

// ---------- 提交 ----------
async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    // Upload files first (if any), then create ticket
    const attachmentIds = fileUploadRef.value ? await fileUploadRef.value.uploadAll() : [];
    const { isPublic, ...rest } = form;
    const data = await createTicket({
      ...rest,
      isPublic: isPublic,
      attachmentIds,
    });
    ElMessage.success(`工单 ${data.ticketNo} 创建成功`);
    router.push(`/tickets/${data.id}`);
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.similar-aside {
  width: 320px;
  flex-shrink: 0;
  position: sticky;
  top: 88px; /* 导航栏 64px + 24px 间距 */
}
.similar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}
.similar-item:hover {
  border-color: var(--line-strong);
  background: var(--surface-2);
}
.similar-item__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--text-2);
}
</style>

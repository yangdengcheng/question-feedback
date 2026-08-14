<template>
  <div class="flex items-start gap-6">
    <!-- 左栏：模糊搜索 + 访问排行 TOP10 -->
    <aside class="w-64 shrink-0 flex flex-col gap-4">
      <el-input
        v-model="keyword"
        placeholder="搜索名称或 URL..."
        clearable
        @input="handleSearch"
      />
      <div class="panel p-3">
        <div class="panel-title text-sm font-semibold text-ink-text mb-2">访问排行 TOP 10</div>
        <div v-if="topList.length === 0" class="text-xs text-ink-text-3 py-2 text-center">
          暂无数据
        </div>
        <div v-else class="flex flex-col">
          <button
            v-for="wb in topList"
            :key="wb.id"
            class="rank-item"
            :title="wb.url"
            @click="openWorkbench(wb)"
          >
            <span class="flex-1 min-w-0 truncate text-left">{{ wb.name }}</span>
            <span class="shrink-0 text-xs text-ink-text-3 tnum">{{ wb.visitCount || 0 }}次</span>
          </button>
        </div>
      </div>
    </aside>

    <!-- 右栏：卡片区域 -->
    <div class="flex-1 min-w-0">
      <!-- 标题 + 新增入口 -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-bold text-ink-text">工作台</h1>
        <button class="btn-accent" @click="openForm()">
          <el-icon class="mr-1"><Plus /></el-icon>新增工作台
        </button>
      </div>

      <!-- 加载 -->
      <div v-if="loading" class="flex justify-center py-20">
        <el-icon class="is-loading text-accent-text" :size="32"><Loading /></el-icon>
      </div>

      <!-- 空态 -->
      <div v-else-if="items.length === 0" class="text-center py-20">
        <el-icon :size="48" class="text-ink-text-3 mb-4"><Grid /></el-icon>
        <p class="text-ink-text-3 mb-2">{{ keyword ? "没有匹配的工作台" : "暂无工作台" }}</p>
        <p class="text-ink-text-3 text-sm">
          {{ keyword ? "换个关键词试试" : "点击右上角「新增工作台」，添加第一个服务地址" }}
        </p>
      </div>

      <!-- 卡片网格：一行三个 -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="wb in items"
          :key="wb.id"
          class="panel panel-hover p-5 flex flex-col gap-3 cursor-pointer"
          @click="openWorkbench(wb)"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <div
                class="w-8 h-8 rounded-lg bg-primary text-[#1a1204] flex items-center justify-center shrink-0"
              >
                <el-icon :size="16"><Monitor /></el-icon>
              </div>
              <h3 class="text-sm font-semibold text-ink-text truncate tnum">
                {{ wb.name }}
              </h3>
            </div>
            <div v-if="canModify(wb)" class="flex items-center gap-1 shrink-0" @click.stop>
              <button class="btn-ghost !px-2 !py-1 text-xs" title="编辑" @click="openForm(wb)">
                <el-icon><Edit /></el-icon>
              </button>
              <button class="btn-ghost !px-2 !py-1 text-xs" title="删除" @click="handleDelete(wb)">
                <el-icon><Delete /></el-icon>
              </button>
            </div>
          </div>

          <p class="text-xs text-ink-text-2 tnum break-all line-clamp-2 min-h-[32px]">{{ wb.url }}</p>

          <div
            class="text-xs text-ink-text-3 tnum mt-auto pt-2 border-t border-line flex items-center justify-between gap-2"
          >
            <span class="truncate">{{ wb.creator?.realName || "-" }} {{ formatTime(wb.createdAt) }}</span>
            <span class="shrink-0 flex items-center gap-1 text-ink-text-3">
              <el-icon :size="14"><View /></el-icon>
              <span class="tnum">{{ wb.visitCount || 0 }}</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 极简分页：上一页 / 页码（点击可跳页）/ 下一页 -->
      <div v-if="total > 0" class="flex items-center justify-end gap-2 mt-4 h-[26px]">
        <button
          class="pager-btn"
          :disabled="page <= 1"
          title="上一页"
          @click="goPage(page - 1)"
        >
          <el-icon :size="14"><ArrowLeft /></el-icon>
        </button>

        <div
          v-if="!jumping"
          class="pager-label tnum"
          title="点击跳转到指定页"
          @click="startJump"
        >
          {{ page }}/{{ totalPages }}
        </div>
        <input
          v-else
          ref="jumpInputRef"
          v-model="jumpValue"
          class="pager-input tnum"
          inputmode="numeric"
          maxlength="3"
          @input="jumpValue = jumpValue.replace(/\D/g, '')"
          @keyup.enter="confirmJump"
          @keyup.esc="cancelJump"
          @blur="cancelJump"
        />

        <button
          class="pager-btn"
          :disabled="page >= totalPages"
          title="下一页"
          @click="goPage(page + 1)"
        >
          <el-icon :size="14"><ArrowRight /></el-icon>
        </button>
      </div>
    </div>

    <!-- 新增 / 编辑弹窗 -->
    <el-dialog
      v-model="formVisible"
      :title="form.id ? '编辑工作台' : '新增工作台'"
      width="520px"
      destroy-on-close
    >
      <el-form label-position="top" @submit.prevent>
        <el-form-item label="名称" required>
          <el-input
            v-model="form.name"
            placeholder="如 服务器监控面板"
            maxlength="100"
            clearable
          />
        </el-form-item>
        <el-form-item label="服务地址" required>
          <el-input
            v-model="form.url"
            placeholder="如 http://192.168.0.3:5180/"
            maxlength="255"
            clearable
            @keyup.enter="submit"
          />
        </el-form-item>
        <p class="text-xs text-ink-text-3 -mt-3">未带协议前缀时会自动补全 http://</p>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAuthStore } from "../stores/auth";
import {
  listWorkbenches,
  topWorkbenches,
  visitWorkbench,
  createWorkbench,
  updateWorkbench,
  deleteWorkbench,
} from "../api/workbench";

const authStore = useAuthStore();

// 列表
const items = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(12); // 四行三列
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

// 模糊搜索（名称 / URL），防抖 300ms
const keyword = ref("");
let searchTimer = null;
function handleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    fetchList();
  }, 300);
}

async function fetchList() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (keyword.value.trim()) params.keyword = keyword.value.trim();
    const data = await listWorkbenches(params);
    items.value = data.rows || [];
    total.value = data.count || 0;
  } catch (e) {
    /* 拦截器已统一提示 */
  } finally {
    loading.value = false;
  }
}

// 访问排行 TOP10
const topList = ref([]);
async function fetchTop() {
  try {
    topList.value = (await topWorkbenches()) || [];
  } catch (e) {
    /* 排行加载失败不打扰用户 */
  }
}

// 点击卡片 / 排行：新窗口打开地址 + 访问次数 +1（乐观锁）
function openWorkbench(wb) {
  window.open(wb.url, "_blank", "noopener,noreferrer");
  visitWorkbench(wb.id)
    .then((data) => {
      const target = items.value.find((i) => i.id === wb.id);
      if (target && data && data.visitCount != null) target.visitCount = data.visitCount;
      fetchTop(); // 静默刷新排行
    })
    .catch(() => {
      /* 计数失败不影响跳转 */
    });
}

// 仅创建者本人或管理员可编辑/删除
function canModify(wb) {
  return authStore.isAdmin || wb.createdBy === authStore.user?.id;
}

function formatTime(t) {
  if (!t) return "-";
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 极简分页：上一页 / 页码跳页 / 下一页
const jumping = ref(false);
const jumpValue = ref("");
const jumpInputRef = ref(null);

function startJump() {
  jumping.value = true;
  jumpValue.value = "";
  nextTick(() => jumpInputRef.value?.focus());
}

function confirmJump() {
  const p = parseInt(jumpValue.value, 10);
  jumping.value = false;
  if (!Number.isNaN(p)) goPage(p);
}

function cancelJump() {
  jumping.value = false;
}

function goPage(p) {
  const target = Math.min(Math.max(1, p), totalPages.value);
  if (target === page.value) return;
  page.value = target;
  fetchList();
}

// 表单
const formVisible = ref(false);
const saving = ref(false);
const form = reactive({ id: null, name: "", url: "" });

function openForm(wb) {
  form.id = wb ? wb.id : null;
  form.name = wb ? wb.name : "";
  form.url = wb ? wb.url : "";
  formVisible.value = true;
}

// 与后端一致的地址规范化：缺协议补 http://，再校验
function normalizeUrl(raw) {
  let url = String(raw || "").trim();
  if (!url) return { error: "请填写服务地址" };
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch (_) {
    return { error: "地址格式不正确，请填写如 http://192.168.0.3:5180/" };
  }
  return { url };
}

async function submit() {
  if (!form.name.trim()) return ElMessage.warning("请填写工作台名称");
  const { error, url } = normalizeUrl(form.url);
  if (error) return ElMessage.warning(error);
  saving.value = true;
  try {
    if (form.id) {
      await updateWorkbench(form.id, { name: form.name.trim(), url });
      ElMessage.success("已更新");
    } else {
      await createWorkbench({ name: form.name.trim(), url });
      ElMessage.success("已新增");
      page.value = 1; // 新建的排最前，回第一页才能看到
    }
    formVisible.value = false;
    fetchList();
  } catch (e) {
    /* 拦截器已统一提示 */
  } finally {
    saving.value = false;
  }
}

async function handleDelete(wb) {
  try {
    await ElMessageBox.confirm(`确认删除「${wb.name}」吗？`, "删除工作台", {
      type: "warning",
      confirmButtonText: "删除",
      cancelButtonText: "取消",
    });
  } catch (_) {
    return; // 用户取消
  }
  try {
    await deleteWorkbench(wb.id);
    ElMessage.success("已删除");
    // 当前页删空了就回退一页
    if (items.value.length === 1 && page.value > 1) page.value -= 1;
    fetchList();
    fetchTop();
  } catch (e) {
    /* 拦截器已统一提示 */
  }
}

onMounted(() => {
  fetchList();
  fetchTop();
});
</script>

<style scoped>
/* 极简分页控件：高度 26px，避免撑出纵向滚动条 */
.pager-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.pager-btn:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--accent-text);
  background: var(--accent-soft);
}
.pager-btn:disabled {
  color: var(--text-3);
  border-color: var(--line);
  cursor: not-allowed;
}
.pager-label {
  min-width: 44px;
  padding: 2px 6px;
  text-align: center;
  font-size: 13px;
  color: var(--text-2);
  border-radius: var(--radius-s);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s, background 0.15s;
}
.pager-label:hover {
  color: var(--accent-text);
  background: var(--accent-soft);
}
.pager-input {
  width: 44px;
  height: 26px;
  text-align: center;
  font-size: 13px;
  color: var(--text);
  background: var(--input-bg);
  border: 1px solid var(--accent);
  border-radius: var(--radius-s);
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}

/* 访问排行条目：名称左对齐 + 次数右对齐 */
.rank-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: var(--radius-s);
  background: transparent;
  font-size: 13px;
  color: var(--text-2);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.rank-item:hover {
  color: var(--accent-text);
  background: var(--accent-soft);
}
</style>

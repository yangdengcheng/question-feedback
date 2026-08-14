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
        <div class="panel-title text-sm font-semibold text-ink-text mb-2">热度排行</div>
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
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold text-ink-text">工作台</h1>
        <button v-if="authStore.isMaintainer" class="btn-accent" @click="openForm()">
          <el-icon class="mr-1"><Plus /></el-icon>新增工作台
        </button>
      </div>

      <!-- 标签 tab 栏（el-tabs 基础下划线样式）：默认全部，选中后与模糊搜索叠加筛选 -->
      <el-tabs v-if="tagOptions.length > 0" v-model="activeTab" class="wb-tabs" @tab-change="onTabChange">
        <el-tab-pane label="全部" name="all" />
        <el-tab-pane v-for="t in tagOptions" :key="t" :label="t" :name="t" />
        <el-tab-pane label="其他" name="__none__" />
      </el-tabs>

      <!-- 加载 -->
      <div v-if="loading" class="flex justify-center py-20">
        <el-icon class="is-loading text-accent-text" :size="32"><Loading /></el-icon>
      </div>

      <!-- 空态 -->
      <div v-else-if="items.length === 0" class="text-center py-20">
        <el-icon :size="48" class="text-ink-text-3 mb-4"><Grid /></el-icon>
        <p class="text-ink-text-3 mb-2">{{ keyword ? "没有匹配的工作台" : "暂无工作台" }}</p>
      </div>

      <!-- 卡片网格：一行三个 -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="wb in items"
          :key="wb.id"
          class="panel panel-hover p-[10px] flex flex-col gap-3 cursor-pointer"
          @click="openWorkbench(wb)"
        >
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span v-if="wb.tag" class="tag-chip shrink-0" :title="wb.tag">{{ wb.tag }}</span>
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

          <p class="text-xs text-ink-text-2 tnum truncate" :title="wb.url">{{ wb.url }}</p>

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
            placeholder="如 http://127.0.0.1:8080"
            maxlength="255"
            clearable
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-form-item label="可见角色">
          <el-select
            v-model="form.roles"
            multiple
            clearable
            placeholder="不选则全部角色可见"
            style="width: 100%"
          >
            <el-option v-for="r in ROLE_OPTIONS" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="form.tag"
            filterable
            allow-create
            default-first-option
            clearable
            placeholder="下拉选择已有标签，或直接输入新标签"
            style="width: 100%"
          >
            <el-option v-for="t in tagOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
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
  workbenchTags,
  topWorkbenches,
  visitWorkbench,
  createWorkbench,
  updateWorkbench,
  deleteWorkbench,
} from "../api/workbench";

const authStore = useAuthStore();

// 可见角色选项（与 users.role ENUM 一致）
const ROLE_OPTIONS = [
  { value: "customer", label: "客户" },
  { value: "data_maintenance", label: "数据维护" },
  { value: "dev_lead", label: "系统开发主管" },
  { value: "developer", label: "系统开发" },
  { value: "tester", label: "测试" },
  { value: "admin", label: "管理员" },
];

// 列表
const items = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(12); // 四行三列
const total = ref(0);
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

// 标签：清单（表单下拉 + tab 栏共用）+ 当前选中的 tab（"all"=全部）
const tagOptions = ref([]);
const activeTab = ref("all");

async function fetchTags() {
  try {
    tagOptions.value = (await workbenchTags()) || [];
    // 选中的标签已不存在（被改掉了），回退到「全部」；all/其他 不受影响
    if (
      activeTab.value !== "all" &&
      activeTab.value !== "__none__" &&
      !tagOptions.value.includes(activeTab.value)
    ) {
      activeTab.value = "all";
      fetchList();
    }
  } catch (e) {
    /* 标签加载失败不打扰用户 */
  }
}

function onTabChange() {
  page.value = 1;
  fetchList();
}

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
    if (activeTab.value === "__none__") params.untagged = 1;
    else if (activeTab.value !== "all") params.tag = activeTab.value;
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

// 仅管理员、系统开发主管、系统开发可编辑/删除；其余角色只能点击卡片跳转
function canModify() {
  return authStore.isMaintainer;
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
const form = reactive({ id: null, name: "", url: "", roles: [], tag: "" });

function openForm(wb) {
  form.id = wb ? wb.id : null;
  form.name = wb ? wb.name : "";
  form.url = wb ? wb.url : "";
  form.roles = wb && wb.roles ? String(wb.roles).split(",").filter(Boolean) : [];
  form.tag = wb && wb.tag ? wb.tag : "";
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
      // 注意：el-select 清空时 model 会变 undefined，JSON 序列化会丢键，
      // 后端收不到 tag 字段就会保留旧值——这里必须归一化成空字符串
      await updateWorkbench(form.id, { name: form.name.trim(), url, roles: form.roles, tag: form.tag ?? "" });
      ElMessage.success("已更新");
    } else {
      await createWorkbench({ name: form.name.trim(), url, roles: form.roles, tag: form.tag ?? "" });
      ElMessage.success("已新增");
      page.value = 1; // 新建的排最前，回第一页才能看到
    }
    formVisible.value = false;
    fetchTags(); // 可能出现新标签，同步刷新 tab 栏与下拉选项
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
    fetchTags();
    fetchList();
    fetchTop();
  } catch (e) {
    /* 拦截器已统一提示 */
  }
}

onMounted(() => {
  fetchList();
  fetchTop();
  fetchTags();
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

/* 标签 tab 栏：收紧 el-tabs 默认间距（header 默认下边距 15px，tab 左右内边距 20px） */
.wb-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}
.wb-tabs :deep(.el-tabs__item) {
  padding: 0 10px;
}

/* 卡片标题前的标签徽标 */
.tag-chip {
  display: inline-flex;
  align-items: center;
  max-width: 120px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-text);
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

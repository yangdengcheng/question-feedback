<template>
  <div>
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
      <p class="text-ink-text-3 mb-2">暂无工作台</p>
      <p class="text-ink-text-3 text-sm">点击右上角「新增工作台」，添加第一个服务地址</p>
    </div>

    <!-- 卡片网格：一行三个 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="wb in items"
        :key="wb.id"
        class="panel panel-hover p-5 flex flex-col gap-3 cursor-pointer"
        @click="openLink(wb.url)"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <div
              class="w-8 h-8 rounded-lg bg-primary text-[#1a1204] flex items-center justify-center shrink-0"
            >
              <el-icon :size="16"><Monitor /></el-icon>
            </div>
            <h3 class="text-base font-semibold text-ink-text truncate tnum">
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

        <p class="text-sm text-ink-text-2 tnum break-all line-clamp-2 min-h-[40px]">{{ wb.url }}</p>

        <div class="text-xs text-ink-text-3 tnum mt-auto pt-2 border-t border-line">
          {{ wb.creator?.realName || "-" }} 添加于 {{ formatTime(wb.createdAt) }}
        </div>
      </div>
    </div>

    <!-- 分页：一页 12 个（四行三列） -->
    <div v-if="total > pageSize" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="fetchList"
      />
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
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAuthStore } from "../stores/auth";
import {
  listWorkbenches,
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

async function fetchList() {
  loading.value = true;
  try {
    const data = await listWorkbenches({ page: page.value, pageSize: pageSize.value });
    items.value = data.rows || [];
    total.value = data.count || 0;
  } catch (e) {
    /* 拦截器已统一提示 */
  } finally {
    loading.value = false;
  }
}

function openLink(url) {
  window.open(url, "_blank", "noopener,noreferrer");
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
  } catch (e) {
    /* 拦截器已统一提示 */
  }
}

onMounted(() => {
  fetchList();
});
</script>

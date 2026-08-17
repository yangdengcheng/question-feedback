<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-ink-text">用户管理</h1>
      <div class="flex items-center gap-3">
        <el-button type="danger" :disabled="selectedUsers.length === 0" @click="handleBatchDelete">
          批量删除{{ selectedUsers.length ? `（${selectedUsers.length}）` : "" }}
        </el-button>
        <button class="btn-accent px-4 py-2 text-sm" @click="showCreateDialog = true">
          <el-icon class="mr-1"><Plus /></el-icon>新建用户
        </button>
      </div>
    </div>

    <div class="panel p-4">
      <el-table ref="tableRef" :data="users" v-loading="loading" stripe :max-height="tableHeight" @selection-change="handleSelectionChange">
        <el-table-column type="selection" width="50" :selectable="(row) => row.id !== authStore.user?.id" />
        <el-table-column prop="username" label="用户名" width="130" align="center" />
        <el-table-column prop="realName" :label="nameHeaderLabel" width="130" align="center">
          <template #default="{ row }">
            <span :class="isOnline(row.lastActiveAt) ? 'text-green-400 font-medium' : ''">{{ row.realName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="email" label="邮箱" min-width="180" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || "-" }}</template>
        </el-table-column>
        <el-table-column label="角色" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">{{ row.isActive ? "启用" : "禁用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="最后登录时间" width="170" align="center">
          <template #default="{ row }">{{ formatTime(row.lastActiveAt) || "-" }}</template>
        </el-table-column>
        <el-table-column label="注册时间" width="170" align="center">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="在线" width="80" align="center">
          <template #default="{ row }">
            <span v-if="isOnline(row.lastActiveAt)" class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              <span class="text-xs text-green-400">在线</span>
            </span>
            <span v-else class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-ink-text-3 inline-block"></span>
              <span class="text-xs text-ink-text-3">离线</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" text :type="row.isActive ? 'danger' : 'success'" @click="toggleActive(row)">
              {{ row.isActive ? "禁用" : "启用" }}
            </el-button>
            <el-button size="small" text type="primary" @click="openRoleDialog(row)">变更角色</el-button>
            <el-button
              v-if="row.id !== authStore.user?.id"
              size="small" text type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建用户对话框 -->
    <el-dialog v-model="showCreateDialog" title="新建用户" width="480px">
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-position="top">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="createForm.username" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="createForm.realName" placeholder="真实姓名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="createForm.email" placeholder="邮箱（选填）" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="createForm.password" type="password" placeholder="初始密码" show-password />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="createForm.role" placeholder="选择角色" style="width: 100%">
            <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.value" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 编辑用户信息对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑用户信息" width="480px">
      <el-form :model="editForm" label-position="top">
        <el-form-item label="用户名">
          <el-input :model-value="editForm.username" disabled />
        </el-form-item>
        <el-form-item label="姓名">
          <el-input v-model="editForm.realName" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editForm.email" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="handleEdit">保存</el-button>
      </template>
    </el-dialog>

    <!-- 变更角色对话框 -->
    <el-dialog v-model="showRoleDialog" title="变更角色" width="400px">
      <p class="text-sm text-ink-text-2 mb-4">用户：{{ roleDialogUser?.realName }}</p>
      <el-select v-model="newRole" placeholder="选择新角色" style="width: 100%">
        <el-option v-for="r in roleOptions" :key="r.value" :label="r.label" :value="r.value" />
      </el-select>
      <template #footer>
        <el-button @click="showRoleDialog = false">取消</el-button>
        <el-button type="primary" @click="handleRoleChange">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as adminApi from "../../api/admin";
import { useAuthStore } from "../../stores/auth";

const authStore = useAuthStore();
const users = ref([]);
const selectedUsers = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const showRoleDialog = ref(false);
const showEditDialog = ref(false);
const creating = ref(false);
const roleDialogUser = ref(null);
const newRole = ref("");
const createFormRef = ref(null);
const tableRef = ref(null);
const tableHeight = ref(500);

// 表格占满剩余可视高度：表体内部滚动、表头固定，页面不出现纵向滚动条
function calcTableHeight() {
  nextTick(() => {
    const el = tableRef.value?.$el;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    tableHeight.value = Math.max(240, window.innerHeight - top - 50);
  });
}
const editForm = reactive({ id: null, username: "", realName: "", email: "" });

const roleOptions = [
  { value: "customer", label: "客户" },
  { value: "data_maintenance", label: "数据维护" },
  { value: "dev_lead", label: "系统开发主管" },
  { value: "developer", label: "系统开发" },
  { value: "tester", label: "测试" },
  { value: "admin", label: "管理员" },
];

const roleMap = { customer: "客户", data_maintenance: "数据维护", dev_lead: "系统开发主管", developer: "系统开发", tester: "测试", admin: "管理员" };
function roleLabel(role) { return roleMap[role] || role; }
function roleTagType(role) {
  const map = { admin: "warning", dev_lead: "danger", developer: "", tester: "success", data_maintenance: "info", customer: "info" };
  return map[role] || "info";
}

const createForm = reactive({ username: "", realName: "", email: "", password: "", role: "customer" });
const createRules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  realName: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }, { min: 6, message: "密码至少6位", trigger: "blur" }],
  role: [{ required: true, message: "请选择角色", trigger: "change" }],
};

onMounted(() => {
  fetchUsers();
  calcTableHeight();
  window.addEventListener("resize", calcTableHeight);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", calcTableHeight);
});

async function fetchUsers() {
  loading.value = true;
  try { users.value = await adminApi.listUsers(); } catch (e) {} finally { loading.value = false; }
}

async function handleCreate() {
  const valid = await createFormRef.value.validate().catch(() => false);
  if (!valid) return;
  creating.value = true;
  try {
    await adminApi.createUser({ ...createForm });
    ElMessage.success("用户创建成功");
    showCreateDialog.value = false;
    Object.assign(createForm, { username: "", realName: "", email: "", password: "", role: "customer" });
    fetchUsers();
  } catch (e) {} finally { creating.value = false; }
}

function openRoleDialog(row) {
  roleDialogUser.value = row;
  newRole.value = row.role;
  showRoleDialog.value = true;
}

async function handleRoleChange() {
  try {
    await adminApi.updateUser(roleDialogUser.value.id, { role: newRole.value });
    ElMessage.success("角色变更成功");
    showRoleDialog.value = false;
    fetchUsers();
  } catch (e) {}
}

async function toggleActive(row) {
  try {
    await adminApi.updateUser(row.id, { isActive: !row.isActive });
    ElMessage.success(row.isActive ? "已禁用" : "已启用");
    fetchUsers();
  } catch (e) {}
}

function openEditDialog(row) {
  editForm.id = row.id;
  editForm.username = row.username;
  editForm.realName = row.realName;
  editForm.email = row.email || "";
  showEditDialog.value = true;
}

async function handleEdit() {
  try {
    await adminApi.updateUser(editForm.id, { realName: editForm.realName, email: editForm.email });
    ElMessage.success("用户信息更新成功");
    showEditDialog.value = false;
    fetchUsers();
  } catch (e) {}
}

function handleSelectionChange(rows) {
  selectedUsers.value = rows;
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `确定删除用户「${row.realName}（${row.username}）」吗？其创建的工单、评论、附件、通知等关联数据将一并删除，无法恢复。`,
      "提示",
      { type: "warning", confirmButtonText: "删除", confirmButtonClass: "el-button--danger" },
    );
  } catch (_) { return; }
  try {
    await adminApi.deleteUser(row.id);
    ElMessage.success("删除成功");
    fetchUsers();
  } catch (e) {}
}

async function handleBatchDelete() {
  const ids = selectedUsers.value.map((u) => u.id);
  if (ids.length === 0) return;
  try {
    await ElMessageBox.confirm(
      `确定删除选中的 ${ids.length} 个用户吗？他们创建的工单、评论、附件、通知等关联数据将一并删除，无法恢复。`,
      "提示",
      { type: "warning", confirmButtonText: "删除", confirmButtonClass: "el-button--danger" },
    );
  } catch (_) { return; }
  try {
    await adminApi.batchDeleteUsers(ids);
    ElMessage.success("批量删除成功");
    selectedUsers.value = [];
    fetchUsers();
  } catch (e) {}
}

function isOnline(lastActiveAt) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000; // 5 minutes
}

// 姓名列标题：动态展示在线人数/总人数，如“姓名（2/20）”
const nameHeaderLabel = computed(() => {
  const online = users.value.filter((u) => isOnline(u.lastActiveAt)).length;
  return `姓名（${online}/${users.value.length}）`;
});

// 固定按东八区（Asia/Shanghai）渲染，避免浏览器本地时区不是 +8 时显示错误
const shanghaiFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Shanghai",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(shanghaiFmt.formatToParts(d).map(({ type, value }) => [type, value]));
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
</script>

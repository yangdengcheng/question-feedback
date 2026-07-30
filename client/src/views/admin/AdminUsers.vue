<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">用户管理</h1>
      <button class="btn-accent px-4 py-2 text-sm" @click="showCreateDialog = true">
        <el-icon class="mr-1"><Plus /></el-icon>新建用户
      </button>
    </div>

    <div class="panel p-4">
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" width="130" />
        <el-table-column prop="realName" label="姓名" width="100" />
        <el-table-column prop="email" label="邮箱" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || "-" }}</template>
        </el-table-column>
        <el-table-column label="角色" width="130">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">{{ row.isActive ? "启用" : "禁用" }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="150">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="在线" width="80">
          <template #default="{ row }">
            <span v-if="isOnline(row.lastActiveAt)" class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              <span class="text-xs text-green-400">在线</span>
            </span>
            <span v-else class="inline-flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-slate-600 inline-block"></span>
              <span class="text-xs text-slate-500">离线</span>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button size="small" text type="primary" @click="openEditDialog(row)">编辑</el-button>
            <el-button size="small" text :type="row.isActive ? 'danger' : 'success'" @click="toggleActive(row)">
              {{ row.isActive ? "禁用" : "启用" }}
            </el-button>
            <el-button size="small" text type="primary" @click="openRoleDialog(row)">变更角色</el-button>
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
      <p class="text-sm text-slate-400 mb-4">用户：{{ roleDialogUser?.realName }}</p>
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
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import * as adminApi from "../../api/admin";

const users = ref([]);
const loading = ref(false);
const showCreateDialog = ref(false);
const showRoleDialog = ref(false);
const showEditDialog = ref(false);
const creating = ref(false);
const roleDialogUser = ref(null);
const newRole = ref("");
const createFormRef = ref(null);
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

onMounted(() => { fetchUsers(); });

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

function isOnline(lastActiveAt) {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < 5 * 60 * 1000; // 5 minutes
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>

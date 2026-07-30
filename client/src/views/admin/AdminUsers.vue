<template>
  <div>
    <h1 class="text-xl font-bold text-slate-200 mb-6">用户管理</h1>

    <div class="glass-card-static p-4">
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="realName" label="姓名" width="120" />
        <el-table-column
          prop="email"
          label="邮箱"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">{{ row.email || "-" }}</template>
        </el-table-column>
        <el-table-column label="角色" width="100">
          <template #default="{ row }">
            <el-tag
              :type="row.role === 'admin' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.role === "admin" ? "管理员" : "用户" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? "启用" : "禁用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="注册时间" width="160">
          <template #default="{ row }">{{
            formatTime(row.createdAt)
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              :type="row.isActive ? 'danger' : 'success'"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? "禁用" : "启用" }}
            </el-button>
            <el-button
              size="small"
              text
              type="primary"
              @click="toggleRole(row)"
            >
              {{ row.role === "admin" ? "设为用户" : "设为管理员" }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import * as adminApi from "../../api/admin";

const users = ref([]);
const loading = ref(false);

onMounted(() => {
  fetchUsers();
});

async function fetchUsers() {
  loading.value = true;
  try {
    users.value = await adminApi.listUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function toggleActive(row) {
  try {
    await adminApi.updateUser(row.id, { isActive: !row.isActive });
    ElMessage.success(row.isActive ? "已禁用" : "已启用");
    fetchUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function toggleRole(row) {
  try {
    const newRole = row.role === "admin" ? "user" : "admin";
    await adminApi.updateUser(row.id, { role: newRole });
    ElMessage.success("角色变更成功");
    fetchUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>

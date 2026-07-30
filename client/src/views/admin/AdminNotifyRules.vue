<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">通知规则</h1>
      <el-button type="primary" @click="openAddDialog">
        <el-icon class="mr-1"><Plus /></el-icon>新增规则
      </el-button>
    </div>

    <div class="glass-card-static p-4">
      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column label="用户" width="150">
          <template #default="{ row }"
            >{{ row.user?.realName }} ({{ row.user?.username }})</template
          >
        </el-table-column>
        <el-table-column label="工单类型" width="150">
          <template #default="{ row }">
            {{ row.ticketType ? typeLabel(row.ticketType) : "全部类型" }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
              {{ row.isActive ? "启用" : "停用" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              :type="row.isActive ? 'warning' : 'success'"
              @click="toggleActive(row)"
            >
              {{ row.isActive ? "停用" : "启用" }}
            </el-button>
            <el-button
              size="small"
              text
              type="danger"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增规则对话框 -->
    <el-dialog v-model="addDialogVisible" title="新增通知规则" width="400px">
      <el-form label-position="top">
        <el-form-item label="选择用户">
          <el-select
            v-model="newRule.userId"
            placeholder="选择用户"
            class="w-full"
          >
            <el-option
              v-for="user in users"
              :key="user.id"
              :label="user.realName"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="工单类型">
          <el-select
            v-model="newRule.ticketType"
            placeholder="全部类型"
            clearable
            class="w-full"
          >
            <el-option label="Bug" value="bug" />
            <el-option label="使用问题" value="question" />
            <el-option label="功能建议" value="suggestion" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import * as adminApi from "../../api/admin";

const rules = ref([]);
const users = ref([]);
const loading = ref(false);
const addDialogVisible = ref(false);

const newRule = reactive({
  userId: null,
  ticketType: null,
});

onMounted(() => {
  fetchRules();
  fetchUsers();
});

async function fetchRules() {
  loading.value = true;
  try {
    rules.value = await adminApi.listNotifyRules();
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}

async function fetchUsers() {
  try {
    users.value = await adminApi.listUsers();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function openAddDialog() {
  newRule.userId = null;
  newRule.ticketType = null;
  addDialogVisible.value = true;
}

async function handleAdd() {
  if (!newRule.userId) {
    ElMessage.warning("请选择用户");
    return;
  }
  try {
    await adminApi.createNotifyRule({
      userId: newRule.userId,
      ticketType: newRule.ticketType || null,
    });
    ElMessage.success("规则创建成功");
    addDialogVisible.value = false;
    fetchRules();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function toggleActive(row) {
  try {
    await adminApi.updateNotifyRule(row.id, { isActive: !row.isActive });
    ElMessage.success(row.isActive ? "已停用" : "已启用");
    fetchRules();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm("确定要删除此规则吗？", "提示", {
      type: "warning",
    });
    await adminApi.deleteNotifyRule(row.id);
    ElMessage.success("删除成功");
    fetchRules();
  } catch (error) {
    // 取消或错误
  }
}

function typeLabel(type) {
  const map = { bug: "Bug", question: "使用问题", suggestion: "功能建议" };
  return map[type] || type;
}
</script>

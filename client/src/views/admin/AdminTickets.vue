<template>
  <div>
    <h1 class="text-xl font-bold text-slate-200 mb-6">工单管理</h1>

    <div class="glass-card-static p-4 mb-6 flex items-center gap-4">
      <el-select
        v-model="filters.status"
        placeholder="状态"
        clearable
        class="w-32"
      >
        <el-option label="待处理" value="pending" />
        <el-option label="处理中" value="processing" />
        <el-option label="已解决" value="resolved" />
        <el-option label="已关闭" value="closed" />
      </el-select>
      <el-select
        v-model="filters.type"
        placeholder="类型"
        clearable
        class="w-32"
      >
        <el-option label="Bug" value="bug" />
        <el-option label="使用问题" value="question" />
        <el-option label="功能建议" value="suggestion" />
      </el-select>
    </div>

    <div class="glass-card-static p-4">
      <el-table :data="tickets" v-loading="loading" stripe>
        <el-table-column prop="ticketNo" label="工单号" width="160" />
        <el-table-column
          prop="title"
          label="标题"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="typeTagType(row.type)">{{
              typeLabel(row.type)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <StatusBadge :status="row.status" />
          </template>
        </el-table-column>
        <el-table-column label="优先级" width="80">
          <template #default="{ row }">{{
            priorityLabel(row.priority)
          }}</template>
        </el-table-column>
        <el-table-column label="提交人" width="100">
          <template #default="{ row }">{{ row.creator?.realName }}</template>
        </el-table-column>
        <el-table-column label="处理人" width="100">
          <template #default="{ row }">{{
            row.assignee?.realName || "未分配"
          }}</template>
        </el-table-column>
        <el-table-column label="更新时间" width="160">
          <template #default="{ row }">{{
            formatTime(row.updatedAt)
          }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              text
              @click="openAssignDialog(row)"
            >
              分配
            </el-button>
            <el-dropdown
              trigger="click"
              @command="(cmd) => handleStatusChange(row, cmd)"
            >
              <el-button size="small" type="warning" text>
                变更状态<el-icon class="ml-1"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="pending">待处理</el-dropdown-item>
                  <el-dropdown-item command="processing"
                    >处理中</el-dropdown-item
                  >
                  <el-dropdown-item command="resolved">已解决</el-dropdown-item>
                  <el-dropdown-item command="closed">已关闭</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="total > pageSize" class="flex justify-center mt-6">
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          @current-change="fetchTickets"
        />
      </div>
    </div>

    <!-- 分配对话框 -->
    <el-dialog v-model="assignDialogVisible" title="分配处理人" width="400px">
      <el-select
        v-model="selectedAssignee"
        placeholder="选择处理人"
        class="w-full"
      >
        <el-option
          v-for="user in users"
          :key="user.id"
          :label="user.realName"
          :value="user.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="assignDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
import * as adminApi from "../../api/admin";
import StatusBadge from "../../components/StatusBadge.vue";

const tickets = ref([]);
const users = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const assignDialogVisible = ref(false);
const selectedAssignee = ref(null);
const currentTicket = ref(null);

const filters = reactive({ status: "", type: "" });

watch(filters, () => {
  page.value = 1;
  fetchTickets();
});

onMounted(() => {
  fetchTickets();
  fetchUsers();
});

async function fetchTickets() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (filters.status) params.status = filters.status;
    if (filters.type) params.type = filters.type;
    const data = await adminApi.listTickets(params);
    tickets.value = data.rows;
    total.value = data.count;
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

function openAssignDialog(row) {
  currentTicket.value = row;
  selectedAssignee.value = row.assigneeId;
  assignDialogVisible.value = true;
}

async function handleAssign() {
  try {
    await adminApi.updateTicket(currentTicket.value.id, {
      assigneeId: selectedAssignee.value,
    });
    ElMessage.success("分配成功");
    assignDialogVisible.value = false;
    fetchTickets();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

async function handleStatusChange(row, status) {
  try {
    await adminApi.updateTicket(row.id, { status });
    ElMessage.success("状态变更成功");
    fetchTickets();
  } catch (error) {
    // 错误已在拦截器中处理
  }
}

function typeLabel(type) {
  const map = { bug: "Bug", question: "使用问题", suggestion: "功能建议" };
  return map[type] || type;
}

function typeTagType(type) {
  const map = { bug: "danger", question: "warning", suggestion: "success" };
  return map[type] || "info";
}

function priorityLabel(p) {
  const map = { low: "低", medium: "中", high: "高" };
  return map[p] || p;
}

function formatTime(time) {
  if (!time) return "";
  const d = new Date(time);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
</script>

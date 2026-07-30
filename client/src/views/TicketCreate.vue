<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6">
      <router-link
        to="/"
        class="text-sm text-slate-500 hover:text-slate-300 transition-colors"
      >
        ← 返回工单列表
      </router-link>
      <h1 class="text-xl font-bold text-slate-200 mt-2">新建工单</h1>
    </div>

    <div class="glass-card-static p-8">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="handleSubmit"
      >
        <el-form-item label="标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="简要描述您遇到的问题"
            maxlength="200"
            show-word-limit
            size="large"
          />
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
          <FileUpload v-model:attachment-ids="attachmentIds" />
        </el-form-item>

        <el-form-item>
          <button
            type="submit"
            class="btn-gradient px-8 py-3"
            :disabled="loading"
          >
            {{ loading ? "提交中..." : "提交工单" }}
          </button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { createTicket } from "../api/tickets";
import FileUpload from "../components/FileUpload.vue";

const router = useRouter();
const formRef = ref(null);
const loading = ref(false);
const attachmentIds = ref([]);

const form = reactive({
  title: "",
  type: "bug",
  priority: "medium",
  description: "",
});

const rules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  description: [{ required: true, message: "请填写详细描述", trigger: "blur" }],
};

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const data = await createTicket({
      ...form,
      attachmentIds: attachmentIds.value,
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

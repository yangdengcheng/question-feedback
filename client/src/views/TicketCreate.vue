<template>
  <div class="max-w-3xl mx-auto">
    <div class="mb-6">
      <router-link
        to="/"
        class="text-sm text-ink-text-3 hover:text-ink-text-2 transition-colors"
      >
        ← 返回工单列表
      </router-link>
      <h1 class="text-xl font-bold text-ink-text mt-2">新建工单</h1>
    </div>

    <div class="panel p-8">
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
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { createTicket } from "../api/tickets";
import FileUpload from "../components/FileUpload.vue";

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

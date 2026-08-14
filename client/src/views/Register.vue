<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <img :src="lyLogo" alt="林洋" class="h-16 w-auto mx-auto mb-4 object-contain" />
        <h1 class="text-2xl font-bold text-ink-text">TradeMatrix</h1>
        <p class="text-ink-text-3 mt-2 text-sm">创建新账号</p>
      </div>

      <div class="panel p-8">
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="handleSubmit"
        >
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              placeholder="请输入用户名（2-50个字符）"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>

          <el-form-item label="姓名" prop="realName">
            <el-input
              v-model="form.realName"
              placeholder="请输入您的姓名"
              prefix-icon="Postcard"
              size="large"
            />
          </el-form-item>

          <el-form-item label="邮箱（选填）" prop="email">
            <el-input
              v-model="form.email"
              placeholder="请输入邮箱"
              prefix-icon="Message"
              size="large"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码（至少6位）"
              prefix-icon="Lock"
              size="large"
              show-password
            />
          </el-form-item>

          <el-form-item label="确认密码" prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              prefix-icon="Lock"
              size="large"
              show-password
              @keyup.enter="handleSubmit"
            />
          </el-form-item>

          <el-form-item>
            <button
              type="submit"
              class="btn-accent w-full py-3 text-base font-medium"
              :disabled="loading"
            >
              {{ loading ? "注册中..." : "注 册" }}
            </button>
          </el-form-item>
        </el-form>

        <div class="text-center text-sm text-ink-text-3">
          已有账号？
          <router-link
            to="/login"
            class="text-accent-text hover:text-[#fcd34d] transition-colors"
          >
            立即登录
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import lyLogo from "../assets/lylogo.png";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  username: "",
  realName: "",
  email: "",
  password: "",
  confirmPassword: "",
});

const validateConfirmPassword = (rule, value, callback) => {
  if (value !== form.password) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const rules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 2, max: 50, message: "用户名长度为2-50个字符", trigger: "blur" },
  ],
  realName: [{ required: true, message: "请输入姓名", trigger: "blur" }],
  email: [{ type: "email", message: "邮箱格式不正确", trigger: "blur" }],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码至少6位", trigger: "blur" },
  ],
  confirmPassword: [
    { required: true, message: "请确认密码", trigger: "blur" },
    { validator: validateConfirmPassword, trigger: "blur" },
  ],
};

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.register({
      username: form.username,
      password: form.password,
      realName: form.realName,
      email: form.email || undefined,
    });
    ElMessage.success("注册成功");
    router.push("/");
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>

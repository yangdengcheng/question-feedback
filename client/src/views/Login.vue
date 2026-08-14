<template>
  <div class="min-h-screen flex items-center justify-center px-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <img :src="lyLogo" alt="林洋" class="h-16 w-auto mx-auto mb-4 object-contain" />
        <h1 class="text-2xl text-ink-text"><BrandTitle /></h1>
        <p class="text-ink-text-3 mt-2 text-sm">登录您的账号</p>
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
              placeholder="请输入用户名"
              prefix-icon="User"
              size="large"
            />
          </el-form-item>

          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              type="password"
              placeholder="请输入密码"
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
              {{ loading ? "登录中..." : "登 录" }}
            </button>
          </el-form-item>
        </el-form>

        <div class="text-center text-sm text-ink-text-3">
          还没有账号？
          <router-link
            to="/register"
            class="text-accent-text hover:text-[#fcd34d] transition-colors"
          >
            立即注册
          </router-link>
        </div>
      </div>

      <p class="mt-6 text-center text-xs text-ink-text-3">Copyright © 2026 林洋智维</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import lyLogo from "../assets/lylogo.png";
import BrandTitle from "../components/BrandTitle.vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref(null);
const loading = ref(false);

const form = reactive({
  username: "",
  password: "",
});

const rules = {
  username: [{ required: true, message: "请输入用户名", trigger: "blur" }],
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

async function handleSubmit() {
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    await authStore.login(form);
    ElMessage.success("登录成功");
    router.push("/");
  } catch (error) {
    // 错误已在拦截器中处理
  } finally {
    loading.value = false;
  }
}
</script>

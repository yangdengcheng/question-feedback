import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as authApi from "../api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(JSON.parse(localStorage.getItem("user") || "null"));
  const token = ref(localStorage.getItem("token") || "");
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === "admin");
  // 管理后台访问权限：系统管理员 + 开发主管
  const canAccessAdmin = computed(() => ["admin", "dev_lead"].includes(user.value?.role));
  const INTERNAL_ROLES = ["data_maintenance", "dev_lead", "developer", "tester", "admin"];
  const isInternal = computed(() => INTERNAL_ROLES.includes(user.value?.role));
  const MAINTAINER_ROLES = ["developer", "dev_lead", "admin"];
  const isMaintainer = computed(() => MAINTAINER_ROLES.includes(user.value?.role));

  async function login(credentials) {
    const data = await authApi.login(credentials);
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }

  async function register(formData) {
    const data = await authApi.register(formData);
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    return data;
  }

  function logout() {
    // 清 token 之前先通知服务器下线（后端把 lastActiveAt 置 null → 用户管理立即显示离线）
    // fire-and-forget：keepalive 保证页面跳转/关闭时请求也能发出
    const t = token.value;
    if (t) {
      try {
        fetch("/api/auth/offline", {
          method: "POST",
          keepalive: true,
          headers: { Authorization: `Bearer ${t}` },
        }).catch(() => {});
      } catch (_) {
        /* 忽略：退出时的尽力而为请求 */
      }
    }
    token.value = "";
    user.value = null;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }

  async function fetchMe() {
    try {
      const data = await authApi.getMe();
      user.value = data;
      localStorage.setItem("user", JSON.stringify(data));
    } catch (error) {
      logout();
    }
  }

  return { user, token, isLoggedIn, isAdmin, canAccessAdmin, isInternal, isMaintainer, login, register, logout, fetchMe };
});

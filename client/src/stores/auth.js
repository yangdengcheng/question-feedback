import { defineStore } from "pinia";
import { ref, computed } from "vue";
import * as authApi from "../api/auth";

export const useAuthStore = defineStore("auth", () => {
  const user = ref(JSON.parse(localStorage.getItem("user") || "null"));
  const token = ref(localStorage.getItem("token") || "");
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.role === "admin");
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

  return { user, token, isLoggedIn, isAdmin, isInternal, isMaintainer, login, register, logout, fetchMe };
});

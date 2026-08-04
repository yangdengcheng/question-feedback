import axios from "axios";
import { ElMessage } from "element-plus";
import router from "../router";

const request = axios.create({ baseURL: "/api", timeout: 15000 });

request.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

request.interceptors.response.use(
  // 文件下载（blob）需要读取响应头，返回完整 response
  (response) => (response.config.responseType === "blob" ? response : response.data),
  (error) => {
    const message = error.response?.data?.message || "请求失败";
    const url = error.config?.url || "";
    const isAuthRequest = url.includes("/auth/login") || url.includes("/auth/register");
    if (error.response?.status === 401 && !isAuthRequest) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      router.push("/login");
      ElMessage.error("登录已过期，请重新登录");
    } else if (error.response?.status === 401 && isAuthRequest) {
      ElMessage.error(message || "用户名或密码错误");
    } else {
      ElMessage.error(message);
    }
    return Promise.reject(error);
  },
);

export default request;

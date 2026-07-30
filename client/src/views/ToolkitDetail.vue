<template>
  <div>
    <!-- 加载 -->
    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-primary" :size="32"><Loading /></el-icon>
    </div>

    <template v-else-if="pkg">
      <!-- 头部 -->
      <div class="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div class="min-w-0">
          <router-link to="/toolkit" class="text-sm text-slate-500 hover:text-primary inline-flex items-center gap-1 mb-2">
            <el-icon><ArrowLeft /></el-icon>返回工具包
          </router-link>
          <div class="flex items-center gap-3 flex-wrap">
            <h1 class="text-2xl font-bold text-slate-100">{{ pkg.name }}</h1>
            <span v-if="!pkg.isActive" class="badge">已下架</span>
          </div>
          <div class="flex items-center gap-2 mt-2 flex-wrap">
            <span class="badge">{{ pkg.province?.name }}</span>
            <span class="badge">{{ pkg.category?.name }}</span>
            <span v-if="pkg.currentVersion" class="badge tnum">最新版本 v{{ pkg.currentVersion.version }}</span>
          </div>
        </div>

        <!-- 维护者操作 -->
        <div v-if="authStore.isMaintainer" class="flex items-center gap-3 shrink-0">
          <button class="btn-ghost" @click="openRelease">
            <el-icon class="mr-1"><Upload /></el-icon>发布新版本
          </button>
          <button class="btn-ghost" @click="openEdit">
            <el-icon class="mr-1"><Edit /></el-icon>编辑信息与说明
          </button>
          <button class="btn-ghost" @click="handleToggle">
            <el-icon class="mr-1"><Switch /></el-icon>{{ pkg.isActive ? "下架" : "上架" }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 说明文档 -->
        <div class="lg:col-span-2 panel p-6">
          <h2 class="panel-title mb-4">说明文档</h2>
          <div v-if="pkg.docMarkdown">
            <MdPreview :model-value="pkg.docMarkdown" theme="dark" preview-theme="dark" code-theme="atom" />
          </div>
          <div v-else class="text-slate-500 text-sm py-8 text-center">暂无说明文档</div>
        </div>

        <!-- 信息卡 -->
        <div class="space-y-6">
          <div class="panel p-6">
            <h2 class="panel-title mb-4">信息</h2>
            <dl class="space-y-3 text-sm">
              <div class="flex justify-between">
                <dt class="text-slate-500">省份</dt>
                <dd class="text-slate-200">{{ pkg.province?.name || "-" }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">分类</dt>
                <dd class="text-slate-200">{{ pkg.category?.name || "-" }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">最新版本</dt>
                <dd class="text-slate-200 tnum">{{ pkg.currentVersion ? `v${pkg.currentVersion.version}` : "尚未发布" }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">创建人</dt>
                <dd class="text-slate-200">{{ pkg.creator?.realName || "-" }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-slate-500">更新时间</dt>
                <dd class="text-slate-200 tnum">{{ formatTime(pkg.updatedAt) }}</dd>
              </div>
            </dl>
            <button
              class="btn-accent w-full mt-5"
              :disabled="!pkg.currentVersion"
              @click="downloadCurrent"
            >
              <el-icon class="mr-1"><Download /></el-icon>
              {{ pkg.currentVersion ? "下载最新版本" : "暂无可下载版本" }}
            </button>
          </div>

          <!-- 版本历史 -->
          <div class="panel p-6">
            <h2 class="panel-title mb-4">版本历史</h2>
            <div v-if="versions.length === 0" class="text-slate-500 text-sm py-4 text-center">暂无版本</div>
            <div v-else class="space-y-4">
              <div v-for="ver in versions" :key="ver.id" class="border-l-2 border-line pl-3">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm font-semibold text-slate-200 tnum">v{{ ver.version }}</span>
                  <button class="text-xs text-primary hover:underline inline-flex items-center gap-1" @click="downloadVer(ver)">
                    <el-icon :size="12"><Download /></el-icon>下载
                  </button>
                </div>
                <p v-if="ver.releaseNote" class="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{{ ver.releaseNote }}</p>
                <p class="text-xs text-slate-500 tnum mt-1">{{ formatTime(ver.createdAt) }} · {{ ver.creator?.realName || "" }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 发布新版本弹窗 -->
    <el-dialog v-model="releaseVisible" title="发布新版本" width="560px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="版本号" required>
          <el-input v-model="releaseForm.version" placeholder="如 1.2.0" maxlength="50" />
        </el-form-item>
        <el-form-item label="脚本文件（.js）" required>
          <el-upload
            :auto-upload="false"
            :show-file-list="true"
            :limit="1"
            accept=".js"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :on-exceed="handleFileExceed"
          >
            <el-button :icon="UploadFilled">选择 .js 文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="更新说明">
          <el-input v-model="releaseForm.releaseNote" type="textarea" :rows="3" placeholder="选填，本次更新内容" maxlength="500" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="releaseVisible = false">取消</el-button>
        <el-button type="primary" :loading="releaseSaving" @click="submitRelease">发布</el-button>
      </template>
    </el-dialog>

    <!-- 编辑信息与说明弹窗 -->
    <el-dialog v-model="editVisible" title="编辑信息与说明" width="860px" destroy-on-close top="5vh">
      <el-form label-position="top">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          <el-form-item label="名称" required>
            <el-input v-model="editForm.name" maxlength="100" />
          </el-form-item>
          <el-form-item label="省份" required>
            <el-select v-model="editForm.provinceId" class="w-full">
              <el-option v-for="d in activeProvinces" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="分类" required>
            <el-select v-model="editForm.categoryId" class="w-full">
              <el-option v-for="d in activeCategories" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="一句话简介">
          <el-input v-model="editForm.summary" maxlength="200" />
        </el-form-item>
        <el-form-item label="说明文档（Markdown，支持粘贴/上传图片）">
          <MarkdownEditor v-model="editForm.docMarkdown" height="380px" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editSaving" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { UploadFilled } from "@element-plus/icons-vue";
import { MdPreview } from "md-editor-v3";
import "md-editor-v3/lib/style.css";
import { useAuthStore } from "../stores/auth";
import {
  getPackageDetail, updatePackage, togglePackage, listVersions,
  createVersion, downloadVersion, listDicts,
} from "../api/toolkit";
import request from "../api/request";
import MarkdownEditor from "../components/MarkdownEditor.vue";

const route = useRoute();
const authStore = useAuthStore();

const pkg = ref(null);
const versions = ref([]);
const loading = ref(true);

const provinces = ref([]);
const categories = ref([]);
const activeProvinces = computed(() => provinces.value.filter((d) => d.isActive));
const activeCategories = computed(() => categories.value.filter((d) => d.isActive));

async function fetchDetail() {
  try {
    pkg.value = await getPackageDetail(route.params.id);
  } catch (e) { /* 拦截器已处理 */ }
}
async function fetchVersions() {
  try {
    versions.value = (await listVersions(route.params.id)) || [];
  } catch (e) { /* 拦截器已处理 */ }
}
async function fetchDicts() {
  try {
    const [p, c] = await Promise.all([listDicts("province"), listDicts("category")]);
    provinces.value = p || [];
    categories.value = c || [];
  } catch (e) { /* 拦截器已处理 */ }
}

function formatTime(t) {
  if (!t) return "-";
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 下载
async function downloadCurrent() {
  if (!pkg.value?.currentVersion) return;
  await downloadVersion(pkg.value.currentVersion.id, pkg.value.currentVersion.fileName);
}
async function downloadVer(ver) {
  await downloadVersion(ver.id, ver.fileName);
}

// 发布新版本
const releaseVisible = ref(false);
const releaseSaving = ref(false);
const releaseForm = reactive({ version: "", releaseNote: "" });
const releaseFile = ref(null);

function openRelease() {
  releaseForm.version = "";
  releaseForm.releaseNote = "";
  releaseFile.value = null;
  releaseVisible.value = true;
}
function handleFileChange(uploadFile) {
  releaseFile.value = uploadFile.raw;
}
function handleFileRemove() {
  releaseFile.value = null;
}
function handleFileExceed() {
  ElMessage.warning("只能上传一个文件，请先移除已选文件");
}

async function submitRelease() {
  if (!releaseForm.version.trim()) return ElMessage.warning("请填写版本号");
  if (!releaseFile.value) return ElMessage.warning("请选择 .js 文件");
  releaseSaving.value = true;
  try {
    // 先上传文件取得服务端路径
    const formData = new FormData();
    formData.append("file", releaseFile.value);
    const attachment = await request.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    await createVersion(route.params.id, {
      version: releaseForm.version.trim(),
      releaseNote: releaseForm.releaseNote,
      fileUrl: attachment.filePath,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
    });
    ElMessage.success("发布成功");
    releaseVisible.value = false;
    await Promise.all([fetchDetail(), fetchVersions()]);
  } catch (e) { /* 拦截器已处理 */ } finally {
    releaseSaving.value = false;
  }
}

// 编辑信息与说明
const editVisible = ref(false);
const editSaving = ref(false);
const editForm = reactive({
  name: "", provinceId: "", categoryId: "", summary: "", docMarkdown: "",
});

function openEdit() {
  editForm.name = pkg.value.name;
  editForm.provinceId = pkg.value.provinceId;
  editForm.categoryId = pkg.value.categoryId;
  editForm.summary = pkg.value.summary || "";
  editForm.docMarkdown = pkg.value.docMarkdown || "";
  editVisible.value = true;
}

async function submitEdit() {
  if (!editForm.name.trim()) return ElMessage.warning("请填写名称");
  if (!editForm.provinceId) return ElMessage.warning("请选择省份");
  if (!editForm.categoryId) return ElMessage.warning("请选择分类");
  editSaving.value = true;
  try {
    await updatePackage(route.params.id, {
      name: editForm.name.trim(),
      provinceId: editForm.provinceId,
      categoryId: editForm.categoryId,
      summary: editForm.summary,
      docMarkdown: editForm.docMarkdown,
    });
    ElMessage.success("已保存");
    editVisible.value = false;
    await fetchDetail();
  } catch (e) { /* 拦截器已处理 */ } finally {
    editSaving.value = false;
  }
}

// 上下架
async function handleToggle() {
  const action = pkg.value.isActive ? "下架" : "上架";
  try {
    await ElMessageBox.confirm(`确定${action}「${pkg.value.name}」吗？`, "提示", { type: "warning" });
  } catch (_) { return; }
  try {
    await togglePackage(route.params.id);
    ElMessage.success(`已${action}`);
    await fetchDetail();
  } catch (e) { /* 拦截器已处理 */ }
}

onMounted(async () => {
  loading.value = true;
  await Promise.all([fetchDetail(), fetchVersions(), fetchDicts()]);
  loading.value = false;
});
</script>

<style scoped>
:deep(.md-editor-preview-wrapper) {
  padding: 0;
}
</style>

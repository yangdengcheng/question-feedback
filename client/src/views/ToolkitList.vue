<template>
  <div>
    <!-- 标题 + 维护者操作 -->
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-xl font-bold text-slate-200">工具包</h1>
      <div v-if="authStore.isMaintainer" class="flex items-center gap-3">
        <button class="btn-ghost" @click="openDictDialog">
          <el-icon class="mr-1"><Setting /></el-icon>管理省份/分类
        </button>
        <button class="btn-accent" @click="openPackageForm()">
          <el-icon class="mr-1"><Plus /></el-icon>新建工具包
        </button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="panel p-4 mb-6 flex items-center gap-4 flex-wrap">
      <el-select v-model="filters.provinceId" placeholder="省份" clearable class="w-40" @change="handleFilterChange">
        <el-option v-for="d in activeProvinces" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
      <el-select v-model="filters.categoryId" placeholder="分类" clearable class="w-40" @change="handleFilterChange">
        <el-option v-for="d in activeCategories" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索工具包名称..." clearable class="w-64" @input="handleSearch" @clear="handleSearch">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
    </div>

    <!-- 加载 -->
    <div v-if="loading" class="flex justify-center py-20">
      <el-icon class="is-loading text-primary" :size="32"><Loading /></el-icon>
    </div>

    <!-- 空态 -->
    <div v-else-if="packages.length === 0" class="text-center py-20">
      <el-icon :size="48" class="text-slate-600 mb-4"><Tools /></el-icon>
      <p class="text-slate-500 mb-2">暂无工具包</p>
      <p class="text-slate-600 text-sm">
        {{ authStore.isMaintainer ? "点击右上角「新建工具包」开始维护" : "敬请期待，维护者正在整理工具包" }}
      </p>
    </div>

    <!-- 卡片网格 -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <router-link
        v-for="pkg in packages"
        :key="pkg.id"
        :to="`/toolkit/${pkg.id}`"
        class="panel panel-hover p-5 flex flex-col gap-3 cursor-pointer"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="text-base font-semibold text-slate-100 leading-snug">{{ pkg.name }}</h3>
          <span v-if="pkg.currentVersion" class="badge tnum shrink-0">v{{ pkg.currentVersion.version }}</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="badge">{{ pkg.province?.name }}</span>
          <span class="badge">{{ pkg.category?.name }}</span>
        </div>
        <p class="text-sm text-slate-400 line-clamp-2 min-h-[40px]">{{ pkg.summary || "暂无简介" }}</p>
        <div class="text-xs text-slate-500 tnum mt-auto pt-2 border-t border-line">
          更新于 {{ formatTime(pkg.updatedAt) }}
        </div>
      </router-link>
    </div>

    <!-- 分页 -->
    <div v-if="total > 0" class="flex justify-center mt-8">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[12, 24, 48]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        @current-change="fetchPackages"
        @size-change="handleSizeChange"
      />
    </div>

    <!-- 字典管理弹窗 -->
    <el-dialog v-model="dictDialogVisible" title="管理省份 / 分类" width="640px" destroy-on-close>
      <el-tabs v-model="dictTab">
        <el-tab-pane label="省份" name="province">
          <DictManager type="province" :rows="provinces" @changed="fetchDicts" />
        </el-tab-pane>
        <el-tab-pane label="分类" name="category">
          <DictManager type="category" :rows="categories" @changed="fetchDicts" />
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 新建 / 编辑工具包弹窗 -->
    <el-dialog
      v-model="formDialogVisible"
      title="新建工具包"
      width="860px"
      destroy-on-close
      top="5vh"
    >
      <el-form :model="form" label-width="80px" label-position="top">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          <el-form-item label="名称" required>
            <el-input v-model="form.name" placeholder="工具包名称" maxlength="100" />
          </el-form-item>
          <el-form-item label="省份" required>
            <el-select v-model="form.provinceId" placeholder="选择省份" class="w-full">
              <el-option v-for="d in activeProvinces" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="分类" required>
            <el-select v-model="form.categoryId" placeholder="选择分类" class="w-full">
              <el-option v-for="d in activeCategories" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item label="一句话简介">
          <el-input v-model="form.summary" placeholder="选填，展示在卡片上" maxlength="200" />
        </el-form-item>
        <el-form-item label="说明文档（Markdown，支持粘贴/上传图片）">
          <MarkdownEditor v-model="form.docMarkdown" height="380px" class="w-full" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="formSaving" @click="submitPackage">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useAuthStore } from "../stores/auth";
import { listDicts, listPackages, createPackage } from "../api/toolkit";
import MarkdownEditor from "../components/MarkdownEditor.vue";
import DictManager from "../components/DictManager.vue";

const authStore = useAuthStore();

// 字典
const provinces = ref([]);
const categories = ref([]);
const activeProvinces = computed(() => provinces.value.filter((d) => d.isActive));
const activeCategories = computed(() => categories.value.filter((d) => d.isActive));

async function fetchDicts() {
  try {
    const [p, c] = await Promise.all([listDicts("province"), listDicts("category")]);
    provinces.value = p || [];
    categories.value = c || [];
  } catch (e) { /* 拦截器已处理 */ }
}

// 列表
const packages = ref([]);
const loading = ref(false);
const page = ref(1);
const pageSize = ref(12);
const total = ref(0);
const keyword = ref("");
const filters = reactive({ provinceId: "", categoryId: "" });

let searchTimer = null;
function handleSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { page.value = 1; fetchPackages(); }, 300);
}
function handleFilterChange() {
  page.value = 1;
  fetchPackages();
}
function handleSizeChange() {
  page.value = 1;
  fetchPackages();
}

async function fetchPackages() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (keyword.value) params.keyword = keyword.value;
    if (filters.provinceId) params.provinceId = filters.provinceId;
    if (filters.categoryId) params.categoryId = filters.categoryId;
    const data = await listPackages(params);
    packages.value = data.rows || [];
    total.value = data.count || 0;
  } catch (e) { /* 拦截器已处理 */ } finally {
    loading.value = false;
  }
}

function formatTime(t) {
  if (!t) return "-";
  const d = new Date(t);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 字典弹窗
const dictDialogVisible = ref(false);
const dictTab = ref("province");
function openDictDialog() {
  dictTab.value = "province";
  dictDialogVisible.value = true;
}

// 新建表单
const formDialogVisible = ref(false);
const formSaving = ref(false);
const form = reactive({
  name: "", provinceId: "", categoryId: "", summary: "", docMarkdown: "",
});

function openPackageForm() {
  form.name = "";
  form.provinceId = "";
  form.categoryId = "";
  form.summary = "";
  form.docMarkdown = "";
  formDialogVisible.value = true;
}

async function submitPackage() {
  if (!form.name.trim()) return ElMessage.warning("请填写名称");
  if (!form.provinceId) return ElMessage.warning("请选择省份");
  if (!form.categoryId) return ElMessage.warning("请选择分类");
  formSaving.value = true;
  try {
    await createPackage({
      name: form.name.trim(),
      provinceId: form.provinceId,
      categoryId: form.categoryId,
      summary: form.summary,
      docMarkdown: form.docMarkdown,
    });
    ElMessage.success("已创建");
    formDialogVisible.value = false;
    fetchPackages();
  } catch (e) { /* 拦截器已处理 */ } finally {
    formSaving.value = false;
  }
}

onMounted(() => {
  fetchDicts();
  fetchPackages();
});
</script>

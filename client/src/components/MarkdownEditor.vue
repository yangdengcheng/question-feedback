<template>
  <div class="md-wrap">
    <MdEditor
      :model-value="modelValue"
      :theme="theme"
      :preview-theme="theme"
      :code-theme="theme === 'dark' ? 'atom' : 'github'"
      :style="{ height }"
      @update:model-value="(v) => emit('update:modelValue', v)"
      @on-upload-img="onUploadImg"
    />
  </div>
</template>

<script setup>
import { MdEditor } from "md-editor-v3";
import "md-editor-v3/lib/style.css";
import { ElMessage } from "element-plus";
import request from "../api/request";
import { useTheme } from "../composables/useTheme";

const { theme } = useTheme();

defineProps({
  modelValue: { type: String, default: "" },
  height: { type: String, default: "420px" },
});

const emit = defineEmits(["update:modelValue"]);

// 图片上传：复用现有 /api/upload，取得可内联访问的 url 后回填文档
async function onUploadImg(files, callback) {
  const urls = [];
  for (const file of files) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const data = await request.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      // filePath 可能为绝对路径，取文件名拼静态资源 url（/uploads 已静态托管）
      const name = String(data.filePath).replace(/\\/g, "/").split("/").pop();
      const url = `/uploads/${name}`;
      urls.push({ url, alt: file.name, title: file.name });
    } catch (error) {
      ElMessage.error(`${file.name} 上传失败`);
    }
  }
  callback(urls);
}
</script>

<style scoped>
.md-wrap :deep(.md-editor) {
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-m);
  background: var(--surface);
}
.md-wrap :deep(.md-editor-content) {
  background: var(--surface);
}
</style>

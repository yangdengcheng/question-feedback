<template>
  <div>
    <el-upload
      drag
      :auto-upload="true"
      :http-request="handleUpload"
      :show-file-list="false"
      :accept="acceptTypes"
      multiple
    >
      <el-icon class="el-icon--upload text-indigo-400" :size="40"
        ><UploadFilled
      /></el-icon>
      <div class="el-upload__text text-slate-400">
        拖拽文件到此处，或 <em class="text-indigo-400">点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip text-slate-500">
          支持 jpg/png/gif/mp4/pdf/doc/docx/xls/xlsx/zip/rar，单文件不超过 10MB
        </div>
      </template>
    </el-upload>

    <div v-if="fileList.length > 0" class="mt-3 space-y-2">
      <div
        v-for="file in fileList"
        :key="file.id"
        class="flex items-center justify-between glass-card-static px-4 py-2 rounded-lg"
      >
        <div class="flex items-center gap-3 min-w-0">
          <el-image
            v-if="file.fileType.startsWith('image/')"
            :src="`/api/attachments/${file.id}`"
            :preview-src-list="[`/api/attachments/${file.id}`]"
            class="w-10 h-10 rounded object-cover"
            fit="cover"
          />
          <el-icon v-else :size="20" class="text-slate-400"
            ><Document
          /></el-icon>
          <span class="text-sm text-slate-300 truncate">{{
            file.fileName
          }}</span>
          <span class="text-xs text-slate-500">{{
            formatSize(file.fileSize)
          }}</span>
        </div>
        <el-button type="danger" text size="small" @click="removeFile(file.id)">
          <el-icon><Delete /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
import request from "../api/request";

const emit = defineEmits(["update:attachmentIds"]);

const fileList = ref([]);
const acceptTypes =
  ".jpg,.jpeg,.png,.gif,.mp4,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar";

async function handleUpload(options) {
  const formData = new FormData();
  formData.append("file", options.file);

  try {
    const data = await request.post("/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    fileList.value.push(data);
    emitIds();
    ElMessage.success(`${options.file.name} 上传成功`);
  } catch (error) {
    ElMessage.error(`${options.file.name} 上传失败`);
  }
}

function removeFile(id) {
  fileList.value = fileList.value.filter((f) => f.id !== id);
  emitIds();
}

function emitIds() {
  emit(
    "update:attachmentIds",
    fileList.value.map((f) => f.id),
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
</script>

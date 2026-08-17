<template>
  <div class="outline-none" :class="{ 'fu-compact': compact }">
    <!-- 紧凑模式：评论区等轻量场景，仅一个附件按钮 + 横向 chip -->
    <template v-if="compact">
      <el-upload :auto-upload="false" :show-file-list="false" :accept="acceptTypes" multiple
        :on-change="handleFileSelect">
        <button type="button" class="btn-ghost fu-attach">
          <el-icon><Paperclip /></el-icon>
          附件
          <span v-if="fileList.length" class="tnum fu-attach__count">{{ fileList.length }}</span>
        </button>
      </el-upload>

      <div v-if="fileList.length > 0" class="fu-chips">
        <span v-for="file in fileList" :key="file.uid" class="fu-chip">
          <img v-if="file.previewUrl" :src="file.previewUrl" class="fu-chip__thumb"
            @click="openPreview(fileList.indexOf(file))" />
          <el-icon v-else :size="13" class="text-ink-text-2 shrink-0"><Document /></el-icon>
          <span class="fu-chip__name">{{ file.name }}</span>
          <button type="button" class="fu-chip__x" @click="removeFile(file.uid)" aria-label="移除附件">
            <el-icon :size="12"><Close /></el-icon>
          </button>
        </span>
      </div>
    </template>

    <!-- 默认模式：拖拽上传 -->
    <template v-else>
      <el-upload drag :auto-upload="false" :show-file-list="false" :accept="acceptTypes" multiple
        :on-change="handleFileSelect">
        <el-icon class="el-icon--upload text-accent-text" :size="40">
          <UploadFilled />
        </el-icon>
        <div class="el-upload__text text-ink-text-2">
          拖拽文件到此处，或 <em class="text-accent-text">点击选择</em>，或 <em class="text-st-processing">Ctrl+V 粘贴截图</em>
        </div>
        <template #tip>
          <div class="el-upload__tip text-ink-text-3">
            支持 jpg/png/gif/mp4/pdf/doc/docx/xls/xlsx/zip/rar，单文件不超过 10MB。文件将在提交时上传。
          </div>
        </template>
      </el-upload>

      <div v-if="fileList.length > 0" class="mt-3 space-y-2">
        <div v-for="file in fileList" :key="file.uid"
          class="flex items-center justify-between panel px-4 py-2 rounded-lg">
          <div class="flex items-center gap-3 min-w-0">
            <img v-if="file.previewUrl" :src="file.previewUrl"
              class="w-10 h-10 rounded object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              @click="openPreview(fileList.indexOf(file))"
            />
            <el-icon v-else :size="20" class="text-ink-text-2 shrink-0"><Document /></el-icon>
            <span class="text-sm text-ink-text truncate">{{ file.name }}</span>
            <span class="text-xs text-ink-text-3">{{ formatSize(file.size) }}</span>
            <el-tag v-if="file.uploaded" type="success" size="small" effect="plain">已上传</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">待上传</el-tag>
          </div>
          <el-button type="danger" text size="small" @click="removeFile(file.uid)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>
    </template>

    <ImageViewer v-model:visible="previewVisible" :images="previewImages" :initial-index="previewIndex" />
  </div>
</template>

<script>
// Module-level singleton paste handler
const pasteHandlers = new Set();
let globalListenerAttached = false;

function globalPasteListener(event) {
  const tag = event.target?.tagName?.toLowerCase();
  const inTextField = tag === "input" || tag === "textarea";
  if (inTextField) {
    // 焦点在输入框内：先探测剪贴板内容——含图片（截图）才接管，
    // 纯文本粘贴不拦截，保持浏览器默认插入行为
    const items = event.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        hasImage = true;
        break;
      }
    }
    if (!hasImage) return;
  }
  const handlers = [...pasteHandlers];
  if (handlers.length > 0) {
    handlers[handlers.length - 1](event);
  }
}

function ensureGlobalListener() {
  if (!globalListenerAttached) {
    document.addEventListener("paste", globalPasteListener);
    globalListenerAttached = true;
  }
}

function removeGlobalListenerIfEmpty() {
  if (pasteHandlers.size === 0 && globalListenerAttached) {
    document.removeEventListener("paste", globalPasteListener);
    globalListenerAttached = false;
  }
}
</script>

<script setup>
import { ref, computed, onMounted, onUnmounted } from "vue";
import { ElMessage } from "element-plus";
import request from "../api/request";
import ImageViewer from "./ImageViewer.vue";

defineProps({
  compact: { type: Boolean, default: false },
});

const MAX_SIZE = 10 * 1024 * 1024;
const acceptTypes = ".jpg,.jpeg,.png,.gif,.mp4,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar";

// Each item: { uid, file: File, name, size, type, previewUrl, uploaded, serverId }
const fileList = ref([]);
let uidCounter = 0;

function addFile(file) {
  if (file.size > MAX_SIZE) {
    ElMessage.error(`${file.name} 超过 10MB 限制`);
    return;
  }
  const uid = ++uidCounter;
  const isImage = file.type.startsWith("image/");
  fileList.value.push({
    uid,
    file,
    name: file.name,
    size: file.size,
    type: file.type,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
    uploaded: false,
    serverId: null,
  });
}

function handleFileSelect(uploadFile) {
  addFile(uploadFile.raw);
}

function myPasteHandler(event) {
  const items = event.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith("image/")) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const namedFile = new File([file], `screenshot-${Date.now()}.png`, { type: file.type });
        addFile(namedFile);
      }
      break;
    }
  }
}

function removeFile(uid) {
  const idx = fileList.value.findIndex((f) => f.uid === uid);
  if (idx !== -1) {
    const f = fileList.value[idx];
    if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    fileList.value.splice(idx, 1);
  }
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Called by parent when submitting — uploads all pending files, returns array of server IDs
async function uploadAll() {
  const ids = [];
  for (const item of fileList.value) {
    if (item.uploaded && item.serverId) {
      ids.push(item.serverId);
      continue;
    }
    const formData = new FormData();
    formData.append("file", item.file);
    try {
      const data = await request.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      item.uploaded = true;
      item.serverId = data.id;
      ids.push(data.id);
    } catch (error) {
      ElMessage.error(`${item.name} 上传失败`);
      throw error; // Abort submission
    }
  }
  return ids;
}

// Reset the component (clear all files)
function reset() {
  fileList.value.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
  fileList.value = [];
}

// Image preview
const previewVisible = ref(false);
const previewIndex = ref(0);
const previewImages = computed(() =>
  fileList.value.filter(f => f.previewUrl).map(f => ({ url: f.previewUrl, name: f.name }))
);
function openPreview(fileIdx) {
  const imageItems = fileList.value.filter(f => f.previewUrl);
  const clickedFile = fileList.value[fileIdx];
  const imgIdx = imageItems.indexOf(clickedFile);
  if (imgIdx >= 0) {
    previewIndex.value = imgIdx;
    previewVisible.value = true;
  }
}

defineExpose({ uploadAll, reset });

onMounted(() => {
  pasteHandlers.add(myPasteHandler);
  ensureGlobalListener();
});

onUnmounted(() => {
  pasteHandlers.delete(myPasteHandler);
  removeGlobalListenerIfEmpty();
  fileList.value.forEach((f) => { if (f.previewUrl) URL.revokeObjectURL(f.previewUrl); });
});
</script>

<style scoped>
.fu-attach {
  height: 32px;
  padding: 0 12px;
}
.fu-attach__count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  margin-left: 2px;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 700;
}
.fu-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}
.fu-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 200px;
  height: 26px;
  padding: 0 4px 0 8px;
  border: 1px solid var(--line-strong);
  border-radius: 4px;
  background: rgba(11, 17, 32, 0.5);
  font-size: 12px;
  color: var(--text-2);
  transition: border-color 0.15s ease;
}
.fu-chip:hover {
  border-color: rgba(148, 163, 184, 0.35);
}
.fu-chip__thumb {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  object-fit: cover;
  cursor: pointer;
}
.fu-chip__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fu-chip__x {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--text-3);
  border-radius: 3px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}
.fu-chip__x:hover {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}
</style>

<template>
  <div>
    <!-- 新增 -->
    <div class="flex items-center gap-2 mb-4">
      <el-input v-model="draft.code" placeholder="编码(如 anhui)" class="w-36" maxlength="50" />
      <el-input v-model="draft.name" placeholder="名称(如 安徽)" class="w-40" maxlength="100" />
      <el-input-number v-model="draft.sort" :min="0" controls-position="right" class="w-28" />
      <el-button type="primary" :icon="Plus" @click="handleAdd">添加</el-button>
    </div>

    <!-- 列表 -->
    <div v-if="rows.length === 0" class="text-center text-ink-text-3 py-8 text-sm">暂无数据</div>
    <div v-else class="space-y-2">
      <div
        v-for="item in rows"
        :key="item.id"
        class="flex items-center gap-3 panel px-3 py-2"
      >
        <template v-if="editingId === item.id">
          <el-input v-model="editDraft.code" class="w-32" maxlength="50" />
          <el-input v-model="editDraft.name" class="w-36" maxlength="100" />
          <el-input-number v-model="editDraft.sort" :min="0" controls-position="right" class="w-28" />
          <div class="ml-auto flex items-center gap-2">
            <el-button size="small" type="primary" @click="saveEdit(item)">保存</el-button>
            <el-button size="small" @click="editingId = null">取消</el-button>
          </div>
        </template>
        <template v-else>
          <span class="text-sm text-ink-text w-32 truncate">{{ item.name }}</span>
          <span class="badge tnum">{{ item.code }}</span>
          <span class="text-xs text-ink-text-3 tnum">排序 {{ item.sort }}</span>
          <div class="ml-auto flex items-center gap-3">
            <el-switch
              :model-value="item.isActive"
              size="small"
              inline-prompt
              active-text="启用"
              inactive-text="停用"
              @change="(v) => toggleActive(item, v)"
            />
            <el-button size="small" text :icon="Edit" @click="startEdit(item)" />
            <el-button size="small" text type="danger" :icon="Delete" @click="handleDelete(item)" />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { Plus, Edit, Delete } from "@element-plus/icons-vue";
import { createDict, updateDict, deleteDict } from "../api/toolkit";

const props = defineProps({
  type: { type: String, required: true },
  rows: { type: Array, default: () => [] },
});
const emit = defineEmits(["changed"]);

const draft = reactive({ code: "", name: "", sort: 0 });

async function handleAdd() {
  if (!draft.code.trim() || !draft.name.trim()) {
    return ElMessage.warning("请填写编码和名称");
  }
  try {
    await createDict({ type: props.type, code: draft.code.trim(), name: draft.name.trim(), sort: draft.sort });
    ElMessage.success("已添加");
    draft.code = "";
    draft.name = "";
    draft.sort = 0;
    emit("changed");
  } catch (e) { /* 拦截器已处理 */ }
}

const editingId = ref(null);
const editDraft = reactive({ code: "", name: "", sort: 0 });

function startEdit(item) {
  editingId.value = item.id;
  editDraft.code = item.code;
  editDraft.name = item.name;
  editDraft.sort = item.sort;
}

async function saveEdit(item) {
  if (!editDraft.code.trim() || !editDraft.name.trim()) {
    return ElMessage.warning("请填写编码和名称");
  }
  try {
    await updateDict(item.id, { code: editDraft.code.trim(), name: editDraft.name.trim(), sort: editDraft.sort });
    ElMessage.success("已保存");
    editingId.value = null;
    emit("changed");
  } catch (e) { /* 拦截器已处理 */ }
}

async function toggleActive(item, val) {
  try {
    await updateDict(item.id, { isActive: val });
    emit("changed");
  } catch (e) { /* 拦截器已处理 */ }
}

async function handleDelete(item) {
  try {
    await ElMessageBox.confirm(`确定删除「${item.name}」吗？`, "提示", { type: "warning" });
  } catch (_) { return; }
  try {
    await deleteDict(item.id);
    ElMessage.success("已删除");
    emit("changed");
  } catch (e) { /* 拦截器已处理(含被引用 409) */ }
}
</script>

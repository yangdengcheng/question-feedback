<template>
  <el-tag :type="tagType" size="small" effect="dark" round>
    {{ label }}
  </el-tag>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  status: {
    type: String,
    required: true,
  },
});

const statusMap = {
  pending: { label: "待处理", type: "warning" },
  processing: { label: "处理中", type: "primary" },
  resolved: { label: "已解决", type: "success" },
  closed: { label: "已关闭", type: "info" },
};

const label = computed(() => statusMap[props.status]?.label || props.status);
const tagType = computed(() => statusMap[props.status]?.type || "info");
</script>

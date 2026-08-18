<template>
  <div class="max-w-6xl mx-auto">
    <div class="mb-6">
      <router-link to="/" class="text-sm text-ink-text-3 hover:text-ink-text-2 transition-colors">
        ← 返回工单列表
      </router-link>
    </div>

    <TicketDetailPanel :ticket-id="route.params.id" />
  </div>
</template>

<script setup>
import { useRoute } from "vue-router";
import TicketDetailPanel from "../components/TicketDetailPanel.vue";

const route = useRoute();
</script>

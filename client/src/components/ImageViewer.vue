<template>
  <Teleport to="body">
    <Transition name="viewer-fade">
      <div v-if="visible" class="image-viewer-overlay" @click.self="close" @wheel.prevent="onWheel">
        <!-- Top bar -->
        <div class="viewer-topbar">
          <span class="viewer-counter" v-if="images.length > 1">{{ currentIndex + 1 }} / {{ images.length }}</span>
          <span class="viewer-filename">{{ currentImage?.name || '' }}</span>
          <div class="viewer-topbar-actions">
            <button class="viewer-btn" @click="zoomIn" title="放大">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/><line x1="11" y1="8" x2="11" y2="14"/></svg>
            </button>
            <button class="viewer-btn" @click="zoomOut" title="缩小">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button class="viewer-btn" @click="resetZoom" title="适应窗口">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
            </button>
            <button class="viewer-btn viewer-btn-close" @click="close" title="关闭 (Esc)">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- Navigation arrows -->
        <button v-if="images.length > 1 && currentIndex > 0" class="viewer-nav viewer-nav-left" @click="prev">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button v-if="images.length > 1 && currentIndex < images.length - 1" class="viewer-nav viewer-nav-right" @click="next">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <!-- Image container -->
        <div class="viewer-image-wrap"
          @mousedown.prevent="onDragStart"
          @mousemove="onDragMove"
          @mouseup="onDragEnd"
          @mouseleave="onDragEnd"
        >
          <Transition name="viewer-img-switch" mode="out-in">
            <img
              :key="currentIndex"
              :src="currentImage?.url"
              class="viewer-image"
              :style="imageStyle"
              draggable="false"
              @load="onImageLoad"
            />
          </Transition>
        </div>

        <!-- Bottom info bar -->
        <div class="viewer-bottombar">
          <span class="viewer-zoom-level">{{ Math.round(scale * 100) }}%</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from "vue";

const props = defineProps({
  visible: { type: Boolean, default: false },
  images: { type: Array, default: () => [] },  // [{ url, name? }]
  initialIndex: { type: Number, default: 0 },
});

const emit = defineEmits(["update:visible", "close"]);

const currentIndex = ref(0);
const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const dragging = ref(false);
const dragStart = ref({ x: 0, y: 0, tx: 0, ty: 0 });

const currentImage = computed(() => props.images[currentIndex.value] || null);

const imageStyle = computed(() => ({
  transform: `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`,
  cursor: scale.value > 1 ? (dragging.value ? "grabbing" : "grab") : "default",
}));

watch(() => props.visible, (val) => {
  if (val) {
    currentIndex.value = props.initialIndex;
    resetZoom();
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = "";
  }
});

watch(() => props.initialIndex, (val) => {
  if (props.visible) {
    currentIndex.value = val;
    resetZoom();
  }
});

function close() {
  emit("update:visible", false);
  emit("close");
}

function prev() {
  if (currentIndex.value > 0) { currentIndex.value--; resetZoom(); }
}

function next() {
  if (currentIndex.value < props.images.length - 1) { currentIndex.value++; resetZoom(); }
}

function zoomIn() { scale.value = Math.min(scale.value * 1.25, 10); }
function zoomOut() { scale.value = Math.max(scale.value / 1.25, 0.1); }
function resetZoom() { scale.value = 1; translateX.value = 0; translateY.value = 0; }

function onWheel(e) {
  const delta = e.deltaY > 0 ? 0.9 : 1.1;
  scale.value = Math.min(Math.max(scale.value * delta, 0.1), 10);
  if (scale.value <= 1) { translateX.value = 0; translateY.value = 0; }
}

function onDragStart(e) {
  if (scale.value <= 1) return;
  dragging.value = true;
  dragStart.value = { x: e.clientX, y: e.clientY, tx: translateX.value, ty: translateY.value };
}

function onDragMove(e) {
  if (!dragging.value) return;
  translateX.value = dragStart.value.tx + (e.clientX - dragStart.value.x);
  translateY.value = dragStart.value.ty + (e.clientY - dragStart.value.y);
}

function onDragEnd() { dragging.value = false; }

function onImageLoad() { /* could compute fit scale here if needed */ }

function onKeydown(e) {
  if (!props.visible) return;
  switch (e.key) {
    case "Escape": close(); break;
    case "ArrowLeft": prev(); break;
    case "ArrowRight": next(); break;
    case "+": case "=": zoomIn(); break;
    case "-": zoomOut(); break;
    case "0": resetZoom(); break;
  }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => {
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<style scoped>
.image-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.92);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}

.viewer-topbar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 52px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%);
  z-index: 2;
}

.viewer-counter {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  font-variant-numeric: tabular-nums;
  margin-right: 12px;
  min-width: 40px;
}

.viewer-filename {
  font-size: 13px;
  color: rgba(255,255,255,0.8);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.viewer-topbar-actions {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.viewer-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.8);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.viewer-btn:hover {
  background: rgba(255,255,255,0.18);
  color: #fff;
}
.viewer-btn-close:hover {
  background: rgba(239, 68, 68, 0.5);
}

.viewer-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s;
  z-index: 2;
}
.viewer-nav:hover {
  background: rgba(255,255,255,0.15);
  color: #fff;
}
.viewer-nav-left { left: 16px; }
.viewer-nav-right { right: 16px; }

.viewer-image-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.viewer-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  transition: transform 0.15s ease-out;
  border-radius: 4px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5);
}

.viewer-bottombar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 100%);
  z-index: 2;
}

.viewer-zoom-level {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  font-variant-numeric: tabular-nums;
}

/* Transitions */
.viewer-fade-enter-active,
.viewer-fade-leave-active {
  transition: opacity 0.25s ease;
}
.viewer-fade-enter-from,
.viewer-fade-leave-to {
  opacity: 0;
}

.viewer-img-switch-enter-active,
.viewer-img-switch-leave-active {
  transition: opacity 0.2s ease;
}
.viewer-img-switch-enter-from,
.viewer-img-switch-leave-to {
  opacity: 0;
}
</style>

<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">🎨 Цвета заливки</div>
    </q-card-section>

    <q-card-section>
      <div class="row q-gutter-sm">
        <q-btn
          color="primary"
          label="🔍 Сканировать цвета"
          @click="handleScanClick"
          :loading="loading"
        />
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-table
        :rows="colors"
        :columns="columns"
        row-key="code"
        :loading="loading"
        dense
        flat
        bordered
      >
        <template v-slot:body-cell-color="props">
          <q-td :props="props">
            <div
              class="color-circle"
              :style="{ backgroundColor: props.row.hex }"
            />
          </q-td>
        </template>

        <template v-slot:body-cell-selected="props">
          <q-td :props="props">
            <q-checkbox v-model="props.row.selected" />
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref } from "vue";
import { useQuasar } from "quasar";
import api from "../services/api.js";

const $q = useQuasar();
const loading = ref(false);
const colors = ref([]);
const currentPaths = ref([]);

const columns = [
  {
    name: "color",
    label: "Цвет",
    field: "hex",
    align: "center",
    sortable: true,
  },
  {
    name: "name",
    label: "Название",
    field: "name",
    align: "left",
    sortable: true,
  },
  { name: "hex", label: "HEX", field: "hex", align: "left", sortable: true },
  {
    name: "count",
    label: "Ячеек",
    field: "count",
    align: "center",
    sortable: true,
  },
  { name: "selected", label: "Выбрать", field: "selected", align: "center" },
];

function handleScanClick() {
  scanColors(currentPaths.value);
}

async function scanColors(paths) {
  // Преобразуем в массив строк, чтобы избежать ошибки клонирования Vue-реактивности
  const pathsToScan = Array.isArray(paths) 
    ? paths.map(p => typeof p === 'object' && p.path ? p.path : p) 
    : [];

  if (pathsToScan.length === 0) {
    $q.notify({ color: "warning", message: "Сначала выберите файлы!" });
    return;
  }

  currentPaths.value = pathsToScan;
  loading.value = true;
  try {
    const response = await api.scanColors(pathsToScan);
    colors.value = response.colors.map((c) => ({
      ...c,
      selected: isDefaultSelected(c.code),
    }));
    $q.notify({
      color: "positive",
      message: `Найдено ${colors.value.length} цветов`,
    });
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка сканирования: " + error.message,
    });
  } finally {
    loading.value = false;
  }
}

function isDefaultSelected(code) {
  const orange = ["FF9933", "FFCC99", "FFB366", "FF8000", "FFA500", "FF9966"];
  const blue = ["99CCFF", "B3D9FF", "66B2FF", "0099FF", "ADD8E6", "87CEEB"];
  return orange.includes(code) || blue.includes(code);
}

function selectOrange() {
  const orange = ["FF9933", "FFCC99", "FFB366", "FF8000", "FFA500", "FF9966"];
  colors.value.forEach((c) => {
    if (orange.includes(c.code)) c.selected = true;
  });
}

function selectBlue() {
  const blue = ["99CCFF", "B3D9FF", "66B2FF", "0099FF", "ADD8E6", "87CEEB"];
  colors.value.forEach((c) => {
    if (blue.includes(c.code)) c.selected = true;
  });
}

function selectAll() {
  colors.value.forEach((c) => (c.selected = true));
}

function deselectAll() {
  colors.value.forEach((c) => (c.selected = false));
}

defineExpose({
  colors,
  scanColors,
});
</script>

<style scoped>
.color-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid #ccc;
  display: inline-block;
}
</style>

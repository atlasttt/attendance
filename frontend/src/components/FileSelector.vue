<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">📁 Файлы отчётности</div>
    </q-card-section>

    <q-card-section>
      <div class="row q-gutter-md items-end">
        <div class="col text-subtitle2">Выбрано файлов: {{ files.length }}</div>
        <div>
          <q-btn
            color="primary"
            label="Добавить файлы"
            icon="add"
            @click="triggerFileInput"
          />
          <input
            ref="fileInput"
            type="file"
            multiple
            accept=".xlsx,.xls"
            style="display: none"
            @change="onFileSelect"
          />
        </div>
        <div>
          <q-btn
            color="warning"
            label="Очистить все"
            icon="delete"
            @click="clearAll"
            :disable="files.length === 0"
          />
        </div>
      </div>

      <!-- Drag & Drop зона -->
      <div
        class="q-mt-md drop-zone"
        :class="{ 'drop-zone--active': isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="onDrop"
      >
        <div class="text-center text-caption text-grey-7">
          Перетащите Excel-файлы сюда
        </div>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section v-if="files.length > 0">
      <q-table
        :rows="files"
        :columns="columns"
        row-key="id"
        dense
        flat
        bordered
        :pagination="{ rowsPerPage: 10 }"
      >
        <template v-slot:body-cell-filename="props">
          <q-td :props="props">
            {{ props.row.file.name }}
          </q-td>
        </template>

        <template v-slot:body-cell-period="props">
          <q-td :props="props">
            <div class="row q-gutter-xs items-center">
              <q-select
                v-model="props.row.month"
                :options="months"
                dense
                outlined
                style="width: 110px"
                @update:model-value="onPeriodChange"
              >
                <template v-slot:prepend>
                  <q-icon name="calendar_today" size="xs" />
                </template>
              </q-select>
              <q-select
                v-model="props.row.year"
                :options="years"
                dense
                outlined
                style="width: 110px"
                @update:model-value="onPeriodChange"
              >
                <template v-slot:prepend>
                  <q-icon name="event" size="xs" />
                </template>
              </q-select>
            </div>
          </q-td>
        </template>

        <template v-slot:body-cell-remove="props">
          <q-td :props="props" auto-width>
            <q-btn
              flat
              dense
              color="negative"
              icon="close"
              @click="removeFile(props.row.id)"
            />
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, defineEmits } from "vue";
import { useQuasar } from "quasar";

const emit = defineEmits(["files-changed"]);
const $q = useQuasar();

const fileInput = ref(null);
const files = ref([]);
const isDragging = ref(false);

const columns = [
  {
    name: "filename",
    label: "Файл",
    field: "file",
    align: "left",
    sortable: true,
  },
  {
    name: "period",
    label: "Период",
    field: "period",
    align: "left",
    sortable: true,
  },
  { name: "remove", label: "", field: "id", align: "center" },
];

const months = ref([
  { label: "Январь", value: "01" },
  { label: "Февраль", value: "02" },
  { label: "Март", value: "03" },
  { label: "Апрель", value: "04" },
  { label: "Май", value: "05" },
  { label: "Июнь", value: "06" },
  { label: "Июль", value: "07" },
  { label: "Август", value: "08" },
  { label: "Сентябрь", value: "09" },
  { label: "Октябрь", value: "10" },
  { label: "Ноябрь", value: "11" },
  { label: "Декабрь", value: "12" },
]);

const years = ref(["2024", "2025", "2026", "2027", "2028", "2029", "2030"]);

function getDefaultPeriod(filename) {
  const name = filename.toUpperCase();

  const monthMap = {
    ЯНВАРЬ: "01",
    ФЕВРАЛЬ: "02",
    МАРТ: "03",
    АПРЕЛЬ: "04",
    МАЙ: "05",
    ИЮНЬ: "06",
    ИЮЛЬ: "07",
    АВГУСТ: "08",
    СЕНТЯБРЬ: "09",
    ОКТЯБРЬ: "10",
    НОЯБРЬ: "11",
    ДЕКАБРЬ: "12",
    JAN: "01",
    FEB: "02",
    MAR: "03",
    APR: "04",
    MAY: "05",
    JUN: "06",
    JUL: "07",
    AUG: "08",
    SEP: "09",
    OCT: "10",
    NOV: "11",
    DEC: "12",
  };

  let month = String(new Date().getMonth() + 1).padStart(2, "0");
  for (const [key, num] of Object.entries(monthMap)) {
    if (name.includes(key)) {
      month = num;
      break;
    }
  }

  let year = String(new Date().getFullYear());
  const yearMatch = name.match(/20\d{2}/);
  if (yearMatch) {
    year = yearMatch[0];
  }

  return { month, year };
}

function triggerFileInput() {
  fileInput.value.click();
}

function onFileSelect(event) {
  const selectedFiles = Array.from(event.target.files);
  addFiles(selectedFiles);
  // Сбрасываем input, чтобы можно было выбрать те же файлы
  event.target.value = '';
}

function onDrop(event) {
  isDragging.value = false;
  const droppedFiles = Array.from(event.dataTransfer.files).filter(
    file => file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  );
  addFiles(droppedFiles);
}

function addFiles(newFiles) {
  if (newFiles.length === 0) {
    $q.notify({
      color: "warning",
      message: "Выберите Excel-файлы (.xlsx)",
    });
    return;
  }

  for (const file of newFiles) {
    if (!files.value.find((f) => f.file.name === file.name && f.file.size === file.size)) {
      const period = getDefaultPeriod(file.name);
      files.value.push({
        file,
        month: period.month,
        year: period.year,
        id: Date.now() + Math.random(),
      });
    }
  }
  emitFilesChanged();
}

function removeFile(id) {
  files.value = files.value.filter((f) => f.id !== id);
  emitFilesChanged();
}

function clearAll() {
  files.value = [];
  emitFilesChanged();
}

function onPeriodChange() {
  emitFilesChanged();
}

function emitFilesChanged() {
  emit("files-changed", files.value);
}

defineExpose({
  files,
});
</script>

<style scoped>
.drop-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s;
  cursor: pointer;
}

.drop-zone--active {
  border-color: var(--q-primary);
  background: rgba(var(--q-primary), 0.1);
}
</style>

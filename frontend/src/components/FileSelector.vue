<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">📁 Файлы отчётности</div>
    </q-card-section>

    <q-card-section>
      <div class="row q-gutter-md items-end">
        <div class="col text-subtitle2">
          Выбрано файлов: {{ files.length }}
        </div>
        <div>
          <q-btn
            color="primary"
            label="Добавить файлы"
            icon="add"
            @click="selectFiles"
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
    </q-card-section>

    <q-separator />

    <q-card-section v-if="files.length > 0">
      <q-table
        :rows="files"
        :columns="columns"
        row-key="path"
        dense
        flat
        bordered
        :pagination="{ rowsPerPage: 10 }"
      >
        <template v-slot:body-cell-filename="props">
          <q-td :props="props">
            {{ props.row.path.split('/').pop() }}
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
                style="width: 80px"
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
              @click="removeFile(props.row.path)"
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

const files = ref([]);

const columns = [
  { name: "filename", label: "Файл", field: "path", align: "left", sortable: true },
  { name: "period", label: "Период", field: "period", align: "left", sortable: true },
  { name: "remove", label: "", field: "path", align: "center" },
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
    ЯНВАРЬ: "01", ФЕВРАЛЬ: "02", МАРТ: "03", АПРЕЛЬ: "04",
    МАЙ: "05", ИЮНЬ: "06", ИЮЛЬ: "07", АВГУСТ: "08",
    СЕНТЯБРЬ: "09", ОКТЯБРЬ: "10", НОЯБРЬ: "11", ДЕКАБРЬ: "12",
    JAN: "01", FEB: "02", MAR: "03", APR: "04",
    MAY: "05", JUN: "06", JUL: "07", AUG: "08",
    SEP: "09", OCT: "10", NOV: "11", DEC: "12",
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

async function selectFiles() {
  try {
    const paths = await window.electronAPI.selectFiles();
    if (paths && paths.length > 0) {
      for (const path of paths) {
        if (!files.value.find(f => f.path === path)) {
          const filename = path.split('/').pop();
          const period = getDefaultPeriod(filename);
          files.value.push({ 
            path, 
            month: period.month, 
            year: period.year,
            id: Date.now() + Math.random() 
          });
        }
      }
      emitFilesChanged();
    }
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка выбора файлов: " + error.message,
    });
  }
}

function removeFile(path) {
  files.value = files.value.filter(f => f.path !== path);
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

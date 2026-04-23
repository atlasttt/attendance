<template>
  <q-card flat bordered>
    <q-card-section>
      <div class="text-h6">📈 Результаты</div>
    </q-card-section>

    <q-card-section>
      <div class="row q-gutter-sm items-center">
        <q-btn
          color="primary"
          label="📊 Посчитать по выбранным"
          @click="countSelected"
          :loading="loading"
        />
        <q-btn
          color="secondary"
          label="📋 Экспорт в Excel"
          @click="exportExcel"
        />
        <q-input
          v-model="searchQuery"
          label="Поиск"
          dense
          outlined
          clearable
          style="max-width: 300px"
        >
          <template v-slot:prepend>
            <q-icon name="search" />
          </template>
        </q-input>
      </div>
    </q-card-section>

    <q-separator />

    <q-card-section>
      <q-table
        :rows="filteredResults"
        :columns="columns"
        row-key="key"
        :loading="loading"
        :pagination="{ rowsPerPage: 0 }"
        flat
        bordered
      >
        <template v-slot:header="props">
          <q-tr :props="props">
            <q-th
              v-for="col in props.cols"
              :key="col.name"
              :props="props"
              :style="getColorHeaderStyle(col.name)"
            >
              {{ col.label }}
            </q-th>
          </q-tr>
        </template>

        <template v-slot:body-cell="props">
          <q-td :props="props" :style="getColorCellStyle(props.col.name)">
            <template v-if="props.col.name.startsWith('color_')">
              <span v-html="getCellValue(props.row, props.col.name)"></span>
            </template>
            <template v-else>
              {{ props.value }}
            </template>
          </q-td>
        </template>
      </q-table>
    </q-card-section>
  </q-card>
</template>

<script setup>
import { ref, computed } from "vue";
import { useQuasar } from "quasar";
import api from "../services/api.js";

const props = defineProps({
  colorTable: { type: Object, default: null },
  files: { type: Array, default: () => [] },
});

const $q = useQuasar();
const loading = ref(false);
const results = ref([]);
const colorCodes = ref([]);
const rawResults = ref([]); // Для экспорта — без агрегации
const searchQuery = ref("");
const periodValues = ref({}); // { employee: { colorCode: [val1, val2, val3] } }
const periods = ref([]); // Список периодов для отображения

const filteredResults = computed(() => {
  if (!searchQuery.value) return results.value;
  const query = searchQuery.value.toLowerCase();
  return results.value.filter(
    (r) =>
      r.employee?.toLowerCase().includes(query) ||
      r.position?.toLowerCase().includes(query),
  );
});

const columns = computed(() => {
  const base = [
    {
      name: "employee",
      label: "Сотрудник",
      field: "employee",
      align: "left",
      sortable: true,
      required: true,
    },
    {
      name: "position",
      label: "Должность",
      field: "position",
      align: "left",
      sortable: true,
    },
  ];

  // Динамические колонки для каждого цвета
  for (const code of colorCodes.value) {
    base.push({
      name: `color_${code}`,
      label: `#${code}`,
      field: (row) => row.colorCounts?.[code] || 0,
      align: "center",
      sortable: true,
      sort: (a, b) => {
        const valsA = periodValues.value[a.employee]?.[code] || [];
        const valsB = periodValues.value[b.employee]?.[code] || [];

        const lastA = valsA[valsA.length - 1] || 0;
        const prevA = valsA[valsA.length - 2] || 0;
        const trendA = lastA - prevA;

        const lastB = valsB[valsB.length - 1] || 0;
        const prevB = valsB[valsB.length - 2] || 0;
        const trendB = lastB - prevB;

        // 1. Sort by trend direction (Up > Stable > Down)
        if (trendA > trendB) return -1;
        if (trendA < trendB) return 1;

        // 2. Sort by last value (Descending)
        if (lastA > lastB) return -1;
        if (lastA < lastB) return 1;

        return 0;
      }
    });
  }

  return base;
});

function getColorHeaderStyle(colName) {
  if (colName.startsWith("color_")) {
    const code = colName.replace("color_", "");
    return {
      backgroundColor: `#${code}`,
      color: isLightColor(code) ? "#000" : "#fff",
      fontWeight: "bold",
    };
  }
  return {};
}

function isLightColor(hex) {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function getColorCellStyle(colName) {
  if (colName.startsWith("color_")) {
    return {
      fontWeight: "bold",
      textAlign: "center",
      whiteSpace: "nowrap",
    };
  }
  return {};
}

function getCellValue(row, colName) {
  const code = colName.replace("color_", "");
  const values = periodValues.value[row.employee]?.[code] || [];

  if (values.length === 0) return "0";
  if (values.length === 1) return `${values[0]}`;

  // Определяем цвет по разнице двух последних периодов
  const lastVal = values[values.length - 1];
  const prevVal = values[values.length - 2];
  const diff = lastVal - prevVal;

  let cellColor = "";
  if (diff > 0)
    cellColor = "#e53935"; // Красный — рост
  else if (diff < 0) cellColor = "#43a047"; // Зелёный — падение

  let html = "";
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    let arrowHtml = "";

    if (i > 0) {
      const prev = values[i - 1];
      const d = val - prev;

      if (d > 0)
        arrowHtml = `<span style="font-weight: 900; font-size: 1.6em; color: #e53935;"> ↑ </span>`;
      else if (d < 0)
        arrowHtml = `<span style="font-weight: 900; font-size: 1.6em; color: #43a047;"> ↓ </span>`;
      else
        arrowHtml = `<span style="font-weight: 900; font-size: 1em; color: #999;"> → </span>`;
    }

    html += arrowHtml;
    html += `<span style="color: ${cellColor}">${val}</span>`;
  }
  return html;
}

async function countSelected() {
  if (!props.colorTable || props.files.length === 0) {
    $q.notify({
      color: "warning",
      message: "Сначала выберите файлы!",
    });
    return;
  }

  loading.value = true;
  try {
    const selectedColors = props.colorTable.colors
      .filter((c) => c.selected)
      .map((c) => c.code);

    if (selectedColors.length === 0) {
      $q.notify({ color: "warning", message: "Выберите хотя бы один цвет!" });
      return;
    }

    // Для каждого файла вызываем подсчёт с его периодом
    const allResults = [];
    for (const file of props.files) {
      const response = await api.countSelected({
        filePaths: [file.path],
        month: file.month,
        year: file.year,
        colors: selectedColors,
      });
      if (response.results) {
        allResults.push(...response.results);
      }
      if (response.colorCodes) {
        colorCodes.value = response.colorCodes;
      }
    }

    // Сохраняем raw для экспорта
    rawResults.value = [...allResults];

    // Группируем по периодам
    const periodMap = {};
    for (const r of allResults) {
      const period = `${r.month}.${r.year}`;
      if (!periodMap[period]) {
        periodMap[period] = {};
      }
      const key = `${r.employee}|||${r.position}`;
      if (!periodMap[period][key]) {
        periodMap[period][key] = {
          employee: r.employee,
          position: r.position,
          colorCounts: {},
        };
        selectedColors.forEach(
          (c) => (periodMap[period][key].colorCounts[c] = 0),
        );
      }
      for (const c of selectedColors) {
        periodMap[period][key].colorCounts[c] += r.colorCounts?.[c] || 0;
      }
    }

    // Сортируем периоды
    const sortedPeriods = Object.keys(periodMap).sort((a, b) => {
      const [aMonth, aYear] = a.split(".").map(Number);
      const [bMonth, bYear] = b.split(".").map(Number);
      if (aYear !== bYear) return aYear - bYear;
      return aMonth - bMonth;
    });

    periods.value = sortedPeriods;

    // Формируем periodValues: { employee: { colorCode: [val1, val2, val3] } }
    const pValues = {};
    for (const empKey of Object.keys(periodMap[sortedPeriods[0]] || {})) {
      const emp = periodMap[sortedPeriods[0]][empKey];
      pValues[emp.employee] = {};
      for (const c of selectedColors) {
        pValues[emp.employee][c] = sortedPeriods.map((p) => {
          const periodEmp = periodMap[p]?.[empKey];
          return periodEmp?.colorCounts[c] || 0;
        });
      }
    }

    periodValues.value = pValues;

    // Агрегируем по сотруднику для UI
    const empMap = {};
    for (const r of allResults) {
      const key = `${r.employee}|||${r.position}`;
      if (!empMap[key]) {
        empMap[key] = {
          key: `emp_${Object.keys(empMap).length}`,
          employee: r.employee,
          position: r.position,
          colorCounts: {},
          date: r.date,
        };
        selectedColors.forEach((c) => (empMap[key].colorCounts[c] = 0));
      }
      for (const c of selectedColors) {
        empMap[key].colorCounts[c] += r.colorCounts?.[c] || 0;
      }
    }

    // Считаем итог для сортировки, по умолчанию по сотруднику
    results.value = Object.values(empMap)
      .map((emp) => {
        let total = 0;
        for (const count of Object.values(emp.colorCounts)) {
          total += count;
        }
        return { ...emp, count: total };
      })
      .sort((a, b) => a.employee.localeCompare(b.employee, "ru"));

    $q.notify({
      color: "positive",
      message: `Обработано ${results.value.length} сотрудников`,
    });
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка подсчёта: " + error.message,
    });
  } finally {
    loading.value = false;
  }
}

async function saveResults() {
  try {
    await api.saveResults(results.value);
    $q.notify({ color: "positive", message: "Результаты сохранены" });
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка сохранения: " + error.message,
    });
  }
}

async function exportExcel() {
  try {
    // Сериализуем для удаления реактивности Vue перед передачей в IPC
    const data = JSON.parse(JSON.stringify(rawResults.value));
    await api.exportExcel(data);
    $q.notify({ color: "positive", message: "Экспорт завершён" });
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка экспорта: " + error.message,
    });
  }
}

defineExpose({
  results,
  countSelected,
});
</script>

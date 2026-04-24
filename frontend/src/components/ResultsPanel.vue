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
        <q-btn color="secondary" label="📋 Экспорт всех" @click="exportExcel" />
        <q-btn
          color="info"
          label="📋 Экспорт видимых"
          @click="exportVisibleExcel"
          :disable="filteredResults.length === 0"
        />
        <q-btn
          v-if="hiddenEmployees.size > 0"
          color="warning"
          :label="`👁 Показать скрытых (${hiddenEmployees.size})`"
          @click="showAllHidden"
          outline
        />
        <q-input
          v-model="minCount"
          label="Мин. кол-во"
          type="number"
          dense
          outlined
          style="width: 120px"
          min="0"
        >
          <template v-slot:prepend>
            <q-icon name="filter_list" />
          </template>
        </q-input>
        <q-select
          v-model="sortOption"
          :options="sortOptions"
          label="Сортировка"
          dense
          outlined
          style="min-width: 280px"
          emit-value
          map-options
        >
          <template v-slot:prepend>
            <q-icon name="sort" />
          </template>
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps" class="sort-option">
              <q-item-section>
                <div class="sort-label">
                  <span
                    v-if="scope.opt.color"
                    class="color-circle"
                    :style="{ backgroundColor: scope.opt.hex }"
                  />
                  <span class="sort-label-text">{{ scope.opt.label }}</span>
                </div>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
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
        :pagination="{ rowsPerPage: 0, sortBy: '', sortDesc: false }"
        flat
        bordered
        @request="onTableRequest"
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
            <template v-if="props.col.name === 'hide'">
              <q-btn
                flat
                dense
                color="grey-6"
                icon="close"
                size="sm"
                @click="hideEmployee(props.row.key)"
              >
                <q-tooltip>Скрыть сотрудника</q-tooltip>
              </q-btn>
            </template>
            <template v-else-if="props.col.name.startsWith('color_')">
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
const sortOption = ref("employee_asc");
const minCount = ref(0); // Минимальный порог для фильтрации
const hiddenEmployees = ref(new Set()); // Скрытые сотрудники
const periodValues = ref({}); // { employee: { colorCode: [val1, val2, val3] } }
const periods = ref([]); // Список периодов для отображения

// Варианты сортировки
const sortOptions = computed(() => {
  const options = [
    { label: "🔤 По имени (А→Я)", value: "employee_asc" },
    { label: "🔤 По имени (Я→А)", value: "employee_desc" },
    { label: "📊 По общему количеству (↓)", value: "count_desc" },
    { label: "📊 По общему количеству (↑)", value: "count_asc" },
  ];

  // Динамические сортировки по цветам и трендам
  for (const code of colorCodes.value) {
    options.push({
      label: "По количеству (↓)",
      value: `color_${code}_desc`,
      color: true,
      hex: `#${code}`,
    });
    options.push({
      label: "По количеству (↑)",
      value: `color_${code}_asc`,
      color: true,
      hex: `#${code}`,
    });
    options.push({
      label: "Последний (↓)",
      value: `last_${code}_desc`,
      color: true,
      hex: `#${code}`,
    });
    options.push({
      label: "Последний (↑)",
      value: `last_${code}_asc`,
      color: true,
      hex: `#${code}`,
    });
    options.push({
      label: "Тренд (рост ↓)",
      value: `trend_${code}_desc`,
      color: true,
      hex: `#${code}`,
    });
    options.push({
      label: "Тренд (падение ↓)",
      value: `trend_${code}_asc`,
      color: true,
      hex: `#${code}`,
    });
  }

  return options;
});

const filteredResults = computed(() => {
  let filtered = results.value;

  // Фильтрация скрытых сотрудников
  if (hiddenEmployees.value.size > 0) {
    filtered = filtered.filter((r) => !hiddenEmployees.value.has(r.key));
  }

  // Фильтрация по поиску
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.employee?.toLowerCase().includes(query) ||
        r.position?.toLowerCase().includes(query),
    );
  }

  // Фильтрация по минимальному количеству
  const threshold = Number(minCount.value) || 0;
  if (threshold > 0) {
    filtered = filtered.filter((r) => {
      // Проверяем значения по периодам для каждого цвета
      // Показываем сотрудника, если хотя бы один результат >= порогу
      for (const code of colorCodes.value) {
        const values = periodValues.value[r.employee]?.[code] || [];
        for (const val of values) {
          if (val >= threshold) return true;
        }
      }

      return false;
    });
  }

  // Сортировка
  const sort = sortOption.value;
  const sorted = [...filtered].sort((a, b) => {
    // По имени
    if (sort === "employee_asc") {
      return a.employee.localeCompare(b.employee, "ru");
    }
    if (sort === "employee_desc") {
      return b.employee.localeCompare(a.employee, "ru");
    }

    // По общему количеству
    if (sort === "count_desc") {
      return (b.count || 0) - (a.count || 0);
    }
    if (sort === "count_asc") {
      return (a.count || 0) - (b.count || 0);
    }

    // По цвету (агрегированное значение)
    if (sort.startsWith("color_")) {
      const rest = sort.replace("color_", "");
      const direction = rest.endsWith("_desc") ? "desc" : "asc";
      const code = rest.replace(/_(asc|desc)$/, "");
      const valA = a.colorCounts?.[code] || 0;
      const valB = b.colorCounts?.[code] || 0;
      return direction === "desc" ? valB - valA : valA - valB;
    }

    // По последнему периоду
    if (sort.startsWith("last_")) {
      const rest = sort.replace("last_", "");
      const direction = rest.endsWith("_desc") ? "desc" : "asc";
      const code = rest.replace(/_(asc|desc)$/, "");
      const valsA = periodValues.value[a.employee]?.[code] || [];
      const valsB = periodValues.value[b.employee]?.[code] || [];

      const lastA = valsA[valsA.length - 1] || 0;
      const lastB = valsB[valsB.length - 1] || 0;
      return direction === "desc" ? lastB - lastA : lastA - lastB;
    }

    // По тренду
    if (sort.startsWith("trend_")) {
      const rest = sort.replace("trend_", "");
      const direction = rest.endsWith("_desc") ? "desc" : "asc";
      const code = rest.replace(/_(asc|desc)$/, "");
      const valsA = periodValues.value[a.employee]?.[code] || [];
      const valsB = periodValues.value[b.employee]?.[code] || [];

      const lastA = valsA[valsA.length - 1] || 0;
      const prevA = valsA[valsA.length - 2] || 0;
      const trendA = lastA - prevA;

      const lastB = valsB[valsB.length - 1] || 0;
      const prevB = valsB[valsB.length - 2] || 0;
      const trendB = lastB - prevB;

      return direction === "desc" ? trendB - trendA : trendA - trendB;
    }

    return 0;
  });

  return sorted;
});

const columns = computed(() => {
  const base = [
    {
      name: "hide",
      label: "",
      field: "key",
      align: "center",
      sortable: false,
    },
    {
      name: "employee",
      label: "Сотрудник",
      field: "employee",
      align: "left",
      sortable: false,
      required: true,
    },
    {
      name: "position",
      label: "Должность",
      field: "position",
      align: "left",
      sortable: false,
    },
  ];

  // Динамические колонки для каждого цвета
  for (const code of colorCodes.value) {
    base.push({
      name: `color_${code}`,
      label: `#${code}`,
      field: (row) => row.colorCounts?.[code] || 0,
      align: "center",
      sortable: false,
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
    for (const fileItem of props.files) {
      const fileObject = fileItem.file || fileItem;
      const response = await api.countSelected({
        fileObjects: [fileObject],
        month: fileItem.month,
        year: fileItem.year,
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
    // Включаем ВСЕХ сотрудников из ВСЕХ периодов
    const pValues = {};
    for (const period of sortedPeriods) {
      for (const empKey of Object.keys(periodMap[period] || {})) {
        const emp = periodMap[period][empKey];
        if (!pValues[emp.employee]) {
          pValues[emp.employee] = {};
          selectedColors.forEach((c) => {
            pValues[emp.employee][c] = [];
          });
        }
        for (const c of selectedColors) {
          pValues[emp.employee][c].push(emp.colorCounts[c] || 0);
        }
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
          month: r.month,
          year: r.year,
          files: r.files || [],
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

    // Сбрасываем сортировку на дефолтную
    sortOption.value = "employee_asc";

    // Сбрасываем скрытых сотрудников
    hiddenEmployees.value.clear();

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

async function exportExcel() {
  try {
    // Сериализуем для удаления реактивности Vue
    const data = JSON.parse(JSON.stringify(rawResults.value));
    const result = await api.exportExcel(data);
    if (result.error) {
      $q.notify({
        color: "negative",
        message: result.error,
      });
    } else {
      $q.notify({ color: "positive", message: "Экспорт завершён" });
    }
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка экспорта: " + error.message,
    });
  }
}

// Экспорт видимых данных (с учётом всех фильтров и сортировки)
async function exportVisibleExcel() {
  try {
    const data = JSON.parse(JSON.stringify(filteredResults.value));
    const pValues = JSON.parse(JSON.stringify(periodValues.value));
    const result = await api.exportVisibleExcel(
      data,
      colorCodes.value,
      pValues,
    );
    if (result.error) {
      $q.notify({
        color: "negative",
        message: result.error,
      });
    } else {
      $q.notify({
        color: "positive",
        message: `Экспортировано ${data.length} записей`,
      });
    }
  } catch (error) {
    $q.notify({
      color: "negative",
      message: "Ошибка экспорта: " + error.message,
    });
  }
}

// Управление скрытыми сотрудниками
function hideEmployee(key) {
  hiddenEmployees.value.add(key);
  hiddenEmployees.value = new Set(hiddenEmployees.value); // триггер реактивности
}

function showEmployee(key) {
  hiddenEmployees.value.delete(key);
  hiddenEmployees.value = new Set(hiddenEmployees.value);
}

function showAllHidden() {
  hiddenEmployees.value.clear();
  hiddenEmployees.value = new Set(hiddenEmployees.value);
}

// Отключаем сортировку по клику на шапку
function onTableRequest(props) {
  // Сбрасываем сортировку Quasar - используем только наш селект
  props.pagination.sortBy = "";
  props.pagination.sortDesc = false;
  props.done();
}

defineExpose({
  results,
  countSelected,
});
</script>

<style scoped>
.sort-label {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sort-option .color-circle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid #ccc;
  flex-shrink: 0;
}
</style>

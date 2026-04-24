<template>
  <q-layout view="hHh lpR fFf">
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title>
          📊 Трекер посещаемости
        </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-page-container>
      <q-page class="q-pa-md">
        <div class="row q-col-gutter-md">
          <div class="col-12">
            <FileSelector
              ref="fileSelectorRef"
              @files-changed="onFilesChanged"
            />
          </div>
          <div class="col-12">
            <ColorTable ref="colorTableRef" />
          </div>
          <div class="col-12">
            <ResultsPanel
              ref="resultsPanelRef"
              :color-table="colorTableRef"
              :files="currentFiles"
            />
          </div>
        </div>
      </q-page>
    </q-page-container>
  </q-layout>
</template>

<script setup>
import { ref } from 'vue'
import FileSelector from './components/FileSelector.vue'
import ColorTable from './components/ColorTable.vue'
import ResultsPanel from './components/ResultsPanel.vue'

const fileSelectorRef = ref(null)
const colorTableRef = ref(null)
const resultsPanelRef = ref(null)
const currentFiles = ref([])

function onFilesChanged(files) {
  currentFiles.value = files
  // Извлекаем File objects и передаём в ColorTable
  const fileObjects = files.map(f => f.file || f)
  if (fileObjects.length > 0 && colorTableRef.value) {
    colorTableRef.value.scanColors(fileObjects)
  }
}
</script>

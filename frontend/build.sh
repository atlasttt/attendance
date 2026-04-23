#!/bin/bash

# Скрипт сборки и упаковки Electron приложения
# Запуск: chmod +x build.sh && ./build.sh

set -e

echo "🚀 Начинаем сборку Attendance Tracker..."

# 1. Установка зависимостей (если нужно)
if [ ! -d "node_modules" ]; then
  echo "📦 Установка зависимостей..."
  npm install
fi

# 2. Сборка Vite проекта
echo "🛠️  Сборка Vue/Vite приложения..."
npm run build

# 3. Упаковка Electron приложения
echo "📦 Упаковка приложения..."
npm run electron:build

echo "✅ Готово! Файлы сборки находятся в папке ./release/"
echo "   macOS: .dmg и .zip"
echo "   Windows: .exe (если запускали на Windows)"

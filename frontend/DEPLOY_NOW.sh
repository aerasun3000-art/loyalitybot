#!/bin/bash

echo "🚀 Начинаю деплой на Vercel..."
echo ""

# Удаляем старую конфигурацию
rm -rf .vercel

echo "✅ Старая конфигурация удалена"
echo ""
echo "Запускаю vercel --prod..."
echo "При вопросах нажимайте Enter (используем defaults)"
echo ""

# Деплой
vercel --prod


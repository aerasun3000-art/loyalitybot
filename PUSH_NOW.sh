#!/bin/bash

echo "🚀 Начинаю push на GitHub..."
echo ""

cd /Users/alekseysanzheev/Desktop/loyalitybot

# Добавим последний файл
git add QUICK_DEPLOY_NOW.md
git commit -m "Add quick deploy instructions" 2>/dev/null || echo "Файл уже закоммичен"

# Push
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SUCCESS! Push выполнен!"
    echo ""
    echo "Vercel автоматически задеплоит через 1-2 минуты"
    echo "Проверьте: https://loyalitybot.vercel.app/"
else
    echo ""
    echo "⚠️ Нужна авторизация GitHub"
    echo ""
    echo "Варианты:"
    echo "1. Используйте GitHub Desktop"
    echo "2. Настройте SSH ключ"
    echo "3. Или деплойте через Vercel Dashboard"
fi


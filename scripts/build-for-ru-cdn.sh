#!/bin/bash
# Сборка фронтенда для RU CDN с VITE_API_URL_FALLBACK
# chmod +x scripts/build-for-ru-cdn.sh

set -e

if [ -z "$VITE_API_URL_FALLBACK" ]; then
  echo "❌ VITE_API_URL_FALLBACK не задан. Обязательно для RU-сборки."
  exit 1
fi

if [ -z "$VITE_API_URL" ] || [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_ANON_KEY" ]; then
  echo "❌ Требуются: VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY"
  exit 1
fi

cd "$(dirname "$0")/../frontend"
npm run build

echo ""
echo "✅ Сборка готова: frontend/dist/"
echo "📦 Загрузите содержимое папки dist/ на ваш CDN/хостинг."
echo "🌐 Основной API: $VITE_API_URL"
echo "🇷🇺 Резервный API (RU): $VITE_API_URL_FALLBACK"

if [ -n "$CDN_BUCKET" ]; then
  echo ""
  echo "📤 Загрузка в S3 bucket: $CDN_BUCKET"
  aws s3 sync dist/ "s3://$CDN_BUCKET" --delete --acl public-read
fi

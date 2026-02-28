#!/usr/bin/env bash
# deploy.sh — правильный деплой partner-webhook
#
# ВАЖНО: всегда используй --env="" (не --name!) для секретов и деплоя.
# В wrangler.toml определены несколько окружений ([env.production], [env.staging]),
# поэтому --name и --env="" дают РАЗНЫЕ scope для секретов.
# Деплой через --env="" читает из top-level scope, --name пишет в global scope.
#
# ВАЖНО: используй printf вместо echo — echo добавляет \n в конец,
# что ломает токены в URL (Telegram возвращает 404).
#
# Использование:
#   bash deploy.sh          — только деплой кода
#   bash deploy.sh secrets  — только обновить секреты
#   bash deploy.sh all      — секреты + деплой + регистрация вебхука

set -e
cd "$(dirname "$0")"

WORKER="loyalitybot-partner-webhook"
WEBHOOK_URL="https://${WORKER}.aerasun3000.workers.dev/"

deploy_secrets() {
  echo "=== Устанавливаем секреты (scope: --env=\"\") ==="

  # Читаем из переменных окружения или запрашиваем интерактивно
  : "${TOKEN_PARTNER:?Нужен TOKEN_PARTNER}"
  : "${SUPABASE_URL:?Нужен SUPABASE_URL}"
  : "${SUPABASE_KEY:?Нужен SUPABASE_KEY}"
  : "${TOKEN_CLIENT:?Нужен TOKEN_CLIENT}"
  : "${BOT_USERNAME:?Нужен BOT_USERNAME}"
  : "${WEBHOOK_SECRET_TOKEN:?Нужен WEBHOOK_SECRET_TOKEN}"

  printf '%s' "$TOKEN_PARTNER"        | npx wrangler secret put TOKEN_PARTNER        --env="" 2>&1 | grep "✨"
  printf '%s' "$SUPABASE_URL"         | npx wrangler secret put SUPABASE_URL         --env="" 2>&1 | grep "✨"
  printf '%s' "$SUPABASE_KEY"         | npx wrangler secret put SUPABASE_KEY         --env="" 2>&1 | grep "✨"
  printf '%s' "$TOKEN_CLIENT"         | npx wrangler secret put TOKEN_CLIENT         --env="" 2>&1 | grep "✨"
  printf '%s' "$BOT_USERNAME"         | npx wrangler secret put BOT_USERNAME         --env="" 2>&1 | grep "✨"
  printf '%s' "$WEBHOOK_SECRET_TOKEN" | npx wrangler secret put WEBHOOK_SECRET_TOKEN --env="" 2>&1 | grep "✨"

  echo "=== Секреты установлены ==="
}

deploy_code() {
  echo "=== Деплой кода (--env=\"\") ==="
  npx wrangler deploy --env=""
}

register_webhook() {
  echo "=== Регистрация вебхука ==="
  curl -s -X POST "https://api.telegram.org/bot${TOKEN_PARTNER}/deleteWebhook" | python3 -m json.tool
  sleep 1
  curl -s -X POST "https://api.telegram.org/bot${TOKEN_PARTNER}/setWebhook" \
    -H "Content-Type: application/json" \
    -d "{\"url\":\"${WEBHOOK_URL}\",\"secret_token\":\"${WEBHOOK_SECRET_TOKEN}\",\"allowed_updates\":[\"message\",\"callback_query\",\"edited_message\"]}" \
    | python3 -m json.tool
}

MODE="${1:-code}"

case "$MODE" in
  secrets) deploy_secrets ;;
  code)    deploy_code ;;
  all)
    deploy_secrets
    deploy_code
    register_webhook
    ;;
  *)
    echo "Использование: $0 [code|secrets|all]"
    exit 1
    ;;
esac

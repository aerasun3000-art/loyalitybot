#!/usr/bin/env python3
"""
Тестовый скрипт для проверки интеграции Sentry.
Запустить: python3 test_sentry.py
"""

import os
from dotenv import load_dotenv
import sentry_sdk

load_dotenv()

# Инициализация Sentry
sentry_dsn = os.getenv('SENTRY_DSN')
if not sentry_dsn:
    print("❌ SENTRY_DSN не найден в .env файле")
    print("Добавьте в .env:")
    print("SENTRY_DSN=https://bcb0ae7907d2c03b4be2507334a93db9@o4510368013877248.ingest.us.sentry.io/4510368037470208")
    exit(1)

print(f"🔧 Инициализация Sentry...")
print(f"DSN: {sentry_dsn[:50]}...")

sentry_sdk.init(
    dsn=sentry_dsn,
    environment=os.getenv('SENTRY_ENVIRONMENT', 'testing'),
    traces_sample_rate=1.0,  # 100% для теста
    release=f"loyaltybot@{os.getenv('APP_VERSION', '1.0.0')}",
)

print("✅ Sentry инициализирован")
print("\n📤 Отправка тестовых событий в Sentry...")

# 1. Тестовое сообщение
print("\n1️⃣ Отправка тестового сообщения (info)...")
sentry_sdk.capture_message("Тест: Sentry интеграция работает! 🎉", level="info")

# 2. Тестовое предупреждение
print("2️⃣ Отправка предупреждения (warning)...")
sentry_sdk.capture_message("Тест: Предупреждение от системы мониторинга", level="warning")

# 3. Тестовая ошибка
print("3️⃣ Отправка тестовой ошибки (error)...")
try:
    # Специально вызываем ошибку для теста
    result = 1 / 0
except ZeroDivisionError as e:
    sentry_sdk.capture_exception(e)
    print(f"   Ошибка перехвачена: {e}")

# 4. Тестовая ошибка с контекстом
print("4️⃣ Отправка ошибки с дополнительным контекстом...")
with sentry_sdk.push_scope() as scope:
    scope.set_tag("test_type", "integration_test")
    scope.set_context("test_info", {
        "bot": "loyaltybot",
        "component": "test_script",
        "version": "1.0.0"
    })
    scope.set_extra("test_data", {
        "timestamp": "2024-11-15",
        "reason": "Integration testing"
    })
    sentry_sdk.capture_message("Тест: Ошибка с расширенным контекстом", level="error")

print("\n✅ Все тестовые события отправлены!")
print("\n🔍 Проверьте дашборд Sentry:")
print("   https://sentry.io/")
print("\n📊 Вы должны увидеть:")
print("   - 2 сообщения (info, warning)")
print("   - 2 ошибки (ZeroDivisionError, error с контекстом)")
print("\n⏱️  Подождите 10-30 секунд, пока события появятся в Sentry")




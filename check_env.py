#!/usr/bin/env python3
"""
Проверка переменных окружения для бета-версии
"""
import os
from dotenv import load_dotenv

# Загружаем .env файл
load_dotenv()

# Обязательные переменные для бета-версии
REQUIRED_VARS = {
    'TOKEN_CLIENT': 'Токен клиентского бота',
    'TOKEN_PARTNER': 'Токен партнёрского бота',
    'ADMIN_BOT_TOKEN': 'Токен админского бота',
    'ADMIN_CHAT_ID': 'Chat ID администратора',
    'SUPABASE_URL': 'URL Supabase проекта',
    'SUPABASE_KEY': 'API ключ Supabase',
    'WELCOME_BONUS_AMOUNT': 'Размер приветственного бонуса'
}

# Опциональные переменные
OPTIONAL_VARS = {
    'GIGACHAT_API_KEY': 'API ключ GigaChat (опционально)',
    'FRONTEND_URL': 'URL фронтенда (опционально)',
    'SENTRY_DSN': 'Sentry DSN (опционально)',
    'LOG_LEVEL': 'Уровень логирования (опционально)'
}

print("=" * 60)
print("🔍 ПРОВЕРКА ПЕРЕМЕННЫХ ОКРУЖЕНИЯ")
print("=" * 60)
print()

# Проверяем обязательные переменные
print("📋 ОБЯЗАТЕЛЬНЫЕ ПЕРЕМЕННЫЕ:")
print("-" * 60)

missing_vars = []
for var, description in REQUIRED_VARS.items():
    value = os.getenv(var)
    if value:
        # Маскируем токены и ключи
        if 'TOKEN' in var or 'KEY' in var or 'SECRET' in var or 'DSN' in var:
            masked_value = value[:10] + "..." + value[-5:] if len(value) > 15 else "***"
            print(f"✅ {var:25} = {masked_value:30} ({description})")
        elif var == 'SUPABASE_URL':
            print(f"✅ {var:25} = {value[:40]:30} ({description})")
        else:
            print(f"✅ {var:25} = {value:30} ({description})")
    else:
        print(f"❌ {var:25} = {'ОТСУТСТВУЕТ':30} ({description})")
        missing_vars.append(var)

print()

# Проверяем опциональные переменные
print("📋 ОПЦИОНАЛЬНЫЕ ПЕРЕМЕННЫЕ:")
print("-" * 60)

for var, description in OPTIONAL_VARS.items():
    value = os.getenv(var)
    if value:
        if 'TOKEN' in var or 'KEY' in var or 'SECRET' in var or 'DSN' in var:
            masked_value = value[:10] + "..." + value[-5:] if len(value) > 15 else "***"
            print(f"✅ {var:25} = {masked_value:30} ({description})")
        else:
            print(f"✅ {var:25} = {value:30} ({description})")
    else:
        print(f"⏸️  {var:25} = {'Не установлена':30} ({description})")

print()
print("=" * 60)

# Итоговый статус
if missing_vars:
    print("❌ ОШИБКА: Отсутствуют обязательные переменные:")
    for var in missing_vars:
        print(f"   - {var}")
    print()
    print("📝 ДЕЙСТВИЕ:")
    print("   1. Откройте файл .env")
    print("   2. Заполните отсутствующие переменные")
    print("   3. Перезапустите этот скрипт для проверки")
    print()
    exit(1)
else:
    print("✅ ВСЕ ОБЯЗАТЕЛЬНЫЕ ПЕРЕМЕННЫЕ УСТАНОВЛЕНЫ!")
    print()
    print("📝 СЛЕДУЮЩИЕ ШАГИ:")
    print("   1. ✅ База данных готова")
    print("   2. ✅ Переменные окружения настроены")
    print("   3. 🚀 Запустите боты: ./start_beta.sh")
    print()
    exit(0)


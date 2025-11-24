#!/usr/bin/env python3
"""
Прямая настройка Sentry Webhook через API
Использует токен из .env
"""

import os
import requests
from dotenv import load_dotenv

load_dotenv()

SENTRY_DSN = os.getenv('SENTRY_DSN', '')
SENTRY_API_TOKEN = os.getenv('SENTRY_API_TOKEN', '')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', '')
WEBHOOK_SECRET = os.getenv('SENTRY_WEBHOOK_SECRET', '')

if not SENTRY_API_TOKEN:
    print("❌ SENTRY_API_TOKEN не найден в .env")
    exit(1)

if not SENTRY_DSN:
    print("❌ SENTRY_DSN не найден в .env")
    exit(1)

# Извлечение данных из DSN
try:
    parts = SENTRY_DSN.split('@')
    org_id = parts[1].split('.')[0].replace('o', '')
    project_id = parts[1].split('/')[-1] if '/' in parts[1] else ''
except:
    print("❌ Неверный формат SENTRY_DSN")
    exit(1)

print("=" * 60)
print("🚀 Настройка Sentry Webhook через API")
print("=" * 60)
print()

headers = {
    "Authorization": f"Bearer {SENTRY_API_TOKEN}",
    "Content-Type": "application/json"
}

# Получение organization slug
print("🔍 Получение информации об организации...")
try:
    response = requests.get("https://sentry.io/api/0/organizations/", headers=headers, timeout=10)
    if response.status_code == 200:
        orgs = response.json()
        if orgs:
            org_slug = orgs[0].get('slug')
            print(f"✅ Organization: {org_slug}")
        else:
            print("❌ Организации не найдены")
            exit(1)
    else:
        print(f"❌ Ошибка получения организаций: {response.status_code}")
        print(f"   Ответ: {response.text}")
        exit(1)
except Exception as e:
    print(f"❌ Ошибка: {e}")
    exit(1)

# Получение project slug
print("🔍 Получение информации о проекте...")
try:
    response = requests.get(
        f"https://sentry.io/api/0/organizations/{org_slug}/projects/",
        headers=headers,
        timeout=10
    )
    if response.status_code == 200:
        projects = response.json()
        if projects:
            project_slug = projects[0].get('slug')
            print(f"✅ Project: {project_slug}")
        else:
            project_slug = 'python'
            print(f"⚠️  Проекты не найдены, используем: {project_slug}")
    else:
        project_slug = 'python'
        print(f"⚠️  Ошибка получения проектов, используем: {project_slug}")
except:
    project_slug = 'python'
    print(f"⚠️  Используем проект по умолчанию: {project_slug}")

# Проверка WEBHOOK_URL
if not WEBHOOK_URL:
    print()
    print("⚠️  WEBHOOK_URL не установлен в .env")
    print("   Для работы webhook нужен публичный URL")
    print()
    print("Варианты:")
    print("1. Используйте ngrok (если работает): ngrok http 8003")
    print("2. Используйте другой туннель (cloudflared, localtunnel)")
    print("3. Deploy API на хостинг (Railway, Render, Fly.io)")
    print("4. Настройте вручную через Sentry UI")
    print()
    webhook_url = input("Введите Webhook URL (или нажмите Enter для пропуска): ").strip()
    if not webhook_url:
        print()
        print("💡 Webhook можно настроить вручную через Sentry UI:")
        print("   1. Settings → Integrations → Webhooks")
        print("   2. Добавьте Callback URL")
        print("   3. См. WEBHOOK_SETUP_STEP_BY_STEP.md")
        exit(0)
else:
    webhook_url = WEBHOOK_URL
    print(f"✅ Webhook URL: {webhook_url}")

# Настройка webhook
print()
print("=" * 60)
print("🔧 Настройка webhook...")
print("=" * 60)

url = f"https://sentry.io/api/0/organizations/{org_slug}/projects/{project_slug}/integrations/webhooks/"

data = {"webhookUrl": webhook_url}
if WEBHOOK_SECRET:
    data["secret"] = WEBHOOK_SECRET

try:
    response = requests.post(url, headers=headers, json=data, timeout=10)
    
    if response.status_code in [200, 201]:
        result = response.json()
        print("✅ Webhook успешно настроен!")
        print()
        print(f"📋 Webhook URL: {webhook_url}")
        print(f"📋 Organization: {org_slug}")
        print(f"📋 Project: {project_slug}")
        print()
        print("📋 Следующие шаги:")
        print("1. Проверьте Sentry Dashboard → Settings → Integrations → Webhooks")
        print("2. Создайте Alert Rule:")
        print("   - Alerts → Create Alert")
        print("   - When: 'An issue is first seen'")
        print("   - Then: 'Send via Webhooks'")
        print("3. Протестируйте:")
        print("   curl http://127.0.0.1:8003/sentry-debug")
        print()
        
        # Сохранение в .env
        with open('.env', 'a') as f:
            f.write(f"\n# Sentry Webhook (auto-configured)\n")
            f.write(f"SENTRY_ORG={org_slug}\n")
            f.write(f"SENTRY_PROJECT={project_slug}\n")
            if not WEBHOOK_URL:
                f.write(f"WEBHOOK_URL={webhook_url}\n")
        print("✅ Настройки сохранены в .env")
        
    elif response.status_code == 404:
        print("❌ Проект или организация не найдены!")
        print(f"   Organization: {org_slug}")
        print(f"   Project: {project_slug}")
        print("   Проверьте правильность данных")
    elif response.status_code == 401:
        print("❌ Неверный API Token!")
        print("   Проверьте токен и его права доступа")
    else:
        print(f"❌ Ошибка: {response.status_code}")
        print(f"   Ответ: {response.text}")
        print()
        print("💡 Попробуйте настроить вручную через Sentry Dashboard")
        print("   См. WEBHOOK_SETUP_STEP_BY_STEP.md")
        
except Exception as e:
    print(f"❌ Ошибка: {e}")
    print()
    print("💡 Попробуйте настроить вручную через Sentry Dashboard")
    print("   См. WEBHOOK_SETUP_STEP_BY_STEP.md")



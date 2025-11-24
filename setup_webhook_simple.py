#!/usr/bin/env python3
"""
Упрощённый скрипт для настройки Sentry Webhook
Использует данные из .env и запрашивает только API token
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# Получение данных из .env
SENTRY_DSN = os.getenv('SENTRY_DSN', '')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', '')
WEBHOOK_SECRET = os.getenv('SENTRY_WEBHOOK_SECRET', '')

if not SENTRY_DSN:
    print("❌ SENTRY_DSN не найден в .env")
    exit(1)

# Извлечение данных из DSN
# Формат: https://KEY@oORG.ingest.region.sentry.io/PROJECT
try:
    parts = SENTRY_DSN.split('@')
    if len(parts) > 1:
        org_id = parts[1].split('.')[0].replace('o', '')
        project_id = parts[1].split('/')[-1] if '/' in parts[1] else ''
    else:
        raise ValueError("Неверный формат DSN")
except:
    print("❌ Не удалось извлечь данные из SENTRY_DSN")
    exit(1)

print("=" * 60)
print("🚀 Настройка Sentry Webhook")
print("=" * 60)
print()
print(f"📋 Найденные настройки:")
print(f"   Organization ID: {org_id}")
print(f"   Project ID: {project_id}")
print()

# Запрос API token
if not WEBHOOK_URL:
    print("⚠️  WEBHOOK_URL не установлен в .env")
    print("   Для тестирования используйте ngrok:")
    print("   1. ngrok http 8003")
    print("   2. Скопируйте HTTPS URL")
    print()
    webhook_url = input("Введите Webhook URL (или нажмите Enter для пропуска): ").strip()
    if not webhook_url:
        print("❌ Webhook URL обязателен!")
        exit(1)
else:
    webhook_url = WEBHOOK_URL
    print(f"   Webhook URL: {webhook_url}")

print()
print("🔑 Нужен Sentry API Token для настройки")
print("   Получить: https://sentry.io/settings/account/api/auth-tokens/")
print("   Права: org:read, project:read, project:write")
print()
api_token = input("Введите Sentry API Token: ").strip()

if not api_token:
    print("❌ API Token обязателен!")
    exit(1)

# Попытка получить organization slug через API
print()
print("🔍 Получение информации об организации...")

headers = {
    "Authorization": f"Bearer {api_token}",
    "Content-Type": "application/json"
}

# Попытка получить список организаций
try:
    response = requests.get("https://sentry.io/api/0/organizations/", headers=headers, timeout=10)
    
    if response.status_code == 200:
        orgs = response.json()
        org_slug = None
        
        # Поиск организации по ID
        for org in orgs:
            if str(org.get('id')) == org_id or org.get('slug'):
                org_slug = org.get('slug')
                break
        
        if not org_slug and orgs:
            # Используем первую организацию
            org_slug = orgs[0].get('slug')
            print(f"   Используется организация: {org_slug}")
        elif org_slug:
            print(f"   Найдена организация: {org_slug}")
        else:
            print("   ⚠️  Не удалось определить organization slug")
            org_slug = input("   Введите Organization Slug вручную: ").strip()
    else:
        print(f"   ⚠️  Ошибка получения организаций: {response.status_code}")
        org_slug = input("   Введите Organization Slug вручную: ").strip()
        
except Exception as e:
    print(f"   ⚠️  Ошибка: {e}")
    org_slug = input("   Введите Organization Slug вручную: ").strip()

if not org_slug:
    print("❌ Organization Slug обязателен!")
    exit(1)

# Попытка получить project slug
print()
print("🔍 Получение информации о проекте...")

try:
    response = requests.get(
        f"https://sentry.io/api/0/organizations/{org_slug}/projects/",
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        projects = response.json()
        project_slug = None
        
        # Поиск проекта по ID
        for project in projects:
            if str(project.get('id')) == project_id:
                project_slug = project.get('slug')
                break
        
        if not project_slug and projects:
            # Используем первый проект
            project_slug = projects[0].get('slug')
            print(f"   Используется проект: {project_slug}")
        elif project_slug:
            print(f"   Найден проект: {project_slug}")
        else:
            print("   ⚠️  Не удалось определить project slug")
            project_slug = input("   Введите Project Slug вручную (обычно 'python'): ").strip() or "python"
    else:
        print(f"   ⚠️  Ошибка получения проектов: {response.status_code}")
        project_slug = input("   Введите Project Slug вручную (обычно 'python'): ").strip() or "python"
        
except Exception as e:
    print(f"   ⚠️  Ошибка: {e}")
    project_slug = input("   Введите Project Slug вручную (обычно 'python'): ").strip() or "python"

# Настройка webhook
print()
print("=" * 60)
print("🔧 Настройка webhook...")
print("=" * 60)

url = f"https://sentry.io/api/0/organizations/{org_slug}/projects/{project_slug}/integrations/webhooks/"

data = {
    "webhookUrl": webhook_url
}

if WEBHOOK_SECRET:
    data["secret"] = WEBHOOK_SECRET

try:
    response = requests.post(url, headers=headers, json=data, timeout=10)
    
    if response.status_code in [200, 201]:
        print("✅ Webhook успешно настроен!")
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
            f.write(f"\n# Sentry Webhook Settings (auto)\n")
            f.write(f"SENTRY_ORG={org_slug}\n")
            f.write(f"SENTRY_PROJECT={project_slug}\n")
            f.write(f"SENTRY_API_TOKEN={api_token}\n")
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
        
except requests.exceptions.RequestException as e:
    print(f"❌ Ошибка подключения: {e}")
    print()
    print("💡 Проверьте интернет соединение")
    print("   Или настройте вручную через Sentry Dashboard")



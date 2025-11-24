#!/usr/bin/env python3
"""
Финальный скрипт для настройки Sentry Webhook
Автоматически получает ngrok URL и настраивает webhook
"""

import os
import requests
import json
import time
import subprocess
from dotenv import load_dotenv

load_dotenv()

SENTRY_DSN = os.getenv('SENTRY_DSN', '')
WEBHOOK_SECRET = os.getenv('SENTRY_WEBHOOK_SECRET', '')

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
print("🚀 Автоматическая настройка Sentry Webhook")
print("=" * 60)
print()

# Проверка ngrok
print("🔍 Проверка ngrok...")
try:
    response = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=2)
    if response.status_code == 200:
        data = response.json()
        if data.get('tunnels'):
            ngrok_url = data['tunnels'][0]['public_url']
            webhook_url = f"{ngrok_url}/api/sentry-webhook"
            print(f"✅ Найден ngrok URL: {ngrok_url}")
            print(f"   Webhook URL: {webhook_url}")
        else:
            print("⚠️  Ngrok запущен, но туннели не найдены")
            print("   Запускаю ngrok...")
            subprocess.Popen(['ngrok', 'http', '8003'], 
                           stdout=subprocess.DEVNULL, 
                           stderr=subprocess.DEVNULL)
            time.sleep(5)
            response = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=5)
            if response.status_code == 200:
                data = response.json()
                if data.get('tunnels'):
                    ngrok_url = data['tunnels'][0]['public_url']
                    webhook_url = f"{ngrok_url}/api/sentry-webhook"
                    print(f"✅ Ngrok запущен: {ngrok_url}")
                else:
                    raise Exception("Туннели не найдены")
            else:
                raise Exception("Не удалось получить URL")
    else:
        raise Exception("Ngrok не запущен")
except:
    print("⚠️  Ngrok не запущен")
    print("   Запускаю ngrok...")
    try:
        subprocess.Popen(['ngrok', 'http', '8003'], 
                        stdout=subprocess.DEVNULL, 
                        stderr=subprocess.DEVNULL)
        print("   Ожидание запуска ngrok (5 секунд)...")
        time.sleep(5)
        
        for i in range(5):
            try:
                response = requests.get("http://127.0.0.1:4040/api/tunnels", timeout=2)
                if response.status_code == 200:
                    data = response.json()
                    if data.get('tunnels'):
                        ngrok_url = data['tunnels'][0]['public_url']
                        webhook_url = f"{ngrok_url}/api/sentry-webhook"
                        print(f"✅ Ngrok запущен: {ngrok_url}")
                        break
            except:
                time.sleep(1)
        else:
            raise Exception("Не удалось запустить ngrok")
    except Exception as e:
        print(f"❌ Ошибка запуска ngrok: {e}")
        print("   Установите: brew install ngrok")
        print("   Или укажите WEBHOOK_URL вручную в .env")
        exit(1)

print()
print("🔑 Нужен Sentry API Token")
print("   Получить: https://sentry.io/settings/account/api/auth-tokens/")
print("   Права: org:read, project:read, project:write")
print()
api_token = input("Введите Sentry API Token: ").strip()

if not api_token:
    print("❌ API Token обязателен!")
    exit(1)

# Получение organization и project slug
print()
print("🔍 Получение информации из Sentry...")

headers = {
    "Authorization": f"Bearer {api_token}",
    "Content-Type": "application/json"
}

# Получение организаций
try:
    response = requests.get("https://sentry.io/api/0/organizations/", headers=headers, timeout=10)
    if response.status_code == 200:
        orgs = response.json()
        org_slug = orgs[0].get('slug') if orgs else None
        if org_slug:
            print(f"   Organization: {org_slug}")
        else:
            raise Exception("Организации не найдены")
    else:
        raise Exception(f"Ошибка {response.status_code}")
except Exception as e:
    print(f"❌ Ошибка: {e}")
    exit(1)

# Получение проектов
try:
    response = requests.get(
        f"https://sentry.io/api/0/organizations/{org_slug}/projects/",
        headers=headers,
        timeout=10
    )
    if response.status_code == 200:
        projects = response.json()
        project_slug = projects[0].get('slug') if projects else 'python'
        print(f"   Project: {project_slug}")
    else:
        project_slug = 'python'
        print(f"   Используется проект по умолчанию: {project_slug}")
except:
    project_slug = 'python'
    print(f"   Используется проект по умолчанию: {project_slug}")

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
        print("✅ Webhook успешно настроен!")
        print()
        print(f"📋 Webhook URL: {webhook_url}")
        print()
        print("📋 Следующие шаги:")
        print("1. Создайте Alert Rule в Sentry:")
        print("   - Alerts → Create Alert")
        print("   - When: 'An issue is first seen'")
        print("   - Then: 'Send via Webhooks'")
        print("2. Протестируйте:")
        print("   curl http://127.0.0.1:8003/sentry-debug")
        print()
        
        # Сохранение в .env
        with open('.env', 'a') as f:
            f.write(f"\n# Sentry Webhook (auto-configured)\n")
            f.write(f"SENTRY_ORG={org_slug}\n")
            f.write(f"SENTRY_PROJECT={project_slug}\n")
            f.write(f"SENTRY_API_TOKEN={api_token}\n")
            f.write(f"WEBHOOK_URL={webhook_url}\n")
        print("✅ Настройки сохранены в .env")
        
    else:
        print(f"❌ Ошибка: {response.status_code}")
        print(f"   Ответ: {response.text}")
        print()
        print("💡 Попробуйте настроить вручную:")
        print("   См. WEBHOOK_SETUP_STEP_BY_STEP.md")
        
except Exception as e:
    print(f"❌ Ошибка: {e}")
    print()
    print("💡 Попробуйте настроить вручную:")
    print("   См. WEBHOOK_SETUP_STEP_BY_STEP.md")



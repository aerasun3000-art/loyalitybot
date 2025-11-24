#!/usr/bin/env python3
"""
Скрипт для автоматической настройки Sentry Webhook через API
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

# Конфигурация
SENTRY_ORG = os.getenv('SENTRY_ORG', 'your-org-slug')  # Slug вашей организации
SENTRY_PROJECT = os.getenv('SENTRY_PROJECT', 'python')  # Slug вашего проекта
SENTRY_API_TOKEN = os.getenv('SENTRY_API_TOKEN')  # Нужен API token из Sentry
WEBHOOK_URL = os.getenv('WEBHOOK_URL', 'https://your-domain.com/api/sentry-webhook')
WEBHOOK_SECRET = os.getenv('SENTRY_WEBHOOK_SECRET', '')

if not SENTRY_API_TOKEN:
    print("❌ Ошибка: SENTRY_API_TOKEN не установлен в .env")
    print("\n📋 Как получить API Token:")
    print("1. Откройте https://sentry.io/settings/account/api/auth-tokens/")
    print("2. Нажмите 'Create New Token'")
    print("3. Выберите права: 'org:read', 'project:read', 'project:write'")
    print("4. Скопируйте токен и добавьте в .env:")
    print("   SENTRY_API_TOKEN=your_token_here")
    print("   SENTRY_ORG=your-org-slug")
    print("   SENTRY_PROJECT=your-project-slug")
    exit(1)

# Sentry API base URL
BASE_URL = f"https://sentry.io/api/0/organizations/{SENTRY_ORG}"

headers = {
    "Authorization": f"Bearer {SENTRY_API_TOKEN}",
    "Content-Type": "application/json"
}

def get_webhook_id():
    """Получить ID существующего webhook"""
    url = f"{BASE_URL}/integrations/"
    response = requests.get(url, headers=headers)
    
    if response.status_code == 200:
        integrations = response.json()
        for integration in integrations:
            if integration.get('provider', {}).get('key') == 'webhooks':
                return integration.get('id')
    
    return None

def create_webhook():
    """Создать новый webhook"""
    print(f"🔧 Настройка Sentry Webhook...")
    print(f"   Organization: {SENTRY_ORG}")
    print(f"   Project: {SENTRY_PROJECT}")
    print(f"   Webhook URL: {WEBHOOK_URL}")
    
    # Проверка существующего webhook
    webhook_id = get_webhook_id()
    
    if webhook_id:
        print(f"✅ Webhook уже существует (ID: {webhook_id})")
        print("   Обновляю конфигурацию...")
        
        # Обновление существующего webhook
        url = f"{BASE_URL}/integrations/{webhook_id}/"
        data = {
            "config": {
                "webhookUrl": WEBHOOK_URL,
                "secret": WEBHOOK_SECRET if WEBHOOK_SECRET else None
            }
        }
        
        response = requests.put(url, headers=headers, json=data)
        
        if response.status_code == 200:
            print("✅ Webhook обновлён успешно!")
            return True
        else:
            print(f"❌ Ошибка обновления: {response.status_code}")
            print(f"   Ответ: {response.text}")
            return False
    else:
        # Создание нового webhook через проект
        print("   Создаю новый webhook...")
        
        # Добавление webhook к проекту
        url = f"{BASE_URL}/projects/{SENTRY_PROJECT}/integrations/webhooks/"
        data = {
            "webhookUrl": WEBHOOK_URL,
            "secret": WEBHOOK_SECRET if WEBHOOK_SECRET else None
        }
        
        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code in [200, 201]:
            print("✅ Webhook создан успешно!")
            return True
        else:
            print(f"❌ Ошибка создания: {response.status_code}")
            print(f"   Ответ: {response.text}")
            return False

def create_alert_rule():
    """Создать Alert Rule для отправки в webhook"""
    print("\n🔔 Создание Alert Rule...")
    
    url = f"{BASE_URL}/projects/{SENTRY_PROJECT}/rules/"
    
    data = {
        "name": "Critical Errors → Telegram",
        "conditions": [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
            }
        ],
        "actions": [
            {
                "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                "service": "webhooks"
            }
        ],
        "actionMatch": "all",
        "frequency": 1
    }
    
    response = requests.post(url, headers=headers, json=data)
    
    if response.status_code in [200, 201]:
        print("✅ Alert Rule создан успешно!")
        return True
    else:
        print(f"⚠️  Alert Rule не создан: {response.status_code}")
        print("   Вы можете создать его вручную в Sentry Dashboard")
        print(f"   Ответ: {response.text}")
        return False

def main():
    """Основная функция"""
    print("=" * 60)
    print("🚀 Автоматическая настройка Sentry Webhook")
    print("=" * 60)
    print()
    
    # Проверка переменных
    if WEBHOOK_URL == 'https://your-domain.com/api/sentry-webhook':
        print("⚠️  ВНИМАНИЕ: WEBHOOK_URL не настроен!")
        print("   Для тестирования используйте ngrok:")
        print("   1. ngrok http 8003")
        print("   2. Скопируйте HTTPS URL")
        print("   3. Добавьте в .env: WEBHOOK_URL=https://abc123.ngrok.io/api/sentry-webhook")
        print()
        response = input("Продолжить с текущим URL? (y/N): ")
        if response.lower() != 'y':
            return
    
    # Создание webhook
    if create_webhook():
        # Создание alert rule
        create_alert_rule()
        
        print()
        print("=" * 60)
        print("✅ Настройка завершена!")
        print("=" * 60)
        print()
        print("📋 Следующие шаги:")
        print("1. Проверьте Sentry Dashboard → Settings → Integrations → Webhooks")
        print("2. Протестируйте webhook:")
        print("   curl http://127.0.0.1:8003/sentry-debug")
        print("3. Проверьте Telegram - должно прийти уведомление")
        print()
    else:
        print()
        print("❌ Настройка не завершена. Проверьте:")
        print("   - SENTRY_API_TOKEN правильный")
        print("   - SENTRY_ORG и SENTRY_PROJECT правильные")
        print("   - WEBHOOK_URL доступен из интернета")
        print()
        print("💡 Альтернатива: настройте вручную через Sentry Dashboard")
        print("   См. SETUP_SENTRY_WEBHOOKS.md")

if __name__ == "__main__":
    main()



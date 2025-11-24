#!/usr/bin/env python3
"""
Интерактивный скрипт для настройки Sentry Webhook
"""

import os
import requests
import json
from dotenv import load_dotenv

load_dotenv()

def get_user_input(prompt, default=None, required=True):
    """Получить ввод от пользователя"""
    if default:
        full_prompt = f"{prompt} [{default}]: "
    else:
        full_prompt = f"{prompt}: "
    
    value = input(full_prompt).strip()
    
    if not value and default:
        return default
    elif not value and required:
        print("⚠️  Это поле обязательно!")
        return get_user_input(prompt, default, required)
    
    return value

def test_webhook_url(url):
    """Проверить доступность webhook URL"""
    try:
        response = requests.post(
            url,
            json={"test": "data"},
            timeout=5
        )
        return response.status_code in [200, 201]
    except:
        return False

def main():
    print("=" * 60)
    print("🚀 Настройка Sentry Webhook")
    print("=" * 60)
    print()
    
    # Сбор данных
    print("📋 Введите данные для настройки:")
    print()
    
    sentry_org = get_user_input("Sentry Organization Slug", required=True)
    print("   💡 Найти можно в URL: sentry.io/organizations/YOUR-ORG-SLUG/")
    print()
    
    sentry_project = get_user_input("Sentry Project Slug", default="python")
    print("   💡 Обычно 'python' для Python проектов")
    print()
    
    sentry_token = get_user_input("Sentry API Token", required=True)
    print("   💡 Получить: sentry.io/settings/account/api/auth-tokens/")
    print()
    
    webhook_url = get_user_input("Webhook URL", required=True)
    print("   💡 Для теста: используйте ngrok (ngrok http 8003)")
    print("   💡 Формат: https://your-domain.com/api/sentry-webhook")
    print()
    
    # Проверка webhook URL
    if not webhook_url.startswith('http'):
        print("⚠️  URL должен начинаться с http:// или https://")
        webhook_url = get_user_input("Webhook URL", required=True)
    
    # Проверка доступности (только для локальных URL)
    if 'localhost' in webhook_url or '127.0.0.1' in webhook_url:
        print("⚠️  Локальный URL не будет работать с Sentry!")
        print("   Используйте ngrok для тестирования:")
        print("   1. ngrok http 8003")
        print("   2. Скопируйте HTTPS URL")
        response = input("   Продолжить? (y/N): ")
        if response.lower() != 'y':
            return
    
    webhook_secret = get_user_input("Webhook Secret (опционально)", 
                                   default=os.getenv('SENTRY_WEBHOOK_SECRET', ''), 
                                   required=False)
    
    print()
    print("=" * 60)
    print("🔧 Настройка webhook...")
    print("=" * 60)
    
    # Настройка через API
    BASE_URL = f"https://sentry.io/api/0/organizations/{sentry_org}"
    headers = {
        "Authorization": f"Bearer {sentry_token}",
        "Content-Type": "application/json"
    }
    
    # Попытка создать/обновить webhook
    url = f"{BASE_URL}/projects/{sentry_project}/integrations/webhooks/"
    
    data = {
        "webhookUrl": webhook_url
    }
    
    if webhook_secret:
        data["secret"] = webhook_secret
    
    try:
        response = requests.post(url, headers=headers, json=data)
        
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
            save = input("💾 Сохранить настройки в .env? (Y/n): ")
            if save.lower() != 'n':
                with open('.env', 'a') as f:
                    f.write(f"\n# Sentry Webhook Settings\n")
                    f.write(f"SENTRY_ORG={sentry_org}\n")
                    f.write(f"SENTRY_PROJECT={sentry_project}\n")
                    f.write(f"SENTRY_API_TOKEN={sentry_token}\n")
                    f.write(f"WEBHOOK_URL={webhook_url}\n")
                print("✅ Настройки сохранены в .env")
            
        elif response.status_code == 404:
            print("❌ Проект или организация не найдены!")
            print(f"   Проверьте правильность:")
            print(f"   - Organization: {sentry_org}")
            print(f"   - Project: {sentry_project}")
            print(f"   - API Token имеет права на запись")
        elif response.status_code == 401:
            print("❌ Неверный API Token!")
            print("   Проверьте токен и его права доступа")
        else:
            print(f"❌ Ошибка: {response.status_code}")
            print(f"   Ответ: {response.text}")
            print()
            print("💡 Попробуйте настроить вручную через Sentry Dashboard")
            print("   См. QUICK_WEBHOOK_SETUP.md")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Ошибка подключения: {e}")
        print()
        print("💡 Проверьте интернет соединение")
        print("   Или настройте вручную через Sentry Dashboard")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Отменено пользователем")
    except Exception as e:
        print(f"\n❌ Неожиданная ошибка: {e}")



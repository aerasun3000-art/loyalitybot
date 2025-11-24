#!/usr/bin/env python3
"""
Скрипт для тестирования Sentry webhook → Telegram интеграции
"""

import requests
import json

# URL вашего webhook endpoint
WEBHOOK_URL = "http://127.0.0.1:8001/api/sentry-webhook"

# Тестовые данные в формате Sentry webhook
test_payload = {
    "action": "created",
    "data": {
        "issue": {
            "id": "123456",
            "title": "ZeroDivisionError: division by zero",
            "culprit": "secure_api.py in trigger_error",
            "permalink": "https://sentry.io/organizations/test/issues/123456/",
            "level": "error",
            "status": "unresolved",
            "count": "1"
        }
    },
    "event": {
        "title": "ZeroDivisionError: division by zero",
        "culprit": "secure_api.py:59 in trigger_error",
        "level": "error",
        "environment": "production",
        "release": "loyaltybot@1.0.0",
        "tags": [
            ["environment", "production"],
            ["level", "error"]
        ]
    },
    "url": "https://sentry.io/organizations/test/issues/123456/"
}

def test_webhook():
    """Отправка тестового webhook"""
    print("🧪 Тестирование Sentry Webhook → Telegram")
    print(f"📡 Отправка запроса на {WEBHOOK_URL}...")
    
    try:
        response = requests.post(
            WEBHOOK_URL,
            json=test_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"\n✅ Ответ получен: {response.status_code}")
        print(f"📄 Тело ответа: {response.json()}")
        
        if response.status_code == 200:
            print("\n🎉 Webhook успешно обработан!")
            print("📱 Проверьте Telegram - должно прийти уведомление")
        else:
            print(f"\n⚠️ Неожиданный статус код: {response.status_code}")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Ошибка подключения!")
        print("💡 Убедитесь что secure_api запущен:")
        print("   cd /Users/ghbi/Downloads/loyalitybot")
        print("   source venv/bin/activate")
        print("   python -m uvicorn secure_api:app --reload --host 127.0.0.1 --port 8001")
        
    except Exception as e:
        print(f"\n❌ Ошибка: {e}")

if __name__ == "__main__":
    test_webhook()



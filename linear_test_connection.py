#!/usr/bin/env python3
"""
Простой скрипт для проверки подключения к Linear API
"""

import os
import requests
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

LINEAR_API_URL = "https://api.linear.app/graphql"

def test_connection():
    """Проверить подключение к Linear API"""
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        print("❌ Ошибка: LINEAR_API_KEY не установлен")
        print("\nДобавьте в .env файл:")
        print("LINEAR_API_KEY=lin_api_ваш_ключ")
        print("\nИли установите переменную окружения:")
        print("export LINEAR_API_KEY='lin_api_ваш_ключ'")
        return False
    
    if not api_key.startswith("lin_api_"):
        print("⚠️  Предупреждение: API ключ должен начинаться с 'lin_api_'")
        print("   Убедитесь, что вы используете Personal API Key")
    
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    # Простой запрос для проверки
    query = """
    query {
        viewer {
            id
            name
            email
        }
        teams {
            nodes {
                id
                name
                key
            }
        }
    }
    """
    
    try:
        response = requests.post(
            LINEAR_API_URL,
            headers=headers,
            json={"query": query}
        )
        
        if response.status_code != 200:
            print(f"❌ Ошибка HTTP: {response.status_code}")
            print(f"Ответ: {response.text}")
            return False
        
        data = response.json()
        
        if "errors" in data:
            print("❌ Ошибки GraphQL:")
            for error in data["errors"]:
                print(f"   - {error.get('message', error)}")
            return False
        
        viewer = data["data"]["viewer"]
        teams = data["data"]["teams"]["nodes"]
        
        print("✅ Подключение успешно!\n")
        print(f"👤 Пользователь: {viewer.get('name', 'N/A')} ({viewer.get('email', 'N/A')})")
        print(f"\n📦 Доступные команды ({len(teams)}):")
        for team in teams:
            print(f"   - {team['name']} (key: {team['key']}, id: {team['id']})")
        
        return True
        
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🔍 Проверка подключения к Linear API...\n")
    test_connection()


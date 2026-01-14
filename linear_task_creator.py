#!/usr/bin/env python3
"""
Простой модуль для создания задач в Linear напрямую
Используется AI ассистентом для постановки задач пользователю
"""

import os
import requests
from typing import Optional, Dict
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

LINEAR_API_URL = "https://api.linear.app/graphql"


def create_linear_task(
    title: str,
    description: str = "",
    team_key: Optional[str] = None,
    priority: int = 3,
    assignee_id: Optional[str] = None,
    project_id: Optional[str] = None
) -> Dict:
    """
    Создать задачу в Linear
    
    Args:
        title: Заголовок задачи (обязательно)
        description: Описание задачи
        team_key: Ключ команды (например, "ENG", "MARKET"). Если не указан, используется первая доступная команда
        priority: Приоритет (1-4, где 1 - Urgent, 2 - High, 3 - Medium, 4 - Low)
        assignee_id: ID пользователя для назначения задачи (опционально)
        project_id: ID проекта (опционально)
    
    Returns:
        Dict с информацией о созданной задаче:
        {
            "success": bool,
            "issue_id": str,
            "identifier": str,  # например, "ENG-123"
            "url": str,
            "error": str (если success=False)
        }
    """
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        return {
            "success": False,
            "error": "LINEAR_API_KEY не найден в переменных окружения"
        }
    
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    # Сначала получаем team_id
    team_id = None
    if team_key:
        # Получаем ID команды по ключу
        query = """
        query {
            teams {
                nodes {
                    id
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
            if response.status_code == 200:
                data = response.json()
                if "errors" not in data:
                    for team in data["data"]["teams"]["nodes"]:
                        if team["key"] == team_key:
                            team_id = team["id"]
                            break
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка при получении команды: {e}"
            }
    
    if not team_id:
        # Получаем первую доступную команду
        query = """
        query {
            teams {
                nodes {
                    id
                    key
                    name
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
            if response.status_code == 200:
                data = response.json()
                if "errors" not in data and data["data"]["teams"]["nodes"]:
                    team_id = data["data"]["teams"]["nodes"][0]["id"]
                else:
                    return {
                        "success": False,
                        "error": "Не найдено доступных команд в Linear"
                    }
            else:
                return {
                    "success": False,
                    "error": f"Ошибка HTTP при получении команд: {response.status_code}"
                }
        except Exception as e:
            return {
                "success": False,
                "error": f"Ошибка при получении команд: {e}"
            }
    
    # Создаем задачу
    mutation = """
    mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
            success
            issue {
                id
                identifier
                title
                url
            }
        }
    }
    """
    
    input_data = {
        "title": title,
        "description": description,
        "teamId": team_id,
        "priority": priority
    }
    
    if assignee_id:
        input_data["assigneeId"] = assignee_id
    
    if project_id:
        input_data["projectId"] = project_id
    
    variables = {"input": input_data}
    
    try:
        response = requests.post(
            LINEAR_API_URL,
            headers=headers,
            json={"query": mutation, "variables": variables}
        )
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Ошибка HTTP: {response.status_code} - {response.text}"
            }
        
        data = response.json()
        
        if "errors" in data:
            error_messages = [err.get("message", str(err)) for err in data["errors"]]
            return {
                "success": False,
                "error": "; ".join(error_messages)
            }
        
        if not data["data"]["issueCreate"]["success"]:
            return {
                "success": False,
                "error": "Не удалось создать задачу (success=false)"
            }
        
        issue = data["data"]["issueCreate"]["issue"]
        
        return {
            "success": True,
            "issue_id": issue["id"],
            "identifier": issue["identifier"],
            "title": issue["title"],
            "url": issue["url"]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": f"Ошибка при создании задачи: {e}"
        }


def get_teams() -> Dict:
    """Получить список доступных команд"""
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        return {
            "success": False,
            "error": "LINEAR_API_KEY не найден"
        }
    
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    query = """
    query {
        teams {
            nodes {
                id
                key
                name
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
            return {
                "success": False,
                "error": f"Ошибка HTTP: {response.status_code}"
            }
        
        data = response.json()
        
        if "errors" in data:
            return {
                "success": False,
                "error": data["errors"]
            }
        
        return {
            "success": True,
            "teams": data["data"]["teams"]["nodes"]
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


if __name__ == "__main__":
    # Тестовый запуск
    print("🧪 Тест создания задачи в Linear...\n")
    
    result = create_linear_task(
        title="Тестовая задача от AI",
        description="Это тестовая задача, созданная через API",
        priority=3
    )
    
    if result["success"]:
        print(f"✅ Задача создана успешно!")
        print(f"   ID: {result['identifier']}")
        print(f"   Название: {result['title']}")
        print(f"   URL: {result['url']}")
    else:
        print(f"❌ Ошибка: {result['error']}")


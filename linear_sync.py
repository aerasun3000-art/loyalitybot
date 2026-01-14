#!/usr/bin/env python3
"""
Скрипт для синхронизации задач MVP с Linear.app
Использует Linear GraphQL API для создания задач
"""

import os
import re
import requests
import json
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

# Linear API endpoint
LINEAR_API_URL = "https://api.linear.app/graphql"

class LinearSync:
    def __init__(self, api_key: str, team_id: Optional[str] = None):
        """
        Инициализация синхронизации с Linear
        
        Args:
            api_key: Linear API ключ (Personal API Key)
            team_id: ID команды в Linear (опционально, можно получить автоматически)
        """
        self.api_key = api_key
        self.team_id = team_id
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        
    def _make_request(self, query: str, variables: Dict = None) -> Dict:
        """Выполнить GraphQL запрос к Linear API"""
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
            
        response = requests.post(
            LINEAR_API_URL,
            headers=self.headers,
            json=payload
        )
        
        if response.status_code != 200:
            raise Exception(f"Linear API error: {response.status_code} - {response.text}")
            
        data = response.json()
        if "errors" in data:
            raise Exception(f"Linear GraphQL errors: {data['errors']}")
            
        return data["data"]
    
    def get_teams(self) -> List[Dict]:
        """Получить список команд"""
        query = """
        query {
            teams {
                nodes {
                    id
                    name
                    key
                }
            }
        }
        """
        data = self._make_request(query)
        return data["teams"]["nodes"]
    
    def get_team_id(self, team_key: Optional[str] = None) -> str:
        """Получить ID команды (по ключу или первую доступную)"""
        if self.team_id:
            return self.team_id
            
        teams = self.get_teams()
        
        if not teams:
            raise Exception("No teams found in Linear workspace")
        
        if team_key:
            for team in teams:
                if team["key"] == team_key:
                    return team["id"]
            raise Exception(f"Team with key '{team_key}' not found")
        
        # Возвращаем первую команду
        return teams[0]["id"]
    
    def get_project_id(self, project_name: str, team_id: str) -> Optional[str]:
        """Получить ID проекта по имени"""
        query = """
        query($teamId: String!) {
            team(id: $teamId) {
                projects {
                    nodes {
                        id
                        name
                    }
                }
            }
        }
        """
        data = self._make_request(query, {"teamId": team_id})
        projects = data["team"]["projects"]["nodes"]
        
        for project in projects:
            if project["name"] == project_name:
                return project["id"]
        return None
    
    def create_project(self, name: str, description: str, team_id: str) -> str:
        """Создать проект в Linear"""
        query = """
        mutation($input: ProjectCreateInput!) {
            projectCreate(input: $input) {
                success
                project {
                    id
                    name
                }
            }
        }
        """
        variables = {
            "input": {
                "name": name,
                "description": description,
                "teamIds": [team_id]
            }
        }
        data = self._make_request(query, variables)
        return data["projectCreate"]["project"]["id"]
    
    def create_issue(self, title: str, description: str, team_id: str, 
                     project_id: Optional[str] = None, 
                     priority: int = 3) -> str:
        """
        Создать задачу (issue) в Linear
        
        Args:
            title: Заголовок задачи
            description: Описание задачи
            team_id: ID команды
            project_id: ID проекта (опционально)
            priority: Приоритет (1-4, где 1 - Urgent, 4 - Low)
        
        Returns:
            ID созданной задачи
        """
        query = """
        mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
                success
                issue {
                    id
                    identifier
                    title
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
        
        if project_id:
            input_data["projectId"] = project_id
        
        variables = {"input": input_data}
        data = self._make_request(query, variables)
        
        if not data["issueCreate"]["success"]:
            raise Exception("Failed to create issue")
        
        issue = data["issueCreate"]["issue"]
        print(f"✅ Created: {issue['identifier']} - {issue['title']}")
        return issue["id"]
    
    def parse_mvp_tasks(self, file_path: str = "MVP_TASKS_LINEAR.md") -> List[Dict]:
        """Парсить задачи из MVP_TASKS_LINEAR.md"""
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        tasks = []
        current_category = None
        
        # Разделяем на секции
        sections = re.split(r'^##\s+(.+)$', content, flags=re.MULTILINE)
        
        for i in range(1, len(sections), 2):
            if i + 1 >= len(sections):
                break
                
            category = sections[i].strip()
            category_content = sections[i + 1]
            
            # Парсим задачи в секции
            task_pattern = r'###\s+(\d+)\.\s+(.+?)\n- (.+?)(?=\n###|\n---|\Z)'
            matches = re.finditer(task_pattern, category_content, re.DOTALL)
            
            for match in matches:
                task_num = match.group(1)
                title = match.group(2).strip()
                description = match.group(3).strip()
                
                tasks.append({
                    "number": int(task_num),
                    "title": title,
                    "description": description,
                    "category": category
                })
        
        return tasks
    
    def sync_tasks(self, team_key: Optional[str] = None, 
                   create_projects: bool = True) -> None:
        """
        Синхронизировать все задачи из MVP_TASKS_LINEAR.md
        
        Args:
            team_key: Ключ команды в Linear (например, "ENG" для ENGINE)
            create_projects: Создавать ли проекты для категорий
        """
        print("📋 Парсинг задач из MVP_TASKS_LINEAR.md...")
        tasks = self.parse_mvp_tasks()
        print(f"✅ Найдено {len(tasks)} задач\n")
        
        # Получаем team_id
        team_id = self.get_team_id(team_key)
        print(f"📦 Используется команда: {team_id}\n")
        
        # Группируем задачи по категориям
        categories = {}
        for task in tasks:
            cat = task["category"]
            if cat not in categories:
                categories[cat] = []
            categories[cat].append(task)
        
        # Создаем проекты для категорий
        project_ids = {}
        if create_projects:
            print("📁 Создание проектов для категорий...\n")
            for category, category_tasks in categories.items():
                project_id = self.get_project_id(category, team_id)
                
                if not project_id:
                    print(f"   Создаю проект: {category}")
                    project_id = self.create_project(
                        name=category,
                        description=f"Задачи категории {category}",
                        team_id=team_id
                    )
                else:
                    print(f"   Проект '{category}' уже существует")
                
                project_ids[category] = project_id
            print()
        
        # Создаем задачи
        print("🚀 Создание задач в Linear...\n")
        for category, category_tasks in categories.items():
            print(f"📂 {category}:")
            project_id = project_ids.get(category) if create_projects else None
            
            for task in sorted(category_tasks, key=lambda x: x["number"]):
                # Определяем приоритет (ENGINE задачи - выше приоритет)
                priority = 2 if "ENGINE" in category else 3
                
                # Формируем описание
                full_description = f"{task['description']}\n\n**Категория:** {category}"
                
                try:
                    self.create_issue(
                        title=task["title"],
                        description=full_description,
                        team_id=team_id,
                        project_id=project_id,
                        priority=priority
                    )
                except Exception as e:
                    print(f"❌ Ошибка при создании задачи '{task['title']}': {e}")
            
            print()
        
        print("✅ Синхронизация завершена!")


def main():
    """Главная функция"""
    # Получаем API ключ из переменной окружения
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        print("❌ Ошибка: не найден LINEAR_API_KEY")
        print("\nКак получить API ключ:")
        print("1. Зайдите в Linear.app")
        print("2. Settings → API → Personal API keys")
        print("3. Создайте новый ключ")
        print("4. Добавьте в .env файл:")
        print("   LINEAR_API_KEY=lin_api_...")
        print("\n   Или установите переменную окружения:")
        print("   export LINEAR_API_KEY='lin_api_...'")
        return
    
    # Проверяем формат ключа
    if not api_key.startswith("lin_api_"):
        print("⚠️  Предупреждение: API ключ должен начинаться с 'lin_api_'")
        print("   Убедитесь, что вы используете Personal API Key, а не OAuth токен")
    
    # Создаем экземпляр синхронизатора
    sync = LinearSync(api_key=api_key)
    
    # Показываем доступные команды
    print("📋 Доступные команды в Linear:\n")
    teams = sync.get_teams()
    for team in teams:
        print(f"   - {team['name']} (key: {team['key']})")
    print()
    
    # Запускаем синхронизацию
    try:
        sync.sync_tasks(create_projects=True)
    except Exception as e:
        print(f"❌ Ошибка синхронизации: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()


#!/usr/bin/env python3
"""
Скрипт для создания и управления тегами MoSCoW в Linear
Реализует методологию MoSCoW для приоритизации задач

MoSCoW категории:
- Must have - без этого проект/спринт не имеет смысла
- Should have - очень желательно, но можно перенести
- Could have - "хорошо бы", делают только если есть запас времени
- Won't have (now) - сознательно не делаем сейчас
"""

import os
import requests
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Загружаем переменные окружения
load_dotenv()

LINEAR_API_URL = "https://api.linear.app/graphql"

# Определение тегов MoSCoW
MOSCOW_TAGS = {
    "must-have": {
        "name": "Must have",
        "description": "Без этого проект/спринт не имеет смысла. Если Must не сделаны, остальное не важно.",
        "color": "#DC2626",  # Красный
        "priority": 1
    },
    "should-have": {
        "name": "Should have",
        "description": "Очень желательно, но можно перенести, если не влезает по времени/ресурсам.",
        "color": "#F59E0B",  # Оранжевый
        "priority": 2
    },
    "could-have": {
        "name": "Could have",
        "description": "«Хорошо бы», делают, только если есть запас времени/денег.",
        "color": "#10B981",  # Зелёный
        "priority": 3
    },
    "wont-have": {
        "name": "Won't have (now)",
        "description": "Сознательно не делаем сейчас, убираем шум из головы и бэклога.",
        "color": "#6B7280",  # Серый
        "priority": 4
    }
}


class LinearMoscowTags:
    """Управление тегами MoSCoW в Linear"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        self.workspace_id = None
        self.tag_ids = {}
    
    def _make_request(self, query: str, variables: Dict = None) -> Dict:
        """Выполнить GraphQL запрос"""
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
    
    def get_workspace_id(self) -> str:
        """Получить ID workspace"""
        if self.workspace_id:
            return self.workspace_id
        
        query = """
        query {
            viewer {
                id
                organization {
                    id
                }
            }
        }
        """
        data = self._make_request(query)
        self.workspace_id = data["viewer"]["organization"]["id"]
        return self.workspace_id
    
    def get_existing_labels(self, team_id: Optional[str] = None) -> Dict[str, str]:
        """Получить существующие labels (теги) для команды"""
        # Сначала получаем команды
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
            data = self._make_request(query)
            teams = data["teams"]["nodes"]
            
            if not teams:
                return {}
            
            # Используем указанную команду или первую доступную
            target_team_id = team_id or teams[0]["id"]
            
            # Получаем labels для команды - используем правильное поле "labels"
            query_labels = """
            query($teamId: String!) {
                team(id: $teamId) {
                    labels {
                        nodes {
                            id
                            name
                        }
                    }
                }
            }
            """
            
            data = self._make_request(query_labels, {"teamId": target_team_id})
            labels = {}
            
            if data.get("team") and data["team"].get("labels"):
                for label in data["team"]["labels"]["nodes"]:
                    labels[label["name"].lower()] = label["id"]
            
            return labels
        except Exception as e:
            print(f"⚠️  Ошибка при получении существующих labels: {e}")
            return {}
    
    def create_label(self, name: str, description: str, color: str, team_id: Optional[str] = None) -> Optional[str]:
        """Создать label (тег) в Linear"""
        # В Linear labels создаются на уровне команды
        # Сначала получаем команды
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
            data = self._make_request(query)
            teams = data["teams"]["nodes"]
            
            if not teams:
                raise Exception("Не найдено команд в Linear")
            
            # Используем указанную команду или первую доступную
            target_team_id = team_id or teams[0]["id"]
            
            # Создаём label через команду
            mutation = """
            mutation($input: IssueLabelCreateInput!) {
                issueLabelCreate(input: $input) {
                    success
                    issueLabel {
                        id
                        name
                        color
                    }
                }
            }
            """
            
            variables = {
                "input": {
                    "name": name,
                    "color": color,
                    "teamId": target_team_id
                }
            }
            
            data = self._make_request(mutation, variables)
            
            if data["issueLabelCreate"]["success"]:
                label_id = data["issueLabelCreate"]["issueLabel"]["id"]
                print(f"✅ Создан тег: {name} (ID: {label_id})")
                return label_id
            else:
                print(f"❌ Не удалось создать тег: {name}")
                return None
                
        except Exception as e:
            print(f"❌ Ошибка при создании тега '{name}': {e}")
            # Выводим детали ошибки для отладки
            import traceback
            traceback.print_exc()
            return None
    
    def create_all_moscow_tags(self, team_id: Optional[str] = None, all_teams: bool = True) -> Dict[str, Dict[str, str]]:
        """
        Создать все теги MoSCoW для всех команд или указанной команды
        
        Args:
            team_id: ID команды (если None и all_teams=False, используется первая команда)
            all_teams: Если True, создаёт теги для всех команд
        
        Returns:
            Dict с ключами команд и значениями - словарями тегов {tag_key: tag_id}
        """
        print("🏷️  Создание тегов MoSCoW в Linear...\n")
        
        # Получаем список всех команд
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
        
        data = self._make_request(query)
        teams = data["teams"]["nodes"]
        
        if not teams:
            print("❌ Не найдено команд в Linear")
            return {}
        
        # Определяем, для каких команд создавать теги
        if all_teams:
            target_teams = teams
            print(f"📋 Создание тегов для всех команд ({len(target_teams)} команд)...\n")
        else:
            target_team_id = team_id or teams[0]["id"]
            target_teams = [t for t in teams if t["id"] == target_team_id]
            if not target_teams:
                target_teams = [teams[0]]
        
        all_created_tags = {}
        
        for team in target_teams:
            team_name = team.get("name", team.get("key", "Unknown"))
            print(f"📦 Команда: {team_name}")
            
            # Получаем существующие labels для команды
            existing_labels = self.get_existing_labels(team["id"])
            created_tags = {}
            
            for tag_key, tag_info in MOSCOW_TAGS.items():
                tag_name = tag_info["name"]
                tag_name_lower = tag_name.lower()
                
                # Проверяем, существует ли уже такой тег
                if tag_name_lower in existing_labels:
                    tag_id = existing_labels[tag_name_lower]
                    print(f"   ℹ️  Тег '{tag_name}' уже существует")
                    created_tags[tag_key] = tag_id
                else:
                    # Создаём новый тег
                    tag_id = self.create_label(
                        name=tag_name,
                        description=tag_info["description"],
                        color=tag_info["color"],
                        team_id=team["id"]
                    )
                    if tag_id:
                        created_tags[tag_key] = tag_id
            
            all_created_tags[team["id"]] = created_tags
            print()
        
        # Сохраняем теги первой команды для обратной совместимости
        if all_created_tags:
            first_team_id = list(all_created_tags.keys())[0]
            self.tag_ids = all_created_tags[first_team_id]
        
        return all_created_tags
    
    def add_label_to_issue(self, issue_id: str, label_id: str) -> bool:
        """Добавить тег к задаче"""
        # Сначала получаем текущие labels задачи
        query = """
        query($issueId: String!) {
            issue(id: $issueId) {
                id
                labels {
                    nodes {
                        id
                    }
                }
            }
        }
        """
        
        try:
            # Получаем текущие labels
            data = self._make_request(query, {"issueId": issue_id})
            current_labels = [label["id"] for label in data["issue"]["labels"]["nodes"]]
            
            # Добавляем новый label, если его ещё нет
            if label_id not in current_labels:
                current_labels.append(label_id)
            
            # Обновляем задачу
            mutation = """
            mutation($issueId: String!, $input: IssueUpdateInput!) {
                issueUpdate(id: $issueId, input: $input) {
                    success
                    issue {
                        id
                        identifier
                    }
                }
            }
            """
            
            data = self._make_request(mutation, {
                "issueId": issue_id,
                "input": {
                    "labelIds": current_labels
                }
            })
            
            if data["issueUpdate"]["success"]:
                return True
            else:
                return False
        except Exception as e:
            print(f"❌ Ошибка при добавлении тега к задаче: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def get_all_issues(self, team_key: Optional[str] = None) -> List[Dict]:
        """Получить все задачи"""
        query = """
        query {
            issues {
                nodes {
                    id
                    identifier
                    title
                    labels {
                        nodes {
                            id
                            name
                        }
                    }
                }
            }
        }
        """
        
        try:
            data = self._make_request(query)
            return data["issues"]["nodes"]
        except Exception as e:
            print(f"❌ Ошибка при получении задач: {e}")
            return []
    
    def assign_moscow_tag_to_issue(self, issue_identifier: str, moscow_category: str) -> bool:
        """Присвоить тег MoSCoW задаче по identifier (например, ENG-123)"""
        if moscow_category not in MOSCOW_TAGS:
            print(f"❌ Неизвестная категория MoSCoW: {moscow_category}")
            return False
        
        # Ищем задачу по identifier - используем правильный формат фильтра
        query = """
        query {
            issues {
                nodes {
                    id
                    identifier
                    title
                    team {
                        id
                    }
                }
            }
        }
        """
        
        try:
            # Получаем все задачи и ищем по identifier
            data = self._make_request(query)
            issues = data.get("issues", {}).get("nodes", [])
            
            # Ищем задачу по identifier
            issue = None
            for i in issues:
                if i.get("identifier") == issue_identifier:
                    issue = i
                    break
            
            if not issue:
                print(f"❌ Задача {issue_identifier} не найдена")
                return False
            
            issue_id = issue["id"]
            issue_team_id = issue.get("team", {}).get("id")
            
            # Получаем теги для команды задачи
            if not issue_team_id:
                print(f"❌ Не удалось определить команду для задачи {issue_identifier}")
                return False
            
            # Получаем существующие labels для команды задачи
            existing_labels = self.get_existing_labels(issue_team_id)
            tag_name = MOSCOW_TAGS[moscow_category]["name"]
            tag_name_lower = tag_name.lower()
            
            # Ищем тег в команде задачи
            tag_id = existing_labels.get(tag_name_lower)
            
            if not tag_id:
                # Если тега нет, создаём его для этой команды
                print(f"   ⚠️  Тег '{tag_name}' не найден в команде, создаём...")
                tag_id = self.create_label(
                    name=tag_name,
                    description=MOSCOW_TAGS[moscow_category]["description"],
                    color=MOSCOW_TAGS[moscow_category]["color"],
                    team_id=issue_team_id
                )
                if not tag_id:
                    print(f"❌ Не удалось создать тег для команды")
                    return False
            
            # Добавляем тег
            return self.add_label_to_issue(issue_id, tag_id)
            
        except Exception as e:
            print(f"❌ Ошибка при присвоении тега: {e}")
            import traceback
            traceback.print_exc()
            return False


def main():
    """Главная функция"""
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        print("❌ Ошибка: не найден LINEAR_API_KEY")
        print("\nКак получить API ключ:")
        print("1. Зайдите в Linear.app")
        print("2. Settings → Security & Access → Personal API keys")
        print("3. Создайте новый ключ")
        print("4. Добавьте в .env файл:")
        print("   LINEAR_API_KEY=lin_api_...")
        return
    
    # Создаём экземпляр
    moscow = LinearMoscowTags(api_key)
    
    # Создаём все теги для всех команд
    print("=" * 60)
    print("🏷️  СОЗДАНИЕ ТЕГОВ MOSCOW В LINEAR")
    print("=" * 60)
    print()
    
    all_tags = moscow.create_all_moscow_tags(all_teams=True)
    
    print()
    print("=" * 60)
    print("✅ ГОТОВО!")
    print("=" * 60)
    print()
    print("Созданные теги для всех команд:")
    for team_id, tags in all_tags.items():
        print(f"\nКоманда (ID: {team_id[:8]}...):")
        for tag_key, tag_id in tags.items():
            tag_info = MOSCOW_TAGS[tag_key]
            print(f"  • {tag_info['name']} - {tag_info['description']}")
    print()
    print("Теперь вы можете использовать эти теги для приоритизации задач!")
    print()
    print("Пример использования:")
    print("  python3 linear_moscow_tags.py --assign ENG-123 must-have")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--assign":
        # Режим присвоения тега
        if len(sys.argv) < 4:
            print("Использование: python3 linear_moscow_tags.py --assign <ISSUE_ID> <MOSCOW_CATEGORY>")
            print("Категории: must-have, should-have, could-have, wont-have")
            sys.exit(1)
        
        issue_id = sys.argv[2]
        category = sys.argv[3]
        
        api_key = os.getenv("LINEAR_API_KEY")
        if not api_key:
            print("❌ LINEAR_API_KEY не найден")
            sys.exit(1)
        
        moscow = LinearMoscowTags(api_key)
        moscow.create_all_moscow_tags()
        success = moscow.assign_moscow_tag_to_issue(issue_id, category)
        
        if success:
            print(f"✅ Тег '{MOSCOW_TAGS[category]['name']}' присвоен задаче {issue_id}")
        else:
            print(f"❌ Не удалось присвоить тег")
    else:
        main()

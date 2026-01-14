#!/usr/bin/env python3
"""
Скрипт для создания ERP структуры в Linear.app
На основе ERP_NOTION_TZ.md
"""

import os
import requests
from typing import List, Dict, Optional
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

LINEAR_API_URL = "https://api.linear.app/graphql"


class LinearERPSetup:
    def __init__(self, api_key: str):
        """Инициализация"""
        self.api_key = api_key
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        self.created_teams = {}
        self.created_projects = {}
        
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
    
    def get_teams(self) -> List[Dict]:
        """Получить все команды"""
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
    
    def get_team_by_name(self, name: str) -> Optional[str]:
        """Найти команду по имени"""
        teams = self.get_teams()
        for team in teams:
            if team["name"].upper() == name.upper():
                return team["id"]
        return None
    
    def create_team(self, name: str, key: str, description: str = "") -> str:
        """Создать команду (Team) в Linear"""
        # Проверяем, существует ли уже
        existing_id = self.get_team_by_name(name)
        if existing_id:
            print(f"   ✓ Команда '{name}' уже существует")
            return existing_id
        
        query = """
        mutation($input: TeamCreateInput!) {
            teamCreate(input: $input) {
                success
                team {
                    id
                    name
                    key
                }
            }
        }
        """
        variables = {
            "input": {
                "name": name,
                "key": key,
                "description": description
            }
        }
        
        try:
            data = self._make_request(query, variables)
            if data["teamCreate"]["success"]:
                team = data["teamCreate"]["team"]
                print(f"   ✅ Создана команда: {team['name']} (key: {team['key']})")
                return team["id"]
            else:
                raise Exception("Failed to create team")
        except Exception as e:
            # Возможно, команда уже существует или ключ занят
            print(f"   ⚠️  Не удалось создать команду '{name}': {e}")
            # Пробуем найти существующую
            existing_id = self.get_team_by_name(name)
            if existing_id:
                return existing_id
            raise
    
    def get_projects(self, team_id: str) -> List[Dict]:
        """Получить проекты команды"""
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
        return data["team"]["projects"]["nodes"]
    
    def create_project(self, name: str, description: str, team_id: str) -> str:
        """Создать проект"""
        # Проверяем, существует ли уже
        projects = self.get_projects(team_id)
        for project in projects:
            if project["name"] == name:
                print(f"      ✓ Проект '{name}' уже существует")
                return project["id"]
        
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
        
        try:
            data = self._make_request(query, variables)
            if data["projectCreate"]["success"]:
                project = data["projectCreate"]["project"]
                print(f"      ✅ Создан проект: {project['name']}")
                return project["id"]
            else:
                raise Exception("Failed to create project")
        except Exception as e:
            print(f"      ⚠️  Не удалось создать проект '{name}': {e}")
            # Пробуем найти существующий
            projects = self.get_projects(team_id)
            for project in projects:
                if project["name"] == name:
                    return project["id"]
            raise
    
    def setup_erp_structure(self, use_existing_teams: bool = True):
        """Создать полную ERP структуру"""
        print("🏢 Создание ERP структуры в Linear...\n")
        
        # Получаем существующие команды
        existing_teams = self.get_teams()
        print(f"📋 Найдено существующих команд: {len(existing_teams)}\n")
        
        # Маппинг отделов к существующим командам
        # ENGINE команда для технических отделов
        # MARK команда для бизнес-отделов
        engine_team = None
        mark_team = None
        
        for team in existing_teams:
            if team["key"] in ["ENGI", "ENG", "DEV"] or "ENGINE" in team["name"].upper():
                engine_team = team["id"]
            elif team["key"] in ["MAR", "MARK", "MKT"] or "MARK" in team["name"].upper():
                mark_team = team["id"]
        
        # Используем первую команду как fallback
        if not engine_team:
            engine_team = existing_teams[0]["id"] if existing_teams else None
        if not mark_team:
            mark_team = existing_teams[-1]["id"] if len(existing_teams) > 1 else engine_team
        
        print(f"🔧 Используем команды:")
        print(f"   - ENGINE/DEV команда: {engine_team}")
        print(f"   - MARK команда: {mark_team}\n")
        
        # Определяем отделы и их проекты
        departments = {
            "Development": {
                "key": "DEV",
                "description": "Разработка новых функций, поддержка кода, тестирование, деплой",
                "projects": [
                    ("Backend разработка", "Разработка ботов и API"),
                    ("Frontend разработка", "Разработка Web App"),
                    ("Интеграции", "Интеграции с Square, 1C, CRM"),
                    ("DevOps и инфраструктура", "Деплой, мониторинг, масштабирование")
                ]
            },
            "Product": {
                "key": "PROD",
                "description": "Планирование roadmap, приоритизация, user research, аналитика",
                "projects": [
                    ("Roadmap разработки", "Планирование и приоритизация функций"),
                    ("User research", "Исследования пользователей и интервью"),
                    ("Аналитика и метрики", "Отслеживание продуктовых метрик"),
                    ("A/B тесты", "Тестирование гипотез и функций")
                ]
            },
            "Marketing": {
                "key": "MARK",
                "description": "Контент-маркетинг, соцсети, email, события, партнерский маркетинг",
                "projects": [
                    ("Контент-стратегия", "Планирование и создание контента"),
                    ("Instagram Outreach", "Привлечение партнеров через Instagram"),
                    ("Email-кампании", "Email-маркетинг и рассылки"),
                    ("Вебинары и события", "Организация мероприятий"),
                    ("SEO и контент", "Оптимизация и контент-маркетинг")
                ]
            },
            "Sales": {
                "key": "SALES",
                "description": "Входящие и исходящие продажи, демо-звонки, закрытие сделок",
                "projects": [
                    ("Воронка продаж", "Управление воронкой продаж"),
                    ("Демо-процессы", "Процессы демонстрации продукта"),
                    ("Скрипты продаж", "Разработка и оптимизация скриптов"),
                    ("CRM настройка", "Настройка и интеграция CRM")
                ]
            },
            "Customer Success": {
                "key": "CS",
                "description": "Онбординг партнеров, поддержка, обучение, сбор обратной связи",
                "projects": [
                    ("Онбординг процессы", "Процессы онбординга новых партнеров"),
                    ("База знаний", "Создание и поддержка документации"),
                    ("Обучение партнеров", "Обучение работе с системой"),
                    ("Программы лояльности", "Развитие программ лояльности")
                ]
            },
            "Operations": {
                "key": "OPS",
                "description": "Модерация партнеров и контента, управление акциями и услугами",
                "projects": [
                    ("Процессы модерации", "Модерация партнеров и контента"),
                    ("Управление контентом", "Управление акциями и услугами"),
                    ("Операционные процессы", "Оптимизация операционных процессов"),
                    ("Автоматизация операций", "Автоматизация рутинных задач")
                ]
            },
            "Finance": {
                "key": "FIN",
                "description": "Финансовое планирование, управление подписками, Revenue Share",
                "projects": [
                    ("Финансовое планирование", "Планирование и бюджетирование"),
                    ("Автоматизация расчетов", "Автоматизация Revenue Share и расчетов"),
                    ("Финансовая отчетность", "Отчеты и аналитика"),
                    ("Бюджет и прогнозы", "Бюджетирование и прогнозирование")
                ]
            },
            "Content": {
                "key": "CONT",
                "description": "Создание новостей, переводы, промо-материалы, документация",
                "projects": [
                    ("Контент-календарь", "Планирование публикаций"),
                    ("Переводы контента", "Переводы RU/EN через AI"),
                    ("Промо-материалы", "Создание промо-материалов"),
                    ("Документация", "Техническая и пользовательская документация")
                ]
            }
        }
        
        # Распределяем отделы по командам
        tech_departments = ["Development", "Product", "Operations"]
        business_departments = ["Marketing", "Sales", "Customer Success", "Finance", "Content"]
        
        # Создаем проекты для отделов
        print("📦 Создание проектов для отделов...\n")
        for dept_name, dept_info in departments.items():
            print(f"🏢 {dept_name}:")
            
            # Выбираем команду в зависимости от типа отдела
            if dept_name in tech_departments:
                team_id = engine_team
                team_name = "ENGINE"
            else:
                team_id = mark_team
                team_name = "MARK"
            
            if not team_id:
                print(f"   ⚠️  Пропущено: нет доступной команды")
                continue
            
            self.created_teams[dept_name] = team_id
            print(f"   📍 Команда: {team_name}")
            
            # Создаем проекты для команды
            if dept_info["projects"]:
                print(f"   📁 Проекты:")
                for project_name, project_desc in dept_info["projects"]:
                    project_id = self.create_project(
                        name=project_name,
                        description=project_desc,
                        team_id=team_id
                    )
                    self.created_projects[f"{dept_name} - {project_name}"] = project_id
            
            print()
        
        # Создаем общие проекты из примеров
        print("📋 Создание общих проектов...\n")
        
        # Используем первую команду для общих проектов (или можно создать отдельную команду)
        first_team_id = list(self.created_teams.values())[0] if self.created_teams else None
        
        # Создаем общие проекты из примеров
        if engine_team and mark_team:
            common_projects = [
                ("Интеграция с Square POS", "Интеграция с Square POS системой", engine_team),
                ("Улучшение аналитики для партнеров", "Улучшение дашбордов и метрик для партнеров", engine_team),
                ("Instagram Outreach кампания Q1", "Кампания по привлечению партнеров через Instagram", mark_team),
                ("Онбординг новых партнеров", "Процессы и материалы для онбординга", mark_team)
            ]
            
            for project_name, project_desc, team_id in common_projects:
                print(f"   📁 {project_name}:")
                self.create_project(
                    name=project_name,
                    description=project_desc,
                    team_id=team_id
                )
                print()
        
        print("✅ ERP структура создана!\n")
        
        # Выводим итоговую информацию
        print("📊 Итоговая структура:")
        print(f"   - Отделов настроено: {len(self.created_teams)}")
        print(f"   - Проектов создано: {len(self.created_projects)}")
        print("\n📋 Структура отделов:")
        print("   🔧 ENGINE команда (технические отделы):")
        for dept in tech_departments:
            if dept in self.created_teams:
                print(f"      - {dept}")
        print("   💼 MARK команда (бизнес-отделы):")
        for dept in business_departments:
            if dept in self.created_teams:
                print(f"      - {dept}")
        print("\n🎯 Следующие шаги:")
        print("   1. Откройте Linear.app и проверьте созданную структуру")
        print("   2. Проекты созданы в существующих командах ENGINE и MARK")
        print("   3. Начните создавать задачи в соответствующих проектах")
        print("   4. Используйте проекты для группировки задач по отделам")
        print("   5. При необходимости создайте дополнительные команды вручную")


def main():
    """Главная функция"""
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        print("❌ Ошибка: не найден LINEAR_API_KEY")
        print("Добавьте в .env файл: LINEAR_API_KEY=lin_api_...")
        return
    
    if not api_key.startswith("lin_api_"):
        print("⚠️  Предупреждение: API ключ должен начинаться с 'lin_api_'")
    
    try:
        setup = LinearERPSetup(api_key=api_key)
        setup.setup_erp_structure()
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()


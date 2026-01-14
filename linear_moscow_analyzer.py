#!/usr/bin/env python3
"""
Анализатор задач для присвоения тегов MoSCoW
Анализирует задачи из Linear и предлагает категории MoSCoW на основе критериев
"""

import os
import requests
from typing import List, Dict, Optional
from dotenv import load_dotenv
from linear_moscow_tags import LinearMoscowTags, MOSCOW_TAGS

load_dotenv()

LINEAR_API_URL = "https://api.linear.app/graphql"


class MoscowAnalyzer:
    """Анализатор задач для MoSCoW приоритизации"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": api_key,
            "Content-Type": "application/json"
        }
        self.moscow_manager = LinearMoscowTags(api_key)
    
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
    
    def get_all_issues(self, team_key: Optional[str] = None) -> List[Dict]:
        """Получить все задачи"""
        query = """
        query {
            issues {
                nodes {
                    id
                    identifier
                    title
                    description
                    priority
                    state {
                        name
                        type
                    }
                    labels {
                        nodes {
                            id
                            name
                        }
                    }
                    team {
                        key
                        name
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
    
    def analyze_issue_for_moscow(self, issue: Dict) -> str:
        """
        Анализировать задачу и определить категорию MoSCoW
        
        Критерии:
        - Must: Критичные баги, блокеры релиза, обязательные фичи для MVP
        - Should: Важные улучшения, но не блокеры
        - Could: Nice-to-have, улучшения UX
        - Won't: Не в приоритете, можно отложить
        """
        title = issue.get("title", "").lower()
        description = issue.get("description", "").lower()
        priority = issue.get("priority", 3)  # 1=Urgent, 2=High, 3=Medium, 4=Low
        state = issue.get("state", {}).get("name", "").lower()
        
        # Ключевые слова для Must have
        must_keywords = [
            "критичн", "блокер", "баг", "ошибка", "не работает", "сломан",
            "безопасность", "gdpr", "privacy", "legal", "юридическ",
            "mvp", "обязательн", "необходим", "требуется", "нужно",
            "релиз", "запуск", "деплой", "production", "prod"
        ]
        
        # Ключевые слова для Should have
        should_keywords = [
            "улучшен", "оптимизац", "производительность", "скорость",
            "аналитика", "отчет", "дашборд", "метрики",
            "интеграц", "api", "webhook", "синхронизац",
            "важн", "желательно", "рекомендуется"
        ]
        
        # Ключевые слова для Could have
        could_keywords = [
            "nice-to-have", "хорошо бы", "можно", "опционально",
            "улучшение ux", "дизайн", "анимация", "украшение",
            "геймификац", "бонус", "дополнительно"
        ]
        
        # Ключевые слова для Won't have
        wont_keywords = [
            "будущее", "потом", "отложить", "не сейчас",
            "эксперимент", "исследование", "proof of concept",
            "не приоритет", "низкий приоритет"
        ]
        
        # Проверяем наличие ключевых слов
        text = f"{title} {description}"
        
        # Проверка Must
        for keyword in must_keywords:
            if keyword in text:
                return "must-have"
        
        # Проверка приоритета (Urgent = Must)
        if priority == 1:
            return "must-have"
        
        # Проверка Won't
        for keyword in wont_keywords:
            if keyword in text:
                return "wont-have"
        
        # Проверка приоритета (Low = Could или Won't)
        if priority == 4:
            return "could-have"
        
        # Проверка Should
        for keyword in should_keywords:
            if keyword in text:
                return "should-have"
        
        # Проверка Could
        for keyword in could_keywords:
            if keyword in text:
                return "could-have"
        
        # По умолчанию на основе приоритета
        if priority == 2:
            return "should-have"
        elif priority == 3:
            return "could-have"
        else:
            return "could-have"
    
    def analyze_all_issues(self, auto_assign: bool = False) -> Dict:
        """Проанализировать все задачи и предложить категории MoSCoW"""
        print("📊 Анализ задач для присвоения тегов MoSCoW...\n")
        
        issues = self.get_all_issues()
        
        if not issues:
            print("❌ Задачи не найдены")
            return {}
        
        analysis = {
            "must-have": [],
            "should-have": [],
            "could-have": [],
            "wont-have": []
        }
        
        # Убеждаемся, что теги созданы
        self.moscow_manager.create_all_moscow_tags()
        
        print(f"Найдено задач: {len(issues)}\n")
        print("=" * 80)
        
        for issue in issues:
            identifier = issue.get("identifier", "N/A")
            title = issue.get("title", "Без названия")
            
            # Проверяем, есть ли уже тег MoSCoW
            existing_labels = [label["name"] for label in issue.get("labels", {}).get("nodes", [])]
            has_moscow_tag = any(tag["name"] in existing_labels for tag in MOSCOW_TAGS.values())
            
            if has_moscow_tag:
                print(f"⏭️  {identifier}: {title[:50]}... (уже имеет тег MoSCoW)")
                continue
            
            # Анализируем задачу
            category = self.analyze_issue_for_moscow(issue)
            category_name = MOSCOW_TAGS[category]["name"]
            
            analysis[category].append({
                "identifier": identifier,
                "title": title,
                "id": issue.get("id")
            })
            
            print(f"📌 {identifier}: {title[:50]}...")
            print(f"   → {category_name}")
            
            if auto_assign:
                success = self.moscow_manager.assign_moscow_tag_to_issue(identifier, category)
                if success:
                    print(f"   ✅ Тег присвоен")
                else:
                    print(f"   ❌ Ошибка при присвоении тега")
            print()
        
        print("=" * 80)
        print("\n📊 СТАТИСТИКА:")
        print(f"  Must have:     {len(analysis['must-have'])}")
        print(f"  Should have:  {len(analysis['should-have'])}")
        print(f"  Could have:   {len(analysis['could-have'])}")
        print(f"  Won't have:   {len(analysis['wont-have'])}")
        
        return analysis


def main():
    """Главная функция"""
    import sys
    
    api_key = os.getenv("LINEAR_API_KEY")
    
    if not api_key:
        print("❌ Ошибка: не найден LINEAR_API_KEY")
        return
    
    auto_assign = "--assign" in sys.argv
    
    analyzer = MoscowAnalyzer(api_key)
    analysis = analyzer.analyze_all_issues(auto_assign=auto_assign)
    
    if not auto_assign:
        print("\n💡 Для автоматического присвоения тегов запустите:")
        print("   python3 linear_moscow_analyzer.py --assign")


if __name__ == "__main__":
    main()

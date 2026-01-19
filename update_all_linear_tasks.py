#!/usr/bin/env python3
"""
Скрипт для получения всех задач из Linear и обновления их описаний по новому шаблону

Использование:
    python3 update_all_linear_tasks.py --team ENGI --dry-run  # Показать что будет обновлено
    python3 update_all_linear_tasks.py --team ENGI --yes  # Обновить все задачи
"""

import os
import sys
import requests
import time
from typing import List, Dict, Optional
from dotenv import load_dotenv

load_dotenv()

LINEAR_API_URL = "https://api.linear.app/graphql"

def get_linear_api_key():
    """Получить API ключ Linear"""
    api_key = os.getenv("LINEAR_API_KEY")
    if not api_key:
        raise ValueError("LINEAR_API_KEY не найден в переменных окружения. Добавьте его в .env файл.")
    return api_key

def get_all_issues_for_team(team_id: str) -> List[Dict]:
    """Получить все задачи команды из Linear"""
    api_key = get_linear_api_key()
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    query = """
    query($after: String, $teamId: ID!) {
        issues(
            first: 100,
            after: $after,
            filter: { 
                team: { id: { eq: $teamId } }
            }
        ) {
            nodes {
                id
                identifier
                title
                description
                state {
                    name
                }
                priority
            }
            pageInfo {
                hasNextPage
                endCursor
            }
        }
    }
    """
    
    all_issues = []
    cursor = None
    
    while True:
        variables = {"teamId": team_id}
        if cursor:
            variables["after"] = cursor
        
        try:
            response = requests.post(
                LINEAR_API_URL,
                headers=headers,
                json={"query": query, "variables": variables}
            )
            
            if response.status_code != 200:
                print(f"❌ Ошибка HTTP: {response.status_code}")
                break
            
            data = response.json()
            
            if "errors" in data:
                print(f"❌ Ошибки GraphQL: {data['errors']}")
                break
            
            issues = data["data"]["issues"]["nodes"]
            all_issues.extend(issues)
            
            page_info = data["data"]["issues"]["pageInfo"]
            if not page_info["hasNextPage"]:
                break
            
            cursor = page_info["endCursor"]
            
        except Exception as e:
            print(f"❌ Ошибка при получении задач: {e}")
            break
    
    return all_issues

def update_issue_description(issue_id: str, description: str) -> bool:
    """Обновить описание задачи в Linear"""
    api_key = get_linear_api_key()
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json"
    }
    
    mutation = """
    mutation($issueId: String!, $description: String!) {
        issueUpdate(id: $issueId, input: { description: $description }) {
            success
            issue {
                id
                identifier
                title
            }
        }
    }
    """
    
    try:
        response = requests.post(
            LINEAR_API_URL,
            headers=headers,
            json={"query": mutation, "variables": {"issueId": issue_id, "description": description}}
        )
        
        if response.status_code != 200:
            return False
        
        data = response.json()
        
        if "errors" in data:
            return False
        
        return data["data"]["issueUpdate"]["success"]
        
    except Exception as e:
        print(f"❌ Ошибка при обновлении задачи {issue_id}: {e}")
        return False

def create_task_description_from_existing(title: str, old_description: str) -> str:
    """Создать новое описание задачи по шаблону на основе существующего"""
    
    # Пытаемся извлечь информацию из старого описания
    # Если описание уже в новом формате, возвращаем как есть
    if "## 🎯 Контекст" in old_description:
        return old_description
    
    # Анализируем задачу по названию и старому описанию
    # Создаем базовую структуру
    
    # Определяем тип задачи по названию
    is_test = "тест" in title.lower() or "test" in title.lower()
    is_feature = "функция" in title.lower() or "feature" in title.lower() or "реализовать" in title.lower()
    is_bug = "баг" in title.lower() or "bug" in title.lower() or "исправить" in title.lower() or "fix" in title.lower()
    is_improvement = "улучшить" in title.lower() or "improve" in title.lower() or "оптимизировать" in title.lower()
    
    # Формируем контекст в зависимости от типа задачи
    if is_test:
        context_problem = f"Необходимо протестировать: {title}. После миграции на Cloudflare нужно убедиться, что функция работает корректно."
        context_situation = "После миграции на Cloudflare многие функции могли перестать работать. Необходимо проверить работоспособность."
        context_why = "Тестирование критично для стабильности системы. Без проверки мы не можем быть уверены, что система работает правильно."
        goal_what = f"Протестировать и убедиться, что {title.lower()} работает корректно в новой системе Cloudflare."
        goal_why = "Чтобы убедиться, что функция работает как задумано и пользователи могут ее использовать."
        goal_benefits = "Система будет протестирована. Мы будем уверены, что все работает. Пользователи смогут использовать функцию."
    elif is_bug:
        context_problem = f"Обнаружена проблема: {title}. Функция не работает или работает некорректно."
        context_situation = "Проблема влияет на работу системы или пользовательский опыт. Необходимо исправить."
        context_why = "Исправление багов критично для стабильности системы. Пользователи не должны сталкиваться с ошибками."
        goal_what = f"Исправить проблему: {title.lower()}."
        goal_why = "Чтобы система работала стабильно и пользователи не сталкивались с ошибками."
        goal_benefits = "Проблема будет исправлена. Система будет работать стабильно. Пользователи не будут видеть ошибок."
    elif is_feature:
        context_problem = f"Необходимо реализовать функцию: {title}. Эта функция нужна для улучшения системы."
        context_situation = "Функция отсутствует в системе, но необходима для работы или улучшения пользовательского опыта."
        context_why = "Реализация функции улучшит систему и даст пользователям новые возможности."
        goal_what = f"Реализовать функцию: {title.lower()}."
        goal_why = "Чтобы улучшить систему и дать пользователям новые возможности."
        goal_benefits = "Функция будет реализована. Система станет лучше. Пользователи получат новые возможности."
    elif is_improvement:
        context_problem = f"Необходимо улучшить: {title}. Текущая реализация может быть оптимизирована или улучшена."
        context_situation = "Функция работает, но может быть улучшена для лучшей производительности или пользовательского опыта."
        context_why = "Улучшение функции повысит качество системы и удовлетворенность пользователей."
        goal_what = f"Улучшить: {title.lower()}."
        goal_why = "Чтобы система работала лучше и пользователи были более довольны."
        goal_benefits = "Функция будет улучшена. Система станет лучше. Пользователи будут более довольны."
    else:
        # Общий случай
        context_problem = f"Необходимо выполнить задачу: {title}."
        context_situation = "Задача требует выполнения для улучшения системы или решения проблемы."
        context_why = "Выполнение задачи важно для работы системы или улучшения пользовательского опыта."
        goal_what = f"Выполнить задачу: {title.lower()}."
        goal_why = "Чтобы улучшить систему или решить проблему."
        goal_benefits = "Задача будет выполнена. Система станет лучше."
    
    # Извлекаем шаги из старого описания, если они есть
    steps = []
    if old_description:
        # Пытаемся найти шаги в старом описании
        lines = old_description.split('\n')
        current_step = None
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-') or line.startswith('*')):
                # Это может быть шаг
                step_text = line.lstrip('0123456789.-* ').strip()
                if step_text:
                    steps.append({
                        "title": f"Шаг {len(steps) + 1}",
                        "action": step_text,
                        "check": "Проверить результат выполнения"
                    })
    
    # Если шагов нет, создаем базовые
    if not steps:
        steps = [
            {
                "title": "Изучить задачу",
                "action": "Внимательно прочитать описание задачи и понять что нужно сделать",
                "check": "Понять суть задачи и требования"
            },
            {
                "title": "Выполнить задачу",
                "action": "Выполнить необходимые действия для решения задачи",
                "check": "Задача должна быть выполнена согласно требованиям"
            },
            {
                "title": "Проверить результат",
                "action": "Проверить что задача выполнена корректно и все работает",
                "check": "Результат должен соответствовать требованиям"
            }
        ]
    
    # Формируем описание
    description = f"""## 🎯 Контекст

**Проблема:** {context_problem}

**Ситуация:** {context_situation}

**Почему это важно:** {context_why}

---

## 🎯 Цель

**Что нужно сделать:** {goal_what}

**Для чего это нужно:** {goal_why}

**Что это даст:** {goal_benefits}

---

## 📝 Алгоритм выполнения

"""
    
    for step in steps:
        description += f"""**{step['title']}**
- Что делаем: {step['action']}
- Как проверить: {step['check']}

"""
    
    # Добавляем старое описание как дополнительную информацию, если оно есть
    if old_description and len(old_description.strip()) > 0:
        description += """---

## 📄 Дополнительная информация

"""
        description += old_description
        description += "\n"
    
    description += """---

## ✅ Критерии успеха

- [ ] Задача выполнена согласно требованиям
- [ ] Результат проверен и работает корректно
- [ ] Нет ошибок или проблем
"""
    
    return description

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Обновление всех задач в Linear по новому шаблону'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Показать что будет обновлено, без реальных изменений'
    )
    parser.add_argument(
        '--yes',
        action='store_true',
        help='Автоматически обновить все задачи без запроса'
    )
    parser.add_argument(
        '--team',
        type=str,
        required=True,
        help='Ключ команды в Linear (например, ENGI, MAR)'
    )
    parser.add_argument(
        '--skip-updated',
        action='store_true',
        help='Пропустить задачи, которые уже обновлены (содержат "## 🎯 Контекст")'
    )
    
    args = parser.parse_args()
    
    print("🔄 Обновление всех задач в Linear по новому шаблону\n")
    print("=" * 60)
    
    # Получаем команды
    from linear_task_creator import get_teams
    teams_result = get_teams()
    if not teams_result.get("success"):
        print(f"❌ Ошибка получения команд: {teams_result.get('error')}")
        return
    
    teams = {team['key']: team for team in teams_result['teams']}
    
    if args.team not in teams:
        print(f"❌ Команда {args.team} не найдена")
        print(f"Доступные команды: {list(teams.keys())}")
        return
    
    team_id = teams[args.team]['id']
    print(f"📌 Используется команда: {args.team} ({teams[args.team]['name']})\n")
    
    # Получаем все задачи
    print("📋 Получение всех задач команды...\n")
    all_issues = get_all_issues_for_team(team_id)
    print(f"✅ Найдено задач: {len(all_issues)}\n")
    
    # Фильтруем задачи
    issues_to_update = []
    for issue in all_issues:
        # Пропускаем уже обновленные задачи, если указан флаг
        if args.skip_updated:
            if issue.get('description') and "## 🎯 Контекст" in issue['description']:
                continue
        
        # Пропускаем задачи без описания (они будут обновлены)
        issues_to_update.append(issue)
    
    print(f"📝 Задач для обновления: {len(issues_to_update)}\n")
    
    if args.dry_run:
        print("🔍 DRY-RUN: Задачи НЕ будут обновлены\n")
        print("Задачи, которые будут обновлены:")
        for issue in issues_to_update[:10]:  # Показываем первые 10
            print(f"   - {issue['identifier']}: {issue['title']}")
        if len(issues_to_update) > 10:
            print(f"   ... и еще {len(issues_to_update) - 10} задач")
    else:
        updated_count = 0
        errors_count = 0
        skipped_count = 0
        
        for i, issue in enumerate(issues_to_update, 1):
            print(f"[{i}/{len(issues_to_update)}] {issue['identifier']}: {issue['title']}")
            
            # Создаем новое описание
            old_description = issue.get('description', '') or ''
            new_description = create_task_description_from_existing(issue['title'], old_description)
            
            # Если описание не изменилось (уже в новом формате), пропускаем
            if old_description == new_description:
                print(f"   ⏭️  Пропущено (уже обновлено)")
                skipped_count += 1
                continue
            
            if update_issue_description(issue['id'], new_description):
                print(f"   ✅ Обновлено")
                updated_count += 1
            else:
                print(f"   ❌ Ошибка обновления")
                errors_count += 1
            
            time.sleep(0.5)  # Небольшая задержка между запросами
        
        print("\n" + "=" * 60)
        print("📊 ИТОГОВАЯ СТАТИСТИКА:")
        print(f"   ✅ Обновлено задач: {updated_count}")
        print(f"   ⏭️  Пропущено: {skipped_count}")
        print(f"   ❌ Ошибок: {errors_count}")
        print(f"   📋 Всего обработано: {len(issues_to_update)}")
        print("=" * 60)
        
        if updated_count > 0:
            print("\n✅ Описания успешно обновлены в Linear!")
    
    print("\n🎉 Готово!")

if __name__ == "__main__":
    main()

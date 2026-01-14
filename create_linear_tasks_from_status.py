#!/usr/bin/env python3
"""
Скрипт для создания задач в Linear на основе PROJECT_FEATURES_STATUS.md
Создает задачи для функций, требующих доработки (этапы 1, 2, и некоторые из этапа 3)
"""

import os
import re
from typing import List, Dict, Tuple
from dotenv import load_dotenv

# Импортируем функцию создания задач из linear_task_creator
import sys
sys.path.append(os.path.dirname(__file__))
from linear_task_creator import create_linear_task, get_teams

load_dotenv()

# Маппинг категорий к командам Linear
CATEGORY_TO_TEAM = {
    "БОТЫ": "ENG",
    "FRONTEND": "ENG",
    "MLM": "ENG",
    "INSTAGRAM OUTREACH": "MARK",
    "A/B ТЕСТИРОВАНИЕ": "MARK",
    "AI ФУНКЦИИ": "ENG",
    "КУЛЕНДАРНАЯ ИНТЕГРАЦИЯ": "ENG",
    "АНАЛИТИКА": "PROD",
    "НОВОСТИ": "CONT",
    "БЕЗОПАСНОСТЬ": "ENG",
    "БАЗА ДАННЫХ": "ENG",
    "ДЕПЛОЙ": "ENG",
    "ТЕСТИРОВАНИЕ": "ENG",
    "ДОКУМЕНТАЦИЯ": "CONT",
    "ПЛАНИРУЕМЫЕ": "ENG",  # По умолчанию для планируемых функций
}

# Маппинг категорий к проектам
CATEGORY_TO_PROJECT = {
    "БОТЫ": "Backend разработка",
    "FRONTEND": "Frontend разработка",
    "MLM": "Backend разработка",
    "INSTAGRAM OUTREACH": "Instagram Outreach",
    "A/B ТЕСТИРОВАНИЕ": "A/B тесты",
    "AI ФУНКЦИИ": "Backend разработка",
    "КУЛЕНДАРНАЯ ИНТЕГРАЦИЯ": "Интеграции",
    "АНАЛИТИКА": "Аналитика и метрики",
    "НОВОСТИ": "Контент-календарь",
    "БЕЗОПАСНОСТЬ": "DevOps и инфраструктура",
    "БАЗА ДАННЫХ": "Backend разработка",
    "ДЕПЛОЙ": "DevOps и инфраструктура",
    "ТЕСТИРОВАНИЕ": "Backend разработка",
    "ДОКУМЕНТАЦИЯ": "Документация",
    "ПЛАНИРУЕМЫЕ": "Roadmap разработки",
}


def parse_status_file(file_path: str) -> List[Dict]:
    """
    Парсит PROJECT_FEATURES_STATUS.md и извлекает функции по этапам
    
    Возвращает список функций с их этапами и категориями
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    functions = []
    current_category = None
    current_section = None
    
    # Разделяем на секции
    sections = re.split(r'^## ', content, flags=re.MULTILINE)
    
    for section in sections:
        # Определяем категорию из заголовка
        lines = section.split('\n')
        if not lines:
            continue
        
        header = lines[0].strip()
        
        # Определяем категорию
        if any(keyword in header.upper() for keyword in ['БОТЫ', 'ПАРТНЁРСКИЙ', 'КЛИЕНТСКИЙ', 'АДМИН']):
            current_category = "БОТЫ"
        elif 'FRONTEND' in header.upper() or 'ВЕБ' in header.upper():
            current_category = "FRONTEND"
        elif 'MLM' in header.upper():
            current_category = "MLM"
        elif 'INSTAGRAM' in header.upper():
            current_category = "INSTAGRAM OUTREACH"
        elif 'A/B' in header.upper() or 'ТЕСТИРОВАНИЕ' in header.upper():
            current_category = "A/B ТЕСТИРОВАНИЕ"
        elif 'AI' in header.upper():
            current_category = "AI ФУНКЦИИ"
        elif 'КУЛЕНДАР' in header.upper():
            current_category = "КУЛЕНДАРНАЯ ИНТЕГРАЦИЯ"
        elif 'АНАЛИТИКА' in header.upper():
            current_category = "АНАЛИТИКА"
        elif 'НОВОСТИ' in header.upper():
            current_category = "НОВОСТИ"
        elif 'БЕЗОПАСНОСТЬ' in header.upper() or 'ИНФРАСТРУКТУРА' in header.upper():
            current_category = "БЕЗОПАСНОСТЬ"
        elif 'БАЗА ДАННЫХ' in header.upper() or 'БД' in header.upper():
            current_category = "БАЗА ДАННЫХ"
        elif 'ДЕПЛОЙ' in header.upper() or 'CI/CD' in header.upper():
            current_category = "ДЕПЛОЙ"
        elif 'ТЕСТИРОВАНИЕ' in header.upper():
            current_category = "ТЕСТИРОВАНИЕ"
        elif 'ДОКУМЕНТАЦИЯ' in header.upper():
            current_category = "ДОКУМЕНТАЦИЯ"
        elif 'ПЛАНИРУЕМЫЕ' in header.upper() or 'ГИПОТЕЗ' in header.upper():
            current_category = "ПЛАНИРУЕМЫЕ"
        
        # Парсим таблицы с функциями
        # Ищем таблицы в формате Markdown
        table_pattern = r'\|.*?\|.*?\|.*?\|'
        tables = re.findall(table_pattern, section, re.MULTILINE)
        
        for table_block in tables.split('\n') if isinstance(tables, str) else []:
            # Парсим строки таблицы
            rows = re.findall(r'\|([^|]+)\|([^|]+)\|([^|]+)\|', table_block)
            for row in rows:
                if len(row) >= 3:
                    function_name = row[0].strip()
                    stage_str = row[1].strip()
                    description = row[2].strip()
                    
                    # Определяем этап
                    stage = None
                    if '1' in stage_str or 'Гипотеза' in stage_str or 'идея' in stage_str.lower():
                        stage = 1
                    elif '2' in stage_str or 'Прототип' in stage_str.lower():
                        stage = 2
                    elif '3' in stage_str or 'Протестировано' in stage_str.lower():
                        stage = 3
                    elif '4' in stage_str or 'Завершен' in stage_str.lower():
                        stage = 4
                    
                    if stage and stage in [1, 2, 3] and function_name:
                        functions.append({
                            'name': function_name,
                            'description': description,
                            'stage': stage,
                            'category': current_category or "ПЛАНИРУЕМЫЕ"
                        })
    
    # Альтернативный парсинг - простой поиск по строкам
    functions_simple = []
    lines = content.split('\n')
    current_category = None
    
    for i, line in enumerate(lines):
        # Определяем категорию
        if line.startswith('### ') or line.startswith('## '):
            header = line.replace('#', '').strip()
            if 'БОТЫ' in header.upper() or 'ПАРТНЁРСКИЙ' in header.upper() or 'КЛИЕНТСКИЙ' in header.upper() or 'АДМИН' in header.upper():
                current_category = "БОТЫ"
            elif 'FRONTEND' in header.upper():
                current_category = "FRONTEND"
            elif 'MLM' in header.upper():
                current_category = "MLM"
            elif 'INSTAGRAM' in header.upper():
                current_category = "INSTAGRAM OUTREACH"
            elif 'A/B' in header.upper():
                current_category = "A/B ТЕСТИРОВАНИЕ"
            elif 'AI' in header.upper():
                current_category = "AI ФУНКЦИИ"
            elif 'КУЛЕНДАР' in header.upper():
                current_category = "КУЛЕНДАРНАЯ ИНТЕГРАЦИЯ"
            elif 'АНАЛИТИКА' in header.upper():
                current_category = "АНАЛИТИКА"
            elif 'НОВОСТИ' in header.upper():
                current_category = "НОВОСТИ"
            elif 'БЕЗОПАСНОСТЬ' in header.upper() or 'ИНФРАСТРУКТУРА' in header.upper():
                current_category = "БЕЗОПАСНОСТЬ"
            elif 'БАЗА ДАННЫХ' in header.upper():
                current_category = "БАЗА ДАННЫХ"
            elif 'ДЕПЛОЙ' in header.upper() or 'CI/CD' in header.upper():
                current_category = "ДЕПЛОЙ"
            elif 'ТЕСТИРОВАНИЕ' in header.upper():
                current_category = "ТЕСТИРОВАНИЕ"
            elif 'ДОКУМЕНТАЦИЯ' in header.upper():
                current_category = "ДОКУМЕНТАЦИЯ"
            elif 'ПЛАНИРУЕМЫЕ' in header.upper() or 'ГИПОТЕЗ' in header.upper():
                current_category = "ПЛАНИРУЕМЫЕ"
        
        # Ищем строки таблицы с этапами 1, 2, 3
        if '|' in line and (('1)' in line or '2)' in line or '3)' in line or 'Этап 1' in line or 'Этап 2' in line or 'Этап 3' in line or 'Гипотеза' in line or 'Прототип' in line or 'Протестировано' in line)):
            parts = [p.strip() for p in line.split('|')]
            if len(parts) >= 4:
                func_name = parts[1].strip()
                stage_str = parts[2].strip()
                desc = parts[3].strip()
                
                # Определяем этап
                stage = None
                if '1' in stage_str or 'Гипотеза' in stage_str or 'идея' in stage_str.lower():
                    stage = 1
                elif '2' in stage_str or 'Прототип' in stage_str.lower():
                    stage = 2
                elif '3' in stage_str or 'Протестировано' in stage_str.lower():
                    stage = 3
                
                if stage and func_name and func_name != 'Функция':
                    functions_simple.append({
                        'name': func_name,
                        'description': desc,
                        'stage': stage,
                        'category': current_category or "ПЛАНИРУЕМЫЕ"
                    })
    
    return functions_simple if functions_simple else functions


def create_tasks_for_stages(stages: List[int] = [1, 2], skip_categories: List[str] = None):
    """
    Создает задачи в Linear для функций указанных этапов
    
    Args:
        stages: Список этапов для создания задач (по умолчанию [1, 2])
        skip_categories: Категории для пропуска (например, ["ПЛАНИРУЕМЫЕ"])
    """
    if skip_categories is None:
        skip_categories = []
    
    status_file = os.path.join(os.path.dirname(__file__), "PROJECT_FEATURES_STATUS.md")
    
    if not os.path.exists(status_file):
        print(f"❌ Файл {status_file} не найден")
        return
    
    print(f"📖 Чтение файла {status_file}...\n")
    functions = parse_status_file(status_file)
    
    print(f"✅ Найдено функций: {len(functions)}")
    print(f"📊 Фильтруем по этапам: {stages}\n")
    
    # Фильтруем функции
    filtered_functions = [
        f for f in functions 
        if f['stage'] in stages 
        and f['category'] not in skip_categories
    ]
    
    print(f"📋 Функций для создания задач: {len(filtered_functions)}\n")
    
    if not filtered_functions:
        print("⚠️  Нет функций для создания задач")
        return
    
    # Получаем список команд
    teams_result = get_teams()
    if not teams_result.get("success"):
        print(f"❌ Ошибка получения команд: {teams_result.get('error')}")
        return
    
    teams = {team['key']: team['id'] for team in teams_result['teams']}
    print(f"✅ Найдено команд: {list(teams.keys())}\n")
    
    # Группируем по категориям для удобства
    by_category = {}
    for func in filtered_functions:
        cat = func['category']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(func)
    
    print("📦 Создание задач в Linear...\n")
    
    created_count = 0
    skipped_count = 0
    errors_count = 0
    
    for category, funcs in by_category.items():
        print(f"🏷️  Категория: {category}")
        team_key = CATEGORY_TO_TEAM.get(category, "ENG")
        
        for func in funcs:
            # Определяем приоритет на основе этапа
            priority = 4 - func['stage']  # Этап 1 -> приоритет 3, Этап 2 -> приоритет 2, Этап 3 -> приоритет 1
            
            # Формируем описание
            stage_names = {1: "Гипотеза/Идея", 2: "Прототип", 3: "Протестировано"}
            description = f"""**Этап:** {stage_names.get(func['stage'], func['stage'])}
**Категория:** {category}

{func['description']}

---
*Задача создана автоматически на основе PROJECT_FEATURES_STATUS.md*
"""
            
            # Создаем задачу
            result = create_linear_task(
                title=func['name'],
                description=description,
                team_key=team_key if team_key in teams else None,
                priority=priority
            )
            
            if result['success']:
                print(f"   ✅ {result['identifier']}: {func['name']}")
                created_count += 1
            else:
                # Проверяем, не дубликат ли это
                if 'already exists' in result.get('error', '').lower() or 'duplicate' in result.get('error', '').lower():
                    print(f"   ⏭️  Пропущено (дубликат): {func['name']}")
                    skipped_count += 1
                else:
                    print(f"   ❌ Ошибка: {func['name']} - {result.get('error', 'Unknown error')}")
                    errors_count += 1
        
        print()
    
    # Итоговая статистика
    print("=" * 60)
    print("📊 ИТОГОВАЯ СТАТИСТИКА:")
    print(f"   ✅ Создано задач: {created_count}")
    print(f"   ⏭️  Пропущено (дубликаты): {skipped_count}")
    print(f"   ❌ Ошибок: {errors_count}")
    print(f"   📋 Всего обработано: {len(filtered_functions)}")
    print("=" * 60)


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Создание задач в Linear на основе PROJECT_FEATURES_STATUS.md')
    parser.add_argument('--stages', nargs='+', type=int, default=[1, 2],
                        help='Этапы для создания задач (по умолчанию: 1 2)')
    parser.add_argument('--skip-categories', nargs='+', default=['ПЛАНИРУЕМЫЕ'],
                        help='Категории для пропуска (по умолчанию: ПЛАНИРУЕМЫЕ)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Только показать что будет создано, без создания задач')
    
    args = parser.parse_args()
    
    if args.dry_run:
        print("🔍 Режим проверки (dry-run) - задачи не будут созданы\n")
        # TODO: Реализовать dry-run режим
        print("⚠️  Dry-run режим пока не реализован, запускаем создание задач...\n")
    
    print("🚀 Создание задач в Linear на основе PROJECT_FEATURES_STATUS.md\n")
    print(f"📌 Этапы: {args.stages}")
    print(f"⏭️  Пропускаем категории: {args.skip_categories}\n")
    
    create_tasks_for_stages(stages=args.stages, skip_categories=args.skip_categories)


if __name__ == "__main__":
    main()


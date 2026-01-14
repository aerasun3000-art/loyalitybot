#!/usr/bin/env python3
"""
Скрипт для создания бэклога задач по внедрению Экосистемы LoyalityBot 2.0
"""

import time
from linear_task_creator import create_linear_task

# Список задач (Backlog)
TASKS = [
    # --- PHASE 1: Multi-Niche Core ---
    {
        "title": "[Multi-Niche] Миграция БД: Категории и UI конфиг",
        "description": """
        Добавить в таблицу partners поля:
        - category_group (ENUM: beauty, food, retail, activity, influencer)
        - ui_config (JSONB)
        - is_verified (BOOLEAN)
        
        См. ECOSYSTEM_EXPANSION_TZ.md (Section 1.1)
        """,
        "priority": 2
    },
    {
        "title": "[Multi-Niche] Backend: Обновление модели Partner",
        "description": "Обновить Pydantic модели и методы SupabaseManager для работы с новыми полями (category_group, ui_config).",
        "priority": 2
    },
    {
        "title": "[Multi-Niche] Bot: Адаптация регистрации",
        "description": "Изменить флоу регистрации в bot.py. Добавить шаг выбора 'category_group'. Если выбрано Food/Retail - пропускать специфичные для салонов настройки.",
        "priority": 2
    },
    
    # --- PHASE 2: Multi-Niche UI ---
    {
        "title": "[Multi-Niche] Frontend: Фильтры категорий",
        "description": "Добавить на главную страницу горизонтальные табы фильтрации: [Все] [Красота] [Еда] [Магазины].",
        "priority": 3
    },
    {
        "title": "[Multi-Niche] Frontend: Динамическая страница партнера",
        "description": """
        Адаптировать OnePagerPartner.jsx.
        Использовать ui_config для скрытия кнопки 'Записаться' и отображения кнопки 'Меню' или 'Купить'.
        """,
        "priority": 3
    },
    
    # --- PHASE 3: B2B Deals System ---
    {
        "title": "[B2B Deals] Миграция БД: Таблица partner_deals",
        "description": """
        Создать таблицу partner_deals с полями:
        - source_partner_id, target_partner_id
        - client_cashback_percent
        - referral_commission_percent
        - status, expires_at
        
        См. ECOSYSTEM_EXPANSION_TZ.md (Section 1.2)
        """,
        "priority": 2
    },
    {
        "title": "[B2B Deals] Logic: Smart Calculation",
        "description": """
        Обновить функцию execute_transaction.
        Добавить проверку наличия активного Deal между source и target партнерами.
        Применять проценты из сделки (override), если она существует.
        """,
        "priority": 1
    },
    {
        "title": "[B2B Deals] Bot: Меню 'Партнерство'",
        "description": """
        Создать новый раздел в боте партнера (/collaboration).
        Функционал: Поиск партнеров, Создание предложения (оффера), Принятие/Отклонение.
        """,
        "priority": 3
    },
    
    # --- PHASE 4: Influencers ---
    {
        "title": "[Influencer] Logic: Реферальная система для блогеров",
        "description": "Реализовать логику начисления комиссий блогерам (только source_partner) без транзакций 'у себя'.",
        "priority": 3
    },
    {
        "title": "[Influencer] Bot: Упрощенный интерфейс",
        "description": "Для партнеров типа 'influencer' скрывать функции сканирования QR и показывать только статистику выплат.",
        "priority": 4
    }
]

def main():
    print(f"🚀 Начинаю создание {len(TASKS)} задач в Linear для Экосистемы 2.0...\n")
    
    success_count = 0
    
    for i, task in enumerate(TASKS, 1):
        print(f"[{i}/{len(TASKS)}] Создаю: {task['title']}...")
        
        result = create_linear_task(
            title=task["title"],
            description=task["description"],
            priority=task["priority"]
        )
        
        if result["success"]:
            print(f"   ✅ Создано: {result['identifier']} ({result['url']})")
            success_count += 1
        else:
            print(f"   ❌ Ошибка: {result.get('error')}")
            
        # Небольшая пауза чтобы не спамить API
        time.sleep(1)
        
    print(f"\n✨ Готово! Успешно создано задач: {success_count} из {len(TASKS)}")

if __name__ == "__main__":
    main()

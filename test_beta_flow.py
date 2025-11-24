#!/usr/bin/env python3
"""
Скрипт для тестирования основных функций бета-версии
"""
import os
import sys
from dotenv import load_dotenv

load_dotenv()

# Добавляем текущую директорию в путь
sys.path.append(os.path.dirname(__file__))

from supabase_manager import SupabaseManager

def test_database_connection():
    """Тест подключения к базе данных"""
    print("🔍 Тест 1: Подключение к базе данных...")
    try:
        sm = SupabaseManager()
        if sm.client:
            print("   ✅ Подключение к Supabase успешно")
            return True
        else:
            print("   ❌ Не удалось подключиться к Supabase")
            return False
    except Exception as e:
        print(f"   ❌ Ошибка: {e}")
        return False

def test_tables_exist():
    """Тест наличия всех необходимых таблиц"""
    print("\n🔍 Тест 2: Проверка таблиц...")
    sm = SupabaseManager()
    if not sm.client:
        print("   ❌ Нет подключения к базе данных")
        return False
    
    required_tables = [
        'promoters', 'ugc_content', 'promo_materials',
        'leaderboard_periods', 'leaderboard_rankings',
        'leaderboard_metrics', 'prize_distributions',
        'referral_tree', 'referral_rewards'
    ]
    
    missing_tables = []
    for table in required_tables:
        try:
            result = sm.client.from_(table).select('*').limit(1).execute()
            print(f"   ✅ Таблица '{table}' существует")
        except Exception as e:
            print(f"   ❌ Таблица '{table}' отсутствует или недоступна: {e}")
            missing_tables.append(table)
    
    if missing_tables:
        print(f"\n   ⚠️  Отсутствуют таблицы: {', '.join(missing_tables)}")
        return False
    
    return True

def test_functions_exist():
    """Тест наличия функций"""
    print("\n🔍 Тест 3: Проверка функций...")
    sm = SupabaseManager()
    if not sm.client:
        print("   ❌ Нет подключения к базе данных")
        return False
    
    test_chat_id = "test_user_123"
    
    # Тест generate_referral_code
    try:
        code = sm.generate_referral_code(test_chat_id)
        if code:
            print(f"   ✅ Функция generate_referral_code работает (код: {code})")
        else:
            print("   ❌ Функция generate_referral_code вернула None")
            return False
    except Exception as e:
        print(f"   ❌ Ошибка в generate_referral_code: {e}")
        return False
    
    return True

def test_leaderboard_period():
    """Тест активного периода лидерборда"""
    print("\n🔍 Тест 4: Проверка периода лидерборда...")
    sm = SupabaseManager()
    if not sm.client:
        print("   ❌ Нет подключения к базе данных")
        return False
    
    try:
        active_period = sm.get_active_leaderboard_period()
        if active_period:
            print(f"   ✅ Активный период найден: {active_period.get('period_name', 'N/A')}")
            return True
        else:
            print("   ⚠️  Активный период не найден (можно создать через админ-бот)")
            return True  # Это не ошибка, можно создать позже
    except Exception as e:
        print(f"   ❌ Ошибка при проверке периода: {e}")
        return False

def test_promo_materials():
    """Тест промо-материалов"""
    print("\n🔍 Тест 5: Проверка промо-материалов...")
    sm = SupabaseManager()
    if not sm.client:
        print("   ❌ Нет подключения к базе данных")
        return False
    
    try:
        materials = sm.get_promo_materials()
        if materials:
            print(f"   ✅ Найдено промо-материалов: {len(materials)}")
            for mat in materials[:3]:
                print(f"      • {mat.get('title', 'N/A')} ({mat.get('material_type', 'N/A')})")
            return True
        else:
            print("   ⚠️  Промо-материалы не найдены (можно добавить через SQL)")
            return True  # Это не критичная ошибка
    except Exception as e:
        print(f"   ❌ Ошибка при проверке материалов: {e}")
        return False

def test_environment_variables():
    """Тест переменных окружения"""
    print("\n🔍 Тест 6: Проверка переменных окружения...")
    
    required_vars = {
        'TOKEN_CLIENT': 'Клиентский бот',
        'TOKEN_PARTNER': 'Партнёрский бот',
        'ADMIN_BOT_TOKEN': 'Админский бот',
        'ADMIN_CHAT_ID': 'ID администратора',
        'SUPABASE_URL': 'Supabase URL',
        'SUPABASE_KEY': 'Supabase Key'
    }
    
    missing_vars = []
    for var, desc in required_vars.items():
        if os.getenv(var):
            print(f"   ✅ {var} ({desc})")
        else:
            print(f"   ❌ {var} ({desc}) - отсутствует")
            missing_vars.append(var)
    
    if missing_vars:
        print(f"\n   ⚠️  Отсутствуют переменные: {', '.join(missing_vars)}")
        return False
    
    return True

def main():
    """Основная функция тестирования"""
    print("=" * 60)
    print("🧪 ТЕСТИРОВАНИЕ БЕТА-ВЕРСИИ")
    print("=" * 60)
    print()
    
    results = []
    
    # Запускаем тесты
    results.append(("Переменные окружения", test_environment_variables()))
    results.append(("Подключение к БД", test_database_connection()))
    results.append(("Таблицы", test_tables_exist()))
    results.append(("Функции", test_functions_exist()))
    results.append(("Период лидерборда", test_leaderboard_period()))
    results.append(("Промо-материалы", test_promo_materials()))
    
    # Итоги
    print()
    print("=" * 60)
    print("📊 РЕЗУЛЬТАТЫ ТЕСТИРОВАНИЯ")
    print("=" * 60)
    print()
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print()
    print(f"Пройдено тестов: {passed}/{total}")
    print()
    
    if passed == total:
        print("🎉 Все тесты пройдены! Система готова к бета-тестированию.")
        return 0
    elif passed >= total - 1:
        print("⚠️  Большинство тестов пройдено. Система готова к тестированию с ограничениями.")
        return 0
    else:
        print("❌ Есть критические ошибки. Исправьте их перед запуском.")
        return 1

if __name__ == "__main__":
    sys.exit(main())


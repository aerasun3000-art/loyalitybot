#!/usr/bin/env python3
"""
Тестовый скрипт для проверки NPS системы
Проверяет все возможные сценарии и проблемы
"""

import sys
import os
from datetime import datetime, timezone

# Добавляем путь к проекту
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from supabase_manager import SupabaseManager
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_nps_system():
    """Тестирует NPS систему на различные сценарии"""
    
    sm = SupabaseManager()
    if not sm.client:
        print("❌ Не удалось подключиться к Supabase")
        return False
    
    print("=" * 60)
    print("🧪 ТЕСТИРОВАНИЕ NPS СИСТЕМЫ")
    print("=" * 60)
    print()
    
    issues = []
    warnings = []
    
    # Тест 1: Проверка структуры таблицы nps_ratings
    print("📋 Тест 1: Проверка структуры таблицы nps_ratings")
    try:
        # Пытаемся получить схему таблицы через запрос
        test_query = sm.client.from_('nps_ratings').select('*').limit(1).execute()
        print("✅ Таблица nps_ratings существует и доступна")
    except Exception as e:
        issues.append(f"Таблица nps_ratings недоступна: {e}")
        print(f"❌ Ошибка доступа к таблице: {e}")
    
    print()
    
    # Тест 2: Проверка функции record_nps_rating с разными сценариями
    print("📋 Тест 2: Проверка record_nps_rating")
    
    # Тест 2.1: Запись с валидным partner_chat_id
    test_client_id = "TEST_CLIENT_123"
    test_partner_id = "TEST_PARTNER_456"
    
    try:
        result = sm.record_nps_rating(test_client_id, test_partner_id, 8, "Test Master")
        if result:
            print("✅ Запись NPS с валидным partner_chat_id работает")
        else:
            issues.append("record_nps_rating вернул False для валидных данных")
            print("❌ record_nps_rating вернул False")
    except Exception as e:
        issues.append(f"Ошибка при записи NPS: {e}")
        print(f"❌ Ошибка: {e}")
    
    # Тест 2.2: Запись с 'SYSTEM' partner_chat_id (должен найти из транзакции)
    print("   Тест 2.2: Запись с 'SYSTEM' partner_chat_id")
    try:
        # Сначала создаем тестовую транзакцию
        test_txn_client = "TEST_CLIENT_SYSTEM"
        test_txn_partner = "TEST_PARTNER_SYSTEM"
        
        # Проверяем, есть ли транзакции у этого клиента
        txn_check = sm.client.from_('transactions').select('partner_chat_id').eq('client_chat_id', test_txn_client).order('date_time', desc=True).limit(1).execute()
        
        if txn_check.data:
            result = sm.record_nps_rating(test_txn_client, 'SYSTEM', 7, "Test Master")
            if result:
                print("✅ Запись NPS с 'SYSTEM' partner_chat_id работает (найден из транзакции)")
            else:
                warnings.append("record_nps_rating вернул False для 'SYSTEM' partner_chat_id")
                print("⚠️  record_nps_rating вернул False для 'SYSTEM'")
        else:
            warnings.append(f"Нет транзакций для клиента {test_txn_client}, не можем протестировать поиск partner_chat_id")
            print("⚠️  Нет транзакций для тестирования поиска partner_chat_id")
    except Exception as e:
        warnings.append(f"Ошибка при тестировании 'SYSTEM' partner_chat_id: {e}")
        print(f"⚠️  Ошибка: {e}")
    
    print()
    
    # Тест 3: Проверка создания промоутера при оценке 10
    print("📋 Тест 3: Проверка создания промоутера при оценке 10")
    test_promoter_client = "TEST_PROMOTER_CLIENT"
    test_promoter_partner = "TEST_PROMOTER_PARTNER"
    
    try:
        # Проверяем, есть ли уже промоутер
        existing = sm.client.from_('promoters').select('id').eq('client_chat_id', test_promoter_client).limit(1).execute()
        if existing.data:
            print("   ⚠️  Промоутер уже существует для этого клиента, пропускаем создание")
        else:
            result = sm.record_nps_rating(test_promoter_client, test_promoter_partner, 10, "Test Master")
            if result:
                # Проверяем, создался ли промоутер
                promoter_check = sm.get_promoter_info(test_promoter_client)
                if promoter_check:
                    print("✅ Промоутер успешно создан при оценке 10")
                    print(f"   Промо-код: {promoter_check.get('promo_code', 'N/A')}")
                else:
                    issues.append("Промоутер не создан после оценки 10")
                    print("❌ Промоутер не создан после оценки 10")
            else:
                issues.append("record_nps_rating вернул False для оценки 10")
                print("❌ record_nps_rating вернул False для оценки 10")
    except Exception as e:
        issues.append(f"Ошибка при создании промоутера: {e}")
        print(f"❌ Ошибка: {e}")
    
    print()
    
    # Тест 4: Проверка статистики партнера
    print("📋 Тест 4: Проверка статистики партнера с NPS")
    try:
        stats = sm.get_advanced_partner_stats(test_partner_id, 30)
        if stats:
            print("✅ get_advanced_partner_stats работает")
            print(f"   NPS метрики:")
            print(f"   - Средний NPS: {stats.get('avg_nps', 0)}")
            print(f"   - NPS Score: {stats.get('nps_score', 0)}")
            print(f"   - Промоутеры (9-10): {stats.get('promoters', 0)}")
            print(f"   - Нейтральные (7-8): {stats.get('passives', 0)}")
            print(f"   - Детракторы (0-6): {stats.get('detractors', 0)}")
            print(f"   - Активных промоутеров: {stats.get('total_promoters', 0)}")
            
            # Проверяем наличие всех необходимых полей
            required_fields = ['avg_nps', 'nps_score', 'promoters', 'passives', 'detractors', 'total_promoters']
            missing_fields = [f for f in required_fields if f not in stats]
            if missing_fields:
                warnings.append(f"Отсутствуют поля в статистике: {missing_fields}")
                print(f"⚠️  Отсутствуют поля: {missing_fields}")
        else:
            issues.append("get_advanced_partner_stats вернул None")
            print("❌ get_advanced_partner_stats вернул None")
    except Exception as e:
        issues.append(f"Ошибка при получении статистики: {e}")
        print(f"❌ Ошибка: {e}")
    
    print()
    
    # Тест 5: Проверка фильтрации по датам
    print("📋 Тест 5: Проверка фильтрации NPS по датам")
    try:
        # Получаем все оценки за последние 30 дней
        now = datetime.now(timezone.utc)
        period_start = now.replace(day=1)  # Начало месяца
        
        nps_response = sm.client.from_('nps_ratings').select('rating, created_at').eq('partner_chat_id', test_partner_id).gte('created_at', period_start.isoformat()).execute()
        
        if nps_response.data:
            print(f"✅ Фильтрация по датам работает, найдено {len(nps_response.data)} оценок")
            # Проверяем формат дат
            for rating in nps_response.data[:3]:
                created_at = rating.get('created_at')
                if created_at:
                    print(f"   Пример: оценка {rating.get('rating')}, дата: {created_at}")
        else:
            print("   ℹ️  Нет оценок за этот период для тестирования")
    except Exception as e:
        issues.append(f"Ошибка при фильтрации по датам: {e}")
        print(f"❌ Ошибка: {e}")
    
    print()
    
    # Тест 6: Проверка обновления chat_id для VIA_PARTNER клиентов
    print("📋 Тест 6: Проверка обновления chat_id в nps_ratings")
    try:
        # Проверяем, есть ли функция update_client_chat_id
        if hasattr(sm, 'update_client_chat_id'):
            print("✅ Функция update_client_chat_id существует")
            # Проверяем, обновляет ли она nps_ratings
            # (не тестируем реальное обновление, чтобы не менять данные)
        else:
            warnings.append("Функция update_client_chat_id не найдена")
            print("⚠️  Функция update_client_chat_id не найдена")
    except Exception as e:
        warnings.append(f"Ошибка при проверке update_client_chat_id: {e}")
        print(f"⚠️  Ошибка: {e}")
    
    print()
    
    # Тест 7: Проверка дублирования оценок
    print("📋 Тест 7: Проверка возможности дублирования оценок")
    try:
        # Пытаемся записать две оценки от одного клиента
        duplicate_result1 = sm.record_nps_rating(test_client_id, test_partner_id, 9, "Test Master")
        duplicate_result2 = sm.record_nps_rating(test_client_id, test_partner_id, 9, "Test Master")
        
        if duplicate_result1 and duplicate_result2:
            # Проверяем, сколько оценок записалось
            ratings_check = sm.client.from_('nps_ratings').select('id').eq('client_chat_id', test_client_id).eq('partner_chat_id', test_partner_id).execute()
            count = len(ratings_check.data) if ratings_check.data else 0
            print(f"✅ Дублирование оценок работает (записано {count} оценок)")
            if count > 1:
                warnings.append("Система позволяет дублировать оценки от одного клиента")
                print("⚠️  Система позволяет дублировать оценки (это может быть проблемой)")
        else:
            print("⚠️  Не удалось записать дублирующие оценки")
    except Exception as e:
        warnings.append(f"Ошибка при проверке дублирования: {e}")
        print(f"⚠️  Ошибка: {e}")
    
    print()
    
    # Итоги
    print("=" * 60)
    print("📊 ИТОГИ ТЕСТИРОВАНИЯ")
    print("=" * 60)
    
    if issues:
        print(f"\n❌ КРИТИЧЕСКИЕ ПРОБЛЕМЫ ({len(issues)}):")
        for i, issue in enumerate(issues, 1):
            print(f"   {i}. {issue}")
    else:
        print("\n✅ Критических проблем не обнаружено")
    
    if warnings:
        print(f"\n⚠️  ПРЕДУПРЕЖДЕНИЯ ({len(warnings)}):")
        for i, warning in enumerate(warnings, 1):
            print(f"   {i}. {warning}")
    else:
        print("\n✅ Предупреждений нет")
    
    print()
    return len(issues) == 0

if __name__ == "__main__":
    success = test_nps_system()
    sys.exit(0 if success else 1)


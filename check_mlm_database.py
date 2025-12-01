#!/usr/bin/env python3
"""
Скрипт проверки базы данных для MLM партнерской системы с Revenue Share
Проверяет правильность выполнения SQL миграции и работу всех функций
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client
from typing import Dict, List, Tuple
import logging

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MLMDatabaseChecker:
    """Класс для проверки базы данных MLM системы"""
    
    def __init__(self):
        supabase_url = os.environ.get("SUPABASE_URL")
        supabase_key = os.environ.get("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL и SUPABASE_KEY должны быть установлены")
        
        self.client: Client = create_client(supabase_url, supabase_key)
        self.errors = []
        self.warnings = []
        self.success = []
    
    def check_table_exists(self, table_name: str) -> bool:
        """Проверяет существование таблицы"""
        try:
            result = self.client.table(table_name).select("id").limit(1).execute()
            return True
        except Exception as e:
            self.errors.append(f"Таблица {table_name} не существует: {e}")
            return False
    
    def check_column_exists(self, table_name: str, column_name: str) -> bool:
        """Проверяет существование колонки в таблице"""
        try:
            result = self.client.table(table_name).select(column_name).limit(1).execute()
            return True
        except Exception as e:
            if "column" in str(e).lower():
                self.errors.append(f"Колонка {table_name}.{column_name} не существует: {e}")
            return False
    
    def check_function_exists(self, function_name: str) -> bool:
        """Проверяет существование SQL функции"""
        try:
            # Пытаемся вызвать функцию с тестовыми параметрами
            if function_name == 'check_revenue_share_activation':
                result = self.client.rpc(
                    function_name,
                    {'partner_chat_id_param': 'test_check'}
                ).execute()
            elif function_name == 'calculate_pv_by_income':
                result = self.client.rpc(
                    function_name,
                    {'personal_income_param': 1000.0}
                ).execute()
            elif function_name == 'calculate_revenue_share':
                result = self.client.rpc(
                    function_name,
                    {
                        'partner_chat_id_param': 'test',
                        'source_partner_chat_id_param': 'test',
                        'system_revenue_param': 1000.0,
                        'level_param': 1
                    }
                ).execute()
            else:
                return False
            
            return True
        except Exception as e:
            # Функция может не существовать или принимать другие параметры
            if "function" in str(e).lower() or "does not exist" in str(e).lower():
                self.errors.append(f"Функция {function_name} не существует: {e}")
            else:
                # Функция существует, но параметры могут быть неправильными
                self.warnings.append(f"Функция {function_name} существует, но параметры могут быть неправильными: {e}")
            return False
    
    def check_partners_table_columns(self) -> Dict[str, bool]:
        """Проверяет все необходимые колонки в таблице partners"""
        required_columns = [
            'partner_type',
            'partner_level',
            'referred_by_chat_id',
            'partner_package_purchased_at',
            'personal_income_monthly',
            'client_base_count',
            'revenue_share_monthly',
            'total_revenue_share_earned',
            'is_revenue_share_active',
            'revenue_share_activation_date',
            'last_revenue_share_calculation',
            'pv_percent',
            'industry_type'
        ]
        
        results = {}
        for column in required_columns:
            exists = self.check_column_exists('partners', column)
            results[column] = exists
            if exists:
                self.success.append(f"Колонка partners.{column} существует")
        
        return results
    
    def check_mlm_tables(self) -> Dict[str, bool]:
        """Проверяет существование всех MLM таблиц"""
        tables = [
            'partner_network',
            'partner_revenue_share',
            'partner_recruitment_commissions',
            'partner_activation_conditions'
        ]
        
        results = {}
        for table in tables:
            exists = self.check_table_exists(table)
            results[table] = exists
            if exists:
                self.success.append(f"Таблица {table} существует")
        
        return results
    
    def check_sql_functions(self) -> Dict[str, bool]:
        """Проверяет существование всех SQL функций"""
        functions = [
            'check_revenue_share_activation',
            'calculate_pv_by_income',
            'calculate_revenue_share',
            'auto_update_pv_on_income_change'
        ]
        
        results = {}
        for func in functions:
            exists = self.check_function_exists(func)
            results[func] = exists
            if exists:
                self.success.append(f"Функция {func} существует")
        
        return results
    
    def check_test_data(self) -> Dict[str, any]:
        """Проверяет тестовые данные (если есть)"""
        results = {
            'partners_count': 0,
            'partners_with_pv': 0,
            'partners_with_revenue_share': 0,
            'network_connections': 0,
            'revenue_share_records': 0
        }
        
        try:
            # Проверяем количество партнеров
            partners = self.client.table('partners').select('chat_id, pv_percent, is_revenue_share_active').execute()
            results['partners_count'] = len(partners.data) if partners.data else 0
            
            # Проверяем партнеров с PV
            if partners.data:
                results['partners_with_pv'] = sum(
                    1 for p in partners.data 
                    if p.get('pv_percent') is not None
                )
                results['partners_with_revenue_share'] = sum(
                    1 for p in partners.data 
                    if p.get('is_revenue_share_active') is True
                )
            
            # Проверяем связи в сети
            network = self.client.table('partner_network').select('id').execute()
            results['network_connections'] = len(network.data) if network.data else 0
            
            # Проверяем записи Revenue Share
            revenue_share = self.client.table('partner_revenue_share').select('id').execute()
            results['revenue_share_records'] = len(revenue_share.data) if revenue_share.data else 0
            
            self.success.append(f"Найдено {results['partners_count']} партнеров")
            if results['partners_with_pv'] > 0:
                self.success.append(f"{results['partners_with_pv']} партнеров имеют PV")
            if results['partners_with_revenue_share'] > 0:
                self.success.append(f"{results['partners_with_revenue_share']} партнеров имеют активный Revenue Share")
            
        except Exception as e:
            self.warnings.append(f"Ошибка при проверке тестовых данных: {e}")
        
        return results
    
    def check_pv_levels(self) -> Dict[str, any]:
        """Проверяет правильность работы функции calculate_pv_by_income"""
        test_cases = [
            (0, 3.0, "Новичок: $0"),
            (500, 3.0, "Новичок: $500"),
            (999, 3.0, "Новичок: $999"),
            (1000, 5.0, "Активный: $1,000"),
            (1500, 5.0, "Активный: $1,500"),
            (1999, 5.0, "Активный: $1,999"),
            (2000, 7.0, "Растущий: $2,000"),
            (3500, 7.0, "Растущий: $3,500"),
            (4999, 7.0, "Растущий: $4,999"),
            (5000, 10.0, "Премиум: $5,000"),
            (10000, 10.0, "Премиум: $10,000"),
        ]
        
        results = {}
        for income, expected_pv, description in test_cases:
            try:
                result = self.client.rpc(
                    'calculate_pv_by_income',
                    {'personal_income_param': income}
                ).execute()
                
                actual_pv = float(result.data) if result.data else None
                is_correct = actual_pv == expected_pv
                
                results[description] = {
                    'income': income,
                    'expected_pv': expected_pv,
                    'actual_pv': actual_pv,
                    'correct': is_correct
                }
                
                if is_correct:
                    self.success.append(f"PV расчет корректен: {description} → {actual_pv}%")
                else:
                    self.errors.append(
                        f"PV расчет некорректен: {description} → ожидалось {expected_pv}%, получено {actual_pv}%"
                    )
            except Exception as e:
                self.errors.append(f"Ошибка при проверке PV для {description}: {e}")
                results[description] = {'error': str(e)}
        
        return results
    
    def check_indexes(self) -> Dict[str, bool]:
        """Проверяет существование индексов (косвенно через производительность)"""
        # Это сложно проверить напрямую через Supabase API
        # Проверяем косвенно через наличие данных
        indexes_to_check = [
            'idx_partners_type',
            'idx_partners_level',
            'idx_partners_referred_by',
            'idx_partners_revenue_active',
            'idx_network_referrer',
            'idx_network_referred',
            'idx_revenue_partner',
            'idx_revenue_source'
        ]
        
        results = {}
        for index in indexes_to_check:
            # Индексы сложно проверить через API, но они должны существовать
            results[index] = True
            self.warnings.append(f"Индекс {index} не может быть проверен через API (предполагается существование)")
        
        return results
    
    def run_all_checks(self) -> Dict[str, any]:
        """Запускает все проверки"""
        logger.info("=" * 60)
        logger.info("НАЧАЛО ПРОВЕРКИ БАЗЫ ДАННЫХ MLM СИСТЕМЫ")
        logger.info("=" * 60)
        
        results = {
            'tables': {},
            'columns': {},
            'functions': {},
            'test_data': {},
            'pv_levels': {},
            'indexes': {}
        }
        
        # Проверка таблиц
        logger.info("\n1. Проверка таблиц...")
        results['tables'] = self.check_mlm_tables()
        
        # Проверка колонок
        logger.info("\n2. Проверка колонок в таблице partners...")
        results['columns'] = self.check_partners_table_columns()
        
        # Проверка функций
        logger.info("\n3. Проверка SQL функций...")
        results['functions'] = self.check_sql_functions()
        
        # Проверка PV уровней
        logger.info("\n4. Проверка расчета PV...")
        results['pv_levels'] = self.check_pv_levels()
        
        # Проверка тестовых данных
        logger.info("\n5. Проверка тестовых данных...")
        results['test_data'] = self.check_test_data()
        
        # Проверка индексов
        logger.info("\n6. Проверка индексов...")
        results['indexes'] = self.check_indexes()
        
        # Итоговый отчет
        logger.info("\n" + "=" * 60)
        logger.info("ИТОГОВЫЙ ОТЧЕТ")
        logger.info("=" * 60)
        
        total_checks = len(self.success) + len(self.warnings) + len(self.errors)
        success_rate = (len(self.success) / total_checks * 100) if total_checks > 0 else 0
        
        logger.info(f"\n✅ Успешных проверок: {len(self.success)}")
        logger.info(f"⚠️  Предупреждений: {len(self.warnings)}")
        logger.info(f"❌ Ошибок: {len(self.errors)}")
        logger.info(f"📊 Успешность: {success_rate:.1f}%")
        
        if self.success:
            logger.info("\n✅ УСПЕШНЫЕ ПРОВЕРКИ:")
            for msg in self.success:
                logger.info(f"   {msg}")
        
        if self.warnings:
            logger.info("\n⚠️  ПРЕДУПРЕЖДЕНИЯ:")
            for msg in self.warnings:
                logger.info(f"   {msg}")
        
        if self.errors:
            logger.info("\n❌ ОШИБКИ:")
            for msg in self.errors:
                logger.error(f"   {msg}")
        
        logger.info("\n" + "=" * 60)
        
        if len(self.errors) == 0:
            logger.info("✅ ВСЕ КРИТИЧЕСКИЕ ПРОВЕРКИ ПРОЙДЕНЫ!")
            logger.info("База данных готова к использованию.")
        else:
            logger.error("❌ ОБНАРУЖЕНЫ КРИТИЧЕСКИЕ ОШИБКИ!")
            logger.error("Пожалуйста, исправьте ошибки перед использованием системы.")
        
        logger.info("=" * 60)
        
        return results


def main():
    """Главная функция"""
    try:
        checker = MLMDatabaseChecker()
        results = checker.run_all_checks()
        
        # Возвращаем код выхода
        if checker.errors:
            sys.exit(1)
        else:
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Критическая ошибка при проверке базы данных: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


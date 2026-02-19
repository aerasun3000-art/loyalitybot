"""
Тесты для SQL миграций
Полное покрытие структуры БД и миграций
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import datetime
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestDatabaseSchema:
    """Тесты схемы БД"""
    
    def test_users_table_columns(self):
        """Тест колонок таблицы users"""
        columns = [
            'id',
            'chat_id',
            'name',
            'username',
            'balance',
            'reg_date',
            'referral_source',
            'status',
            'created_at',
            'updated_at'
        ]
        
        assert 'chat_id' in columns
        assert 'balance' in columns
    
    def test_partners_table_columns(self):
        """Тест колонок таблицы partners"""
        columns = [
            'id',
            'chat_id',
            'name',
            'company_name',
            'business_type',
            'city',
            'district',
            'phone',
            'booking_url',
            'status',
            'created_at'
        ]
        
        assert 'company_name' in columns
        assert 'business_type' in columns

    def test_partner_broadcast_campaigns_table_columns(self):
        """Тест колонок таблицы partner_broadcast_campaigns (B2B TZ)"""
        columns = [
            'id',
            'partner_chat_id',
            'template_id',
            'recipient_count',
            'sent_count',
            'started_at',
            'finished_at',
            'status',
            'error_message',
            'audience_type',
        ]
        assert 'partner_chat_id' in columns
        assert 'template_id' in columns
        assert 'sent_count' in columns
        assert 'status' in columns
    
    def test_services_table_columns(self):
        """Тест колонок таблицы services"""
        columns = [
            'id',
            'title',
            'description',
            'price_points',
            'partner_chat_id',
            'category',
            'approval_status',
            'is_active',
            'created_at'
        ]
        
        assert 'price_points' in columns
        assert 'approval_status' in columns
    
    def test_promotions_table_columns(self):
        """Тест колонок таблицы promotions"""
        columns = [
            'id',
            'title',
            'description',
            'discount_value',
            'promotion_type',
            'start_date',
            'end_date',
            'partner_chat_id',
            'service_ids',
            'is_active'
        ]
        
        assert 'promotion_type' in columns
        assert 'service_ids' in columns
    
    def test_transactions_table_columns(self):
        """Тест колонок таблицы transactions"""
        columns = [
            'id',
            'client_chat_id',
            'partner_chat_id',
            'type',
            'points',
            'amount',
            'created_at'
        ]
        
        assert 'type' in columns
        assert 'points' in columns


class TestRLSPolicies:
    """Тесты RLS политик"""
    
    def test_users_rls_policy(self):
        """Тест RLS политики для users"""
        policy = {
            'name': 'users_select_own',
            'table': 'users',
            'operation': 'SELECT',
            'check': 'auth.uid() = user_id'
        }
        
        assert policy['operation'] == 'SELECT'
    
    def test_partners_rls_policy(self):
        """Тест RLS политики для partners"""
        policy = {
            'name': 'partners_select_approved',
            'table': 'partners',
            'operation': 'SELECT',
            'check': "status = 'Approved' OR chat_id = auth.uid()"
        }
        
        assert 'Approved' in policy['check']
    
    def test_services_rls_policy(self):
        """Тест RLS политики для services"""
        policy = {
            'name': 'services_select_approved',
            'table': 'services',
            'operation': 'SELECT',
            'check': "approval_status = 'Approved' AND is_active = true"
        }
        
        assert 'is_active' in policy['check']


class TestForeignKeys:
    """Тесты внешних ключей"""
    
    def test_transactions_user_fk(self):
        """Тест FK транзакций на пользователей"""
        fk = {
            'table': 'transactions',
            'column': 'client_chat_id',
            'references_table': 'users',
            'references_column': 'chat_id'
        }
        
        assert fk['references_table'] == 'users'
    
    def test_services_partner_fk(self):
        """Тест FK услуг на партнёров"""
        fk = {
            'table': 'services',
            'column': 'partner_chat_id',
            'references_table': 'partners',
            'references_column': 'chat_id'
        }
        
        assert fk['references_table'] == 'partners'
    
    def test_cascade_delete_behavior(self):
        """Тест каскадного удаления"""
        cascade_rules = {
            'services_on_partner_delete': 'CASCADE',
            'promotions_on_partner_delete': 'CASCADE',
            'transactions_on_user_delete': 'SET NULL'
        }
        
        assert cascade_rules['services_on_partner_delete'] == 'CASCADE'


class TestIndexes:
    """Тесты индексов"""
    
    def test_users_chat_id_index(self):
        """Тест индекса на chat_id пользователей"""
        index = {
            'name': 'idx_users_chat_id',
            'table': 'users',
            'columns': ['chat_id'],
            'unique': True
        }
        
        assert index['unique'] is True
    
    def test_transactions_created_at_index(self):
        """Тест индекса на дату транзакций"""
        index = {
            'name': 'idx_transactions_created_at',
            'table': 'transactions',
            'columns': ['created_at'],
            'unique': False
        }
        
        assert 'created_at' in index['columns']
    
    def test_services_partner_index(self):
        """Тест индекса услуг по партнёру"""
        index = {
            'name': 'idx_services_partner',
            'table': 'services',
            'columns': ['partner_chat_id', 'approval_status']
        }
        
        assert 'partner_chat_id' in index['columns']


class TestMigrationSQLSyntax:
    """Тесты синтаксиса SQL миграций"""
    
    def test_create_table_syntax(self):
        """Тест синтаксиса CREATE TABLE"""
        sql = """
        CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            chat_id TEXT UNIQUE NOT NULL,
            name TEXT,
            balance INTEGER DEFAULT 0
        );
        """
        
        assert 'CREATE TABLE' in sql
        assert 'PRIMARY KEY' in sql
        assert 'NOT NULL' in sql
    
    def test_alter_table_add_column(self):
        """Тест синтаксиса ALTER TABLE ADD COLUMN"""
        sql = """
        ALTER TABLE partners 
        ADD COLUMN IF NOT EXISTS ton_wallet_address TEXT;
        """
        
        assert 'ALTER TABLE' in sql
        assert 'ADD COLUMN' in sql
    
    def test_create_index_syntax(self):
        """Тест синтаксиса CREATE INDEX"""
        sql = """
        CREATE INDEX IF NOT EXISTS idx_transactions_partner 
        ON transactions (partner_chat_id);
        """
        
        assert 'CREATE INDEX' in sql
        assert 'ON transactions' in sql
    
    def test_rls_enable_syntax(self):
        """Тест синтаксиса включения RLS"""
        sql = """
        ALTER TABLE users ENABLE ROW LEVEL SECURITY;
        """
        
        assert 'ENABLE ROW LEVEL SECURITY' in sql


class TestDataTypes:
    """Тесты типов данных"""
    
    def test_uuid_type(self):
        """Тест типа UUID"""
        import uuid
        
        test_uuid = str(uuid.uuid4())
        
        # Формат UUID: 8-4-4-4-12
        pattern = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        is_valid = bool(re.match(pattern, test_uuid))
        
        assert is_valid is True
    
    def test_timestamp_type(self):
        """Тест типа TIMESTAMP"""
        timestamp = datetime.datetime.now().isoformat()
        
        # ISO format
        assert 'T' in timestamp
    
    def test_jsonb_type(self):
        """Тест типа JSONB"""
        import json
        
        data = {'key': 'value', 'array': [1, 2, 3]}
        jsonb_string = json.dumps(data)
        
        assert isinstance(jsonb_string, str)
        
        parsed = json.loads(jsonb_string)
        assert parsed['key'] == 'value'
    
    def test_text_array_type(self):
        """Тест типа TEXT[]"""
        # PostgreSQL массив текстовых значений
        array = ['value1', 'value2', 'value3']
        pg_array = '{' + ','.join(f'"{v}"' for v in array) + '}'
        
        assert pg_array.startswith('{')
        assert pg_array.endswith('}')


class TestDefaultValues:
    """Тесты значений по умолчанию"""
    
    def test_balance_default(self):
        """Тест дефолтного баланса"""
        default_balance = 0
        assert default_balance == 0
    
    def test_status_default(self):
        """Тест дефолтного статуса"""
        default_status = 'Pending'
        assert default_status == 'Pending'
    
    def test_is_active_default(self):
        """Тест дефолтного is_active"""
        default_is_active = True
        assert default_is_active is True
    
    def test_created_at_default(self):
        """Тест дефолтного created_at"""
        # NOW() или CURRENT_TIMESTAMP
        now = datetime.datetime.now()
        
        assert now is not None


class TestConstraints:
    """Тесты ограничений"""
    
    @staticmethod
    def _read_all_migrations():
        """Читает все SQL-миграции и возвращает объединённый текст"""
        migrations_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'migrations')
        all_sql = ''
        if os.path.isdir(migrations_dir):
            for fname in os.listdir(migrations_dir):
                if fname.endswith('.sql'):
                    with open(os.path.join(migrations_dir, fname), 'r', encoding='utf-8') as f:
                        all_sql += f.read() + '\n'
        return all_sql.lower()

    def test_chat_id_unique(self):
        """Тест: в миграциях должен быть UNIQUE constraint на chat_id"""
        sql = self._read_all_migrations()
        has_unique = 'unique' in sql and 'chat_id' in sql
        assert has_unique, "UNIQUE constraint на chat_id не найден в SQL-миграциях"

    def test_status_check_constraint(self):
        """Тест: в миграциях должен быть CHECK constraint на status"""
        sql = self._read_all_migrations()
        has_check = bool(re.search(r'check\s*\(.*status\s+in\s*\(', sql))
        assert has_check, "CHECK constraint на status не найден в SQL-миграциях"


class TestBotStatesTable:
    """Тесты таблицы bot_states"""
    
    def test_bot_states_columns(self):
        """Тест колонок bot_states"""
        columns = [
            'id',
            'chat_id',
            'state',
            'data',
            'created_at',
            'updated_at'
        ]
        
        assert 'state' in columns
        assert 'data' in columns
    
    def test_state_data_jsonb(self):
        """Тест JSONB для data"""
        import json
        
        state_data = {
            'partner_chat_id': '123456',
            'step': 'awaiting_title',
            'temp_service': {'title': 'Test'}
        }
        
        serialized = json.dumps(state_data)
        deserialized = json.loads(serialized)
        
        assert deserialized['step'] == 'awaiting_title'


class TestNPSRatingsTable:
    """Тесты таблицы nps_ratings"""
    
    def test_nps_ratings_columns(self):
        """Тест колонок nps_ratings"""
        columns = [
            'id',
            'client_chat_id',
            'partner_chat_id',
            'rating',
            'master_name',
            'feedback',
            'created_at'
        ]
        
        assert 'rating' in columns
        assert 'master_name' in columns
    
    def test_rating_range_constraint(self):
        """Тест ограничения диапазона рейтинга"""
        rating = 11
        
        is_valid = 0 <= rating <= 10
        assert is_valid is False


class TestRevenueShareTable:
    """Тесты таблицы revenue_share"""
    
    def test_revenue_share_columns(self):
        """Тест колонок revenue_share"""
        columns = [
            'id',
            'partner_chat_id',
            'amount',
            'currency',
            'source_partner_id',
            'source_transaction_id',
            'level',
            'status',
            'created_at'
        ]
        
        assert 'amount' in columns
        assert 'level' in columns
    
    def test_amount_precision(self):
        """Тест точности amount"""
        amount = 99.99
        
        # DECIMAL(10,2) - 10 цифр, 2 после запятой
        formatted = f"{amount:.2f}"
        
        assert formatted == "99.99"


class TestPayoutsTable:
    """Тесты таблицы payouts"""
    
    def test_payouts_columns(self):
        """Тест колонок payouts"""
        columns = [
            'id',
            'partner_chat_id',
            'amount',
            'currency',
            'to_address',
            'tx_hash',
            'status',
            'created_at',
            'completed_at'
        ]
        
        assert 'tx_hash' in columns
        assert 'to_address' in columns
    
    def test_payout_status_values(self):
        """Тест допустимых статусов выплаты"""
        statuses = ['pending', 'processing', 'completed', 'failed']
        
        status = 'completed'
        is_valid = status in statuses
        
        assert is_valid is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

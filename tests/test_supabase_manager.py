"""
Unit-тесты для SupabaseManager
"""

import json
import pytest
import datetime
import os
from unittest.mock import Mock, patch, MagicMock
from postgrest.exceptions import APIError
from supabase_manager import SupabaseManager
from transaction_queue import TransactionQueue


@pytest.fixture
def mock_supabase():
    """Фикстура для мокирования Supabase клиента"""
    with patch('supabase_manager.create_client') as mock_create:
        mock_client = MagicMock()
        mock_create.return_value = mock_client
        yield mock_client


@pytest.fixture
def manager(mock_supabase):
    """Фикстура для создания экземпляра SupabaseManager с мок-клиентом"""
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_KEY': 'test-key',
        'WELCOME_BONUS_AMOUNT': '100'
    }):
        manager = SupabaseManager()
        manager.transaction_queue = MagicMock()
        manager.transaction_queue.enqueue.return_value = True
        return manager


class TestSupabaseManagerInit:
    """Тесты инициализации"""
    
    def test_init_with_valid_env(self, manager):
        """Тест успешной инициализации с валидными переменными окружения"""
        assert manager.client is not None
        assert manager.CASHBACK_PERCENT == 0.05
        assert manager.WELCOME_BONUS_AMOUNT == 100
    
    def test_init_without_env(self):
        """Тест инициализации без переменных окружения"""
        with patch.dict(os.environ, {}, clear=True):
            manager = SupabaseManager()
            assert manager.client is None


class TestClientMethods:
    """Тесты методов работы с клиентами"""
    
    def test_client_exists_true(self, manager, mock_supabase):
        """Тест проверки существования клиента - клиент существует"""
        mock_response = Mock()
        mock_response.data = [{'chat_id': '123456'}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        result = manager.client_exists('123456')
        assert result is True
    
    def test_client_exists_false(self, manager, mock_supabase):
        """Тест проверки существования клиента - клиент не существует"""
        mock_response = Mock()
        mock_response.data = []
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        result = manager.client_exists('999999')
        assert result is False
    
    def test_get_client_balance(self, manager, mock_supabase):
        """Тест получения баланса клиента"""
        mock_response = Mock()
        mock_response.data = [{'balance': 500}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        balance = manager.get_client_balance('123456')
        assert balance == 500
    
    def test_get_client_balance_not_found(self, manager, mock_supabase):
        """Тест получения баланса несуществующего клиента"""
        mock_response = Mock()
        mock_response.data = []
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        balance = manager.get_client_balance('999999')
        assert balance == 0


class TestTransactions:
    """Тесты транзакций"""
    
    def test_execute_transaction_accrual_success(self, manager, mock_supabase):
        """Тест успешного начисления баллов"""
        # Мокируем получение текущего баланса
        balance_response = Mock()
        balance_response.data = [{'balance': 100}]
        
        # Мокируем обновление баланса
        update_response = Mock()
        update_response.data = [{'balance': 150}]
        
        # Мокируем запись транзакции
        transaction_response = Mock()
        transaction_response.data = [{}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = balance_response
        mock_supabase.from_().update().eq().execute.return_value = update_response
        mock_supabase.from_().insert().execute.return_value = transaction_response
        manager.transaction_queue.process_pending.reset_mock()

        with patch.object(manager, '_calculate_accrual_points', return_value=50) as mock_calc:
            result = manager.execute_transaction('123456', 'partner_1', 'accrual', 1000.0)
            mock_calc.assert_called_once_with('partner_1', 1000.0)
        
        assert result['success'] is True
        assert result['points'] == 50  # 5% от 1000
        assert result['new_balance'] == 150
        assert manager.transaction_queue.process_pending.call_count == 2
    
    def test_execute_transaction_spend_insufficient_balance(self, manager, mock_supabase):
        """Тест списания при недостаточном балансе"""
        balance_response = Mock()
        balance_response.data = [{'balance': 50}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = balance_response
        manager.transaction_queue.process_pending.reset_mock()
        
        result = manager.execute_transaction('123456', 'partner_1', 'spend', 100.0)
        
        assert result['success'] is False
        assert 'Недостаточно бонусов' in result['error']
        assert manager.transaction_queue.process_pending.call_count == 1
    
    def test_execute_transaction_spend_success(self, manager, mock_supabase):
        """Тест успешного списания баллов"""
        balance_response = Mock()
        balance_response.data = [{'balance': 200}]
        
        update_response = Mock()
        update_response.data = [{'balance': 150}]
        
        transaction_response = Mock()
        transaction_response.data = [{}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = balance_response
        mock_supabase.from_().update().eq().execute.return_value = update_response
        mock_supabase.from_().insert().execute.return_value = transaction_response
        manager.transaction_queue.process_pending.reset_mock()

        result = manager.execute_transaction('123456', 'partner_1', 'spend', 50.0)
        
        assert result['success'] is True
        assert result['new_balance'] == 150
        assert manager.transaction_queue.process_pending.call_count == 2

    def test_execute_transaction_limit_exceeded(self, manager, mock_supabase):
        """Тест ограничения по максимальному начислению"""
        balance_response = Mock()
        balance_response.data = [{'balance': 100}]
        mock_supabase.from_().select().eq().limit().execute.return_value = balance_response

        manager.transaction_queue.process_pending.reset_mock()
        manager._get_transaction_limits = MagicMock(return_value={
            'accrual': {'max_points_per_transaction': 10}
        })

        result = manager.execute_transaction('123456', 'partner_1', 'accrual', 1000.0)

        assert result['success'] is False
        assert 'Превышен лимит' in result['error']
        assert manager.transaction_queue.process_pending.call_count == 1

    def test_execute_transaction_queue_on_failure(self, manager, mock_supabase):
        """Тест постановки транзакции в очередь при ошибке БД"""
        balance_response = Mock()
        balance_response.data = [{'balance': 100}]
        mock_supabase.from_().select().eq().limit().execute.return_value = balance_response

        mock_update = mock_supabase.from_().update().eq().execute
        mock_update.side_effect = APIError(message="db error", details=None, code=None, hint=None)

        manager.transaction_queue.process_pending.reset_mock()
        manager.transaction_queue.enqueue.reset_mock()
        manager.transaction_queue.enqueue.return_value = True

        result = manager.execute_transaction('123456', 'partner_1', 'accrual', 1000.0)

        assert result['success'] is True
        assert result.get('queued') is True
        manager.transaction_queue.enqueue.assert_called_once()
        manager.transaction_queue.process_pending.assert_called_once()  # только попытка до ошибки


class TestPartnerMethods:
    """Тесты методов работы с партнёрами"""
    
    def test_partner_exists_true(self, manager, mock_supabase):
        """Тест проверки существования партнёра - партнёр существует"""
        mock_response = Mock()
        mock_response.data = [{'chat_id': 'partner_1'}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        result = manager.partner_exists('partner_1')
        assert result is True
    
    def test_get_partner_status(self, manager, mock_supabase):
        """Тест получения статуса партнёра"""
        mock_response = Mock()
        mock_response.data = [{'status': 'Approved'}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        status = manager.get_partner_status('partner_1')
        assert status == 'Approved'
    
    def test_approve_partner(self, manager, mock_supabase):
        """Тест одобрения партнёра"""
        update_response = Mock()
        update_response.data = [{}]
        
        mock_supabase.from_().update().eq().execute.return_value = update_response
        
        # Мокируем ensure_partner_record
        with patch.object(manager, 'ensure_partner_record', return_value=True):
            result = manager.approve_partner('partner_1')
            assert result is True


class TestCashbackRules:
    """Тесты гибких правил начисления"""

    def test_calculate_accrual_points_partner_override(self, manager):
        manager._cashback_rules_env = {
            "default_percent": 0.05,
            "partners": {
                "partner_1": {
                    "percent": 0.1,
                    "multiplier": 2
                }
            }
        }

        points = manager._calculate_accrual_points('partner_1', 1000.0)
        assert points == 200

    def test_calculate_accrual_points_expired_multiplier(self, manager):
        past_date = (datetime.datetime.now() - datetime.timedelta(days=1)).isoformat()
        manager._cashback_rules_env = {
            "default_percent": 0.05,
            "partners": {
                "partner_1": {
                    "multiplier": 3,
                    "multiplier_until": past_date
                }
            }
        }

        points = manager._calculate_accrual_points('partner_1', 1000.0)
        assert points == 50


class TestTransactionQueue:
    """Тесты очереди транзакций"""

    def test_enqueue_and_process_success(self, tmp_path):
        manager = MagicMock()
        manager.execute_transaction.return_value = {"success": True}
        queue_path = tmp_path / "queue.json"
        payload = {"client_chat_id": "1", "partner_chat_id": "2", "txn_type": "accrual", "raw_amount": 100}

        queue = TransactionQueue(manager, storage_path=str(queue_path))
        assert queue.enqueue(payload) is True

        queue.process_pending()

        manager.execute_transaction.assert_called_once_with("1", "2", "accrual", 100, allow_queue=False)
        assert json.loads(queue_path.read_text(encoding='utf-8')) == []

    def test_process_pending_failure_keeps_payload(self, tmp_path):
        manager = MagicMock()
        manager.execute_transaction.return_value = {"success": False, "error": "db down"}
        queue_path = tmp_path / "queue.json"
        payload = {"client_chat_id": "1", "partner_chat_id": "2", "txn_type": "accrual", "raw_amount": 100}

        queue = TransactionQueue(manager, storage_path=str(queue_path))
        assert queue.enqueue(payload) is True

        queue.process_pending()

        assert json.loads(queue_path.read_text(encoding='utf-8')) == [payload]


class TestNPSMethods:
    """Тесты методов NPS"""
    
    def test_record_nps_rating_success(self, manager, mock_supabase):
        """Тест успешной записи NPS оценки"""
        mock_response = Mock()
        mock_response.data = [{}]
        
        mock_supabase.from_().insert().execute.return_value = mock_response
        
        result = manager.record_nps_rating('client_1', 'partner_1', 9, 'Мастер Иван')
        assert result is True
    
    def test_record_nps_rating_invalid_score(self, manager, mock_supabase):
        """Тест записи невалидной NPS оценки (должна быть проверка в БД)"""
        # Этот тест проверяет, что метод пытается записать даже невалидный рейтинг
        # Валидация должна происходить на уровне БД (CHECK constraint)
        mock_response = Mock()
        mock_response.data = [{}]
        
        mock_supabase.from_().insert().execute.return_value = mock_response
        
        # Метод должен попытаться записать, БД отклонит
        result = manager.record_nps_rating('client_1', 'partner_1', 15)
        # В текущей реализации метод вернёт True, но БД должна отклонить


class TestWelcomeBonusConfiguration:
    """Тесты конфигурации приветственного бонуса"""
    
    def test_welcome_bonus_from_env(self, mock_supabase):
        """Тест загрузки приветственного бонуса из .env"""
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_KEY': 'test-key',
            'WELCOME_BONUS_AMOUNT': '200'
        }):
            manager = SupabaseManager()
            assert manager.WELCOME_BONUS_AMOUNT == 200
    
    def test_welcome_bonus_default_value(self, mock_supabase):
        """Тест значения приветственного бонуса по умолчанию"""
        with patch.dict(os.environ, {
            'SUPABASE_URL': 'https://test.supabase.co',
            'SUPABASE_KEY': 'test-key'
        }, clear=False):
            # Удаляем WELCOME_BONUS_AMOUNT если он есть
            os.environ.pop('WELCOME_BONUS_AMOUNT', None)
            manager = SupabaseManager()
            assert manager.WELCOME_BONUS_AMOUNT == 100


if __name__ == '__main__':
    pytest.main([__file__, '-v'])


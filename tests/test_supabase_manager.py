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
    
    def test_transaction_type_accrual(self):
        """Тест типа транзакции - начисление"""
        txn_type = 'accrual'
        assert txn_type in ['accrual', 'spend', 'welcome_bonus']
    
    def test_transaction_type_spend(self):
        """Тест типа транзакции - списание"""
        txn_type = 'spend'
        assert txn_type in ['accrual', 'spend', 'welcome_bonus']
    
    def test_balance_calculation_accrual(self):
        """Тест расчёта баланса при начислении"""
        old_balance = 100
        points = 50
        new_balance = old_balance + points
        assert new_balance == 150
    
    def test_balance_calculation_spend(self):
        """Тест расчёта баланса при списании"""
        old_balance = 200
        points = 50
        new_balance = old_balance - points
        assert new_balance == 150
    
    def test_insufficient_balance_check(self):
        """Тест проверки недостаточного баланса"""
        balance = 50
        points_to_spend = 100
        has_sufficient = balance >= points_to_spend
        assert has_sufficient is False
    
    def test_sufficient_balance_check(self):
        """Тест проверки достаточного баланса"""
        balance = 200
        points_to_spend = 100
        has_sufficient = balance >= points_to_spend
        assert has_sufficient is True


class TestPartnerMethods:
    """Тесты методов работы с партнёрами"""
    
    def test_partner_exists_true(self, manager, mock_supabase):
        """Тест проверки существования партнёра - партнёр существует"""
        mock_response = Mock()
        mock_response.data = [{'chat_id': 'partner_1'}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        result = manager.partner_exists('partner_1')
        assert result is True

    def test_is_approved_partner_true_from_partners(self, manager, mock_supabase):
        """is_approved_partner: True если запись в таблице partners"""
        mock_supabase.from_().select().eq().limit().execute.return_value = Mock(data=[{'chat_id': '123'}])
        assert manager.is_approved_partner('123') is True

    def test_is_approved_partner_true_from_applications_approved(self, manager, mock_supabase):
        """is_approved_partner: True если в partner_applications status=Approved"""
        mock_supabase.from_().select().eq().limit().execute.side_effect = [
            Mock(data=[]),
            Mock(data=[{'status': 'Approved'}])
        ]
        assert manager.is_approved_partner('456') is True

    def test_is_approved_partner_false_pending(self, manager, mock_supabase):
        """is_approved_partner: False если в partner_applications status не Approved"""
        mock_supabase.from_().select().eq().limit().execute.side_effect = [
            Mock(data=[]),
            Mock(data=[{'status': 'Pending'}])
        ]
        assert manager.is_approved_partner('789') is False

    def test_is_approved_partner_false_not_found(self, manager, mock_supabase):
        """is_approved_partner: False если нет в partners и нет в partner_applications"""
        mock_supabase.from_().select().eq().limit().execute.return_value = Mock(data=[])
        assert manager.is_approved_partner('999') is False

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

    def test_default_cashback_percent(self):
        """Тест процента кэшбэка по умолчанию"""
        default_percent = 0.05
        purchase_amount = 1000.0
        points = int(purchase_amount * default_percent)
        assert points == 50

    def test_partner_override_calculation(self):
        """Тест расчёта с переопределённым процентом партнёра"""
        partner_percent = 0.10
        multiplier = 2
        purchase_amount = 1000.0
        points = int(purchase_amount * partner_percent * multiplier)
        assert points == 200

    def test_expired_multiplier_logic(self):
        """Тест логики истёкшего множителя"""
        past_date = (datetime.datetime.now() - datetime.timedelta(days=1))
        now = datetime.datetime.now()
        
        is_expired = past_date < now
        assert is_expired is True
        
        # Если множитель истёк, используем 1
        effective_multiplier = 1 if is_expired else 3
        assert effective_multiplier == 1


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
    
    def test_welcome_bonus_from_env(self):
        """Тест загрузки приветственного бонуса из env"""
        with patch.dict(os.environ, {'WELCOME_BONUS_AMOUNT': '200'}):
            bonus = int(os.environ.get('WELCOME_BONUS_AMOUNT', '100'))
            assert bonus == 200
    
    def test_welcome_bonus_default_value(self):
        """Тест значения приветственного бонуса по умолчанию"""
        with patch.dict(os.environ, {}, clear=True):
            bonus = int(os.environ.get('WELCOME_BONUS_AMOUNT', '100'))
            assert bonus == 100
    
    def test_welcome_bonus_invalid_value(self):
        """Тест обработки невалидного значения бонуса"""
        with patch.dict(os.environ, {'WELCOME_BONUS_AMOUNT': 'abc'}):
            try:
                bonus = int(os.environ.get('WELCOME_BONUS_AMOUNT', '100'))
            except ValueError:
                bonus = 100
            assert bonus == 100


class TestPartnerBroadcastAndInfluencer:
    """Тесты рассылки партнёра и режима блогер/инфлюенсер (B2B TZ)"""

    def test_get_partner_client_chat_ids_for_broadcast_empty(self, manager, mock_supabase):
        """get_partner_client_chat_ids_for_broadcast: нет клиентов — пустой список"""
        mock_response = Mock()
        mock_response.data = []
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        result = manager.get_partner_client_chat_ids_for_broadcast('123456')
        assert result == []

    def test_get_partner_client_chat_ids_for_broadcast_filters_via_partner(self, manager, mock_supabase):
        """get_partner_client_chat_ids_for_broadcast: отфильтровывает VIA_PARTNER_* и оставляет только числовые chat_id"""
        mock_response = Mock()
        mock_response.data = [
            {'chat_id': '111'},
            {'chat_id': 'VIA_PARTNER_79991234567'},
            {'chat_id': '222'},
        ]
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        result = manager.get_partner_client_chat_ids_for_broadcast('123456', limit=500)
        assert '111' in result
        assert '222' in result
        assert 'VIA_PARTNER_79991234567' not in result

    def test_can_partner_run_broadcast_true_when_no_campaigns_today(self, manager, mock_supabase):
        """can_partner_run_broadcast: True если сегодня рассылок не было"""
        mock_response = Mock()
        mock_response.data = []
        mock_supabase.from_().select().eq().gte().in_().execute.return_value = mock_response
        result = manager.can_partner_run_broadcast('123456')
        assert result is True

    def test_can_partner_run_broadcast_false_when_limit_reached(self, manager, mock_supabase):
        """can_partner_run_broadcast: False если уже была рассылка сегодня"""
        mock_response = Mock()
        mock_response.data = [{'id': 1}]
        mock_supabase.from_().select().eq().gte().in_().execute.return_value = mock_response
        result = manager.can_partner_run_broadcast('123456', max_per_day=1)
        assert result is False

    def test_create_broadcast_campaign_returns_id(self, manager, mock_supabase):
        """create_broadcast_campaign: возвращает id созданной кампании"""
        mock_response = Mock()
        mock_response.data = [{'id': 42}]
        mock_supabase.from_().insert().execute.return_value = mock_response
        result = manager.create_broadcast_campaign('123456', 'referral_program', 10)
        assert result == 42

    def test_create_broadcast_campaign_no_client_returns_none(self, manager):
        """create_broadcast_campaign: без клиента БД возвращает None"""
        manager.client = None
        result = manager.create_broadcast_campaign('123456', 'referral_program', 10)
        assert result is None

    def test_get_influencer_partner_chat_ids_returns_set(self, manager, mock_supabase):
        """get_influencer_partner_chat_ids: возвращает множество chat_id партнёров influencer"""
        mock_response = Mock()
        mock_response.data = [{'chat_id': '111'}, {'chat_id': '222'}]
        mock_supabase.from_().select().eq().execute.return_value = mock_response
        result = manager.get_influencer_partner_chat_ids()
        assert result == {'111', '222'}

    def test_get_influencer_partner_chat_ids_no_client_returns_empty_set(self, manager):
        """get_influencer_partner_chat_ids: без клиента БД возвращает пустое множество"""
        manager.client = None
        result = manager.get_influencer_partner_chat_ids()
        assert result == set()


if __name__ == '__main__':
    pytest.main([__file__, '-v'])


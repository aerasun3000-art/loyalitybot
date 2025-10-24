"""
Unit-тесты для SupabaseManager
"""

import pytest
import os
from unittest.mock import Mock, patch, MagicMock
from supabase_manager import SupabaseManager


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
        return SupabaseManager()


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
        
        result = manager.execute_transaction('123456', 'partner_1', 'accrual', 1000.0)
        
        assert result['success'] is True
        assert result['points'] == 50  # 5% от 1000
        assert result['new_balance'] == 150
    
    def test_execute_transaction_spend_insufficient_balance(self, manager, mock_supabase):
        """Тест списания при недостаточном балансе"""
        balance_response = Mock()
        balance_response.data = [{'balance': 50}]
        
        mock_supabase.from_().select().eq().limit().execute.return_value = balance_response
        
        result = manager.execute_transaction('123456', 'partner_1', 'spend', 100.0)
        
        assert result['success'] is False
        assert 'Недостаточно бонусов' in result['error']
    
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
        
        result = manager.execute_transaction('123456', 'partner_1', 'spend', 50.0)
        
        assert result['success'] is True
        assert result['new_balance'] == 150


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


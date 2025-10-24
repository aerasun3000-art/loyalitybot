"""
Pytest конфигурация и общие фикстуры
"""

import pytest
import os
from unittest.mock import Mock, MagicMock


@pytest.fixture(scope='session')
def test_env():
    """Фикстура для установки тестовых переменных окружения"""
    test_vars = {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_KEY': 'test-key-12345',
        'TOKEN_PARTNER': 'test-partner-token',
        'TOKEN_CLIENT': 'test-client-token',
        'ADMIN_BOT_TOKEN': 'test-admin-token',
        'ADMIN_CHAT_ID': '123456789',
        'WELCOME_BONUS_AMOUNT': '100'
    }
    
    original_env = os.environ.copy()
    os.environ.update(test_vars)
    
    yield test_vars
    
    # Восстанавливаем оригинальное окружение
    os.environ.clear()
    os.environ.update(original_env)


@pytest.fixture
def mock_telegram_message():
    """Фикстура для мокирования Telegram сообщения"""
    message = Mock()
    message.chat.id = 123456
    message.text = "/start"
    message.from_user.id = 123456
    message.from_user.username = "testuser"
    return message


@pytest.fixture
def mock_callback_query():
    """Фикстура для мокирования Telegram callback query"""
    callback = Mock()
    callback.message.chat.id = 123456
    callback.message.message_id = 1
    callback.data = "test_callback"
    callback.id = "callback_123"
    return callback


@pytest.fixture
def sample_client_data():
    """Фикстура с примером данных клиента"""
    return {
        'chat_id': '123456',
        'name': 'Тестовый Клиент',
        'phone': '79991234567',
        'balance': 500,
        'status': 'active',
        'registered_via': 'partner_link',
        'referral_source': 'partner_1'
    }


@pytest.fixture
def sample_partner_data():
    """Фикстура с примером данных партнёра"""
    return {
        'chat_id': 'partner_1',
        'name': 'Тестовый Партнёр',
        'company_name': 'ООО Тест',
        'phone': '79999999999',
        'status': 'Approved'
    }


@pytest.fixture
def sample_transaction_data():
    """Фикстура с примером данных транзакции"""
    return {
        'client_chat_id': '123456',
        'partner_chat_id': 'partner_1',
        'total_amount': 1000.0,
        'earned_points': 50,
        'spent_points': 0,
        'operation_type': 'accrual',
        'description': 'Начисление за покупку'
    }


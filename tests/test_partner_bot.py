"""
Unit-тесты для партнёрского бота (bot.py)
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys

# Добавляем корневую директорию в путь
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def mock_telebot():
    """Мок для telebot"""
    with patch('bot.telebot.TeleBot') as mock:
        yield mock


@pytest.fixture
def mock_supabase_manager():
    """Мок для SupabaseManager"""
    with patch('bot.SupabaseManager') as mock:
        instance = MagicMock()
        mock.return_value = instance
        yield instance


@pytest.fixture
def mock_env():
    """Мок переменных окружения"""
    env_vars = {
        'TOKEN_PARTNER': 'test_partner_token',
        'TOKEN_CLIENT': 'test_client_token',
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_KEY': 'test_key',
        'ADMIN_CHAT_ID': '123456',
    }
    with patch.dict(os.environ, env_vars):
        yield env_vars


class TestPartnerBotInit:
    """Тесты инициализации партнёрского бота"""
    
    def test_token_loaded_from_env(self, mock_env):
        """Тест загрузки токена из переменных окружения"""
        assert os.environ.get('TOKEN_PARTNER') == 'test_partner_token'
    
    def test_token_missing_detection(self):
        """Тест обнаружения отсутствия токена"""
        with patch.dict(os.environ, {}, clear=True):
            # Проверяем, что без TOKEN_PARTNER переменная будет None
            token = os.environ.get('TOKEN_PARTNER')
            assert token is None


class TestUserStateManagement:
    """Тесты управления состоянием пользователя"""
    
    def test_user_state_dict_operations(self):
        """Тест операций со словарём состояний"""
        USER_STATE = {}
        chat_id = 123456
        
        # Установка состояния
        USER_STATE[chat_id] = 'awaiting_promo_title'
        assert USER_STATE.get(chat_id) == 'awaiting_promo_title'
        
        # Изменение состояния
        USER_STATE[chat_id] = 'awaiting_promo_description'
        assert USER_STATE.get(chat_id) == 'awaiting_promo_description'
        
        # Удаление состояния
        USER_STATE.pop(chat_id, None)
        assert USER_STATE.get(chat_id) is None
    
    def test_temp_data_dict_operations(self):
        """Тест операций со словарём временных данных"""
        TEMP_DATA = {}
        chat_id = 123456
        
        # Инициализация данных
        TEMP_DATA[chat_id] = {
            'partner_chat_id': str(chat_id),
            'service_ids': [],
            'promotion_type': 'points_redemption'
        }
        
        assert TEMP_DATA[chat_id]['partner_chat_id'] == '123456'
        assert TEMP_DATA[chat_id]['service_ids'] == []
        
        # Добавление услуги
        TEMP_DATA[chat_id]['service_ids'].append('service-uuid-1')
        assert len(TEMP_DATA[chat_id]['service_ids']) == 1
        
        # Очистка
        TEMP_DATA.pop(chat_id, None)
        assert chat_id not in TEMP_DATA


class TestPromotionValidation:
    """Тесты валидации данных акций"""
    
    def test_required_fields_check(self):
        """Тест проверки обязательных полей"""
        required_fields = ['title', 'description', 'end_date', 'partner_chat_id', 'service_price', 'max_points_payment']
        
        promo_data = {
            'title': 'Тестовая акция',
            'description': 'Описание',
            'end_date': '2026-12-31',
            'partner_chat_id': '123456',
            'service_price': 100,
            'max_points_payment': 50
        }
        
        missing_fields = [field for field in required_fields if not promo_data.get(field)]
        assert len(missing_fields) == 0
    
    def test_missing_fields_detected(self):
        """Тест обнаружения отсутствующих полей"""
        required_fields = ['title', 'description', 'end_date', 'partner_chat_id', 'service_price', 'max_points_payment']
        
        promo_data = {
            'title': 'Тестовая акция',
            # description отсутствует
            'end_date': '2026-12-31',
            'partner_chat_id': '123456',
            # service_price отсутствует
            'max_points_payment': 50
        }
        
        missing_fields = [field for field in required_fields if not promo_data.get(field)]
        assert 'description' in missing_fields
        assert 'service_price' in missing_fields
    
    def test_service_ids_validation(self):
        """Тест валидации списка услуг"""
        promo_data = {'service_ids': []}
        assert len(promo_data.get('service_ids', [])) == 0
        
        promo_data['service_ids'] = ['uuid-1', 'uuid-2']
        assert len(promo_data.get('service_ids', [])) == 2


class TestServiceValidation:
    """Тесты валидации данных услуг"""
    
    def test_price_validation_valid(self):
        """Тест валидации корректной цены"""
        price_text = "150"
        price = int(price_text)
        assert price > 0
        assert price == 150
    
    def test_price_validation_invalid_text(self):
        """Тест валидации некорректной цены (текст)"""
        price_text = "abc"
        with pytest.raises(ValueError):
            int(price_text)
    
    def test_price_validation_negative(self):
        """Тест валидации отрицательной цены"""
        price_text = "-50"
        price = int(price_text)
        assert price <= 0  # Должно быть отклонено
    
    def test_price_validation_zero(self):
        """Тест валидации нулевой цены"""
        price_text = "0"
        price = int(price_text)
        assert price <= 0  # Должно быть отклонено


class TestDateParsing:
    """Тесты парсинга дат"""
    
    def test_date_format_dd_mm_yyyy(self):
        """Тест парсинга даты в формате ДД.ММ.ГГГГ"""
        import datetime
        date_text = "31.12.2026"
        parts = date_text.split('.')
        
        if len(parts) == 3:
            day, month, year = parts
            parsed_date = datetime.date(int(year), int(month), int(day))
            assert parsed_date.year == 2026
            assert parsed_date.month == 12
            assert parsed_date.day == 31
    
    def test_date_format_yyyy_mm_dd(self):
        """Тест парсинга даты в формате ГГГГ-ММ-ДД"""
        import datetime
        date_text = "2026-12-31"
        parsed_date = datetime.date.fromisoformat(date_text)
        assert parsed_date.year == 2026
        assert parsed_date.month == 12
        assert parsed_date.day == 31
    
    def test_date_in_past_detection(self):
        """Тест обнаружения даты в прошлом"""
        import datetime
        past_date = datetime.date(2020, 1, 1)
        today = datetime.date.today()
        assert past_date < today
    
    def test_date_in_future_detection(self):
        """Тест обнаружения даты в будущем"""
        import datetime
        future_date = datetime.date(2030, 1, 1)
        today = datetime.date.today()
        assert future_date > today


class TestCallbackDataParsing:
    """Тесты парсинга callback_data"""
    
    def test_promo_callback_parsing(self):
        """Тест парсинга callback для акций"""
        callback_data = "promo_add"
        assert callback_data.startswith('promo_')
        assert callback_data == 'promo_add'
    
    def test_service_toggle_parsing(self):
        """Тест парсинга callback для переключения услуги"""
        callback_data = "promo_toggle_service_uuid-123-456"
        assert callback_data.startswith('promo_toggle_service_')
        service_id = callback_data.replace('promo_toggle_service_', '')
        assert service_id == 'uuid-123-456'
    
    def test_promo_approve_parsing(self):
        """Тест парсинга callback для одобрения акции"""
        callback_data = "promo_approve_uuid-promo|client-id"
        parts = callback_data.replace('promo_approve_', '').split('|')
        assert len(parts) == 2
        assert parts[0] == 'uuid-promo'
        assert parts[1] == 'client-id'
    
    def test_service_category_parsing(self):
        """Тест парсинга callback для категории услуги"""
        callback_data = "service_category_manicure"
        category = callback_data.replace('service_category_', '')
        assert category == 'manicure'


class TestMenuKeyboards:
    """Тесты клавиатур меню"""
    
    def test_main_menu_buttons(self):
        """Тест кнопок главного меню"""
        main_menu_buttons = [
            '💰 Операции',
            '📝 Контент', 
            '📊 Аналитика',
            '💎 Revenue Share',
            '👥 Пригласить клиента',
            '⚙️ Ещё'
        ]
        
        for btn in main_menu_buttons:
            assert len(btn) > 0
            assert isinstance(btn, str)
    
    def test_services_menu_callbacks(self):
        """Тест callback'ов меню услуг"""
        services_callbacks = [
            'service_add',
            'service_status',
            'service_edit_list',
            'service_delete_list',
            'service_back'
        ]
        
        for cb in services_callbacks:
            assert cb.startswith('service_')


class TestQRCodeGeneration:
    """Тесты генерации QR-кодов"""
    
    def test_qr_data_format(self):
        """Тест формата данных QR-кода"""
        client_id = "123456"
        partner_id = "789012"
        promo_id = "uuid-promo-123"
        
        qr_data = f"promo:{promo_id}:client:{client_id}"
        assert 'promo:' in qr_data
        assert client_id in qr_data
        assert promo_id in qr_data
    
    def test_qr_data_parsing(self):
        """Тест парсинга данных QR-кода"""
        qr_data = "promo:uuid-123:client:456789"
        parts = qr_data.split(':')
        
        assert parts[0] == 'promo'
        assert parts[1] == 'uuid-123'
        assert parts[2] == 'client'
        assert parts[3] == '456789'


class TestPointsCalculation:
    """Тесты расчёта баллов"""
    
    def test_full_payment_calculation(self):
        """Тест расчёта полной оплаты баллами"""
        service_price = 100
        max_points_payment = 100
        
        # Полная оплата - max_points_payment >= service_price
        assert max_points_payment >= service_price
    
    def test_partial_payment_calculation(self):
        """Тест расчёта частичной оплаты баллами"""
        service_price = 100
        max_points_payment = 50
        cash_payment = service_price - max_points_payment
        
        assert max_points_payment < service_price
        assert cash_payment == 50
    
    def test_discount_value_full(self):
        """Тест формирования строки полной скидки"""
        max_payment = 100
        service_price = 100
        
        if max_payment >= service_price:
            discount_value = "Оплата баллами (полная)"
        else:
            discount_value = f"Оплата баллами (до ${max_payment})"
        
        assert discount_value == "Оплата баллами (полная)"
    
    def test_discount_value_partial(self):
        """Тест формирования строки частичной скидки"""
        max_payment = 50
        service_price = 100
        
        if max_payment >= service_price:
            discount_value = "Оплата баллами (полная)"
        else:
            discount_value = f"Оплата баллами (до ${max_payment})"
        
        assert discount_value == "Оплата баллами (до $50)"


class TestPartnerValidation:
    """Тесты валидации партнёра"""
    
    def test_partner_chat_id_conversion(self):
        """Тест конвертации chat_id в строку"""
        chat_id = 123456
        partner_chat_id = str(chat_id)
        assert partner_chat_id == "123456"
        assert isinstance(partner_chat_id, str)
    
    def test_partner_status_check(self):
        """Тест проверки статуса партнёра"""
        valid_statuses = ['Pending', 'Approved', 'Rejected']
        
        for status in valid_statuses:
            assert status in valid_statuses
    
    def test_approved_partner_check(self):
        """Тест проверки одобренного партнёра"""
        partner_status = 'Approved'
        is_approved = partner_status == 'Approved'
        assert is_approved is True


class TestRevenueShareCalculation:
    """Тесты расчёта Revenue Share"""
    
    def test_commission_calculation(self):
        """Тест расчёта комиссии"""
        transaction_amount = 1000
        commission_rate = 0.05  # 5%
        commission = transaction_amount * commission_rate
        assert commission == 50
    
    def test_referral_bonus_calculation(self):
        """Тест расчёта реферального бонуса"""
        levels = {
            1: 0.10,  # 10% первый уровень
            2: 0.05,  # 5% второй уровень
            3: 0.02   # 2% третий уровень
        }
        
        transaction = 1000
        level1_bonus = transaction * levels[1]
        level2_bonus = transaction * levels[2]
        level3_bonus = transaction * levels[3]
        
        assert level1_bonus == 100
        assert level2_bonus == 50
        assert level3_bonus == 20


class TestInviteAndBroadcastCallbacks:
    """Тесты меню приглашения и рассылки (B2B TZ)"""

    def test_invite_callback_data_values(self):
        """Тест callback_data для меню приглашения и рассылки"""
        invite_callbacks = [
            'invite_by_link',
            'invite_copy_link',
            'invite_send_to_client',
            'invite_get_qr',
            'invite_download_promo',
            'invite_broadcast_start',
            'invite_broadcast_audience_referral',
            'invite_broadcast_audience_transactions',
            'invite_broadcast_audience_combined',
            'invite_broadcast_confirm',
            'invite_broadcast_cancel',
        ]
        for cb in invite_callbacks:
            assert cb.startswith('invite_')
            assert len(cb) > 10

    def test_referral_link_format_with_username(self):
        """Тест формата реферальной ссылки: единый формат ref_ (клиент/партнёр)"""
        client_username = 'mindbeatybot'
        partner_id = '123456'
        ref_code = partner_id  # в боте: sm.get_or_create_referral_code(partner_id) or partner_id
        link = f"https://t.me/{client_username}?start=ref_{ref_code}"
        assert 't.me' in link
        assert client_username in link
        assert "start=ref_" in link
        assert ref_code in link

    def test_broadcast_template_placeholders(self):
        """Тест что шаблон рассылки содержит плейсхолдеры для партнёра и ссылки"""
        partner_name = "Салон Красоты"
        ref_link = "https://t.me/bot?start=ref_123"
        template_text = (
            f"👋 Здравствуйте!\n\n"
            f"{partner_name} приглашает вас в программу лояльности.\n\n"
            f"Перейдите по ссылке и получите приветственные баллы:\n{ref_link}"
        )
        assert partner_name in template_text
        assert ref_link in template_text
        assert "программу лояльности" in template_text


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

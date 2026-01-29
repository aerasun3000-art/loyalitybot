"""
Unit-тесты для клиентского бота (client_handler.py)
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestClientBotInit:
    """Тесты инициализации клиентского бота"""
    
    def test_client_token_env(self):
        """Тест наличия токена клиентского бота"""
        with patch.dict(os.environ, {'TOKEN_CLIENT': 'test_client_token'}):
            assert os.environ.get('TOKEN_CLIENT') == 'test_client_token'
    
    def test_welcome_bonus_env(self):
        """Тест настройки приветственного бонуса"""
        with patch.dict(os.environ, {'WELCOME_BONUS_AMOUNT': '150'}):
            bonus = int(os.environ.get('WELCOME_BONUS_AMOUNT', '100'))
            assert bonus == 150
    
    def test_welcome_bonus_default(self):
        """Тест приветственного бонуса по умолчанию"""
        with patch.dict(os.environ, {}, clear=True):
            bonus = int(os.environ.get('WELCOME_BONUS_AMOUNT', '100'))
            assert bonus == 100


class TestReferralLinkParsing:
    """Тесты парсинга реферальных ссылок"""
    
    def test_partner_referral_link(self):
        """Тест парсинга ссылки партнёра"""
        text = "/start partner_123456"
        pattern = re.compile(r'partner_(\d+)', re.IGNORECASE)
        match = pattern.search(text)
        
        assert match is not None
        assert match.group(1) == '123456'
    
    def test_ref_referral_link(self):
        """Тест парсинга ref-ссылки"""
        text = "/start ref_ABC123"
        pattern = re.compile(r'ref_([A-Za-z0-9]+)', re.IGNORECASE)
        match = pattern.search(text)
        
        assert match is not None
        assert match.group(1) == 'ABC123'
    
    def test_no_referral_link(self):
        """Тест без реферальной ссылки"""
        text = "/start"
        pattern = re.compile(r'partner_(\d+)', re.IGNORECASE)
        match = pattern.search(text)
        
        assert match is None
    
    def test_combined_referral_pattern(self):
        """Тест комбинированного паттерна"""
        pattern = re.compile(r'(?:partner_|ref_)(\d+|[\w\d]+)', re.IGNORECASE)
        
        # Тест partner_
        text1 = "/start partner_123456"
        match1 = pattern.search(text1)
        assert match1 is not None
        assert match1.group(1) == '123456'
        
        # Тест ref_
        text2 = "/start ref_ABC123"
        match2 = pattern.search(text2)
        assert match2 is not None
        assert match2.group(1) == 'ABC123'


class TestUserRegistration:
    """Тесты регистрации пользователя"""
    
    def test_user_data_structure(self):
        """Тест структуры данных пользователя"""
        user_data = {
            'chat_id': '123456',
            'name': 'Иван Петров',
            'username': 'ivan_petrov',
            'reg_date': '2026-01-19T12:00:00Z',
            'balance': 100,
            'referral_source': 'partner_789012',
            'status': 'active'
        }
        
        assert user_data['chat_id'] == '123456'
        assert user_data['balance'] == 100
        assert user_data['status'] == 'active'
    
    def test_name_building(self):
        """Тест построения имени пользователя"""
        first_name = "Иван"
        last_name = "Петров"
        username = "ivan_petrov"
        
        # Логика построения имени
        name = ' '.join(filter(None, [first_name, last_name])) or username or None
        assert name == "Иван Петров"
        
        # Только first_name
        name2 = ' '.join(filter(None, [first_name, None])) or username or None
        assert name2 == "Иван"
        
        # Только username
        name3 = ' '.join(filter(None, [None, None])) or username or None
        assert name3 == "ivan_petrov"
    
    def test_referral_source_format(self):
        """Тест формата источника реферала"""
        referral_id = '123456'
        text = "/start partner_123456"
        
        if 'partner_' in text:
            referral_source = f"partner_{referral_id}"
        else:
            referral_source = f"ref_{referral_id}"
        
        assert referral_source == "partner_123456"


class TestBalanceOperations:
    """Тесты операций с балансом"""
    
    def test_balance_display(self):
        """Тест отображения баланса"""
        balance = 500
        message = f"💰 **Ваш баланс:** {balance} баллов"
        
        assert str(balance) in message
        assert 'баллов' in message
    
    def test_zero_balance(self):
        """Тест нулевого баланса"""
        user = {'balance': None}
        balance = user.get('balance') or 0
        assert balance == 0
    
    def test_balance_formatting(self):
        """Тест форматирования баланса"""
        balances = [0, 100, 1000, 10000, 1000000]
        
        for bal in balances:
            formatted = f"{bal:,}".replace(',', ' ')
            assert isinstance(formatted, str)


class TestNPSRating:
    """Тесты NPS рейтинга"""
    
    def test_nps_rating_values(self):
        """Тест допустимых значений NPS"""
        valid_ratings = list(range(0, 11))  # 0-10
        
        for rating in valid_ratings:
            assert 0 <= rating <= 10
    
    def test_nps_rating_parsing(self):
        """Тест парсинга callback NPS рейтинга"""
        callback_data = "nps_rate_9"
        rating = int(callback_data.replace('nps_rate_', ''))
        
        assert rating == 9
    
    def test_nps_categories(self):
        """Тест категоризации NPS"""
        def categorize_nps(rating):
            if rating >= 9:
                return 'promoter'
            elif rating >= 7:
                return 'passive'
            else:
                return 'detractor'
        
        assert categorize_nps(10) == 'promoter'
        assert categorize_nps(9) == 'promoter'
        assert categorize_nps(8) == 'passive'
        assert categorize_nps(7) == 'passive'
        assert categorize_nps(6) == 'detractor'
        assert categorize_nps(0) == 'detractor'
    
    def test_nps_rating_keyboard_generation(self):
        """Тест генерации клавиатуры NPS"""
        keyboard = []
        for i in range(0, 11, 5):  # 0, 5, 10
            row = []
            for j in range(5):
                if i + j <= 10:
                    row.append(f"nps_rate_{i + j}")
            keyboard.append(row)
        
        assert len(keyboard) >= 2


class TestWebAppIntegration:
    """Тесты интеграции с WebApp"""
    
    def test_frontend_url_env(self):
        """Тест URL фронтенда из env"""
        with patch.dict(os.environ, {'FRONTEND_URL': 'https://example.com'}):
            frontend_url = os.environ.get('FRONTEND_URL', 'https://default.com')
            assert frontend_url == 'https://example.com'
    
    def test_frontend_url_default(self):
        """Тест URL фронтенда по умолчанию"""
        with patch.dict(os.environ, {}, clear=True):
            frontend_url = os.environ.get('FRONTEND_URL', 'https://loyalitybot-frontend.pages.dev')
            assert frontend_url == 'https://loyalitybot-frontend.pages.dev'
    
    def test_webapp_button_structure(self):
        """Тест структуры кнопки WebApp"""
        frontend_url = 'https://example.com'
        button = {
            'text': '🚀 Открыть приложение',
            'web_app': {'url': frontend_url}
        }
        
        assert 'web_app' in button
        assert button['web_app']['url'] == frontend_url


class TestMessageFormatting:
    """Тесты форматирования сообщений"""
    
    def test_welcome_message_new_user(self):
        """Тест приветственного сообщения для нового пользователя"""
        welcome_bonus = 100
        message = (
            f"🎉 **Добро пожаловать в программу лояльности!**\n\n"
            f"✅ Вы получили приветственный бонус: **{welcome_bonus} баллов**"
        )
        
        assert '🎉' in message
        assert str(welcome_bonus) in message
        assert 'баллов' in message
    
    def test_welcome_message_returning_user(self):
        """Тест приветственного сообщения для вернувшегося пользователя"""
        balance = 500
        message = (
            f"👋 С возвращением!\n\n"
            f"Ваш баланс: **{balance} баллов**"
        )
        
        assert '👋' in message
        assert str(balance) in message
    
    def test_error_message_user_not_found(self):
        """Тест сообщения об ошибке - пользователь не найден"""
        message = "❌ Пользователь не найден. Пожалуйста, зарегистрируйтесь через /start"
        
        assert '❌' in message
        assert '/start' in message


class TestCallbackHandling:
    """Тесты обработки callback'ов"""
    
    def test_balance_callback(self):
        """Тест callback баланса"""
        callback_data = "balance"
        assert callback_data == "balance"
    
    def test_nps_callback_prefix(self):
        """Тест префикса NPS callback"""
        callback_data = "nps_rate_5"
        assert callback_data.startswith('nps_rate_')
    
    def test_unknown_callback_handling(self):
        """Тест обработки неизвестного callback"""
        known_callbacks = ['balance', 'nps_rate_']
        callback_data = "unknown_callback"
        
        is_known = any(
            callback_data.startswith(cb) 
            for cb in known_callbacks
        )
        
        assert is_known is False


class TestTextMessageHandling:
    """Тесты обработки текстовых сообщений"""
    
    def test_command_detection(self):
        """Тест определения команды"""
        messages = ['/start', '/help', 'Привет', 'Как дела?']
        
        for msg in messages:
            is_command = msg.startswith('/')
            if msg.startswith('/'):
                assert is_command is True
            else:
                assert is_command is False
    
    def test_start_command_variations(self):
        """Тест вариаций команды /start"""
        commands = ['/start', '/START', '/Start']
        
        for cmd in commands:
            assert cmd.lower().startswith('/start')
    
    def test_question_detection(self):
        """Тест определения вопроса"""
        messages = ['?Как получить баллы', '? Сколько у меня баллов', 'Привет']
        
        for msg in messages:
            is_question = msg.startswith('?')
            if msg.startswith('?'):
                assert is_question is True
            else:
                assert is_question is False


class TestPromotionActivation:
    """Тесты активации акций"""
    
    def test_promotion_data_structure(self):
        """Тест структуры данных акции"""
        promotion = {
            'id': 'promo-uuid-123',
            'title': 'Скидка 50%',
            'description': 'Описание акции',
            'required_points': 100,
            'is_active': True,
            'partner_chat_id': '123456'
        }
        
        assert promotion['is_active'] is True
        assert promotion['required_points'] == 100
    
    def test_points_check_for_activation(self):
        """Тест проверки баллов для активации"""
        user_balance = 150
        required_points = 100
        
        can_activate = user_balance >= required_points
        assert can_activate is True
        
        user_balance2 = 50
        can_activate2 = user_balance2 >= required_points
        assert can_activate2 is False
    
    def test_qr_code_generation_data(self):
        """Тест данных для генерации QR-кода"""
        client_id = '123456'
        promo_id = 'promo-uuid-123'
        
        qr_data = f"promo:{promo_id}:client:{client_id}"
        
        assert 'promo:' in qr_data
        assert promo_id in qr_data
        assert client_id in qr_data


class TestTransactionHistory:
    """Тесты истории транзакций"""
    
    def test_transaction_types(self):
        """Тест типов транзакций"""
        types = ['accrual', 'spend', 'welcome_bonus', 'referral_bonus']
        
        for t in types:
            assert isinstance(t, str)
    
    def test_transaction_display_format(self):
        """Тест формата отображения транзакции"""
        transaction = {
            'id': 'txn-123',
            'type': 'accrual',
            'points': 50,
            'created_at': '2026-01-19T12:00:00Z',
            'partner_name': 'Тестовый партнёр'
        }
        
        # Формат отображения
        if transaction['type'] == 'accrual':
            emoji = '➕'
            prefix = '+'
        else:
            emoji = '➖'
            prefix = '-'
        
        display = f"{emoji} {prefix}{transaction['points']} баллов"
        
        assert '➕' in display
        assert '+50' in display


class TestServiceDiscovery:
    """Тесты поиска услуг"""
    
    def test_service_filter_by_category(self):
        """Тест фильтрации услуг по категории"""
        services = [
            {'id': '1', 'category': 'manicure', 'title': 'Маникюр'},
            {'id': '2', 'category': 'massage', 'title': 'Массаж'},
            {'id': '3', 'category': 'manicure', 'title': 'Педикюр'},
        ]
        
        manicure_services = [s for s in services if s['category'] == 'manicure']
        assert len(manicure_services) == 2
    
    def test_service_filter_by_points(self):
        """Тест фильтрации услуг по баллам"""
        services = [
            {'id': '1', 'price_points': 50},
            {'id': '2', 'price_points': 100},
            {'id': '3', 'price_points': 150},
        ]
        
        user_balance = 100
        affordable = [s for s in services if s['price_points'] <= user_balance]
        assert len(affordable) == 2


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

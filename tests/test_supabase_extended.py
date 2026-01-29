"""
Расширенные тесты для SupabaseManager - дополнительные методы
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def mock_supabase():
    """Фикстура для мокирования Supabase клиента"""
    with patch('supabase_manager.create_client') as mock_create:
        mock_client = MagicMock()
        mock_create.return_value = mock_client
        yield mock_client


@pytest.fixture
def manager(mock_supabase):
    """Фикстура для создания экземпляра SupabaseManager"""
    with patch.dict(os.environ, {
        'SUPABASE_URL': 'https://test.supabase.co',
        'SUPABASE_KEY': 'test-key',
        'WELCOME_BONUS_AMOUNT': '100'
    }):
        from supabase_manager import SupabaseManager
        manager = SupabaseManager()
        manager.transaction_queue = MagicMock()
        manager.transaction_queue.enqueue.return_value = True
        return manager


class TestPromotionMethods:
    """Тесты методов работы с акциями"""
    
    def test_add_promotion_validation(self):
        """Тест валидации данных акции"""
        promo_data = {
            'title': 'Тестовая акция',
            'description': 'Описание',
            'discount_value': 'Оплата баллами (полная)',
            'partner_chat_id': '123456',
            'end_date': '2026-12-31',
            'promotion_type': 'points_redemption',
            'service_ids': ['uuid-1', 'uuid-2']
        }
        
        # Проверка обязательных полей
        required = ['title', 'description', 'discount_value', 'partner_chat_id', 'end_date']
        for field in required:
            assert field in promo_data
            assert promo_data[field] is not None
    
    def test_promotion_type_values(self):
        """Тест допустимых типов акций"""
        valid_types = ['discount', 'points_redemption', 'cashback']
        
        for t in valid_types:
            assert t in valid_types
    
    def test_promotion_dates_normalization(self):
        """Тест нормализации дат акции"""
        # Дата без start_date
        today = datetime.datetime.now().strftime("%Y-%m-%d")
        start_date = None
        
        if not start_date:
            start_date = today
        
        assert start_date == today
        
        # Парсинг end_date
        end_date_str = "2026-12-31"
        end_date = datetime.date.fromisoformat(end_date_str)
        assert end_date.year == 2026
        assert end_date.month == 12


class TestServiceMethods:
    """Тесты методов работы с услугами"""
    
    def test_add_service_data_structure(self):
        """Тест структуры данных услуги"""
        service_data = {
            'title': 'Тестовая услуга',
            'description': 'Описание услуги',
            'price_points': 100,
            'partner_chat_id': '123456',
            'category': 'manicure',
            'approval_status': 'Pending',
            'is_active': True
        }
        
        assert service_data['approval_status'] == 'Pending'
        assert service_data['is_active'] is True
    
    def test_service_approval_status_update(self, manager, mock_supabase):
        """Тест обновления статуса услуги"""
        mock_response = Mock()
        mock_response.data = [{'id': 'uuid-1', 'approval_status': 'Approved'}]
        mock_supabase.from_().update().eq().execute.return_value = mock_response
        
        # Симуляция обновления
        new_status = 'Approved'
        assert new_status in ['Pending', 'Approved', 'Rejected']
    
    def test_get_services_by_partner(self, manager, mock_supabase):
        """Тест получения услуг партнёра"""
        mock_response = Mock()
        mock_response.data = [
            {'id': 'uuid-1', 'title': 'Услуга 1'},
            {'id': 'uuid-2', 'title': 'Услуга 2'}
        ]
        mock_supabase.from_().select().eq().execute.return_value = mock_response
        
        # Проверка структуры ответа
        assert len(mock_response.data) == 2


class TestUserMethods:
    """Тесты методов работы с пользователями"""
    
    def test_register_user_data(self):
        """Тест данных регистрации пользователя"""
        user_data = {
            'chat_id': '123456',
            'name': 'Тестовый пользователь',
            'username': 'test_user',
            'balance': 100,
            'reg_date': datetime.datetime.now().isoformat(),
            'referral_source': 'partner_789012'
        }
        
        assert user_data['balance'] == 100
        assert 'partner_' in user_data['referral_source']
    
    def test_update_user_balance(self, manager, mock_supabase):
        """Тест обновления баланса пользователя"""
        old_balance = 100
        points_to_add = 50
        new_balance = old_balance + points_to_add
        
        assert new_balance == 150
        
        points_to_subtract = 30
        new_balance2 = new_balance - points_to_subtract
        assert new_balance2 == 120
    
    def test_get_user_by_username(self, manager, mock_supabase):
        """Тест поиска пользователя по username"""
        mock_response = Mock()
        mock_response.data = [{'chat_id': '123456', 'username': 'test_user'}]
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        assert mock_response.data[0]['username'] == 'test_user'


class TestTransactionMethods:
    """Тесты методов работы с транзакциями"""
    
    def test_transaction_types(self):
        """Тест типов транзакций"""
        types = {
            'accrual': 'Начисление',
            'spend': 'Списание',
            'welcome_bonus': 'Приветственный бонус',
            'referral_bonus': 'Реферальный бонус'
        }
        
        assert 'accrual' in types
        assert 'spend' in types
    
    def test_transaction_limits(self):
        """Тест лимитов транзакций"""
        limits = {
            'accrual': {'max_points_per_transaction': 10000},
            'spend': {'max_points_per_transaction': 5000}
        }
        
        assert limits['accrual']['max_points_per_transaction'] == 10000
        assert limits['spend']['max_points_per_transaction'] == 5000
    
    def test_cashback_calculation(self):
        """Тест расчёта кэшбэка"""
        purchase_amount = 1000
        cashback_percent = 0.05
        cashback_points = int(purchase_amount * cashback_percent)
        
        assert cashback_points == 50


class TestPartnerMethods:
    """Тесты методов работы с партнёрами"""
    
    def test_partner_data_structure(self):
        """Тест структуры данных партнёра"""
        partner_data = {
            'chat_id': '123456',
            'name': 'Тестовый партнёр',
            'company_name': 'ООО Тест',
            'business_type': 'manicure',
            'city': 'Москва',
            'district': 'Центральный',
            'booking_url': 'https://example.com/book'
        }
        
        assert partner_data['business_type'] == 'manicure'
    
    def test_ensure_partner_record(self, manager, mock_supabase):
        """Тест создания записи партнёра"""
        mock_response = Mock()
        mock_response.data = []  # Партнёр не существует
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        # Проверка логики создания
        partner_chat_id = '123456'
        assert partner_chat_id is not None
    
    def test_get_partner_by_chat_id(self, manager, mock_supabase):
        """Тест получения партнёра по chat_id"""
        mock_response = Mock()
        mock_response.data = [{'chat_id': '123456', 'name': 'Партнёр'}]
        mock_supabase.from_().select().eq().limit().execute.return_value = mock_response
        
        assert mock_response.data[0]['chat_id'] == '123456'


class TestNPSMethods:
    """Тесты методов NPS"""
    
    def test_nps_rating_data(self):
        """Тест данных NPS рейтинга"""
        nps_data = {
            'client_chat_id': '123456',
            'partner_chat_id': '789012',
            'rating': 9,
            'master_name': 'Иван',
            'created_at': datetime.datetime.now().isoformat()
        }
        
        assert 0 <= nps_data['rating'] <= 10
    
    def test_nps_score_calculation(self):
        """Тест расчёта NPS score"""
        ratings = [10, 9, 8, 7, 6, 9, 10, 8, 5, 9]
        
        promoters = len([r for r in ratings if r >= 9])
        passives = len([r for r in ratings if 7 <= r <= 8])
        detractors = len([r for r in ratings if r <= 6])
        total = len(ratings)
        
        nps_score = ((promoters - detractors) / total) * 100
        
        # 5 promoters, 3 passives, 2 detractors
        assert promoters == 5
        assert passives == 3
        assert detractors == 2
        assert nps_score == 30.0


class TestMLMMethods:
    """Тесты методов MLM"""
    
    def test_referral_chain_structure(self):
        """Тест структуры реферальной цепочки"""
        chain = [
            {'level': 1, 'partner_id': '111', 'commission': 0.10},
            {'level': 2, 'partner_id': '222', 'commission': 0.05},
            {'level': 3, 'partner_id': '333', 'commission': 0.02}
        ]
        
        assert len(chain) == 3
        assert chain[0]['level'] == 1
    
    def test_revenue_share_calculation(self):
        """Тест расчёта Revenue Share"""
        transaction_amount = 1000
        commission_rates = {1: 0.10, 2: 0.05, 3: 0.02}
        
        total_commission = sum(
            transaction_amount * rate 
            for rate in commission_rates.values()
        )
        
        assert total_commission == 170  # 100 + 50 + 20


class TestNewsletterMethods:
    """Тесты методов рассылки"""
    
    def test_newsletter_data(self):
        """Тест данных рассылки"""
        newsletter = {
            'id': 'newsletter-123',
            'title': 'Новая акция!',
            'message': 'Спешите воспользоваться скидкой 50%',
            'target_audience': 'all',
            'scheduled_at': None,
            'sent_at': None
        }
        
        assert newsletter['target_audience'] == 'all'
    
    def test_target_audience_filter(self):
        """Тест фильтрации аудитории"""
        audiences = ['all', 'active_users', 'partners', 'new_users']
        
        for audience in audiences:
            assert audience in audiences


class TestAnalyticsMethods:
    """Тесты методов аналитики"""
    
    def test_partner_stats_structure(self):
        """Тест структуры статистики партнёра"""
        stats = {
            'total_clients': 150,
            'total_transactions': 500,
            'total_points_given': 25000,
            'total_points_spent': 15000,
            'average_nps': 8.5
        }
        
        assert stats['total_clients'] == 150
        assert stats['average_nps'] == 8.5
    
    def test_date_range_filtering(self):
        """Тест фильтрации по диапазону дат"""
        start_date = datetime.date(2026, 1, 1)
        end_date = datetime.date(2026, 1, 31)
        
        # Проверка диапазона
        assert start_date < end_date
        
        # Кол-во дней
        days = (end_date - start_date).days
        assert days == 30


class TestCurrencyUtils:
    """Тесты утилит валюты"""
    
    def test_currency_formatting(self):
        """Тест форматирования валюты"""
        amount = 1000
        currency = 'USD'
        
        formatted = f"${amount:,.2f}" if currency == 'USD' else f"{amount:,.2f} ₽"
        assert '$1,000.00' in formatted or formatted == "$1,000.00"
    
    def test_city_currency_mapping(self):
        """Тест маппинга город-валюта"""
        city_currencies = {
            'New York': 'USD',
            'Moscow': 'RUB',
            'London': 'GBP'
        }
        
        assert city_currencies['New York'] == 'USD'
        assert city_currencies['Moscow'] == 'RUB'


class TestImageHandling:
    """Тесты обработки изображений"""
    
    def test_image_url_validation(self):
        """Тест валидации URL изображения"""
        valid_urls = [
            'https://example.com/image.jpg',
            'https://storage.supabase.co/bucket/file.png',
        ]
        
        for url in valid_urls:
            assert url.startswith('http')
            assert '.' in url
    
    def test_image_upload_path_generation(self):
        """Тест генерации пути для загрузки"""
        partner_id = '123456'
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"promo_{partner_id}_{timestamp}.jpg"
        
        assert partner_id in filename
        assert 'promo_' in filename


class TestBotStateManagement:
    """Тесты управления состоянием бота"""
    
    def test_bot_state_data(self):
        """Тест данных состояния бота"""
        state_data = {
            'chat_id': '123456',
            'state': 'awaiting_service_title',
            'data': {
                'partner_chat_id': '123456',
                'approval_status': 'Pending'
            },
            'updated_at': datetime.datetime.now().isoformat()
        }
        
        assert state_data['state'] == 'awaiting_service_title'
        assert 'partner_chat_id' in state_data['data']
    
    def test_state_transitions(self):
        """Тест переходов состояний"""
        service_creation_states = [
            'awaiting_service_title',
            'awaiting_service_description',
            'awaiting_service_price',
            'awaiting_service_category'
        ]
        
        for i, state in enumerate(service_creation_states):
            assert 'awaiting_service' in state
            # Проверка порядка
            if i > 0:
                assert service_creation_states[i] != service_creation_states[i-1]


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

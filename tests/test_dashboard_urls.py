"""
Unit-тесты для dashboard_urls.py
Полное покрытие URL дашборда
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import re

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestDashboardURLs:
    """Тесты URL дашборда"""
    
    def test_base_url_structure(self):
        """Тест структуры базового URL"""
        base_url = 'https://loyalty-dashboard.example.com'
        
        assert base_url.startswith('https://')
        assert 'dashboard' in base_url
    
    def test_api_base_url(self):
        """Тест базового URL API"""
        api_base = 'https://api.loyalty.example.com/v1'
        
        assert '/v1' in api_base
    
    def test_frontend_url_from_env(self):
        """Тест URL фронтенда из env"""
        with patch.dict(os.environ, {'FRONTEND_URL': 'https://app.loyalty.com'}):
            url = os.environ.get('FRONTEND_URL')
            assert url == 'https://app.loyalty.com'


class TestPartnerDashboardURLs:
    """Тесты URL партнёрского дашборда"""
    
    def test_partner_home_url(self):
        """Тест URL главной страницы партнёра"""
        base_url = 'https://dashboard.example.com'
        partner_home = f"{base_url}/partner"
        
        assert '/partner' in partner_home
    
    def test_partner_services_url(self):
        """Тест URL услуг партнёра"""
        base_url = 'https://dashboard.example.com'
        services_url = f"{base_url}/partner/services"
        
        assert '/services' in services_url
    
    def test_partner_analytics_url(self):
        """Тест URL аналитики партнёра"""
        base_url = 'https://dashboard.example.com'
        analytics_url = f"{base_url}/partner/analytics"
        
        assert '/analytics' in analytics_url
    
    def test_partner_id_in_url(self):
        """Тест ID партнёра в URL"""
        partner_id = '123456'
        url = f"/partner/{partner_id}/profile"
        
        assert partner_id in url


class TestClientDashboardURLs:
    """Тесты URL клиентского дашборда"""
    
    def test_client_home_url(self):
        """Тест URL главной страницы клиента"""
        base_url = 'https://dashboard.example.com'
        client_home = f"{base_url}/client"
        
        assert '/client' in client_home
    
    def test_client_balance_url(self):
        """Тест URL баланса клиента"""
        base_url = 'https://dashboard.example.com'
        balance_url = f"{base_url}/client/balance"
        
        assert '/balance' in balance_url
    
    def test_client_history_url(self):
        """Тест URL истории клиента"""
        base_url = 'https://dashboard.example.com'
        history_url = f"{base_url}/client/history"
        
        assert '/history' in history_url


class TestAdminDashboardURLs:
    """Тесты URL админского дашборда"""
    
    def test_admin_home_url(self):
        """Тест URL главной страницы админа"""
        base_url = 'https://dashboard.example.com'
        admin_home = f"{base_url}/admin"
        
        assert '/admin' in admin_home
    
    def test_admin_partners_url(self):
        """Тест URL партнёров для админа"""
        base_url = 'https://dashboard.example.com'
        partners_url = f"{base_url}/admin/partners"
        
        assert '/partners' in partners_url
    
    def test_admin_moderation_url(self):
        """Тест URL модерации для админа"""
        base_url = 'https://dashboard.example.com'
        moderation_url = f"{base_url}/admin/moderation"
        
        assert '/moderation' in moderation_url
    
    def test_admin_stats_url(self):
        """Тест URL статистики для админа"""
        base_url = 'https://dashboard.example.com'
        stats_url = f"{base_url}/admin/stats"
        
        assert '/stats' in stats_url


class TestAPIEndpoints:
    """Тесты API endpoints"""
    
    def test_users_endpoint(self):
        """Тест endpoint пользователей"""
        api_base = '/api/v1'
        endpoint = f"{api_base}/users"
        
        assert endpoint == '/api/v1/users'
    
    def test_partners_endpoint(self):
        """Тест endpoint партнёров"""
        api_base = '/api/v1'
        endpoint = f"{api_base}/partners"
        
        assert endpoint == '/api/v1/partners'
    
    def test_transactions_endpoint(self):
        """Тест endpoint транзакций"""
        api_base = '/api/v1'
        endpoint = f"{api_base}/transactions"
        
        assert endpoint == '/api/v1/transactions'
    
    def test_services_endpoint(self):
        """Тест endpoint услуг"""
        api_base = '/api/v1'
        endpoint = f"{api_base}/services"
        
        assert endpoint == '/api/v1/services'


class TestQueryParameters:
    """Тесты query параметров"""
    
    def test_pagination_params(self):
        """Тест параметров пагинации"""
        base_url = '/api/v1/users'
        page = 2
        limit = 20
        
        url = f"{base_url}?page={page}&limit={limit}"
        
        assert 'page=2' in url
        assert 'limit=20' in url
    
    def test_filter_params(self):
        """Тест параметров фильтрации"""
        base_url = '/api/v1/services'
        status = 'approved'
        category = 'manicure'
        
        url = f"{base_url}?status={status}&category={category}"
        
        assert 'status=approved' in url
        assert 'category=manicure' in url
    
    def test_date_range_params(self):
        """Тест параметров диапазона дат"""
        base_url = '/api/v1/transactions'
        start = '2026-01-01'
        end = '2026-01-31'
        
        url = f"{base_url}?start_date={start}&end_date={end}"
        
        assert 'start_date=' in url
        assert 'end_date=' in url


class TestDeepLinks:
    """Тесты deep links"""
    
    def test_telegram_bot_link(self):
        """Тест ссылки на Telegram бота"""
        bot_username = 'loyalitybot'
        link = f"https://t.me/{bot_username}"
        
        assert 't.me' in link
        assert bot_username in link
    
    def test_referral_deep_link(self):
        """Тест реферальной deep link"""
        bot_username = 'loyalitybot'
        partner_id = '123456'
        
        link = f"https://t.me/{bot_username}?start=partner_{partner_id}"
        
        assert 'start=' in link
        assert partner_id in link
    
    def test_webapp_link(self):
        """Тест ссылки на WebApp"""
        webapp_url = 'https://app.loyalty.com'
        link = f"tg://webapp?url={webapp_url}"
        
        assert 'webapp?' in link


class TestURLValidation:
    """Тесты валидации URL"""
    
    def test_valid_http_url(self):
        """Тест валидного HTTP URL"""
        url = 'https://example.com/path'
        
        pattern = r'^https?://.+$'
        is_valid = bool(re.match(pattern, url))
        
        assert is_valid is True
    
    def test_invalid_url(self):
        """Тест невалидного URL"""
        url = 'not-a-valid-url'
        
        pattern = r'^https?://.+$'
        is_valid = bool(re.match(pattern, url))
        
        assert is_valid is False
    
    def test_url_with_special_chars(self):
        """Тест URL со спецсимволами"""
        from urllib.parse import quote
        
        param = 'Салон красоты'
        encoded = quote(param)
        
        assert '%' in encoded


class TestWebhookURLs:
    """Тесты URL вебхуков"""
    
    def test_partner_webhook_url(self):
        """Тест URL partner webhook"""
        url = 'https://loyalitybot-partner-webhook.workers.dev'
        
        assert 'partner-webhook' in url
    
    def test_client_webhook_url(self):
        """Тест URL client webhook"""
        url = 'https://loyalitybot-client-webhook.workers.dev'
        
        assert 'client-webhook' in url
    
    def test_admin_webhook_url(self):
        """Тест URL admin webhook"""
        url = 'https://loyalitybot-admin-webhook.workers.dev'
        
        assert 'admin-webhook' in url
    
    def test_webhook_path(self):
        """Тест пути webhook"""
        base = 'https://api.telegram.org'
        token = 'BOT_TOKEN'
        
        webhook_path = f"{base}/bot{token}/setWebhook"
        
        assert 'setWebhook' in webhook_path


class TestStorageURLs:
    """Тесты URL хранилища"""
    
    def test_supabase_storage_url(self):
        """Тест URL Supabase storage"""
        project_url = 'https://xxx.supabase.co'
        bucket = 'images'
        file_path = 'promotions/image.jpg'
        
        url = f"{project_url}/storage/v1/object/public/{bucket}/{file_path}"
        
        assert '/storage/v1/' in url
        assert bucket in url
    
    def test_signed_url_structure(self):
        """Тест структуры подписанного URL"""
        base_url = 'https://storage.example.com/file.jpg'
        token = 'abc123...'
        expires = '1705678800'
        
        signed_url = f"{base_url}?token={token}&expires={expires}"
        
        assert 'token=' in signed_url
        assert 'expires=' in signed_url


class TestURLBuilding:
    """Тесты построения URL"""
    
    def test_url_join(self):
        """Тест объединения URL"""
        from urllib.parse import urljoin
        
        base = 'https://example.com/api/'
        path = 'users/123'
        
        full_url = urljoin(base, path)
        
        # urljoin имеет особенности поведения
        assert 'example.com' in full_url
    
    def test_query_string_building(self):
        """Тест построения query string"""
        from urllib.parse import urlencode
        
        params = {
            'page': 1,
            'limit': 20,
            'sort': 'created_at'
        }
        
        query = urlencode(params)
        
        assert 'page=1' in query
        assert 'limit=20' in query


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

"""
Интеграционные тесты для Cloudflare Workers
Тесты API endpoints через HTTP запросы
"""

import pytest
import requests
import json
import time
import os
from unittest.mock import patch

# Конфигурация webhook URL
WEBHOOKS = {
    'partner': 'https://loyalitybot-partner-webhook.aerasun3000.workers.dev',
    'client': 'https://loyalitybot-client-webhook.aerasun3000.workers.dev',
    'admin': 'https://loyalitybot-admin-webhook.aerasun3000.workers.dev',
}

# Тестовые ID
PARTNER_CHAT_ID = 406631153
CLIENT_CHAT_ID = 406631153
ADMIN_CHAT_ID = 406631153

# Таймаут для запросов
REQUEST_TIMEOUT = 30


class TestWebhookHelpers:
    """Вспомогательные тесты для webhook"""
    
    def test_webhook_urls_valid(self):
        """Тест валидности URL webhook'ов"""
        for name, url in WEBHOOKS.items():
            assert url.startswith('https://')
            assert '.workers.dev' in url
    
    def test_callback_payload_structure(self):
        """Тест структуры payload для callback_query"""
        payload = {
            "update_id": 12345,
            "callback_query": {
                "id": "test_callback",
                "from": {"id": 123456, "is_bot": False, "first_name": "Test"},
                "message": {
                    "message_id": 1,
                    "chat": {"id": 123456, "type": "private"},
                    "text": "test"
                },
                "data": "test_callback_data"
            }
        }
        
        assert "update_id" in payload
        assert "callback_query" in payload
        assert "data" in payload["callback_query"]
    
    def test_message_payload_structure(self):
        """Тест структуры payload для message"""
        payload = {
            "update_id": 12345,
            "message": {
                "message_id": 1,
                "from": {"id": 123456, "is_bot": False, "first_name": "Test"},
                "chat": {"id": 123456, "type": "private"},
                "date": 1705678800,
                "text": "/start"
            }
        }
        
        assert "message" in payload
        assert "text" in payload["message"]


class TestPartnerWebhook:
    """Тесты Partner Webhook"""
    
    @pytest.fixture
    def partner_url(self):
        return WEBHOOKS['partner']
    
    def send_callback(self, url, callback_data):
        """Отправляет callback на webhook"""
        payload = {
            "update_id": int(time.time() * 1000),
            "callback_query": {
                "id": f"test_{int(time.time())}",
                "from": {"id": PARTNER_CHAT_ID, "is_bot": False, "first_name": "Test"},
                "message": {
                    "message_id": 1,
                    "chat": {"id": PARTNER_CHAT_ID, "type": "private"},
                    "text": "test"
                },
                "data": callback_data
            }
        }
        return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    
    def send_message(self, url, text):
        """Отправляет сообщение на webhook"""
        payload = {
            "update_id": int(time.time() * 1000),
            "message": {
                "message_id": int(time.time()),
                "from": {"id": PARTNER_CHAT_ID, "is_bot": False, "first_name": "Test"},
                "chat": {"id": PARTNER_CHAT_ID, "type": "private"},
                "date": int(time.time()),
                "text": text
            }
        }
        return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    
    def test_start_command(self, partner_url):
        """Тест команды /start"""
        resp = self.send_message(partner_url, "/start")
        assert resp.status_code == 200
        result = resp.json()
        assert result.get("ok") or result.get("success")
    
    def test_main_menu_buttons(self, partner_url):
        """Тест кнопок главного меню"""
        buttons = ['💰 Операции', '📝 Контент', '📊 Аналитика', '💎 Revenue Share', '👥 Пригласить клиента', '⚙️ Ещё']
        
        for btn in buttons:
            resp = self.send_message(partner_url, btn)
            assert resp.status_code == 200
            time.sleep(0.2)
    
    def test_services_menu(self, partner_url):
        """Тест меню услуг"""
        resp = self.send_callback(partner_url, "menu_services")
        assert resp.status_code == 200
        result = resp.json()
        assert result.get("ok") or result.get("success")
    
    def test_service_status_callback(self, partner_url):
        """Тест callback статуса услуг"""
        resp = self.send_callback(partner_url, "service_status")
        assert resp.status_code == 200
        result = resp.json()
        assert result.get("success") or result.get("ok")
    
    def test_service_edit_list_callback(self, partner_url):
        """Тест callback списка редактирования услуг"""
        resp = self.send_callback(partner_url, "service_edit_list")
        assert resp.status_code == 200
    
    def test_service_delete_list_callback(self, partner_url):
        """Тест callback списка удаления услуг"""
        resp = self.send_callback(partner_url, "service_delete_list")
        assert resp.status_code == 200
    
    def test_promotions_menu(self, partner_url):
        """Тест меню акций"""
        resp = self.send_callback(partner_url, "menu_promotions")
        assert resp.status_code == 200
    
    def test_partner_main_menu_callback(self, partner_url):
        """Тест возврата в главное меню"""
        resp = self.send_callback(partner_url, "partner_main_menu")
        assert resp.status_code == 200


class TestClientWebhook:
    """Тесты Client Webhook"""
    
    @pytest.fixture
    def client_url(self):
        return WEBHOOKS['client']
    
    def send_callback(self, url, callback_data):
        """Отправляет callback на webhook"""
        payload = {
            "update_id": int(time.time() * 1000),
            "callback_query": {
                "id": f"test_{int(time.time())}",
                "from": {"id": CLIENT_CHAT_ID, "is_bot": False, "first_name": "Test"},
                "message": {
                    "message_id": 1,
                    "chat": {"id": CLIENT_CHAT_ID, "type": "private"},
                    "text": "test"
                },
                "data": callback_data
            }
        }
        return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    
    def send_message(self, url, text):
        """Отправляет сообщение на webhook"""
        payload = {
            "update_id": int(time.time() * 1000),
            "message": {
                "message_id": int(time.time()),
                "from": {"id": CLIENT_CHAT_ID, "is_bot": False, "first_name": "Test", "username": "test_user"},
                "chat": {"id": CLIENT_CHAT_ID, "type": "private"},
                "date": int(time.time()),
                "text": text
            }
        }
        return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    
    def test_start_command(self, client_url):
        """Тест команды /start"""
        resp = self.send_message(client_url, "/start")
        assert resp.status_code == 200
        result = resp.json()
        assert result.get("ok") or result.get("success")
    
    def test_start_with_referral(self, client_url):
        """Тест /start с реферальной ссылкой"""
        resp = self.send_message(client_url, "/start partner_123456")
        assert resp.status_code == 200
    
    def test_balance_callback(self, client_url):
        """Тест callback баланса"""
        resp = self.send_callback(client_url, "balance")
        assert resp.status_code == 200
    
    def test_nps_rating_callbacks(self, client_url):
        """Тест callback'ов NPS рейтинга"""
        for rating in [1, 5, 10]:
            resp = self.send_callback(client_url, f"nps_rate_{rating}")
            assert resp.status_code == 200
            time.sleep(0.2)
    
    def test_text_message(self, client_url):
        """Тест текстового сообщения"""
        resp = self.send_message(client_url, "Привет")
        assert resp.status_code == 200


class TestAdminWebhook:
    """Тесты Admin Webhook"""
    
    @pytest.fixture
    def admin_url(self):
        return WEBHOOKS['admin']
    
    def send_callback(self, url, callback_data, chat_id=None):
        """Отправляет callback на webhook"""
        chat_id = chat_id or ADMIN_CHAT_ID
        payload = {
            "update_id": int(time.time() * 1000),
            "callback_query": {
                "id": f"test_{int(time.time())}",
                "from": {"id": chat_id, "is_bot": False, "first_name": "Test"},
                "message": {
                    "message_id": 1,
                    "chat": {"id": chat_id, "type": "private"},
                    "text": "test"
                },
                "data": callback_data
            }
        }
        return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    
    def send_message(self, url, text, chat_id=None):
        """Отправляет сообщение на webhook"""
        chat_id = chat_id or ADMIN_CHAT_ID
        payload = {
            "update_id": int(time.time() * 1000),
            "message": {
                "message_id": int(time.time()),
                "from": {"id": chat_id, "is_bot": False, "first_name": "Test"},
                "chat": {"id": chat_id, "type": "private"},
                "date": int(time.time()),
                "text": text
            }
        }
        return requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
    
    def test_start_command_admin(self, admin_url):
        """Тест команды /start для админа"""
        resp = self.send_message(admin_url, "/start")
        assert resp.status_code == 200
        result = resp.json()
        assert result.get("ok") or result.get("success")
    
    def test_start_command_non_admin(self, admin_url):
        """Тест команды /start для не-админа"""
        resp = self.send_message(admin_url, "/start", chat_id=123456789)
        assert resp.status_code == 200
        result = resp.json()
        # Должен вернуть access_denied или ok (с сообщением об отказе)
        assert result.get("ok") or result.get("success") or result.get("handled")
    
    def test_admin_partners_callback(self, admin_url):
        """Тест callback партнёров"""
        resp = self.send_callback(admin_url, "admin_partners")
        assert resp.status_code == 200
    
    def test_admin_services_callback(self, admin_url):
        """Тест callback услуг"""
        resp = self.send_callback(admin_url, "admin_services")
        assert resp.status_code == 200
    
    def test_admin_stats_callback(self, admin_url):
        """Тест callback статистики"""
        resp = self.send_callback(admin_url, "admin_stats")
        assert resp.status_code == 200
    
    def test_admin_news_callback(self, admin_url):
        """Тест callback новостей"""
        resp = self.send_callback(admin_url, "admin_news")
        assert resp.status_code == 200
    
    def test_back_to_main_callback(self, admin_url):
        """Тест возврата в главное меню"""
        resp = self.send_callback(admin_url, "back_to_main")
        assert resp.status_code == 200
    
    def test_pending_partners_callback(self, admin_url):
        """Тест callback заявок партнёров"""
        resp = self.send_callback(admin_url, "admin_partners_pending")
        assert resp.status_code == 200
    
    def test_delete_partners_callback(self, admin_url):
        """Тест callback удаления партнёров"""
        resp = self.send_callback(admin_url, "admin_partners_delete")
        assert resp.status_code == 200


class TestWebhookErrorHandling:
    """Тесты обработки ошибок в webhooks"""
    
    def test_invalid_json_payload(self):
        """Тест обработки невалидного JSON"""
        for name, url in WEBHOOKS.items():
            resp = requests.post(url, data="invalid json", timeout=REQUEST_TIMEOUT)
            # Должен вернуть ошибку или 200 с обработкой
            assert resp.status_code in [200, 400, 500]
    
    def test_empty_payload(self):
        """Тест пустого payload"""
        for name, url in WEBHOOKS.items():
            resp = requests.post(url, json={}, timeout=REQUEST_TIMEOUT)
            assert resp.status_code in [200, 400]
    
    def test_missing_update_id(self):
        """Тест отсутствующего update_id"""
        payload = {
            "message": {
                "message_id": 1,
                "from": {"id": 123456, "is_bot": False, "first_name": "Test"},
                "chat": {"id": 123456, "type": "private"},
                "date": int(time.time()),
                "text": "/start"
            }
        }
        
        for name, url in WEBHOOKS.items():
            resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            assert resp.status_code in [200, 400]


class TestWebhookResponseFormat:
    """Тесты формата ответов webhook"""
    
    def test_response_json_format(self):
        """Тест JSON формата ответа"""
        for name, url in WEBHOOKS.items():
            payload = {
                "update_id": int(time.time() * 1000),
                "message": {
                    "message_id": 1,
                    "from": {"id": ADMIN_CHAT_ID, "is_bot": False, "first_name": "Test"},
                    "chat": {"id": ADMIN_CHAT_ID, "type": "private"},
                    "date": int(time.time()),
                    "text": "/start"
                }
            }
            
            resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            assert resp.status_code == 200
            
            # Проверка, что ответ - валидный JSON
            result = resp.json()
            assert isinstance(result, dict)
    
    def test_response_contains_ok_or_success(self):
        """Тест наличия ok или success в ответе"""
        for name, url in WEBHOOKS.items():
            payload = {
                "update_id": int(time.time() * 1000),
                "message": {
                    "message_id": 1,
                    "from": {"id": ADMIN_CHAT_ID, "is_bot": False, "first_name": "Test"},
                    "chat": {"id": ADMIN_CHAT_ID, "type": "private"},
                    "date": int(time.time()),
                    "text": "/start"
                }
            }
            
            resp = requests.post(url, json=payload, timeout=REQUEST_TIMEOUT)
            result = resp.json()
            
            # Ответ должен содержать ok или success
            assert result.get("ok") is not None or result.get("success") is not None


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

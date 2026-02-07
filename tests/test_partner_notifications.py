"""
Тесты уведомлений партнёрам.
Проверяет, что цепочки отправки уведомлений работают корректно.
"""

import pytest
from unittest.mock import patch, MagicMock
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Мок ai_helper для загрузки secure_api (модуль может отсутствовать)
if "ai_helper" not in sys.modules:
    mock_ai = MagicMock()
    mock_ai.translate_text_ai = lambda *a, **k: ("translated", "en", "ru")
    sys.modules["ai_helper"] = mock_ai


class TestNotifyPartnerInterestAPI:
    """Тесты API /api/notify-partner-interest (клиент просматривает карточку)"""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from secure_api import app
        return TestClient(app)

    def test_missing_partner_chat_id_returns_400(self, client):
        """Без partner_chat_id — 400"""
        resp = client.post(
            "/api/notify-partner-interest",
            json={"partner_chat_id": "", "client_chat_id": "123456"}
        )
        assert resp.status_code == 400

    def test_missing_client_chat_id_returns_400(self, client):
        """Без client_chat_id — 400"""
        resp = client.post(
            "/api/notify-partner-interest",
            json={"partner_chat_id": "789012", "client_chat_id": ""}
        )
        assert resp.status_code == 400

    @patch.dict(os.environ, {"TOKEN_PARTNER": ""}, clear=False)
    def test_no_token_returns_500(self, client):
        """Без TOKEN_PARTNER — 500"""
        resp = client.post(
            "/api/notify-partner-interest",
            json={"partner_chat_id": "789012", "client_chat_id": "123456"}
        )
        assert resp.status_code == 500

    @patch.dict(os.environ, {"TOKEN_PARTNER": "test_token_123"}, clear=False)
    @patch("secure_api.requests.post")
    def test_success_sends_telegram_message(self, mock_post, client):
        """При успехе вызывается Telegram API"""
        mock_post.return_value = MagicMock()
        mock_post.return_value.raise_for_status = MagicMock()

        resp = client.post(
            "/api/notify-partner-interest",
            json={
                "partner_chat_id": "789012",
                "client_chat_id": "123456",
                "client_username": "testuser"
            }
        )

        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        payload = call_kwargs["json"]
        assert payload["chat_id"] == "789012"
        assert "testuser" in payload["text"] or "@testuser" in payload["text"]
        assert "inline_keyboard" in payload["reply_markup"]
        assert "Написать клиенту" in str(payload["reply_markup"])

    @patch.dict(os.environ, {"TOKEN_PARTNER": "test_token"}, clear=False)
    @patch("secure_api.requests.post")
    def test_telegram_403_returns_success_false(self, mock_post, client):
        """Telegram 403 (партнёр заблокировал бота) — success: false"""
        mock_post.side_effect = __import__("requests").exceptions.HTTPError(
            response=MagicMock(status_code=403)
        )

        resp = client.post(
            "/api/notify-partner-interest",
            json={"partner_chat_id": "789012", "client_chat_id": "123456"}
        )

        # endpoint возвращает 200 с success: false при ошибке Telegram
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is False
        assert "error" in data


class TestAdminBotPartnerNotifications:
    """Тесты логики уведомлений в admin_bot"""

    def test_send_partner_notification_no_token_returns_early(self):
        """Без TOKEN_PARTNER send_partner_notification не падает"""
        with patch.dict(os.environ, {"TOKEN_PARTNER": ""}, clear=False):
            from admin_bot import send_partner_notification
            # Не должно выбросить исключение
            send_partner_notification("123456", "Test message")

    @patch("admin_bot.TOKEN_PARTNER", "test_token")
    @patch("admin_bot.requests.post")
    def test_send_partner_notification_calls_telegram(self, mock_post):
        """send_partner_notification вызывает Telegram API"""
        import admin_bot
        mock_post.return_value = MagicMock()

        admin_bot.send_partner_notification("123456", "🎉 Ваш аккаунт одобрен!")

        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert "sendMessage" in call_args[0][0]
        assert call_args[1]["data"]["chat_id"] == "123456"
        assert "одобрен" in call_args[1]["data"]["text"]


class TestPartnerNotificationCodePaths:
    """Проверка наличия кода для каждого типа уведомления"""

    def test_notify_partner_interest_endpoint_exists(self):
        """Endpoint notify-partner-interest зарегистрирован"""
        from secure_api import app
        paths = []
        for r in app.routes:
            if hasattr(r, "path"):
                paths.append(r.path)
            if hasattr(r, "routes"):
                for sr in r.routes:
                    if hasattr(sr, "path"):
                        paths.append(getattr(sr, "path", ""))
        all_paths = " ".join(paths)
        assert "notify-partner-interest" in all_paths

    def test_admin_bot_has_partner_approval_notification(self):
        """admin_bot вызывает send_partner_notification при approve/reject заявки партнёра"""
        admin_bot_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "admin_bot.py"
        )
        with open(admin_bot_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "send_partner_notification" in content
        assert "partner_approve_" in content or "partner_reject_" in content

    def test_admin_bot_service_approval_notifies_partner(self):
        """admin_bot уведомляет партнёра при одобрении/отклонении услуги"""
        admin_bot_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "admin_bot.py"
        )
        with open(admin_bot_path, "r", encoding="utf-8") as f:
            content = f.read()
        idx = content.find("async def handle_service_approval")
        end = content.find("class ServiceManage", idx)
        service_approval_body = content[idx:end] if end > 0 else content[idx:idx + 2000]
        assert "send_partner_notification" in service_approval_body

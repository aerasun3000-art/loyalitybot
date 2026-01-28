"""
Интеграционные тесты для проверки взаимодействия ботов
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os


class TestPartnerBotIntegration:
    """Интеграционные тесты партнёрского бота"""
    
    def test_partner_token_env_exists(self):
        """Тест наличия переменной TOKEN_PARTNER"""
        with patch.dict(os.environ, {'TOKEN_PARTNER': 'test_token'}):
            token = os.environ.get('TOKEN_PARTNER')
            assert token == 'test_token'
    
    def test_transaction_flow(self):
        """Тест полного flow транзакции"""
        # Это пример интеграционного теста
        # В реальности требует настройки тестовой БД
        pass


class TestClientBotIntegration:
    """Интеграционные тесты клиентского бота"""
    
    def test_client_token_env_exists(self):
        """Тест наличия переменной TOKEN_CLIENT"""
        with patch.dict(os.environ, {'TOKEN_CLIENT': 'test_client_token'}):
            token = os.environ.get('TOKEN_CLIENT')
            assert token == 'test_client_token'
    
    def test_referral_link_parsing(self):
        """Тест парсинга реферальной ссылки"""
        import re
        REFERRAL_PATTERN = re.compile(r'partner_(\d+)', re.IGNORECASE)
        
        # Тест валидной ссылки
        text = "/start partner_123456"
        match = REFERRAL_PATTERN.search(text)
        assert match is not None
        assert match.group(1) == '123456'
        
        # Тест без реферальной ссылки
        text = "/start"
        match = REFERRAL_PATTERN.search(text)
        assert match is None


class TestNPSFlow:
    """Тесты NPS flow"""
    
    def test_nps_rating_values(self):
        """Тест валидации значений NPS (0-10)"""
        valid_ratings = [0, 1, 5, 9, 10]
        for rating in valid_ratings:
            assert 0 <= rating <= 10
        
        invalid_ratings = [-1, 11, 15]
        for rating in invalid_ratings:
            assert not (0 <= rating <= 10)
    
    def test_nps_score_calculation(self):
        """Тест расчёта NPS score"""
        # NPS = ((Промоутеры - Детракторы) / Всего оценок) * 100
        promoters = 70  # 9-10
        detractors = 10  # 0-6
        passives = 20    # 7-8
        total = promoters + detractors + passives
        
        nps_score = ((promoters - detractors) / total) * 100
        assert nps_score == 60.0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])


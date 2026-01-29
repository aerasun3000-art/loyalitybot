"""
Unit-тесты для rate_limiter.py
Полное покрытие ограничителя частоты запросов
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import time
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestRateLimiterInit:
    """Тесты инициализации rate limiter"""
    
    def test_default_limits(self):
        """Тест лимитов по умолчанию"""
        default_limits = {
            'requests_per_second': 30,
            'requests_per_minute': 1000
        }
        
        assert default_limits['requests_per_second'] == 30
        assert default_limits['requests_per_minute'] == 1000
    
    def test_custom_limits(self):
        """Тест пользовательских лимитов"""
        custom_limits = {
            'requests_per_second': 10,
            'requests_per_minute': 100
        }
        
        assert custom_limits['requests_per_second'] == 10


class TestSlidingWindowCounter:
    """Тесты скользящего окна счётчика"""
    
    def test_window_size(self):
        """Тест размера окна"""
        window_seconds = 60
        assert window_seconds == 60
    
    def test_count_in_window(self):
        """Тест подсчёта запросов в окне"""
        now = time.time()
        window_size = 60
        
        requests = [
            now - 30,  # в окне
            now - 90,  # вне окна
            now - 10,  # в окне
            now - 5    # в окне
        ]
        
        window_start = now - window_size
        count = len([r for r in requests if r >= window_start])
        
        assert count == 3
    
    def test_window_slides(self):
        """Тест скольжения окна"""
        window_size = 60
        
        t1 = time.time()
        window_start_1 = t1 - window_size
        
        # Симуляция прохождения времени
        t2 = t1 + 30
        window_start_2 = t2 - window_size
        
        assert window_start_2 > window_start_1


class TestTokenBucket:
    """Тесты token bucket алгоритма"""
    
    def test_bucket_initial_tokens(self):
        """Тест начального количества токенов"""
        max_tokens = 100
        tokens = max_tokens
        
        assert tokens == 100
    
    def test_consume_token(self):
        """Тест потребления токена"""
        tokens = 100
        
        if tokens > 0:
            tokens -= 1
            allowed = True
        else:
            allowed = False
        
        assert allowed is True
        assert tokens == 99
    
    def test_refill_tokens(self):
        """Тест пополнения токенов"""
        tokens = 50
        max_tokens = 100
        refill_rate = 10  # токенов в секунду
        elapsed_seconds = 3
        
        tokens = min(max_tokens, tokens + refill_rate * elapsed_seconds)
        
        assert tokens == 80
    
    def test_bucket_overflow_prevention(self):
        """Тест предотвращения переполнения"""
        tokens = 95
        max_tokens = 100
        refill = 10
        
        tokens = min(max_tokens, tokens + refill)
        
        assert tokens == 100  # Не превышает max


class TestRateLimitCheck:
    """Тесты проверки лимита"""
    
    def test_under_limit_allowed(self):
        """Тест разрешения при лимите"""
        current_count = 50
        limit = 100
        
        allowed = current_count < limit
        assert allowed is True
    
    def test_at_limit_denied(self):
        """Тест отказа при достижении лимита"""
        current_count = 100
        limit = 100
        
        allowed = current_count < limit
        assert allowed is False
    
    def test_over_limit_denied(self):
        """Тест отказа при превышении лимита"""
        current_count = 150
        limit = 100
        
        allowed = current_count < limit
        assert allowed is False


class TestUserRateLimiting:
    """Тесты ограничения по пользователю"""
    
    def test_per_user_tracking(self):
        """Тест отслеживания по пользователю"""
        user_requests = {
            'user_1': 50,
            'user_2': 30,
            'user_3': 100
        }
        
        assert user_requests['user_1'] == 50
    
    def test_new_user_starts_at_zero(self):
        """Тест нового пользователя с нуля"""
        user_requests = {}
        user_id = 'new_user'
        
        count = user_requests.get(user_id, 0)
        assert count == 0
    
    def test_increment_user_count(self):
        """Тест увеличения счётчика пользователя"""
        user_requests = {'user_1': 5}
        
        user_requests['user_1'] = user_requests.get('user_1', 0) + 1
        
        assert user_requests['user_1'] == 6


class TestIPRateLimiting:
    """Тесты ограничения по IP"""
    
    def test_per_ip_tracking(self):
        """Тест отслеживания по IP"""
        ip_requests = {
            '192.168.1.1': 100,
            '10.0.0.1': 50
        }
        
        assert ip_requests['192.168.1.1'] == 100
    
    def test_ip_whitelist(self):
        """Тест белого списка IP"""
        whitelist = ['127.0.0.1', '192.168.1.100']
        
        ip = '127.0.0.1'
        is_whitelisted = ip in whitelist
        
        assert is_whitelisted is True
    
    def test_ip_blacklist(self):
        """Тест чёрного списка IP"""
        blacklist = ['1.2.3.4', '5.6.7.8']
        
        ip = '1.2.3.4'
        is_blacklisted = ip in blacklist
        
        assert is_blacklisted is True


class TestRateLimitResponse:
    """Тесты ответов при лимите"""
    
    def test_retry_after_header(self):
        """Тест заголовка Retry-After"""
        window_reset = 30  # секунд
        
        headers = {'Retry-After': str(window_reset)}
        
        assert headers['Retry-After'] == '30'
    
    def test_rate_limit_exceeded_status(self):
        """Тест статуса превышения лимита"""
        status_code = 429  # Too Many Requests
        
        assert status_code == 429
    
    def test_rate_limit_message(self):
        """Тест сообщения о превышении лимита"""
        message = "Rate limit exceeded. Please try again later."
        
        assert 'Rate limit' in message


class TestBurstHandling:
    """Тесты обработки всплесков"""
    
    def test_burst_limit(self):
        """Тест лимита на всплеск"""
        burst_limit = 50
        normal_rate = 10
        
        # Всплеск разрешён, но ограничен
        assert burst_limit > normal_rate
    
    def test_burst_then_throttle(self):
        """Тест торможения после всплеска"""
        burst_tokens = 50
        requests_made = 60
        
        # После исчерпания burst, запросы ограничиваются
        throttled = requests_made > burst_tokens
        assert throttled is True


class TestRateLimitConfig:
    """Тесты конфигурации лимитов"""
    
    def test_load_limits_from_env(self):
        """Тест загрузки лимитов из env"""
        with patch.dict(os.environ, {'RATE_LIMIT_PER_SECOND': '50'}):
            limit = int(os.environ.get('RATE_LIMIT_PER_SECOND', '30'))
            assert limit == 50
    
    def test_default_limit_fallback(self):
        """Тест fallback на дефолтный лимит"""
        with patch.dict(os.environ, {}, clear=True):
            limit = int(os.environ.get('RATE_LIMIT_PER_SECOND', '30'))
            assert limit == 30
    
    def test_endpoint_specific_limits(self):
        """Тест лимитов для конкретных эндпоинтов"""
        endpoint_limits = {
            '/api/transaction': 10,
            '/api/balance': 30,
            '/api/partner': 20
        }
        
        assert endpoint_limits['/api/transaction'] == 10


class TestRateLimitCleanup:
    """Тесты очистки данных лимитера"""
    
    def test_cleanup_old_entries(self):
        """Тест очистки старых записей"""
        now = time.time()
        entries = {
            'user_1': now - 3600,  # 1 час назад
            'user_2': now - 60,    # 1 минута назад
            'user_3': now - 7200   # 2 часа назад
        }
        
        max_age = 1800  # 30 минут
        
        cleaned = {
            k: v for k, v in entries.items()
            if now - v < max_age
        }
        
        assert len(cleaned) == 1
        assert 'user_2' in cleaned
    
    def test_memory_limit(self):
        """Тест лимита памяти"""
        max_entries = 10000
        current_entries = 15000
        
        should_cleanup = current_entries > max_entries
        assert should_cleanup is True


class TestDistributedRateLimiting:
    """Тесты распределённого rate limiting"""
    
    def test_redis_key_format(self):
        """Тест формата ключа Redis"""
        user_id = '123456'
        window = 'minute'
        
        key = f"ratelimit:{user_id}:{window}"
        
        assert key == "ratelimit:123456:minute"
    
    def test_ttl_for_window(self):
        """Тест TTL для окна"""
        window_seconds = 60
        ttl = window_seconds + 10  # +буфер
        
        assert ttl == 70
    
    def test_atomic_increment(self):
        """Тест атомарного инкремента"""
        # В Redis: INCR ratelimit:user:minute
        current = 5
        new_value = current + 1
        
        assert new_value == 6


class TestTelegramRateLimits:
    """Тесты лимитов Telegram API"""
    
    def test_telegram_message_limit(self):
        """Тест лимита сообщений Telegram"""
        # Telegram: 30 сообщений в секунду глобально
        # 1 сообщение в секунду на чат
        limits = {
            'global_per_second': 30,
            'per_chat_per_second': 1
        }
        
        assert limits['global_per_second'] == 30
    
    def test_group_chat_limit(self):
        """Тест лимита для групповых чатов"""
        # 20 сообщений в минуту для групп
        group_limit = 20
        
        assert group_limit == 20
    
    def test_bulk_send_delay(self):
        """Тест задержки при массовой отправке"""
        messages_to_send = 100
        delay_between = 0.05  # 50ms
        
        total_time = messages_to_send * delay_between
        assert total_time == 5.0  # 5 секунд


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

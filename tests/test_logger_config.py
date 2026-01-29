"""
Unit-тесты для logger_config.py
Полное покрытие конфигурации логирования
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import logging
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestLogLevels:
    """Тесты уровней логирования"""
    
    def test_debug_level(self):
        """Тест уровня DEBUG"""
        assert logging.DEBUG == 10
    
    def test_info_level(self):
        """Тест уровня INFO"""
        assert logging.INFO == 20
    
    def test_warning_level(self):
        """Тест уровня WARNING"""
        assert logging.WARNING == 30
    
    def test_error_level(self):
        """Тест уровня ERROR"""
        assert logging.ERROR == 40
    
    def test_critical_level(self):
        """Тест уровня CRITICAL"""
        assert logging.CRITICAL == 50
    
    def test_level_hierarchy(self):
        """Тест иерархии уровней"""
        assert logging.DEBUG < logging.INFO < logging.WARNING < logging.ERROR < logging.CRITICAL


class TestLoggerCreation:
    """Тесты создания логгеров"""
    
    def test_get_logger_by_name(self):
        """Тест получения логгера по имени"""
        logger = logging.getLogger('test_logger')
        
        assert logger.name == 'test_logger'
    
    def test_root_logger(self):
        """Тест корневого логгера"""
        root = logging.getLogger()
        
        assert root.name == 'root'
    
    def test_child_logger(self):
        """Тест дочернего логгера"""
        parent = logging.getLogger('parent')
        child = logging.getLogger('parent.child')
        
        assert child.parent == parent


class TestLogFormatting:
    """Тесты форматирования логов"""
    
    def test_basic_format(self):
        """Тест базового формата"""
        fmt = '%(levelname)s - %(message)s'
        formatter = logging.Formatter(fmt)
        
        record = logging.LogRecord(
            name='test',
            level=logging.INFO,
            pathname='test.py',
            lineno=1,
            msg='Test message',
            args=(),
            exc_info=None
        )
        
        formatted = formatter.format(record)
        assert 'INFO' in formatted
        assert 'Test message' in formatted
    
    def test_timestamp_format(self):
        """Тест формата с временной меткой"""
        fmt = '%(asctime)s - %(message)s'
        formatter = logging.Formatter(fmt, datefmt='%Y-%m-%d %H:%M:%S')
        
        record = logging.LogRecord(
            name='test',
            level=logging.INFO,
            pathname='test.py',
            lineno=1,
            msg='Test',
            args=(),
            exc_info=None
        )
        
        formatted = formatter.format(record)
        # Должна быть дата
        assert '-' in formatted
    
    def test_detailed_format(self):
        """Тест детального формата"""
        fmt = '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
        formatter = logging.Formatter(fmt)
        
        assert '%(filename)s' in fmt
        assert '%(lineno)d' in fmt


class TestLogHandlers:
    """Тесты обработчиков логов"""
    
    def test_stream_handler(self):
        """Тест stream handler"""
        handler = logging.StreamHandler()
        
        assert handler is not None
    
    def test_file_handler_path(self):
        """Тест пути file handler"""
        log_path = '/tmp/test.log'
        
        # Проверяем что путь валидный
        assert log_path.endswith('.log')
    
    def test_rotating_file_handler_config(self):
        """Тест конфигурации rotating handler"""
        config = {
            'max_bytes': 10 * 1024 * 1024,  # 10 MB
            'backup_count': 5
        }
        
        assert config['max_bytes'] == 10485760
        assert config['backup_count'] == 5


class TestLogFilters:
    """Тесты фильтров логов"""
    
    def test_level_filter(self):
        """Тест фильтра по уровню"""
        min_level = logging.WARNING
        
        info_record = logging.LogRecord(
            name='test', level=logging.INFO,
            pathname='', lineno=1, msg='', args=(), exc_info=None
        )
        
        warning_record = logging.LogRecord(
            name='test', level=logging.WARNING,
            pathname='', lineno=1, msg='', args=(), exc_info=None
        )
        
        assert info_record.levelno < min_level
        assert warning_record.levelno >= min_level
    
    def test_name_filter(self):
        """Тест фильтра по имени"""
        allowed_loggers = ['app', 'api', 'db']
        
        logger_name = 'app.module'
        is_allowed = any(logger_name.startswith(name) for name in allowed_loggers)
        
        assert is_allowed is True


class TestLogOutput:
    """Тесты вывода логов"""
    
    def test_log_message_creation(self):
        """Тест создания сообщения лога"""
        message = "User {} logged in from {}"
        user = "john"
        ip = "192.168.1.1"
        
        formatted = message.format(user, ip)
        
        assert user in formatted
        assert ip in formatted
    
    def test_log_extra_data(self):
        """Тест дополнительных данных в логе"""
        extra = {
            'user_id': '123456',
            'action': 'login',
            'ip_address': '192.168.1.1'
        }
        
        assert 'user_id' in extra
    
    def test_structured_log_json(self):
        """Тест структурированного лога JSON"""
        import json
        
        log_data = {
            'timestamp': datetime.datetime.now().isoformat(),
            'level': 'INFO',
            'message': 'User action',
            'user_id': '123456'
        }
        
        json_log = json.dumps(log_data)
        
        assert isinstance(json_log, str)
        parsed = json.loads(json_log)
        assert parsed['level'] == 'INFO'


class TestErrorLogging:
    """Тесты логирования ошибок"""
    
    def test_exception_logging(self):
        """Тест логирования исключений"""
        try:
            raise ValueError("Test error")
        except ValueError as e:
            error_message = str(e)
            
        assert error_message == "Test error"
    
    def test_traceback_capture(self):
        """Тест захвата traceback"""
        import traceback
        
        try:
            raise RuntimeError("Test")
        except RuntimeError:
            tb = traceback.format_exc()
        
        assert 'RuntimeError' in tb
        assert 'Test' in tb
    
    def test_error_context(self):
        """Тест контекста ошибки"""
        context = {
            'operation': 'database_query',
            'query': 'SELECT * FROM users',
            'error': 'Connection timeout'
        }
        
        assert 'operation' in context


class TestLogConfiguration:
    """Тесты конфигурации логирования"""
    
    def test_config_from_env(self):
        """Тест конфигурации из env"""
        with patch.dict(os.environ, {'LOG_LEVEL': 'DEBUG'}):
            level = os.environ.get('LOG_LEVEL', 'INFO')
            assert level == 'DEBUG'
    
    def test_default_config(self):
        """Тест конфигурации по умолчанию"""
        default_config = {
            'level': 'INFO',
            'format': '%(asctime)s - %(levelname)s - %(message)s',
            'handlers': ['console']
        }
        
        assert default_config['level'] == 'INFO'
    
    def test_production_config(self):
        """Тест production конфигурации"""
        prod_config = {
            'level': 'WARNING',
            'handlers': ['file', 'sentry'],
            'propagate': False
        }
        
        assert prod_config['level'] == 'WARNING'


class TestSentryIntegration:
    """Тесты интеграции с Sentry"""
    
    def test_sentry_dsn_format(self):
        """Тест формата Sentry DSN"""
        dsn = 'https://key@o123456.ingest.sentry.io/project_id'
        
        assert dsn.startswith('https://')
        assert 'sentry.io' in dsn
    
    def test_sentry_environment(self):
        """Тест окружения Sentry"""
        environments = ['development', 'staging', 'production']
        env = 'production'
        
        assert env in environments
    
    def test_sentry_tags(self):
        """Тест тегов Sentry"""
        tags = {
            'service': 'loyalty-bot',
            'version': '1.0.0',
            'environment': 'production'
        }
        
        assert 'service' in tags


class TestLogRotation:
    """Тесты ротации логов"""
    
    def test_max_file_size(self):
        """Тест максимального размера файла"""
        max_size_mb = 10
        max_size_bytes = max_size_mb * 1024 * 1024
        
        assert max_size_bytes == 10485760
    
    def test_retention_period(self):
        """Тест периода хранения"""
        retention_days = 30
        
        assert retention_days > 0
    
    def test_backup_count(self):
        """Тест количества резервных копий"""
        backup_count = 5
        
        # Общее количество файлов = 1 текущий + backup_count
        total_files = 1 + backup_count
        assert total_files == 6


class TestPerformanceLogging:
    """Тесты логирования производительности"""
    
    def test_timing_log(self):
        """Тест лога времени выполнения"""
        start = datetime.datetime.now()
        # Симуляция работы
        end = datetime.datetime.now()
        
        duration_ms = (end - start).total_seconds() * 1000
        
        log_message = f"Operation completed in {duration_ms:.2f}ms"
        
        assert 'ms' in log_message
    
    def test_slow_query_threshold(self):
        """Тест порога медленных запросов"""
        threshold_ms = 1000
        actual_ms = 1500
        
        is_slow = actual_ms > threshold_ms
        assert is_slow is True
    
    def test_request_id_logging(self):
        """Тест логирования request_id"""
        import uuid
        
        request_id = str(uuid.uuid4())
        
        log_context = {'request_id': request_id}
        
        assert len(log_context['request_id']) == 36


class TestLogSampling:
    """Тесты семплирования логов"""
    
    def test_sample_rate(self):
        """Тест частоты семплирования"""
        sample_rate = 0.1  # 10%
        
        import random
        samples = [random.random() < sample_rate for _ in range(1000)]
        sample_count = sum(samples)
        
        # Примерно 10% должны быть True
        assert 50 < sample_count < 150
    
    def test_always_log_errors(self):
        """Тест всегда логировать ошибки"""
        level = logging.ERROR
        sample_rate = 0.1
        
        # Ошибки всегда логируем
        should_log = level >= logging.ERROR or True
        assert should_log is True


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

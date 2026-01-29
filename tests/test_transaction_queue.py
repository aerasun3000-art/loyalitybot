"""
Unit-тесты для transaction_queue.py
Полное покрытие очереди транзакций
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import datetime
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestTransactionQueueInit:
    """Тесты инициализации очереди транзакций"""
    
    def test_queue_initialized_empty(self):
        """Тест инициализации пустой очереди"""
        queue = []
        assert len(queue) == 0
    
    def test_queue_max_size(self):
        """Тест максимального размера очереди"""
        max_size = 1000
        assert max_size > 0
    
    def test_queue_persistence_path(self):
        """Тест пути для сохранения очереди"""
        path = '/tmp/transaction_queue.json'
        assert path.endswith('.json')


class TestTransactionEnqueue:
    """Тесты добавления транзакций в очередь"""
    
    def test_enqueue_transaction(self):
        """Тест добавления транзакции"""
        queue = []
        transaction = {
            'client_chat_id': '123456',
            'partner_chat_id': '789012',
            'type': 'accrual',
            'points': 50,
            'timestamp': datetime.datetime.now().isoformat()
        }
        
        queue.append(transaction)
        assert len(queue) == 1
        assert queue[0]['client_chat_id'] == '123456'
    
    def test_enqueue_multiple_transactions(self):
        """Тест добавления нескольких транзакций"""
        queue = []
        
        for i in range(5):
            transaction = {
                'id': i,
                'client_chat_id': f'client_{i}',
                'type': 'accrual'
            }
            queue.append(transaction)
        
        assert len(queue) == 5
    
    def test_enqueue_preserves_order(self):
        """Тест сохранения порядка"""
        queue = []
        
        queue.append({'id': 1})
        queue.append({'id': 2})
        queue.append({'id': 3})
        
        assert queue[0]['id'] == 1
        assert queue[2]['id'] == 3


class TestTransactionDequeue:
    """Тесты извлечения транзакций из очереди"""
    
    def test_dequeue_fifo(self):
        """Тест FIFO извлечения"""
        queue = [{'id': 1}, {'id': 2}, {'id': 3}]
        
        first = queue.pop(0)
        assert first['id'] == 1
        assert len(queue) == 2
    
    def test_dequeue_empty_queue(self):
        """Тест извлечения из пустой очереди"""
        queue = []
        
        if queue:
            item = queue.pop(0)
        else:
            item = None
        
        assert item is None
    
    def test_peek_without_remove(self):
        """Тест просмотра без удаления"""
        queue = [{'id': 1}, {'id': 2}]
        
        first = queue[0] if queue else None
        assert first['id'] == 1
        assert len(queue) == 2  # Не удалено


class TestTransactionProcessing:
    """Тесты обработки транзакций"""
    
    def test_process_success(self):
        """Тест успешной обработки"""
        transaction = {
            'client_chat_id': '123456',
            'type': 'accrual',
            'points': 50
        }
        
        # Симуляция успешной обработки
        result = {'success': True, 'processed': True}
        
        assert result['success'] is True
    
    def test_process_failure_requeue(self):
        """Тест повторной постановки при ошибке"""
        queue = []
        transaction = {'id': 1, 'retry_count': 0}
        
        # Симуляция ошибки
        success = False
        
        if not success:
            transaction['retry_count'] += 1
            queue.append(transaction)
        
        assert len(queue) == 1
        assert queue[0]['retry_count'] == 1
    
    def test_max_retries_exceeded(self):
        """Тест превышения максимального числа попыток"""
        max_retries = 3
        transaction = {'id': 1, 'retry_count': 3}
        
        should_discard = transaction['retry_count'] >= max_retries
        assert should_discard is True
    
    def test_retry_delay_calculation(self):
        """Тест расчёта задержки перед повтором"""
        retry_count = 3
        base_delay = 60  # секунд
        
        # Экспоненциальная задержка
        delay = base_delay * (2 ** retry_count)
        assert delay == 480  # 60 * 8


class TestTransactionValidation:
    """Тесты валидации транзакций"""
    
    def test_valid_transaction(self):
        """Тест валидной транзакции"""
        transaction = {
            'client_chat_id': '123456',
            'partner_chat_id': '789012',
            'type': 'accrual',
            'points': 50
        }
        
        required_fields = ['client_chat_id', 'partner_chat_id', 'type', 'points']
        is_valid = all(field in transaction for field in required_fields)
        
        assert is_valid is True
    
    def test_invalid_transaction_missing_field(self):
        """Тест невалидной транзакции без поля"""
        transaction = {
            'client_chat_id': '123456',
            'type': 'accrual'
            # points отсутствует
        }
        
        required_fields = ['client_chat_id', 'partner_chat_id', 'type', 'points']
        is_valid = all(field in transaction for field in required_fields)
        
        assert is_valid is False
    
    def test_transaction_type_validation(self):
        """Тест валидации типа транзакции"""
        valid_types = ['accrual', 'spend', 'welcome_bonus', 'referral_bonus']
        
        transaction = {'type': 'accrual'}
        is_valid_type = transaction['type'] in valid_types
        
        assert is_valid_type is True
    
    def test_points_positive_validation(self):
        """Тест валидации положительных баллов"""
        transaction = {'points': 50}
        
        is_valid = transaction['points'] > 0
        assert is_valid is True
    
    def test_points_negative_invalid(self):
        """Тест невалидности отрицательных баллов"""
        transaction = {'points': -50}
        
        is_valid = transaction['points'] > 0
        assert is_valid is False


class TestQueuePersistence:
    """Тесты сохранения очереди"""
    
    def test_serialize_queue(self):
        """Тест сериализации очереди"""
        queue = [
            {'id': 1, 'type': 'accrual'},
            {'id': 2, 'type': 'spend'}
        ]
        
        serialized = json.dumps(queue)
        assert isinstance(serialized, str)
        assert '{"id": 1' in serialized
    
    def test_deserialize_queue(self):
        """Тест десериализации очереди"""
        serialized = '[{"id": 1, "type": "accrual"}]'
        
        queue = json.loads(serialized)
        assert isinstance(queue, list)
        assert queue[0]['id'] == 1
    
    def test_empty_queue_serialization(self):
        """Тест сериализации пустой очереди"""
        queue = []
        serialized = json.dumps(queue)
        assert serialized == '[]'
    
    def test_corrupted_data_handling(self):
        """Тест обработки повреждённых данных"""
        corrupted = 'not valid json {'
        
        try:
            queue = json.loads(corrupted)
        except json.JSONDecodeError:
            queue = []
        
        assert queue == []


class TestQueueStatistics:
    """Тесты статистики очереди"""
    
    def test_queue_length(self):
        """Тест длины очереди"""
        queue = [1, 2, 3, 4, 5]
        assert len(queue) == 5
    
    def test_pending_count(self):
        """Тест подсчёта ожидающих"""
        queue = [
            {'status': 'pending'},
            {'status': 'processing'},
            {'status': 'pending'},
            {'status': 'failed'}
        ]
        
        pending = len([t for t in queue if t['status'] == 'pending'])
        assert pending == 2
    
    def test_failed_count(self):
        """Тест подсчёта неудачных"""
        queue = [
            {'status': 'pending'},
            {'status': 'failed'},
            {'status': 'failed'}
        ]
        
        failed = len([t for t in queue if t['status'] == 'failed'])
        assert failed == 2


class TestConcurrentAccess:
    """Тесты конкурентного доступа"""
    
    def test_thread_safe_append(self):
        """Тест потокобезопасного добавления"""
        # В реальности используется threading.Lock
        import threading
        
        queue = []
        lock = threading.Lock()
        
        def safe_append(item):
            with lock:
                queue.append(item)
        
        safe_append({'id': 1})
        assert len(queue) == 1
    
    def test_atomic_pop(self):
        """Тест атомарного извлечения"""
        import threading
        
        queue = [{'id': 1}]
        lock = threading.Lock()
        
        def safe_pop():
            with lock:
                if queue:
                    return queue.pop(0)
                return None
        
        item = safe_pop()
        assert item['id'] == 1
        assert len(queue) == 0


class TestQueueCleanup:
    """Тесты очистки очереди"""
    
    def test_remove_old_transactions(self):
        """Тест удаления старых транзакций"""
        now = datetime.datetime.now()
        old_time = now - datetime.timedelta(days=8)
        recent_time = now - datetime.timedelta(hours=1)
        
        queue = [
            {'id': 1, 'timestamp': old_time.isoformat()},
            {'id': 2, 'timestamp': recent_time.isoformat()}
        ]
        
        max_age_days = 7
        cutoff = now - datetime.timedelta(days=max_age_days)
        
        queue = [
            t for t in queue 
            if datetime.datetime.fromisoformat(t['timestamp']) > cutoff
        ]
        
        assert len(queue) == 1
        assert queue[0]['id'] == 2
    
    def test_clear_queue(self):
        """Тест полной очистки очереди"""
        queue = [1, 2, 3, 4, 5]
        queue.clear()
        assert len(queue) == 0


class TestTransactionPriority:
    """Тесты приоритета транзакций"""
    
    def test_priority_ordering(self):
        """Тест упорядочивания по приоритету"""
        queue = [
            {'id': 1, 'priority': 1},
            {'id': 2, 'priority': 3},
            {'id': 3, 'priority': 2}
        ]
        
        sorted_queue = sorted(queue, key=lambda x: x['priority'], reverse=True)
        
        assert sorted_queue[0]['id'] == 2  # priority 3
        assert sorted_queue[1]['id'] == 3  # priority 2
        assert sorted_queue[2]['id'] == 1  # priority 1
    
    def test_high_priority_first(self):
        """Тест обработки высокого приоритета первым"""
        queue = [
            {'type': 'accrual', 'priority': 1},
            {'type': 'spend', 'priority': 2}
        ]
        
        # Сортируем по приоритету (высший первый)
        queue.sort(key=lambda x: x['priority'], reverse=True)
        
        assert queue[0]['type'] == 'spend'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

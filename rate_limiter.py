"""
Rate Limiter для защиты от спама и злоупотреблений
Использует in-memory хранилище (можно заменить на Redis для production)
"""

import time
import logging
from collections import defaultdict, deque
from threading import Lock
from typing import Optional, Dict, Tuple

logger = logging.getLogger(__name__)


class RateLimiter:
    """
    Простой rate limiter с скользящим окном.
    Отслеживает количество запросов за определенный период времени.
    """
    
    def __init__(self):
        # Хранилище: {user_id: {action: deque([timestamp1, timestamp2, ...])}}
        self.requests: Dict[str, Dict[str, deque]] = defaultdict(lambda: defaultdict(deque))
        
        # Хранилище для cooldown: {user_id: {action: last_timestamp}}
        self.cooldowns: Dict[str, Dict[str, float]] = defaultdict(dict)
        
        # Blacklist заблокированных пользователей
        self.blacklist: Dict[str, Tuple[float, str]] = {}  # {user_id: (until_timestamp, reason)}
        
        # Lock для thread-safety
        self.lock = Lock()
        
        # Настройки лимитов по умолчанию
        self.default_limits = {
            # action: (max_requests, window_seconds)
            'message': (10, 60),           # 10 сообщений в минуту
            'command': (5, 60),             # 5 команд в минуту
            'transaction': (3, 300),        # 3 транзакции в 5 минут
            'export_data': (1, 3600),       # 1 экспорт в час
            'delete_account': (1, 86400),   # 1 удаление в день
            'create_service': (5, 3600),    # 5 услуг в час
            'create_promotion': (5, 3600),  # 5 акций в час
            'upload_image': (10, 3600),     # 10 изображений в час
        }
        
        # Настройки cooldown по умолчанию (секунды)
        self.default_cooldowns = {
            'transaction': 5,        # 5 секунд между транзакциями
            'message': 1,            # 1 секунда между сообщениями
            'command': 2,            # 2 секунды между командами
            'create_service': 10,    # 10 секунд между созданием услуг
        }
        
        logger.info("RateLimiter initialized")
    
    def check_rate_limit(self, user_id: str, action: str, 
                         max_requests: Optional[int] = None, 
                         window_seconds: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Проверяет, не превышен ли лимит запросов для пользователя.
        
        Args:
            user_id: ID пользователя
            action: Тип действия (message, command, transaction, etc.)
            max_requests: Максимальное количество запросов (если None, использует default)
            window_seconds: Размер временного окна в секундах (если None, использует default)
        
        Returns:
            Tuple[bool, Optional[str]]: (allowed, error_message)
            - allowed: True если запрос разрешен, False если превышен лимит
            - error_message: Описание ошибки, если лимит превышен
        """
        # Проверка blacklist
        if user_id in self.blacklist:
            until_timestamp, reason = self.blacklist[user_id]
            if time.time() < until_timestamp:
                remaining = int(until_timestamp - time.time())
                return False, f"Вы заблокированы на {remaining} сек. Причина: {reason}"
            else:
                # Время блокировки истекло, удаляем из blacklist
                with self.lock:
                    del self.blacklist[user_id]
        
        # Получаем лимиты
        if max_requests is None or window_seconds is None:
            if action in self.default_limits:
                max_requests, window_seconds = self.default_limits[action]
            else:
                # Если лимиты не указаны и нет дефолтных, разрешаем
                return True, None
        
        current_time = time.time()
        cutoff_time = current_time - window_seconds
        
        with self.lock:
            # Очищаем старые запросы
            user_requests = self.requests[user_id][action]
            while user_requests and user_requests[0] < cutoff_time:
                user_requests.popleft()
            
            # Проверяем количество запросов в окне
            if len(user_requests) >= max_requests:
                oldest_request = user_requests[0]
                wait_time = int(oldest_request + window_seconds - current_time) + 1
                return False, f"Слишком много запросов. Подождите {wait_time} сек."
            
            # Добавляем текущий запрос
            user_requests.append(current_time)
        
        return True, None
    
    def check_cooldown(self, user_id: str, action: str, 
                      cooldown_seconds: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Проверяет cooldown между последовательными действиями.
        
        Args:
            user_id: ID пользователя
            action: Тип действия
            cooldown_seconds: Время cooldown в секундах (если None, использует default)
        
        Returns:
            Tuple[bool, Optional[str]]: (allowed, error_message)
        """
        # Получаем cooldown
        if cooldown_seconds is None:
            cooldown_seconds = self.default_cooldowns.get(action, 0)
        
        if cooldown_seconds == 0:
            return True, None
        
        current_time = time.time()
        
        with self.lock:
            last_action_time = self.cooldowns[user_id].get(action, 0)
            
            if current_time - last_action_time < cooldown_seconds:
                wait_time = int(cooldown_seconds - (current_time - last_action_time)) + 1
                return False, f"Подождите {wait_time} сек. между действиями."
            
            # Обновляем время последнего действия
            self.cooldowns[user_id][action] = current_time
        
        return True, None
    
    def check(self, user_id: str, action: str,
             max_requests: Optional[int] = None,
             window_seconds: Optional[int] = None,
             cooldown_seconds: Optional[int] = None) -> Tuple[bool, Optional[str]]:
        """
        Комбинированная проверка rate limit + cooldown.
        
        Returns:
            Tuple[bool, Optional[str]]: (allowed, error_message)
        """
        # Сначала проверяем cooldown
        allowed, error = self.check_cooldown(user_id, action, cooldown_seconds)
        if not allowed:
            return False, error
        
        # Потом проверяем rate limit
        return self.check_rate_limit(user_id, action, max_requests, window_seconds)
    
    def block_user(self, user_id: str, duration_seconds: int, reason: str = "Spam detected"):
        """
        Блокирует пользователя на определенное время.
        
        Args:
            user_id: ID пользователя
            duration_seconds: Длительность блокировки в секундах
            reason: Причина блокировки
        """
        until_timestamp = time.time() + duration_seconds
        with self.lock:
            self.blacklist[user_id] = (until_timestamp, reason)
        
        logger.warning(f"User {user_id} blocked for {duration_seconds}s. Reason: {reason}")
    
    def unblock_user(self, user_id: str):
        """
        Разблокирует пользователя вручную.
        """
        with self.lock:
            if user_id in self.blacklist:
                del self.blacklist[user_id]
                logger.info(f"User {user_id} unblocked manually")
    
    def is_blocked(self, user_id: str) -> Tuple[bool, Optional[str]]:
        """
        Проверяет, заблокирован ли пользователь.
        
        Returns:
            Tuple[bool, Optional[str]]: (is_blocked, reason)
        """
        if user_id in self.blacklist:
            until_timestamp, reason = self.blacklist[user_id]
            if time.time() < until_timestamp:
                return True, reason
            else:
                # Автоматически разблокируем
                with self.lock:
                    del self.blacklist[user_id]
        
        return False, None
    
    def get_request_count(self, user_id: str, action: str, 
                         window_seconds: Optional[int] = None) -> int:
        """
        Возвращает количество запросов пользователя за период.
        """
        if window_seconds is None and action in self.default_limits:
            _, window_seconds = self.default_limits[action]
        
        if window_seconds is None:
            window_seconds = 60  # По умолчанию 1 минута
        
        current_time = time.time()
        cutoff_time = current_time - window_seconds
        
        with self.lock:
            user_requests = self.requests[user_id][action]
            # Очищаем старые запросы
            while user_requests and user_requests[0] < cutoff_time:
                user_requests.popleft()
            
            return len(user_requests)
    
    def reset_user(self, user_id: str):
        """
        Сбрасывает все лимиты и cooldowns для пользователя.
        Полезно для тестирования или администраторских действий.
        """
        with self.lock:
            if user_id in self.requests:
                del self.requests[user_id]
            if user_id in self.cooldowns:
                del self.cooldowns[user_id]
            if user_id in self.blacklist:
                del self.blacklist[user_id]
        
        logger.info(f"Reset all limits for user {user_id}")
    
    def cleanup_old_data(self, max_age_seconds: int = 86400):
        """
        Очищает старые данные для экономии памяти.
        Вызывать периодически (например, раз в час).
        
        Args:
            max_age_seconds: Максимальный возраст данных для хранения (по умолчанию 24 часа)
        """
        current_time = time.time()
        cutoff_time = current_time - max_age_seconds
        
        with self.lock:
            # Очищаем старые запросы
            users_to_remove = []
            for user_id, actions in list(self.requests.items()):
                for action, requests in list(actions.items()):
                    while requests and requests[0] < cutoff_time:
                        requests.popleft()
                    
                    if not requests:
                        del actions[action]
                
                if not actions:
                    users_to_remove.append(user_id)
            
            for user_id in users_to_remove:
                del self.requests[user_id]
            
            # Очищаем старые cooldowns
            for user_id, actions in list(self.cooldowns.items()):
                for action, timestamp in list(actions.items()):
                    if current_time - timestamp > max_age_seconds:
                        del actions[action]
                
                if not actions:
                    del self.cooldowns[user_id]
            
            # Очищаем истекшие блокировки
            expired_blocks = [uid for uid, (until, _) in self.blacklist.items() if current_time > until]
            for user_id in expired_blocks:
                del self.blacklist[user_id]
        
        logger.info(f"Cleanup completed: removed data for {len(users_to_remove)} users, {len(expired_blocks)} expired blocks")


# Глобальный экземпляр rate limiter
rate_limiter = RateLimiter()


# Вспомогательная функция для использования в bot handlers
def check_rate_limit(user_id: str, action: str, **kwargs) -> Tuple[bool, Optional[str]]:
    """
    Удобная обертка для проверки rate limit.
    
    Usage:
        allowed, error = check_rate_limit(chat_id, 'command')
        if not allowed:
            bot.send_message(chat_id, error)
            return
    """
    return rate_limiter.check(user_id, action, **kwargs)


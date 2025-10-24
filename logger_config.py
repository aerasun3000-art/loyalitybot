"""
Централизованная конфигурация логирования для всех компонентов системы.
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime

def setup_logger(name: str, log_file: str = None, level: str = None) -> logging.Logger:
    """
    Создаёт и настраивает логгер с ротацией файлов.
    
    Args:
        name: Имя логгера (обычно __name__)
        log_file: Путь к файлу логов (опционально)
        level: Уровень логирования (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    
    Returns:
        Настроенный логгер
    """
    
    # Получаем уровень из переменной окружения или используем переданный
    if level is None:
        level = os.getenv('LOG_LEVEL', 'INFO')
    
    log_level = getattr(logging, level.upper(), logging.INFO)
    
    # Создаём логгер
    logger = logging.getLogger(name)
    logger.setLevel(log_level)
    
    # Избегаем дублирования хендлеров
    if logger.handlers:
        return logger
    
    # Формат логов
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console Handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File Handler (если указан файл)
    if log_file:
        # Создаём директорию для логов, если её нет
        log_dir = os.path.dirname(log_file)
        if log_dir and not os.path.exists(log_dir):
            os.makedirs(log_dir, exist_ok=True)
        
        # Ротация: максимум 10 МБ, хранить 5 файлов
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10*1024*1024,  # 10 MB
            backupCount=5,
            encoding='utf-8'
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def log_exception(logger: logging.Logger, exception: Exception, context: str = ""):
    """
    Логирует исключение с дополнительным контекстом.
    
    Args:
        logger: Логгер для записи
        exception: Исключение для логирования
        context: Дополнительная информация о контексте ошибки
    """
    error_msg = f"{context} | {type(exception).__name__}: {str(exception)}"
    logger.error(error_msg, exc_info=True)


# Инициализация логгеров для каждого модуля
def get_bot_logger(bot_name: str) -> logging.Logger:
    """Создаёт логгер для бота с автоматическим именем файла."""
    log_file = f"logs/{bot_name}_{datetime.now().strftime('%Y%m%d')}.log"
    return setup_logger(bot_name, log_file)


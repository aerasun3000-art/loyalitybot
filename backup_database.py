#!/usr/bin/env python3
"""
Скрипт резервного копирования базы данных Supabase
Создаёт экспорт всех таблиц в JSON формате
"""

import os
import json
import datetime
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
import logging

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Загрузка переменных окружения
load_dotenv()

# Директория для бэкапов
BACKUP_DIR = Path(__file__).parent / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

# Список таблиц для бэкапа
TABLES_TO_BACKUP = [
    'users',           # Клиенты
    'partners',        # Партнёры
    'transactions',    # Транзакции
    'partner_applications',  # Заявки партнёров
    'services',        # Услуги партнёров
    'promotions',      # Промоакции
    'news',            # Новости
    'app_settings',    # Настройки приложения
]


class DatabaseBackup:
    """Класс для создания резервных копий БД"""
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL и SUPABASE_KEY должны быть установлены в .env")
        
        self.client: Client = create_client(supabase_url, supabase_key)
        self.timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        
    def backup_table(self, table_name: str) -> dict:
        """
        Создание бэкапа одной таблицы
        
        Args:
            table_name: Название таблицы
            
        Returns:
            dict с метаданными и данными таблицы
        """
        logger.info(f"Бэкап таблицы: {table_name}")
        
        try:
            # Получение всех записей из таблицы
            response = self.client.table(table_name).select("*").execute()
            
            data = {
                "table": table_name,
                "timestamp": self.timestamp,
                "count": len(response.data),
                "data": response.data
            }
            
            logger.info(f"✓ {table_name}: {len(response.data)} записей")
            return data
            
        except Exception as e:
            logger.error(f"✗ Ошибка при бэкапе {table_name}: {e}")
            return {
                "table": table_name,
                "timestamp": self.timestamp,
                "error": str(e),
                "data": []
            }
    
    def create_full_backup(self) -> str:
        """
        Создание полного бэкапа всех таблиц
        
        Returns:
            Путь к файлу бэкапа
        """
        logger.info("=" * 60)
        logger.info("Начало создания полного бэкапа БД")
        logger.info("=" * 60)
        
        backup_data = {
            "timestamp": self.timestamp,
            "datetime": datetime.datetime.now().isoformat(),
            "tables": {}
        }
        
        # Бэкап каждой таблицы
        for table_name in TABLES_TO_BACKUP:
            table_backup = self.backup_table(table_name)
            backup_data["tables"][table_name] = table_backup
        
        # Сохранение в файл
        filename = f"backup_{self.timestamp}.json"
        filepath = BACKUP_DIR / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
        
        # Статистика
        total_records = sum(
            table["count"] if "count" in table else 0 
            for table in backup_data["tables"].values()
        )
        
        file_size = filepath.stat().st_size / 1024 / 1024  # MB
        
        logger.info("=" * 60)
        logger.info("Бэкап завершён!")
        logger.info(f"Файл: {filepath}")
        logger.info(f"Размер: {file_size:.2f} MB")
        logger.info(f"Всего записей: {total_records}")
        logger.info("=" * 60)
        
        return str(filepath)
    
    def create_incremental_backup(self, since_date: str = None) -> str:
        """
        Создание инкрементного бэкапа (только изменения)
        
        Args:
            since_date: Дата в формате ISO (например, '2025-11-15')
            
        Returns:
            Путь к файлу бэкапа
        """
        if not since_date:
            # По умолчанию - изменения за последние 24 часа
            since_date = (datetime.datetime.now() - datetime.timedelta(days=1)).isoformat()
        
        logger.info(f"Инкрементный бэкап с {since_date}")
        
        backup_data = {
            "timestamp": self.timestamp,
            "datetime": datetime.datetime.now().isoformat(),
            "since": since_date,
            "tables": {}
        }
        
        # Для таблиц с created_at/updated_at
        date_fields = {
            'users': 'reg_date',
            'partners': 'reg_date',
            'transactions': 'timestamp',
            'partner_applications': 'created_at',
            'services': 'created_at',
            'promotions': 'created_at',
            'news': 'created_at',
        }
        
        for table_name in TABLES_TO_BACKUP:
            date_field = date_fields.get(table_name)
            
            if date_field:
                try:
                    response = self.client.table(table_name)\
                        .select("*")\
                        .gte(date_field, since_date)\
                        .execute()
                    
                    backup_data["tables"][table_name] = {
                        "table": table_name,
                        "count": len(response.data),
                        "data": response.data
                    }
                    
                    logger.info(f"✓ {table_name}: {len(response.data)} изменённых записей")
                    
                except Exception as e:
                    logger.error(f"✗ Ошибка при бэкапе {table_name}: {e}")
        
        # Сохранение
        filename = f"backup_incremental_{self.timestamp}.json"
        filepath = BACKUP_DIR / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Инкрементный бэкап сохранён: {filepath}")
        
        return str(filepath)
    
    def cleanup_old_backups(self, keep_days: int = 30):
        """
        Удаление старых бэкапов
        
        Args:
            keep_days: Сколько дней хранить бэкапы
        """
        logger.info(f"Очистка бэкапов старше {keep_days} дней")
        
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=keep_days)
        deleted_count = 0
        
        for backup_file in BACKUP_DIR.glob("backup_*.json"):
            file_time = datetime.datetime.fromtimestamp(backup_file.stat().st_mtime)
            
            if file_time < cutoff_date:
                backup_file.unlink()
                deleted_count += 1
                logger.info(f"✓ Удалён старый бэкап: {backup_file.name}")
        
        logger.info(f"Удалено {deleted_count} старых бэкапов")


def main():
    """Основная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Резервное копирование базы данных Supabase')
    parser.add_argument(
        '--type',
        choices=['full', 'incremental'],
        default='full',
        help='Тип бэкапа: full (полный) или incremental (инкрементный)'
    )
    parser.add_argument(
        '--since',
        type=str,
        help='Для incremental: дата начала в формате ISO (2025-11-15)'
    )
    parser.add_argument(
        '--cleanup',
        action='store_true',
        help='Удалить старые бэкапы (старше 30 дней)'
    )
    
    args = parser.parse_args()
    
    try:
        backup = DatabaseBackup()
        
        if args.type == 'full':
            backup.create_full_backup()
        else:
            backup.create_incremental_backup(args.since)
        
        if args.cleanup:
            backup.cleanup_old_backups()
            
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())



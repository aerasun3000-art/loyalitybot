#!/usr/bin/env python3
"""
Скрипт восстановления базы данных из бэкапа
⚠️ ВНИМАНИЕ: используйте осторожно, это может перезаписать существующие данные!
"""

import os
import json
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

load_dotenv()

BACKUP_DIR = Path(__file__).parent / "backups"


class DatabaseRestore:
    """Класс для восстановления БД из бэкапа"""
    
    def __init__(self):
        supabase_url = os.getenv("SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_KEY")
        
        if not supabase_url or not supabase_key:
            raise ValueError("SUPABASE_URL и SUPABASE_KEY должны быть установлены в .env")
        
        self.client: Client = create_client(supabase_url, supabase_key)
    
    def restore_from_file(self, backup_file: str, dry_run: bool = True):
        """
        Восстановление БД из файла бэкапа
        
        Args:
            backup_file: Путь к файлу бэкапа
            dry_run: Если True - только показывает что будет восстановлено (безопасно)
        """
        backup_path = Path(backup_file)
        
        if not backup_path.exists():
            raise FileNotFoundError(f"Файл бэкапа не найден: {backup_file}")
        
        logger.info("=" * 60)
        logger.info(f"Восстановление из бэкапа: {backup_path.name}")
        logger.info(f"Режим: {'DRY RUN (только просмотр)' if dry_run else 'РЕАЛЬНОЕ ВОССТАНОВЛЕНИЕ'}")
        logger.info("=" * 60)
        
        # Загрузка бэкапа
        with open(backup_path, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        logger.info(f"Дата бэкапа: {backup_data.get('datetime', 'unknown')}")
        
        # Восстановление каждой таблицы
        for table_name, table_data in backup_data.get('tables', {}).items():
            self.restore_table(table_name, table_data, dry_run)
        
        logger.info("=" * 60)
        if dry_run:
            logger.info("DRY RUN завершён. Для реального восстановления используйте --execute")
        else:
            logger.info("Восстановление завершено!")
        logger.info("=" * 60)
    
    def restore_table(self, table_name: str, table_data: dict, dry_run: bool = True):
        """
        Восстановление одной таблицы
        
        Args:
            table_name: Название таблицы
            table_data: Данные таблицы из бэкапа
            dry_run: Если True - только показать статистику
        """
        records = table_data.get('data', [])
        count = len(records)
        
        logger.info(f"\nТаблица: {table_name}")
        logger.info(f"  Записей к восстановлению: {count}")
        
        if dry_run:
            # Показать примеры записей
            if records:
                logger.info(f"  Пример первой записи: {list(records[0].keys())}")
            return
        
        # РЕАЛЬНОЕ ВОССТАНОВЛЕНИЕ
        # ⚠️ ВНИМАНИЕ: это перезапишет существующие данные!
        
        if not records:
            logger.info(f"  Нет данных для восстановления")
            return
        
        try:
            # Варианты восстановления:
            # 1. Upsert (обновление существующих + вставка новых)
            # 2. Insert (только вставка новых)
            # 3. Delete + Insert (полная замена)
            
            # Используем upsert для безопасности
            response = self.client.table(table_name).upsert(records).execute()
            
            logger.info(f"  ✓ Восстановлено успешно: {count} записей")
            
        except Exception as e:
            logger.error(f"  ✗ Ошибка при восстановлении {table_name}: {e}")
    
    def list_backups(self):
        """Показать список доступных бэкапов"""
        logger.info("Доступные бэкапы:")
        logger.info("=" * 60)
        
        backups = sorted(BACKUP_DIR.glob("backup_*.json"), reverse=True)
        
        if not backups:
            logger.info("Нет доступных бэкапов")
            return
        
        for backup_file in backups:
            stat = backup_file.stat()
            size_mb = stat.st_size / 1024 / 1024
            
            # Попытка прочитать метаданные
            try:
                with open(backup_file, 'r') as f:
                    data = json.load(f)
                    date = data.get('datetime', 'unknown')
                    tables = len(data.get('tables', {}))
                    
                logger.info(f"\n{backup_file.name}")
                logger.info(f"  Дата: {date}")
                logger.info(f"  Размер: {size_mb:.2f} MB")
                logger.info(f"  Таблиц: {tables}")
                
            except Exception as e:
                logger.error(f"  Ошибка чтения метаданных: {e}")


def main():
    """Основная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Восстановление базы данных из бэкапа',
        epilog='⚠️ ВНИМАНИЕ: восстановление может перезаписать существующие данные!'
    )
    parser.add_argument(
        '--file',
        type=str,
        help='Путь к файлу бэкапа'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Выполнить реальное восстановление (по умолчанию - dry run)'
    )
    parser.add_argument(
        '--list',
        action='store_true',
        help='Показать список доступных бэкапов'
    )
    
    args = parser.parse_args()
    
    try:
        restore = DatabaseRestore()
        
        if args.list:
            restore.list_backups()
        elif args.file:
            restore.restore_from_file(args.file, dry_run=not args.execute)
        else:
            parser.print_help()
            logger.info("\nИспользуйте --list для просмотра доступных бэкапов")
            
    except Exception as e:
        logger.error(f"Критическая ошибка: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())



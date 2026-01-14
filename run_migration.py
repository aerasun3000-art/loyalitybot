import os
import logging
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("migration_runner")

def run_migration():
    supabase_url = os.environ.get("SUPABASE_URL")
    supabase_key = os.environ.get("SUPABASE_KEY") # Нужен SERVICE_ROLE_KEY для DDL операций!

    if not supabase_url or not supabase_key:
        logger.error("Нет ключей Supabase")
        return

    # Внимание: Обычный ANON ключ часто не имеет прав на ALTER TABLE.
    # Если этот скрипт упадет, выполните SQL вручную в Dashboard.
    client: Client = create_client(supabase_url, supabase_key)

    try:
        # Читаем SQL
        with open("ecosystem_migration.sql", "r") as f:
            sql_content = f.read()

        # Supabase Python Client не имеет метода .sql() напрямую для raw query.
        # Обычно DDL делают через Dashboard или psql.
        # Но можно попробовать вызвать через RPC, если есть функция exec_sql.
        
        logger.info("Пытаюсь выполнить миграцию...")
        
        # Если у вас нет функции exec_sql, этот метод не сработает.
        # Поэтому я просто вывожу инструкцию.
        print("\n" + "="*50)
        print("ВНИМАНИЕ: Для применения изменений в БД:")
        print("1. Откройте Supabase Dashboard -> SQL Editor")
        print("2. Создайте новый запрос")
        print("3. Скопируйте содержимое файла ecosystem_migration.sql")
        print("4. Нажмите RUN")
        print("="*50 + "\n")
        
    except Exception as e:
        logger.error(f"Ошибка: {e}")

if __name__ == "__main__":
    run_migration()

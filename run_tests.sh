#!/bin/bash
# Скрипт для запуска тестов LoyalityBot

echo "=== LoyalityBot Test Runner ==="
echo ""

# Проверка виртуального окружения
if [ ! -d "venv" ]; then
    echo "❌ Виртуальное окружение не найдено. Создайте его: python3 -m venv venv"
    exit 1
fi

# Активация виртуального окружения
echo "📦 Активация виртуального окружения..."
source venv/bin/activate

# Установка тестовых зависимостей
echo "📥 Установка зависимостей для тестирования..."
pip install -q -r requirements-dev.txt

echo ""
echo "🧪 Запуск тестов..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Запуск тестов с покрытием
pytest tests/ -v --cov=. --cov-report=term-missing --cov-report=html

TEST_EXIT_CODE=$?

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Все тесты пройдены успешно!"
    echo ""
    echo "📊 HTML отчёт о покрытии кода создан в: htmlcov/index.html"
    echo "   Откройте в браузере: open htmlcov/index.html"
else
    echo "❌ Некоторые тесты провалились. Код выхода: $TEST_EXIT_CODE"
    exit $TEST_EXIT_CODE
fi

echo ""
echo "=== Тестирование завершено ==="


FROM python:3.11-slim

# Установка системных зависимостей (оптимизировано для кэширования)
# Добавляем libzbar0 для работы QR-сканера (pyzbar)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libzbar0 \
    && rm -rf /var/lib/apt/lists/*

# Рабочая директория
WORKDIR /app

# Переменные окружения для оптимизации Python
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONHASHSEED=0
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Копирование зависимостей (отдельный слой для лучшего кэширования)
COPY requirements.txt .

# Установка Python зависимостей (кэшируется отдельно)
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода приложения
COPY . .

# Создание директории для логов
RUN mkdir -p /app/logs

# Healthcheck (для админ-бота, например)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD pgrep -f python || exit 1

# По умолчанию запускаем партнёрский бот
# В docker-compose.yml или fly.toml переопределяется для каждого сервиса
# Для Fly.io команда задаётся в [processes] секции fly.toml
CMD ["python", "bot.py"]


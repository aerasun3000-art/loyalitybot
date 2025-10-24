# Systemd Services для LoyalityBot

## Установка

### 1. Подготовка

Создайте директорию для логов:

```bash
sudo mkdir -p /var/log/loyalitybot
sudo chown YOUR_USERNAME:YOUR_USERNAME /var/log/loyalitybot
```

### 2. Настройка сервисных файлов

Отредактируйте каждый `.service` файл, заменив:

- `YOUR_USERNAME` на ваше имя пользователя
- `/path/to/loyalitybot` на реальный путь к проекту

Например:
```ini
User=ubuntu
WorkingDirectory=/home/ubuntu/loyalitybot
Environment="PATH=/home/ubuntu/loyalitybot/venv/bin"
ExecStart=/home/ubuntu/loyalitybot/venv/bin/python bot.py
```

### 3. Копирование в systemd

```bash
sudo cp loyalitybot-*.service /etc/systemd/system/
sudo systemctl daemon-reload
```

### 4. Запуск сервисов

```bash
# Включить автозапуск
sudo systemctl enable loyalitybot-partner
sudo systemctl enable loyalitybot-client
sudo systemctl enable loyalitybot-admin

# Запустить сервисы
sudo systemctl start loyalitybot-partner
sudo systemctl start loyalitybot-client
sudo systemctl start loyalitybot-admin
```

### 5. Проверка статуса

```bash
sudo systemctl status loyalitybot-partner
sudo systemctl status loyalitybot-client
sudo systemctl status loyalitybot-admin
```

## Управление

### Просмотр логов

```bash
# В реальном времени
sudo journalctl -u loyalitybot-partner -f

# Последние 100 строк
sudo journalctl -u loyalitybot-partner -n 100

# Логи из файла
tail -f /var/log/loyalitybot/partner.log
```

### Перезапуск

```bash
sudo systemctl restart loyalitybot-partner
```

### Остановка

```bash
sudo systemctl stop loyalitybot-partner
```

### Отключение автозапуска

```bash
sudo systemctl disable loyalitybot-partner
```

## Устранение проблем

### Сервис не запускается

1. Проверьте логи: `sudo journalctl -u loyalitybot-partner -n 50`
2. Убедитесь, что пути корректны
3. Проверьте права доступа: `ls -la /path/to/loyalitybot`
4. Проверьте .env файл: `cat /path/to/loyalitybot/.env`

### Сервис падает

1. Проверьте error.log: `tail -f /var/log/loyalitybot/partner.error.log`
2. Убедитесь, что все зависимости установлены: `source venv/bin/activate && pip install -r requirements.txt`
3. Проверьте доступ к БД и Telegram API


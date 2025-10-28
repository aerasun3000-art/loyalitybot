# Rate Limiting & Anti-Spam Implementation

**Дата внедрения:** 28 октября 2025  
**Статус:** ✅ Готово к production

---

## 📋 Обзор

LoyaltyBot оснащен комплексной системой защиты от спама, злоупотреблений и DDoS-атак через **Rate Limiting** и **Cooldown** механизмы.

---

## 🛡️ Реализованные механизмы защиты

### 1. Rate Limiting (Ограничение частоты запросов)

**Принцип:** Скользящее временное окно (Sliding Window)

**Лимиты по типам действий:**

| Действие | Лимит | Окно | Описание |
|----------|-------|------|----------|
| `message` | 10 | 60 сек | Обычные сообщения |
| `command` | 5 | 60 сек | Команды бота (/start, /help, /ask) |
| `transaction` | 3 | 300 сек | Транзакции (начисление/списание) |
| `export_data` | 1 | 3600 сек | Экспорт данных (GDPR) |
| `delete_account` | 1 | 86400 сек | Удаление аккаунта (GDPR) |
| `create_service` | 5 | 3600 сек | Создание услуги (партнер) |
| `create_promotion` | 5 | 3600 сек | Создание акции (партнер) |
| `upload_image` | 10 | 3600 сек | Загрузка изображений |

### 2. Cooldown (Задержка между действиями)

**Принцип:** Минимальное время между последовательными действиями

**Настройки:**

| Действие | Cooldown | Описание |
|----------|----------|----------|
| `transaction` | 5 сек | Между транзакциями |
| `message` | 1 сек | Между сообщениями |
| `command` | 2 сек | Между командами |
| `create_service` | 10 сек | Между созданием услуг |

### 3. Blacklist (Блокировка пользователей)

**Возможности:**
- ✅ Временная блокировка на N секунд
- ✅ Автоматическое снятие блокировки
- ✅ Ручная разблокировка администратором
- ✅ Указание причины блокировки

---

## 🔧 Технические детали

### Архитектура

```python
RateLimiter
├── requests: Dict[user_id][action] → deque([timestamps])
├── cooldowns: Dict[user_id][action] → last_timestamp
├── blacklist: Dict[user_id] → (until_timestamp, reason)
└── locks: Thread-safe операции
```

### Алгоритм работы

1. **Проверка blacklist:**
   - Если пользователь заблокирован → возврат ошибки
   - Если время блокировки истекло → автоматическая разблокировка

2. **Проверка cooldown:**
   - Если прошло недостаточно времени → возврат ошибки
   - Иначе → обновление времени последнего действия

3. **Проверка rate limit:**
   - Очистка старых запросов (вне окна)
   - Подсчет запросов в текущем окне
   - Если превышен лимит → возврат ошибки
   - Иначе → добавление нового запроса

### Thread Safety

Все операции защищены мьютексом (`threading.Lock`) для безопасной работы в многопоточной среде.

---

## 📱 Пользовательский опыт

### Сценарии

#### 1. Превышение лимита сообщений

```
Пользователь: (отправляет 11 сообщений в минуту)
Бот: ⏸️ Слишком много запросов. Подождите 45 сек.
```

#### 2. Слишком частые команды

```
Пользователь: /start
Пользователь: /start (через 1 секунду)
Бот: ⏸️ Подождите 1 сек. между действиями.
```

#### 3. Попытка частых транзакций

```
Пользователь: (пытается начислить баллы 4 раза подряд)
Бот: ⏸️ Слишком много запросов. Подождите 180 сек.
```

#### 4. Блокировка за спам

```
Администратор: rate_limiter.block_user("123456", 3600, "Spam detected")
Пользователь: /start
Бот: ⏸️ Вы заблокированы на 3600 сек. Причина: Spam detected
```

---

## 🔨 API и использование

### В bot handlers

```python
from rate_limiter import check_rate_limit

@bot.message_handler(commands=['start'])
def handle_start(message):
    chat_id = str(message.chat.id)
    
    # Проверка rate limit
    allowed, error = check_rate_limit(chat_id, 'command')
    if not allowed:
        bot.send_message(chat_id, f"⏸️ {error}")
        logger.warning(f"Rate limit exceeded for {chat_id}")
        return
    
    # Основная логика команды
    ...
```

### Ручная проверка

```python
from rate_limiter import rate_limiter

# Проверка только rate limit
allowed, error = rate_limiter.check_rate_limit(
    user_id="123456",
    action="transaction",
    max_requests=3,
    window_seconds=300
)

# Проверка только cooldown
allowed, error = rate_limiter.check_cooldown(
    user_id="123456",
    action="transaction",
    cooldown_seconds=5
)

# Комбинированная проверка (rate limit + cooldown)
allowed, error = rate_limiter.check(
    user_id="123456",
    action="transaction"
)
```

### Блокировка пользователей

```python
# Заблокировать на 1 час
rate_limiter.block_user("123456", 3600, "Spam detected")

# Проверить блокировку
is_blocked, reason = rate_limiter.is_blocked("123456")

# Разблокировать
rate_limiter.unblock_user("123456")
```

### Статистика

```python
# Количество запросов за период
count = rate_limiter.get_request_count("123456", "message", window_seconds=60)

# Сброс всех лимитов для пользователя
rate_limiter.reset_user("123456")
```

### Очистка старых данных

```python
# Очистить данные старше 24 часов (запускать периодически)
rate_limiter.cleanup_old_data(max_age_seconds=86400)
```

---

## 🧪 Тестирование

### Тестовые сценарии

1. **Нормальное использование:**
   - Пользователь отправляет 5 команд в минуту → все проходят
   - Пользователь отправляет 6-ю команду → блокируется

2. **Cooldown:**
   - Пользователь делает транзакцию → ОК
   - Сразу еще одна транзакция → блокируется (5 сек cooldown)
   - Через 5 секунд → ОК

3. **Blacklist:**
   - Администратор блокирует пользователя
   - Пользователь пытается использовать бота → блокируется
   - Через N секунд → автоматически разблокируется

4. **GDPR лимиты:**
   - Экспорт данных → ОК
   - Повторный экспорт → блокируется (1 час)
   - Удаление аккаунта → ОК
   - Повторное удаление → блокируется (24 часа)

### Команды для тестирования

```python
# В Python консоли или тестовом скрипте
from rate_limiter import rate_limiter

# Симуляция 11 сообщений
for i in range(11):
    allowed, error = rate_limiter.check_rate_limit("test_user", "message")
    print(f"Request {i+1}: {allowed}, {error}")

# Проверка cooldown
import time
for i in range(3):
    allowed, error = rate_limiter.check_cooldown("test_user", "transaction")
    print(f"Transaction {i+1}: {allowed}, {error}")
    time.sleep(2)  # Ждем 2 секунды

# Блокировка
rate_limiter.block_user("test_user", 10, "Test block")
allowed, error = rate_limiter.check("test_user", "message")
print(f"Blocked check: {allowed}, {error}")
```

---

## ⚠️ Важные замечания

### Что НЕ блокируется

1. **Критичные команды:**
   - Первый `/start` всегда разрешен
   - Системные callback'и

2. **Администраторы:**
   - Можно добавить белый список для админов
   - Обход лимитов при необходимости

### Настройки для production

```python
# Для high-load production можно использовать Redis
# Замените in-memory хранилище на Redis:

import redis
r = redis.Redis(host='localhost', port=6379, db=0)

# Пример адаптации:
class RedisRateLimiter(RateLimiter):
    def check_rate_limit(self, user_id, action, ...):
        key = f"rate_limit:{user_id}:{action}"
        count = r.incr(key)
        if count == 1:
            r.expire(key, window_seconds)
        return count <= max_requests
```

---

## 📊 Мониторинг

### Метрики для отслеживания

1. **Количество блокировок в час**
2. **Топ пользователей по количеству запросов**
3. **Частота срабатывания лимитов по типам**
4. **Средняя задержка из-за cooldown**

### Логирование

Все события логируются:
```
logger.warning(f"Rate limit exceeded for {chat_id}: {action}")
logger.warning(f"User {user_id} blocked for {duration}s. Reason: {reason}")
logger.info(f"User {user_id} unblocked manually")
```

---

## ✅ Checklist

- [x] **RateLimiter класс** создан
- [x] **Интеграция с client_handler.py** завершена
- [x] **Rate limiting для всех критичных команд**
- [x] **Cooldown между операциями**
- [x] **Blacklist функциональность**
- [x] **Thread-safe реализация**
- [x] **Логирование всех событий**
- [x] **Автоматическая очистка старых данных**
- [ ] **Интеграция с partner_bot.py** (опционально)
- [ ] **Интеграция с admin_bot.py** (опционально)
- [ ] **Redis для production** (опционально)
- [ ] **Мониторинг и алерты** (опционально)

---

## 🎯 Следующие шаги

### Опциональные улучшения

1. **Adaptive Rate Limiting:**
   - Автоматическое увеличение лимитов для доверенных пользователей
   - Более строгие лимиты для новых пользователей

2. **Geo-based limiting:**
   - Разные лимиты для разных регионов

3. **IP-based limiting:**
   - Дополнительная защита по IP-адресам

4. **Machine Learning:**
   - Автоматическое определение спам-паттернов

---

## 🎉 Итоги

**LoyaltyBot теперь защищен от спама и злоупотреблений!**

Система обеспечивает:
- ✅ Защиту от flood-атак
- ✅ Предотвращение злоупотреблений GDPR-функциями
- ✅ Контроль частоты транзакций
- ✅ Гибкую настройку лимитов
- ✅ Thread-safe работу в многопоточной среде

**Время реализации:** ~2 часа  
**Дата завершения:** 28 октября 2025  
**Статус:** Production-ready ✅


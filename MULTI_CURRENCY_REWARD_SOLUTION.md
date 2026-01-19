# 💱 РЕШЕНИЕ ПРОБЛЕМЫ ВЫЧИСЛЕНИЯ ВОЗНАГРАЖДЕНИЙ В РАЗНЫХ ВАЛЮТАХ

**Дата:** Декабрь 2025  
**Проблема:** Расчет вознаграждений (Revenue Share, реферальные комиссии) когда партнеры работают в разных валютах  
**Статус:** ТЗ для реализации

---

## 🎯 СУТЬ ПРОБЛЕМЫ

### Текущая ситуация:

1. **Партнеры работают в разных валютах:**
   - Партнер из Нячанга: транзакции в VND (500.000₫, 1.000.000₫)
   - Партнер из Нью-Йорка: транзакции в USD ($20, $100)
   - Партнер из Москвы: транзакции в RUB (3.000₽, 5.000₽)

2. **Транзакции хранятся в БД:**
   ```sql
   transactions.total_amount = 500000  -- VND
   transactions.total_amount = 100     -- USD
   transactions.total_amount = 3000    -- RUB
   ```

3. **Revenue Share рассчитывается:**
   ```python
   system_revenue = total_turnover * (pv_percent / 100.0)
   revenue_share = system_revenue * 0.05  # 5%
   ```

4. **Проблема:**
   - ❌ Нельзя складывать `500000₫ + $100` без конвертации
   - ❌ Revenue Share должен быть в одной валюте для справедливого распределения
   - ❌ Нужно конвертировать все суммы в базовую валюту

---

## ✅ РЕШЕНИЕ

### Подход 1: Конвертация в базовую валюту (USD) ⭐ Рекомендуемый

**Идея:** Все транзакции хранятся в оригинальной валюте, но при расчете вознаграждений конвертируются в USD.

#### Шаг 1: Добавить поле `currency` в таблицу `transactions`

```sql
-- Миграция: Добавление поля currency в transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_transactions_currency 
ON transactions(currency);

-- Комментарий
COMMENT ON COLUMN transactions.currency IS 'Валюта транзакции (USD, VND, RUB, etc.)';
```

#### Шаг 2: Сохранять валюту при создании транзакции

```python:supabase_manager.py
def record_transaction(self, client_chat_id: int, partner_chat_id: int, 
                       points: int, transaction_type: str, 
                       description: str, raw_amount: float = 0.00) -> bool:
    """Записывает транзакцию в таблицу 'transactions'."""
    
    # ✅ Получаем валюту партнера
    partner_city = self.get_partner_city(partner_chat_id)
    currency = get_currency_by_city(partner_city) if partner_city else 'USD'
    
    try:
        data = {
            "client_chat_id": str(client_chat_id),
            "partner_chat_id": str(partner_chat_id),
            "date_time": datetime.datetime.now().isoformat(),
            "total_amount": raw_amount,
            "currency": currency,  # ✅ Сохраняем валюту
            "earned_points": earned,
            "spent_points": spent,
            "operation_type": transaction_type,
            "description": description,
        }
        self.client.from_(TRANSACTION_TABLE).insert(data).execute()
        return True
    except Exception as e:
        logging.error(f"Error recording transaction: {e}")
        return False
```

#### Шаг 3: Создать таблицу курсов валют

```sql
-- Таблица для хранения курсов валют
CREATE TABLE IF NOT EXISTS currency_exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency TEXT NOT NULL,      -- Исходная валюта (VND, RUB, etc.)
    to_currency TEXT NOT NULL,        -- Целевая валюта (USD)
    rate NUMERIC(18, 8) NOT NULL,     -- Курс обмена (например, 24500 для VND→USD)
    source TEXT DEFAULT 'manual',     -- Источник курса (manual, api, etc.)
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP,        -- До какой даты действует курс
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(from_currency, to_currency, effective_from)
);

-- Индекс для быстрого поиска актуальных курсов
CREATE INDEX IF NOT EXISTS idx_currency_rates_lookup 
ON currency_exchange_rates(from_currency, to_currency, effective_from);

-- Комментарии
COMMENT ON TABLE currency_exchange_rates IS 'Курсы обмена валют для конвертации транзакций';
COMMENT ON COLUMN currency_exchange_rates.rate IS 'Курс: 1 from_currency = rate to_currency (например, 1 VND = 0.0000408 USD)';
```

#### Шаг 4: Функция конвертации валют

```python:currency_utils.py
def get_exchange_rate(from_currency: str, to_currency: str = 'USD', 
                     date: Optional[datetime] = None) -> float:
    """
    Получает курс обмена валют
    
    Args:
        from_currency: Исходная валюта (VND, RUB, etc.)
        to_currency: Целевая валюта (по умолчанию USD)
        date: Дата для получения исторического курса (по умолчанию сегодня)
    
    Returns:
        float: Курс обмена (1 from_currency = rate to_currency)
    """
    if not date:
        date = datetime.now()
    
    # Если конвертируем в ту же валюту
    if from_currency == to_currency:
        return 1.0
    
    try:
        # Получаем курс из БД
        result = supabase_client.table('currency_exchange_rates').select('rate').eq(
            'from_currency', from_currency
        ).eq('to_currency', to_currency).lte('effective_from', date).order(
            'effective_from', desc=True
        ).limit(1).execute()
        
        if result.data and len(result.data) > 0:
            return float(result.data[0]['rate'])
    except Exception as e:
        logging.error(f"Error getting exchange rate: {e}")
    
    # Fallback: использование фиксированных курсов по умолчанию
    DEFAULT_RATES = {
        'VND_USD': 0.0000408,  # 1 VND = 0.0000408 USD (≈24,500 VND = 1 USD)
        'RUB_USD': 0.011,      # 1 RUB = 0.011 USD (≈91 RUB = 1 USD)
        'KZT_USD': 0.0021,     # 1 KZT = 0.0021 USD (≈476 KZT = 1 USD)
        'KGS_USD': 0.011,      # 1 KGS = 0.011 USD (≈91 KGS = 1 USD)
        'AED_USD': 0.272,      # 1 AED = 0.272 USD (≈3.67 AED = 1 USD)
        'EUR_USD': 1.08,
        'GBP_USD': 1.27,
        # Добавить другие валюты по необходимости
    }
    
    key = f"{from_currency}_{to_currency}"
    return DEFAULT_RATES.get(key, 1.0)


def convert_currency(amount: float, from_currency: str, 
                    to_currency: str = 'USD',
                    date: Optional[datetime] = None) -> float:
    """
    Конвертирует сумму из одной валюты в другую
    
    Args:
        amount: Сумма в исходной валюте
        from_currency: Исходная валюта
        to_currency: Целевая валюта (по умолчанию USD)
        date: Дата для исторической конвертации
    
    Returns:
        float: Сумма в целевой валюте
    """
    if from_currency == to_currency:
        return amount
    
    rate = get_exchange_rate(from_currency, to_currency, date)
    return amount * rate
```

#### Шаг 5: Обновить расчет Revenue Share с конвертацией

```python:partner_revenue_share.py
def _get_system_revenue(
    self,
    partner_chat_id: str,
    period_start: date,
    period_end: date
) -> float:
    """
    Получает доход системы с партнера за период (в USD)
    
    ✅ ВСЕ СУММЫ КОНВЕРТИРУЮТСЯ В USD
    """
    try:
        # Получаем PV партнера
        partner_data = self.db.client.table('partners').select(
            'pv_percent, city'
        ).eq('chat_id', partner_chat_id).single().execute()
        
        if not partner_data.data:
            logger.warning(f"Партнер {partner_chat_id} не найден")
            return 0.0
        
        pv_percent = float(partner_data.data.get('pv_percent', 10.0))
        
        # ✅ Получаем транзакции с валютами
        transactions = self.db.client.table('transactions').select(
            'total_amount, currency, date_time'
        ).eq('partner_chat_id', partner_chat_id).gte(
            'date_time', period_start.isoformat()
        ).lte('date_time', period_end.isoformat()).execute()
        
        total_turnover_usd = 0.0
        
        # ✅ Конвертируем каждую транзакцию в USD
        for txn in transactions.data:
            amount = float(txn.get('total_amount', 0))
            currency = txn.get('currency', 'USD')
            txn_date = datetime.fromisoformat(txn['date_time'].replace('Z', '+00:00'))
            
            # Конвертируем в USD
            amount_usd = convert_currency(
                amount, 
                from_currency=currency, 
                to_currency='USD',
                date=txn_date
            )
            
            total_turnover_usd += amount_usd
        
        # Доход системы = Оборот (в USD) × PV%
        system_revenue_usd = total_turnover_usd * (pv_percent / 100.0)
        
        logger.info(
            f"Доход системы с партнера {partner_chat_id}: "
            f"Оборот=${total_turnover_usd:.2f} USD, PV={pv_percent}%, "
            f"Доход=${system_revenue_usd:.2f} USD"
        )
        
        return round(system_revenue_usd, 2)
        
    except Exception as e:
        logger.error(f"Ошибка при получении дохода системы: {e}")
        return 0.0
```

#### Шаг 6: Обновить расчет реферальных комиссий

```python:supabase_manager.py
def process_referral_transaction_bonuses(
    self, 
    user_chat_id: str, 
    earned_points: int, 
    transaction_id: int = None,
    raw_amount: Optional[float] = None, 
    seller_partner_id: Optional[str] = None
) -> bool:
    """
    Обрабатывает реферальные бонусы с транзакции
    ✅ С учетом конвертации валют
    """
    
    # ... существующая логика ...
    
    if REFERRAL_CALCULATOR_AVAILABLE and raw_amount and seller_partner_id:
        try:
            # ✅ Получаем валюту транзакции
            txn_data = self.client.table('transactions').select(
                'currency, date_time'
            ).eq('id', transaction_id).single().execute()
            
            currency = txn_data.data.get('currency', 'USD') if txn_data.data else 'USD'
            txn_date = datetime.fromisoformat(
                txn_data.data['date_time'].replace('Z', '+00:00')
            ) if txn_data.data else datetime.now()
            
            # ✅ Конвертируем сумму в USD для расчета комиссий
            raw_amount_usd = convert_currency(
                raw_amount,
                from_currency=currency,
                to_currency='USD',
                date=txn_date
            )
            
            # Используем USD сумму для расчета
            purchase = PurchaseInput(
                user_id=user_chat_id,
                amount=raw_amount_usd,  # ✅ В USD
                seller_partner_id=seller_partner_id
            )
            
            result = calculator.calculate_commissions(purchase, seller_data)
            
            # ... остальная логика ...
            
        except Exception as e:
            logging.error(f"Error in referral commission calculation: {e}")
            # Fallback на старую логику
    
    # ...
```

---

### Подход 2: Хранение в двух валютах (оригинал + USD)

**Альтернативный подход:** Хранить сумму и в оригинальной валюте, и в USD при создании транзакции.

#### Преимущества:
- ✅ Быстрее при чтении (не нужно конвертировать)
- ✅ Точность курса на момент транзакции

#### Недостатки:
- ❌ Дублирование данных
- ❌ Нужно обновлять при изменении курсов

```sql
-- Добавить поле для USD суммы
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS total_amount_usd NUMERIC(18, 2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS exchange_rate_at_transaction NUMERIC(18, 8);

-- Индекс
CREATE INDEX IF NOT EXISTS idx_transactions_amount_usd 
ON transactions(total_amount_usd);
```

---

## 📊 ПРИМЕРЫ РАСЧЕТОВ

### Пример 1: Revenue Share между партнерами в разных валютах

**Сценарий:**
- Партнер A (Нячанг, VND): Оборот = 50.000.000₫, PV = 10%
- Партнер B (Нью-Йорк, USD): Оборот = $20,000, PV = 10%
- Партнер C получает Revenue Share 5% с партнеров A и B

**Расчет:**

1. **Доход системы с партнера A:**
   ```
   Оборот в USD: 50.000.000₫ × 0.0000408 = $2,040
   System Revenue: $2,040 × 10% = $204
   ```

2. **Доход системы с партнера B:**
   ```
   System Revenue: $20,000 × 10% = $2,000
   ```

3. **Revenue Share для партнера C:**
   ```
   С партнера A: $204 × 5% = $10.20
   С партнера B: $2,000 × 5% = $100
   Итого: $110.20 USD
   ```

---

### Пример 2: Реферальная комиссия

**Сценарий:**
- Клиент из Нячанга покупает услугу у партнера из Нью-Йорка
- Сумма чека: $100 (USD)
- Реферал L1 получает 5% комиссии

**Расчет:**
```
Сумма в USD: $100 (уже в USD)
Комиссия L1: $100 × 5% = $5
```

**Сценарий (обратный):**
- Клиент из Нью-Йорка покупает услугу у партнера из Нячанга
- Сумма чека: 500.000₫ (VND)
- Реферал L1 получает 5% комиссии

**Расчет:**
```
Сумма в VND: 500.000₫
Сумма в USD: 500.000₫ × 0.0000408 = $20.40
Комиссия L1: $20.40 × 5% = $1.02
```

---

## 🔧 ТЕХНИЧЕСКАЯ РЕАЛИЗАЦИЯ

### Шаг 1: Миграция БД

```sql
-- 1. Добавить поле currency в transactions
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';

-- 2. Обновить существующие транзакции (если нужно)
UPDATE transactions 
SET currency = 'USD' 
WHERE currency IS NULL;

-- 3. Создать таблицу курсов валют
CREATE TABLE IF NOT EXISTS currency_exchange_rates (
    id SERIAL PRIMARY KEY,
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL DEFAULT 'USD',
    rate NUMERIC(18, 8) NOT NULL,
    source TEXT DEFAULT 'manual',
    effective_from TIMESTAMP NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(from_currency, to_currency, effective_from)
);

-- 4. Вставить начальные курсы (в направлении к USD)
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from) VALUES
-- VND → USD (1 VND = 0.0000408 USD, т.е. 24,500 VND = 1 USD)
('VND', 'USD', 0.0000408, 'manual', NOW()),
-- RUB → USD (1 RUB = 0.011 USD, т.е. ~91 RUB = 1 USD)
('RUB', 'USD', 0.011, 'manual', NOW()),
-- KZT → USD (1 KZT = 0.0021 USD, т.е. ~476 KZT = 1 USD)
('KZT', 'USD', 0.0021, 'manual', NOW()),
-- KGS → USD (1 KGS = 0.011 USD, т.е. ~91 KGS = 1 USD)
('KGS', 'USD', 0.011, 'manual', NOW()),
-- AED → USD (1 AED = 0.272 USD, т.е. ~3.67 AED = 1 USD)
('AED', 'USD', 0.272, 'manual', NOW())
ON CONFLICT (from_currency, to_currency, effective_from) DO NOTHING;

-- Обратные курсы (USD → другие валюты)
INSERT INTO currency_exchange_rates (from_currency, to_currency, rate, source, effective_from) VALUES
-- USD → VND (1 USD = 24,500 VND)
('USD', 'VND', 24500, 'manual', NOW()),
-- USD → RUB (1 USD = ~91 RUB)
('USD', 'RUB', 91, 'manual', NOW()),
-- USD → KZT (1 USD = ~476 KZT)
('USD', 'KZT', 476, 'manual', NOW()),
-- USD → KGS (1 USD = ~91 KGS)
('USD', 'KGS', 91, 'manual', NOW()),
-- USD → AED (1 USD = ~3.67 AED)
('USD', 'AED', 3.67, 'manual', NOW())
ON CONFLICT DO NOTHING;

-- 5. Создать индексы
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);
CREATE INDEX IF NOT EXISTS idx_currency_rates_lookup 
ON currency_exchange_rates(from_currency, to_currency, effective_from);
```

### Шаг 2: Обновить код

1. ✅ `supabase_manager.py` → `record_transaction()` - сохранять валюту
2. ✅ `currency_utils.py` → добавить функции конвертации
3. ✅ `partner_revenue_share.py` → конвертировать при расчете
4. ✅ `referral_calculator.py` → конвертировать при расчете комиссий

### Шаг 3: Обновить существующие транзакции (миграция данных)

```sql
-- Обновить валюту для существующих транзакций на основе города партнера
UPDATE transactions t
SET currency = (
    SELECT 
        CASE 
            WHEN p.city = 'Nha Trang' THEN 'VND'
            WHEN p.city IN ('Москва', 'Санкт-Петербург', 'Новосибирск', 
                           'Екатеринбург', 'Казань', 'Нижний Новгород') THEN 'RUB'
            WHEN p.city IN ('Almaty', 'Astana', 'Алматы', 'Астана') THEN 'KZT'
            WHEN p.city IN ('Bishkek', 'Osh', 'Бишкек', 'Ош') THEN 'KGS'
            WHEN p.city IN ('Dubai', 'Дубай') THEN 'AED'
            ELSE 'USD'
        END
    FROM partners p
    WHERE p.chat_id = t.partner_chat_id
)
WHERE t.currency IS NULL OR t.currency = 'USD';
```

---

## 💡 РЕКОМЕНДАЦИИ ПО КУРСАМ ВАЛЮТ

### Вариант A: Фиксированные курсы (простой)

**Плюсы:**
- ✅ Простая реализация
- ✅ Предсказуемость

**Минусы:**
- ❌ Нужно обновлять вручную
- ❌ Не учитывает изменения курсов

**Использование:**
- Для начального этапа
- Если изменения курсов не критичны

### Вариант B: Обновление через API (продвинутый)

**Плюсы:**
- ✅ Актуальные курсы
- ✅ Автоматическое обновление

**Минусы:**
- ❌ Зависимость от внешнего API
- ❌ Сложнее реализация

**Примеры API:**
- ExchangeRate-API (https://www.exchangerate-api.com/)
- Fixer.io
- Open Exchange Rates

```python
def update_exchange_rates_from_api():
    """
    Обновляет курсы валют из внешнего API
    """
    try:
        # Пример с ExchangeRate-API
        response = requests.get('https://api.exchangerate-api.com/v4/latest/USD')
        rates = response.json()['rates']
        
        # Обновляем курсы в БД
        for currency, rate in rates.items():
            if currency in ['VND', 'RUB', 'KZT', 'KGS', 'AED']:
                # Сохраняем обратный курс (1 VND = ? USD)
                reverse_rate = 1.0 / rate
                
                supabase_client.table('currency_exchange_rates').insert({
                    'from_currency': currency,
                    'to_currency': 'USD',
                    'rate': reverse_rate,
                    'source': 'api',
                    'effective_from': datetime.now().isoformat()
                }).execute()
                
    except Exception as e:
        logging.error(f"Error updating exchange rates: {e}")
```

---

## 📋 ЧЕКЛИСТ РЕАЛИЗАЦИИ

- [ ] Создать миграцию БД для поля `currency` в `transactions`
- [ ] Создать таблицу `currency_exchange_rates`
- [ ] Добавить начальные курсы валют
- [ ] Обновить `record_transaction()` для сохранения валюты
- [ ] Добавить функции конвертации в `currency_utils.py`
- [ ] Обновить `_get_system_revenue()` с конвертацией
- [ ] Обновить `process_referral_transaction_bonuses()` с конвертацией
- [ ] Обновить существующие транзакции (миграция данных)
- [ ] Протестировать расчеты с разными валютами
- [ ] Документировать процесс обновления курсов

---

## ⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ

1. **Базовая валюта:** Используется USD как базовая валюта для всех расчетов вознаграждений.

2. **Точность:** Использовать `Decimal` для финансовых расчетов вместо `float`.

3. **Исторические курсы:** Хранить курс на момент транзакции для точности исторических расчетов.

4. **Обновление курсов:** Регулярно обновлять курсы (раз в день/неделю).

5. **Округление:** Округлять до 2 знаков после запятой для USD.

---

**Документ создан:** Декабрь 2025  
**Версия:** 1.0  
**Статус:** Готово к реализации

# ТЗ: Tier-gated акции и программа амбассадоров

**Версия:** 1.0  
**Дата:** 2025-02  
**Статус:** К разработке

---

## 1. Цели и контекст

### 1.1 Бизнес-цели

1. **Акции по уровню** — партнёрам выгодно работать с клиентами, у которых выше социальный капитал и платежеспособность. Тир (Bronze, Silver, Gold, Platinum, Diamond) — индикатор качества клиента.
2. **Программа амбассадоров** — активные клиенты (Silver+) получают возможность продвигать партнёров за деньги, платформа и партнёры получают дополнительный канал привлечения.
3. **Монетизация платформы** — явная формула дохода с амбассадоров.

### 1.2 Разделение ролей

См. `docs/ROLES_DEFINITION.md`. Три роли: **Клиент**, **Партнёр-продавец**, **Амбассадор**. Не смешивать.

---

## 2. Функционал 1: Акции по уровню (tier-gated promotions)

### 2.1 Описание

Акция может быть видима или доступна только клиентам с определённым уровнем лояльности и выше.

| Уровень | Порог баллов |
|---------|--------------|
| Bronze | 0 |
| Silver | 500 |
| Gold | 2000 |
| Platinum | 5000 |
| Diamond | 10000 |

### 2.2 Требования

| № | Требование | Описание |
|---|------------|----------|
| T1.1 | Поле `min_tier` у акции | Минимальный тир для доступа. Значения: `bronze`, `silver`, `gold`, `platinum`, `diamond`. По умолчанию `bronze` (всем). |
| T1.2 | Фильтрация на фронте | В списке акций клиенту показывать только те, у которых `min_tier <= client_tier`. |
| T1.3 | Создание акции | При создании акции партнёр (или админ) выбирает «для кого»: все / Silver+ / Gold+ / Platinum+ / Diamond. |
| T1.4 | Отображение | Если акция tier-gated — показывать бейдж «Silver+» / «Gold+» и т.д. |

### 2.3 Схема данных

```sql
-- Добавить в таблицу promotions (или аналог)
ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS min_tier TEXT DEFAULT 'bronze'
  CHECK (min_tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'));

COMMENT ON COLUMN promotions.min_tier IS 'Минимальный тир клиента для доступа к акции';
```

### 2.4 Логика определения тира клиента

Использовать существующую `TIER_LADDER` из `frontend/src/pages/Home.jsx`:

```javascript
// Пороги (баллы)
const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 500,
  gold: 2000,
  platinum: 5000,
  diamond: 10000
};
```

Функция `getClientTier(balance)` возвращает строку `bronze` | `silver` | `gold` | `platinum` | `diamond`.

---

## 3. Функционал 2: Программа амбассадоров

### 3.1 Описание

Клиент с уровнем Silver и выше может подать заявку на роль амбассадора. Амбассадор продвигает выбранных партнёров и получает вознаграждение (% от оборота по своей ссылке).

### 3.2 Возможности по уровням

| Уровень | Порог | Возможности амбассадора |
|---------|-------|-------------------------|
| **Silver** | 500+ | Регистрация амбассадором, выбор до 3 партнёров, кабинет со статистикой, вывод денег |
| **Gold** | 2000+ | До 10 партнёров, «магазин» (лендинг с рекомендованными партнёрами), подключение своих партнёров |
| **Platinum** | 5000+ | Эксклюзивные мероприятия, повышенные ставки (по решению партнёра) |
| **Diamond** | 10000+ | То же + приоритетная поддержка |

### 3.3 Требования

| № | Требование | Описание |
|---|------------|----------|
| T2.1 | Порог входа | Только Silver+ (500+ баллов) может подать заявку на амбассадора. |
| T2.2 | Отдельная сущность | Амбассадор — отдельная таблица `ambassadors`, не `partners`. |
| T2.3 | Выбор партнёров | Silver: до 3, Gold: до 10. Связь через `ambassador_partners`. |
| T2.4 | Кабинет | Статистика: оборот по ссылке, начисления, история выплат. |
| T2.5 | Вывод денег | Амбассадор получает деньги (не баллы). Минимальная сумма вывода, способ перевода — в настройках. |
| T2.6 | «Магазин» (Gold+) | Персональный лендинг/страница с карточками выбранных партнёров. Ссылка вида `app.example.com/shop/{ambassador_code}`. |
| T2.7 | Подключение партнёров (Gold+) | Амбассадор может приглашать партнёров в систему (отдельный флоу, правила модерации). |

### 3.4 Монетизация

**Кто задаёт ставку:** Партнёр-продавец определяет `ambassador_commission_pct` — сколько % от чека он платит за трафик от амбассадоров.

**Распределение:**
```
Фонд = Чек × partner.ambassador_commission_pct
Платформа = Фонд × 30%
Амбассадор = Фонд × 70%
```

**Пример:** Партнёр задал 10%, чек 10 000 ₽ → Фонд 1 000 ₽, платформа 300 ₽, амбассадор 700 ₽.

---

## 4. Схема данных

### 4.1 Таблица `ambassadors`

```sql
CREATE TABLE IF NOT EXISTS ambassadors (
  chat_id TEXT PRIMARY KEY REFERENCES users(chat_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked')),
  tier_at_signup TEXT NOT NULL,  -- silver, gold, platinum, diamond
  max_partners INT NOT NULL DEFAULT 3,  -- 3 для Silver, 10 для Gold+
  ambassador_code TEXT UNIQUE,  -- для ссылки /shop/{code}
  total_earnings NUMERIC DEFAULT 0,
  balance_pending NUMERIC DEFAULT 0,  -- к выплате
  last_payout_at TIMESTAMP
);

CREATE INDEX idx_ambassadors_status ON ambassadors(status);
CREATE INDEX idx_ambassadors_code ON ambassadors(ambassador_code);
```

### 4.2 Таблица `ambassador_partners`

```sql
CREATE TABLE IF NOT EXISTS ambassador_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_chat_id TEXT NOT NULL REFERENCES ambassadors(chat_id) ON DELETE CASCADE,
  partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ambassador_chat_id, partner_chat_id)
);

CREATE INDEX idx_ambassador_partners_ambassador ON ambassador_partners(ambassador_chat_id);
CREATE INDEX idx_ambassador_partners_partner ON ambassador_partners(partner_chat_id);
```

### 4.3 Поле у партнёра: ставка комиссии для амбассадоров

```sql
ALTER TABLE partners
ADD COLUMN IF NOT EXISTS ambassador_commission_pct NUMERIC DEFAULT 0.10;

COMMENT ON COLUMN partners.ambassador_commission_pct IS 'Процент от чека, который партнёр платит за трафик от амбассадоров (0.10 = 10%). Задаёт партнёр.';
```

### 4.4 Таблица начислений амбассадорам

```sql
CREATE TABLE IF NOT EXISTS ambassador_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_chat_id TEXT NOT NULL REFERENCES ambassadors(chat_id),
  partner_chat_id TEXT NOT NULL REFERENCES partners(chat_id),
  transaction_id UUID,  -- ссылка на транзакцию
  check_amount NUMERIC NOT NULL,
  commission_pct NUMERIC NOT NULL,  -- ambassador_commission_pct на момент сделки
  gross_amount NUMERIC NOT NULL,    -- check_amount * commission_pct
  platform_fee NUMERIC NOT NULL,   -- gross * 0.30
  ambassador_amount NUMERIC NOT NULL,  -- gross * 0.70
  created_at TIMESTAMP DEFAULT NOW(),
  payout_id UUID  -- при выплате
);
```

### 4.5 Атрибуция транзакции к амбассадору

При покупке клиента по ссылке амбассадора нужно сохранять `ambassador_chat_id` в транзакции (или в отдельной таблице атрибуции).

```sql
-- В таблице транзакций (или transactions) добавить:
ALTER TABLE transactions  -- или аналог
ADD COLUMN IF NOT EXISTS ambassador_chat_id TEXT REFERENCES ambassadors(chat_id);
```

---

## 5. UI/UX

### 5.1 Клиентское приложение

| Элемент | Описание |
|---------|----------|
| Кнопка «Стать амбассадором» | В Profile или Community. Видна только Silver+. При Bronze — «Достигните Silver (500 баллов), чтобы стать амбассадором». |
| Форма заявки | Выбор до 3 партнёров (Silver) или до 10 (Gold). Подтверждение оферты. |
| Раздел «Мой кабинет амбассадора» | Статистика, баланс, история, кнопка «Вывести». Ссылка на «магазин» (Gold+). |

### 5.2 Партнёрское приложение

| Элемент | Описание |
|---------|----------|
| Настройка `ambassador_commission_pct` | В настройках партнёра: «Комиссия для амбассадоров: X%». Слайдер или ввод 5–15%. |
| Список амбассадоров | Кто продвигает партнёра, сколько привёл обороту. |
| При создании акции | Выбор `min_tier`: все / Silver+ / Gold+ / Platinum+ / Diamond. |

### 5.3 Ссылка амбассадора

Формат: `https://t.me/{bot}?start=amb_{ambassador_code}` или `https://app.example.com?ref=amb_{code}`.

При переходе по ссылке — сохранять `ambassador_code` в сессии/куки клиента. При первой покупке у партнёра из списка амбассадора — атрибутировать транзакцию.

---

## 6. Юридическая схема (справочно)

- Договор с амбассадором: оферта «Участие в программе амбассадоров» или ГПХ при первой выплате.
- НДФЛ: платформа — налоговый агент (удержание 13%/15%) или амбассадор как самозанятый (чек, 4–6%).
- Партнёры не платят амбассадорам напрямую — только через платформу.

---

## 7. Этапы реализации

### Фаза 1 (MVP)

- [ ] Таблица `ambassadors`, `ambassador_partners`
- [ ] Поле `ambassador_commission_pct` у `partners`
- [ ] Поле `min_tier` у акций
- [ ] Форма «Стать амбассадором» (Silver+, выбор до 3 партнёров)
- [ ] Фильтрация акций по тиру на фронте
- [ ] Логика начисления: при покупке по ссылке амбассадора — расчёт и запись в `ambassador_earnings`
- [ ] Простой кабинет: оборот, баланс, история

### Фаза 2

- [ ] «Магазин» амбассадора (Gold+)
- [ ] До 10 партнёров для Gold+
- [ ] Вывод денег (минимальная сумма, способ перевода)

### Фаза 3

- [ ] Подключение партнёров амбассадором (Gold+)
- [ ] Эксклюзивные мероприятия (Platinum/Diamond)
- [ ] Повышенные ставки по тиру (настройка партнёром)

---

## 8. Метрики успеха

| Метрика | Цель |
|---------|------|
| Конверсия Silver+ → амбассадор | > 3% за 3 месяца |
| ARPU на амбассадора | > 1 000 ₽/мес |
| Retention амбассадоров (мес 3) | > 50% |
| Доля оборотов по ссылкам амбассадоров | > 10% от общего |

---

## 9. Связанные документы

- `docs/ROLES_DEFINITION.md` — разделение ролей
- `REFERRAL_COMMISSION_LOGIC_TZ.md` — логика B2B комиссий (аналогия 30/70)
- `CALCULATIONS_AND_MECHANICS.md` — механики кэшбэка и баллов

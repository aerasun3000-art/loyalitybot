# 🔧 Руководство по интеграции MLM системы

**Дата:** Ноябрь 2025  
**Версия:** 1.0

---

## 📋 Шаг 1: Исправить RLS политики

### Выполнить SQL скрипт:

1. Откройте **Supabase Dashboard** → **SQL Editor**
2. Откройте файл `fix_mlm_rls_policies.sql`
3. Скопируйте весь SQL код
4. Вставьте в SQL Editor
5. Нажмите **Run**

Это исправит RLS политики для работы с service role (Telegram боты).

---

## 📋 Шаг 2: Интегрировать команды в партнерский бот

### Добавить в `bot.py` (партнерский бот):

1. **Импортировать модуль** в начале файла:

```python
from partner_revenue_share import PartnerRevenueShare
```

2. **Инициализировать** после создания `sm` (SupabaseManager):

```python
# После строки: sm = SupabaseManager()
revenue_share = PartnerRevenueShare(sm)
```

3. **Добавить команды** - скопируйте функции из `mlm_bot_integration.py`:

```python
# Добавить после существующих команд
from mlm_bot_integration import add_revenue_share_commands

# После инициализации бота
add_revenue_share_commands(bot, sm)
```

Или добавьте функции напрямую в `bot.py` из `mlm_bot_integration.py`.

---

## 📋 Шаг 3: Обновить статистику при транзакциях

### В функции обработки транзакций добавить:

```python
from mlm_bot_integration import update_partner_stats_on_transaction

# После успешной транзакции
update_partner_stats_on_transaction(
    sm=sm,
    partner_chat_id=str(chat_id),
    transaction_amount=amount
)
```

---

## 📋 Шаг 4: Добавить в главное меню партнера

### Обновить функцию `partner_main_menu()`:

Добавить кнопки:
- "💰 Revenue Share" → `/revenue_share`
- "💎 PV уровень" → `/pv`
- "🌐 Реферальная сеть" → `/network`

---

## 📋 Шаг 5: Настроить ежемесячный расчет Revenue Share

### Создать cron job или scheduled task:

```python
from partner_revenue_share import PartnerRevenueShare
from supabase_manager import SupabaseManager
from datetime import date

sm = SupabaseManager()
revenue_share = PartnerRevenueShare(sm)

# Ежемесячно (1-го числа каждого месяца)
period_start = date.today().replace(day=1)
period_end = date.today()

stats = revenue_share.process_revenue_share_for_period(
    period_start=period_start,
    period_end=period_end
)
```

Или использовать систему cron:

```bash
# Добавить в crontab
0 0 1 * * cd /path/to/loyalitybot && python3 -c "from partner_revenue_share import PartnerRevenueShare; from supabase_manager import SupabaseManager; from datetime import date; sm = SupabaseManager(); rs = PartnerRevenueShare(sm); rs.process_revenue_share_for_period(date.today().replace(day=1), date.today())"
```

---

## ✅ Чеклист интеграции

- [ ] RLS политики исправлены (`fix_mlm_rls_policies.sql`)
- [ ] Модуль `partner_revenue_share.py` импортирован
- [ ] Команды Revenue Share добавлены в бот
- [ ] Обновление статистики при транзакциях настроено
- [ ] Кнопки добавлены в главное меню
- [ ] Ежемесячный расчет Revenue Share настроен
- [ ] Тестирование пройдено

---

## 🧪 Тестирование

### Проверить команды:

1. `/revenue_share` - должен показать статус Revenue Share
2. `/pv` - должен показать текущий PV
3. `/network` - должен показать реферальную сеть

### Проверить обновление данных:

1. Создать тестовую транзакцию
2. Проверить обновление `personal_income_monthly`
3. Проверить обновление `client_base_count`
4. Проверить автоматическое обновление PV

---

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи бота
2. Проверьте работу SQL функций
3. Проверьте RLS политики
4. Запустите `check_mlm_database.py` для диагностики

---

**Дата создания:** Ноябрь 2025  
**Версия:** 1.0







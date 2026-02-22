# Техническое задание: Выбор аудитории рассылки партнёра

**Версия:** 1.0  
**Дата:** 19.02.2026  
**Статус:** Реализовано

---

## Реализовано

### Supabase Manager (`supabase_manager.py`)
- `get_partner_client_chat_ids_by_transactions(partner_chat_id, limit=500)` — клиенты по транзакциям
- `get_partner_client_chat_ids_combined(partner_chat_id, limit=500)` — объединённый список без дублей
- `create_broadcast_campaign(..., audience_type=None)` — опциональный параметр для аналитики

### Партнёрский бот (`bot.py`)
- При «📢 Разослать всем моим клиентам» — выбор аудитории:
  - 👥 По реферальной ссылке
  - 🛒 По визитам
  - 📋 Все мои клиенты
- Callback: `invite_broadcast_audience_referral`, `invite_broadcast_audience_transactions`, `invite_broadcast_audience_combined`

### Миграция
- `migrations/add_audience_type_to_broadcast_campaigns.sql` — колонка `audience_type`

### Тесты
- `test_get_partner_client_chat_ids_by_transactions_*`
- `test_get_partner_client_chat_ids_combined_merges_without_duplicates`
- Обновлены callback_data в `test_partner_bot.py`

---

## Применение миграции

```bash
# В Supabase SQL Editor выполнить:
migrations/add_audience_type_to_broadcast_campaigns.sql
```

Миграция опциональна: без неё рассылка работает, но `audience_type` не сохраняется в кампаниях.

# 🔧 Исправление проблемы обновления статуса партнера

## ❌ Проблема

При одобрении партнера в админском боте:
- Запись найдена в базе ✅
- UPDATE запрос выполняется (HTTP 200 OK) ✅
- Но статус не обновляется ❌
- `response.data` пустой ❌

**Причина:** RLS (Row Level Security) политики блокируют UPDATE операцию.

---

## ✅ Решение

### Вариант 1: Использовать service_role ключ (РЕКОМЕНДУЕТСЯ)

Если вы используете `anon` ключ, переключитесь на `service_role` ключ, который обходит RLS.

1. **Проверьте текущий ключ:**
   ```bash
   grep SUPABASE_KEY .env
   ```

2. **Если используется anon ключ:**
   - Откройте Supabase Dashboard
   - Settings → API
   - Скопируйте `service_role` ключ (НЕ anon!)
   - Обновите `.env`:
     ```bash
     SUPABASE_KEY=your_service_role_key_here
     ```

3. **Перезапустите админский бот:**
   ```bash
   pkill -f admin_bot.py
   nohup python3 admin_bot.py > logs/admin_bot.log 2>&1 &
   ```

---

### Вариант 2: Создать RLS политику для UPDATE

Если нужно использовать `anon` ключ, создайте политику:

1. **Откройте Supabase SQL Editor**

2. **Выполните SQL:**
   ```sql
   -- Удалить старые политики UPDATE (если есть)
   DROP POLICY IF EXISTS "Allow update partner_applications" ON partner_applications;
   DROP POLICY IF EXISTS "Enable update for partner_applications" ON partner_applications;
   
   -- Создать политику для обновления (разрешает всем обновлять статус)
   CREATE POLICY "Allow update partner_applications status"
   ON partner_applications
   FOR UPDATE
   TO anon, authenticated, service_role
   USING (true)
   WITH CHECK (true);
   
   -- Проверить политики
   SELECT 
       policyname,
       cmd,
       roles,
       qual,
       with_check
   FROM pg_policies
   WHERE tablename = 'partner_applications';
   ```

3. **Перезапустите админский бот**

---

## 🔍 Проверка

После исправления попробуйте одобрить партнера и проверьте логи:

```bash
tail -f logs/admin_bot.log | grep -E "partner|status|update" -i
```

**Ожидаемый результат:**
```
INFO - Found partner application: {'id': 4, 'chat_id': '6300830308', 'status': 'Pending'}
INFO - Successfully updated partner 6300830308 status to Approved. Response: {'id': 4, 'chat_id': '6300830308', 'status': 'Approved'}
INFO - Update result for partner_id 6300830308: success=True, new_status=Approved
```

---

## 📝 Примечания

- **service_role ключ** обходит все RLS политики - используйте его для ботов
- **anon ключ** требует правильных RLS политик
- После исправления статус должен обновляться корректно










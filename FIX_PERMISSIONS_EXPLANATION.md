# 🔐 Почему слетели права доступа?

## Проблема

После выполнения скрипта `fix_security_policies.sql` были удалены RLS политики для таблиц, которые использует партнерский бот:
- `messages` - сообщения между клиентами и партнерами
- `news` - новости системы
- `partner_network` - сеть партнеров (MLM)
- `partner_revenue_share` - доходы партнеров (MLM)
- `partner_recruitment_commissions` - комиссии за рекрутинг (MLM)
- `partner_activation_conditions` - условия активации (MLM)

## Почему это произошло?

Скрипт `fix_security_policies.sql` удалил излишне разрешительные политики, которые давали доступ **всем пользователям** (включая анонимных). Это было сделано для безопасности.

**НО:** Скрипт предполагал, что бот использует `service_role` ключ, который автоматически обходит RLS. Если же бот использует `anon` ключ (как указано в документации), он теряет доступ к таблицам.

## Решение

### Вариант 1: Восстановить политики для service_role (РЕКОМЕНДУЕТСЯ)

1. **Выполните SQL скрипт:**
   ```sql
   -- Откройте Supabase Dashboard → SQL Editor
   -- Скопируйте и выполните содержимое файла restore_bot_permissions.sql
   ```

2. **Убедитесь, что бот использует service_role ключ:**
   ```bash
   # Проверьте текущий ключ
   grep SUPABASE_KEY .env
   # или на сервере
   flyctl secrets list -a loyalitybot-partner
   ```

3. **Если используется anon ключ, переключите на service_role:**
   - Откройте Supabase Dashboard → Settings → API
   - Скопируйте `service_role` ключ (НЕ anon!)
   - Обновите переменную окружения:
     ```bash
     # Локально
     # Отредактируйте .env файл
     SUPABASE_KEY=your_service_role_key_here
     
     # На Fly.io
     flyctl secrets set SUPABASE_KEY="your_service_role_key" -a loyalitybot-partner
     ```

4. **Перезапустите бота:**
   ```bash
   # Локально
   pkill -f bot.py
   python3 bot.py &
   
   # На Fly.io
   flyctl apps restart loyalitybot-partner
   ```

### Вариант 2: Создать политики для anon роли (менее безопасно)

Если вы хотите продолжать использовать `anon` ключ, раскомментируйте соответствующие строки в файле `restore_bot_permissions.sql`:

```sql
CREATE POLICY "Anon can manage messages" ON messages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage news" ON news FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage network" ON partner_network FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage revenue share" ON partner_revenue_share FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage commissions" ON partner_recruitment_commissions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Anon can manage activation" ON partner_activation_conditions FOR ALL TO anon USING (true) WITH CHECK (true);
```

**⚠️ ВНИМАНИЕ:** Политики для `anon` роли дают доступ **ВСЕМ** анонимным пользователям! Это менее безопасно.

## Проверка

После выполнения скрипта проверьте:

1. **Политики созданы:**
   ```sql
   SELECT tablename, policyname, roles 
   FROM pg_policies 
   WHERE tablename IN ('messages', 'news', 'partner_network', 'partner_revenue_share', 'partner_recruitment_commissions', 'partner_activation_conditions')
   ORDER BY tablename;
   ```

2. **Бот работает:**
   - Откройте партнерский бот в Telegram
   - Попробуйте выполнить операции (начислить баллы, создать акцию и т.д.)
   - Не должно быть ошибок "У вас нет прав для выполнения этой операции"

## Почему service_role лучше?

- ✅ `service_role` ключ автоматически обходит RLS (не нужны политики)
- ✅ Более безопасно - ключ не должен попадать в клиентский код
- ✅ Рекомендуется Supabase для бэкенд-приложений (боты, API)

## Дополнительная информация

- Файл с решением: `restore_bot_permissions.sql`
- Оригинальный скрипт безопасности: `fix_security_policies.sql`
- Документация Supabase RLS: https://supabase.com/docs/guides/auth/row-level-security

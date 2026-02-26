# ТЗ: Список приглашённых рефералов

**Версия:** 1.0  
**Дата:** 2025-02  
**Статус:** К разработке

---

## 1. Цели и контекст

### 1.1 Проблема

Реферер (клиент или партнёр) не может увидеть, **кто именно** зарегистрировался по его реферальной ссылке. Сейчас доступны только:
- агрегированная статистика (количество, заработанные баллы);
- уведомление в Telegram при новой регистрации (без имени приглашённого).

### 1.2 Цель

Дать рефереру возможность просматривать список приглашённых пользователей с именами и датами регистрации.

### 1.3 Охват

| Роль реферера | Источник данных | Где показывать |
|---------------|-----------------|----------------|
| **Клиент** (ссылка `ref_`) | `referral_tree` + `users` | Страница «Сообщество» (Community) |
| **Партнёр** (ссылка `partner_`) | `users.referral_source` | Партнёрская аналитика / отдельный раздел |

---

## 2. Текущее состояние

### 2.1 База данных

**Провайдер:** Supabase (PostgreSQL)  
**URL:** `https://gynpvfchojnyoirosysj.supabase.co`

**Таблицы:**

| Таблица | Ключевые поля |
|---------|---------------|
| `referral_tree` | `referrer_chat_id`, `referred_chat_id`, `level`, `registered_at`, `is_active`, `total_earned_points`, `total_transactions` |
| `users` | `chat_id`, `name`, `referral_code`, `reg_date`, `referral_source`, `referred_by_chat_id` |
| `referral_rewards` | `referrer_chat_id`, `referred_chat_id`, `points`, `description`, `created_at` |

### 2.2 Существующий код

- `frontend/src/services/supabase.js` — `getReferralStats()` уже возвращает `referrals_list` из `referral_tree`, но без имён.
- `frontend/src/pages/Community.jsx` — страница «Сообщество», `referrals_list` не отображается.
- Партнёры: `users?referral_source=eq.partner_${partnerChatId}` — данные есть, отдельного UI нет.

---

## 3. Требования

### 3.1 Клиент-реферер (страница «Сообщество»)

| № | Требование | Описание |
|---|------------|----------|
| T1.1 | Список приглашённых | Показывать список рефералов с: имя, дата регистрации, уровень (1/2/3), заработано баллов. |
| T1.2 | Источник данных | `referral_tree` + джойн с `users` по `referred_chat_id` для получения `name`. (Уровни 1–3: прямые и косвенные рефералы.) |
| T1.3 | Сортировка | По дате регистрации (новые сверху). |
| T1.4 | Пустое состояние | Если рефералов нет — не показывать блок или показать «Пока никого не пригласили». |
| T1.5 | Локализация | RU/EN через `i18n.js`. |

### 3.2 Партнёр-реферер (опционально, фаза 2)

| № | Требование | Описание |
|---|------------|----------|
| T2.1 | Список клиентов по ссылке | Показывать клиентов с `referral_source = 'partner_${partnerChatId}'`. |
| T2.2 | Где показывать | PartnerAnalytics или отдельный раздел «Клиенты по реферальной ссылке». |
| T2.3 | Поля | Имя, дата регистрации, телефон (если есть). |

### 3.3 Ограничения и приватность

| № | Требование | Описание |
|---|------------|----------|
| T3.1 | Только свои данные | Реферер видит только своих приглашённых. RLS в Supabase уже ограничивает доступ. |
| T3.2 | Минимальный набор полей | Имя, дата — достаточно. Не показывать chat_id, телефон без необходимости. |

---

## 4. Техническая реализация

### 4.1 Изменения в `getReferralStats` (frontend/src/services/supabase.js)

**Текущий запрос:**
```javascript
const { data: referrals } = await supabase
  .from('referral_tree')
  .select('referred_chat_id, level, registered_at, is_active, total_earned_points, total_transactions')
  .eq('referrer_chat_id', chatId)
  .order('registered_at', { ascending: false })
```

**Дополнительно:** после получения `referrals` — batch-запрос к `users` по `referred_chat_id` для получения `name`:

```javascript
const referredIds = [...new Set((referrals || []).map(r => r.referred_chat_id).filter(Boolean))];
let namesMap = {};
if (referredIds.length > 0) {
  const { data: usersData } = await supabase
    .from('users')
    .select('chat_id, name')
    .in('chat_id', referredIds);
  namesMap = (usersData || []).reduce((acc, u) => {
    acc[u.chat_id] = u.name || '—';
    return acc;
  }, {});
}
const referralsWithNames = (referrals || []).map(r => ({
  ...r,
  referred_name: namesMap[r.referred_chat_id] || '—'
}));
```

**Возврат:** `referrals_list: referralsWithNames` вместо `referrals`.

### 4.2 Изменения в Community.jsx

**Место:** после блока «Последние награды» (строка ~346).

**Новый блок:**
- Заголовок «Приглашённые друзья» / «Invited Friends».
- Список карточек: `referred_name`, дата (`registered_at`), уровень (если > 1), `total_earned_points`.
- Иконка `Users` из lucide-react (уже импортирована).
- Стили в духе существующих блоков (rounded-2xl, var(--tg-theme-*)).

### 4.3 Переводы (frontend/src/utils/i18n.js)

| Ключ | RU | EN |
|------|----|----|
| `referral_list_title` | Приглашённые друзья | Invited Friends |
| `referral_list_empty` | Пока никого не пригласили | No one invited yet |
| `referral_level_short` | Уровень {n} | Level {n} |
| `referral_earned_points` | +{n} баллов | +{n} pts |

---

## 5. Файлы для изменения

| Файл | Изменения |
|------|-----------|
| `frontend/src/services/supabase.js` | Расширить `getReferralStats`: batch-запрос к `users`, обогащение `referrals_list` полем `referred_name`. |
| `frontend/src/pages/Community.jsx` | Добавить блок «Список приглашённых» с отображением `referrals_list`. |
| `frontend/src/utils/i18n.js` | Добавить ключи `referral_list_title`, `referral_list_empty`, `referral_level_short`, `referral_earned_points` (RU + EN). |

---

## 6. Критерии приёмки

- [ ] Клиент видит список приглашённых на странице «Сообщество».
- [ ] В списке отображаются: имя, дата регистрации, уровень (если не 1), заработано баллов.
- [ ] При отсутствии рефералов показывается пустое состояние или блок не отображается.
- [ ] Работает на RU и EN.
- [ ] Нет лишних запросов (batch для имён — один дополнительный запрос на загрузку страницы).

---

## 7. Риски и ограничения

- **Supabase RLS:** Убедиться, что анонный ключ позволяет читать `users.name` для `chat_id` из `referral_tree`. При необходимости — проверить политики.
- **Партнёры (фаза 2):** Отдельная задача; в первой фазе — только клиенты.

---

## 8. Зависимости

- Существующая структура `referral_tree`, `users`.
- Страница Community уже загружает `getReferralStats`.
- Нет миграций БД — используются существующие таблицы и поля.

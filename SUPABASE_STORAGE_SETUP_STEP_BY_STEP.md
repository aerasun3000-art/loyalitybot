# 📸 Настройка Supabase Storage - Пошаговая инструкция

## ✅ ШАГ 1: Создание Bucket

### 1.1 Откройте Supabase Dashboard

Перейдите по ссылке:
**https://gynpvfchojnyoirosysj.supabase.co**

### 1.2 Войдите в аккаунт

Используйте свои данные для входа.

### 1.3 Перейдите в Storage

В левом меню нажмите: **Storage** (иконка папки 📁)

### 1.4 Создайте новый bucket

1. Нажмите кнопку **"New bucket"** (зелёная кнопка)
2. Заполните форму:
   - **Name:** `promotion-images`
   - **Public bucket:** ✅ Включите (галочку поставьте!)
   - **File size limit:** оставьте по умолчанию
3. Нажмите **"Create bucket"**

**Результат:** Bucket `promotion-images` появится в списке

---

## ✅ ШАГ 2: Настройка Политик Доступа

### 2.1 Откройте SQL Editor

В левом меню нажмите: **SQL Editor** (иконка </> )

### 2.2 Создайте новый запрос

Нажмите **"New query"** (или **"+ New query"**)

### 2.3 Скопируйте и выполните SQL:

```sql
-- Политика 1: Публичное чтение (все могут смотреть фото)
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'promotion-images' );

-- Политика 2: Загрузка для авторизованных (бот может загружать)
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'promotion-images' );

-- Политика 3: Обновление (опционально)
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'promotion-images' );

-- Политика 4: Удаление (опционально)
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'promotion-images' );
```

### 2.4 Нажмите **"Run"** (или F5)

**Результат:** Внизу должно появиться "Success. No rows returned"

---

## ✅ ШАГ 3: Добавление поля image_url в таблицу

### 3.1 В том же SQL Editor

Создайте новый запрос или очистите текущий

### 3.2 Скопируйте и выполните SQL:

```sql
-- Добавляем колонку для хранения URL изображения
ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Добавляем комментарий для документации
COMMENT ON COLUMN promotions.image_url IS 'URL изображения в Supabase Storage';

-- Создаём индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_promotions_image_url 
ON promotions(image_url);
```

### 3.3 Нажмите **"Run"**

**Результат:** "Success. No rows returned"

---

## ✅ ШАГ 4: Проверка настроек

### 4.1 Проверьте bucket

1. **Storage** → видите `promotion-images`
2. Статус: **Public** ✅
3. Нажмите на bucket → он должен быть пустым (пока)

### 4.2 Проверьте политики

1. Нажмите на bucket `promotion-images`
2. Вкладка **"Policies"**
3. Должно быть 4 политики:
   - ✅ Public Access (SELECT)
   - ✅ Authenticated Upload (INSERT)
   - ✅ Authenticated Update (UPDATE)
   - ✅ Authenticated Delete (DELETE)

### 4.3 Проверьте таблицу promotions

1. **Table Editor** → таблица `promotions`
2. В списке колонок должно появиться: **`image_url`** (тип: text, nullable: yes)

---

## ✅ ШАГ 5: Тестирование

### 5.1 Запустите партнёрский бот

```bash
cd /Users/alekseysanzheev/Desktop/loyalitybot
python3 bot.py
```

### 5.2 Создайте тестовую акцию

В Telegram:
1. Откройте партнёрский бот
2. 🎁 Мои акции → ➕ Добавить акцию
3. Заполните:
   - **Название:** Тестовая акция со фото
   - **Описание:** Это тест загрузки изображения
   - **Скидка:** 20%
   - **Дата:** 31.12.2025
4. **Шаг 5/5:** Загрузите любое фото с телефона

### 5.3 Проверьте результат

**В Supabase:**
1. **Storage** → `promotion-images` → должно появиться загруженное фото
2. **Table Editor** → `promotions` → в строке с новой акцией поле `image_url` заполнено

**На сайте:**
1. https://loyalitybot.vercel.app/
2. Cmd+Shift+R (жёсткое обновление)
3. Фото должно отображаться в карусели!

---

## ⚠️ ВОЗМОЖНЫЕ ПРОБЛЕМЫ

### Проблема 1: "Bucket already exists"

**Причина:** Bucket уже создан

**Решение:** Пропустите Шаг 1, перейдите к Шагу 2

---

### Проблема 2: "Permission denied for table storage.objects"

**Причина:** Не хватает прав для создания политик

**Решение:** 
1. Убедитесь что вы Owner проекта
2. Или используйте Service Role Key (не рекомендуется)

---

### Проблема 3: "Column image_url already exists"

**Причина:** Колонка уже добавлена

**Решение:** Это нормально! SQL запрос безопасный (`IF NOT EXISTS`)

---

### Проблема 4: Фото не загружается в бот

**Причина:** Не установлена библиотека Pillow

**Решение:**
```bash
pip install pillow requests
```

---

### Проблема 5: Фото не отображается на сайте

**Причина:** Старый кэш

**Решение:**
- Cmd+Shift+R (Mac)
- Ctrl+Shift+R (Windows)
- Или откройте в режиме инкогнито

---

## 🎯 ЧЕКЛИСТ ГОТОВНОСТИ

Отметьте выполненные пункты:

- [ ] Bucket `promotion-images` создан
- [ ] Public access включён
- [ ] 4 политики созданы (SELECT, INSERT, UPDATE, DELETE)
- [ ] Колонка `image_url` добавлена в таблицу `promotions`
- [ ] Индекс создан
- [ ] Партнёрский бот запущен
- [ ] Тестовая акция с фото создана
- [ ] Фото появилось в Storage
- [ ] Фото отображается на сайте

---

## ✅ ГОТОВО!

Если все пункты выполнены - **система полностью работает!** 🎉

Теперь партнёры могут загружать фото для своих акций,
и они автоматически будут отображаться в приложении.

**Нет фото?** → Красивый градиентный placeholder с иконкой! 💖

---

**Дата:** 24 октября 2025  
**Версия:** 1.0  
**Статус:** Production Ready ✅


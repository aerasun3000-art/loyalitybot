# 📸 Настройка хранения изображений

## 🎯 ПЛАН:
1. Создать Storage bucket в Supabase
2. Добавить поле image_url в таблицу promotions
3. Обновить партнёрский бот для загрузки фото
4. Обновить frontend для отображения фото

---

## 📋 ШАГ 1: Создание Storage Bucket в Supabase

### 1.1 Откройте Supabase Dashboard
https://gynpvfchojnyoirosysj.supabase.co

### 1.2 Перейдите в Storage
Слева меню → **Storage**

### 1.3 Создайте новый bucket
- Нажмите **"New bucket"**
- Name: **`promotion-images`**
- Public bucket: **✓** (включите для публичного доступа)
- Нажмите **"Create bucket"**

### 1.4 Настройте политики доступа (Policies)

Выберите bucket `promotion-images` → **Policies** → **New Policy**

**Policy 1: Public Read (для всех)**
```sql
-- Все могут читать изображения
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'promotion-images' );
```

**Policy 2: Authenticated Upload (для загрузки)**
```sql
-- Авторизованные пользователи могут загружать
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'promotion-images' );
```

**Policy 3: Authenticated Update**
```sql
-- Авторизованные пользователи могут обновлять свои файлы
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'promotion-images' );
```

---

## 📋 ШАГ 2: Обновление схемы БД

### 2.1 Добавьте поле image_url в таблицу promotions

В **SQL Editor** выполните:

```sql
-- Добавляем колонку для URL изображения
ALTER TABLE promotions
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Добавляем индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_promotions_image_url 
ON promotions(image_url);
```

---

## 📋 ШАГ 3: Установка библиотек для работы с изображениями

В терминале:

```bash
cd /Users/alekseysanzheev/Desktop/loyalitybot
pip install pillow python-magic-bin
```

---

## ✅ ГОТОВО!

После этого:
1. ✅ Bucket создан
2. ✅ Политики доступа настроены
3. ✅ Поле image_url добавлено
4. ✅ Библиотеки установлены

Переходим к обновлению бота!


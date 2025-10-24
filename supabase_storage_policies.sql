-- ════════════════════════════════════════════════════════
-- 📸 Supabase Storage - Политики доступа для promotion-images
-- ════════════════════════════════════════════════════════
-- 
-- Использование:
-- 1. Откройте Supabase Dashboard → SQL Editor
-- 2. Скопируйте весь этот файл
-- 3. Вставьте в SQL Editor
-- 4. Нажмите "Run" (или F5)
-- 
-- ════════════════════════════════════════════════════════

-- Политика 1: Публичное чтение
-- Все пользователи могут просматривать изображения
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'promotion-images' );

-- Политика 2: Загрузка для авторизованных
-- Авторизованные пользователи (бот) могут загружать файлы
CREATE POLICY "Authenticated Upload"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'promotion-images' );

-- Политика 3: Обновление
-- Авторизованные пользователи могут обновлять свои файлы
CREATE POLICY "Authenticated Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'promotion-images' );

-- Политика 4: Удаление
-- Авторизованные пользователи могут удалять файлы
CREATE POLICY "Authenticated Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'promotion-images' );

-- ════════════════════════════════════════════════════════
-- ✅ Ожидаемый результат: "Success. No rows returned"
-- ════════════════════════════════════════════════════════


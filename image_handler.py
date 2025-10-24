# image_handler.py - Обработка изображений и загрузка в Supabase Storage

import os
import uuid
import requests
from io import BytesIO
from PIL import Image
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

# Supabase credentials
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

# Инициализация Supabase клиента
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Настройки
BUCKET_NAME = 'promotion-images'
MAX_IMAGE_SIZE_MB = 5
ALLOWED_FORMATS = ['JPEG', 'PNG', 'WEBP']
OPTIMIZED_WIDTH = 1200  # Максимальная ширина изображения


class ImageHandler:
    """Класс для работы с изображениями и Supabase Storage"""
    
    @staticmethod
    def validate_image(image_data: bytes) -> tuple[bool, str]:
        """
        Валидация изображения
        Returns: (is_valid, error_message)
        """
        try:
            # Проверка размера
            size_mb = len(image_data) / (1024 * 1024)
            if size_mb > MAX_IMAGE_SIZE_MB:
                return False, f"Изображение слишком большое ({size_mb:.1f}MB). Максимум {MAX_IMAGE_SIZE_MB}MB"
            
            # Проверка формата
            img = Image.open(BytesIO(image_data))
            if img.format not in ALLOWED_FORMATS:
                return False, f"Неподдерживаемый формат ({img.format}). Разрешены: {', '.join(ALLOWED_FORMATS)}"
            
            return True, "OK"
        
        except Exception as e:
            return False, f"Ошибка при проверке изображения: {str(e)}"
    
    @staticmethod
    def optimize_image(image_data: bytes) -> bytes:
        """
        Оптимизация изображения:
        - Изменение размера если больше OPTIMIZED_WIDTH
        - Конвертация в JPEG для уменьшения размера
        - Сжатие с quality=85
        """
        try:
            img = Image.open(BytesIO(image_data))
            
            # Конвертируем в RGB если RGBA (для JPEG)
            if img.mode in ('RGBA', 'LA', 'P'):
                # Создаём белый фон
                background = Image.new('RGB', img.size, (255, 255, 255))
                if img.mode == 'P':
                    img = img.convert('RGBA')
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Изменяем размер если слишком большое
            if img.width > OPTIMIZED_WIDTH:
                # Вычисляем новую высоту с сохранением пропорций
                ratio = OPTIMIZED_WIDTH / img.width
                new_height = int(img.height * ratio)
                img = img.resize((OPTIMIZED_WIDTH, new_height), Image.Resampling.LANCZOS)
            
            # Сохраняем в буфер с оптимизацией
            buffer = BytesIO()
            img.save(buffer, format='JPEG', quality=85, optimize=True)
            buffer.seek(0)
            
            return buffer.read()
        
        except Exception as e:
            print(f"Error optimizing image: {e}")
            # Если оптимизация не удалась, возвращаем оригинал
            return image_data
    
    @staticmethod
    def upload_to_supabase(image_data: bytes, filename: str = None) -> tuple[bool, str]:
        """
        Загрузка изображения в Supabase Storage
        Returns: (success, url_or_error)
        """
        try:
            # Генерируем уникальное имя файла
            if not filename:
                filename = f"{uuid.uuid4()}.jpg"
            else:
                # Убеждаемся что расширение .jpg
                filename = f"{uuid.uuid4()}_{filename.split('.')[0]}.jpg"
            
            # Загружаем в Supabase Storage
            response = supabase.storage.from_(BUCKET_NAME).upload(
                path=filename,
                file=image_data,
                file_options={"content-type": "image/jpeg"}
            )
            
            # Получаем публичный URL
            public_url = supabase.storage.from_(BUCKET_NAME).get_public_url(filename)
            
            return True, public_url
        
        except Exception as e:
            error_msg = str(e)
            print(f"Error uploading to Supabase: {error_msg}")
            return False, f"Ошибка загрузки: {error_msg}"
    
    @staticmethod
    def download_from_telegram(file_id: str, bot_token: str) -> bytes:
        """
        Скачивание файла из Telegram
        """
        try:
            # Получаем информацию о файле
            file_info_url = f"https://api.telegram.org/bot{bot_token}/getFile?file_id={file_id}"
            file_info_response = requests.get(file_info_url, timeout=30)
            file_info = file_info_response.json()
            
            if not file_info.get('ok'):
                raise Exception(f"Telegram API error: {file_info.get('description')}")
            
            file_path = file_info['result']['file_path']
            
            # Скачиваем файл
            file_url = f"https://api.telegram.org/file/bot{bot_token}/{file_path}"
            file_response = requests.get(file_url, timeout=60)
            
            return file_response.content
        
        except Exception as e:
            print(f"Error downloading from Telegram: {e}")
            raise
    
    @staticmethod
    def process_telegram_photo(file_id: str, bot_token: str) -> tuple[bool, str]:
        """
        Полный процесс обработки фото из Telegram:
        1. Скачивание
        2. Валидация
        3. Оптимизация
        4. Загрузка в Supabase
        
        Returns: (success, url_or_error)
        """
        try:
            # Скачиваем фото из Telegram
            print(f"Downloading photo {file_id}...")
            image_data = ImageHandler.download_from_telegram(file_id, bot_token)
            
            # Валидация
            print("Validating image...")
            is_valid, validation_msg = ImageHandler.validate_image(image_data)
            if not is_valid:
                return False, validation_msg
            
            # Оптимизация
            print("Optimizing image...")
            optimized_data = ImageHandler.optimize_image(image_data)
            
            # Загрузка в Supabase
            print("Uploading to Supabase...")
            success, result = ImageHandler.upload_to_supabase(optimized_data)
            
            if success:
                print(f"Image uploaded successfully: {result}")
            else:
                print(f"Upload failed: {result}")
            
            return success, result
        
        except Exception as e:
            error_msg = f"Ошибка обработки изображения: {str(e)}"
            print(error_msg)
            return False, error_msg
    
    @staticmethod
    def delete_from_supabase(image_url: str) -> bool:
        """
        Удаление изображения из Supabase Storage по URL
        """
        try:
            # Извлекаем filename из URL
            # URL формата: https://...supabase.co/storage/v1/object/public/promotion-images/filename.jpg
            filename = image_url.split('/')[-1]
            
            # Удаляем из storage
            supabase.storage.from_(BUCKET_NAME).remove([filename])
            
            print(f"Image {filename} deleted successfully")
            return True
        
        except Exception as e:
            print(f"Error deleting image: {e}")
            return False


# Вспомогательная функция для использования в боте
def process_photo_for_promotion(file_id: str, bot_token: str) -> tuple[bool, str]:
    """
    Простая обёртка для использования в партнёрском боте
    """
    return ImageHandler.process_telegram_photo(file_id, bot_token)


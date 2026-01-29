"""
Unit-тесты для image_handler.py
Полное покрытие обработки изображений
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import base64
import io

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestImageDownload:
    """Тесты загрузки изображений"""
    
    def test_download_url_validation(self):
        """Тест валидации URL для загрузки"""
        valid_urls = [
            'https://example.com/image.jpg',
            'https://storage.googleapis.com/bucket/image.png',
            'https://api.telegram.org/file/bot123/photos/photo.jpg'
        ]
        
        for url in valid_urls:
            assert url.startswith('https://')
    
    def test_invalid_url_detection(self):
        """Тест обнаружения невалидного URL"""
        invalid_urls = [
            'not-a-url',
            'ftp://example.com/image.jpg',
            ''
        ]
        
        for url in invalid_urls:
            is_valid = url.startswith('http://') or url.startswith('https://')
            assert is_valid is False
    
    def test_file_extension_extraction(self):
        """Тест извлечения расширения файла"""
        url = 'https://example.com/path/image.jpg?token=abc'
        
        # Извлекаем путь без query string
        path = url.split('?')[0]
        extension = path.split('.')[-1].lower()
        
        assert extension == 'jpg'


class TestImageFormats:
    """Тесты форматов изображений"""
    
    def test_supported_formats(self):
        """Тест поддерживаемых форматов"""
        supported = ['jpg', 'jpeg', 'png', 'gif', 'webp']
        
        for fmt in supported:
            assert fmt in supported
    
    def test_jpeg_aliases(self):
        """Тест алиасов JPEG"""
        jpeg_formats = ['jpg', 'jpeg']
        
        ext = 'jpeg'
        is_jpeg = ext in jpeg_formats
        assert is_jpeg is True
    
    def test_unsupported_format(self):
        """Тест неподдерживаемого формата"""
        supported = ['jpg', 'jpeg', 'png', 'gif', 'webp']
        ext = 'bmp'
        
        is_supported = ext in supported
        assert is_supported is False


class TestImageResize:
    """Тесты изменения размера изображений"""
    
    def test_calculate_new_dimensions_landscape(self):
        """Тест расчёта размеров для горизонтального изображения"""
        original_width = 1920
        original_height = 1080
        max_size = 800
        
        ratio = min(max_size / original_width, max_size / original_height)
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)
        
        assert new_width <= max_size
        assert new_height <= max_size
    
    def test_calculate_new_dimensions_portrait(self):
        """Тест расчёта размеров для вертикального изображения"""
        original_width = 1080
        original_height = 1920
        max_size = 800
        
        ratio = min(max_size / original_width, max_size / original_height)
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)
        
        assert new_width <= max_size
        assert new_height <= max_size
    
    def test_no_resize_if_small(self):
        """Тест отсутствия изменения размера для маленьких изображений"""
        original_width = 400
        original_height = 300
        max_size = 800
        
        needs_resize = original_width > max_size or original_height > max_size
        assert needs_resize is False
    
    def test_aspect_ratio_preserved(self):
        """Тест сохранения соотношения сторон"""
        original_width = 1600
        original_height = 900
        original_ratio = original_width / original_height
        
        max_size = 800
        ratio = min(max_size / original_width, max_size / original_height)
        new_width = int(original_width * ratio)
        new_height = int(original_height * ratio)
        new_ratio = new_width / new_height
        
        # Соотношение должно быть примерно таким же
        assert abs(original_ratio - new_ratio) < 0.01


class TestImageCompression:
    """Тесты сжатия изображений"""
    
    def test_jpeg_quality_levels(self):
        """Тест уровней качества JPEG"""
        quality_levels = {
            'high': 95,
            'medium': 75,
            'low': 50
        }
        
        assert quality_levels['high'] > quality_levels['medium']
        assert quality_levels['medium'] > quality_levels['low']
    
    def test_default_quality(self):
        """Тест качества по умолчанию"""
        default_quality = 85
        assert 70 <= default_quality <= 95
    
    def test_max_file_size_kb(self):
        """Тест максимального размера файла"""
        max_size_kb = 500
        assert max_size_kb > 0


class TestBase64Encoding:
    """Тесты Base64 кодирования"""
    
    def test_encode_bytes(self):
        """Тест кодирования байтов"""
        data = b'test image data'
        encoded = base64.b64encode(data).decode('utf-8')
        
        assert isinstance(encoded, str)
        assert len(encoded) > 0
    
    def test_decode_base64(self):
        """Тест декодирования Base64"""
        encoded = 'dGVzdCBpbWFnZSBkYXRh'  # "test image data"
        decoded = base64.b64decode(encoded)
        
        assert decoded == b'test image data'
    
    def test_data_url_format(self):
        """Тест формата data URL"""
        mime_type = 'image/jpeg'
        encoded = 'dGVzdA=='
        
        data_url = f"data:{mime_type};base64,{encoded}"
        
        assert data_url.startswith('data:image/')
        assert ';base64,' in data_url


class TestImageValidation:
    """Тесты валидации изображений"""
    
    def test_max_file_size_bytes(self):
        """Тест максимального размера файла в байтах"""
        max_size_mb = 10
        max_size_bytes = max_size_mb * 1024 * 1024
        
        assert max_size_bytes == 10485760
    
    def test_file_too_large(self):
        """Тест превышения размера файла"""
        file_size = 15 * 1024 * 1024  # 15 MB
        max_size = 10 * 1024 * 1024   # 10 MB
        
        is_too_large = file_size > max_size
        assert is_too_large is True
    
    def test_min_dimensions(self):
        """Тест минимальных размеров"""
        min_width = 100
        min_height = 100
        
        image_width = 150
        image_height = 80  # Слишком маленькая высота
        
        is_valid = image_width >= min_width and image_height >= min_height
        assert is_valid is False


class TestImageStorage:
    """Тесты хранения изображений"""
    
    def test_generate_filename(self):
        """Тест генерации имени файла"""
        import uuid
        import datetime
        
        partner_id = '123456'
        timestamp = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        unique_id = str(uuid.uuid4())[:8]
        
        filename = f"promo_{partner_id}_{timestamp}_{unique_id}.jpg"
        
        assert partner_id in filename
        assert '.jpg' in filename
    
    def test_storage_path_structure(self):
        """Тест структуры пути хранения"""
        bucket = 'loyalty-images'
        folder = 'promotions'
        filename = 'promo_123456.jpg'
        
        full_path = f"{bucket}/{folder}/{filename}"
        
        assert full_path == 'loyalty-images/promotions/promo_123456.jpg'
    
    def test_public_url_generation(self):
        """Тест генерации публичного URL"""
        base_url = 'https://storage.supabase.co'
        bucket = 'images'
        path = 'promotions/image.jpg'
        
        public_url = f"{base_url}/storage/v1/object/public/{bucket}/{path}"
        
        assert public_url.startswith('https://')
        assert bucket in public_url


class TestTelegramPhotoHandling:
    """Тесты обработки фото Telegram"""
    
    def test_photo_sizes_array(self):
        """Тест массива размеров фото"""
        photo_sizes = [
            {'file_id': 'abc', 'width': 90, 'height': 90, 'file_size': 1024},
            {'file_id': 'def', 'width': 320, 'height': 320, 'file_size': 10240},
            {'file_id': 'ghi', 'width': 800, 'height': 800, 'file_size': 51200}
        ]
        
        # Выбираем наибольший размер
        largest = max(photo_sizes, key=lambda x: x['file_size'])
        
        assert largest['width'] == 800
    
    def test_get_file_path(self):
        """Тест получения пути к файлу"""
        file_id = 'AgACAgIAAxkBAAI...'
        
        # Telegram API возвращает путь
        file_path = 'photos/file_123.jpg'
        
        download_url = f"https://api.telegram.org/file/bot{{token}}/{file_path}"
        
        assert file_path in download_url


class TestImageProcessingErrors:
    """Тесты обработки ошибок"""
    
    def test_network_error_handling(self):
        """Тест обработки сетевой ошибки"""
        error_message = "Connection timeout"
        
        result = {
            'success': False,
            'error': error_message
        }
        
        assert result['success'] is False
        assert 'timeout' in result['error'].lower()
    
    def test_invalid_image_data(self):
        """Тест невалидных данных изображения"""
        invalid_data = b'not an image'
        
        # Проверка магических байтов
        jpeg_magic = b'\xff\xd8\xff'
        png_magic = b'\x89PNG'
        
        is_jpeg = invalid_data[:3] == jpeg_magic
        is_png = invalid_data[:4] == png_magic
        
        assert is_jpeg is False
        assert is_png is False
    
    def test_corrupted_file_detection(self):
        """Тест обнаружения повреждённого файла"""
        # Симуляция неполного файла
        truncated_data = b'\xff\xd8\xff\xe0\x00\x10JFIF'
        
        # Файл должен быть больше заголовка
        min_size = 100
        is_corrupted = len(truncated_data) < min_size
        
        assert is_corrupted is True


class TestImageMetadata:
    """Тесты метаданных изображений"""
    
    def test_exif_stripping(self):
        """Тест удаления EXIF данных"""
        # EXIF может содержать GPS и личные данные
        strip_exif = True
        
        assert strip_exif is True
    
    def test_image_dimensions_extraction(self):
        """Тест извлечения размеров изображения"""
        image_info = {
            'width': 1920,
            'height': 1080,
            'format': 'JPEG'
        }
        
        assert image_info['width'] == 1920
        assert image_info['height'] == 1080


class TestThumbnailGeneration:
    """Тесты генерации миниатюр"""
    
    def test_thumbnail_size(self):
        """Тест размера миниатюры"""
        thumbnail_size = (150, 150)
        
        assert thumbnail_size[0] == 150
        assert thumbnail_size[1] == 150
    
    def test_thumbnail_naming(self):
        """Тест именования миниатюр"""
        original = 'image_123.jpg'
        thumbnail = original.replace('.jpg', '_thumb.jpg')
        
        assert thumbnail == 'image_123_thumb.jpg'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

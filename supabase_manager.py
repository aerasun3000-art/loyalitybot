    def create_news(self, news_data: dict) -> tuple[bool, Optional[int]]:
        """
        Создает новую новость.
        
        Args:
            news_data: Словарь с данными новости
                - title (str): Заголовок новости
                - content (str): Полный текст новости
                - preview_text (str, optional): Краткое описание
                - image_url (str, optional): URL изображения
                - author_chat_id (str): ID администратора
                - is_published (bool, optional): Опубликована ли новость (по умолчанию True)
        
        Returns:
            tuple[bool, Optional[int]]: (успех операции, ID созданной новости)
        """
        if not self.client:
            return False, None
        
        try:
            # Валидация обязательных полей
            if not news_data.get('title') or not news_data.get('content'):
                logging.error("create_news: missing required fields (title or content)")
                return False, None
            
            # Подготовка данных для вставки
            record = {
                'title': news_data['title'],
                'content': news_data['content'],
                'preview_text': news_data.get('preview_text', news_data['content'][:200]),
                'author_chat_id': str(news_data.get('author_chat_id', '')),
                'is_published': news_data.get('is_published', True),
                'created_at': datetime.datetime.now().isoformat(),
                'updated_at': datetime.datetime.now().isoformat()
            }
            
            # Добавляем image_url если есть
            if news_data.get('image_url'):
                record['image_url'] = news_data['image_url']
            
            # Добавляем предзаполненные переводы, если они были сгенерированы на уровне админ-бота
            if news_data.get('title_en'):
                record['title_en'] = news_data['title_en']
            if news_data.get('preview_text_en'):
                record['preview_text_en'] = news_data['preview_text_en']
            if news_data.get('content_en'):
                record['content_en'] = news_data['content_en']
            
            try:
                # Попытка вставки с переводами
                result = self.client.from_('news').insert(record).execute()
            except Exception as e:
                # Если ошибка (вероятно нет колонок _en), пробуем вставить БЕЗ переводов
                logging.warning(f"Failed to insert news with translations (columns might be missing). Retrying without translations. Error: {e}")
                
                # Удаляем поля переводов и пробуем снова
                record.pop('title_en', None)
                record.pop('preview_text_en', None)
                record.pop('content_en', None)
                
                result = self.client.from_('news').insert(record).execute()
            
            if result.data and len(result.data) > 0:
                news_id = result.data[0]['id']
                logging.info(f"News created successfully with ID: {news_id}")
                return True, news_id
            
            return False, None
            
        except Exception as e:
            logging.error(f"Error creating news: {e}")
            return False, None

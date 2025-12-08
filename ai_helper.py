"""
AI Helper для чат-бота поддержки на базе OpenAI
"""
import os
import logging
from typing import Optional
from openai import OpenAI
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

logger = logging.getLogger(__name__)

# Получаем API ключ и настройки из переменных окружения
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-3.5-turbo')
OPENAI_MAX_TOKENS = int(os.getenv('OPENAI_MAX_TOKENS', '500'))

# Системный промпт для AI ассистента
SYSTEM_PROMPT = """Ты - дружелюбный помощник в боте программы лояльности.

Твоя задача - помогать клиентам с вопросами о:
- Как накапливать баллы
- Как обменивать баллы на услуги
- Как работает программа лояльности
- Как найти партнеров
- Как использовать приложение

Правила общения:
1. Будь вежливым и дружелюбным
2. Отвечай кратко и по делу (максимум 3-4 предложения)
3. Используй эмодзи для наглядности 😊
4. Если не знаешь ответ - предложи связаться с поддержкой
5. Не придумывай информацию - отвечай только на основе контекста

Ключевая информация:
- Баллы начисляются за покупки у партнеров
- Баллы можно обменять на скидки и услуги
- Есть реферальная программа
- Приложение доступно через Telegram
- Поддержка: напиши "поддержка" для связи с оператором
"""


class AIAssistant:
    """Класс для работы с AI ассистентом"""
    
    def __init__(self, api_key: str = OPENAI_API_KEY, model: str = OPENAI_MODEL):
        """
        Инициализация AI ассистента
        
        Args:
            api_key: API ключ OpenAI
            model: Модель OpenAI (gpt-3.5-turbo, gpt-4, gpt-5-mini и т.д.)
        """
        self.api_key = api_key
        self.model = model
        self.max_tokens = OPENAI_MAX_TOKENS
        self.enabled = bool(api_key)
        
        if self.enabled:
            self.client = OpenAI(api_key=api_key)
        else:
            logger.warning("OpenAI API key not found. AI assistant disabled.")
    
    async def get_answer(self, question: str, context: Optional[str] = None) -> Optional[str]:
        """
        Получить ответ от AI на вопрос пользователя
        
        Args:
            question: Вопрос пользователя
            context: Дополнительный контекст (опционально)
            
        Returns:
            Ответ AI или None в случае ошибки
        """
        if not self.enabled:
            logger.warning("AI assistant is disabled")
            return None
        
        try:
            # Формируем сообщения для чата
            messages = [
                {
                    "role": "system",
                    "content": SYSTEM_PROMPT
                }
            ]
            
            # Добавляем контекст если есть
            if context:
                messages.append({
                    "role": "system",
                    "content": f"Дополнительная информация: {context}"
                })
            
            # Добавляем вопрос пользователя
            messages.append({
                "role": "user",
                "content": question
            })
            
            # Получаем ответ от OpenAI
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens,
                temperature=0.7
            )
            
            # Извлекаем текст ответа
            answer = response.choices[0].message.content
            
            logger.info(f"AI response generated for question: {question[:50]}...")
            return answer
                
        except Exception as e:
            logger.error(f"Error getting AI response: {e}")
            return None
    
    async def get_service_recommendation(
        self, 
        user_balance: int, 
        user_history: list = None
    ) -> Optional[str]:
        """
        Получить рекомендацию услуг на основе баланса и истории
        
        Args:
            user_balance: Баланс пользователя
            user_history: История транзакций
            
        Returns:
            Рекомендация или None
        """
        if not self.enabled:
            return None
        
        context = f"""
        Баланс клиента: {user_balance} баллов
        
        Дай короткую рекомендацию (1-2 предложения) какие услуги клиент может получить 
        с таким балансом. Будь позитивным и мотивирующим!
        """
        
        try:
            return await self.get_answer(
                "Что я могу получить с моими баллами?", 
                context=context
            )
        except Exception as e:
            logger.error(f"Error getting recommendation: {e}")
            return None
    
    async def translate_text(
        self, 
        text: str, 
        target_lang: str = 'en',
        source_lang: str = 'ru'
    ) -> Optional[str]:
        """
        Перевести текст с помощью AI
        
        Args:
            text: Текст для перевода
            target_lang: Целевой язык ('en', 'ru', и т.д.)
            source_lang: Исходный язык ('ru', 'en', и т.д.)
            
        Returns:
            Переведенный текст или None в случае ошибки
        """
        if not self.enabled:
            logger.warning("AI assistant is disabled")
            return None
        
        if not text or not text.strip():
            return text
        
        # Маппинг языков для промпта
        lang_names = {
            'ru': 'русский',
            'en': 'английский',
            'es': 'испанский',
            'fr': 'французский',
            'de': 'немецкий',
            'it': 'итальянский',
            'pt': 'португальский',
            'zh': 'китайский',
            'ja': 'японский',
            'ko': 'корейский'
        }
        
        source_name = lang_names.get(source_lang, source_lang)
        target_name = lang_names.get(target_lang, target_lang)
        
        # Промпт для перевода
        translation_prompt = f"""Ты профессиональный переводчик. Переведи следующий текст с {source_name} на {target_name}.

Правила перевода:
1. Сохраняй смысл и тон оригинала
2. Используй естественный язык целевого языка
3. Сохраняй форматирование (переносы строк, пунктуацию)
4. Не добавляй дополнительных комментариев или объяснений
5. Если текст содержит плейсхолдеры вида {{variable}}, сохрани их без изменений

Текст для перевода:
{text}

Переведи только текст, без дополнительных комментариев:"""
        
        try:
            messages = [
                {
                    "role": "system",
                    "content": "Ты профессиональный переводчик. Твоя задача - точно переводить текст, сохраняя смысл и стиль оригинала."
                },
                {
                    "role": "user",
                    "content": translation_prompt
                }
            ]
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=self.max_tokens * 2,  # Для переводов нужно больше токенов
                temperature=0.3  # Низкая температура для более точного перевода
            )
            
            translated = response.choices[0].message.content.strip()
            
            # Убираем возможные кавычки или форматирование, которые мог добавить AI
            if translated.startswith('"') and translated.endswith('"'):
                translated = translated[1:-1]
            if translated.startswith("'") and translated.endswith("'"):
                translated = translated[1:-1]
            
            logger.info(f"Text translated: {source_lang} -> {target_lang} ({len(text)} chars)")
            return translated
                
        except Exception as e:
            logger.error(f"Error translating text: {e}")
            return None


# Глобальный экземпляр ассистента
ai_assistant = AIAssistant()


async def get_ai_support_answer(question: str) -> str:
    """
    Удобная функция для получения ответа от AI
    
    Args:
        question: Вопрос пользователя
        
    Returns:
        Ответ AI или сообщение об ошибке
    """
    answer = await ai_assistant.get_answer(question)
    
    if answer:
        return answer
    else:
        return (
            "К сожалению, сейчас я не могу ответить на ваш вопрос. 😔\n\n"
            "Попробуйте переформулировать вопрос или напишите 'поддержка' "
            "для связи с оператором."
        )


async def translate_text_ai(text: str, target_lang: str = 'en', source_lang: str = 'ru') -> str:
    """
    Удобная функция для перевода текста через AI
    
    Args:
        text: Текст для перевода
        target_lang: Целевой язык ('en', 'ru', и т.д.)
        source_lang: Исходный язык ('ru', 'en', и т.д.)
        
    Returns:
        Переведенный текст или оригинал в случае ошибки
    """
    if not text or not text.strip():
        return text
    
    translated = await ai_assistant.translate_text(text, target_lang, source_lang)
    
    if translated:
        return translated
    else:
        logger.warning(f"Translation failed, returning original text")
        return text


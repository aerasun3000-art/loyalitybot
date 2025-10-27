"""
AI Helper для чат-бота поддержки на базе GigaChat
"""
import os
import logging
from typing import Optional
from gigachat import GigaChat
from gigachat.models import Chat, Messages, MessagesRole

logger = logging.getLogger(__name__)

# Получаем API ключ из переменных окружения
GIGACHAT_API_KEY = os.getenv('GIGACHAT_API_KEY', '')

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
    
    def __init__(self, api_key: str = GIGACHAT_API_KEY):
        """
        Инициализация AI ассистента
        
        Args:
            api_key: API ключ GigaChat
        """
        self.api_key = api_key
        self.enabled = bool(api_key)
        
        if not self.enabled:
            logger.warning("GigaChat API key not found. AI assistant disabled.")
    
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
                Messages(
                    role=MessagesRole.SYSTEM,
                    content=SYSTEM_PROMPT
                ),
            ]
            
            # Добавляем контекст если есть
            if context:
                messages.append(
                    Messages(
                        role=MessagesRole.SYSTEM,
                        content=f"Дополнительная информация: {context}"
                    )
                )
            
            # Добавляем вопрос пользователя
            messages.append(
                Messages(
                    role=MessagesRole.USER,
                    content=question
                )
            )
            
            # Создаем клиента и получаем ответ
            with GigaChat(
                credentials=self.api_key,
                verify_ssl_certs=False,
                scope="GIGACHAT_API_PERS"  # Персональный доступ
            ) as giga:
                response = giga.chat(Chat(messages=messages))
                
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


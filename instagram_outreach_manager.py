"""
Instagram Outreach Manager
Основной модуль для управления процессом Instagram outreach
"""

import os
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from message_generator import MessageGenerator
from outreach_templates import get_all_templates

# Опциональный импорт calendar_manager
try:
    from calendar_manager import CalendarManager
    CALENDAR_AVAILABLE = True
except ImportError:
    CALENDAR_AVAILABLE = False
    CalendarManager = None


class InstagramOutreachManager:
    """Управляет процессом Instagram outreach к потенциальным партнерам"""
    
    # Статусы outreach
    STATUS_NOT_CONTACTED = 'NOT_CONTACTED'
    STATUS_QUEUED = 'QUEUED'
    STATUS_SENT = 'SENT'
    STATUS_REPLIED = 'REPLIED'
    STATUS_INTERESTED = 'INTERESTED'
    STATUS_CALL_SCHEDULED = 'CALL_SCHEDULED'
    STATUS_FOLLOW_UP_1 = 'FOLLOW_UP_1'
    STATUS_FOLLOW_UP_2 = 'FOLLOW_UP_2'
    STATUS_NOT_INTERESTED = 'NOT_INTERESTED'
    STATUS_GHOSTED = 'GHOSTED'
    STATUS_CLOSED = 'CLOSED'
    
    # Приоритеты
    PRIORITY_LOW = 'LOW'
    PRIORITY_MEDIUM = 'MEDIUM'
    PRIORITY_HIGH = 'HIGH'
    PRIORITY_URGENT = 'URGENT'
    
    def __init__(self, supabase_manager, default_link: Optional[str] = None):
        """
        Инициализация менеджера outreach
        
        Args:
            supabase_manager: Экземпляр SupabaseManager
            default_link: Ссылка по умолчанию для OnePagerPartner
        """
        self.sm = supabase_manager
        self.message_generator = MessageGenerator(
            default_link=default_link or os.getenv('ONEPAGER_PARTNER_URL', 'https://your-domain.com/onepager/partner'),
            supabase_manager=supabase_manager  # Передаем для A/B тестирования
        )
        
        # Инициализация Calendar Manager (опционально)
        self.calendar_manager = None
        if CALENDAR_AVAILABLE:
            try:
                self.calendar_manager = CalendarManager()
                if not self.calendar_manager.is_available():
                    self.calendar_manager = None
            except Exception:
                self.calendar_manager = None
    
    def add_to_outreach(
        self,
        instagram_handle: str,
        name: Optional[str] = None,
        district: Optional[str] = None,
        business_type: Optional[str] = None,
        city: str = 'New York',
        priority: str = PRIORITY_MEDIUM,
        source: Optional[str] = None,
        notes: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Добавляет нового потенциального партнера в систему outreach
        
        Args:
            instagram_handle: Instagram handle (без @)
            name: Имя партнера
            district: Район
            business_type: Тип бизнеса
            city: Город (по умолчанию New York)
            priority: Приоритет (LOW, MEDIUM, HIGH, URGENT)
            source: Источник (hashtag, location, referral, etc.)
            notes: Заметки
            created_by: ID пользователя, который добавил
        
        Returns:
            dict: Данные созданного контакта
        
        Raises:
            ValueError: Если instagram_handle уже существует
        """
        # Убираем @ если есть
        instagram_handle = instagram_handle.lstrip('@')
        
        # Проверяем, существует ли уже такой контакт
        existing = self.get_by_instagram_handle(instagram_handle)
        if existing:
            raise ValueError(f"Контакт с Instagram handle '{instagram_handle}' уже существует")
        
        # Подготавливаем данные
        outreach_data = {
            'instagram_handle': instagram_handle,
            'name': name or instagram_handle,
            'district': district,
            'business_type': business_type,
            'city': city,
            'outreach_status': self.STATUS_NOT_CONTACTED,
            'priority': priority,
            'source': source,
            'notes': notes,
            'created_by': created_by,
            'messages_sent': 0
        }
        
        # Создаем запись в базе
        if not self.sm.client:
            raise RuntimeError("Supabase клиент не инициализирован")
        
        try:
            result = self.sm.client.from_('instagram_outreach').insert(outreach_data).execute()
            if result.data:
                return result.data[0]
            else:
                raise RuntimeError("Не удалось создать запись в базе данных")
        except Exception as e:
            raise RuntimeError(f"Ошибка при создании контакта: {str(e)}")
    
    def get_by_instagram_handle(self, instagram_handle: str) -> Optional[Dict[str, Any]]:
        """
        Получает контакт по Instagram handle
        
        Args:
            instagram_handle: Instagram handle (без @)
        
        Returns:
            dict или None: Данные контакта или None если не найден
        """
        instagram_handle = instagram_handle.lstrip('@')
        
        if not self.sm.client:
            return None
        
        try:
            result = self.sm.client.from_('instagram_outreach')\
                .select('*')\
                .eq('instagram_handle', instagram_handle)\
                .limit(1)\
                .execute()
            return result.data[0] if result.data and len(result.data) > 0 else None
        except Exception:
            return None
    
    def update_status(
        self,
        instagram_handle: str,
        new_status: str,
        notes: Optional[str] = None
    ) -> bool:
        """
        Обновляет статус контакта
        
        Args:
            instagram_handle: Instagram handle
            new_status: Новый статус
            notes: Дополнительные заметки
        
        Returns:
            bool: True если успешно обновлено
        """
        instagram_handle = instagram_handle.lstrip('@')
        
        if not self.sm.client:
            return False
        
        update_data = {
            'outreach_status': new_status,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        # Обновляем соответствующие даты
        if new_status == self.STATUS_SENT:
            update_data['first_contact_date'] = datetime.utcnow().isoformat()
            # Получаем текущее значение messages_sent
            contact = self.get_by_instagram_handle(instagram_handle)
            current_messages = contact.get('messages_sent', 0) if contact else 0
            update_data['messages_sent'] = current_messages + 1
        
        elif new_status == self.STATUS_REPLIED:
            update_data['reply_date'] = datetime.utcnow().isoformat()
            # Вычисляем время ответа
            contact = self.get_by_instagram_handle(instagram_handle)
            if contact and contact.get('first_contact_date'):
                try:
                    first_contact = datetime.fromisoformat(contact['first_contact_date'].replace('Z', '+00:00'))
                    response_time = datetime.utcnow() - first_contact
                    update_data['response_time_hours'] = int(response_time.total_seconds() / 3600)
                except Exception:
                    pass
        
        elif new_status in [self.STATUS_FOLLOW_UP_1, self.STATUS_FOLLOW_UP_2]:
            update_data['last_follow_up_date'] = datetime.utcnow().isoformat()
            # Получаем текущее значение messages_sent
            contact = self.get_by_instagram_handle(instagram_handle)
            current_messages = contact.get('messages_sent', 0) if contact else 0
            update_data['messages_sent'] = current_messages + 1
        
        elif new_status == self.STATUS_CLOSED:
            update_data['closed_date'] = datetime.utcnow().isoformat()
        
        if notes:
            update_data['notes'] = notes
        
        try:
            self.sm.client.from_('instagram_outreach')\
                .update(update_data)\
                .eq('instagram_handle', instagram_handle)\
                .execute()
            return True
        except Exception:
            return False
    
    def generate_message(
        self,
        instagram_handle: str,
        template_name: str = 'first_contact_short',
        custom_variables: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """
        Генерирует персональное сообщение для контакта
        
        Args:
            instagram_handle: Instagram handle
            template_name: Название шаблона
            custom_variables: Дополнительные переменные
        
        Returns:
            dict: Словарь с сообщением и метаданными
        """
        contact = self.get_by_instagram_handle(instagram_handle)
        
        if not contact:
            raise ValueError(f"Контакт с Instagram handle '{instagram_handle}' не найден. Убедитесь, что контакт добавлен в систему через меню 'Добавить контакт'.")
        
        partner_data = {
            'name': contact.get('name', instagram_handle),
            'district': contact.get('district', 'вашем районе'),
            'business_type': contact.get('business_type', 'бьюти-услуг'),
            'instagram_handle': instagram_handle
        }
        
        try:
            # Проверяем, используем ли A/B тестирование
            use_ab = True
            template_group = None
            
            # Определяем группу шаблонов
            if template_name in ['first_contact_short', 'first_contact_detailed']:
                template_group = 'first_contact'
            elif template_name == 'follow_up_1':
                template_group = 'follow_up_1'
            
            # Если есть группа и включено A/B тестирование, используем его
            if template_group and use_ab:
                ab_result = self.message_generator.generate_message_with_ab(
                    partner_data,
                    template_group=template_group,
                    use_ab=True
                )
                
                return {
                    'message': ab_result['message'],
                    'template_name': template_name,
                    'template_display_name': ab_result.get('variant_name', template_name),
                    'variant': ab_result.get('variant'),
                    'template_group': ab_result.get('template_group'),
                    'character_count': ab_result.get('character_count', 0),
                    'word_count': ab_result.get('word_count', 0)
                }
            else:
                # Используем обычную генерацию
                preview = self.message_generator.get_message_preview(partner_data, template_name)
                return preview
        except Exception as e:
            raise ValueError(f"Ошибка генерации сообщения: {str(e)}")
    
    def get_queue(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Получает очередь контактов для outreach
        
        Args:
            limit: Количество контактов
        
        Returns:
            list: Список контактов в порядке приоритета
        """
        if not self.sm.client:
            return []
        
        try:
            result = self.sm.client.from_('instagram_outreach')\
                .select('*')\
                .eq('outreach_status', self.STATUS_NOT_CONTACTED)\
                .order('priority', desc=False)\
                .order('created_at', desc=False)\
                .limit(limit)\
                .execute()
            return result.data if result.data else []
        except Exception:
            return []
    
    def get_follow_ups(self) -> List[Dict[str, Any]]:
        """
        Получает список контактов, требующих follow-up
        
        Returns:
            list: Список контактов для follow-up
        """
        if not self.sm.client:
            return []
        
        try:
            # Контакты со статусом SENT, которым нужен первый follow-up (48 часов)
            result = self.sm.client.from_('instagram_outreach')\
                .select('*')\
                .eq('outreach_status', self.STATUS_SENT)\
                .lt('first_contact_date', (datetime.utcnow() - timedelta(hours=48)).isoformat())\
                .is_('last_follow_up_date', 'null')\
                .execute()
            
            follow_ups = result.data if result.data else []
            
            # Контакты, которым нужен второй follow-up (7 дней)
            result2 = self.sm.client.from_('instagram_outreach')\
                .select('*')\
                .in_('outreach_status', [self.STATUS_SENT, self.STATUS_FOLLOW_UP_1])\
                .lt('last_follow_up_date', (datetime.utcnow() - timedelta(days=7)).isoformat())\
                .execute()
            
            if result2.data:
                follow_ups.extend(result2.data)
            
            return follow_ups
        except Exception:
            return []
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Получает статистику outreach кампании
        
        Returns:
            dict: Статистика по статусам и метрикам
        """
        if not self.sm.client:
            return {}
        
        try:
            # Получаем все контакты
            result = self.sm.client.from_('instagram_outreach')\
                .select('outreach_status, messages_sent, response_time_hours')\
                .execute()
            
            contacts = result.data if result.data else []
            
            # Подсчитываем статистику
            stats = {
                'total': len(contacts),
                'by_status': {},
                'avg_messages_sent': 0,
                'avg_response_time_hours': 0,
                'total_messages_sent': 0
            }
            
            total_messages = 0
            total_response_times = []
            
            for contact in contacts:
                status = contact.get('outreach_status', 'UNKNOWN')
                stats['by_status'][status] = stats['by_status'].get(status, 0) + 1
                
                messages = contact.get('messages_sent', 0)
                if messages:
                    total_messages += messages
                
                response_time = contact.get('response_time_hours')
                if response_time:
                    total_response_times.append(response_time)
            
            if stats['total'] > 0:
                stats['avg_messages_sent'] = round(total_messages / stats['total'], 2)
            
            if total_response_times:
                stats['avg_response_time_hours'] = round(sum(total_response_times) / len(total_response_times), 2)
            
            stats['total_messages_sent'] = total_messages
            
            return stats
        except Exception:
            return {}
    
    def link_to_partner(self, instagram_handle: str, partner_chat_id: str) -> bool:
        """
        Связывает контакт outreach с существующим партнером
        
        Args:
            instagram_handle: Instagram handle
            partner_chat_id: Chat ID партнера
        
        Returns:
            bool: True если успешно
        """
        instagram_handle = instagram_handle.lstrip('@')
        
        if not self.sm.client:
            return False
        
        try:
            self.sm.client.table('instagram_outreach')\
                .update({'partner_chat_id': partner_chat_id})\
                .eq('instagram_handle', instagram_handle)\
                .execute()
            
            # Также обновляем Instagram handle в таблице partners
            self.sm.client.from_('partners')\
                .update({'instagram_handle': instagram_handle})\
                .eq('chat_id', partner_chat_id)\
                .execute()
            
            return True
        except Exception:
            return False
    
    def schedule_call(
        self,
        instagram_handle: str,
        scheduled_time: datetime,
        duration_minutes: int = 30,
        meeting_link: Optional[str] = None,
        partner_email: Optional[str] = None,
        meeting_type: str = 'video_call'
    ) -> Dict[str, Any]:
        """
        Планирует созвон с партнером и создает событие в календаре
        
        Args:
            instagram_handle: Instagram handle партнера
            scheduled_time: Время созвона (datetime объект)
            duration_minutes: Длительность в минутах
            meeting_link: Ссылка на видеозвонок (опционально)
            partner_email: Email партнера для приглашения (опционально)
            meeting_type: Тип встречи (call, video_call, in_person, other)
        
        Returns:
            dict: Результат планирования с event_id и другими данными
        
        Raises:
            ValueError: Если контакт не найден или календарь недоступен
        """
        instagram_handle = instagram_handle.lstrip('@')
        
        # Получаем данные контакта
        contact = self.get_by_instagram_handle(instagram_handle)
        if not contact:
            raise ValueError(f"Контакт с Instagram handle '{instagram_handle}' не найден")
        
        # Создаем событие в календаре (если доступен)
        calendar_event_id = None
        calendar_html_link = None
        
        if self.calendar_manager and self.calendar_manager.is_available():
            try:
                calendar_result = self.calendar_manager.create_meeting_for_partner(
                    instagram_handle=instagram_handle,
                    partner_name=contact.get('name', instagram_handle),
                    scheduled_time=scheduled_time,
                    district=contact.get('district'),
                    business_type=contact.get('business_type'),
                    duration_minutes=duration_minutes,
                    meeting_link=meeting_link,
                    partner_email=partner_email
                )
                
                if calendar_result:
                    calendar_event_id = calendar_result.get('event_id')
                    calendar_html_link = calendar_result.get('html_link')
                    # Если calendar создал ссылку на встречу, используем её
                    if not meeting_link and calendar_result.get('meeting_link'):
                        meeting_link = calendar_result.get('meeting_link')
            except Exception as e:
                # Логируем ошибку, но продолжаем обновление статуса
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Не удалось создать событие в календаре: {e}")
        
        # Обновляем статус и данные в базе данных
        update_data = {
            'outreach_status': self.STATUS_CALL_SCHEDULED,
            'call_scheduled_date': scheduled_time.isoformat(),
            'meeting_duration': duration_minutes,
            'meeting_type': meeting_type,
            'updated_at': datetime.utcnow().isoformat()
        }
        
        if calendar_event_id:
            update_data['calendar_event_id'] = calendar_event_id
            update_data['calendar_synced_at'] = datetime.utcnow().isoformat()
        
        if meeting_link:
            update_data['meeting_link'] = meeting_link
        
        # Выполняем обновление
        if not self.sm.client:
            raise RuntimeError("Supabase клиент не инициализирован")
        
        try:
            result = self.sm.client.from_('instagram_outreach')\
                .update(update_data)\
                .eq('instagram_handle', instagram_handle)\
                .execute()
            
            if result.data:
                return {
                    'success': True,
                    'calendar_event_id': calendar_event_id,
                    'calendar_html_link': calendar_html_link,
                    'meeting_link': meeting_link,
                    'scheduled_time': scheduled_time.isoformat(),
                    'duration_minutes': duration_minutes
                }
            else:
                raise RuntimeError("Не удалось обновить запись в базе данных")
        except Exception as e:
            raise RuntimeError(f"Ошибка при планировании созвона: {str(e)}")
    
    def get_upcoming_calls(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Получает список предстоящих созвонов
        
        Args:
            limit: Количество записей
        
        Returns:
            list: Список предстоящих созвонов
        """
        if not self.sm.client:
            return []
        
        try:
            now = datetime.utcnow().isoformat()
            result = self.sm.client.from_('instagram_outreach')\
                .select('*')\
                .eq('outreach_status', self.STATUS_CALL_SCHEDULED)\
                .not_.is_('call_scheduled_date', 'null')\
                .gte('call_scheduled_date', now)\
                .order('call_scheduled_date', desc=False)\
                .limit(limit)\
                .execute()
            return result.data if result.data else []
        except Exception:
            return []


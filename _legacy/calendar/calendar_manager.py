"""
Calendar Manager - Интеграция с Google Calendar
Управляет созданием, обновлением и удалением событий в Google Calendar
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


class CalendarManager:
    """Управляет событиями в Google Calendar"""
    
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    def __init__(self, credentials_path: Optional[str] = None, calendar_id: Optional[str] = None):
        """
        Инициализация CalendarManager
        
        Args:
            credentials_path: Путь к JSON файлу с credentials Service Account
            calendar_id: ID календаря (email или calendar ID)
        """
        self.credentials_path = credentials_path or os.getenv('GOOGLE_CALENDAR_CREDENTIALS_PATH')
        self.calendar_id = calendar_id or os.getenv('GOOGLE_CALENDAR_ID')
        
        if not self.credentials_path:
            logger.warning("GOOGLE_CALENDAR_CREDENTIALS_PATH не указан. Calendar Manager будет недоступен.")
            self.service = None
            return
        
        if not self.calendar_id:
            logger.warning("GOOGLE_CALENDAR_ID не указан. Calendar Manager будет недоступен.")
            self.service = None
            return
        
        try:
            self.service = self._authenticate()
            logger.info("Calendar Manager успешно инициализирован")
        except Exception as e:
            logger.error(f"Ошибка инициализации Calendar Manager: {e}")
            self.service = None
    
    def _authenticate(self):
        """Аутентификация через Service Account"""
        try:
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=self.SCOPES
            )
            service = build('calendar', 'v3', credentials=credentials)
            return service
        except Exception as e:
            logger.error(f"Ошибка аутентификации Google Calendar: {e}")
            raise
    
    def is_available(self) -> bool:
        """Проверяет, доступен ли Calendar Manager"""
        return self.service is not None
    
    def create_event(
        self,
        title: str,
        start_time: datetime,
        duration_minutes: int = 30,
        description: str = "",
        meeting_link: Optional[str] = None,
        attendee_email: Optional[str] = None,
        location: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Создает событие в Google Calendar
        
        Args:
            title: Название события
            start_time: Время начала (datetime объект)
            duration_minutes: Длительность в минутах
            description: Описание события
            meeting_link: Ссылка на видеозвонок
            attendee_email: Email участника
            location: Место встречи
        
        Returns:
            dict с event_id и html_link, или None в случае ошибки
        """
        if not self.is_available():
            logger.error("Calendar Manager недоступен")
            return None
        
        try:
            end_time = start_time + timedelta(minutes=duration_minutes)
            
            # Форматируем время в RFC3339
            start_time_rfc = start_time.strftime('%Y-%m-%dT%H:%M:%S')
            end_time_rfc = end_time.strftime('%Y-%m-%dT%H:%M:%S')
            
            # Создаем описание с ссылкой на встречу
            event_description = description
            if meeting_link:
                event_description += f"\n\n🔗 Ссылка на встречу: {meeting_link}"
            
            # Формируем тело события
            event = {
                'summary': title,
                'description': event_description,
                'start': {
                    'dateTime': start_time_rfc,
                    'timeZone': 'America/New_York',  # NYC timezone (UTC-5/UTC-4)
                },
                'end': {
                    'dateTime': end_time_rfc,
                    'timeZone': 'America/New_York',  # NYC timezone (UTC-5/UTC-4)
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 24 * 60},  # За 24 часа
                        {'method': 'popup', 'minutes': 30},  # За 30 минут
                    ],
                },
            }
            
            # Добавляем участника
            if attendee_email:
                event['attendees'] = [
                    {'email': attendee_email}
                ]
            
            # Добавляем место встречи
            if location:
                event['location'] = location
            
            # Добавляем конференц-ссылку если указана
            if meeting_link:
                event['conferenceData'] = {
                    'createRequest': {
                        'requestId': f"meeting-{start_time.strftime('%Y%m%d%H%M%S')}",
                        'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                    }
                }
                # Если ссылка уже есть (например, Zoom), добавляем как location
                if 'zoom' in meeting_link.lower() or 'meet' not in meeting_link.lower():
                    event['location'] = meeting_link
            
            # Создаем событие
            created_event = self.service.events().insert(
                calendarId=self.calendar_id,
                body=event,
                conferenceDataVersion=1 if meeting_link else 0
            ).execute()
            
            event_id = created_event.get('id')
            html_link = created_event.get('htmlLink')
            
            logger.info(f"Событие создано: {event_id}")
            
            return {
                'event_id': event_id,
                'html_link': html_link,
                'meeting_link': meeting_link or created_event.get('hangoutLink'),
                'start_time': start_time_rfc,
                'end_time': end_time_rfc
            }
            
        except HttpError as e:
            logger.error(f"Ошибка при создании события в Google Calendar: {e}")
            return None
        except Exception as e:
            logger.error(f"Неожиданная ошибка при создании события: {e}")
            return None
    
    def create_meeting_for_partner(
        self,
        instagram_handle: str,
        partner_name: str,
        scheduled_time: datetime,
        district: Optional[str] = None,
        business_type: Optional[str] = None,
        duration_minutes: int = 30,
        meeting_link: Optional[str] = None,
        partner_email: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Создает встречу для партнера из instagram_outreach
        
        Args:
            instagram_handle: Instagram handle партнера
            partner_name: Имя партнера
            scheduled_time: Время встречи
            district: Район (для описания)
            business_type: Тип бизнеса
            duration_minutes: Длительность в минутах
            meeting_link: Ссылка на встречу (опционально)
            partner_email: Email партнера для приглашения
        
        Returns:
            dict с данными созданного события или None
        """
        title = f"Созвон с партнером: {partner_name}"
        
        description = f"""
Потенциальный партнер для программы лояльности.

Instagram: @{instagram_handle}
Имя: {partner_name}
"""
        
        if district:
            description += f"Район: {district}\n"
        if business_type:
            description += f"Тип бизнеса: {business_type}\n"
        
        description += "\nОбсуждение условий партнерства."
        
        result = self.create_event(
            title=title,
            start_time=scheduled_time,
            duration_minutes=duration_minutes,
            description=description.strip(),
            meeting_link=meeting_link,
            attendee_email=partner_email
        )
        
        return result
    
    def update_event(
        self,
        event_id: str,
        start_time: Optional[datetime] = None,
        duration_minutes: Optional[int] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        meeting_link: Optional[str] = None
    ) -> bool:
        """
        Обновляет существующее событие
        
        Args:
            event_id: ID события в Google Calendar
            start_time: Новое время начала
            duration_minutes: Новая длительность
            title: Новое название
            description: Новое описание
            meeting_link: Новая ссылка на встречу
        
        Returns:
            True если успешно, False в случае ошибки
        """
        if not self.is_available():
            return False
        
        try:
            # Получаем существующее событие
            event = self.service.events().get(
                calendarId=self.calendar_id,
                eventId=event_id
            ).execute()
            
            # Обновляем поля
            if title:
                event['summary'] = title
            
            if start_time:
                end_time = start_time + timedelta(minutes=duration_minutes or 30)
                event['start']['dateTime'] = start_time.strftime('%Y-%m-%dT%H:%M:%S')
                event['end']['dateTime'] = end_time.strftime('%Y-%m-%dT%H:%M:%S')
            
            if description:
                event['description'] = description
            
            if meeting_link:
                if 'location' not in event:
                    event['location'] = ''
                event['location'] = meeting_link
                if 'description' in event and meeting_link not in event['description']:
                    event['description'] += f"\n\n🔗 Ссылка на встречу: {meeting_link}"
            
            # Сохраняем изменения
            self.service.events().update(
                calendarId=self.calendar_id,
                eventId=event_id,
                body=event
            ).execute()
            
            logger.info(f"Событие {event_id} обновлено")
            return True
            
        except HttpError as e:
            logger.error(f"Ошибка при обновлении события: {e}")
            return False
        except Exception as e:
            logger.error(f"Неожиданная ошибка при обновлении события: {e}")
            return False
    
    def delete_event(self, event_id: str) -> bool:
        """
        Удаляет событие из календаря
        
        Args:
            event_id: ID события в Google Calendar
        
        Returns:
            True если успешно, False в случае ошибки
        """
        if not self.is_available():
            return False
        
        try:
            self.service.events().delete(
                calendarId=self.calendar_id,
                eventId=event_id
            ).execute()
            
            logger.info(f"Событие {event_id} удалено")
            return True
            
        except HttpError as e:
            logger.error(f"Ошибка при удалении события: {e}")
            return False
        except Exception as e:
            logger.error(f"Неожиданная ошибка при удалении события: {e}")
            return False
    
    def get_event(self, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Получает информацию о событии
        
        Args:
            event_id: ID события в Google Calendar
        
        Returns:
            dict с данными события или None
        """
        if not self.is_available():
            return None
        
        try:
            event = self.service.events().get(
                calendarId=self.calendar_id,
                eventId=event_id
            ).execute()
            
            return event
            
        except HttpError as e:
            logger.error(f"Ошибка при получении события: {e}")
            return None
        except Exception as e:
            logger.error(f"Неожиданная ошибка при получении события: {e}")
            return None




"""
Генератор персональных сообщений для Instagram Outreach
Поддерживает обычные шаблоны и A/B тестирование
"""

from typing import Dict, Optional
from outreach_templates import (
    OUTREACH_TEMPLATES,
    DEFAULT_VARIABLES,
    format_business_type,
    format_district,
    get_template
)
from outreach_templates_ab import get_ab_variant


class MessageGenerator:
    """Генерирует персональные сообщения для outreach"""
    
    def __init__(self, default_link: Optional[str] = None, default_company_name: Optional[str] = None, supabase_manager=None):
        """
        Инициализация генератора
        
        Args:
            default_link: Ссылка по умолчанию для OnePagerPartner
            default_company_name: Название компании по умолчанию
            supabase_manager: Менеджер Supabase для A/B тестирования
        """
        self.default_link = default_link or DEFAULT_VARIABLES['link']
        self.default_company_name = default_company_name or DEFAULT_VARIABLES['company_name']
        self.supabase_manager = supabase_manager
    
    def generate_message(
        self,
        partner_data: Dict,
        template_name: str = 'first_contact_short',
        custom_variables: Optional[Dict] = None
    ) -> str:
        """
        Генерирует персональное сообщение для партнера
        
        Args:
            partner_data: Словарь с данными партнера:
                - name: имя партнера
                - district: район
                - business_type: тип бизнеса
                - instagram_handle: Instagram handle (опционально)
            template_name: Название шаблона из outreach_templates
            custom_variables: Дополнительные переменные для подстановки
        
        Returns:
            str: Готовое сообщение для отправки
        
        Raises:
            ValueError: Если шаблон не найден или не хватает переменных
        """
        template = get_template(template_name)
        
        if not template:
            raise ValueError(f"Шаблон '{template_name}' не найден")
        
        # Подготавливаем переменные для подстановки
        variables = self._prepare_variables(partner_data, template, custom_variables)
        
        # Проверяем, что все необходимые переменные есть
        missing_vars = set(template['variables']) - set(variables.keys())
        if missing_vars:
            raise ValueError(
                f"Не хватает переменных для шаблона '{template_name}': {', '.join(missing_vars)}"
            )
        
        # Генерируем сообщение
        try:
            message = template['template'].format(**variables)
        except KeyError as e:
            raise ValueError(f"Ошибка форматирования шаблона: переменная {e} не найдена")
        
        return message.strip()
    
    def _prepare_variables(
        self,
        partner_data: Dict,
        template: Dict,
        custom_variables: Optional[Dict] = None
    ) -> Dict:
        """
        Подготавливает переменные для подстановки в шаблон
        
        Args:
            partner_data: Данные партнера
            template: Шаблон сообщения
            custom_variables: Дополнительные переменные
        
        Returns:
            dict: Словарь с подготовленными переменными
        """
        variables = {}
        
        # Базовые переменные из partner_data
        name = partner_data.get('name', partner_data.get('instagram_handle', 'мастер'))
        variables['name'] = name.split()[0] if ' ' in name else name  # Только имя без фамилии
        
        district = partner_data.get('district', 'вашем районе')
        variables['district'] = format_district(district)
        
        business_type = partner_data.get('business_type', 'бьюти-услуг')
        variables['business_type'] = format_business_type(business_type)
        
        # Переменные по умолчанию
        variables['company_name'] = self.default_company_name
        variables['link'] = self.default_link
        
        # Специфичные переменные
        if 'spots_left' in template['variables']:
            variables['spots_left'] = custom_variables.get('spots_left', DEFAULT_VARIABLES['spots_left']) if custom_variables else DEFAULT_VARIABLES['spots_left']
        
        # Переопределяем кастомными переменными, если есть
        if custom_variables:
            variables.update(custom_variables)
        
        return variables
    
    def generate_follow_up_message(
        self,
        partner_data: Dict,
        follow_up_number: int = 1
    ) -> str:
        """
        Генерирует follow-up сообщение
        
        Args:
            partner_data: Данные партнера
            follow_up_number: Номер follow-up (1 или 2)
        
        Returns:
            str: Готовое follow-up сообщение
        """
        template_name = f'follow_up_{follow_up_number}'
        return self.generate_message(partner_data, template_name)
    
    def get_message_preview(
        self,
        partner_data: Dict,
        template_name: str = 'first_contact_short'
    ) -> Dict:
        """
        Возвращает превью сообщения с информацией
        
        Args:
            partner_data: Данные партнера
            template_name: Название шаблона
        
        Returns:
            dict: Словарь с сообщением и метаданными
        """
        template = get_template(template_name)
        
        if not template:
            return {
                'error': f"Шаблон '{template_name}' не найден"
            }
        
        message = self.generate_message(partner_data, template_name)
        
        return {
            'message': message,
            'template_name': template_name,
            'template_display_name': template['name'],
            'length': template['length'],
            'character_count': len(message),
            'word_count': len(message.split())
        }
    
    def generate_message_with_ab(
        self,
        partner_data: Dict,
        template_group: str = 'first_contact',
        variant: Optional[str] = None,
        use_ab: bool = True
    ) -> Dict:
        """
        Генерирует сообщение с A/B тестированием
        
        Args:
            partner_data: Данные партнера (должен содержать instagram_handle)
            template_group: Группа шаблонов ('first_contact', 'follow_up_1', etc.)
            variant: Конкретный вариант ('A', 'B', 'C') или None для случайного выбора
            use_ab: Использовать ли A/B тестирование
        
        Returns:
            dict: {
                'message': 'текст сообщения',
                'variant': 'A',
                'variant_name': 'Короткое',
                'template_group': 'first_contact',
                'character_count': 123,
                'word_count': 45
            }
        """
        if not use_ab or not self.supabase_manager:
            # Fallback на обычную генерацию
            template_name_map = {
                'first_contact': 'first_contact_short',
                'follow_up_1': 'follow_up_1'
            }
            template_name = template_name_map.get(template_group, 'first_contact_short')
            message = self.generate_message(partner_data, template_name)
            return {
                'message': message,
                'variant': None,
                'variant_name': 'Обычный шаблон',
                'template_group': template_group,
                'character_count': len(message),
                'word_count': len(message.split())
            }
        
        from ab_test_manager import ABTestManager
        
        ab_manager = ABTestManager(self.supabase_manager)
        instagram_handle = partner_data.get('instagram_handle', '')
        
        # Назначаем или получаем вариант
        variant_assignment = ab_manager.assign_variant(
            instagram_handle,
            template_group,
            variant
        )
        
        variant = variant_assignment['variant']
        variant_name = variant_assignment['variant_name']
        template_text = variant_assignment.get('template_text', '')
        template_variables = variant_assignment.get('variables', [])
        
        if not template_text:
            # Fallback на обычную генерацию
            template_name_map = {
                'first_contact': 'first_contact_short',
                'follow_up_1': 'follow_up_1'
            }
            template_name = template_name_map.get(template_group, 'first_contact_short')
            message = self.generate_message(partner_data, template_name)
            return {
                'message': message,
                'variant': variant,
                'variant_name': variant_name,
                'template_group': template_group,
                'character_count': len(message),
                'word_count': len(message.split())
            }
        
        # Подготавливаем переменные
        variables = self._prepare_variables(partner_data, {'variables': template_variables})
        
        # Генерируем сообщение
        try:
            message = template_text.format(**variables)
        except KeyError as e:
            # Если не хватает переменных, используем значения по умолчанию
            missing_var = str(e).strip("'")
            if missing_var == 'link':
                variables['link'] = self.default_link
            elif missing_var == 'company_name':
                variables['company_name'] = self.default_company_name
            message = template_text.format(**variables)
        
        return {
            'message': message.strip(),
            'variant': variant,
            'variant_name': variant_name,
            'template_group': template_group,
            'character_count': len(message),
            'word_count': len(message.split())
        }


# Глобальный экземпляр для удобства
_default_generator = MessageGenerator()


def generate_outreach_message(
    partner_data: Dict,
    template_name: str = 'first_contact_short',
    custom_variables: Optional[Dict] = None
) -> str:
    """
    Удобная функция для быстрой генерации сообщения
    
    Args:
        partner_data: Данные партнера
        template_name: Название шаблона
        custom_variables: Дополнительные переменные
    
    Returns:
        str: Готовое сообщение
    """
    return _default_generator.generate_message(partner_data, template_name, custom_variables)


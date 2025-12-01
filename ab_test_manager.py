"""
Менеджер A/B тестирования для Instagram Outreach
Управляет распределением вариантов шаблонов и отслеживанием результатов
"""

import random
import logging
from typing import Dict, Optional, List
from datetime import datetime
from supabase_manager import SupabaseManager
from outreach_templates_ab import (
    get_ab_variant,
    get_active_variants,
    get_default_variant
)

logger = logging.getLogger(__name__)


class ABTestManager:
    """Управляет A/B тестированием шаблонов сообщений"""
    
    def __init__(self, supabase_manager: SupabaseManager):
        self.sm = supabase_manager
    
    def assign_variant(
        self,
        instagram_handle: str,
        template_group: str = 'first_contact',
        preferred_variant: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Назначает вариант шаблона для контакта
        
        Args:
            instagram_handle: Instagram handle контакта
            template_group: Группа шаблонов ('first_contact', 'follow_up_1', etc.)
            preferred_variant: Предпочтительный вариант (если None - случайный выбор)
        
        Returns:
            dict: {'variant': 'A', 'variant_name': 'Короткое', 'template_text': '...'}
        """
        # Получаем активные варианты для этой группы
        variants = get_active_variants(template_group)
        
        if not variants:
            # Если нет вариантов, возвращаем дефолтный
            default_variant = get_default_variant(template_group)
            variant_data = get_ab_variant(template_group, default_variant)
            
            if variant_data:
                return {
                    'variant': default_variant,
                    'variant_name': variant_data['name'],
                    'template_text': variant_data['template']
                }
            else:
                logger.warning(f"No variants found for {template_group}, using default")
                return {'variant': 'A', 'variant_name': 'По умолчанию', 'template_text': ''}
        
        # Выбираем вариант
        if preferred_variant and preferred_variant in variants:
            selected_variant = preferred_variant
        else:
            # Равномерное распределение (случайный выбор)
            variant_keys = list(variants.keys())
            selected_variant = random.choice(variant_keys)
        
        variant_data = variants[selected_variant]
        
        # Сохраняем выбор в базу данных
        try:
            if self.sm and self.sm.client:
                self.sm.client.from_('instagram_outreach')\
                    .update({
                        'template_variant': selected_variant,
                        'template_variant_name': variant_data['name'],
                        'template_group': template_group
                    })\
                    .eq('instagram_handle', instagram_handle)\
                    .execute()
        except Exception as e:
            logger.error(f"Error saving variant assignment: {e}")
        
        return {
            'variant': selected_variant,
            'variant_name': variant_data['name'],
            'template_text': variant_data['template'],
            'variables': variant_data.get('variables', [])
        }
    
    def get_variant_template(
        self,
        template_group: str,
        variant: str
    ) -> Optional[str]:
        """
        Получает текст шаблона для варианта
        
        Args:
            template_group: Группа шаблонов
            variant: Вариант ('A', 'B', 'C')
        
        Returns:
            str: Текст шаблона или None
        """
        variant_data = get_ab_variant(template_group, variant)
        if variant_data:
            return variant_data['template']
        return None
    
    def track_conversion(
        self,
        instagram_handle: str,
        conversion_type: str,  # 'opened', 'replied', 'interested', 'closed'
        **kwargs
    ) -> bool:
        """
        Отслеживает конверсию для варианта
        
        Args:
            instagram_handle: Instagram handle контакта
            conversion_type: Тип конверсии
            **kwargs: Дополнительные данные
        
        Returns:
            bool: True если успешно
        """
        if not self.sm or not self.sm.client:
            logger.error("SupabaseManager not initialized")
            return False
        
        update_data = {}
        
        if conversion_type == 'opened':
            update_data['opened_message'] = True
        elif conversion_type == 'clicked':
            update_data['clicked_link'] = True
        elif conversion_type == 'replied':
            update_data['outreach_status'] = 'REPLIED'
            update_data['reply_date'] = datetime.utcnow().isoformat()
        elif conversion_type == 'interested':
            update_data['outreach_status'] = 'INTERESTED'
        elif conversion_type == 'closed':
            update_data['outreach_status'] = 'CLOSED'
            update_data['closed_date'] = datetime.utcnow().isoformat()
        
        update_data['updated_at'] = datetime.utcnow().isoformat()
        
        try:
            self.sm.client.from_('instagram_outreach')\
                .update(update_data)\
                .eq('instagram_handle', instagram_handle)\
                .execute()
            return True
        except Exception as e:
            logger.error(f"Error tracking conversion: {e}")
            return False
    
    def get_ab_test_results(
        self,
        template_group: str = 'first_contact',
        min_samples: int = 10  # Минимум контактов для статистической значимости
    ) -> Dict:
        """
        Получает результаты A/B теста
        
        Args:
            template_group: Группа шаблонов
            min_samples: Минимум образцов для статистической значимости
        
        Returns:
            dict: Статистика по каждому варианту
        """
        if not self.sm or not self.sm.client:
            return {}
        
        try:
            # Используем представление из базы данных
            result = self.sm.client.from_('outreach_ab_test_results')\
                .select('*')\
                .eq('template_group', template_group)\
                .execute()
            
            if not result.data:
                return {
                    'variants': {},
                    'winner': None,
                    'total_samples': 0,
                    'message': 'Недостаточно данных для анализа'
                }
            
            # Форматируем результаты
            variant_stats = {}
            total_samples = 0
            
            for row in result.data:
                variant = row.get('template_variant')
                if not variant:
                    continue
                
                variant_stats[variant] = {
                    'sent': row.get('total_sent', 0),
                    'opened': row.get('total_opened', 0),
                    'replied': row.get('total_replied', 0),
                    'interested': row.get('total_interested', 0),
                    'closed': row.get('total_closed', 0),
                    'open_rate': row.get('open_rate', 0.0),
                    'reply_rate': row.get('reply_rate', 0.0),
                    'interest_rate': row.get('interest_rate', 0.0),
                    'conversion_rate': row.get('conversion_rate', 0.0),
                    'avg_response_time': row.get('avg_response_time_hours', 0.0)
                }
                
                total_samples += row.get('total_sent', 0)
            
            # Определяем победителя (по конверсии)
            winner = None
            best_rate = 0
            
            for variant, stats in variant_stats.items():
                if stats['sent'] >= min_samples and stats['conversion_rate'] > best_rate:
                    best_rate = stats['conversion_rate']
                    winner = variant
            
            return {
                'variants': variant_stats,
                'winner': winner,
                'winner_conversion_rate': best_rate,
                'total_samples': total_samples,
                'template_group': template_group
            }
            
        except Exception as e:
            logger.error(f"Error getting AB test results: {e}")
            # Fallback - рассчитываем вручную
            return self._calculate_results_manually(template_group, min_samples)
    
    def _calculate_results_manually(
        self,
        template_group: str,
        min_samples: int
    ) -> Dict:
        """Ручной расчет результатов (fallback)"""
        try:
            result = self.sm.client.from_('instagram_outreach')\
                .select('template_variant, outreach_status, opened_message, clicked_link')\
                .eq('template_group', template_group)\
                .eq('outreach_status', 'SENT')\
                .not_.is_('template_variant', 'null')\
                .execute()
            
            contacts = result.data if result.data else []
            
            variant_stats = {}
            
            for contact in contacts:
                variant = contact.get('template_variant')
                if not variant:
                    continue
                
                if variant not in variant_stats:
                    variant_stats[variant] = {
                        'sent': 0,
                        'opened': 0,
                        'replied': 0,
                        'interested': 0,
                        'closed': 0,
                        'conversion_rate': 0.0
                    }
                
                stats = variant_stats[variant]
                stats['sent'] += 1
                
                if contact.get('opened_message'):
                    stats['opened'] += 1
                
                status = contact.get('outreach_status', '')
                if status == 'REPLIED':
                    stats['replied'] += 1
                elif status == 'INTERESTED':
                    stats['interested'] += 1
                elif status == 'CLOSED':
                    stats['closed'] += 1
            
            # Вычисляем конверсию
            for variant, stats in variant_stats.items():
                if stats['sent'] > 0:
                    stats['conversion_rate'] = (stats['closed'] / stats['sent']) * 100
            
            # Определяем победителя
            winner = None
            best_rate = 0
            
            for variant, stats in variant_stats.items():
                if stats['sent'] >= min_samples and stats['conversion_rate'] > best_rate:
                    best_rate = stats['conversion_rate']
                    winner = variant
            
            return {
                'variants': variant_stats,
                'winner': winner,
                'winner_conversion_rate': best_rate,
                'total_samples': len(contacts)
            }
            
        except Exception as e:
            logger.error(f"Error in manual calculation: {e}")
            return {}


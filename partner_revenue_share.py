"""
MLM Партнерская система с Revenue Share
Логика расчета и начисления Revenue Share с ограничением 30% от личного дохода
"""

import os
import logging
from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
from decimal import Decimal, ROUND_DOWN
from supabase_manager import SupabaseManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PartnerRevenueShare:
    """Класс для управления Revenue Share партнеров"""
    
    # Константы
    REVENUE_SHARE_PERCENT = 5.0  # 5% на каждом уровне
    PERSONAL_INCOME_LIMIT_PERCENT = 30.0  # Максимум 30% от личного дохода
    MIN_PERSONAL_INCOME = 500.0  # Минимум $500/мес для активации
    MIN_CLIENT_BASE = 20  # Минимум 20 клиентов для активации
    MAX_LEVELS = 3  # Максимум 3 уровня
    
    # PV уровни на основе личного дохода
    PV_LEVELS = [
        {'min': 0, 'max': 999, 'pv': 3.0},      # Новичок: $0-999/мес → PV 3%
        {'min': 1000, 'max': 1999, 'pv': 5.0},  # Активный: $1,000-1,999/мес → PV 5%
        {'min': 2000, 'max': 4999, 'pv': 7.0},  # Растущий: $2,000-4,999/мес → PV 7%
        {'min': 5000, 'max': float('inf'), 'pv': 10.0}  # Премиум: $5,000+/мес → PV 10%
    ]
    
    def __init__(self, supabase_manager: SupabaseManager):
        self.db = supabase_manager
        
    def check_activation_conditions(self, partner_chat_id: str) -> bool:
        """
        Проверяет условия активации Revenue Share для партнера
        
        Условия:
        1. Личный доход >= $500/мес
        2. Клиентская база >= 20 клиентов
        3. Использует продукт (personal_income > 0)
        
        Returns:
            bool: True если все условия выполнены
        """
        try:
            # Вызываем SQL функцию для проверки условий
            result = self.db.client.rpc(
                'check_revenue_share_activation',
                {'partner_chat_id_param': partner_chat_id}
            ).execute()
            
            return result.data if result.data else False
            
        except Exception as e:
            logger.error(f"Ошибка при проверке условий активации для {partner_chat_id}: {e}")
            return False
    
    def calculate_revenue_share(
        self,
        partner_chat_id: str,
        source_partner_chat_id: str,
        system_revenue: float,
        level: int
    ) -> Dict[str, float]:
        """
        Рассчитывает Revenue Share для партнера с ограничением 30%
        
        Args:
            partner_chat_id: Chat ID партнера, который получает Revenue Share
            source_partner_chat_id: Chat ID партнера, с дохода которого рассчитывается Revenue Share
            system_revenue: Доход системы с source_partner ($)
            level: Уровень в сети (1-3)
            
        Returns:
            dict: {
                'calculated_amount': рассчитанная сумма,
                'personal_income_limit': лимит 30%,
                'final_amount': итоговая сумма с учетом лимита
            }
        """
        try:
            # Получаем данные партнера
            partner_data = self.db.client.table('partners').select(
                'personal_income_monthly, is_revenue_share_active'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if not partner_data.data:
                logger.warning(f"Партнер {partner_chat_id} не найден")
                return {
                    'calculated_amount': 0.0,
                    'personal_income_limit': 0.0,
                    'final_amount': 0.0
                }
            
            partner = partner_data.data
            
            # Проверяем активацию
            if not partner.get('is_revenue_share_active', False):
                logger.info(f"Revenue Share не активирован для партнера {partner_chat_id}")
                return {
                    'calculated_amount': 0.0,
                    'personal_income_limit': 0.0,
                    'final_amount': 0.0
                }
            
            # Рассчитываем Revenue Share (5% на каждом уровне)
            calculated_amount = system_revenue * (self.REVENUE_SHARE_PERCENT / 100.0)
            
            # Рассчитываем лимит (30% от личного дохода)
            personal_income = float(partner.get('personal_income_monthly', 0))
            personal_income_limit = personal_income * (self.PERSONAL_INCOME_LIMIT_PERCENT / 100.0)
            
            # Применяем ограничение
            final_amount = min(calculated_amount, personal_income_limit)
            
            return {
                'calculated_amount': round(calculated_amount, 2),
                'personal_income_limit': round(personal_income_limit, 2),
                'final_amount': round(final_amount, 2)
            }
            
        except Exception as e:
            logger.error(f"Ошибка при расчете Revenue Share: {e}")
            return {
                'calculated_amount': 0.0,
                'personal_income_limit': 0.0,
                'final_amount': 0.0
            }
    
    def process_revenue_share_for_period(
        self,
        period_start: date,
        period_end: date
    ) -> Dict[str, any]:
        """
        Обрабатывает Revenue Share за период для всех партнеров
        
        Args:
            period_start: Начало периода
            period_end: Конец периода
            
        Returns:
            dict: Статистика обработки
        """
        stats = {
            'total_processed': 0,
            'total_amount': 0.0,
            'errors': []
        }
        
        try:
            # Получаем всех активных партнеров
            partners = self.db.client.table('partners').select(
                'chat_id, personal_income_monthly, client_base_count, is_revenue_share_active'
            ).eq('is_revenue_share_active', True).execute()
            
            for partner in partners.data:
                partner_chat_id = partner['chat_id']
                
                # Получаем партнеров, которые используют базу этого партнера
                network = self.db.client.table('partner_network').select(
                    'referred_chat_id, level'
                ).eq('referrer_chat_id', partner_chat_id).eq('is_active', True).execute()
                
                for connection in network.data:
                    referred_chat_id = connection['referred_chat_id']
                    level = connection['level']
                    
                    # Получаем доход системы с этого партнера
                    system_revenue = self._get_system_revenue(referred_chat_id, period_start, period_end)
                    
                    if system_revenue > 0:
                        # Рассчитываем Revenue Share для всех уровней выше
                        self._calculate_and_store_revenue_share(
                            partner_chat_id,
                            referred_chat_id,
                            system_revenue,
                            level,
                            period_start,
                            period_end
                        )
                        
                        stats['total_processed'] += 1
            
            logger.info(f"Обработано Revenue Share за период {period_start} - {period_end}: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f"Ошибка при обработке Revenue Share: {e}")
            stats['errors'].append(str(e))
            return stats
    
    def _get_system_revenue(
        self,
        partner_chat_id: str,
        period_start: date,
        period_end: date
    ) -> float:
        """
        Получает доход системы с партнера за период
        
        Расчет: Оборот партнера × PV% (индивидуальный процент для каждого партнера)
        PV настраивается вручную в зависимости от отрасли
        """
        try:
            # Получаем PV партнера
            partner_data = self.db.client.table('partners').select(
                'pv_percent'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if not partner_data.data:
                logger.warning(f"Партнер {partner_chat_id} не найден, используем PV по умолчанию 10%")
                pv_percent = 10.0
            else:
                pv_percent = float(partner_data.data.get('pv_percent', 10.0))
            
            # Получаем транзакции партнера за период
            transactions = self.db.client.table('transactions').select(
                'total_amount'
            ).eq('partner_chat_id', partner_chat_id).gte(
                'date_time', period_start.isoformat()
            ).lte('date_time', period_end.isoformat()).execute()
            
            total_turnover = sum(float(t.get('total_amount', 0)) for t in transactions.data)
            
            # Доход системы = Оборот × PV%
            system_revenue = total_turnover * (pv_percent / 100.0)
            
            logger.info(
                f"Доход системы с партнера {partner_chat_id}: "
                f"Оборот=${total_turnover}, PV={pv_percent}%, Доход=${system_revenue}"
            )
            
            return round(system_revenue, 2)
            
        except Exception as e:
            logger.error(f"Ошибка при получении дохода системы: {e}")
            return 0.0
    
    def _calculate_and_store_revenue_share(
        self,
        partner_chat_id: str,
        source_partner_chat_id: str,
        system_revenue: float,
        level: int,
        period_start: date,
        period_end: date
    ):
        """
        Рассчитывает и сохраняет Revenue Share для партнера
        """
        try:
            # Рассчитываем Revenue Share
            calculation = self.calculate_revenue_share(
                partner_chat_id,
                source_partner_chat_id,
                system_revenue,
                level
            )
            
            if calculation['final_amount'] > 0:
                # Сохраняем в базу данных
                self.db.client.table('partner_revenue_share').insert({
                    'partner_chat_id': partner_chat_id,
                    'source_partner_chat_id': source_partner_chat_id,
                    'level': level,
                    'system_revenue': system_revenue,
                    'revenue_share_percent': self.REVENUE_SHARE_PERCENT,
                    'calculated_amount': calculation['calculated_amount'],
                    'personal_income_limit': calculation['personal_income_limit'],
                    'personal_income_30_percent': calculation['personal_income_limit'],
                    'final_amount': calculation['final_amount'],
                    'period_start': period_start.isoformat(),
                    'period_end': period_end.isoformat(),
                    'status': 'pending',
                    'description': f'Revenue Share {self.REVENUE_SHARE_PERCENT}% с уровня {level}'
                }).execute()
                
                logger.info(
                    f"Revenue Share для {partner_chat_id}: "
                    f"{calculation['final_amount']} (лимит: {calculation['personal_income_limit']})"
                )
            
        except Exception as e:
            logger.error(f"Ошибка при сохранении Revenue Share: {e}")
    
    def set_partner_pv(
        self,
        partner_chat_id: str,
        pv_percent: float,
        industry_type: Optional[str] = None
    ) -> bool:
        """
        Устанавливает PV (Partner Value) процент для партнера
        
        Args:
            partner_chat_id: Chat ID партнера
            pv_percent: Процент от доходов партнера (0-100)
            industry_type: Тип отрасли (опционально)
            
        Returns:
            bool: True если успешно установлено
        """
        try:
            if not (0 <= pv_percent <= 100):
                logger.error(f"Некорректный PV процент: {pv_percent}. Должен быть от 0 до 100")
                return False
            
            update_data = {
                'pv_percent': pv_percent
            }
            
            if industry_type:
                update_data['industry_type'] = industry_type
            
            self.db.client.table('partners').update(update_data).eq(
                'chat_id', partner_chat_id
            ).execute()
            
            logger.info(f"Установлен PV для партнера {partner_chat_id}: {pv_percent}%")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при установке PV: {e}")
            return False
    
    def get_partner_pv(self, partner_chat_id: str) -> Optional[float]:
        """
        Получает PV процент партнера
        
        Returns:
            float: PV процент или None если партнер не найден
        """
        try:
            partner = self.db.client.table('partners').select(
                'pv_percent, industry_type'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if partner.data:
                return float(partner.data.get('pv_percent', 10.0))
            return None
            
        except Exception as e:
            logger.error(f"Ошибка при получении PV: {e}")
            return None
    
    def set_industry_pv(self, industry_type: str, pv_percent: float) -> int:
        """
        Устанавливает PV для всех партнеров определенной отрасли
        
        Args:
            industry_type: Тип отрасли
            pv_percent: Процент PV
            
        Returns:
            int: Количество обновленных партнеров
        """
        try:
            if not (0 <= pv_percent <= 100):
                logger.error(f"Некорректный PV процент: {pv_percent}")
                return 0
            
            result = self.db.client.table('partners').update({
                'pv_percent': pv_percent,
                'industry_type': industry_type
            }).eq('industry_type', industry_type).execute()
            
            count = len(result.data) if result.data else 0
            logger.info(f"Обновлен PV для {count} партнеров отрасли {industry_type}: {pv_percent}%")
            return count
            
        except Exception as e:
            logger.error(f"Ошибка при установке PV для отрасли: {e}")
            return 0
    
    def calculate_pv_by_income(self, personal_income: float) -> float:
        """
        Рассчитывает PV на основе личного дохода партнера
        
        Логика:
        - $0-999/мес: PV = 3%
        - $1,000-1,999/мес: PV = 5%
        - $2,000-4,999/мес: PV = 7%
        - $5,000+/мес: PV = 10%
        
        Args:
            personal_income: Личный доход партнера ($/мес)
            
        Returns:
            float: PV процент
        """
        for level in self.PV_LEVELS:
            if level['min'] <= personal_income <= level['max']:
                return level['pv']
        
        # По умолчанию возвращаем минимальный PV
        return self.PV_LEVELS[0]['pv']
    
    def update_partner_income_and_clients(
        self,
        partner_chat_id: str,
        personal_income: float,
        client_count: int,
        auto_update_pv: bool = True
    ) -> bool:
        """
        Обновляет личный доход и количество клиентов партнера
        Автоматически обновляет PV на основе личного дохода
        
        Args:
            partner_chat_id: Chat ID партнера
            personal_income: Личный доход партнера ($/мес)
            client_count: Количество клиентов в базе
            auto_update_pv: Автоматически обновлять PV на основе дохода (по умолчанию True)
            
        Returns:
            bool: True если успешно обновлено
        """
        try:
            update_data = {
                'personal_income_monthly': personal_income,
                'client_base_count': client_count,
                'last_revenue_share_calculation': datetime.now().isoformat()
            }
            
            # Автоматически рассчитываем и обновляем PV
            if auto_update_pv:
                new_pv = self.calculate_pv_by_income(personal_income)
                
                # Получаем текущий PV для сравнения
                current_pv = self.get_partner_pv(partner_chat_id)
                
                if current_pv is None or new_pv != current_pv:
                    update_data['pv_percent'] = new_pv
                    logger.info(
                        f"Автоматическое обновление PV для {partner_chat_id}: "
                        f"{current_pv}% → {new_pv}% (доход=${personal_income}/мес)"
                    )
            
            # Обновляем данные партнера
            self.db.client.table('partners').update(update_data).eq(
                'chat_id', partner_chat_id
            ).execute()
            
            # Проверяем условия активации
            is_active = self.check_activation_conditions(partner_chat_id)
            
            logger.info(
                f"Обновлен партнер {partner_chat_id}: "
                f"доход=${personal_income}, клиентов={client_count}, "
                f"PV={update_data.get('pv_percent', 'не изменен')}, активен={is_active}"
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Ошибка при обновлении данных партнера: {e}")
            return False
    
    def get_partner_revenue_share_summary(
        self,
        partner_chat_id: str,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None
    ) -> Dict[str, any]:
        """
        Получает сводку по Revenue Share для партнера
        
        Returns:
            dict: Сводка с суммами и статистикой
        """
        try:
            if not period_start:
                period_start = date.today().replace(day=1)  # Начало текущего месяца
            if not period_end:
                period_end = date.today()
            
            # Получаем данные партнера
            partner = self.db.client.table('partners').select(
                'personal_income_monthly, client_base_count, is_revenue_share_active,'
                'revenue_share_monthly, total_revenue_share_earned'
            ).eq('chat_id', partner_chat_id).single().execute()
            
            if not partner.data:
                return {'error': 'Партнер не найден'}
            
            partner_data = partner.data
            
            # Получаем Revenue Share за период
            revenue_share = self.db.client.table('partner_revenue_share').select(
                'final_amount, status, level, created_at'
            ).eq('partner_chat_id', partner_chat_id).gte(
                'period_start', period_start.isoformat()
            ).lte('period_end', period_end.isoformat()).execute()
            
            total_pending = sum(
                float(r.get('final_amount', 0))
                for r in revenue_share.data
                if r.get('status') == 'pending'
            )
            total_paid = sum(
                float(r.get('final_amount', 0))
                for r in revenue_share.data
                if r.get('status') == 'paid'
            )
            
            personal_income = float(partner_data.get('personal_income_monthly', 0))
            limit_30_percent = personal_income * 0.30
            
            return {
                'partner_chat_id': partner_chat_id,
                'personal_income': personal_income,
                'client_base_count': partner_data.get('client_base_count', 0),
                'is_active': partner_data.get('is_revenue_share_active', False),
                'revenue_share_monthly': float(partner_data.get('revenue_share_monthly', 0)),
                'total_revenue_share_earned': float(partner_data.get('total_revenue_share_earned', 0)),
                'limit_30_percent': round(limit_30_percent, 2),
                'period_pending': round(total_pending, 2),
                'period_paid': round(total_paid, 2),
                'period_total': round(total_pending + total_paid, 2),
                'usage_percent': round((personal_income / (personal_income + total_paid)) * 100, 2) if (personal_income + total_paid) > 0 else 0,
                'revenue_share_percent': round((total_paid / (personal_income + total_paid)) * 100, 2) if (personal_income + total_paid) > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Ошибка при получении сводки Revenue Share: {e}")
            return {'error': str(e)}


# Пример использования
if __name__ == "__main__":
    from supabase_manager import SupabaseManager
    
    db = SupabaseManager()
    revenue_share = PartnerRevenueShare(db)
    
    partner_id = "123456789"
    
    # Пример 1: Автоматическое обновление PV при росте дохода
    revenue_share.update_partner_income_and_clients(
        partner_chat_id=partner_id,
        personal_income=600.0,  # $600/мес → PV автоматически = 3%
        client_count=25,
        auto_update_pv=True
    )
    
    # Пример 2: Рост дохода → автоматическое увеличение PV
    revenue_share.update_partner_income_and_clients(
        partner_chat_id=partner_id,
        personal_income=1200.0,  # $1,200/мес → PV автоматически = 5%
        client_count=30,
        auto_update_pv=True
    )
    
    # Пример 3: Значительный рост → PV = 7%
    revenue_share.update_partner_income_and_clients(
        partner_chat_id=partner_id,
        personal_income=2500.0,  # $2,500/мес → PV автоматически = 7%
        client_count=50,
        auto_update_pv=True
    )
    
    # Пример 4: Премиум уровень → PV = 10%
    revenue_share.update_partner_income_and_clients(
        partner_chat_id=partner_id,
        personal_income=5500.0,  # $5,500/мес → PV автоматически = 10%
        client_count=100,
        auto_update_pv=True
    )
    
    # Пример 5: Ручная установка PV (если нужно переопределить)
    revenue_share.set_partner_pv(
        partner_chat_id=partner_id,
        pv_percent=8.0,  # Ручная установка 8%
        industry_type="salon"
    )
    
    # Пример 6: Проверка условий активации
    is_active = revenue_share.check_activation_conditions(partner_id)
    print(f"Revenue Share активен: {is_active}")
    
    # Пример 7: Расчет Revenue Share
    calculation = revenue_share.calculate_revenue_share(
        partner_chat_id=partner_id,
        source_partner_chat_id="987654321",
        system_revenue=2000.0,
        level=2
    )
    print(f"Расчет Revenue Share: {calculation}")


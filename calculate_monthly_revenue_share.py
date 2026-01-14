#!/usr/bin/env python3
"""
Ежемесячный расчет Revenue Share
Запускать 1-го числа каждого месяца для расчета за прошлый месяц
"""

import os
import sys
from datetime import date, timedelta
from dotenv import load_dotenv
from partner_revenue_share import PartnerRevenueShare
from supabase_manager import SupabaseManager
import logging

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def calculate_last_month_revenue_share():
    """Рассчитывает Revenue Share за прошлый месяц"""
    try:
        sm = SupabaseManager()
        revenue_share = PartnerRevenueShare(sm)
        
        # Расчет за прошлый месяц
        today = date.today()
        first_day = today.replace(day=1)
        last_month_end = first_day - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        
        logger.info("=" * 60)
        logger.info("НАЧАЛО РАСЧЕТА REVENUE SHARE")
        logger.info("=" * 60)
        logger.info(f"Период: {last_month_start} - {last_month_end}")
        
        stats = revenue_share.process_revenue_share_for_period(
            period_start=last_month_start,
            period_end=last_month_end
        )
        
        logger.info("=" * 60)
        logger.info("РЕЗУЛЬТАТЫ РАСЧЕТА")
        logger.info("=" * 60)
        logger.info(f"Обработано выплат: {stats['total_processed']}")
        logger.info(f"Общая сумма: ${stats.get('total_amount', 0):.2f}")
        
        if stats.get('errors'):
            logger.error(f"Ошибки: {stats['errors']}")
        else:
            logger.info("✅ Расчет завершен успешно!")
        
        logger.info("=" * 60)
        
        return stats
        
    except Exception as e:
        logger.error(f"Критическая ошибка при расчете Revenue Share: {e}")
        import traceback
        traceback.print_exc()
        return None


def approve_pending_payments(period_start: date, period_end: date):
    """Одобряет все pending выплаты за период"""
    try:
        sm = SupabaseManager()
        
        # Получаем все pending выплаты за период
        payments = sm.client.table('partner_revenue_share').select(
            'id, partner_chat_id, final_amount'
        ).eq('status', 'pending').gte(
            'period_start', period_start.isoformat()
        ).lte('period_end', period_end.isoformat()).execute()
        
        if not payments.data:
            logger.info("Нет pending выплат для одобрения")
            return 0
        
        approved_count = 0
        total_amount = 0.0
        
        for payment in payments.data:
            try:
                # Одобряем выплату
                sm.client.table('partner_revenue_share').update({
                    'status': 'approved'
                }).eq('id', payment['id']).execute()
                
                approved_count += 1
                total_amount += float(payment.get('final_amount', 0))
                
                logger.info(
                    f"Одобрена выплата {payment['id']}: "
                    f"${payment.get('final_amount', 0):.2f} для партнера {payment['partner_chat_id']}"
                )
            except Exception as e:
                logger.error(f"Ошибка одобрения выплаты {payment['id']}: {e}")
        
        logger.info(f"Одобрено выплат: {approved_count}, общая сумма: ${total_amount:.2f}")
        return approved_count
        
    except Exception as e:
        logger.error(f"Ошибка при одобрении выплат: {e}")
        return 0


def main():
    """Главная функция"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Расчет Revenue Share за период')
    parser.add_argument(
        '--period',
        choices=['last_month', 'current_month', 'custom'],
        default='last_month',
        help='Период для расчета'
    )
    parser.add_argument(
        '--start',
        type=str,
        help='Начало периода (YYYY-MM-DD) для custom периода'
    )
    parser.add_argument(
        '--end',
        type=str,
        help='Конец периода (YYYY-MM-DD) для custom периода'
    )
    parser.add_argument(
        '--approve',
        action='store_true',
        help='Автоматически одобрить все pending выплаты'
    )
    
    args = parser.parse_args()
    
    # Определяем период
    today = date.today()
    
    if args.period == 'last_month':
        first_day = today.replace(day=1)
        period_end = first_day - timedelta(days=1)
        period_start = period_end.replace(day=1)
    elif args.period == 'current_month':
        period_start = today.replace(day=1)
        period_end = today
    elif args.period == 'custom':
        if not args.start or not args.end:
            logger.error("Для custom периода необходимо указать --start и --end")
            sys.exit(1)
        period_start = date.fromisoformat(args.start)
        period_end = date.fromisoformat(args.end)
    else:
        period_start = today.replace(day=1)
        period_end = today
    
    logger.info(f"Расчет Revenue Share за период: {period_start} - {period_end}")
    
    # Рассчитываем Revenue Share
    sm = SupabaseManager()
    revenue_share = PartnerRevenueShare(sm)
    
    stats = revenue_share.process_revenue_share_for_period(
        period_start=period_start,
        period_end=period_end
    )
    
    if stats is None:
        logger.error("Ошибка при расчете Revenue Share")
        sys.exit(1)
    
    logger.info(f"Обработано: {stats.get('total_processed', 0)} выплат")
    logger.info(f"Общая сумма: ${stats.get('total_amount', 0):.2f}")
    
    # Одобряем выплаты, если указано
    if args.approve:
        logger.info("Одобрение pending выплат...")
        approved = approve_pending_payments(period_start, period_end)
        logger.info(f"Одобрено выплат: {approved}")
    
    logger.info("✅ Расчет завершен!")
    sys.exit(0)


if __name__ == "__main__":
    main()
















#!/usr/bin/env python3
"""
Cron-задача для автоматических выплат комиссий через TON
Запускать: ежедневно или по расписанию

Использование:
    python3 cron_payout_processor.py --revenue-share  # Выплата Revenue Share
    python3 cron_payout_processor.py --referrals      # Выплата реферальных комиссий
    python3 cron_payout_processor.py --all            # Все выплаты
"""

import os
import sys
import logging
from datetime import date, timedelta
from decimal import Decimal
from dotenv import load_dotenv
from supabase_manager import SupabaseManager
from partner_revenue_share import PartnerRevenueShare
from ton_payment_service import TONPaymentService

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def process_monthly_revenue_share_payouts():
    """
    Выплачивает Revenue Share за прошлый месяц
    Запускать: 1-го числа каждого месяца
    """
    logger.info("=" * 60)
    logger.info("ОБРАБОТКА ВЫПЛАТ REVENUE SHARE")
    logger.info("=" * 60)
    
    try:
        sm = SupabaseManager()
        revenue_share = PartnerRevenueShare(sm)
        ton_service = TONPaymentService(sm)
        
        # Определяем период (прошлый месяц)
        today = date.today()
        first_day = today.replace(day=1)
        last_month_end = first_day - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)
        
        logger.info(f"Период: {last_month_start} - {last_month_end}")
        
        # 1. Запустить расчет Revenue Share (если еще не рассчитано)
        logger.info("Проверка расчета Revenue Share...")
        existing_calculations = sm.client.table('partner_revenue_share').select('id').eq(
            'period_start', last_month_start.isoformat()
        ).eq('period_end', last_month_end.isoformat()).execute()
        
        if not existing_calculations.data:
            logger.info("Расчет Revenue Share еще не выполнен, запускаю...")
            stats = revenue_share.process_revenue_share_for_period(
                period_start=last_month_start,
                period_end=last_month_end
            )
            logger.info(f"Расчет завершен: {stats.get('total_processed', 0)} выплат")
        else:
            logger.info(f"Расчет уже выполнен: {len(existing_calculations.data)} записей")
        
        # 2. Получить все approved выплаты за прошлый месяц
        payments = sm.client.table('partner_revenue_share').select(
            'id, partner_chat_id, final_amount, amount_usd, ton_tx_hash'
        ).eq('period_start', last_month_start.isoformat()).eq(
            'period_end', last_month_end.isoformat()
        ).eq('status', 'approved').is_('ton_tx_hash', 'null').execute()
        
        if not payments.data:
            logger.info("Нет approved выплат для обработки")
            return 0
        
        logger.info(f"Найдено {len(payments.data)} approved выплат для обработки")
        
        # 3. Обработать каждую выплату
        processed_count = 0
        failed_count = 0
        total_amount = Decimal('0')
        
        for payment in payments.data:
            payment_id = payment['id']
            partner_chat_id = payment['partner_chat_id']
            amount_usd = Decimal(str(payment.get('amount_usd') or payment.get('final_amount', 0)))
            
            logger.info(f"Обработка Revenue Share {payment_id} для партнера {partner_chat_id}: ${amount_usd}")
            
            try:
                success = ton_service.process_revenue_share_payment(payment_id)
                
                if success:
                    processed_count += 1
                    total_amount += amount_usd
                    logger.info(f"✅ Revenue Share {payment_id} успешно выплачена")
                else:
                    failed_count += 1
                    logger.error(f"❌ Ошибка выплаты Revenue Share {payment_id}")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Исключение при обработке Revenue Share {payment_id}: {e}")
        
        logger.info("=" * 60)
        logger.info(f"Обработано: {processed_count} выплат")
        logger.info(f"Ошибок: {failed_count}")
        logger.info(f"Общая сумма: ${total_amount} USD")
        logger.info("=" * 60)
        
        return processed_count
        
    except Exception as e:
        logger.error(f"Критическая ошибка при обработке Revenue Share выплат: {e}")
        import traceback
        traceback.print_exc()
        return 0


def process_referral_commissions_payouts(min_amount_usd: Decimal = Decimal('10.00')):
    """
    Выплачивает накопленные реферальные комиссии
    Запускать: ежедневно или еженедельно
    
    Args:
        min_amount_usd: Минимальная сумма для выплаты (по умолчанию $10)
    """
    logger.info("=" * 60)
    logger.info("ОБРАБОТКА ВЫПЛАТ РЕФЕРАЛЬНЫХ КОМИССИЙ")
    logger.info("=" * 60)
    logger.info(f"Минимальная сумма для выплаты: ${min_amount_usd} USD")
    
    try:
        sm = SupabaseManager()
        ton_service = TONPaymentService(sm)
        
        # 1. Получить всех партнеров с pending комиссиями
        # Нужно получить уникальных партнеров (referrer_chat_id) с pending комиссиями
        pending_commissions = sm.client.table('referral_rewards').select(
            'referrer_chat_id, amount_usd'
        ).eq('status', 'pending').like('reward_type', 'commission_%').execute()
        
        if not pending_commissions.data:
            logger.info("Нет pending комиссий для обработки")
            return 0
        
        # Группируем по партнерам
        partner_totals = {}
        for commission in pending_commissions.data:
            partner_id = commission['referrer_chat_id']
            amount = Decimal(str(commission.get('amount_usd', 0)))
            
            if partner_id not in partner_totals:
                partner_totals[partner_id] = Decimal('0')
            
            partner_totals[partner_id] += amount
        
        logger.info(f"Найдено {len(partner_totals)} партнеров с pending комиссиями")
        
        # 2. Обработать каждого партнера
        processed_count = 0
        failed_count = 0
        skipped_count = 0
        
        for partner_chat_id, total_amount in partner_totals.items():
            if total_amount < min_amount_usd:
                skipped_count += 1
                logger.info(f"⏭️  Партнер {partner_chat_id}: сумма ${total_amount} < порога ${min_amount_usd}, пропускаем")
                continue
            
            logger.info(f"Обработка комиссий для партнера {partner_chat_id}: ${total_amount} USD")
            
            try:
                success = ton_service.process_referral_commissions_batch(
                    partner_chat_id=partner_chat_id,
                    min_amount_usd=min_amount_usd
                )
                
                if success:
                    processed_count += 1
                    logger.info(f"✅ Комиссии для партнера {partner_chat_id} успешно выплачены")
                else:
                    failed_count += 1
                    logger.error(f"❌ Ошибка выплаты комиссий для партнера {partner_chat_id}")
                    
            except Exception as e:
                failed_count += 1
                logger.error(f"❌ Исключение при обработке комиссий для партнера {partner_chat_id}: {e}")
        
        logger.info("=" * 60)
        logger.info(f"Обработано: {processed_count} партнеров")
        logger.info(f"Пропущено: {skipped_count} партнеров (сумма < порога)")
        logger.info(f"Ошибок: {failed_count}")
        logger.info("=" * 60)
        
        return processed_count
        
    except Exception as e:
        logger.error(f"Критическая ошибка при обработке реферальных комиссий: {e}")
        import traceback
        traceback.print_exc()
        return 0


def main():
    """Главная функция для запуска из командной строки"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Обработка выплат комиссий через TON')
    parser.add_argument(
        '--revenue-share',
        action='store_true',
        help='Выплатить Revenue Share за прошлый месяц'
    )
    parser.add_argument(
        '--referrals',
        action='store_true',
        help='Выплатить накопленные реферальные комиссии'
    )
    parser.add_argument(
        '--all',
        action='store_true',
        help='Обработать все типы выплат'
    )
    parser.add_argument(
        '--min-amount',
        type=float,
        default=10.0,
        help='Минимальная сумма для выплаты реферальных комиссий (по умолчанию: 10.0 USD)'
    )
    
    args = parser.parse_args()
    
    if not (args.revenue_share or args.referrals or args.all):
        parser.print_help()
        sys.exit(1)
    
    total_processed = 0
    
    if args.revenue_share or args.all:
        count = process_monthly_revenue_share_payouts()
        total_processed += count
    
    if args.referrals or args.all:
        min_amount = Decimal(str(args.min_amount))
        count = process_referral_commissions_payouts(min_amount_usd=min_amount)
        total_processed += count
    
    logger.info(f"\n✅ Всего обработано: {total_processed} выплат")
    sys.exit(0 if total_processed > 0 else 1)


if __name__ == "__main__":
    main()

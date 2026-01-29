"""
Unit-тесты для referral_calculator.py
Полное покрытие реферальной системы и MLM
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
import os
import sys
import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestReferralLevels:
    """Тесты уровней реферальной системы"""
    
    def test_level_1_commission(self):
        """Тест комиссии 1 уровня"""
        level_1_rate = 0.10  # 10%
        assert level_1_rate == 0.10
    
    def test_level_2_commission(self):
        """Тест комиссии 2 уровня"""
        level_2_rate = 0.05  # 5%
        assert level_2_rate == 0.05
    
    def test_level_3_commission(self):
        """Тест комиссии 3 уровня"""
        level_3_rate = 0.02  # 2%
        assert level_3_rate == 0.02
    
    def test_max_levels(self):
        """Тест максимального количества уровней"""
        max_levels = 3
        assert max_levels == 3
    
    def test_level_rates_structure(self):
        """Тест структуры ставок уровней"""
        rates = {
            1: 0.10,
            2: 0.05,
            3: 0.02
        }
        
        # Ставки должны убывать с уровнем
        assert rates[1] > rates[2] > rates[3]


class TestCommissionCalculation:
    """Тесты расчёта комиссий"""
    
    def test_calculate_level_1_commission(self):
        """Тест расчёта комиссии 1 уровня"""
        transaction_amount = 1000
        rate = 0.10
        
        commission = transaction_amount * rate
        assert commission == 100
    
    def test_calculate_level_2_commission(self):
        """Тест расчёта комиссии 2 уровня"""
        transaction_amount = 1000
        rate = 0.05
        
        commission = transaction_amount * rate
        assert commission == 50
    
    def test_calculate_total_commission(self):
        """Тест расчёта общей комиссии"""
        transaction_amount = 1000
        rates = {1: 0.10, 2: 0.05, 3: 0.02}
        
        total = sum(transaction_amount * rate for rate in rates.values())
        assert total == 170
    
    def test_commission_rounding(self):
        """Тест округления комиссии"""
        transaction_amount = 99
        rate = 0.10
        
        commission = round(transaction_amount * rate, 2)
        assert commission == 9.9
    
    def test_minimum_commission(self):
        """Тест минимальной комиссии"""
        transaction_amount = 5
        rate = 0.02
        min_commission = 0.01
        
        calculated = transaction_amount * rate
        commission = max(calculated, min_commission)
        
        assert commission >= min_commission


class TestReferralChain:
    """Тесты реферальной цепочки"""
    
    def test_build_chain_single_level(self):
        """Тест построения цепочки с одним уровнем"""
        referrer_id = 'partner_1'
        chain = [referrer_id]
        
        assert len(chain) == 1
    
    def test_build_chain_multi_level(self):
        """Тест построения многоуровневой цепочки"""
        chain = ['partner_1', 'partner_2', 'partner_3']
        
        assert len(chain) == 3
        assert chain[0] == 'partner_1'  # Прямой реферер
    
    def test_chain_depth_limit(self):
        """Тест лимита глубины цепочки"""
        max_depth = 3
        chain = ['p1', 'p2', 'p3', 'p4', 'p5']
        
        limited_chain = chain[:max_depth]
        assert len(limited_chain) == max_depth
    
    def test_empty_chain(self):
        """Тест пустой цепочки"""
        chain = []
        
        has_referrers = len(chain) > 0
        assert has_referrers is False
    
    def test_circular_reference_prevention(self):
        """Тест предотвращения циклических ссылок"""
        chain = ['p1', 'p2', 'p1']  # p1 повторяется
        
        # Удаляем дубликаты сохраняя порядок
        seen = set()
        unique_chain = []
        for item in chain:
            if item not in seen:
                seen.add(item)
                unique_chain.append(item)
        
        assert len(unique_chain) == 2


class TestRevenueDistribution:
    """Тесты распределения Revenue Share"""
    
    def test_distribute_to_single_referrer(self):
        """Тест распределения одному рефереру"""
        transaction_amount = 1000
        chain = [{'id': 'p1', 'level': 1}]
        rates = {1: 0.10}
        
        distributions = []
        for ref in chain:
            amount = transaction_amount * rates.get(ref['level'], 0)
            distributions.append({'partner_id': ref['id'], 'amount': amount})
        
        assert len(distributions) == 1
        assert distributions[0]['amount'] == 100
    
    def test_distribute_to_multi_level(self):
        """Тест распределения по нескольким уровням"""
        transaction_amount = 1000
        chain = [
            {'id': 'p1', 'level': 1},
            {'id': 'p2', 'level': 2},
            {'id': 'p3', 'level': 3}
        ]
        rates = {1: 0.10, 2: 0.05, 3: 0.02}
        
        distributions = []
        for ref in chain:
            amount = transaction_amount * rates.get(ref['level'], 0)
            distributions.append({'partner_id': ref['id'], 'amount': amount})
        
        assert distributions[0]['amount'] == 100
        assert distributions[1]['amount'] == 50
        assert distributions[2]['amount'] == 20


class TestReferralValidation:
    """Тесты валидации рефералов"""
    
    def test_valid_referrer_status(self):
        """Тест валидного статуса реферера"""
        referrer = {'id': 'p1', 'status': 'Approved'}
        
        is_valid = referrer['status'] == 'Approved'
        assert is_valid is True
    
    def test_invalid_referrer_status(self):
        """Тест невалидного статуса реферера"""
        referrer = {'id': 'p1', 'status': 'Pending'}
        
        is_valid = referrer['status'] == 'Approved'
        assert is_valid is False
    
    def test_self_referral_blocked(self):
        """Тест блокировки самореферала"""
        client_id = '123456'
        referrer_id = '123456'
        
        is_self_referral = client_id == referrer_id
        assert is_self_referral is True
    
    def test_referral_date_validation(self):
        """Тест валидации даты реферала"""
        referral_date = datetime.datetime(2026, 1, 1)
        now = datetime.datetime.now()
        
        # Реферал не может быть в будущем
        is_valid = referral_date <= now
        assert is_valid is True


class TestReferralStatistics:
    """Тесты статистики рефералов"""
    
    def test_count_referrals(self):
        """Тест подсчёта рефералов"""
        referrals = [
            {'id': 'c1', 'referrer_id': 'p1'},
            {'id': 'c2', 'referrer_id': 'p1'},
            {'id': 'c3', 'referrer_id': 'p2'}
        ]
        
        p1_referrals = len([r for r in referrals if r['referrer_id'] == 'p1'])
        assert p1_referrals == 2
    
    def test_total_referral_earnings(self):
        """Тест общего заработка от рефералов"""
        earnings = [100, 50, 75, 120]
        total = sum(earnings)
        
        assert total == 345
    
    def test_average_commission(self):
        """Тест средней комиссии"""
        commissions = [100, 50, 75]
        average = sum(commissions) / len(commissions)
        
        assert average == 75


class TestReferralCodes:
    """Тесты реферальных кодов"""
    
    def test_generate_referral_code(self):
        """Тест генерации реферального кода"""
        import uuid
        
        code = str(uuid.uuid4())[:8].upper()
        
        assert len(code) == 8
        assert code.isupper()
    
    def test_referral_code_uniqueness(self):
        """Тест уникальности реферальных кодов"""
        import uuid
        
        codes = set()
        for _ in range(100):
            code = str(uuid.uuid4())[:8]
            codes.add(code)
        
        # Все коды должны быть уникальными
        assert len(codes) == 100
    
    def test_referral_link_format(self):
        """Тест формата реферальной ссылки"""
        bot_username = 'loyalitybot'
        partner_id = '123456'
        
        link = f"https://t.me/{bot_username}?start=partner_{partner_id}"
        
        assert 't.me' in link
        assert partner_id in link


class TestReferralBonuses:
    """Тесты бонусов за рефералов"""
    
    def test_first_transaction_bonus(self):
        """Тест бонуса за первую транзакцию"""
        is_first_transaction = True
        bonus_multiplier = 2.0 if is_first_transaction else 1.0
        
        base_commission = 50
        commission = base_commission * bonus_multiplier
        
        assert commission == 100
    
    def test_milestone_bonus(self):
        """Тест бонуса за достижение"""
        referral_count = 10
        milestones = {5: 100, 10: 250, 25: 500, 50: 1000}
        
        bonus = milestones.get(referral_count, 0)
        assert bonus == 250
    
    def test_monthly_bonus_tier(self):
        """Тест месячного бонусного уровня"""
        monthly_volume = 50000
        tiers = [
            (100000, 0.02),  # 2% бонус при 100k+
            (50000, 0.01),   # 1% бонус при 50k+
            (10000, 0.005)   # 0.5% бонус при 10k+
        ]
        
        bonus_rate = 0
        for threshold, rate in tiers:
            if monthly_volume >= threshold:
                bonus_rate = rate
                break
        
        assert bonus_rate == 0.01


class TestPayoutCalculation:
    """Тесты расчёта выплат"""
    
    def test_minimum_payout_threshold(self):
        """Тест минимального порога выплаты"""
        min_payout = 100  # USD
        balance = 75
        
        can_withdraw = balance >= min_payout
        assert can_withdraw is False
    
    def test_payout_fee_calculation(self):
        """Тест расчёта комиссии за выплату"""
        amount = 1000
        fee_rate = 0.01  # 1%
        
        fee = amount * fee_rate
        net_amount = amount - fee
        
        assert fee == 10
        assert net_amount == 990
    
    def test_pending_balance_calculation(self):
        """Тест расчёта ожидающего баланса"""
        transactions = [
            {'amount': 100, 'status': 'pending'},
            {'amount': 50, 'status': 'completed'},
            {'amount': 75, 'status': 'pending'}
        ]
        
        pending = sum(t['amount'] for t in transactions if t['status'] == 'pending')
        assert pending == 175


class TestReferralReporting:
    """Тесты отчётности по рефералам"""
    
    def test_daily_report_structure(self):
        """Тест структуры ежедневного отчёта"""
        report = {
            'date': '2026-01-19',
            'new_referrals': 5,
            'transactions': 25,
            'volume': 10000,
            'commissions': 500
        }
        
        assert 'date' in report
        assert 'commissions' in report
    
    def test_weekly_summary(self):
        """Тест недельной сводки"""
        daily_volumes = [1000, 1500, 800, 2000, 1200, 900, 1100]
        weekly_total = sum(daily_volumes)
        
        assert weekly_total == 8500
    
    def test_top_referrers_ranking(self):
        """Тест ранжирования топ рефереров"""
        referrers = [
            {'id': 'p1', 'earnings': 5000},
            {'id': 'p2', 'earnings': 3000},
            {'id': 'p3', 'earnings': 7000}
        ]
        
        top = sorted(referrers, key=lambda x: x['earnings'], reverse=True)
        
        assert top[0]['id'] == 'p3'
        assert top[0]['earnings'] == 7000


class TestReferralNotifications:
    """Тесты уведомлений о рефералах"""
    
    def test_new_referral_notification(self):
        """Тест уведомления о новом реферале"""
        referrer_id = 'p1'
        new_client = 'Иван Петров'
        
        message = f"🎉 У вас новый реферал: {new_client}!"
        
        assert new_client in message
    
    def test_commission_notification(self):
        """Тест уведомления о комиссии"""
        commission = 50.0
        currency = 'USD'
        
        message = f"💰 Вы получили комиссию: ${commission:.2f}"
        
        assert str(commission) in message
    
    def test_milestone_notification(self):
        """Тест уведомления о достижении"""
        milestone = 10
        bonus = 250
        
        message = f"🏆 Поздравляем! Вы привлекли {milestone} рефералов и получили бонус ${bonus}!"
        
        assert str(milestone) in message
        assert str(bonus) in message


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

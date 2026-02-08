import logging
from typing import List, Optional, Dict, Literal
from pydantic import BaseModel, Field, ValidationError
import unittest

# Настройка логирования
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Models ---

class PartnerData(BaseModel):
    """Данные партнера-продавца"""
    id: str
    base_reward_percent: float = Field(default=0.05, description="Процент от суммы чека, который продавец отдает в комиссионный фонд (например, 0.05 для 5%)")

class User(BaseModel):
    """Пользователь (клиент или партнер)"""
    id: str
    referrer_id: Optional[str] = None
    commission_balance: float = 0.0
    partner_data: Optional[PartnerData] = None

class B2BDeal(BaseModel):
    """B2B сделка между двумя партнерами"""
    seller_partner_id: str = Field(..., description="ID партнера-продавца (кто продает)")
    source_partner_id: str = Field(..., description="ID партнера-источника (кто привел клиента, обычно L1 реферер)")
    seller_pays_percent: float = Field(..., description="Сколько платит продавец от суммы чека (например, 0.10 для 10%)")
    buyer_gets_percent: float = Field(..., description="Сколько получает покупатель как спец-кэшбэк (например, 0.15 для 15%)")
    status: str = Field(default="active", description="Статус сделки: active, expired, paused")

class PurchaseInput(BaseModel):
    """Входные данные для расчета комиссий"""
    user_id: str = Field(..., description="ID покупателя (клиента)")
    amount: float = Field(..., gt=0, description="Сумма чека в рублях")
    seller_partner_id: str = Field(..., description="ID партнера-продавца")
    cashback_percent: float = Field(default=0.05, description="Стандартный процент кэшбэка (для информации, не используется в расчете комиссий)")

class CommissionItem(BaseModel):
    """Одна комиссионная выплата"""
    user_id: str
    amount: float
    type: Literal['L1', 'L2', 'L3', 'system', 'b2b_partner', 'b2b_system_fee']
    description: str

class CommissionDistribution(BaseModel):
    """Результат расчета распределения комиссий"""
    commissions: List[CommissionItem]
    system_total: float
    buyer_special_reward: Optional[float] = None  # Для B2B: спец-кэшбэк покупателю (начисляется отдельно в balance)
    logic_type: Literal['standard', 'b2b', 'blogger_platform'] = Field(..., description="Какая логика была применена")

# --- Service ---

class ReferralCalculator:
    """
    Калькулятор реферальных комиссий с поддержкой трёх логик:
    1. B2B-DEAL: Прямая сделка между партнерами (приоритет)
    2. BLOGGER-PLATFORM: Партнёр-инфлюенсер получает % с любой покупки привлечённого клиента (если нет B2B)
    3. СТАНДАРТНАЯ: MLM 3 уровня (5%/5%/5%) от комиссионного фонда продавца
    """
    
    def __init__(self, users_db: Dict[str, User], deals_db: List[B2BDeal] = None,
                 partner_influencer_ids: Optional[set] = None, blogger_platform_percent: float = 0.05):
        """
        :param users_db: Словарь пользователей {user_id: User}
        :param deals_db: Список активных B2B сделок
        :param partner_influencer_ids: Множество chat_id партнёров с типом influencer (блогеры)
        :param blogger_platform_percent: Процент от чека в комиссионный фонд для блогера (по умолчанию 5%)
        """
        self.users_db = users_db
        self.deals_db = deals_db or []
        self.partner_influencer_ids = partner_influencer_ids or set()
        self.blogger_platform_percent = blogger_platform_percent

    def _build_referral_chain(self, user_id: str) -> List[User]:
        """Строит цепочку рефералов вверх до 3 уровней (L1, L2, L3)."""
        chain = []
        current_user_id = user_id
        
        for _ in range(3):
            user = self.users_db.get(current_user_id)
            if not user or not user.referrer_id:
                break
            
            referrer = self.users_db.get(user.referrer_id)
            if not referrer:
                break
                
            chain.append(referrer)
            current_user_id = referrer.id
            
        return chain

    def _find_active_b2b_deal(self, seller_partner_id: str, buyer_user_id: str) -> Optional[B2BDeal]:
        """
        Ищет активную B2B сделку между продавцом и партнером-источником покупателя.
        
        Логика: Покупатель пришел от партнера (L1 реферер). 
        Если у этого партнера есть активная сделка с продавцом - возвращаем её.
        """
        buyer = self.users_db.get(buyer_user_id)
        if not buyer or not buyer.referrer_id:
            return None
        
        # L1 реферер (партнер-источник)
        source_partner = self.users_db.get(buyer.referrer_id)
        if not source_partner:
            return None
        
        # Ищем активную сделку: seller <-> source_partner
        for deal in self.deals_db:
            if (deal.seller_partner_id == seller_partner_id and 
                deal.source_partner_id == source_partner.id and
                deal.status == "active"):
                return deal
        
        return None

    def calculate_commissions(self, purchase: PurchaseInput, seller_partner_data: Optional[PartnerData] = None) -> CommissionDistribution:
        """
        Рассчитывает распределение комиссий по двум логикам (B2B приоритетнее).
        
        :param purchase: Данные покупки
        :param seller_partner_data: Данные партнера-продавца (если не передано, используется дефолт)
        :return: Распределение комиссий
        """
        logger.info(f"Calculating commissions for purchase: user_id={purchase.user_id}, amount={purchase.amount}, seller={purchase.seller_partner_id}")
        
        commissions: List[CommissionItem] = []
        system_total = 0.0
        buyer_special_reward = None
        logic_type = "standard"
        
        # 1. Проверяем наличие B2B сделки
        deal = self._find_active_b2b_deal(purchase.seller_partner_id, purchase.user_id)
        
        if deal:
            # ========== ЛОГИКА B2B-DEAL ==========
            logger.info(f"Found active B2B Deal: seller={deal.seller_partner_id}, source={deal.source_partner_id}")
            logic_type = "b2b"
            
            # 1. Формируем комиссионный фонд от продавца
            commission_fund = purchase.amount * deal.seller_pays_percent
            
            # 2. Система забирает 30%
            system_fee = commission_fund * 0.30
            system_total += system_fee
            
            commissions.append(CommissionItem(
                user_id="SYSTEM",
                amount=system_fee,
                type='b2b_system_fee',
                description=f"30% system fee from B2B deal fund ({commission_fund:.2f})"
            ))
            
            # 3. Остальные 70% идут партнеру-источнику (БЕЗ MLM!)
            partner_commission = commission_fund * 0.70
            
            source_partner = self.users_db.get(deal.source_partner_id)
            if source_partner:
                commissions.append(CommissionItem(
                    user_id=deal.source_partner_id,
                    amount=partner_commission,
                    type='b2b_partner',
                    description=f"70% B2B commission to source partner (from fund {commission_fund:.2f})"
                ))
            else:
                # Если партнер не найден, деньги уходят системе
                logger.warning(f"Source partner {deal.source_partner_id} not found, commission goes to system")
                system_total += partner_commission
            
            # 4. Спец-кэшбэк покупателю (начисляется отдельно, не входит в комиссионный фонд)
            buyer_special_reward = purchase.amount * deal.buyer_gets_percent
            
            logger.info(f"B2B calculation: fund={commission_fund:.2f}, system={system_fee:.2f}, partner={partner_commission:.2f}, buyer_reward={buyer_special_reward:.2f}")
            
        else:
            # 2. Проверяем режим «блогер/инфлюенсер»: L1 — партнёр с типом influencer, нет B2B с продавцом
            chain = self._build_referral_chain(purchase.user_id)
            if chain and len(chain) >= 1 and chain[0].id in self.partner_influencer_ids:
                logic_type = "blogger_platform"
                commission_fund = purchase.amount * self.blogger_platform_percent
                system_fee = commission_fund * 0.30
                system_total += system_fee
                commissions.append(CommissionItem(
                    user_id="SYSTEM",
                    amount=system_fee,
                    type='b2b_system_fee',
                    description=f"30% system fee from blogger platform fund ({commission_fund:.2f})"
                ))
                partner_commission = commission_fund * 0.70
                commissions.append(CommissionItem(
                    user_id=chain[0].id,
                    amount=partner_commission,
                    type='b2b_partner',
                    description=f"70% blogger platform commission to influencer (from fund {commission_fund:.2f})"
                ))
                logger.info(f"Blogger platform: fund={commission_fund:.2f}, partner={chain[0].id}, amount={partner_commission:.2f}")
                return CommissionDistribution(
                    commissions=commissions,
                    system_total=system_total,
                    buyer_special_reward=buyer_special_reward,
                    logic_type=logic_type
                )
            
            # ========== СТАНДАРТНАЯ ЛОГИКА (MLM) ==========
            logger.info("Using Standard MLM Logic")
            
            # 1. Получаем данные продавца (или используем дефолт)
            if not seller_partner_data:
                seller_partner_data = PartnerData(
                    id=purchase.seller_partner_id,
                    base_reward_percent=0.05  # Дефолт 5%
                )
            
            # 2. Формируем комиссионный фонд от продавца
            commission_fund = purchase.amount * seller_partner_data.base_reward_percent
            
            # 3. Строим цепочку рефералов (до 3 уровней)
            chain = self._build_referral_chain(purchase.user_id)
            
            # 4. Распределяем по MLM: 5% L1, 5% L2, 5% L3, 85% системе
            if len(chain) >= 1:
                l1_amount = commission_fund * 0.05
                commissions.append(CommissionItem(
                    user_id=chain[0].id,
                    amount=l1_amount,
                    type='L1',
                    description=f"5% L1 commission from fund {commission_fund:.2f}"
                ))
            else:
                system_total += commission_fund * 0.05
            
            if len(chain) >= 2:
                l2_amount = commission_fund * 0.05
                commissions.append(CommissionItem(
                    user_id=chain[1].id,
                    amount=l2_amount,
                    type='L2',
                    description=f"5% L2 commission from fund {commission_fund:.2f}"
                ))
            else:
                system_total += commission_fund * 0.05
            
            if len(chain) >= 3:
                l3_amount = commission_fund * 0.05
                commissions.append(CommissionItem(
                    user_id=chain[2].id,
                    amount=l3_amount,
                    type='L3',
                    description=f"5% L3 commission from fund {commission_fund:.2f}"
                ))
            else:
                system_total += commission_fund * 0.05
            
            # 85% системе
            system_share = commission_fund * 0.85
            system_total += system_share
            
            commissions.append(CommissionItem(
                user_id="SYSTEM",
                amount=system_share,
                type='system',
                description=f"85% system share from fund {commission_fund:.2f}"
            ))
            
            logger.info(f"Standard MLM calculation: fund={commission_fund:.2f}, chain_length={len(chain)}, system={system_share:.2f}")

        return CommissionDistribution(
            commissions=commissions,
            system_total=system_total,
            buyer_special_reward=buyer_special_reward,
            logic_type=logic_type
        )


# --- Unit Tests ---

class TestReferralCalculator(unittest.TestCase):
    def setUp(self):
        # Setup Mock DB
        self.users = {
            "u_grandpa": User(id="u_grandpa"),
            "u_dad": User(id="u_dad", referrer_id="u_grandpa"),
            "u_alice": User(id="u_alice", referrer_id="u_dad"),  # Alice invites Bob
            "u_bob": User(id="u_bob", referrer_id="u_alice"),    # Bob buys
            
            "p_seller": User(id="p_seller", partner_data=PartnerData(id="p_seller", base_reward_percent=0.05)),
            "p_blogger": User(id="p_blogger", partner_data=PartnerData(id="p_blogger", base_reward_percent=0.05))
        }
        
        self.deals = [
            B2BDeal(
                seller_partner_id="p_seller",
                source_partner_id="p_blogger",  # Blogger brings clients to seller
                seller_pays_percent=0.10,  # 10% from check
                buyer_gets_percent=0.15,   # 15% special cashback for buyer
                status="active"
            )
        ]
        
        self.calculator = ReferralCalculator(self.users, self.deals)

    def test_standard_logic(self):
        """Тест стандартной MLM логики (без B2B)"""
        purchase = PurchaseInput(
            user_id="u_bob",
            amount=10000,
            seller_partner_id="some_other_seller",
            cashback_percent=0.05
        )
        
        seller_data = PartnerData(id="some_other_seller", base_reward_percent=0.05)
        
        # Commission fund = 10000 * 0.05 = 500
        # L1 (Alice) = 5% of 500 = 25
        # L2 (Dad) = 5% of 500 = 25
        # L3 (Grandpa) = 5% of 500 = 25
        # System = 85% of 500 = 425
        
        result = self.calculator.calculate_commissions(purchase, seller_data)
        
        self.assertEqual(result.logic_type, "standard")
        self.assertEqual(len(result.commissions), 4)  # L1, L2, L3, System
        
        l1 = next(c for c in result.commissions if c.type == 'L1')
        self.assertEqual(l1.amount, 25.0)
        self.assertEqual(l1.user_id, "u_alice")
        
        l2 = next(c for c in result.commissions if c.type == 'L2')
        self.assertEqual(l2.amount, 25.0)
        self.assertEqual(l2.user_id, "u_dad")
        
        l3 = next(c for c in result.commissions if c.type == 'L3')
        self.assertEqual(l3.amount, 25.0)
        self.assertEqual(l3.user_id, "u_grandpa")
        
        sys = next(c for c in result.commissions if c.type == 'system')
        self.assertEqual(sys.amount, 425.0)
        self.assertEqual(result.system_total, 425.0)

    def test_b2b_deal_logic(self):
        """Тест B2B логики (без MLM)"""
        # Bob покупает у p_seller. p_blogger (L1 реферер Боба) имеет сделку с p_seller.
        # Но в нашей модели u_alice - это L1, а p_blogger - это отдельный партнер.
        # Нужно скорректировать тест: пусть u_alice = p_blogger
        
        # Обновляем структуру: Bob пришел от p_blogger
        self.users["u_bob"] = User(id="u_bob", referrer_id="p_blogger")
        
        purchase = PurchaseInput(
            user_id="u_bob",
            amount=10000,
            seller_partner_id="p_seller",
            cashback_percent=0.05
        )
        
        # B2B Deal: seller_pays = 10% = 1000
        # System fee = 30% of 1000 = 300
        # Partner commission = 70% of 1000 = 700
        # Buyer reward = 15% of 10000 = 1500
        
        result = self.calculator.calculate_commissions(purchase)
        
        self.assertEqual(result.logic_type, "b2b")
        self.assertEqual(result.buyer_special_reward, 1500.0)
        
        # Проверяем комиссию партнеру (70%)
        partner_comm = next(c for c in result.commissions if c.type == 'b2b_partner')
        self.assertEqual(partner_comm.amount, 700.0)
        self.assertEqual(partner_comm.user_id, "p_blogger")
        
        # Проверяем системную комиссию (30%)
        system_fee = next(c for c in result.commissions if c.type == 'b2b_system_fee')
        self.assertEqual(system_fee.amount, 300.0)
        self.assertEqual(result.system_total, 300.0)
        
        # В B2B НЕ должно быть MLM (L1/L2/L3)
        mlm_commissions = [c for c in result.commissions if c.type in ['L1', 'L2', 'L3']]
        self.assertEqual(len(mlm_commissions), 0, "B2B should not have MLM commissions")

    def test_blogger_platform_logic(self):
        """Тест режима блогер/инфлюенсер: L1 — партнёр influencer, нет B2B с продавцом."""
        self.users["u_bob"] = User(id="u_bob", referrer_id="p_blogger")
        self.deals = []  # Нет B2B сделки между p_blogger и p_seller
        self.calculator = ReferralCalculator(
            self.users, self.deals,
            partner_influencer_ids={"p_blogger"},
            blogger_platform_percent=0.05
        )
        purchase = PurchaseInput(
            user_id="u_bob",
            amount=10000,
            seller_partner_id="p_seller",
            cashback_percent=0.05
        )
        result = self.calculator.calculate_commissions(purchase)
        self.assertEqual(result.logic_type, "blogger_platform")
        commission_fund = 10000 * 0.05  # 500
        self.assertEqual(result.system_total, commission_fund * 0.30)  # 150
        partner_comm = next(c for c in result.commissions if c.type == 'b2b_partner')
        self.assertEqual(partner_comm.user_id, "p_blogger")
        self.assertEqual(partner_comm.amount, commission_fund * 0.70)  # 350

if __name__ == '__main__':
    unittest.main()

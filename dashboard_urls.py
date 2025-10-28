"""
Конфигурация URL-ов для дашбордов и одностраничников
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Базовый URL фронтенда (из переменных окружения или дефолтный)
FRONTEND_BASE_URL = os.environ.get('FRONTEND_URL', 'https://your-frontend-url.vercel.app')

# URL дашбордов
PARTNER_DASHBOARD_URL = f"{FRONTEND_BASE_URL}/partner/analytics"
ADMIN_DASHBOARD_URL = f"{FRONTEND_BASE_URL}/admin/analytics"  # Админский расширенный дашборд

# URL одностраничников
ONE_PAGER_PARTNER_URL = f"{FRONTEND_BASE_URL}/onepager/partner"
ONE_PAGER_CLIENT_URL = f"{FRONTEND_BASE_URL}/onepager/client"
ONE_PAGER_INVESTOR_URL = f"{FRONTEND_BASE_URL}/onepager/investor"

# Альтернативно - можно использовать прямые ссылки на markdown файлы
ONE_PAGER_PARTNER_MD = "https://raw.githubusercontent.com/your-repo/main/ONE_PAGER_PARTNER.md"
ONE_PAGER_CLIENT_MD = "https://raw.githubusercontent.com/your-repo/main/ONE_PAGER_CLIENT.md"
ONE_PAGER_INVESTOR_MD = "https://raw.githubusercontent.com/your-repo/main/ONE_PAGER_INVESTOR.md"

def get_partner_dashboard_url(partner_chat_id: str) -> str:
    """Генерирует URL дашборда партнера с его ID"""
    return f"{PARTNER_DASHBOARD_URL}?partner_id={partner_chat_id}"

def get_admin_dashboard_url() -> str:
    """Возвращает URL админского дашборда"""
    return ADMIN_DASHBOARD_URL

def get_onepager_url(onepager_type: str) -> str:
    """
    Возвращает URL одностраничника по типу
    
    Args:
        onepager_type: 'partner', 'client', или 'investor'
    """
    urls = {
        'partner': ONE_PAGER_PARTNER_URL,
        'client': ONE_PAGER_CLIENT_URL,
        'investor': ONE_PAGER_INVESTOR_URL
    }
    return urls.get(onepager_type, FRONTEND_BASE_URL)


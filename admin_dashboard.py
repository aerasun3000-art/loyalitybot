# admin_dashboard.py
import streamlit as st
import pandas as pd
import sys
import os
import requests 

# Добавляем корневой каталог для импорта managers
sys.path.append(os.path.dirname(__file__)) 
from supabase_manager import SupabaseManager 


# --- КОНФИГУРАЦИЯ ---

# КРИТИЧНО: Используем токен Партнерского бота для отправки уведомлений!
# Убедитесь, что TOKEN_PARTNER установлен в вашем окружении (или .env)
TOKEN_PARTNER = os.environ.get('TOKEN_PARTNER') 

CLIENT_RENAME_MAP = {
    'name': 'имя', 
    'phone': 'телефон', 
    'balance': 'Баланс', 
    'status': 'Статус', 
    'username': 'username', 
    'chat_id': 'chat_id', 
    'city': 'город', 
    'district': 'район', 
    'reg_date': 'дата регистрации', 
    'last_visit': 'последний визит', 
    'pref_partner': 'предпочитаемый партнер',
    'registered_via': 'зарегистрирован через',
    'total_bonus_spent': 'Общая сумма потраченных бонусов',
    'total_money_spent': 'Общая сумма потраченных денег',
}

PARTNER_RENAME_MAP = {
    'name': 'имя партнера', 
    'phone': 'телефон', 
    'city': 'город', 
    'district': 'район', 
    'status': 'статус', 
    'username': 'username', 
    'chat_id': 'chat_id', 
    'reg_date': 'дата регистрации', 
    'registered_via': 'зарегистрирован через', 
    'income': 'доход', 
    'bonuses': 'бонусы',
}


# --- Инициализация и Загрузка Данных ---

try:
    sm = SupabaseManager() 
except Exception as e:
    st.error(f"FATAL: Ошибка инициализации SupabaseManager: {e}")
    st.stop()

@st.cache_data(ttl=5) 
def load_data(_sm):
    try:
        clients_df = _sm.get_all_clients()
        partners_df = _sm.get_all_partners()
        transactions_df = _sm.get_all_transactions()
        
        if not clients_df.empty:
            clients_df.rename(columns=CLIENT_RENAME_MAP, inplace=True)
            clients_df.columns = [str(col).lower() for col in clients_df.columns]

        if not partners_df.empty:
            partners_df.rename(columns=PARTNER_RENAME_MAP, inplace=True)
            partners_df.columns = [str(col).lower() for col in partners_df.columns]
        
        if 'общая сумма потраченных денег' in clients_df.columns:
            clients_df['общая сумма потраченных денег'] = pd.to_numeric(clients_df['общая сумма потраченных денег'], errors='coerce').fillna(0)
        
        return clients_df, partners_df, transactions_df
        
    except Exception as e:
        st.error(f"Ошибка при загрузке данных: {e}")
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()


# --- НОВАЯ ФУНКЦИЯ ДЛЯ УВЕДОМЛЕНИЙ ---

def send_telegram_notification(chat_id, message):
    """Отправляет сообщение через Партнерский Бот."""
    if not TOKEN_PARTNER:
        print("Ошибка: TOKEN_PARTNER не установлен. Уведомление не отправлено.")
        return
        
    url = f"https://api.telegram.org/bot{TOKEN_PARTNER}/sendMessage"
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'Markdown'
    }
    try:
        requests.post(url, data=payload, timeout=5)
    except Exception as e:
        print(f"Ошибка при отправке уведомления партнеру {chat_id}: {e}")

# --- КОЛБЭКИ (С АВТО-УВЕДОМЛЕНИЕМ) ---

def approve_partner_callback(chat_id):
    if sm.approve_partner(chat_id):
        # --- ЛОГИКА АВТО-УВЕДОМЛЕНИЯ ПАРТНЕРУ (Используем TOKEN_PARTNER) ---
        text = (
            "🎉 **Поздравляем!** Ваш аккаунт партнера **ОДОБРЕН**! "
            "Теперь вы можете пользоваться всеми функциями.\n"
            "Нажмите /start, чтобы увидеть рабочее меню."
        )
        send_telegram_notification(chat_id, text)
        # --- КОНЕЦ ЛОГИКИ УВЕДОМЛЕНИЯ ---
        
        st.session_state['approved_id'] = chat_id
    else:
        st.session_state['error'] = f"Не удалось одобрить партнера {chat_id}."

def reject_partner_callback(chat_id):
    if sm.reject_partner(chat_id):
        # --- ОТПРАВКА УВЕДОМЛЕНИЯ ОБ ОТКЛОНЕНИИ ---
        text = (
            "❌ Ваша заявка Партнера была **отклонена**. "
            "Пожалуйста, свяжитесь с Администратором для получения подробностей."
        )
        send_telegram_notification(chat_id, text)
        # --- КОНЕЦ ЛОГИКИ УВЕДОМЛЕНИЯ ---
        st.session_state['rejected_id'] = chat_id
    else:
        st.session_state['error'] = f"Не удалось отклонить партнера {chat_id}."

# --- ОТОБРАЖЕНИЕ (Остальной код без изменений) ---
st.set_page_config(layout="wide")
st.title("⚙️ Админка Системы Лояльности")

clients_df, partners_df, transactions_df = load_data(sm)

if st.session_state.get('error'):
    st.error(st.session_state['error'])
    st.session_state['error'] = None 
    
if clients_df.empty or partners_df.empty:
    if st.button("Попробовать загрузить данные еще раз"):
        st.cache_data.clear()
        st.experimental_rerun()
        
    st.warning("Внимание: Данные клиентов или партнеров не загружены. Проверьте консоль.")
    st.stop()


# --- АНАЛИТИКА (Вкладка 1) ---
tab1, tab2, tab3 = st.tabs(["📊 Аналитика", "👥 Управление Клиентами", "🤝 Управление Партнерами"])

with tab1:
    st.header("Ключевые показатели")
    
    total_clients = len(clients_df)
    total_partners = len(partners_df)
    
    if 'статус' in clients_df.columns:
        active_clients = clients_df[clients_df['статус'] == 'active'].shape[0]
    else:
        active_clients = 0
    
    if 'статус' in partners_df.columns:
        pending_partners = partners_df[partners_df['статус'] == 'pending'].shape[0]
    else:
        pending_partners = 0
        
    
    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.metric(label="Всего клиентов", value=total_clients)
    with col2:
        st.metric(label="Активных клиентов", value=active_clients)
    with col3:
        st.metric(label="Всего партнеров", value=total_partners)
    with col4:
        st.metric(label="Заявок в ожидании", value=pending_partners)
    
    st.markdown("---")
    
    st.subheader("Распределение клиентов по статусу")
    status_counts = clients_df['статус'].value_counts().reset_index()
    status_counts.columns = ['Статус', 'Количество']
    st.bar_chart(status_counts, x='Статус', y='Количество')

    st.subheader("Распределение партнеров по городу")
    city_counts = partners_df['город'].value_counts().reset_index()
    city_counts.columns = ['Город', 'Количество']
    st.bar_chart(city_counts, x='Город', y='Количество')


with tab2:
    st.header("Управление Клиентами")
    st.dataframe(clients_df.drop(columns=['chat_id']), use_container_width=True)


with tab3:
    st.header("Управление Заявками Партнеров")
    
    if 'статус' in partners_df.columns:
        pending_partners_df = partners_df[partners_df['статус'] == 'pending']
    else:
        pending_partners_df = pd.DataFrame()
        
    if pending_partners_df.empty:
        st.info("Нет партнеров в ожидании одобрения.")
    else:
        for index, row in pending_partners_df.iterrows():
            chat_id_current = row['chat_id']

            st.markdown("---")
            
            if st.session_state.get('approved_id') == chat_id_current:
                st.success(f"Партнер {row['имя партнера']} ({chat_id_current}) успешно Approved!")
                st.session_state['approved_id'] = None 
                st.experimental_rerun()
                
            if st.session_state.get('rejected_id') == chat_id_current:
                st.warning(f"Партнер {row['имя партнера']} ({chat_id_current}) отклонен.")
                st.session_state['rejected_id'] = None 
                st.experimental_rerun()
                
            
            st.markdown(f"**{row['имя партнера']}**") 
            st.text(f"Телефон: {row['телефон']}")
            st.text(f"Город: {row['город']}, Район: {row['район']}") 
            
            col_appr, col_rej = st.columns([1, 10])
            
            with col_appr:
                st.button(
                    "Одобрить", 
                    key=f"approve_{chat_id_current}",
                    on_click=approve_partner_callback, 
                    args=(chat_id_current,)
                )
            
            with col_rej:
                st.button(
                    "Отклонить", 
                    key=f"reject_{chat_id_current}",
                    on_click=reject_partner_callback, 
                    args=(chat_id_current,)
                )
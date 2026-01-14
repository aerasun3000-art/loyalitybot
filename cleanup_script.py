
import re

def clean_admin_bot():
    with open('admin_bot.py', 'r') as f:
        content = f.read()
    
    # 1. Удаляем импорты
    lines = content.split('\n')
    new_lines = []
    
    skip_block = False
    
    for line in lines:
        # Пропускаем импорты удаленных модулей
        if 'instagram_outreach_manager' in line or \
           'ai_helper' in line or \
           'calendar_manager' in line:
            continue
            
        # Пропускаем инициализацию менеджеров
        if 'outreach_manager =' in line or \
           'calendar_manager =' in line:
            continue
            
        # Пропускаем кнопки меню
        if 'callback_data="outreach_' in line or \
           'callback_data="admin_outreach"' in line or \
           'callback_data="calendar_' in line:
            continue
            
        # Пропускаем хендлеры
        if '@dp.callback_query(F.data == "admin_outreach")' in line or \
           '@dp.callback_query(F.data.startswith("outreach_"))' in line or \
           '@dp.message(Command("outreach_message"))' in line:
             skip_block = True
        
        if skip_block:
            # Если это декоратор или начало функции
            if line.strip().startswith('@dp.') or line.strip().startswith('async def '):
                # Проверяем, не закончился ли блок (начался ли новый хендлер, который НЕ outreach)
                if not ('outreach' in line or 'calendar' in line):
                     skip_block = False
            
            # Простая эвристика: если пустая строка и следующий блок начинается с @dp - заканчиваем
            # Но лучше просто удалять функции целиком.
            # В Python функции определяются отступами. 
            pass

        # Если мы не в блоке пропуска, добавляем строку
        # Но нам нужно быть умнее с удалением функций.
        
        # Давайте используем простой подход:
        # Удаляем строки с упоминанием Outreach в меню
        # Заменяем функции-хендлеры на заглушки или удаляем их.
        pass

    # Попробуем другой подход: Просто закомментируем строки с ошибками импорта,
    # А функции удалим через Regex
    
    # 1. Удаляем импорты
    content = re.sub(r'^.*instagram_outreach_manager.*\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^.*ai_helper.*\n', '', content, flags=re.MULTILINE)
    content = re.sub(r'^.*calendar_manager.*\n', '', content, flags=re.MULTILINE)
    
    # 2. Удаляем инициализацию
    content = re.sub(r'.*outreach_manager = InstagramOutreachManager\(.*\n', '', content)
    content = re.sub(r'.*logger\.info\("InstagramOutreachManager успешно инициализирован"\).*\n', '', content)
    content = re.sub(r'.*calendar_manager = CalendarManager\(.*\n', '', content)
    
    # 3. Удаляем кнопки из меню (это сложно регуляркой, сделаем построчно)
    lines = content.split('\n')
    final_lines = []
    for line in lines:
        if 'outreach' in line.lower() or 'calendar' in line.lower():
            # Если это строка с кнопкой, пропускаем её
            if 'InlineKeyboardButton' in line:
                continue
            # Если это инициализация переменной
            if 'outreach_manager =' in line:
                continue
        final_lines.append(line)
        
    content = '\n'.join(final_lines)
    
    # 4. Удаляем целые функции хендлеров
    # Ищем декораторы @dp...outreach... и удаляем до следующего @dp
    # Это сложно сделать надежно регуляркой.
    
    # Вместо этого, давайте просто перезапишем файл без лишних кусков, 
    # используя тот факт, что я могу просто прочитать файл и отфильтровать блоки.
    
    with open('admin_bot_clean.py', 'w') as f:
        f.write(content)

if __name__ == "__main__":
    clean_admin_bot()

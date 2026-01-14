/**
 * ============================================
 * GOOGLE SHEETS ↔ SUPABASE: ПОЛНАЯ ИНТЕГРАЦИЯ
 * ============================================
 * 
 * Двусторонняя синхронизация данных между Google Sheets и Supabase
 * 
 * Функционал:
 * - Автоматический импорт партнеров из Supabase
 * - Экспорт изменений из Google Sheets в Supabase
 * - Синхронизация со статистикой и метриками
 * - Логирование всех операций
 * 
 * Установка:
 * 1. Откройте Google Sheets → Extensions → Apps Script
 * 2. Вставьте этот код
 * 3. Настройте конфигурацию ниже
 * 4. Создайте триггеры (см. setupSyncTriggers)
 */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
  // Название листа с данными партнеров
  SHEET_NAME: 'Partners Tracking',
  
  // Название листа для логов синхронизации
  LOGS_SHEET_NAME: 'Sync Logs',
  
  // Supabase настройки
  SUPABASE: {
    URL: 'https://your-project.supabase.co',  // ← Замените на ваш URL
    ANON_KEY: 'your-anon-key-here',           // ← Замените на ваш anon key
    SERVICE_ROLE_KEY: 'your-service-role-key' // ← Опционально, для полных прав
  },
  
  // Направления синхронизации
  SYNC_DIRECTIONS: {
    FROM_SUPABASE: true,    // Импорт из Supabase
    TO_SUPABASE: true,      // Экспорт в Supabase
    WITH_STATS: true        // Со статистикой
  },
  
  // Колонки в Google Sheets (номера колонок)
  COLUMNS: {
    CHAT_ID: 1,            // A - chat_id (ключ синхронизации)
    DATE_ADDED: 2,         // B - Дата добавления
    NAME: 3,               // C - Имя
    INSTAGRAM: 4,          // D - Instagram
    PHONE: 5,              // E - Телефон
    EMAIL: 6,              // F - Email
    DISTRICT: 7,           // G - Район
    SERVICE_TYPE: 8,       // H - Сфера услуг
    STATUS: 9,             // I - Статус (двусторонняя синхронизация)
    DATE_CONTACT: 10,      // J - Дата контакта (только Google Sheets)
    DATE_REPLY: 11,        // K - Дата ответа (только Google Sheets)
    DATE_CALL: 12,         // L - Дата созвона (только Google Sheets)
    DATE_CLOSED: 13,       // M - Дата закрытия (только Google Sheets)
    MESSAGES_COUNT: 14,    // N - Количество сообщений (только Google Sheets)
    LAST_CONTACT: 15,      // O - Последний контакт
    COMMENT: 16,           // P - Комментарий (двусторонняя синхронизация)
    PRIORITY: 17,          // Q - Приоритет
    // Дополнительные поля из Supabase
    COMPANY_NAME: 18,      // R - Название компании
    CITY: 19,              // S - Город
    PARTNER_TYPE: 20,      // T - Тип партнера
    PARTNER_LEVEL: 21,     // U - Уровень партнера
    MONTHLY_INCOME: 22,    // V - Доход в месяц
    CLIENT_COUNT: 23,      // W - Количество клиентов
    TOTAL_REVENUE: 24      // X - Общий оборот
  },
  
  // Поля для двусторонней синхронизации
  BIDIRECTIONAL_FIELDS: ['status', 'comment'],
  
  // Поля только из Supabase (не перезаписываются из Google Sheets)
  READONLY_FIELDS: ['chat_id', 'name', 'phone', 'email', 'district', 'business_type', 'company_name', 'city'],
  
  // Настройки логирования
  LOGGING: {
    ENABLED: true,
    MAX_LOG_ROWS: 1000  // Максимальное количество строк в логе
  },
  
  // Настройки уведомлений
  NOTIFICATIONS: {
    ENABLED: true,
    ON_ERROR: true,
    ON_NEW_PARTNER: false
  }
};

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ СИНХРОНИЗАЦИИ
// ============================================

/**
 * Главная функция: синхронизация из Supabase в Google Sheets
 */
function syncPartnersFromSupabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    logError('Лист "' + CONFIG.SHEET_NAME + '" не найден!');
    return;
  }
  
  if (!CONFIG.SYNC_DIRECTIONS.FROM_SUPABASE) {
    Logger.log('Синхронизация из Supabase отключена');
    return;
  }
  
  try {
    logInfo('Начало синхронизации из Supabase...');
    
    // Получаем партнеров из Supabase
    const partners = fetchPartnersFromSupabase();
    
    if (!partners || partners.length === 0) {
      logInfo('Нет партнеров для синхронизации');
      return;
    }
    
    logInfo(`Получено ${partners.length} партнеров из Supabase`);
    
    // Получаем существующие данные из Google Sheets
    const existingData = getExistingDataFromSheet(sheet);
    
    let addedCount = 0;
    let updatedCount = 0;
    
    // Обновляем или добавляем партнеров
    partners.forEach(partner => {
      const result = syncPartnerToSheet(sheet, partner, existingData);
      if (result === 'ADDED') {
        addedCount++;
      } else if (result === 'UPDATED') {
        updatedCount++;
      }
    });
    
    logInfo(`Синхронизация завершена. Добавлено: ${addedCount}, Обновлено: ${updatedCount}`);
    
    // Отправляем уведомление о новых партнерах
    if (CONFIG.NOTIFICATIONS.ON_NEW_PARTNER && addedCount > 0) {
      sendNotification(`✅ Добавлено новых партнеров: ${addedCount}`);
    }
    
  } catch (e) {
    logError('Ошибка синхронизации из Supabase: ' + e.toString());
    if (CONFIG.NOTIFICATIONS.ON_ERROR) {
      sendNotification(`❌ Ошибка синхронизации: ${e.toString()}`);
    }
  }
}

/**
 * Главная функция: синхронизация из Google Sheets в Supabase
 */
function syncChangesToSupabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    logError('Лист "' + CONFIG.SHEET_NAME + '" не найден!');
    return;
  }
  
  if (!CONFIG.SYNC_DIRECTIONS.TO_SUPABASE) {
    Logger.log('Синхронизация в Supabase отключена');
    return;
  }
  
  try {
    logInfo('Начало синхронизации в Supabase...');
    
    const data = sheet.getDataRange().getValues();
    let updatedCount = 0;
    let errorCount = 0;
    
    // Пропускаем заголовок
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const chatId = row[CONFIG.COLUMNS.CHAT_ID - 1];
      
      if (!chatId) continue;
      
      // Подготавливаем данные для обновления
      const updateData = prepareUpdateData(row);
      
      if (Object.keys(updateData).length === 0) {
        continue; // Нет изменений для синхронизации
      }
      
      // Обновляем в Supabase
      const success = updatePartnerInSupabase(chatId, updateData);
      
      if (success) {
        updatedCount++;
        logInfo(`Обновлен партнер ${chatId} в Supabase`);
      } else {
        errorCount++;
        logError(`Ошибка обновления партнера ${chatId}`);
      }
    }
    
    logInfo(`Синхронизация в Supabase завершена. Обновлено: ${updatedCount}, Ошибок: ${errorCount}`);
    
  } catch (e) {
    logError('Ошибка синхронизации в Supabase: ' + e.toString());
    if (CONFIG.NOTIFICATIONS.ON_ERROR) {
      sendNotification(`❌ Ошибка синхронизации в Supabase: ${e.toString()}`);
    }
  }
}

/**
 * Синхронизация партнеров со статистикой
 */
function syncPartnersWithStats() {
  if (!CONFIG.SYNC_DIRECTIONS.WITH_STATS) {
    Logger.log('Синхронизация со статистикой отключена');
    return;
  }
  
  try {
    logInfo('Начало синхронизации со статистикой...');
    
    // Получаем партнеров из Supabase
    const partners = fetchPartnersFromSupabase();
    
    if (!partners || partners.length === 0) {
      return;
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    
    partners.forEach(partner => {
      // Получаем статистику для партнера
      const stats = fetchPartnerStats(partner.chat_id);
      
      if (stats) {
        // Обновляем статистику в Google Sheets
        updateStatsInSheet(sheet, partner.chat_id, stats);
      }
    });
    
    logInfo('Синхронизация со статистикой завершена');
    
  } catch (e) {
    logError('Ошибка синхронизации со статистикой: ' + e.toString());
  }
}

// ============================================
// ФУНКЦИИ РАБОТЫ С SUPABASE
// ============================================

/**
 * Получает всех партнеров из Supabase
 */
function fetchPartnersFromSupabase() {
  const url = `${CONFIG.SUPABASE.URL}/rest/v1/partners?select=*&order=created_at.desc`;
  
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'apikey': CONFIG.SUPABASE.ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Получает статистику партнера из Supabase
 */
function fetchPartnerStats(chatId) {
  try {
    // Получаем статистику из транзакций
    const transactionsUrl = `${CONFIG.SUPABASE.URL}/rest/v1/transactions?partner_chat_id=eq.${chatId}&select=total_amount,client_chat_id`;
    
    const response = UrlFetchApp.fetch(transactionsUrl, {
      headers: {
        'apikey': CONFIG.SUPABASE.ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`
      }
    });
    
    if (response.getResponseCode() !== 200) {
      return null;
    }
    
    const transactions = JSON.parse(response.getContentText());
    
    // Вычисляем статистику
    let totalRevenue = 0;
    const clients = new Set();
    
    transactions.forEach(transaction => {
      if (transaction.total_amount) {
        totalRevenue += parseFloat(transaction.total_amount);
      }
      if (transaction.client_chat_id) {
        clients.add(transaction.client_chat_id);
      }
    });
    
    return {
      total_revenue: totalRevenue,
      client_count: clients.size,
      transaction_count: transactions.length
    };
    
  } catch (e) {
    Logger.log(`Ошибка получения статистики для ${chatId}: ${e.toString()}`);
    return null;
  }
}

/**
 * Обновляет партнера в Supabase
 */
function updatePartnerInSupabase(chatId, updateData) {
  try {
    const url = `${CONFIG.SUPABASE.URL}/rest/v1/partners?chat_id=eq.${chatId}`;
    
    const response = UrlFetchApp.fetch(url, {
      method: 'PATCH',
      headers: {
        'apikey': CONFIG.SUPABASE.ANON_KEY,
        'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(updateData)
    });
    
    return response.getResponseCode() === 204 || response.getResponseCode() === 200;
    
  } catch (e) {
    Logger.log(`Ошибка обновления партнера ${chatId}: ${e.toString()}`);
    return false;
  }
}

// ============================================
// ФУНКЦИИ РАБОТЫ С GOOGLE SHEETS
// ============================================

/**
 * Получает существующие данные из Google Sheets
 */
function getExistingDataFromSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  const existing = {
    chatIds: new Set(),
    rowMap: new Map()
  };
  
  // Пропускаем заголовок
  for (let i = 1; i < data.length; i++) {
    const chatId = data[i][CONFIG.COLUMNS.CHAT_ID - 1];
    if (chatId) {
      existing.chatIds.add(chatId);
      existing.rowMap.set(chatId, i + 1);
    }
  }
  
  return existing;
}

/**
 * Синхронизирует партнера в Google Sheets
 */
function syncPartnerToSheet(sheet, partner, existingData) {
  const chatId = partner.chat_id;
  const rowIndex = existingData.rowMap.get(chatId);
  
  const rowData = [
    chatId,                                    // A - chat_id
    partner.created_at || new Date(),          // B - Дата добавления
    partner.name || '',                        // C - Имя
    partner.instagram || '',                   // D - Instagram
    partner.phone || '',                       // E - Телефон
    partner.email || '',                       // F - Email
    partner.district || '',                    // G - Район
    partner.business_type || '',               // H - Сфера услуг
    partner.status || 'NEW',                   // I - Статус
    '',                                        // J - Дата контакта (только Sheets)
    '',                                        // K - Дата ответа (только Sheets)
    '',                                        // L - Дата созвона (только Sheets)
    '',                                        // M - Дата закрытия (только Sheets)
    0,                                         // N - Количество сообщений
    partner.last_contact || new Date(),        // O - Последний контакт
    partner.comment || '',                     // P - Комментарий
    'MEDIUM',                                  // Q - Приоритет
    partner.company_name || '',                // R - Название компании
    partner.city || '',                        // S - Город
    partner.partner_type || '',                // T - Тип партнера
    partner.partner_level || 0,                // U - Уровень партнера
    partner.personal_income_monthly || 0,      // V - Доход в месяц
    partner.client_base_count || 0,            // W - Количество клиентов
    0                                          // X - Общий оборот (обновляется отдельно)
  ];
  
  if (rowIndex > 0) {
    // Обновляем существующую строку (сохраняем поля только для Google Sheets)
    const existingRow = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    
    // Сохраняем данные, которые не должны перезаписываться
    rowData[CONFIG.COLUMNS.DATE_CONTACT - 1] = existingRow[CONFIG.COLUMNS.DATE_CONTACT - 1] || '';
    rowData[CONFIG.COLUMNS.DATE_REPLY - 1] = existingRow[CONFIG.COLUMNS.DATE_REPLY - 1] || '';
    rowData[CONFIG.COLUMNS.DATE_CALL - 1] = existingRow[CONFIG.COLUMNS.DATE_CALL - 1] || '';
    rowData[CONFIG.COLUMNS.DATE_CLOSED - 1] = existingRow[CONFIG.COLUMNS.DATE_CLOSED - 1] || '';
    rowData[CONFIG.COLUMNS.MESSAGES_COUNT - 1] = existingRow[CONFIG.COLUMNS.MESSAGES_COUNT - 1] || 0;
    
    // Обновляем строку
    const range = sheet.getRange(rowIndex, 1, 1, rowData.length);
    range.setValues([rowData]);
    
    return 'UPDATED';
  } else {
    // Добавляем новую строку
    sheet.appendRow(rowData);
    return 'ADDED';
  }
}

/**
 * Подготавливает данные для обновления в Supabase
 */
function prepareUpdateData(row) {
  const updateData = {};
  
  // Синхронизируем только двусторонние поля
  CONFIG.BIDIRECTIONAL_FIELDS.forEach(field => {
    let value;
    let column;
    
    if (field === 'status') {
      column = CONFIG.COLUMNS.STATUS;
      value = row[column - 1];
    } else if (field === 'comment') {
      column = CONFIG.COLUMNS.COMMENT;
      value = row[column - 1];
    }
    
    if (value !== undefined && value !== null && value !== '') {
      updateData[field] = value;
    }
  });
  
  return updateData;
}

/**
 * Обновляет статистику в Google Sheets
 */
function updateStatsInSheet(sheet, chatId, stats) {
  const rowIndex = findRowByChatId(sheet, chatId);
  
  if (rowIndex > 0) {
    // Обновляем колонки со статистикой
    sheet.getRange(rowIndex, CONFIG.COLUMNS.TOTAL_REVENUE).setValue(stats.total_revenue);
    sheet.getRange(rowIndex, CONFIG.COLUMNS.CLIENT_COUNT).setValue(stats.client_count);
    // Можно добавить другие метрики
  }
}

/**
 * Находит строку по chat_id
 */
function findRowByChatId(sheet, chatId) {
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][CONFIG.COLUMNS.CHAT_ID - 1] === chatId) {
      return i + 1;
    }
  }
  
  return -1;
}

// ============================================
// ЛОГИРОВАНИЕ
// ============================================

/**
 * Создает лист для логов, если его нет
 */
function createLogSheetIfNeeded(ss) {
  let logSheet = ss.getSheetByName(CONFIG.LOGS_SHEET_NAME);
  
  if (!logSheet) {
    logSheet = ss.insertSheet(CONFIG.LOGS_SHEET_NAME);
    
    const headers = [
      'Дата',
      'Тип',
      'Уровень',
      'Партнер',
      'Сообщение',
      'Данные'
    ];
    
    logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Форматирование заголовков
    const headerRange = logSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    
    // Ширина колонок
    logSheet.setColumnWidth(1, 150);
    logSheet.setColumnWidth(2, 100);
    logSheet.setColumnWidth(3, 80);
    logSheet.setColumnWidth(4, 150);
    logSheet.setColumnWidth(5, 400);
    logSheet.setColumnWidth(6, 300);
    
    Logger.log('✅ Лист логов создан');
  }
  
  return logSheet;
}

/**
 * Логирует информационное сообщение
 */
function logInfo(message, partner = null) {
  Logger.log(message);
  
  if (CONFIG.LOGGING.ENABLED) {
    writeLog('INFO', message, partner);
  }
}

/**
 * Логирует ошибку
 */
function logError(message, partner = null) {
  Logger.log('❌ ' + message);
  
  if (CONFIG.LOGGING.ENABLED) {
    writeLog('ERROR', message, partner);
  }
}

/**
 * Записывает в лист логов
 */
function writeLog(level, message, partner = null) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = createLogSheetIfNeeded(ss);
  
  const logRow = [
    new Date(),
    'SYNC',
    level,
    partner ? (partner.chat_id || partner.name || '') : '',
    message,
    partner ? JSON.stringify(partner) : ''
  ];
  
  logSheet.appendRow(logRow);
  
  // Ограничиваем количество строк в логе
  const lastRow = logSheet.getLastRow();
  if (lastRow > CONFIG.LOGGING.MAX_LOG_ROWS) {
    const rowsToDelete = lastRow - CONFIG.LOGGING.MAX_LOG_ROWS;
    logSheet.deleteRows(2, rowsToDelete);
  }
}

// ============================================
// УВЕДОМЛЕНИЯ
// ============================================

/**
 * Отправляет уведомление (можно расширить для Telegram/Email)
 */
function sendNotification(message) {
  Logger.log('📢 ' + message);
  
  // Здесь можно добавить отправку в Telegram или Email
  // Используйте код из google_sheets_reminders.gs
}

// ============================================
// НАСТРОЙКА ТРИГГЕРОВ
// ============================================

/**
 * Создает триггеры для автоматической синхронизации
 * Запустите эту функцию один раз вручную
 */
function setupSyncTriggers() {
  // Удаляем старые триггеры
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    const handlerName = trigger.getHandlerFunction();
    if (handlerName.includes('sync') || handlerName.includes('Sync')) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Триггер 1: Синхронизация из Supabase (каждые 6 часов)
  if (CONFIG.SYNC_DIRECTIONS.FROM_SUPABASE) {
    ScriptApp.newTrigger('syncPartnersFromSupabase')
      .timeBased()
      .everyHours(6)
      .create();
    Logger.log('✅ Триггер создан: импорт из Supabase каждые 6 часов');
  }
  
  // Триггер 2: Синхронизация в Supabase (каждые 30 минут)
  if (CONFIG.SYNC_DIRECTIONS.TO_SUPABASE) {
    ScriptApp.newTrigger('syncChangesToSupabase')
      .timeBased()
      .everyMinutes(30)
      .create();
    Logger.log('✅ Триггер создан: экспорт в Supabase каждые 30 минут');
  }
  
  // Триггер 3: Синхронизация со статистикой (раз в день в 2:00 UTC)
  if (CONFIG.SYNC_DIRECTIONS.WITH_STATS) {
    ScriptApp.newTrigger('syncPartnersWithStats')
      .timeBased()
      .atHour(2)
      .everyDays(1)
      .create();
    Logger.log('✅ Триггер создан: синхронизация со статистикой ежедневно в 2:00 UTC');
  }
  
  Logger.log('✅ Все триггеры синхронизации созданы');
}

/**
 * Ручной запуск синхронизации (для тестирования)
 */
function manualSync() {
  Logger.log('🔄 Ручная синхронизация запущена...');
  
  if (CONFIG.SYNC_DIRECTIONS.FROM_SUPABASE) {
    syncPartnersFromSupabase();
  }
  
  if (CONFIG.SYNC_DIRECTIONS.TO_SUPABASE) {
    syncChangesToSupabase();
  }
  
  if (CONFIG.SYNC_DIRECTIONS.WITH_STATS) {
    syncPartnersWithStats();
  }
  
  Logger.log('✅ Ручная синхронизация завершена');
}

// ============================================
// УТИЛИТЫ
// ============================================

/**
 * Проверяет подключение к Supabase
 */
function testSupabaseConnection() {
  try {
    const partners = fetchPartnersFromSupabase();
    Logger.log(`✅ Подключение к Supabase успешно! Получено ${partners.length} партнеров`);
    return true;
  } catch (e) {
    Logger.log('❌ Ошибка подключения к Supabase: ' + e.toString());
    Logger.log('Проверьте CONFIG.SUPABASE.URL и CONFIG.SUPABASE.ANON_KEY');
    return false;
  }
}

// ============================================
// INSTAGRAM OUTREACH SYNC
// ============================================

/**
 * Синхронизирует контакты из таблицы instagram_outreach в отдельный лист
 */
function syncInstagramOutreach() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = 'Instagram Outreach';
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Создаем заголовки
    const headers = [
      'ID',
      'Instagram Handle',
      'Имя',
      'Район',
      'Тип бизнеса',
      'Город',
      'Статус',
      'Приоритет',
      'Сообщений отправлено',
      'Дата первого контакта',
      'Дата последнего follow-up',
      'Дата ответа',
      'Время ответа (часы)',
      'Источник',
      'Заметки',
      'Создано',
      'Обновлено'
    ];
    
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Форматирование заголовков
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    
    // Замораживаем первую строку
    sheet.setFrozenRows(1);
  }
  
  try {
    logInfo('Начало синхронизации Instagram Outreach...');
    
    // Получаем контакты из Supabase
    const contacts = fetchInstagramOutreachFromSupabase();
    
    if (!contacts || contacts.length === 0) {
      logInfo('Нет контактов для синхронизации');
      return;
    }
    
    logInfo(`Получено ${contacts.length} контактов из instagram_outreach`);
    
    // Получаем существующие данные
    const existingData = getExistingOutreachDataFromSheet(sheet);
    
    let addedCount = 0;
    let updatedCount = 0;
    
    // Обновляем или добавляем контакты
    contacts.forEach(contact => {
      const result = syncOutreachContactToSheet(sheet, contact, existingData);
      if (result === 'ADDED') {
        addedCount++;
      } else if (result === 'UPDATED') {
        updatedCount++;
      }
    });
    
    logInfo(`Синхронизация завершена. Добавлено: ${addedCount}, Обновлено: ${updatedCount}`);
    
  } catch (e) {
    logError('Ошибка синхронизации Instagram Outreach: ' + e.toString());
    if (CONFIG.NOTIFICATIONS.ON_ERROR) {
      sendNotification(`❌ Ошибка синхронизации Instagram Outreach: ${e.toString()}`);
    }
  }
}

/**
 * Получает контакты из таблицы instagram_outreach
 */
function fetchInstagramOutreachFromSupabase() {
  const url = `${CONFIG.SUPABASE.URL}/rest/v1/instagram_outreach?select=*&order=created_at.desc`;
  
  const response = UrlFetchApp.fetch(url, {
    headers: {
      'apikey': CONFIG.SUPABASE.ANON_KEY,
      'Authorization': `Bearer ${CONFIG.SUPABASE.ANON_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (response.getResponseCode() !== 200) {
    throw new Error(`HTTP ${response.getResponseCode()}: ${response.getContentText()}`);
  }
  
  return JSON.parse(response.getContentText());
}

/**
 * Получает существующие данные из листа Instagram Outreach
 */
function getExistingOutreachDataFromSheet(sheet) {
  const data = sheet.getDataRange().getValues();
  const existing = {
    ids: new Set(),
    rowMap: new Map()
  };
  
  // Пропускаем заголовок
  for (let i = 1; i < data.length; i++) {
    const id = data[i][0]; // ID в колонке A
    if (id) {
      existing.ids.add(id);
      existing.rowMap.set(id, i + 1);
    }
  }
  
  return existing;
}

/**
 * Синхронизирует контакт outreach в Google Sheets
 */
function syncOutreachContactToSheet(sheet, contact, existingData) {
  const contactId = contact.id;
  const rowIndex = existingData.rowMap.get(contactId);
  
  const rowData = [
    contactId,                                    // A - ID
    contact.instagram_handle || '',              // B - Instagram Handle
    contact.name || '',                          // C - Имя
    contact.district || '',                      // D - Район
    contact.business_type || '',                 // E - Тип бизнеса
    contact.city || 'New York',                  // F - Город
    contact.outreach_status || 'NOT_CONTACTED',  // G - Статус
    contact.priority || 'MEDIUM',                // H - Приоритет
    contact.messages_sent || 0,                  // I - Сообщений отправлено
    contact.first_contact_date || '',            // J - Дата первого контакта
    contact.last_follow_up_date || '',           // K - Дата последнего follow-up
    contact.reply_date || '',                    // L - Дата ответа
    contact.response_time_hours || '',           // M - Время ответа (часы)
    contact.source || '',                        // N - Источник
    contact.notes || '',                         // O - Заметки
    contact.created_at || new Date(),            // P - Создано
    contact.updated_at || new Date()             // Q - Обновлено
  ];
  
  if (rowIndex > 0) {
    // Обновляем существующую строку
    const range = sheet.getRange(rowIndex, 1, 1, rowData.length);
    range.setValues([rowData]);
    return 'UPDATED';
  } else {
    // Добавляем новую строку
    sheet.appendRow(rowData);
    return 'ADDED';
  }
}

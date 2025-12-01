/**
 * ============================================
 * GOOGLE SHEETS: АВТОМАТИЧЕСКИЕ НАПОМИНАНИЯ
 * ============================================
 * 
 * Скрипт для автоматической отправки напоминаний
 * о необходимости follow-up с партнерами
 * 
 * Установка:
 * 1. Откройте вашу Google Sheets таблицу
 * 2. Extensions → Apps Script
 * 3. Вставьте этот код
 * 4. Настройте конфигурацию ниже
 * 5. Создайте триггер (см. функцию setupTriggers)
 */

// ============================================
// КОНФИГУРАЦИЯ
// ============================================

const CONFIG = {
  // Название листа с данными партнеров
  SHEET_NAME: 'Partners Tracking',
  
  // Название листа для задач (создается автоматически)
  TASKS_SHEET_NAME: 'Tasks',
  
  // Колонки в таблице (изменить если ваша структура другая)
  COLUMNS: {
    NAME: 3,              // Колонка C - Имя
    INSTAGRAM: 4,         // Колонка D - Instagram
    STATUS: 9,            // Колонка I - Статус
    LAST_CONTACT: 15,     // Колонка O - Последний контакт
    DATE_CONTACT: 10,     // Колонка J - Дата контакта
    COMMENT: 16           // Колонка P - Комментарий
  },
  
  // Время для напоминаний (в часах)
  FOLLOW_UP_DELAYS: {
    FIRST_REMINDER: 48,    // Первое напоминание через 48 часов
    SECOND_REMINDER: 168   // Второе напоминание через 7 дней
  },
  
  // Telegram Bot (опционально)
  TELEGRAM: {
    ENABLED: false,        // Включить отправку в Telegram
    BOT_TOKEN: 'YOUR_TELEGRAM_BOT_TOKEN',
    CHAT_ID: 'YOUR_TELEGRAM_CHAT_ID'  // ID менеджера или группы
  },
  
  // Email уведомления (опционально)
  EMAIL: {
    ENABLED: true,         // Включить отправку email
    TO: 'your-email@example.com',  // Email для уведомлений
    SUBJECT: '📋 Напоминание: Follow-up с партнерами'
  },
  
  // Рабочие дни/время (UTC)
  WORK_HOURS: {
    START: 8,   // 8:00 UTC
    END: 22     // 22:00 UTC
  },
  
  // Дни недели для отправки (0 = воскресенье, 6 = суббота)
  WORK_DAYS: [1, 2, 3, 4, 5],  // Понедельник - Пятница
};

// ============================================
// ОСНОВНЫЕ ФУНКЦИИ
// ============================================

/**
 * Главная функция - проверяет партнеров и создает напоминания
 * Запускается по триггеру каждые 6 часов
 */
function checkAndSendReminders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    Logger.log('❌ Лист "' + CONFIG.SHEET_NAME + '" не найден!');
    return;
  }
  
  // Создаем лист для задач, если его нет
  createTasksSheetIfNeeded(ss);
  
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const reminders = [];
  
  // Пропускаем заголовок (первая строка)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowNumber = i + 1;
    
    const partner = {
      row: rowNumber,
      name: row[CONFIG.COLUMNS.NAME - 1] || '',
      instagram: row[CONFIG.COLUMNS.INSTAGRAM - 1] || '',
      status: row[CONFIG.COLUMNS.STATUS - 1] || '',
      lastContact: row[CONFIG.COLUMNS.LAST_CONTACT - 1],
      comment: row[CONFIG.COLUMNS.COMMENT - 1] || ''
    };
    
    // Пропускаем пустые строки
    if (!partner.name && !partner.instagram) continue;
    
    // Проверяем статусы, требующие follow-up
    if (shouldSendReminder(partner, now)) {
      const reminder = createReminder(partner, now);
      if (reminder) {
        reminders.push(reminder);
        updatePartnerStatus(sheet, partner.row, reminder.newStatus);
        addTask(ss, reminder);
      }
    }
    
    // Проверяем запланированные созвоны
    checkScheduledCalls(sheet, partner, now);
  }
  
  // Отправляем уведомления
  if (reminders.length > 0) {
    sendNotifications(reminders);
    Logger.log('✅ Отправлено ' + reminders.length + ' напоминаний');
  } else {
    Logger.log('ℹ️ Нет партнеров, требующих follow-up');
  }
}

/**
 * Проверяет, нужно ли отправлять напоминание
 */
function shouldSendReminder(partner, now) {
  // Не отправляем напоминания для закрытых или неинтересных
  if (['CLOSED', 'NOT_INTERESTED', 'GHOSTED'].includes(partner.status)) {
    return false;
  }
  
  // Если нет последнего контакта, пропускаем
  if (!partner.lastContact || !(partner.lastContact instanceof Date)) {
    return false;
  }
  
  const hoursPassed = (now - partner.lastContact) / (1000 * 60 * 60);
  
  // Проверяем статус SENT - первое напоминание через 48 часов
  if (partner.status === 'SENT' && hoursPassed >= CONFIG.FOLLOW_UP_DELAYS.FIRST_REMINDER) {
    return true;
  }
  
  // Проверяем FOLLOW_UP_1 - второе напоминание через 7 дней
  if (partner.status === 'FOLLOW_UP_1' && hoursPassed >= CONFIG.FOLLOW_UP_DELAYS.SECOND_REMINDER) {
    return true;
  }
  
  return false;
}

/**
 * Создает объект напоминания
 */
function createReminder(partner, now) {
  const hoursPassed = (now - partner.lastContact) / (1000 * 60 * 60);
  
  let reminderType, newStatus, message;
  
  if (partner.status === 'SENT') {
    reminderType = 'FIRST_REMINDER';
    newStatus = 'FOLLOW_UP_1';
    message = `⏰ Напоминание: Нужен follow-up для ${partner.name} (@${partner.instagram})\n\n` +
              `Прошло ${Math.round(hoursPassed / 24)} дней с момента отправки сообщения.\n` +
              `Статус: ${partner.status}`;
  } else if (partner.status === 'FOLLOW_UP_1') {
    reminderType = 'SECOND_REMINDER';
    newStatus = 'FOLLOW_UP_2';
    message = `⏰ Второе напоминание: ${partner.name} (@${partner.instagram})\n\n` +
              `Прошло ${Math.round(hoursPassed / 24)} дней с последнего контакта.\n` +
              `Рекомендуется отправить финальное сообщение.`;
  } else {
    return null;
  }
  
  return {
    type: reminderType,
    partner: partner,
    message: message,
    newStatus: newStatus,
    createdAt: now
  };
}

/**
 * Обновляет статус партнера в таблице
 */
function updatePartnerStatus(sheet, rowNumber, newStatus) {
  const statusCell = sheet.getRange(rowNumber, CONFIG.COLUMNS.STATUS);
  statusCell.setValue(newStatus);
  
  // Обновляем дату последнего контакта
  const lastContactCell = sheet.getRange(rowNumber, CONFIG.COLUMNS.LAST_CONTACT);
  lastContactCell.setValue(new Date());
}

/**
 * Добавляет задачу в лист Tasks
 */
function addTask(ss, reminder) {
  const tasksSheet = ss.getSheetByName(CONFIG.TASKS_SHEET_NAME);
  
  if (!tasksSheet) return;
  
  const taskRow = [
    new Date(),
    reminder.type,
    reminder.partner.name,
    reminder.partner.instagram,
    reminder.message,
    'PENDING',
    reminder.newStatus
  ];
  
  tasksSheet.appendRow(taskRow);
}

/**
 * Проверяет запланированные созвоны
 */
function checkScheduledCalls(sheet, partner, now) {
  // Если статус CALL_SCHEDULED, проверяем дату созвона
  if (partner.status === 'CALL_SCHEDULED') {
    // Предполагаем, что дата созвона в колонке Дата созвона (L)
    const callDate = sheet.getRange(partner.row, 12).getValue();
    
    if (callDate && callDate instanceof Date) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const callDay = new Date(callDate.getFullYear(), callDate.getMonth(), callDate.getDate());
      
      // Если созвон сегодня - отправляем напоминание
      if (callDay.getTime() === today.getTime()) {
        sendCallReminder(partner);
      }
    }
  }
}

/**
 * Отправляет напоминание о созвоне
 */
function sendCallReminder(partner) {
  const message = `📞 Сегодня созвон с ${partner.name} (@${partner.instagram})\n\n` +
                  `Не забудьте подготовиться!`;
  
  sendNotification([{
    type: 'CALL_REMINDER',
    partner: partner,
    message: message,
    createdAt: new Date()
  }]);
}

/**
 * Отправляет уведомления (Telegram + Email)
 */
function sendNotifications(reminders) {
  if (!reminders || reminders.length === 0) return;
  
  const summary = createSummary(reminders);
  
  // Отправляем в Telegram
  if (CONFIG.TELEGRAM.ENABLED) {
    sendTelegramNotification(summary);
  }
  
  // Отправляем Email
  if (CONFIG.EMAIL.ENABLED) {
    sendEmailNotification(summary);
  }
}

/**
 * Создает сводку напоминаний
 */
function createSummary(reminders) {
  let text = '📋 НАПОМИНАНИЯ О FOLLOW-UP\n\n';
  
  reminders.forEach((reminder, index) => {
    text += `${index + 1}. ${reminder.partner.name} (@${reminder.partner.instagram})\n`;
    text += `   Тип: ${reminder.type}\n`;
    text += `   Статус: ${reminder.partner.status} → ${reminder.newStatus}\n\n`;
  });
  
  return text;
}

/**
 * Отправляет уведомление в Telegram
 */
function sendTelegramNotification(message) {
  if (!CONFIG.TELEGRAM.BOT_TOKEN || !CONFIG.TELEGRAM.CHAT_ID) {
    Logger.log('⚠️ Telegram не настроен. Пропускаем отправку.');
    return;
  }
  
  const url = 'https://api.telegram.org/bot' + CONFIG.TELEGRAM.BOT_TOKEN + '/sendMessage';
  
  const payload = {
    chat_id: CONFIG.TELEGRAM.CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  };
  
  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    });
    
    const result = JSON.parse(response.getContentText());
    
    if (result.ok) {
      Logger.log('✅ Уведомление отправлено в Telegram');
    } else {
      Logger.log('❌ Ошибка отправки в Telegram: ' + result.description);
    }
  } catch (e) {
    Logger.log('❌ Ошибка при отправке в Telegram: ' + e.toString());
  }
}

/**
 * Отправляет Email уведомление
 */
function sendEmailNotification(message) {
  if (!CONFIG.EMAIL.TO) {
    Logger.log('⚠️ Email не настроен. Пропускаем отправку.');
    return;
  }
  
  try {
    MailApp.sendEmail({
      to: CONFIG.EMAIL.TO,
      subject: CONFIG.EMAIL.SUBJECT,
      body: message,
      htmlBody: message.replace(/\n/g, '<br>')
    });
    
    Logger.log('✅ Email уведомление отправлено');
  } catch (e) {
    Logger.log('❌ Ошибка при отправке Email: ' + e.toString());
  }
}

// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

/**
 * Создает лист Tasks, если его нет
 */
function createTasksSheetIfNeeded(ss) {
  let tasksSheet = ss.getSheetByName(CONFIG.TASKS_SHEET_NAME);
  
  if (!tasksSheet) {
    tasksSheet = ss.insertSheet(CONFIG.TASKS_SHEET_NAME);
    
    // Заголовки
    const headers = [
      'Дата создания',
      'Тип',
      'Имя партнера',
      'Instagram',
      'Задача',
      'Статус',
      'Новый статус партнера'
    ];
    
    tasksSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    
    // Форматирование заголовков
    const headerRange = tasksSheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#f093fb');
    headerRange.setFontColor('#ffffff');
    
    // Ширина колонок
    tasksSheet.setColumnWidth(1, 150);
    tasksSheet.setColumnWidth(2, 120);
    tasksSheet.setColumnWidth(3, 120);
    tasksSheet.setColumnWidth(4, 150);
    tasksSheet.setColumnWidth(5, 400);
    tasksSheet.setColumnWidth(6, 100);
    tasksSheet.setColumnWidth(7, 150);
    
    Logger.log('✅ Лист Tasks создан');
  }
  
  return tasksSheet;
}

/**
 * Проверяет, нужно ли отправлять в рабочие часы
 */
function isWorkingHours() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  // Проверяем рабочие дни
  if (!CONFIG.WORK_DAYS.includes(day)) {
    return false;
  }
  
  // Проверяем рабочие часы (UTC)
  if (hour < CONFIG.WORK_HOURS.START || hour >= CONFIG.WORK_HOURS.END) {
    return false;
  }
  
  return true;
}

// ============================================
// НАСТРОЙКА ТРИГГЕРОВ
// ============================================

/**
 * Создает триггеры для автоматического запуска
 * Запустите эту функцию один раз вручную
 */
function setupTriggers() {
  // Удаляем старые триггеры
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkAndSendReminders') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Создаем новый триггер - каждые 6 часов
  ScriptApp.newTrigger('checkAndSendReminders')
    .timeBased()
    .everyHours(6)
    .create();
  
  Logger.log('✅ Триггер создан: проверка каждые 6 часов');
  
  // Также создаем триггер на начало дня (9:00 UTC)
  ScriptApp.newTrigger('checkAndSendReminders')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .create();
  
  Logger.log('✅ Триггер создан: ежедневная проверка в 9:00 UTC');
}

/**
 * Ручной запуск проверки (для тестирования)
 */
function manualCheck() {
  Logger.log('🔄 Ручная проверка запущена...');
  checkAndSendReminders();
  Logger.log('✅ Проверка завершена');
}

// ============================================
// ЭКСПОРТ ДАННЫХ
// ============================================

/**
 * Экспортирует задачи в CSV
 */
function exportTasksToCSV() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tasksSheet = ss.getSheetByName(CONFIG.TASKS_SHEET_NAME);
  
  if (!tasksSheet) {
    Logger.log('❌ Лист Tasks не найден');
    return;
  }
  
  const data = tasksSheet.getDataRange().getValues();
  const csv = data.map(row => row.join(',')).join('\n');
  
  // Создаем файл в Google Drive
  const folder = DriveApp.getRootFolder();
  const fileName = 'Tasks_Export_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.csv';
  
  folder.createFile(fileName, csv, MimeType.CSV);
  
  Logger.log('✅ Задачи экспортированы в ' + fileName);
}



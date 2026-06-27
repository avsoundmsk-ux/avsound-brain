// AVSound Finance — Google Apps Script
// Вставь весь этот код в Apps Script вместо старого
// Опубликуй заново: Развернуть → Управление развёртываниями → ⚙️ → Изменить → Новая версия → Сохранить

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Создаём лист с названием = дата (или перезаписываем)
  const sheetName = data.дата;
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    sheet.clearContents();
    sheet.clearFormats();
  } else {
    sheet = ss.insertSheet(sheetName, 0);
  }

  let row = 1;

  function set(r, c, val) { sheet.getRange(r, c).setValue(val); }

  function writeBlock(title, headers, rows, totalsRow) {
    // Заголовок блока
    const w = headers.length;
    sheet.getRange(row, 1, 1, w).merge()
      .setValue(title)
      .setBackground('#263238').setFontColor('#ffffff')
      .setFontWeight('bold').setFontSize(11);
    row++;

    // Шапка таблицы
    sheet.getRange(row, 1, 1, w).setValues([headers])
      .setBackground('#eceff1').setFontWeight('bold');
    row++;

    // Строки данных
    rows.forEach((r2, idx) => {
      sheet.getRange(row, 1, 1, w).setValues([r2]);
      if (idx % 2 === 1) sheet.getRange(row, 1, 1, w).setBackground('#fafafa');
      row++;
    });

    // Итого
    if (totalsRow) {
      sheet.getRange(row, 1, 1, w).setValues([totalsRow])
        .setBackground('#e0e0e0').setFontWeight('bold');
      row++;
    }

    row++; // пустая строка
  }

  function fmtNum(n) { return n || 0; }

  const s = data.summary || {};
  const k = data.касса || {};

  // === ЗАГОЛОВОК ===
  sheet.getRange(row, 1, 1, 7).merge()
    .setValue('AVSound — Отчёт за ' + data.дата)
    .setBackground('#1a237e').setFontColor('#ffffff')
    .setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  row++;
  row++;

  // === ПРОДАЖИ ===
  const sales = data.продажи || [];
  const totSales = sales.reduce((a, i) => ({
    р: a.р + i.реализация, з: a.з + i.закупка, м: a.м + i.маржа
  }), { р: 0, з: 0, м: 0 });
  const pctTot = totSales.р ? Math.round((totSales.м / totSales.р) * 100) : 0;

  writeBlock(
    '📦 ПРОДАЖИ',
    ['Дата', 'Товар', 'Канал', 'Реализация ₽', 'Закупка ₽', 'Маржа ₽', '% маржи'],
    sales.map(i => {
      const p = i.реализация ? Math.round((i.маржа / i.реализация) * 100) : 0;
      return [i.date, i.name, i.channel, fmtNum(i.реализация), fmtNum(i.закупка), fmtNum(i.маржа), p + '%'];
    }),
    ['ИТОГО', '', '', totSales.р, totSales.з, totSales.м, pctTot + '%']
  );

  // === РАБОТА СТУДИИ ===
  const work = data.работа || [];
  writeBlock(
    '🔧 РАБОТА СТУДИИ',
    ['Дата', 'Описание', 'Сумма ₽'],
    work.map(i => [i.date, i.comment || '', fmtNum(i.сумма)]),
    ['ИТОГО', '', work.reduce((s2, i) => s2 + i.сумма, 0)]
  );

  // === РАСХОДЫ ===
  const exp = data.расходы || [];
  writeBlock(
    '💸 РАСХОДЫ',
    ['Дата', 'Описание', 'Сумма ₽'],
    exp.map(i => [i.date, i.comment || '', fmtNum(i.сумма)]),
    ['ИТОГО', '', exp.reduce((s2, i) => s2 + i.сумма, 0)]
  );

  // === ЗАРПЛАТА (выплаты из файла) ===
  const sal = data.зарплата || [];
  writeBlock(
    '👤 ЗАРПЛАТА (выплаты)',
    ['Дата', 'Описание', 'Сумма ₽'],
    sal.map(i => [i.date, i.comment || '', fmtNum(i.сумма)]),
    ['ИТОГО', '', sal.reduce((s2, i) => s2 + i.сумма, 0)]
  );

  // === ЗАКУПКА СКЛАДА ===
  const stk = data.закупка || [];
  writeBlock(
    '📦 ЗАКУПКА СКЛАДА',
    ['Дата', 'Описание', 'Сумма ₽'],
    stk.map(i => [i.date, i.comment || '', fmtNum(i.сумма)]),
    ['ИТОГО', '', stk.reduce((s2, i) => s2 + i.сумма, 0)]
  );

  // === ИТОГИ ДНЯ ===
  sheet.getRange(row, 1, 1, 3).merge()
    .setValue('📊 ИТОГИ ДНЯ')
    .setBackground('#263238').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
  row++;

  const summaryRows = [
    ['Реализация', fmtNum(s.реализация), '#e8f5e9', false],
    ['Себестоимость', fmtNum(s.себестоимость), '#f5f5f5', false],
    ['Маржа продаж', fmtNum(s.маржа), '#c8e6c9', true],
    ['+ Работа студии', fmtNum(s.работа), '#e3f2fd', true],
    ['− Расходы', fmtNum(s.расходы), '#ffebee', false],
    ['− Зарплата выплачено', fmtNum(s.зарплата), '#fff3e0', false],
    ['− Закупка склада', fmtNum(s.закупка), '#f3e5f5', false],
    ['− Аренда (авто)', 5000, '#eceff1', false],
  ];

  summaryRows.forEach(([label, val, bg, bold]) => {
    sheet.getRange(row, 1).setValue(label);
    sheet.getRange(row, 2).setValue(val);
    sheet.getRange(row, 1, 1, 3).setBackground(bg);
    if (bold) sheet.getRange(row, 1, 1, 3).setFontWeight('bold');
    row++;
  });

  // Зарплата дня — жёлтый
  sheet.getRange(row, 1).setValue('💰 ЗАРПЛАТА ДНЯ (заработано)');
  sheet.getRange(row, 2).setValue(fmtNum(s.зарплатаДня));
  sheet.getRange(row, 1, 1, 3).setBackground('#fff8e1').setFontWeight('bold').setFontSize(12);
  row++;

  // Чистая прибыль — тёмный
  sheet.getRange(row, 1).setValue('⭐ ЧИСТАЯ ПРИБЫЛЬ');
  sheet.getRange(row, 2).setValue(fmtNum(s.чистая));
  sheet.getRange(row, 1, 1, 3).setBackground('#1b5e20').setFontColor('#ffffff').setFontWeight('bold').setFontSize(13);
  row++;
  row++;

  // === КАССА ===
  sheet.getRange(row, 1, 1, 3).merge()
    .setValue('💳 КАССА НА ВЕЧЕР')
    .setBackground('#263238').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
  row++;

  const kassaRows = [
    ['Наличные', fmtNum(k.наличные)],
    ['Т-Бизнес', fmtNum(k.тБизнес)],
    ['Тинькофф', fmtNum(k.тинькофф)],
    ['Т-Бизнес 2', fmtNum(k.тБизнес2)],
    ['Т-Яндекс', fmtNum(k.тЯндекс)],
    ['Другое', fmtNum(k.другое)],
  ];

  kassaRows.forEach(([label, val]) => {
    sheet.getRange(row, 1).setValue(label);
    sheet.getRange(row, 2).setValue(val);
    row++;
  });

  sheet.getRange(row, 1).setValue('ИТОГО В КАССЕ');
  sheet.getRange(row, 2).setValue(fmtNum(k.итогоВКассе));
  sheet.getRange(row, 1, 1, 3).setBackground('#e0e0e0').setFontWeight('bold');
  row++;
  row++;

  sheet.getRange(row, 1).setValue('Остаток на начало дня');
  sheet.getRange(row, 2).setValue(fmtNum(k.остатокВчера));
  row++;
  sheet.getRange(row, 1).setValue('Приход Озон');
  sheet.getRange(row, 2).setValue(fmtNum(k.приходОзон));
  row++;
  sheet.getRange(row, 1).setValue('Приход Яндекс');
  sheet.getRange(row, 2).setValue(fmtNum(k.приходЯндекс));
  row++;
  sheet.getRange(row, 1).setValue('Расчётный остаток');
  sheet.getRange(row, 2).setValue(fmtNum(k.расчётный));
  sheet.getRange(row, 1, 1, 3).setFontWeight('bold');
  row++;

  const сходится = Math.abs(k.расхождение || 0) < 1;
  sheet.getRange(row, 1).setValue('Расхождение');
  sheet.getRange(row, 2).setValue(fmtNum(k.расхождение));
  sheet.getRange(row, 3).setValue(сходится ? '✓ Касса сходится' : '✗ Расхождение');
  sheet.getRange(row, 1, 1, 3).setBackground(сходится ? '#c8e6c9' : '#ffcdd2');
  row++;

  // Ширина колонок
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 140);
  sheet.setColumnWidth(3, 120);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 130);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 80);

  return ContentService.createTextOutput('ok');
}

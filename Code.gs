/**
 * English Lessons API
 * Google Sheets -> Apps Script -> Website
 * Sheet names and headers must match the workbook tabs exactly.
 * Deploy as Web app: Execute as Me; access: Anyone (or your preferred access policy).
 */

const SHEET_NAMES = {
  lessons: 'Lessons',
  vocabulary: 'Lesson_Vocabulary',
  phrases: 'Lesson_Phrases',
  questions: 'Lesson_Questions',
  notes: 'Learning_Notes'
};

function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const lessonId = params.id || '';
  const action = params.action || (lessonId ? 'lesson' : 'lessons');
  let payload;

  if (action === 'lesson' && lessonId) {
    payload = getLesson_(lessonId);
    if (!payload) return json_({ ok: false, error: 'Lesson not found', id: lessonId });
  } else if (action === 'lessons' || action === 'all') {
    payload = getLessons_();
  } else {
    return json_({ ok: false, error: 'Unknown action. Use ?action=lessons or ?action=lesson&id=L001' });
  }

  return json_({ ok: true, data: payload });
}

function getLessons_() {
  const lessons = readSheet_(SHEET_NAMES.lessons)
    .filter(row => String(row.Status || '').toLowerCase() === 'published')
    .sort((a, b) => String(b.CreatedAt || '').localeCompare(String(a.CreatedAt || '')));

  return lessons.map(lesson => ({
    id: lesson.ID,
    title: lesson.Title,
    category: lesson.Category,
    description: lesson.Description,
    level: lesson.Level,
    createdAt: lesson.CreatedAt,
    vocabularyCount: readSheet_(SHEET_NAMES.vocabulary).filter(v => v.Lesson_ID === lesson.ID).length
  }));
}

function getLesson_(lessonId) {
  const lesson = readSheet_(SHEET_NAMES.lessons).find(row => String(row.ID) === String(lessonId));
  if (!lesson) return null;

  const related = sheetName => readSheet_(sheetName)
    .filter(row => String(row.Lesson_ID) === String(lessonId))
    .sort((a, b) => Number(a.Sort_Order || 0) - Number(b.Sort_Order || 0));

  // Source / Source_URL / Source_Note are intentionally kept in the backend only.
  return {
    id: lesson.ID,
    title: lesson.Title,
    category: lesson.Category,
    description: lesson.Description,
    introduction: lesson.Introduction,
    level: lesson.Level,
    createdAt: lesson.CreatedAt,
    vocabulary: related(SHEET_NAMES.vocabulary).map(row => ({
      id: row.ID,
      pos: row.POS,
      word: row.Word,
      ipa: row.IPA || '',
      meaning: row.Meaning,
      exampleEn: row.Example_EN,
      exampleZh: row.Example_ZH
    })),
    phrases: related(SHEET_NAMES.phrases).map(row => ({
      id: row.ID,
      phrase: row.Phrase,
      meaning: row.Meaning,
      exampleEn: row.Example_EN,
      exampleZh: row.Example_ZH
    })),
    questions: related(SHEET_NAMES.questions).map(row => ({
      id: row.ID,
      question: row.Question_EN || row.Question,
      questionZh: row.Question_ZH || '',
      followUpQuestion: row.Followup_EN || row.Follow_Up_Question,
      followUpQuestionZh: row.Followup_ZH || ''
    })),
    learningNotes: related(SHEET_NAMES.notes).map(row => ({
      id: row.ID,
      date: row.Date,
      originalExpression: row.Original_Expression,
      correction: row.Correction,
      explanation: row.Explanation,
      newExpression: row.New_Expression
    }))
  };
}

function readSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing sheet: ' + sheetName);
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];
  const headers = values[0].map(header => String(header).trim());
  return values.slice(1)
    .filter(row => row.some(value => value !== ''))
    .map(row => headers.reduce((obj, header, index) => {
      obj[header] = row[index] === undefined ? '' : row[index];
      return obj;
    }, {}));
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the Apps Script editor to verify the spreadsheet structure. */
function testApi() {
  const result = getLessons_();
  Logger.log(JSON.stringify(result, null, 2));
}

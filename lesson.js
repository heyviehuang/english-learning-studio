(() => {
  'use strict';
  const apiUrl = String(window.LESSONS_API_URL || '').trim();
  const lessonId = new URLSearchParams(window.location.search).get('id');
  const status = document.getElementById('lesson-status');
  const content = document.getElementById('lesson-content');
  const speechSupported = Boolean(window.speechSynthesis && 'SpeechSynthesisUtterance' in window);
  let activeSpeechButton = null;
  const speechIcon = '<svg class="speech-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 8v4h3l4 3V5L6 8H3Z"/><path d="M13 7a4 4 0 0 1 0 6M15 4.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pick = (object, ...keys) => keys.map(key => object?.[key]).find(value => value != null && value !== '');
  const asArray = value => Array.isArray(value) ? value : [];

  async function loadLesson() {
    if (!lessonId) return showError('No lesson was selected. Return to the lesson list and choose a lesson.');
    if (!apiUrl || !/^https:\/\//i.test(apiUrl)) return showError('The lesson service is not configured.');
    try {
      const url = new URL(apiUrl);
      url.searchParams.set('action', 'lesson');
      url.searchParams.set('id', lessonId);
      const response = await fetch(url, { method: 'GET', mode: 'cors', redirect: 'follow' });
      if (!response.ok) throw new Error(`The lesson service returned ${response.status}.`);
      const payload = await response.json();
      if (!payload || payload.ok !== true || !payload.data) throw new Error(payload?.error || 'The lesson could not be found.');
      renderLesson(payload.data);
    } catch (error) {
      showError(`We couldn't load this lesson. ${error.message || 'Check your connection and try again.'}`);
    }
  }
  function showError(message) {
    status.classList.add('error');
    status.innerHTML = `${esc(message)}<br><a class="back-link error-back" href="index.html">Back to all lessons</a>`;
    status.hidden = false;
  }
  function vocabularyCard(item) {
    const word = pick(item, 'word', 'Word');
    const ipa = pick(item, 'ipa', 'IPA');
    const ipaValue = ipa == null ? '' : String(ipa).trim();
    const ipaDisplay = ipaValue ? (/^\/.*\/$/.test(ipaValue) ? ipaValue : `/${ipaValue}/`) : '';
    const pos = pick(item, 'pos', 'POS');
    const meaning = pick(item, 'meaning', 'Meaning');
    const english = pick(item, 'example_EN', 'exampleEn', 'Example_EN');
    const chinese = pick(item, 'example_ZH', 'exampleZh', 'Example_ZH');
    const wordButton = speechSupported ? `<button class="speech-button" type="button" data-speech="${esc(word)}" aria-label="Listen to ${esc(word)}" title="Listen to word">${speechIcon}</button>` : '';
    const exampleButton = speechSupported && english ? `<button class="speech-button example-speech" type="button" data-speech="${esc(english)}" aria-label="Listen to example sentence" title="Listen to example sentence">${speechIcon}</button>` : '';
    return `<article class="reading-card"><div class="vocab-primary"><h4>${esc(word)}</h4>${ipaDisplay ? `<span class="ipa" lang="en-fonipa">${esc(ipaDisplay)}</span>` : ''}${wordButton}</div><div class="reading-meaning">${pos ? `<span class="part-of-speech">${esc(pos)}</span>` : ''}${meaning ? `<span>${esc(meaning)}</span>` : ''}</div>${english ? `<div class="example-line"><p class="example-en">${esc(english)}</p>${exampleButton}</div>` : ''}${chinese ? `<p class="example-zh" lang="zh-Hant">${esc(chinese)}</p>` : ''}</article>`;
  }
  function phraseCard(item) {
    const phrase = pick(item, 'phrase', 'Phrase');
    const meaning = pick(item, 'meaning', 'Meaning');
    const english = pick(item, 'example_EN', 'exampleEn', 'Example_EN');
    const chinese = pick(item, 'example_ZH', 'exampleZh', 'Example_ZH');
    return `<article class="reading-card"><h4>${esc(phrase)}</h4>${meaning ? `<p class="reading-meaning">${esc(meaning)}</p>` : ''}${english ? `<p class="example-en">${esc(english)}</p>` : ''}${chinese ? `<p class="example-zh" lang="zh-Hant">${esc(chinese)}</p>` : ''}</article>`;
  }
  function questionCard(item, index) {
    const questionEn = pick(item, 'question', 'questionEn', 'Question_EN', 'Question');
    const questionZh = pick(item, 'questionZh', 'question_ZH', 'Question_ZH');
    const followUpEn = pick(item, 'followUpQuestion', 'followupEn', 'Followup_EN', 'Follow_Up_Question');
    const followUpZh = pick(item, 'followUpQuestionZh', 'followupZh', 'Followup_ZH', 'Follow_Up_ZH');
    const mainQuestion = questionEn ? `<p class="discussion-question-en" lang="en">${esc(questionEn)}</p>` : '';
    const mainTranslation = questionZh ? `<p class="discussion-question-zh" lang="zh-Hant">${esc(questionZh)}</p>` : '';
    const followUp = followUpEn || followUpZh ? `<div class="discussion-followup">${followUpEn ? `<p class="discussion-followup-en" lang="en">${esc(followUpEn)}</p>` : ''}${followUpZh ? `<p class="discussion-followup-zh" lang="zh-Hant">${esc(followUpZh)}</p>` : ''}</div>` : '';
    return `<article class="discussion-card"><span class="discussion-number">${String(index + 1).padStart(2, '0')}</span><div>${mainQuestion}${mainTranslation}${followUp}</div></article>`;
  }
  function noteCard(note) {
    const original = pick(note, 'originalExpression', 'original_Expression', 'Original_Expression');
    const correction = pick(note, 'correction', 'Correction');
    const explanation = pick(note, 'explanation', 'Explanation');
    const expression = pick(note, 'newExpression', 'New_Expression');
    return `<article class="reading-note">${original ? `<p><b>Original:</b> ${esc(original)}</p>` : ''}${correction ? `<p><b>Correction:</b> ${esc(correction)}</p>` : ''}${explanation ? `<p>${esc(explanation)}</p>` : ''}${expression ? `<p><b>New expression:</b> ${esc(expression)}</p>` : ''}</article>`;
  }
  function renderLesson(lesson) {
    const title = pick(lesson, 'title', 'Title') || 'English lesson';
    const vocabulary = asArray(lesson.vocabulary);
    const phrases = asArray(lesson.phrases);
    const questions = asArray(lesson.questions);
    const notes = asArray(pick(lesson, 'learningNotes', 'learning_notes') || []);
    const speechNote = speechSupported ? '' : '<p class="speech-unavailable-note">Audio playback is unavailable in this browser. You can still read and practice each word.</p>';
    const category = pick(lesson, 'category', 'Category') || 'English lesson';
    const level = pick(lesson, 'level', 'Level') || '';
    document.title = `${title} - Fieldnotes`;
    content.innerHTML = `<header class="reading-header"><div class="eyebrow">${esc(category)}${level ? ` <span aria-hidden="true">/</span> ${esc(level)}` : ''}</div><h1>${esc(title)}</h1><p class="reading-intro">${esc(pick(lesson, 'introduction', 'Introduction') || '')}</p><div class="reading-summary"><span>${vocabulary.length} vocabulary words</span><span>${phrases.length} useful phrases</span><span>${questions.length} discussion questions</span></div></header><section class="reading-section" id="vocabulary"><div class="reading-section-heading"><span class="section-index">01</span><div><h2>Vocabulary</h2><p>Words to make your ideas clear.</p></div><span class="section-total">${vocabulary.length} words</span></div>${speechNote}<div class="reading-grid">${vocabulary.map(vocabularyCard).join('')}</div></section><section class="reading-section"><div class="reading-section-heading"><span class="section-index">02</span><div><h2>Useful phrases</h2><p>Natural expressions for everyday conversation.</p></div><span class="section-total">${phrases.length} phrases</span></div><div class="reading-grid">${phrases.map(phraseCard).join('')}</div></section><section class="reading-section" id="discussion"><div class="reading-section-heading"><span class="section-index">03</span><div><h2>Discussion</h2><p>Take your time. Add examples and explain your point of view.</p></div><span class="section-total">${questions.length} questions</span></div><div class="discussion-list">${questions.map(questionCard).join('')}</div></section><section class="reading-section"><div class="reading-section-heading"><span class="section-index">04</span><div><h2>Learning notes</h2><p>Corrections and new expressions to remember.</p></div></div>${notes.length ? `<div class="notes-list">${notes.map(noteCard).join('')}</div>` : '<p class="notes-empty-large">No learning notes yet. Add corrections and new expressions after class.</p>'}</section><a class="back-link bottom-back" href="index.html">&larr; Back to all lessons</a>`;
    status.hidden = true;
    content.hidden = false;
    if (speechSupported) content.addEventListener('click', handleSpeechClick);
  }
  function resetSpeechButton(button) {
    if (!button) return;
    button.classList.remove('is-speaking');
    button.setAttribute('aria-pressed', 'false');
    button.removeAttribute('aria-busy');
  }
  function handleSpeechClick(event) {
    const button = event.target.closest('.speech-button');
    if (!button) return;
    if (activeSpeechButton === button) {
      window.speechSynthesis.cancel();
      resetSpeechButton(activeSpeechButton);
      activeSpeechButton = null;
      return;
    }
    window.speechSynthesis.cancel();
    resetSpeechButton(activeSpeechButton);
    const utterance = new SpeechSynthesisUtterance(button.dataset.speech);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    activeSpeechButton = button;
    button.classList.add('is-speaking');
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-busy', 'true');
    const finish = () => {
      if (activeSpeechButton === button) {
        resetSpeechButton(button);
        activeSpeechButton = null;
      }
    };
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.speak(utterance);
  }
  loadLesson();
})();

(() => {
  'use strict';

  const apiUrl = String(window.LESSONS_API_URL || '').trim();
  const status = document.getElementById('flashcard-status');
  const empty = document.getElementById('flashcard-empty');
  const study = document.getElementById('flashcard-study');
  const stage = document.getElementById('flashcard-stage');
  const card = document.getElementById('flashcard');
  const rotator = document.getElementById('flashcard-rotator');
  const frontWord = document.getElementById('front-word');
  const backContent = document.getElementById('back-content');
  const progress = document.getElementById('card-progress');
  const topicLabel = document.getElementById('card-topic');
  const favoriteButton = document.getElementById('favorite-button');
  const favoriteCount = document.getElementById('favorite-count');
  const allWordsButton = document.getElementById('all-words');
  const savedWordsButton = document.getElementById('saved-words');
  const topicSelect = document.getElementById('topic-select');
  const searchInput = document.getElementById('vocab-search');
  const shuffleButton = document.getElementById('shuffle-button');
  const shuffleAction = document.getElementById('shuffle-action');
  const resetOrderButton = document.getElementById('reset-order');
  const audioFallback = document.getElementById('audio-fallback');
  const speechSupported = Boolean(window.speechSynthesis && 'SpeechSynthesisUtterance' in window);
  const favoriteStorageKey = 'fieldnotes:vocabulary:favorites:v1';
  const speechIcon = '<svg class="speech-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M3 8v4h3l4 3V5L6 8H3Z"/><path d="M13 7a4 4 0 0 1 0 6M15 4.5a7.5 7.5 0 0 1 0 11"/></svg>';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const pick = (object, ...keys) => keys.map(key => object?.[key]).find(value => value != null && value !== '');

  let allCards = [];
  let deck = [];
  let currentIndex = 0;
  let favorites = readFavorites();
  let favoritesOnly = false;
  let shuffled = false;
  let shuffledOrder = [];
  let activeSpeechButton = null;
  let activeSpeechUtterance = null;
  let speechActivated = Boolean(navigator.userActivation?.hasBeenActive);
  let pendingAutoWord = null;
  let pointerStart = null;
  let suppressCardClick = false;

  favoriteCount.textContent = String(favorites.size);
  audioFallback.hidden = speechSupported;
  allWordsButton.addEventListener('click', () => setFavoritesOnly(false));
  savedWordsButton.addEventListener('click', () => setFavoritesOnly(true));
  topicSelect.addEventListener('change', rebuildDeck);
  searchInput.addEventListener('input', rebuildDeck);
  shuffleButton.addEventListener('click', toggleShuffle);
  shuffleAction.addEventListener('click', toggleShuffle);
  resetOrderButton.addEventListener('click', () => {
    shuffled = false;
    shuffledOrder = [];
    updateShuffleButtons();
    rebuildDeck();
  });
  document.getElementById('previous-card').addEventListener('click', () => navigate(-1));
  document.getElementById('next-card').addEventListener('click', () => navigate(1));
  favoriteButton.addEventListener('click', toggleFavorite);
  card.addEventListener('click', event => {
    if (suppressCardClick) {
      suppressCardClick = false;
      return;
    }
    if (event.target.closest('button')) return;
    flipCard();
  });
  card.addEventListener('keydown', event => {
    if (event.target !== card) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      flipCard();
    }
  });
  card.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || event.target.closest('button')) return;
    pointerStart = {x: event.clientX, y: event.clientY};
    try { card.setPointerCapture(event.pointerId); } catch (_) {}
  });
  card.addEventListener('pointerup', event => {
    if (!pointerStart || event.pointerType !== 'touch') return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    pointerStart = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    suppressCardClick = true;
    navigate(dx < 0 ? 1 : -1);
    window.setTimeout(() => { suppressCardClick = false; }, 450);
  });
  card.addEventListener('pointercancel', () => { pointerStart = null; });
  card.addEventListener('click', handleSpeechClick);
  if (speechSupported && !speechActivated) {
    document.addEventListener('pointerdown', activateSpeech, true);
    document.addEventListener('keydown', activateSpeech, true);
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (event.target.closest('input,select,button')) return;
    navigate(event.key === 'ArrowRight' ? 1 : -1);
  });

  function readFavorites() {
    try {
      const stored = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
      return new Set(Array.isArray(stored) ? stored.map(String) : []);
    } catch (_) {
      return new Set();
    }
  }
  function persistFavorites() {
    try {
      localStorage.setItem(favoriteStorageKey, JSON.stringify([...favorites]));
    } catch (_) {
      // Keep the current session usable if browser storage is unavailable.
    }
    favoriteCount.textContent = String(favorites.size);
  }
  async function request(action, id) {
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    if (id) url.searchParams.set('id', id);
    const response = await fetch(url, {method:'GET', mode:'cors', redirect:'follow'});
    if (!response.ok) throw new Error(`The lesson service returned ${response.status}.`);
    const payload = await response.json();
    if (!payload || payload.ok !== true) throw new Error(payload?.error || 'The lesson service returned an invalid response.');
    return payload.data;
  }
  async function loadVocabulary() {
    if (!apiUrl || !/^https:\/\//i.test(apiUrl)) return showError('The lesson service is not configured.');
    try {
      const lessons = await request('lessons');
      const publishedLessons = Array.isArray(lessons) ? lessons : [];
      const courseDetails = [];
      for (let index = 0; index < publishedLessons.length; index += 4) {
        const batch = publishedLessons.slice(index, index + 4);
        const results = await Promise.all(batch.map(async lesson => {
          try { return await request('lesson', lesson.id); }
          catch (error) { return {loadError:error}; }
        }));
        courseDetails.push(...results);
      }
      allCards = courseDetails.flatMap((detail, courseIndex) => {
        if (!detail || detail.loadError) return [];
        const lesson = publishedLessons[courseIndex] || {};
        return (Array.isArray(detail.vocabulary) ? detail.vocabulary : []).map((entry, wordIndex) => ({
          key: String(pick(entry, 'id', 'ID') || `${lesson.id || courseIndex}:${wordIndex}`),
          word: pick(entry, 'word', 'Word') || '',
          ipa: pick(entry, 'ipa', 'IPA') || '',
          pos: pick(entry, 'pos', 'POS') || '',
          meaning: pick(entry, 'meaning', 'Meaning') || '',
          exampleEn: pick(entry, 'exampleEn', 'example_EN', 'Example_EN') || '',
          exampleZh: pick(entry, 'exampleZh', 'example_ZH', 'Example_ZH') || '',
          lessonTitle: pick(detail, 'title', 'Title') || pick(lesson, 'title', 'Title') || '',
          category: pick(detail, 'category', 'Category') || pick(lesson, 'category', 'Category') || 'Other'
        })).filter(entry => entry.word);
      });
      populateTopics();
      status.hidden = true;
      rebuildDeck({autoSpeak:true});
    } catch (error) {
      showError(`We couldn't load vocabulary. ${error.message || 'Check your connection and try again.'}`);
    }
  }
  function showError(message) {
    status.classList.add('error');
    status.innerHTML = `${esc(message)}<br><button class="flashcard-retry" type="button">Try again</button>`;
    status.hidden = false;
    status.querySelector('button').addEventListener('click', loadVocabulary);
  }
  function populateTopics() {
    const topics = [...new Set(allCards.map(entry => entry.category).filter(Boolean))].sort((a,b) => a.localeCompare(b));
    topicSelect.innerHTML = '<option value="all">All topics</option>' + topics.map(topic => `<option value="${esc(topic)}">${esc(topic)}</option>`).join('');
  }
  function shuffleList(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function rebuildDeck({autoSpeak = false} = {}) {
    stopSpeech();
    const term = searchInput.value.trim().toLocaleLowerCase();
    const source = shuffled ? shuffledOrder : allCards;
    deck = source.filter(entry => {
      const categoryMatch = topicSelect.value === 'all' || entry.category === topicSelect.value;
      const favoriteMatch = !favoritesOnly || favorites.has(entry.key);
      const searchText = [entry.word,entry.ipa,entry.pos,entry.meaning,entry.exampleEn,entry.exampleZh,entry.lessonTitle,entry.category].join(' ').toLocaleLowerCase();
      return categoryMatch && favoriteMatch && (!term || searchText.includes(term));
    });
    currentIndex = 0;
    renderCard(0, autoSpeak);
  }
  function setFavoritesOnly(value) {
    favoritesOnly = value;
    allWordsButton.classList.toggle('is-active', !value);
    savedWordsButton.classList.toggle('is-active', value);
    allWordsButton.setAttribute('aria-pressed', String(!value));
    savedWordsButton.setAttribute('aria-pressed', String(value));
    rebuildDeck();
  }
  function updateShuffleButtons() {
    shuffleButton.setAttribute('aria-pressed', String(shuffled));
    shuffleButton.textContent = shuffled ? 'Shuffled' : 'Shuffle';
  }
  function toggleShuffle() {
    shuffled = !shuffled;
    shuffledOrder = shuffled ? shuffleList(allCards) : [];
    updateShuffleButtons();
    rebuildDeck();
  }
  function speak(text, button) {
    if (!speechSupported || !text) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = button ? 0.9 : 1;
    activeSpeechButton = button;
    activeSpeechUtterance = utterance;
    if (button) button.classList.add('is-speaking');
    const finish = () => {
      if (activeSpeechUtterance === utterance) {
        resetSpeech(button);
        activeSpeechButton = null;
        activeSpeechUtterance = null;
      }
    };
    utterance.onend = finish;
    utterance.onerror = event => {
      finish();
      if (event.error === 'not-allowed' && !speechActivated) {
        pendingAutoWord = currentEntry();
      }
    };
    try {
      window.speechSynthesis.speak(utterance);
    } catch (_) {
      finish();
    }
  }
  function resetSpeech(button) {
    if (button) button.classList.remove('is-speaking');
  }
  function stopSpeech() {
    if (!speechSupported) return;
    if (activeSpeechUtterance || window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    resetSpeech(activeSpeechButton);
    activeSpeechButton = null;
    activeSpeechUtterance = null;
  }
  function currentEntry() {
    return deck[currentIndex] || null;
  }
  function playAutoWord(entry) {
    if (!entry || !speechSupported) return;
    if (!speechActivated) {
      pendingAutoWord = entry;
      return;
    }
    pendingAutoWord = null;
    speak(entry.word, null);
  }
  function activateSpeech(event) {
    if (speechActivated) return;
    speechActivated = true;
    document.removeEventListener('pointerdown', activateSpeech, true);
    document.removeEventListener('keydown', activateSpeech, true);
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.favorite-button')) return;
    if (target?.closest('.flashcard-audio')) {
      pendingAutoWord = null;
      return;
    }
    const navigationKey = event.type === 'keydown' && ['ArrowLeft','ArrowRight'].includes(event.key);
    const navigationButton = target?.closest('#previous-card, #next-card');
    if (navigationKey || navigationButton) {
      pendingAutoWord = null;
      return;
    }
    if (pendingAutoWord) playAutoWord(pendingAutoWord);
  }
  function handleSpeechClick(event) {
    const button = event.target.closest('.flashcard-audio');
    if (!button) return;
    event.stopPropagation();
    speak(button.dataset.speech, button);
  }
  function audioButton(text, label) {
    if (!speechSupported || !text) return '';
    return `<button class="flashcard-audio" type="button" data-speech="${esc(text)}" aria-label="${esc(label)}" title="${esc(label)}">${speechIcon}</button>`;
  }
  function renderCard(direction = 0, autoSpeak = false) {
    const hasCards = deck.length > 0;
    study.hidden = !hasCards;
    empty.hidden = hasCards;
    if (!hasCards) {
      progress.textContent = '00 / 00';
      return;
    }
    const entry = deck[currentIndex];
    card.classList.remove('is-flipped');
    card.setAttribute('aria-label', `Flashcard for ${entry.word}. Click or press Enter to flip.`);
    frontWord.textContent = entry.word;
    topicLabel.textContent = `${entry.category} / ${entry.lessonTitle}`;
    progress.textContent = `${String(currentIndex + 1).padStart(2,'0')} / ${String(deck.length).padStart(2,'0')}`;
    const ipa = entry.ipa ? (/^\/.*\/$/.test(String(entry.ipa).trim()) ? String(entry.ipa).trim() : `/${entry.ipa}/`) : '';
    backContent.innerHTML = `<div class="flashword-header"><div class="flashword-heading"><div class="flashword-title-line"><h2>${esc(entry.word)}</h2></div><div class="flashword-ipa-line">${ipa ? `<span class="flashword-ipa" lang="en-fonipa">${esc(ipa)}</span>` : ''}${audioButton(entry.word, `Listen to ${entry.word}`)}</div></div></div><p class="flashword-meta">${entry.pos ? `<span class="part-of-speech">${esc(entry.pos)}</span>` : ''}${esc(entry.meaning)}</p><section class="flashword-example"><div class="flashword-example-heading"><h3>Example</h3>${audioButton(entry.exampleEn, 'Listen to example sentence')}</div><p class="flashword-example-en">${esc(entry.exampleEn)}</p><p class="flashword-example-zh" lang="zh-Hant">${esc(entry.exampleZh)}</p></section>`;
    const isFavorite = favorites.has(entry.key);
    favoriteButton.classList.toggle('is-favorite', isFavorite);
    favoriteButton.textContent = isFavorite ? '\u2605' : '+';
    favoriteButton.setAttribute('aria-label', isFavorite ? 'Remove from favorites' : 'Add to favorites');
    favoriteButton.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
    if (direction) {
      stage.classList.remove('slide-from-left','slide-from-right');
      void stage.offsetWidth;
      stage.classList.add(direction > 0 ? 'slide-from-right' : 'slide-from-left');
    }
    if (autoSpeak) playAutoWord(entry);
  }
  function flipCard() {
    card.classList.toggle('is-flipped');
  }
  function navigate(direction) {
    if (!deck.length) return;
    stopSpeech();
    currentIndex = (currentIndex + direction + deck.length) % deck.length;
    renderCard(direction, true);
  }
  function toggleFavorite() {
    const entry = deck[currentIndex];
    if (!entry) return;
    if (favorites.has(entry.key)) favorites.delete(entry.key);
    else favorites.add(entry.key);
    persistFavorites();
    if (favoritesOnly && !favorites.has(entry.key)) rebuildDeck();
    else renderCard();
  }

  loadVocabulary();
})();

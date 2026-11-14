(() => {
  'use strict';
  const apiUrl = String(window.LESSONS_API_URL || '').trim();
  const list = document.getElementById('lesson-list');
  const status = document.getElementById('status');
  const empty = document.getElementById('empty');
  const search = document.getElementById('search');
  const filters = document.getElementById('filters');
  const count = document.getElementById('result-count');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let lessons = [];
  let activeCategory = 'all';

  search.addEventListener('input', renderCards);

  async function request(action) {
    const url = new URL(apiUrl);
    url.searchParams.set('action', action);
    const response = await fetch(url, { method: 'GET', mode: 'cors', redirect: 'follow' });
    if (!response.ok) throw new Error(`The lesson service returned ${response.status}.`);
    const payload = await response.json();
    if (!payload || payload.ok !== true) throw new Error(payload?.error || 'The lesson service returned an invalid response.');
    return payload.data;
  }
  async function loadLessons() {
    if (!apiUrl || !/^https:\/\//i.test(apiUrl)) {
      showError('Add the Apps Script Web App URL to config.js to load lessons.');
      return;
    }
    status.classList.remove('error');
    status.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Gathering your lessons...</span>';
    status.hidden = false;
    try {
      const data = await request('lessons');
      lessons = Array.isArray(data) ? data : [];
      status.hidden = true;
      buildFilters();
      renderCards();
    } catch (error) {
      showError(`We couldn't load the lessons. ${error.message || 'Check the connection and try again.'}`);
    }
  }
  function showError(message) {
    status.classList.add('error');
    status.innerHTML = `${esc(message)}<br><button class="retry" type="button">Try again</button>`;
    status.hidden = false;
    status.querySelector('button').addEventListener('click', loadLessons);
    count.textContent = 'Unable to load';
  }
  function buildFilters() {
    const categories = [...new Set(lessons.map(lesson => String(lesson.category || '').trim()).filter(Boolean))];
    filters.innerHTML = '<button class="filter-btn active" type="button" data-filter="all">All lessons</button>' + categories.map(category => `<button class="filter-btn" type="button" data-filter="${esc(category)}">${esc(category)}</button>`).join('');
    filters.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
      filters.querySelector('.active')?.classList.remove('active');
      button.classList.add('active');
      activeCategory = button.dataset.filter;
      renderCards();
    }));
  }
  function renderCards() {
    const term = search.value.trim().toLocaleLowerCase();
    const visible = lessons.filter(lesson => {
      const matchesCategory = activeCategory === 'all' || String(lesson.category || '') === activeCategory;
      const searchable = [lesson.title, lesson.category, lesson.description, lesson.level].join(' ').toLocaleLowerCase();
      return matchesCategory && (!term || searchable.includes(term));
    });
    list.innerHTML = visible.map((lesson, index) => {
      const title = String(lesson.title || 'Untitled lesson');
      const id = encodeURIComponent(String(lesson.id || ''));
      const lessonNumber = String(lesson.id || `L${String(index + 1).padStart(3, '0')}`);
      const vocabularyCount = Number(lesson.vocabularyCount) || 0;
      return `<a class="lesson-entry" href="lesson.html?id=${id}" target="_blank" rel="noopener" aria-label="Open ${esc(title)} lesson in a new tab"><span class="entry-number">${esc(lessonNumber)}</span><div class="entry-content"><div class="entry-meta"><span class="entry-category">${esc(lesson.category || 'English lesson')}</span><span>${esc(lesson.level || 'All levels')}</span></div><h2>${esc(title)}</h2><p class="entry-description">${esc(lesson.description || '')}</p><div class="entry-bottom">${vocabularyCount || '--'} vocabulary words</div></div><span class="entry-arrow" aria-hidden="true">&rarr;</span></a>`;
    }).join('');
    count.textContent = `${String(visible.length).padStart(2, '0')} ${visible.length === 1 ? 'lesson' : 'lessons'}`;
    empty.hidden = visible.length > 0;
  }
  loadLessons();
})();

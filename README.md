# Fieldnotes - English Lessons

Responsive static website for the three-course Google Sheets / Apps Script lesson package. The lesson list and lesson detail are fetched live from the JSON API. Source fields are not displayed.

## API connection

The Apps Script deployment ID is stored in `config.js`, which builds the `/exec` URL. The front end calls `?action=lessons` for published lesson cards and `?action=lesson&id=L001` for lesson detail. Responses use `{ "ok": true, "data": ... }`.

## Publish the website

Host `index.html`, `lesson.html`, `styles.css`, `home.css`, `reading.css`, `config.js`, `app.js`, and `lesson.js` together on a static web host. The Apps Script endpoint must be deployed for the site visitor to access it and allow cross-origin reads.

The Apps Script source is in `Code.gs`. Its sheet names are `Lessons`, `Lesson_Vocabulary`, `Lesson_Phrases`, `Lesson_Questions`, and `Learning_Notes`. Add an optional `IPA` header to `Lesson_Vocabulary` (after `Word` is recommended) and enter transcriptions in Google Sheets. `Code.gs` now returns that value as `ipa`; blank or missing IPA values remain safe and the website never infers a transcription. The detail page is a separate URL (`lesson.html?id=L001`) so lessons can be bookmarked and read in a larger layout.

For bilingual discussion prompts, add `Question_EN`, `Question_ZH`, `Followup_EN`, and `Followup_ZH` headers to `Lesson_Questions` and fill those values in Sheets. `Code.gs` maps them to the existing `question` and `followUpQuestion` API fields plus optional Chinese fields. It falls back to the legacy `Question` and `Follow_Up_Question` columns for English, so existing rows keep working.

Vocabulary words and their English example sentences have independent icon-only browser-native speech buttons (`en-US`, rate `0.9`). Browsers without SpeechSynthesis show a short fallback note and omit the buttons.

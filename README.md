# Word Vue — Wordle-like game (Vue 3, no build step)

A simple Wordle-style game built with Vue 3 via CDN. Guess a five-letter English word. Unlimited replays — no daily lock.

## Run

- Option 1: double-click `index.html` to open in your browser.
- Option 2: serve the folder (recommended):
  - Python: `python3 -m http.server 5173`
  - Node (if installed): `npx serve .`
  - Then open `http://localhost:5173`.

## Play

- Type letters on your keyboard or click the on-screen keys.
- Press Enter to submit, Backspace to delete.
- Colors:
  - Green = correct letter, correct spot.
  - Yellow = letter exists, wrong spot.
  - Gray = not in the word.
- Click “New Game” anytime to play with a different random word.

## Customize

- Larger dictionary: place text files (one word per line, English only, 5 letters, uppercase/lowercase fine) in `dict/`:
  - `dict/answers.txt` — candidates for the secret word
  - `dict/allowed.txt` — valid guesses (will be merged with answers)
  The app auto-loads these on start. If missing, it falls back to the bundled `words.js`.

- You can replace the included `dict/*.txt` with a bigger list (e.g., Wordle’s “allowed guesses” list). Make sure they’re 5-letter A–Z words, one per line.

- Guesses are validated against the allowed list. Provide `dict/allowed.txt` (full Wordle list recommended) to ensure strict validation. If missing, the bundled `words.js` list is used.

### Import via UI

- Click `Import Words` in the top bar.
- Select your `answers.txt` (5-letter words, one per line), then your `allowed.txt`.
- The lists are stored in `localStorage` and will be used automatically on next load.

## Notes

- No build tools needed; everything is plain HTML/CSS/JS.
- Vue 3 is loaded from a CDN for simplicity.
- Statistics are stored locally in `localStorage` under `word-vue:stats`.

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
  The provided files already contain the full Wordle lists (≈14.8k entries). `words.js` is auto-generated from these files so the app works even when opened directly from disk.

- You can replace the included `dict/*.txt` with your own lists (one uppercase/lowercase word per line). After editing, regenerate `words.js` so the app picks up the changes:

  ```sh
  node - <<'NODE'
  const fs = require('fs');
  const read = f => fs.readFileSync(f,'utf8').split(/\r?\n/).map(s=>s.trim().toUpperCase()).filter(s=>/^[A-Z]{5}$/.test(s));
  const answers = Array.from(new Set(read('dict/answers.txt')));
  const allowed = new Set(read('dict/allowed.txt'));
  for (const w of answers) allowed.add(w);
  const chunk = (arr) => arr.reduce((lines, w, i) => {
    if (i % 20 === 0) lines.push('  ' + JSON.stringify(w));
    else lines[lines.length - 1] += ', ' + JSON.stringify(w);
    return lines;
  }, []).join('\n');
  const out = `// Auto-generated from dict/answers.txt and dict/allowed.txt\n`
    + `window.ANSWER_WORDS = [\n${chunk(answers)}\n];\n`
    + `window.ALLOWED_WORDS = [\n${chunk([...allowed])}\n];\n`;
  fs.writeFileSync('words.js', out);
  NODE
  ```

- Guesses are validated against the allowed list. With the bundled files you get the full Wordle dictionary by default.

## Notes

- No build tools needed; everything is plain HTML/CSS/JS.
- Vue 3 is loaded from a CDN for simplicity.
- Statistics are stored locally in `localStorage` under `word-vue:stats`.

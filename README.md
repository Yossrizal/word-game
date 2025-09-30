# Word Vue

Modern Wordle-style word game powered by Vue 3 and plain HTML/CSS/JS. Guess the five-letter word, track your stats, and play as many rounds as you like with a refreshed, rounded UI.

![App preview](preview.png)

## Highlights

- Vue 3 single-page app with flip animations and keyboard support
- Unlimited games with instant “New Game”
- Local statistics (played, win %, streaks, distribution)
- Curated dark glassmorphism theme with accessible contrasts
- Strict validation against a full 14 k+ Wordle dictionary loaded from text files

## Prerequisites

- Node.js 18+ (for running a static dev server via `npx`)

## Run Locally

The app fetches dictionary files (`dict/*.txt`), so you must serve it from HTTP/HTTPS.

```bash
# from repo root
npx serve .
# open the reported URL (default http://localhost:3000)
```

> You can install the server globally (`npm install -g serve`) if you prefer.

## Gameplay

- Type on your keyboard or click the on-screen keys.
- `Enter` submits, `Backspace` deletes.
- Tile colors follow Wordle rules: green = exact match, yellow = letter exists elsewhere, dark = absent.
- Click **New Game** anytime for a fresh word.

## Dictionaries & Customisation

Word lists live in the `dict/` folder:

- `dict/answers.txt` — words the game chooses from
- `dict/allowed.txt` — valid guesses (auto-merged with answers on load)

Both files are bundled with the full Wordle dictionary (~14 855 entries). To use your own:

1. Replace either/both files with your word lists (one 5-letter word per line; case-insensitive).
2. Refresh the browser — the Vue app re-fetches the files on startup.

If the files can’t be fetched (e.g. server misconfiguration), the app falls back to a tiny built-in list and shows a toast warning.

## Statistics

- Stored in `localStorage` under `word-vue:stats`.
- Includes games played, win rate, current/max streak, and guess distribution.
- Clearing browser storage (or using incognito) resets the stats.

## Project Structure

```
index.html   # single page entry point
style.css    # theme and layout
app.js       # Vue 3 application logic
dict/        # answer & guess dictionaries (text files)
```

## Notes

- No build step required; everything runs in the browser.
- Network access is only needed for the Vue CDN and loading the local dictionary files.
- Feel free to tweak the theme in `style.css` to match your brand or colour palette.

Happy guessing!

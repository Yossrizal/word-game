(() => {
  const { createApp } = Vue;

  const ROWS = 6;
  const COLS = 5;
  const FLIP_INTERVAL_MS = 260;
  const SHAKE_DURATION_MS = 600;
  const TOAST_DURATION_MS = 1600;
  const STORAGE_KEY_STATS = "word-vue:stats";
  const ANSWERS_PATH = "dict/answers.txt";
  const ALLOWED_PATH = "dict/allowed.txt";

  const KEY_LAYOUT = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  function createEmptyRows() {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ letter: "", state: "", flip: false }))
    );
  }

  function createInitialStats() {
    return {
      played: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      distribution: Array(ROWS).fill(0),
    };
  }

  function tallyLetters(word) {
    const bucket = Object.create(null);
    for (const letter of word) bucket[letter] = (bucket[letter] || 0) + 1;
    return bucket;
  }

  function evaluateGuess(answer, guess) {
    const evaluation = Array(COLS).fill("absent");
    const counts = tallyLetters(answer);

    for (let index = 0; index < COLS; index += 1) {
      if (guess[index] === answer[index]) {
        evaluation[index] = "correct";
        counts[guess[index]] -= 1;
      }
    }

    for (let index = 0; index < COLS; index += 1) {
      if (evaluation[index] === "correct") continue;
      const letter = guess[index];
      if (counts[letter] > 0) {
        evaluation[index] = "present";
        counts[letter] -= 1;
      }
    }

    return evaluation;
  }

  const app = createApp({
    data() {
      return {
        rows: createEmptyRows(),
        currentRow: 0,
        currentCol: 0,
        answer: "",
        message: "",
        shakeRow: -1,
        revealingRow: -1,
        revealing: false,
        keyRows: KEY_LAYOUT,
        keyState: Object.create(null),
        showStats: false,
        stats: createInitialStats(),
        answerWords: [],
        allowedWords: new Set(),
        dictionaryLoaded: false,
      };
    },
    computed: {
      winRate() {
        return this.stats.played ? Math.round((this.stats.wins / this.stats.played) * 100) : 0;
      },
    },
    mounted() {
      this.restoreStats();
      this.initialise();
      window.addEventListener("keydown", this.onKeydown);
    },
    beforeUnmount() {
      window.removeEventListener("keydown", this.onKeydown);
    },
    methods: {
      async initialise() {
        await this.loadDictionary();
        this.dictionaryLoaded = true;

        if (!this.answerWords.length) this.answerWords = ["APPLE"];
        if (!this.allowedWords.size) this.allowedWords = new Set(this.answerWords);

        this.startRound();
      },

      startRound() {
        this.rows = createEmptyRows();
        this.currentRow = 0;
        this.currentCol = 0;
        this.keyState = Object.create(null);
        this.message = "";
        this.shakeRow = -1;
        this.revealingRow = -1;
        this.revealing = false;
        this.answer = this.pickRandomAnswer();
      },

      pickRandomAnswer() {
        return this.answerWords[Math.floor(Math.random() * this.answerWords.length)];
      },

      async loadDictionary() {
        const answers = await this.fetchWordList(ANSWERS_PATH);
        const allowed = await this.fetchWordList(ALLOWED_PATH);

        if (answers.length) this.answerWords = answers;
        if (allowed.length) this.allowedWords = new Set(allowed);

        if (this.answerWords.length) {
          if (!this.allowedWords.size) this.allowedWords = new Set(this.answerWords);
          else this.answerWords.forEach((word) => this.allowedWords.add(word));
        }

        if (!answers.length || !allowed.length) this.toast("Word lists not found; using fallback words.");
      },

      async fetchWordList(path) {
        try {
          const response = await fetch(path, { cache: "no-store" });
          if (!response.ok) return [];
          const payload = await response.text();
          return payload
            .split(/\r?\n/)
            .map((word) => word.trim().toUpperCase())
            .filter((word) => /^[A-Z]{5}$/.test(word));
        } catch (_) {
          return [];
        }
      },

      press(key) {
        if (this.revealing) return;
        if (key === "ENTER") {
          this.submit();
          return;
        }
        if (key === "BACK") {
          this.backspace();
          return;
        }
        if (/^[A-Z]$/.test(key)) this.typeLetter(key);
      },

      onKeydown(event) {
        if (this.revealing) return;
        if (event.key === "Enter") {
          this.submit();
          return;
        }
        if (event.key === "Backspace") {
          this.backspace();
          return;
        }
        const letter = event.key.toUpperCase();
        if (/^[A-Z]$/.test(letter)) this.typeLetter(letter);
      },

      typeLetter(letter) {
        if (this.currentRow >= ROWS || this.currentCol >= COLS) return;
        const cell = this.rows[this.currentRow][this.currentCol];
        cell.letter = letter;
        cell.state = "filled";
        this.currentCol += 1;
      },

      backspace() {
        if (this.currentCol === 0) return;
        this.currentCol -= 1;
        const cell = this.rows[this.currentRow][this.currentCol];
        cell.letter = "";
        cell.state = "";
      },

      submit() {
        if (this.currentCol < COLS) {
          this.toast("Not enough letters");
          return;
        }

        const guess = this.rows[this.currentRow].map((cell) => cell.letter).join("");
        if (!this.allowedWords.has(guess)) {
          this.triggerShake(this.currentRow);
          this.toast("Not in word list");
          return;
        }

        const results = evaluateGuess(this.answer, guess);
        this.revealGuess(results, guess);
      },

      revealGuess(results, guess) {
        this.revealing = true;
        this.revealingRow = this.currentRow;
        const row = this.rows[this.currentRow];

        for (let index = 0; index < COLS; index += 1) {
          const delay = index * FLIP_INTERVAL_MS;
          setTimeout(() => {
            row[index].flip = true;
            setTimeout(() => {
              row[index].state = results[index];
              this.updateKeyState(row[index].letter, results[index]);
            }, 140);
            setTimeout(() => {
              row[index].flip = false;
            }, 520);
          }, delay);
        }

        const settleDelay = COLS * FLIP_INTERVAL_MS + 120;
        setTimeout(() => {
          this.revealing = false;
          this.revealingRow = -1;

          if (guess === this.answer) {
            this.toast("Nice! You got it.");
            this.finishGame(true, this.currentRow + 1);
            this.currentRow = ROWS; // lock further input
            return;
          }

          this.currentRow += 1;
          this.currentCol = 0;

          if (this.currentRow >= ROWS) {
            this.toast(`Answer: ${this.answer}`);
            this.finishGame(false, ROWS);
          }
        }, settleDelay);
      },

      updateKeyState(letter, state) {
        const priority = { absent: 0, present: 1, correct: 2 };
        const current = this.keyState[letter];
        if (!current || priority[state] > priority[current]) {
          this.keyState[letter] = state;
        }
      },

      triggerShake(rowIndex) {
        this.shakeRow = rowIndex;
        clearTimeout(this._shakeTimer);
        this._shakeTimer = setTimeout(() => {
          this.shakeRow = -1;
        }, SHAKE_DURATION_MS);
      },

      finishGame(win, guessesUsed) {
        const summary = { ...this.stats };
        summary.played += 1;

        if (win) {
          summary.wins += 1;
          summary.currentStreak += 1;
          if (summary.currentStreak > summary.maxStreak) summary.maxStreak = summary.currentStreak;
          if (guessesUsed >= 1 && guessesUsed <= ROWS) summary.distribution[guessesUsed - 1] += 1;
        } else {
          summary.currentStreak = 0;
        }

        this.stats = summary;
        this.persistStats();
      },

      restoreStats() {
        try {
          const stored = localStorage.getItem(STORAGE_KEY_STATS);
          if (!stored) return;
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed === "object") {
            this.stats = Object.assign(createInitialStats(), parsed);
          }
        } catch (_) {
          this.stats = createInitialStats();
        }
      },

      persistStats() {
        try {
          localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(this.stats));
        } catch (_) {
          /* ignore storage errors (e.g. private mode) */
        }
      },

      toast(content) {
        this.message = content;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
          this.message = "";
        }, TOAST_DURATION_MS);
      },

      newGame() {
        if (!this.dictionaryLoaded && !this.answerWords.length) return;
        this.startRound();
      },

      distWidth(value) {
        const max = Math.max(1, ...this.stats.distribution);
        const width = Math.round((value / max) * 100);
        return `${Math.max(12, width)}%`;
      },
    },
  });

  app.mount("#app");
})();


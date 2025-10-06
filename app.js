(() => {
  const { createApp } = Vue;

  const ROWS = 6;
  const COLS = 5;
  const FLIP_INTERVAL_MS = 260;
  const SHAKE_DURATION_MS = 600;
  const TOAST_DURATION_MS = 1600;
  const STORAGE_KEY_STATS = "word-game:stats";
  const ANSWERS_PATH = "dict/answers.txt";
  const ALLOWED_PATH = "dict/allowed.txt";

  const KEY_LAYOUT = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ];

  const SHARE_SYMBOLS = {
    correct: "🟩",
    present: "🟨",
    absent: "⬛",
  };

  const SHARE_DISTRIBUTION_FILLED = "🟦";
  const SHARE_DISTRIBUTION_EMPTY = "▫️";

  const GAME_URL =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}`.replace(/index\.html$/, "")
      : "https://example.com";

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
        showResultModal: false,
        stats: createInitialStats(),
        answerWords: [],
        allowedWords: new Set(),
        dictionaryLoaded: false,
        shareGrid: [],
        lastResult: null,
        dictionaryEntry: null,
        dictionaryLoading: false,
        dictionaryError: "",
        dictionaryFetchedWord: "",
      };
    },
    computed: {
      winRate() {
        return this.stats.played ? Math.round((this.stats.wins / this.stats.played) * 100) : 0;
      },
      canShare() {
        return !!this.lastResult || this.stats.played > 0;
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
        this.shareGrid = [];
        this.showResultModal = false;
        this.dictionaryEntry = null;
        this.dictionaryError = "";
        this.dictionaryLoading = false;
        this.dictionaryFetchedWord = "";
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
        this.shareGrid.push(this.buildShareRow(results));
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
        this.lastResult = {
          win,
          guessesUsed,
          shareLines: [...this.shareGrid],
          answer: this.answer,
        };
        this.showResultModal = true;
        this.dictionaryEntry = null;
        this.dictionaryError = "";
        this.dictionaryLoading = false;
        this.dictionaryFetchedWord = "";
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
        this.showResultModal = false;
        this.startRound();
      },

      distWidth(value) {
        const max = Math.max(1, ...this.stats.distribution);
        const width = Math.round((value / max) * 100);
        return `${Math.max(12, width)}%`;
      },

      buildShareRow(results) {
        return results.map((state) => SHARE_SYMBOLS[state] || SHARE_SYMBOLS.absent).join("");
      },

      buildShareText() {
        const maxDistributionValue = Math.max(0, ...this.stats.distribution);
        const distributionLines = this.stats.distribution.map((value, index) => {
          const filledCount = value > 0 && maxDistributionValue > 0
            ? Math.max(1, Math.round((value / maxDistributionValue) * 5))
            : 0;
          const emptyCount = 5 - filledCount;
          const filledSquares = SHARE_DISTRIBUTION_FILLED.repeat(filledCount);
          const emptySquares = SHARE_DISTRIBUTION_EMPTY.repeat(Math.max(0, emptyCount));
          return `${index + 1}: ${filledSquares}${emptySquares} (${value})`;
        });

        if (this.lastResult) {
          const { win, guessesUsed, shareLines, answer } = this.lastResult;
          const attempts = win ? `${guessesUsed}/${ROWS}` : `X/${ROWS}`;
          const lines = [`Word Game ${attempts}`, "", ...shareLines];
          if (!win) lines.push("", `Answer: ${answer}`);
          lines.push("", "Guess Distribution", ...distributionLines);
          lines.push("", `Play: ${GAME_URL}`);
          return lines.join("\n").trim();
        }

        if (this.stats.played === 0) return "";

        return [
          "Word Game Stats",
          `Played: ${this.stats.played}`,
          `Win %: ${this.winRate}`,
          `Current Streak: ${this.stats.currentStreak}`,
          `Max Streak: ${this.stats.maxStreak}`,
          "",
          "Guess Distribution",
          ...distributionLines,
          "",
          `Play: ${GAME_URL}`,
        ].join("\n").trim();
      },

      async shareStats() {
        const text = this.buildShareText();
        if (!text) {
          this.toast("Play a game first to share stats");
          return;
        }

        try {
          if (typeof navigator !== "undefined" && navigator.share) {
            await navigator.share({ text });
            this.toast("Shared successfully");
            return;
          }
        } catch (_) {
          /* fall through to clipboard */
        }

        try {
          if (typeof navigator !== "undefined" && navigator.clipboard) {
            await navigator.clipboard.writeText(text);
            this.toast("Stats copied to clipboard");
            return;
          }
        } catch (_) {
          /* fall through to fallback */
        }

        this.toast("Sharing isn't supported here");
      },

      closeResultModal() {
        this.showResultModal = false;
      },

      async fetchDictionary() {
        if (!this.lastResult || !this.lastResult.answer) return;
        const word = this.lastResult.answer.toLowerCase();
        if (!word) return;
        if (this.dictionaryLoading) return;
        if (this.dictionaryEntry && this.dictionaryFetchedWord === word) return;

        this.dictionaryLoading = true;
        this.dictionaryError = "";

        try {
          const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);

          let payload;
          try {
            payload = await response.json();
          } catch (_) {
            payload = null;
          }

          if (!response.ok) {
            const message =
              payload && !Array.isArray(payload) && typeof payload === "object"
                ? payload.message || payload.title || payload.resolution
                : "";
            throw new Error(message || "Unable to find details for this word.");
          }

          const entry = Array.isArray(payload) && payload.length ? payload[0] : null;
          if (!entry) throw new Error("No definitions found for this word.");

          const phonetic = entry.phonetic
            || (Array.isArray(entry.phonetics)
              ? entry.phonetics.find((item) => typeof item?.text === "string")?.text
              : "");

          const meanings = Array.isArray(entry.meanings)
            ? entry.meanings.slice(0, 3).map((meaning) => ({
                partOfSpeech: meaning.partOfSpeech || "",
                definitions: Array.isArray(meaning.definitions)
                  ? meaning.definitions
                      .filter((def) => def && typeof def.definition === "string")
                      .slice(0, 3)
                      .map((def) => ({
                        definition: def.definition.trim(),
                        example: typeof def.example === "string" ? def.example.trim() : "",
                      }))
                  : [],
              }))
            : [];

          const hasDefinitions = meanings.some((meaning) => meaning.definitions.length > 0);
          if (!hasDefinitions) throw new Error("No definitions found for this word.");

          this.dictionaryEntry = {
            word: entry.word || this.lastResult.answer,
            phonetic: phonetic || "",
            meanings,
          };
          this.dictionaryFetchedWord = word;
        } catch (error) {
          this.dictionaryError = error?.message || "Unable to find details for this word.";
          this.dictionaryEntry = null;
          this.dictionaryFetchedWord = "";
        } finally {
          this.dictionaryLoading = false;
        }
      },
    },
  });

  app.mount("#app");
})();

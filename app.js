(() => {
  const { createApp } = Vue;

  const ROWS = 6;
  const COLS = 5;

  function makeEmptyRows() {
    return Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ letter: "", state: "", flip: false }))
    );
  }

  function countLetters(word) {
    const map = Object.create(null);
    for (const ch of word) map[ch] = (map[ch] || 0) + 1;
    return map;
  }

  function evaluateGuess(answer, guess) {
    // Returns array of states: 'correct' | 'present' | 'absent'
    const res = Array(COLS).fill("absent");
    const counts = countLetters(answer);

    // First pass: correct positions
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === answer[i]) {
        res[i] = "correct";
        counts[guess[i]] -= 1;
      }
    }
    // Second pass: presents
    for (let i = 0; i < COLS; i++) {
      if (res[i] === "correct") continue;
      const ch = guess[i];
      if (counts[ch] > 0) {
        res[i] = "present";
        counts[ch] -= 1;
      }
    }
    return res;
  }

  const app = createApp({
    data() {
      return {
        rows: makeEmptyRows(),
        currentRow: 0,
        currentCol: 0,
        answer: "",
        message: "",
        shakeRow: -1,
        revealingRow: -1,
        revealing: false,
        keyRows: [
          ["Q","W","E","R","T","Y","U","I","O","P"],
          ["A","S","D","F","G","H","J","K","L"],
          ["Z","X","C","V","B","N","M"],
        ],
        keyState: {}, // letter: 'correct' | 'present' | 'absent'
        showStats: false,
        stats: {
          played: 0,
          wins: 0,
          currentStreak: 0,
          maxStreak: 0,
          distribution: [0,0,0,0,0,0],
        },
        // dictionary
        answerWords: [],
        allowedWords: new Set(),
        dictionaryLoaded: false,
      };
    },
    mounted() {
      this.loadStats();
      this.loadDictionary().finally(() => {
        this.dictionaryLoaded = true;
        if (!this.answerWords.length) {
          this.answerWords = ["APPLE"];
        }
        if (!this.allowedWords.size) {
          this.allowedWords = new Set(this.answerWords);
        }
        this.newGame();
      });
      window.addEventListener("keydown", this.onKeydown);
    },
    beforeUnmount() {
      window.removeEventListener("keydown", this.onKeydown);
    },
    methods: {
      async loadDictionary() {
        const loadList = async (path) => {
          try {
            const res = await fetch(path, { cache: "no-store" });
            if (!res.ok) return null;
            const txt = await res.text();
            return txt
              .split(/\r?\n/)
              .map(s => s.trim().toUpperCase())
              .filter(s => /^[A-Z]{5}$/.test(s));
          } catch (_) {
            return null;
          }
        };

        const answers = await loadList("dict/answers.txt");
        const allowed = await loadList("dict/allowed.txt");

        if (answers && answers.length) this.answerWords = answers;
        if (allowed && allowed.length) {
          this.allowedWords = new Set(allowed);
        }
        if (this.answerWords.length) {
          if (!this.allowedWords.size) this.allowedWords = new Set(this.answerWords);
          else this.answerWords.forEach(word => this.allowedWords.add(word));
        }
        if (!answers || !answers.length || !this.allowedWords.size) {
          this.toast("Word lists not found; using fallback words.");
        }
      },
      randomAnswer() {
        const list = this.answerWords && this.answerWords.length ? this.answerWords : ["APPLE"];
        return list[Math.floor(Math.random() * list.length)];
      },
      newGame() {
        if (!this.dictionaryLoaded && !this.answerWords.length) return;
        this.rows = makeEmptyRows();
        this.currentRow = 0;
        this.currentCol = 0;
        this.keyState = {};
        this.message = "";
        this.shakeRow = -1;
        this.revealingRow = -1;
        this.revealing = false;
        this.answer = this.randomAnswer();
      },
      press(key) {
        if (this.revealing) return;
        if (key === "ENTER") return this.submit();
        if (key === "BACK") return this.backspace();
        if (/^[A-Z]$/.test(key)) return this.typeLetter(key);
      },
      onKeydown(e) {
        if (this.revealing) return;
        if (e.key === "Enter") return this.submit();
        if (e.key === "Backspace") return this.backspace();
        const k = e.key.toUpperCase();
        if (/^[A-Z]$/.test(k)) this.typeLetter(k);
      },
      typeLetter(ch) {
        if (this.currentRow >= ROWS) return;
        if (this.currentCol >= COLS) return;
        const cell = this.rows[this.currentRow][this.currentCol];
        cell.letter = ch;
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
          return this.toast("Not enough letters");
        }
        const guess = this.rows[this.currentRow].map(c => c.letter).join("");
        if (!this.isValidGuess(guess)) {
          this.shake(this.currentRow);
          return this.toast("Not in word list");
        }
        const states = evaluateGuess(this.answer, guess);
        this.revealRow(states, guess);
      },
      revealRow(states, guess) {
        this.revealing = true;
        this.revealingRow = this.currentRow;
        const row = this.rows[this.currentRow];
        const step = 260;
        for (let i = 0; i < COLS; i++) {
          setTimeout(() => {
            row[i].flip = true;
            setTimeout(() => {
              row[i].state = states[i];
              this.updateKeyState(row[i].letter, states[i]);
            }, 140);
            setTimeout(() => {
              row[i].flip = false;
            }, 520);
          }, i * step);
        }
        setTimeout(() => {
          this.revealing = false;
          this.revealingRow = -1;
          if (guess === this.answer) {
            this.toast("Nice! You got it.");
            this.finishGame(true, this.currentRow + 1);
            this.currentRow = ROWS; // lock
            return;
          }
          this.currentRow += 1;
          this.currentCol = 0;
          if (this.currentRow >= ROWS) {
            this.toast(`Answer: ${this.answer}`);
            this.finishGame(false, ROWS);
          }
        }, COLS * step + 100);
      },
      updateKeyState(letter, state) {
        const priority = { absent: 0, present: 1, correct: 2 };
        const curr = this.keyState[letter];
        if (!curr || priority[state] > priority[curr]) {
          this.keyState[letter] = state;
        }
      },
      isValidGuess(word) {
        // Strict validation: must be present in allowed word set
        return this.allowedWords.has(word);
      },
      finishGame(win, guesses) {
        const s = { ...this.stats };
        s.played += 1;
        if (win) {
          s.wins += 1;
          s.currentStreak += 1;
          if (s.currentStreak > s.maxStreak) s.maxStreak = s.currentStreak;
          if (guesses >= 1 && guesses <= 6) s.distribution[guesses - 1] += 1;
        } else {
          s.currentStreak = 0;
        }
        this.stats = s;
        this.saveStats();
      },
      loadStats() {
        try {
          const raw = localStorage.getItem("word-vue:stats");
          if (raw) {
            const s = JSON.parse(raw);
            if (s && typeof s === "object") this.stats = Object.assign({
              played: 0, wins: 0, currentStreak: 0, maxStreak: 0, distribution: [0,0,0,0,0,0]
            }, s);
          }
        } catch (_) {}
      },
      saveStats() {
        try { localStorage.setItem("word-vue:stats", JSON.stringify(this.stats)); } catch (_) {}
      },
      toast(msg) {
        this.message = msg;
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => (this.message = ""), 1600);
      },
      shake(index) {
        this.shakeRow = index;
        clearTimeout(this._shakeTimer);
        this._shakeTimer = setTimeout(() => (this.shakeRow = -1), 600);
      },
      distWidth(v) {
        const max = Math.max(1, ...this.stats.distribution);
        const pct = Math.max(12, Math.round((v / max) * 100));
        return pct + "%";
      },
    },
    computed: {
      winRate() {
        return this.stats.played ? Math.round((this.stats.wins / this.stats.played) * 100) : 0;
      }
    }
  });

  app.mount("#app");
})();

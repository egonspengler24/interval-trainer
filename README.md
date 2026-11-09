# Interval Trainer

A browser game for learning musical intervals on a two-octave piano keyboard (C3–C5).

The game marks a root note with a green circle and asks you to find an interval from it. Pick a wrong key and it tells you which interval you actually played. Keep going until you find the right one.

Plain HTML, CSS and JavaScript. Nothing to build, nothing is installed, and no settings are saved between visits.

## How to play

1. Tick the intervals you want to practise (m2 through P8). Presets: All, None, Consonant, Dissonant.
2. Set **Questions per root note**: how many questions you get on one root before it moves to a new one.
3. Press **Start** (or Enter).

## Features

- Sound for every key, made in the browser with the Web Audio API (no audio files needed)
- Ascending, descending, or both directions
- A random root, or the same root every time for focused practice
- Session length: endless, 10, 20 or 50 questions, with a summary at the end
- Wrong answers name the interval you actually clicked
- Hint (shows the answer with a dashed circle) and Reveal & skip
- Ear mode: the prompt hides the interval name and you find the note by listening
- Option to accept the right note in any octave
- Key labels (C only, all, none) and sharp or flat spelling
- Score, streak, best streak, average time, and results for each interval

Keyboard shortcuts: **Enter** start · **Esc** stop · **Space** replay · **H** hint · **S** reveal & skip

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

## Host on GitHub Pages

```bash
git init
git add .
git commit -m "Interval Trainer"
gh repo create interval-trainer --public --source . --push
gh api repos/{owner}/interval-trainer/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

After a minute or so the game is live at `https://<your-username>.github.io/interval-trainer/`.

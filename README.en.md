[简体中文](README.zh-CN.md) | [繁體中文](README.zh-TW.md) | [English](README.en.md) | [日本語](README.ja.md) | [한국어](README.ko.md)

# Tetris

A classic Tetris web game that follows modern Tetris guidelines, supports keyboard and touch controls, and ships with a multilingual interface.

## Features

- 🎮 7 classic tetrominoes with 7-bag randomizer (all 7 pieces appear once every 7 spawns)
- 🔄 SRS bi-directional rotation (clockwise + counter-clockwise) with wall kicks
- 📦 Hold piece (once per piece)
- 👻 Ghost piece drop preview
- 📊 Score, level, lines cleared, and persistent high score (localStorage)
- ⚡ Automatic speed-up on level-up
- 🏆 T-spin detection and B2B combo bonuses
- 🔊 Web Audio synthesized sound effects (mutable)
- 🌐 Multilingual: 简体中文 / 繁體中文 / English / 日本語 / 한국어 (auto-detects system language)
- 📱 Mobile touch controls with long-press repeat

## Controls

| Key | Action |
|-----|--------|
| ← → | Move left / right |
| ↑ / X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| ↓ | Soft drop |
| Space | Hard drop |
| C | Hold piece |
| P | Pause / Resume |

Mobile: tap rotate for clockwise, long-press for counter-clockwise; left/right/down buttons support long-press repeat.

## How to Run

Open `index.html` directly in a browser to start playing. You can also use a local server:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000/

## File Structure

- `index.html` - Page structure and UI elements
- `style.css` - Styling, animations and responsive layout
- `game.js` - Core game logic (board, pieces, scoring, sound, etc.)
- `i18n.js` - Internationalization module (language detection and translation dictionary)

## Notes

This code is AI-generated.

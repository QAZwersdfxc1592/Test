// 国际化模块:语言检测、翻译字典、文本应用
// 支持:简体中文(zh-CN)、繁体中文(zh-TW)、英语(en)、日语(ja)、韩语(ko)
// 其他语言自动回退到英语
(function() {
  'use strict';

  const SUPPORTED = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'];
  const STORAGE_KEY = 'tetris_lang';

  const translations = {
    'zh-CN': {
      _name: '简体中文',
      title: 'TETRIS',
      subtitle: '俄罗斯方块',
      startBtn: '开始游戏',
      pauseBtn: '暂停',
      resumeBtn: '继续',
      resetBtn: '重新开始',
      score: '分数',
      highScore: '最高分',
      level: '等级',
      lines: '行数',
      hold: '暂存',
      next: '下一个',
      help: '操作说明',
      helpMove: '左右移动',
      helpRotateCw: '顺时针旋转',
      helpRotateCcw: '逆时针旋转',
      helpDown: '加速下落',
      helpDrop: '直接落底',
      helpHold: '暂存方块',
      helpPause: '暂停/继续',
      mobileRotate: '旋转方块',
      mobileLeft: '左移',
      mobileRight: '右移',
      mobileDown: '加速下落',
      mobileDrop: '落底',
      mobileHold: '暂存方块',
      muteBtn: '静音切换',
      langLabel: '语言',
      overlayReady: '准备开始',
      overlayReadyMsg: '按下开始按钮或空格键开始游戏',
      overlayPause: '游戏暂停',
      overlayPauseMsg: '按 P 键或点击继续按钮恢复游戏',
      overlayGameOver: '游戏结束',
      overlayFinalScore: '最终得分',
      overlayLevel: '等级',
      overlayLines: '消除行数',
      overlayNewRecord: '🏆 新纪录!',
      overlayHighScore: '最高分',
      overlayRestart: '点击重新开始再来一局',
      single: 'SINGLE',
      double: 'DOUBLE',
      triple: 'TRIPLE',
      tetris: 'TETRIS',
      tspin: 'T-SPIN',
      tspinSingle: 'T-SPIN SINGLE',
      tspinDouble: 'T-SPIN DOUBLE',
      tspinTriple: 'T-SPIN TRIPLE',
      b2b: 'B2B'
    },

    'zh-TW': {
      _name: '繁體中文',
      title: 'TETRIS',
      subtitle: '俄羅斯方塊',
      startBtn: '開始遊戲',
      pauseBtn: '暫停',
      resumeBtn: '繼續',
      resetBtn: '重新開始',
      score: '分數',
      highScore: '最高分',
      level: '等級',
      lines: '行數',
      hold: '暫存',
      next: '下一個',
      help: '操作說明',
      helpMove: '左右移動',
      helpRotateCw: '順時針旋轉',
      helpRotateCcw: '逆時針旋轉',
      helpDown: '加速下落',
      helpDrop: '直接落底',
      helpHold: '暫存方塊',
      helpPause: '暫停/繼續',
      mobileRotate: '旋轉方塊',
      mobileLeft: '左移',
      mobileRight: '右移',
      mobileDown: '加速下落',
      mobileDrop: '落底',
      mobileHold: '暫存方塊',
      muteBtn: '靜音切換',
      langLabel: '語言',
      overlayReady: '準備開始',
      overlayReadyMsg: '按下開始按鈕或空格鍵開始遊戲',
      overlayPause: '遊戲暫停',
      overlayPauseMsg: '按 P 鍵或點擊繼續按鈕恢復遊戲',
      overlayGameOver: '遊戲結束',
      overlayFinalScore: '最終得分',
      overlayLevel: '等級',
      overlayLines: '消除行數',
      overlayNewRecord: '🏆 新紀錄!',
      overlayHighScore: '最高分',
      overlayRestart: '點擊重新開始再來一局',
      single: 'SINGLE',
      double: 'DOUBLE',
      triple: 'TRIPLE',
      tetris: 'TETRIS',
      tspin: 'T-SPIN',
      tspinSingle: 'T-SPIN SINGLE',
      tspinDouble: 'T-SPIN DOUBLE',
      tspinTriple: 'T-SPIN TRIPLE',
      b2b: 'B2B'
    },

    'en': {
      _name: 'English',
      title: 'TETRIS',
      subtitle: 'Tetris',
      startBtn: 'Start',
      pauseBtn: 'Pause',
      resumeBtn: 'Resume',
      resetBtn: 'Reset',
      score: 'Score',
      highScore: 'High Score',
      level: 'Level',
      lines: 'Lines',
      hold: 'Hold',
      next: 'Next',
      help: 'Controls',
      helpMove: 'Move left/right',
      helpRotateCw: 'Rotate clockwise',
      helpRotateCcw: 'Rotate counterclockwise',
      helpDown: 'Soft drop',
      helpDrop: 'Hard drop',
      helpHold: 'Hold piece',
      helpPause: 'Pause/Resume',
      mobileRotate: 'Rotate',
      mobileLeft: 'Left',
      mobileRight: 'Right',
      mobileDown: 'Soft drop',
      mobileDrop: 'Drop',
      mobileHold: 'Hold',
      muteBtn: 'Toggle mute',
      langLabel: 'Language',
      overlayReady: 'Ready',
      overlayReadyMsg: 'Press Start or Space to begin',
      overlayPause: 'Paused',
      overlayPauseMsg: 'Press P or click Resume to continue',
      overlayGameOver: 'Game Over',
      overlayFinalScore: 'Final Score',
      overlayLevel: 'Level',
      overlayLines: 'Lines cleared',
      overlayNewRecord: '🏆 New Record!',
      overlayHighScore: 'High Score',
      overlayRestart: 'Click Reset to play again',
      single: 'SINGLE',
      double: 'DOUBLE',
      triple: 'TRIPLE',
      tetris: 'TETRIS',
      tspin: 'T-SPIN',
      tspinSingle: 'T-SPIN SINGLE',
      tspinDouble: 'T-SPIN DOUBLE',
      tspinTriple: 'T-SPIN TRIPLE',
      b2b: 'B2B'
    },

    'ja': {
      _name: '日本語',
      title: 'TETRIS',
      subtitle: 'テトリス',
      startBtn: 'スタート',
      pauseBtn: '一時停止',
      resumeBtn: '再開',
      resetBtn: 'リセット',
      score: 'スコア',
      highScore: 'ハイスコア',
      level: 'レベル',
      lines: 'ライン数',
      hold: 'ホールド',
      next: '次',
      help: '操作方法',
      helpMove: '左右移動',
      helpRotateCw: '時計回り回転',
      helpRotateCcw: '反時計回り回転',
      helpDown: '下移動',
      helpDrop: 'ハードドロップ',
      helpHold: 'ホールド',
      helpPause: '一時停止/再開',
      mobileRotate: '回転',
      mobileLeft: '左',
      mobileRight: '右',
      mobileDown: '下',
      mobileDrop: '落とす',
      mobileHold: 'ホールド',
      muteBtn: 'ミュート切替',
      langLabel: '言語',
      overlayReady: '準備',
      overlayReadyMsg: 'スタートボタンまたはスペースキーで開始',
      overlayPause: '一時停止中',
      overlayPauseMsg: 'P キーまたは再開ボタンで再開',
      overlayGameOver: 'ゲームオーバー',
      overlayFinalScore: '最終スコア',
      overlayLevel: 'レベル',
      overlayLines: '消去ライン数',
      overlayNewRecord: '🏆 新記録!',
      overlayHighScore: 'ハイスコア',
      overlayRestart: 'リセットを押して再プレイ',
      single: 'SINGLE',
      double: 'DOUBLE',
      triple: 'TRIPLE',
      tetris: 'TETRIS',
      tspin: 'T-SPIN',
      tspinSingle: 'T-SPIN SINGLE',
      tspinDouble: 'T-SPIN DOUBLE',
      tspinTriple: 'T-SPIN TRIPLE',
      b2b: 'B2B'
    },

    'ko': {
      _name: '한국어',
      title: 'TETRIS',
      subtitle: '테트리스',
      startBtn: '시작',
      pauseBtn: '일시정지',
      resumeBtn: '계속',
      resetBtn: '리셋',
      score: '점수',
      highScore: '최고점수',
      level: '레벨',
      lines: '줄 수',
      hold: '보관',
      next: '다음',
      help: '조작법',
      helpMove: '좌우 이동',
      helpRotateCw: '시계방향 회전',
      helpRotateCcw: '반시계방향 회전',
      helpDown: '소프트 드롭',
      helpDrop: '하드 드롭',
      helpHold: '보관',
      helpPause: '일시정지/계속',
      mobileRotate: '회전',
      mobileLeft: '왼쪽',
      mobileRight: '오른쪽',
      mobileDown: '아래',
      mobileDrop: '떨어뜨리기',
      mobileHold: '보관',
      muteBtn: '음소거 전환',
      langLabel: '언어',
      overlayReady: '준비',
      overlayReadyMsg: '시작 버튼 또는 스페이스 키로 시작',
      overlayPause: '일시정지됨',
      overlayPauseMsg: 'P 키 또는 계속 버튼으로 재개',
      overlayGameOver: '게임 오버',
      overlayFinalScore: '최종 점수',
      overlayLevel: '레벨',
      overlayLines: '제거 줄 수',
      overlayNewRecord: '🏆 신기록!',
      overlayHighScore: '최고점수',
      overlayRestart: '리셋을 눌러 다시 시작',
      single: 'SINGLE',
      double: 'DOUBLE',
      triple: 'TRIPLE',
      tetris: 'TETRIS',
      tspin: 'T-SPIN',
      tspinSingle: 'T-SPIN SINGLE',
      tspinDouble: 'T-SPIN DOUBLE',
      tspinTriple: 'T-SPIN TRIPLE',
      b2b: 'B2B'
    }
  };

  // 将浏览器语言标签归一化到支持列表;不支持的语言返回 null(以便遍历后续候选)
  function normalizeLang(tag) {
    if (!tag) return null;
    const lower = tag.toLowerCase();
    if (lower.startsWith('zh')) {
      // zh-TW, zh-Hant, zh-HK, zh-MO → 繁体;其他(zh, zh-CN, zh-Hans, zh-SG)→ 简体
      if (lower.includes('tw') || lower.includes('hk') || lower.includes('mo') || lower.includes('hant')) {
        return 'zh-TW';
      }
      return 'zh-CN';
    }
    if (lower.startsWith('ja')) return 'ja';
    if (lower.startsWith('ko')) return 'ko';
    if (lower.startsWith('en')) return 'en';
    return null;  // 其他语言不在支持列表,返回 null 让调用方继续尝试下一个候选
  }

  // 自动检测首选语言:localStorage 记忆 > navigator.languages > navigator.language > 英语
  function detectLang() {
    // 1. 用户曾手动选择过(最高优先级)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) { /* 忽略 */ }

    // 2. 浏览器语言列表:从前往后逐个尝试,首个被支持的即为结果
    const candidates = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || 'en'];
    for (const c of candidates) {
      const norm = normalizeLang(c);
      if (norm && SUPPORTED.includes(norm)) return norm;
    }
    return 'en';  // 全部候选都不支持时兜底英语
  }

  let currentLang = 'en';

  function t(key) {
    const dict = translations[currentLang] || translations.en;
    return dict[key] !== undefined ? dict[key] : (translations.en[key] !== undefined ? translations.en[key] : key);
  }

  function setLang(lang) {
    if (!SUPPORTED.includes(lang)) lang = 'en';
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* 忽略 */ }
    applyTranslations();
    document.documentElement.lang = lang;
    // 通知外部模块(游戏)语言已变,以便刷新动态文本
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  function getLang() { return currentLang; }
  function getSupported() { return SUPPORTED; }
  function getLangName(lang) { return (translations[lang] || translations.en)._name; }

  // 应用静态文本:遍历所有 [data-i18n] 元素
  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      const key = el.getAttribute('data-i18n-aria');
      el.setAttribute('aria-label', t(key));
    });
  }

  // 暴露到全局(供 game.js 使用)
  window.i18n = { t, setLang, getLang, getSupported, getLangName, detectLang, applyTranslations };

  // 立即初始化:在 DOMContentLoaded 前先选定语言,避免闪烁
  currentLang = detectLang();
})();

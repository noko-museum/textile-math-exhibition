/**
 * helpers.js
 * アプリケーション全体で使い回せる共通ユーティリティ関数群
 */

/**
 * 数値を指定した最小値と最大値の間に収める（クランプ処理）
 * @param {number} value 対象の数値
 * @param {number} min 最小値
 * @param {number} max 最大値
 * @returns {number} クランプされた数値
 */
export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * 日付文字列を日本向けの分かりやすいフォーマット（YYYY/MM/DD HH:mm）に変換する
 * 管理画面のテーブル表示などで使用
 * @param {string|Date} dateInput 変換したい日付
 * @returns {string} フォーマットされた日付文字列
 */
export function formatDate(dateInput) {
  if (!dateInput) return '-';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '-';

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');

  return `${y}/${m}/${d} ${h}:${min}`;
}

/**
 * 連続した関数の実行を間引く（デバウンス処理）
 * テンキーの連打やAPIの過剰な呼び出しを防ぐために使用
 * @param {Function} func 実行したい関数
 * @param {number} wait 待機時間（ミリ秒）
 * @returns {Function} デバウンス化された関数
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 画面下部に一時的な通知メッセージ（トースト）を表示する
 * index.html の #notification 要素を使用
 * @param {string} message 表示するメッセージ
 * @param {number} duration 表示時間（ミリ秒、デフォルト3000ms）
 */
export function showNotification(message, duration = 3000) {
  const notification = document.getElementById('notification');
  const messageEl = document.getElementById('notificationMessage');
  
  if (!notification || !messageEl) {
    console.warn('通知用DOM要素が見つかりません。メッセージ:', message);
    return;
  }

  messageEl.textContent = message;
  notification.classList.remove('hidden');
  notification.classList.add('visible');

  // 指定時間後に非表示にする
  setTimeout(() => {
    notification.classList.remove('visible');
    notification.classList.add('hidden');
  }, duration);
}
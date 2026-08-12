/**
 * mode.js
 * URLクエリ「?mode=」によるモード判定を一元管理するモジュール。
 * 新しいモードを追加する場合は MODES に定数を追加するだけでよい
 * （例: 将来 ?mode=debug を追加する場合、MODES.DEBUG を追加してresolveMode()の
 *   対応を増やす）。
 *
 * 対応しているモード:
 *   - 未指定 / 不正な値 → NORMAL（来館者向け・保存/印刷不可）
 *   - ?mode=festival    → FESTIVAL（展示スタッフ向け・保存/印刷可能）
 */

export const MODES = {
  NORMAL: 'normal',
  FESTIVAL: 'festival'
};

function resolveMode(){
  const params = new URLSearchParams(window.location.search);
  const value = params.get('mode');
  const validModes = Object.values(MODES);
  return validModes.includes(value) ? value : MODES.NORMAL;
}

export const currentMode = resolveMode();
export const isFestivalMode = currentMode === MODES.FESTIVAL;

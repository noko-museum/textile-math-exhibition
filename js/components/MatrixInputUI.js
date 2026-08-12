/**
 * MatrixInputUI.js
 * 来館者が操作する入力パネル全体を管理するUIコンポーネント。
 *
 * 担当する3つの操作:
 *   1. サイズ選択（2×2 / 3×3 / 4×4 / 5×5）… Bの大きさ(n)を決める
 *   2. Bのマス目編集（タップで0/1切替）
 *   3. パターン選択（ストレート / 鏡映 / 山型）… A・Cを決める
 *
 * A・Cは、どのパターンでも常に同一の行列が使われる設計（WeaveEngine.js側のデータ仕様）
 * のため、ユーザーが選ぶのは「1つのパターン」だけでよい。
 *
 * 何か変更があるたびに、onChangeCallback({ B, n, pattern }) を呼び出す。
 */

import { WeaveEngine } from '../core/WeaveEngine.js';

const SIZE_OPTIONS = [2, 3, 4, 5];
const PATTERN_OPTIONS = ['repeat', 'mirror', 'mountain']; // WeaveEngine.PRESET_LABELSのキーと対応

export class MatrixInputUI {
  /**
   * @param {Object} config
   * @param {string} config.sizeContainerId - サイズ選択ボタンを描画する要素のID
   * @param {string} config.matrixContainerId - Bのマス目を描画する要素のID
   * @param {string} config.patternContainerId - パターン選択ボタンを描画する要素のID
   * @param {Function} config.onChange - 変更時に呼ばれるコールバック({B, n, pattern})
   */
  constructor(config){
    this.sizeContainer = document.getElementById(config.sizeContainerId);
    this.matrixContainer = document.getElementById(config.matrixContainerId);
    this.patternContainer = document.getElementById(config.patternContainerId);
    this.onChange = config.onChange;

    if(!this.sizeContainer || !this.matrixContainer || !this.patternContainer){
      throw new Error('MatrixInputUI: 指定されたコンテナ要素が見つかりません。index.html側のIDを確認してください。');
    }

    this.n = 3;                 // デフォルトサイズ
    this.patternKey = 'repeat'; // デフォルトパターン
    this.B = this.makeIdentity(this.n);

    this.renderSizeTabs();
    this.renderPatternTabs();
    this.renderMatrixGrid();
    this.emitChange();
  }

  // ---------------- 状態生成ヘルパー ----------------
  makeIdentity(n){
    return Array.from({length: n}, (_, i) =>
      Array.from({length: n}, (_, j) => (i === j ? 1 : 0))
    );
  }

  // ---------------- サイズ選択 ----------------
  renderSizeTabs(){
    this.sizeContainer.innerHTML = '';
    SIZE_OPTIONS.forEach(size => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'size-btn' + (size === this.n ? ' active' : '');
      btn.textContent = `${size}×${size}`;
      btn.dataset.size = String(size);
      btn.addEventListener('click', () => this.handleSizeChange(size));
      this.sizeContainer.appendChild(btn);
    });
  }

  handleSizeChange(newSize){
    if(newSize === this.n) return;
    this.n = newSize;
    this.B = this.makeIdentity(this.n);

    // サイズボタンのactive状態を更新
    this.sizeContainer.querySelectorAll('.size-btn').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.size) === this.n);
    });

    this.renderMatrixGrid();
    this.emitChange();
  }

  // ---------------- パターン選択 ----------------
  renderPatternTabs(){
    this.patternContainer.innerHTML = '';
    PATTERN_OPTIONS.forEach(key => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pattern-btn' + (key === this.patternKey ? ' active' : '');
      btn.textContent = WeaveEngine.getPresetLabel(key);
      btn.dataset.pattern = key;
      btn.addEventListener('click', () => this.handlePatternChange(key));
      this.patternContainer.appendChild(btn);
    });
  }

  handlePatternChange(newPattern){
    if(newPattern === this.patternKey) return;
    this.patternKey = newPattern;

    this.patternContainer.querySelectorAll('.pattern-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pattern === this.patternKey);
    });

    this.emitChange();
  }

  // ---------------- Bのマス目 ----------------
  renderMatrixGrid(){
    this.matrixContainer.innerHTML = '';
    this.matrixContainer.style.gridTemplateColumns = `repeat(${this.n}, 1fr)`;
    this.matrixContainer.style.gridTemplateRows = `repeat(${this.n}, 1fr)`;

    for(let i = 0; i < this.n; i++){
      for(let j = 0; j < this.n; j++){
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'matrix-cell' + (this.B[i][j] === 1 ? ' active' : '');
        cell.textContent = String(this.B[i][j]);
        cell.dataset.row = String(i);
        cell.dataset.col = String(j);
        cell.setAttribute('aria-label', `${i + 1}行${j + 1}列`);
        cell.addEventListener('click', () => this.toggleCell(i, j, cell));
        this.matrixContainer.appendChild(cell);
      }
    }
  }

  toggleCell(i, j, cellEl){
    this.B[i][j] = this.B[i][j] === 1 ? 0 : 1;
    cellEl.textContent = String(this.B[i][j]);
    cellEl.classList.toggle('active', this.B[i][j] === 1);
    this.emitChange();
  }

  // ---------------- ランダム生成・リセット ----------------
  randomize(){
    this.B = Array.from({length: this.n}, () =>
      Array.from({length: this.n}, () => Math.round(Math.random()))
    );
    this.renderMatrixGrid();
    this.emitChange();
  }

  reset(){
    this.B = this.makeIdentity(this.n);
    this.renderMatrixGrid();
    this.emitChange();
  }

  // ---------------- 状態の取得・通知 ----------------
  getState(){
    return { B: this.B, n: this.n, pattern: this.patternKey };
  }

  emitChange(){
    if(typeof this.onChange === 'function'){
      this.onChange(this.getState());
    }
  }
}
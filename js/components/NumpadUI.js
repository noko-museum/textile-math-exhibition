/**
 * NumpadUI.js
 * 展示システム専用のカスタムテンキーUI（OSのソフトウェアキーボードを回避）
 */

export class NumpadUI {
  /**
   * @param {string} containerId - Numpadを生成する親要素のID
   */
  constructor(containerId) {
    this.container = document.getElementById('numpad');
    this.activeInput = null;
    this.onInputCallback = null;
    this.render();
    this.bindEvents();
    this.hide();
  }

  /**
   * テンキーのDOMを生成
   */
  render() {
    this.container.innerHTML = `
      <div class="numpad-wrapper">
        <div class="numpad-header">
          <span>数値入力</span>
          <button class="numpad-close-btn" id="numpad-close">閉じる</button>
        </div>
        <div class="numpad-grid">
          <button class="num-key" data-val="7">7</button>
          <button class="num-key" data-val="8">8</button>
          <button class="num-key" data-val="9">9</button>
          <button class="num-key" data-val="4">4</button>
          <button class="num-key" data-val="5">5</button>
          <button class="num-key" data-val="6">6</button>
          <button class="num-key" data-val="1">1</button>
          <button class="num-key" data-val="2">2</button>
          <button class="num-key" data-val="3">3</button>
          <button class="num-key" data-val="-">-</button>
          <button class="num-key" data-val="0">0</button>
          <button class="num-key action-key" data-action="backspace">BS</button>
        </div>
      </div>
    `;
  }

  /**
   * イベントリスナーの登録
   */
  bindEvents() {
    const keys = this.container.querySelectorAll('.num-key');
    keys.forEach(key => {
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handleKeyPress(key);
      });
    });

    document.getElementById('numpad-close').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.hide();
    });
  }

  /**
   * キー入力時の処理
   * @param {HTMLElement} keyElement 
   */
  handleKeyPress(keyElement) {
    if (!this.activeInput) return;

    const val = keyElement.dataset.val;
    const action = keyElement.dataset.action;
    let currentValue = this.activeInput.value;

    if (action === 'backspace') {
      currentValue = currentValue.slice(0, -1);
    } else if (val === '-') {
      if (currentValue.startsWith('-')) {
        currentValue = currentValue.substring(1);
      } else {
        currentValue = '-' + currentValue;
      }
    } else {
      // 桁数制限 (最大3桁)
      if (currentValue.replace('-', '').length < 3) {
        currentValue += val;
      }
    }

    this.activeInput.value = currentValue;
    
    // 変更を通知
    if (typeof this.onInputCallback === 'function') {
      this.onInputCallback();
    }
  }

  /**
   * 対象のinput要素に紐付けてテンキーを表示
   * @param {HTMLInputElement} inputElement 
   * @param {Function} onChangeCallback - 値が変更された時に発火
   */
  show(inputElement, onChangeCallback) {
    this.activeInput = inputElement;
    this.onInputCallback = onChangeCallback;
    this.container.classList.add('visible');
    
    // スタイル調整: 選択中の要素をハイライト
    document.querySelectorAll('.matrix-input').forEach(el => el.classList.remove('active'));
    inputElement.classList.add('active');
  }

  /**
   * テンキーを非表示
   */
  hide() {
    this.activeInput = null;
    this.container.classList.remove('visible');
    document.querySelectorAll('.matrix-input').forEach(el => el.classList.remove('active'));
  }
}
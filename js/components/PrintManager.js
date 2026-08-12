/**
 * PrintManager.js
 * 印刷用レイアウトの生成と、QRコードの描画を担当するコンポーネント。
 *
 * 行列式・スコア方式は使わない設計のため、印刷面には
 * ・来館者が作った種(B行列)のミニビジュアル
 * ・A/Cのプリセット名（単純な繰り返し / 鏡映 / 山型）
 * ・EngineeringEvaluatorが生成した3つの評価文言（じょうぶさ・あつさ/すけかた・うつくしさ）
 * を表示する。
 */

import { WeaveEngine } from '../core/WeaveEngine.js';

export class PrintManager {
  /**
   * 印刷用のDOMを生成し、印刷ダイアログを開く
   * @param {Object} workData - 保存完了時のデータ（workId, qrUrlなどを含む。ApiService.saveWorkの戻り値）
   * @param {Object} inputState - MatrixInputUIの状態 { B, n, pattern }
   * @param {Object} design - WeaveEngineの結果 { W, floats, density, period }
   * @param {Object} evalResult - EngineeringEvaluatorの結果 { hasFloat, density, period, strength, thickness, beauty }
   * @param {string} canvasDataUrl - Canvasから取得した画像URL（PNG DataURL）
   */
  static print(workData, inputState, design, evalResult, canvasDataUrl, radarChartHtml = '') {
    // 既存の印刷用コンテナがあれば削除
    const existing = document.getElementById('print-container');
    if (existing) existing.remove();

    const patternLabel = WeaveEngine.getPresetLabel(inputState.pattern);
    const workId = (workData && workData.workId) ? String(workData.workId) : '';
    const shortId = workId ? workId.split('-')[0] : '----';

    // A5横サイズ用のコンテナを作成
    const container = document.createElement('div');
    container.id = 'print-container';
    container.className = 'print-only';

    container.innerHTML = `
      <div class="print-card">
        <div class="print-left">
          <img src="${canvasDataUrl}" class="print-image" alt="織物デザイン" />
          <div class="print-seed">
            <p class="print-seed-label">たねになった行列 B（${inputState.n}×${inputState.n}）</p>
            ${this.buildBMatrixHtml(inputState.B, inputState.n)}
          </div>
        </div>
        <div class="print-right">
          <h1 class="print-title">数学で織り、科学で確かめる。</h1>

          <div class="print-meta">
            <p><strong>行列サイズ:</strong> ${inputState.n} × ${inputState.n}</p>
            <p><strong>模様パターン (A・C共通):</strong> ${patternLabel}</p>
          </div>

          <div class="print-summary">
            <div class="print-eval">
              ${this.buildEvalCardHtml('じょうぶさ', evalResult.strength)}
              ${this.buildEvalCardHtml('あつさ・すけかた', evalResult.thickness)}
              ${this.buildEvalCardHtml('もようの うつくしさ', evalResult.beauty)}
            </div>
            <div class="print-radar">
              <p class="print-radar-title">くわしい とくちょう</p>
              ${radarChartHtml}
            </div>
          </div>

          <div class="print-qr">
            <div id="qr-code-box"></div>
            <div>
              <p class="qr-hint">作品ページにアクセス</p>
              <p class="print-id">ID: ${shortId}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    this.renderQrCode(workData);

    // 描画を待ってから印刷ダイアログを呼び出し
    setTimeout(() => {
      window.print();
    }, 500);
  }

  /**
   * B行列（n×n、0/1）のミニビジュアルをHTMLとして組み立てる。
   * components.cssに専用クラスが無くても表示が崩れないよう、インラインスタイルのみで自己完結させる。
   * @param {number[][]} B
   * @param {number} n
   * @returns {string}
   */
  static buildBMatrixHtml(B, n) {
    // 印刷カードの限られた面積(A6横)に収まるよう、画面表示より小さめのセルサイズにしている
    const cellSize = 10;
    const colorOn = '#c8a24d';
    const colorOff = '#f3ead9';
    const border = '1px solid #d8c9a8';

    const rowsHtml = B.map(row => {
      const cellsHtml = row.map(val => {
        const bg = val === 1 ? colorOn : colorOff;
        return `<div style="width:${cellSize}px;height:${cellSize}px;background:${bg};border:${border};box-sizing:border-box;"></div>`;
      }).join('');
      return `<div style="display:flex;">${cellsHtml}</div>`;
    }).join('');

    // print-seed-grid: style.css側で中央寄せ等の配置を制御するためのフック
    return `<div class="print-seed-grid" style="display:inline-flex;flex-direction:column;">${rowsHtml}</div>`;
  }

  /**
   * 評価1項目分のカードHTMLを組み立てる。
   * メイン画面の .fabric-card（good / warn / neutral）と同じ命名規則にして見た目を揃える。
   * @param {string} label - カードの見出し（じょうぶさ、等）
   * @param {{state:string, text:string, sub?:string, showSparkle?:boolean}} info
   * @returns {string}
   */
  static buildEvalCardHtml(label, info) {
    const stateClass = info.state && info.state !== 'neutral' ? ` ${info.state}` : '';
    const subHtml = info.sub ? `<p class="print-eval-sub">${info.sub}</p>` : '';
    const sparkle = info.showSparkle ? '<span class="print-eval-sparkle">✨</span>' : '';

    return `
      <div class="fabric-card print-eval-card${stateClass}">
        <p class="print-eval-label">${label}</p>
        <p class="print-eval-text">${info.text}${sparkle}</p>
        ${subHtml}
      </div>
    `;
  }

  /**
   * QRコードを描画する（外部ライブラリ qrcode.min.js の存在を前提、
   * 読み込まれていない場合はGoogle Chart APIをフォールバックとして利用）
   * @param {Object} workData
   */
  static renderQrCode(workData) {
    const qrBox = document.getElementById('qr-code-box');
    if (!qrBox) return;

    const qrUrl = workData && workData.qrUrl;
    if (!qrUrl) {
      console.warn('PrintManager: workData.qrUrlが無いため、QRコードを生成できません');
      return;
    }

    try {
      if (typeof QRCode !== 'undefined') {
        new QRCode(qrBox, {
          text: qrUrl,
          width: 100,
          height: 100,
          colorDark: '#000000',
          colorLight: '#ffffff'
        });
      } else {
        const img = document.createElement('img');
        img.src = `https://chart.googleapis.com/chart?chs=100x100&cht=qr&chl=${encodeURIComponent(qrUrl)}`;
        qrBox.appendChild(img);
      }
    } catch (e) {
      console.error('QRコード生成エラー', e);
    }
  }
}

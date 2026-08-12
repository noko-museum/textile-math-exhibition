/**
 * RadarChartUI.js
 * RadarEvaluator.evaluateWeave() が算出した5指標のスコア(1〜5)を、
 * SVGのレーダーチャートとして描画するUIコンポーネント。
 *
 * ・外部ライブラリに依存しない（生SVGを組み立ててinnerHTMLに差し込む方式。PrintManager.jsと同じアプローチ）
 * ・スコアは1〜5の整数を想定するが、0〜5の範囲であれば小数でも描画できる（安全のためclampする）
 */

// レーダーチャートの軸の並び順（時計回り、真上から開始）
const AXIS_ORDER = ['Kl', 'F', 'NPR', 'Stiffness', 'Porosity'];

// 軸ごとの日本語ラベル（RadarEvaluator.jsのrawValues/scoresのキーと対応）
const AXIS_LABELS = {
  Kl: '交錯頻度',
  F: '浮き',
  NPR: '非交錯比',
  Stiffness: '剛性係数',
  Porosity: '空隙率'
};

const MAX_SCORE = 5;

export class RadarChartUI {
  /**
   * @param {string} containerId - チャートを描画するコンテナ要素のID
   * @param {Object} [options]
   * @param {number} [options.size] - SVGのviewBoxサイズ（正方形、デフォルト300）
   * @param {string} [options.color] - データ多角形（塗りつぶし部分）の色
   */
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`RadarChartUI: 指定されたコンテナ要素が見つかりません（id="${containerId}"）`);
    }
    this.size = options.size || 300;
    this.color = options.color || '#ff7e67';
    this.center = this.size / 2;
    this.maxRadius = this.size * 0.32; // ラベル表示分の余白を外周に残す
    this.labelOffset = this.size * 0.14;
  }

  /**
   * スコアを受け取ってレーダーチャートを描画する
   * @param {{Kl:number, F:number, NPR:number, Stiffness:number, Porosity:number}} scores
   */
  render(scores) {
    if (!scores) {
      console.warn('RadarChartUI: scoresが指定されていないため描画をスキップしました');
      return;
    }

    const gridHtml = this.buildGridHtml();
    const axesHtml = this.buildAxesHtml();
    const dataHtml = this.buildDataPolygonHtml(scores);
    const labelsHtml = this.buildLabelsHtml();

    this.container.innerHTML = `
      <svg viewBox="0 0 ${this.size} ${this.size}" class="radar-chart-svg" role="img" aria-label="織物の5つの特性を示すレーダーチャート">
        <g class="radar-grid">${gridHtml}</g>
        <g class="radar-axes">${axesHtml}</g>
        <g class="radar-data">${dataHtml}</g>
        <g class="radar-labels">${labelsHtml}</g>
      </svg>
    `;
  }

  /**
   * 各軸の角度（ラジアン）を返す。0番目を真上(-90度)にして時計回りに均等分割する。
   * @param {number} index - 0〜(軸の数-1)
   * @returns {number}
   */
  angleForIndex(index) {
    return -Math.PI / 2 + index * ((2 * Math.PI) / AXIS_ORDER.length);
  }

  /**
   * 中心からの極座標(radius, angle)をSVG座標(x, y)に変換する
   * @param {number} radius
   * @param {number} angle
   * @returns {{x:number, y:number}}
   */
  polarToXY(radius, angle) {
    return {
      x: this.center + radius * Math.cos(angle),
      y: this.center + radius * Math.sin(angle)
    };
  }

  /**
   * 背景の五角形グリッド(レベル1〜5の同心多角形)を組み立てる
   * @returns {string}
   */
  buildGridHtml() {
    let html = '';
    for (let level = 1; level <= MAX_SCORE; level++) {
      const radius = (level / MAX_SCORE) * this.maxRadius;
      const points = AXIS_ORDER.map((_, i) => {
        const { x, y } = this.polarToXY(radius, this.angleForIndex(i));
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(' ');
      const isOutermost = level === MAX_SCORE;
      html += `<polygon points="${points}" class="radar-grid-ring${isOutermost ? ' radar-grid-outer' : ''}" />`;
    }
    return html;
  }

  /**
   * 中心から各軸先端への直線を組み立てる
   * @returns {string}
   */
  buildAxesHtml() {
    return AXIS_ORDER.map((_, i) => {
      const { x, y } = this.polarToXY(this.maxRadius, this.angleForIndex(i));
      return `<line x1="${this.center}" y1="${this.center}" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" class="radar-axis-line" />`;
    }).join('');
  }

  /**
   * スコアに応じたデータ多角形（塗りつぶし部分）と、各頂点の点を組み立てる
   * @param {Object} scores
   * @returns {string}
   */
  buildDataPolygonHtml(scores) {
    const clamp = (v) => Math.max(0, Math.min(MAX_SCORE, v));
    const points = AXIS_ORDER.map((key, i) => {
      const score = clamp(Number(scores[key]) || 0);
      const radius = (score / MAX_SCORE) * this.maxRadius;
      return this.polarToXY(radius, this.angleForIndex(i));
    });

    const pointsAttr = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
    const dotsHtml = points
      .map(p => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="3.5" class="radar-data-dot" />`)
      .join('');

    return `
      <polygon points="${pointsAttr}" class="radar-data-shape" style="fill:${this.color};stroke:${this.color};" />
      ${dotsHtml}
    `;
  }

  /**
   * 各軸の日本語ラベル（外周のさらに外側）を組み立てる
   * @returns {string}
   */
  buildLabelsHtml() {
    return AXIS_ORDER.map((key, i) => {
      const angle = this.angleForIndex(i);
      const { x, y } = this.polarToXY(this.maxRadius + this.labelOffset, angle);
      return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" class="radar-axis-label" text-anchor="middle" dominant-baseline="middle">${AXIS_LABELS[key]}</text>`;
    }).join('');
  }
}
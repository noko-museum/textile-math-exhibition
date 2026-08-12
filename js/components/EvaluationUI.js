/**
 * EvaluationUI.js
 * 強度解析結果（スコア、スター、グラフ、コメント）をDOMに反映するUIコンポーネント
 */

export class EvaluationUI {
  constructor() {
    // DOM要素の取得
    this.scoreEl = document.getElementById('eval-score');
    this.starsEl = document.getElementById('eval-stars');
    this.commentEl = document.getElementById('eval-comment');
    
    // グラフ（プログレスバー）要素
    this.barBinding = document.getElementById('bar-binding');
    this.barUniformity = document.getElementById('bar-uniformity');
    this.barStability = document.getElementById('bar-stability');
  }

  /**
   * 評価データをUIに反映し、アニメーションさせる
   * @param {Object} evalData - EngineeringEvaluator.evaluate() の戻り値
   */
  update(evalData) {
    const { score, stars, breakdown, comment } = evalData;

    // スコアのカウントアップアニメーション（簡易版）
    this.animateScore(score);

    // スターの描画（★と☆）
    this.starsEl.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);

    // 教育的コメントの反映
    this.commentEl.textContent = comment;

    // グラフのバーの長さを更新（CSSトランジションでアニメーション）
    // 各ブレイクダウンは最大約33.3なので、3倍して%に変換（視覚的なわかりやすさのため）
    this.barBinding.style.width = `${Math.min(100, breakdown.binding * 3)}%`;
    this.barUniformity.style.width = `${Math.min(100, breakdown.uniformity * 3)}%`;
    this.barStability.style.width = `${Math.min(100, breakdown.stability * 3)}%`;
  }

  /**
   * 数値のカウントアップ演出
   * @param {number} targetScore 
   */
  animateScore(targetScore) {
    let current = parseInt(this.scoreEl.textContent, 10) || 0;
    const step = targetScore > current ? 1 : -1;
    
    if (this.timer) clearInterval(this.timer);
    
    this.timer = setInterval(() => {
      if (current === targetScore) {
        clearInterval(this.timer);
        return;
      }
      current += step;
      this.scoreEl.textContent = current;
    }, 15);
  }
}
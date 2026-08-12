/**
 * CanvasRenderer.js
 * WeaveEngineが計算した16×16のW（0/1行列）を、Canvasに描画するコンポーネント。
 *
 * ・浮き/密度/周期などの評価は一切ここでは扱わない（EngineeringEvaluator.jsの役割）
 * ・下から上へ「織り上がる」アニメーションで描画する
 * ・Retinaディスプレイ対応（devicePixelRatio）
 */

export class CanvasRenderer {
  /**
   * @param {string} canvasId - 描画対象のcanvas要素のID
   * @param {Object} [options]
   * @param {string} [options.colorOn] - 値が1（よこ糸）のセルの色
   * @param {string} [options.colorOff] - 値が0（たて糸）のセルの色
   * @param {number} [options.frameStep] - 1フレームあたりの進行量（0〜1）
   */
  constructor(canvasId, options = {}){
    this.canvas = document.getElementById(canvasId);
    if(!this.canvas){
      throw new Error(`CanvasRenderer: 指定されたcanvas要素が見つかりません（id="${canvasId}"）`);
    }
    this.ctx = this.canvas.getContext('2d');

    this.colorOn = options.colorOn || '#c8a24d';   // よこ糸（1）
    this.colorOff = options.colorOff || '#f3ead9'; // たて糸（0）
    this.frameStep = options.frameStep || 0.05;

    this.dpr = window.devicePixelRatio || 1;
    this.W = null;
    this.progress = 0; // 0.0〜1.0（織り上がりの進行度）
    this.animationFrameId = null;

    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
  }

  /**
   * canvasの実サイズを親要素にあわせて更新する（Retina対応込み）
   */
  resize(){
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // 既にデータがあれば、リサイズ時は完成図を即座に表示する
    if(this.W){
      this.progress = 1;
      this.draw();
    }
  }

  /**
   * 新しいWを受け取り、アニメーションを最初から再生する
   * @param {number[][]} W - 16x16の0/1行列
   */
  updateDesign(W){
    this.W = W;
    this.progress = 0;

    if(this.animationFrameId){
      cancelAnimationFrame(this.animationFrameId);
    }
    this.renderLoop();
  }

  /**
   * アニメーションループ本体
   */
  renderLoop(){
    this.progress += this.frameStep;
    if(this.progress > 1) this.progress = 1;

    this.draw();

    if(this.progress < 1){
      this.animationFrameId = requestAnimationFrame(() => this.renderLoop());
    }
  }

  /**
   * 現在のprogressに応じて、下の行から順にWを描画する
   */
  draw(){
    if(!this.W || this.width <= 0 || this.height <= 0) return;

    const N = this.W.length;
    const cellW = this.width / N;
    const cellH = this.height / N;

    this.ctx.clearRect(0, 0, this.width, this.height);

    // 下から上へ織り上がる演出のため、進行度に応じて描画する行数を決める
    const visibleRows = Math.max(1, Math.round(N * this.progress));
    const startRow = N - visibleRows; // 下側から表示する

    for(let r = startRow; r < N; r++){
      for(let c = 0; c < N; c++){
        const val = this.W[r][c];
        this.ctx.fillStyle = (val === 1) ? this.colorOn : this.colorOff;
        this.ctx.fillRect(c * cellW, r * cellH, cellW + 0.5, cellH + 0.5);

        // 軽いハイライトで糸の立体感を出す
        this.ctx.fillStyle = 'rgba(255,255,255,0.15)';
        this.ctx.fillRect(c * cellW, r * cellH, cellW, cellH * 0.28);
      }
    }
  }

  /**
   * 現在の状態をBase64のPNGとして書き出す（保存・印刷用）
   * 未完成のアニメーション途中であれば、完成形にしてから書き出す
   * @returns {string}
   */
  exportToDataURL(){
    if(this.progress < 1){
      this.progress = 1;
      this.draw();
    }
    return this.canvas.toDataURL('image/png');
  }

  /**
   * イベントリスナーの解除・アニメーション停止（画面遷移時などに呼ぶ）
   */
  destroy(){
    if(this.animationFrameId){
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    window.removeEventListener('resize', this._onResize);
  }
}
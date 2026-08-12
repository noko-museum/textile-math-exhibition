/**
 * app.js
 * アプリケーションのエントリポイント。
 * MatrixInputUI・WeaveEngine・CanvasRenderer・EngineeringEvaluator・RadarEvaluatorを束ね、
 * 画面の初期化とイベント制御を行う。
 */

import { MatrixInputUI } from './components/MatrixInputUI.js';
import { WeaveEngine } from './core/WeaveEngine.js';
import { CanvasRenderer } from './components/CanvasRenderer.js';
import { EngineeringEvaluator } from './core/EngineeringEvaluator.js';
import { RadarEvaluator } from './core/RadarEvaluator.js';
import { RadarChartUI } from './components/RadarChartUI.js';
import { ApiService } from './services/ApiService.js';
import { PrintManager } from './components/PrintManager.js';
import { isFestivalMode } from './utils/mode.js';

// アプリケーションの状態
const AppState = {
  inputState: null,  // MatrixInputUIの状態 { B, n, pattern }
  design: null,      // WeaveEngineの結果 { W, floats, density, period }
  evalResult: null,  // EngineeringEvaluatorの結果（文言カード用）
  radarResult: null, // RadarEvaluatorの結果 { rawValues, scores }（レーダーチャート用）
  savedWork: null,   // 保存済み作品の { workData, canvasDataUrl, radarChartHtml }
  isProcessing: false
};

let canvasRenderer;
let matrixInputUI;
let radarChartUI;

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp(){
  canvasRenderer = new CanvasRenderer('weaveCanvas');
  radarChartUI = new RadarChartUI('radar-chart');

  matrixInputUI = new MatrixInputUI({
    sizeContainerId: 'size-tabs',
    matrixContainerId: 'matrix-grid',
    patternContainerId: 'pattern-tabs',
    onChange: handleInputChange
  });

  const randomBtn = document.getElementById('btn-random');
  if(randomBtn){
    randomBtn.addEventListener('click', () => matrixInputUI.randomize());
  }

  const resetBtn = document.getElementById('btn-reset');
  if(resetBtn){
    resetBtn.addEventListener('click', () => matrixInputUI.reset());
  }

  setupSaveFeature();
  setupPrintFeature();
  setupModeBadge();
}

/**
 * 保存機能のセットアップ。
 * 通常モード(来館者向け)では保存ボタンをdisplay:noneで完全に非表示にし、
 * クリックイベントも登録しない(disabledではなく、存在しないように見せる)。
 * 展示モード(?mode=festival)でのみ、従来通りボタンを表示・クリック可能にする。
 * モード限定機能の判定は isFestivalMode だけを見て行う設計に統一する。
 */
function setupSaveFeature(){
  const saveBtn = document.getElementById('btn-save');
  if(!saveBtn) return;

  if(!isFestivalMode){
    saveBtn.style.display = 'none';
    return;
  }

  saveBtn.addEventListener('click', () => handleSave(saveBtn));
}

/**
 * 印刷機能のセットアップ。
 * 通常モードでは印刷ボタンをdisplay:noneで完全に非表示にし、クリックイベントも登録しない
 * (disabledではなく、存在しないように見せる)。
 * 展示モード(?mode=festival)でのみ、従来通りボタンを表示・クリック可能にする。
 * 今後、保存・印刷以外にもモード限定機能を追加する場合は isFestivalMode を見て分岐すること。
 */
function setupPrintFeature(){
  const printBtn = document.getElementById('btn-print');
  if(!printBtn) return;

  if(!isFestivalMode){
    printBtn.style.display = 'none';
    return;
  }

  printBtn.addEventListener('click', () => handlePrint());
}

/**
 * 画面右上のモード表示バッジ(「体験版」/「展示モード」)のセットアップ。
 */
function setupModeBadge(){
  const badge = document.getElementById('mode-badge');
  if(!badge) return;

  badge.textContent = isFestivalMode ? '展示モード' : '体験版';
  badge.classList.toggle('mode-badge--festival', isFestivalMode);
}

/**
 * MatrixInputUIから変更通知を受け取るたびに呼ばれるメイン処理フロー
 * @param {{B:number[][], n:number, pattern:string}} inputState
 */
function handleInputChange(inputState){
  try {
    AppState.inputState = inputState;

    AppState.design = WeaveEngine.generateDesign(inputState.B, inputState.n, inputState.pattern);
    AppState.evalResult = EngineeringEvaluator.evaluate(AppState.design);
    AppState.radarResult = RadarEvaluator.evaluateWeave(AppState.design.W);
    AppState.savedWork = null;

    canvasRenderer.updateDesign(AppState.design.W);
    updateFabricCards(AppState.evalResult);
    radarChartUI.render(AppState.radarResult.scores);
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.disabled = true;

  } catch(error){
    console.error('処理エラー:', error);
  }
}

/**
 * 評価結果を3枚のカード(じょうぶさ・あつさ/すけかた・うつくしさ)に反映する
 */
function updateFabricCards(evalResult){
  applyCardInfo('strengthCard', 'strengthText', 'strengthSub', evalResult.strength);
  applyCardInfo('densityCard', 'densityText', 'densitySub', evalResult.thickness);
  applyBeautyCard(evalResult.beauty);
}

function applyCardInfo(cardId, textId, subId, info){
  const card = document.getElementById(cardId);
  const textEl = document.getElementById(textId);
  const subEl = document.getElementById(subId);

  if(card){
    card.className = 'fabric-card' + (info.state !== 'neutral' ? ' ' + info.state : '');
  }
  if(textEl) textEl.textContent = info.text;
  if(subEl && info.sub !== undefined) subEl.textContent = info.sub;
}

function applyBeautyCard(beauty){
  const card = document.getElementById('beautyCard');
  const textEl = document.getElementById('beautyText');
  const sparkleEl = document.getElementById('beautySparkle');

  if(card){
    card.className = 'fabric-card' + (beauty.state !== 'neutral' ? ' ' + beauty.state : '');
  }
  if(textEl) textEl.textContent = beauty.text;
  if(sparkleEl) sparkleEl.classList.toggle('show', beauty.showSparkle);
}

/**
 * 「保存・印刷」ボタン押下時の処理
 */
async function handleSave(saveBtn){
  if(!isFestivalMode) return;
  if(AppState.isProcessing) return;
  if(!AppState.design || !AppState.evalResult || !AppState.inputState){
    console.error('保存できません: デザインがまだ生成されていません');
    return;
  }

  AppState.isProcessing = true;
  const originalText = saveBtn.textContent;
  saveBtn.textContent = '処理中...';
  saveBtn.disabled = true;

  try {
    const image64 = canvasRenderer.exportToDataURL();
    const payloadFields = EngineeringEvaluator.toPayloadFields(AppState.evalResult);
    const patternLabel = WeaveEngine.getPresetLabel(AppState.inputState.pattern);

    // シート構成: ID / 日時 / サイズ / Bの行列 / Aプリセット / Cプリセット / 浮きの有無 / 密度 / 周期 / 画像URL
    const payload = {
      size: AppState.inputState.n,
      matrixData: JSON.stringify(AppState.inputState.B),
      presetA: patternLabel,
      presetC: patternLabel,
      hasFloat: payloadFields.hasFloat,
      density: payloadFields.density,
      period: payloadFields.period,
      image64: image64
    };

    const result = await ApiService.saveWork(payload);

    AppState.savedWork = {
      workData: result,
      canvasDataUrl: image64,
      radarChartHtml: document.getElementById('radar-chart')?.innerHTML || ''
    };
    const printBtn = document.getElementById('btn-print');
    if (printBtn) printBtn.disabled = false;
    alert('作品を保存しました。印刷ボタンからカードを印刷できます。');

  } catch(error){
    alert('保存に失敗しました。ネットワーク状況を確認してください。\n' + error.message);
  } finally {
    AppState.isProcessing = false;
    saveBtn.textContent = originalText;
    saveBtn.disabled = false;
  }
}

function handlePrint(){
  if (!isFestivalMode) return;
  if (!AppState.savedWork || !AppState.design || !AppState.evalResult || !AppState.inputState) {
    alert('先に作品を保存してください。');
    return;
  }

  const { workData, canvasDataUrl, radarChartHtml } = AppState.savedWork;
  PrintManager.print(
    workData,
    AppState.inputState,
    AppState.design,
    AppState.evalResult,
    canvasDataUrl,
    radarChartHtml
  );
}

// テスト用に主要な関数・状態を公開（本番の動作には影響しない）
export { AppState, initApp, handleInputChange, handleSave, handlePrint, updateFabricCards, isFestivalMode };

/**
 * RadarEvaluator.js
 * 織物デザイン(W: 0/1の二次元配列)から、5つの物理的特性指標を計算し、
 * レーダーチャート表示用の1〜5段階スコアに変換するモジュール。
 *
 * EngineeringEvaluator.js（じょうぶさ・あつさ/すけかた・うつくしさの文言化）とは別物として扱う。
 * こちらは数値評価専用で、Wから直接・独立に計算する（floats/density/periodのSetは再利用しない）。
 *
 * 【指標一覧】
 *  ① Kl        : 交錯頻度        … 高いほど「みっちり」交差している
 *  ② F         : 浮き            … 高いほど「浮き」が長い（糸が上下に動かない区間が長い）
 *  ③ NPR       : 非交錯比率      … 高いほど連続した浮きのブロックが多い/長い
 *  ④ Stiffness : 剛性係数        … NPRスコアの反転（6 - NPRスコア）。詳細は下記【重要な修正】参照
 *  ⑤ Porosity  : 空隙率          … Klの値をそのまま流用（同じ基準でスコア化）
 *
 * 【重要な修正（実機での矛盾検証を受けて）】
 * 1. 各糸（行・列）の交錯回数Tと浮きのブロック長を数える際、配列の「端から端」ではなく
 *    「輪（循環）」として扱うように修正した。糸は輪になって織物を構成しているため、
 *    配列の最後の要素と最初の要素も隣接しているとみなす必要がある。
 *    これを怠ると、たとえば理想的な平織り[1,0,1,0]（本来は毎回交差するはず）でも
 *    末尾と先頭の繋がりが交錯としてカウントされず、TがR2よりも必ず1小さくなり、
 *    KlとFが同じTを使っているにもかかわらず整合しない値になってしまっていた。
 * 2. 循環対応の結果、完全な平織りでは常にT=糸の本数となり、F=R/T=1・NPR=0（→各スコア1）に
 *    確実に収束するようになった（ゼロ除算のフォールバックは維持）。
 * 3. Stiffness(剛性係数)は「NPRの逆数」という定義を廃止した。NPRが低い（＝交錯が多く、
 *    本来は硬いはずの平織り）ほど1/NPRが非常に大きくなり、「ゆるい」と逆評価されてしまう
 *    欠陥があったため、単純に「Stiffnessスコア = 6 - NPRスコア」という反転関係に変更した。
 *    rawValues.Stiffnessも、この反転スコアと同じ整数値を格納する（独立した物理式は持たない）。
 */

// ---------------- しきい値表 ----------------
// [しきい値の下限, スコア] を、しきい値が高い順に並べたもの。
// value >= 下限 を満たす最初の行のスコアを採用する。
//
// ※ タイアップ行列Bの最大サイズが5×5であるため、5枚朱子の理論上限
//   （Kl最小0.4付近、F理論最大2.5、NPR理論最大約0.35）に合わせて調整済み。
//   平織り(B=単位行列相当)がKl最大・F/NPR最小側の基準になる想定。
const KL_THRESHOLDS = [
  [0.90, 5],
  [0.75, 4],
  [0.60, 3],
  [0.45, 2],
  [-Infinity, 1]
];

const F_THRESHOLDS = [
  [2.4, 5],
  [1.9, 4],
  [1.4, 3],
  [1.1, 2],
  [-Infinity, 1]
];

const NPR_THRESHOLDS = [
  [0.32, 5],
  [0.24, 4],
  [0.16, 3],
  [0.08, 2],
  [-Infinity, 1]
];

// ---------------- 汎用ヘルパー ----------------

/**
 * value以下の下限を持つ最初のしきい値行のスコアを返す（しきい値は降順に並んでいる前提）
 * @param {number} value
 * @param {Array<[number, number]>} thresholds
 * @returns {number}
 */
function scoreByDescendingThresholds(value, thresholds) {
  for (const [min, score] of thresholds) {
    if (value >= min) return score;
  }
  return thresholds[thresholds.length - 1][1];
}

/**
 * 1次元配列（1本の糸）を、配列の端と端が繋がった「輪」として扱い、
 * 連続する同値のブロック長のリストに変換する。
 *
 * 織物の糸は輪になって構成されているため、配列の最後の要素と最初の要素も
 * 隣接しているものとして交錯回数・浮きのブロックを数える必要がある。
 *
 * 例（循環扱い）: [1,1,1,0,0,1] → 末尾(1)と先頭(1)が同値なので、
 *   末尾の[1]ブロックと先頭の[1,1,1]ブロックを1つに結合する
 *   → blocks: [4(結合された1のブロック), 2(0のブロック)], t: 2
 *
 * t（交錯回数）は「輪の上でブロックが切り替わる回数」＝ ブロックの数
 * （全要素が同値で1ブロックしかない場合のみ t=0）
 *
 * @param {number[]} arr
 * @returns {{blocks: number[], t: number}}
 */
function computeCircularRunBlocks(arr) {
  const N = arr.length;
  if (N === 0) return { blocks: [], t: 0 };

  // 1. まず配列の先頭から末尾まで、線形にブロックを切り出す
  const rawBlocks = []; // { value, length }
  let runStart = 0;
  for (let i = 1; i <= N; i++) {
    if (i === N || arr[i] !== arr[i - 1]) {
      rawBlocks.push({ value: arr[i - 1], length: i - runStart });
      runStart = i;
    }
  }

  // 2. ブロックが2つ以上あり、かつ先頭ブロックと末尾ブロックが同じ値なら、
  //    「輪」として本来は繋がっているはずの2つのブロックを1つに結合する
  if (rawBlocks.length > 1 && rawBlocks[0].value === rawBlocks[rawBlocks.length - 1].value) {
    const first = rawBlocks.shift();
    const last = rawBlocks.pop();
    rawBlocks.push({ value: last.value, length: first.length + last.length });
  }

  const blocks = rawBlocks.map(b => b.length);
  const k = blocks.length;
  // 輪の上では「ブロックの数 = 切り替わりの回数」になる（全要素同値の1ブロックのみ t=0）
  const t = k === 1 ? 0 : k;

  return { blocks, t };
}

/**
 * ブロック情報のリストから、各ブロック長Lについて sqrt(max(L-1, 0)) を合計する
 * （NPR係数のΣi計算に使用）
 * @param {Array<{blocks: number[], t: number}>} blockInfoList
 * @returns {number}
 */
function sumSqrtNonMoves(blockInfoList) {
  return blockInfoList.reduce((total, info) => {
    const blockSum = info.blocks.reduce((s, L) => s + Math.sqrt(Math.max(L - 1, 0)), 0);
    return total + blockSum;
  }, 0);
}

// ---------------- 公開API ----------------
export class RadarEvaluator {
  /**
   * 織物デザインWから、5指標の生データとスコア(1〜5)を計算する
   * @param {number[][]} W - N行×M列の0/1二次元配列（現行仕様は16×16固定、正方形を想定）
   * @returns {{rawValues: {Kl:number,F:number,NPR:number,Stiffness:number,Porosity:number}, scores: {Kl:number,F:number,NPR:number,Stiffness:number,Porosity:number}}}
   */
  static evaluateWeave(W) {
    if (!W || W.length === 0 || !W[0] || W[0].length === 0) {
      throw new Error('RadarEvaluator.evaluateWeave: Wが空、または不正な形式です');
    }

    // R2 = よこ糸の数 = 行数 / R1 = たて糸の数 = 各行の長さ(列数)
    const R2 = W.length;
    const R1 = W[0].length;

    // 各行(よこ糸1本ずつ)・各列(たて糸1本ずつ)のブロック情報を算出
    // ※ 糸は輪になっているため、配列の端と端の繋がりを考慮した循環方式で計算する
    const rowBlocks = W.map(row => computeCircularRunBlocks(row));
    const colBlocks = [];
    for (let c = 0; c < R1; c++) {
      const col = W.map(row => row[c]);
      colBlocks.push(computeCircularRunBlocks(col));
    }

    // ---- ① 交錯頻度 Kl ----
    const sumTRows = rowBlocks.reduce((acc, b) => acc + b.t, 0);
    const sumTCols = colBlocks.reduce((acc, b) => acc + b.t, 0);
    const sumT = sumTRows + sumTCols;
    const Kl = sumT / (R1 * R2 * 2);

    // ---- ② 浮き F ----
    // t=0（一切交錯しない糸）はゼロ除算を避けるため、その糸の「長さ」自体を上限値として使う
    const rowF = rowBlocks.map(b => (b.t === 0 ? R2 : R2 / b.t));
    const colF = colBlocks.map(b => (b.t === 0 ? R1 : R1 / b.t));
    const sumRowF = rowF.reduce((a, b) => a + b, 0);
    const sumColF = colF.reduce((a, b) => a + b, 0);
    const F = (sumRowF + sumColF) / (R1 + R2);

    // ---- ③ NPR係数 ----
    const sigmaI = sumSqrtNonMoves(rowBlocks) + sumSqrtNonMoves(colBlocks);
    const NPR = sigmaI / (R1 * R2 * 2);

    // ---- ⑤ 空隙率 ----
    // Klの値をそのまま流用する簡易評価（スコアもKlと同じ基準を使う）
    const Porosity = Kl;

    const klScore = scoreByDescendingThresholds(Kl, KL_THRESHOLDS);
    const fScore = scoreByDescendingThresholds(F, F_THRESHOLDS);
    const nprScore = scoreByDescendingThresholds(NPR, NPR_THRESHOLDS);

    // ---- ④ 剛性係数 ----
    // 「NPRの逆数」という定義は、NPRが低い（＝交錯が多く本来は硬いはずの平織り）ほど
    // 1/NPRが極端に大きくなり「ゆるい」と逆評価される欠陥があったため廃止。
    // NPRスコアを単純に反転させる（NPRスコア1→Stiffnessスコア5、NPRスコア5→Stiffnessスコア1）。
    // 独立した物理式は持たないため、rawValues側もこの反転スコアと同じ値を格納する。
    const stiffnessScore = 6 - nprScore;

    const rawValues = { Kl, F, NPR, Stiffness: stiffnessScore, Porosity };
    const scores = {
      Kl: klScore,
      F: fScore,
      NPR: nprScore,
      Stiffness: stiffnessScore,
      Porosity: scoreByDescendingThresholds(Porosity, KL_THRESHOLDS)
    };

    return { rawValues, scores };
  }
}

/**
 * クラスを介さず直接呼び出したい場合向けのショートハンド関数。
 * RadarEvaluator.evaluateWeave(W) と完全に同じ処理を行う。
 * @param {number[][]} W
 * @returns {{rawValues: Object, scores: Object}}
 */
export function evaluateWeave(W) {
  return RadarEvaluator.evaluateWeave(W);
}
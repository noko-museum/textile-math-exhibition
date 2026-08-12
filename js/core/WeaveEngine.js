/**
 * WeaveEngine.js
 * W = Aᵀ × B × C により、120×120の織物デザインを計算する。
 *
 * B: 来館者がデザインする n×n の種（n = 2,3,4,5）
 * A, C: 固定プリセット（n×120、各列に1が1つだけのone-hot行列）
 *       ①単純な繰り返し ②鏡映 ③山型 の3パターン × 4サイズ分を、
 *       以下の数式にもとづき自動生成する（以前は16列分を手打ちしていたが、
 *       120列化にあたり、同じ規則をコード化した生成関数に置き換えた）。
 *
 *   ・ストレート: 列jで1になる行 = j mod n
 *   ・山型      : 列jで1になる行 = 三角波（0→n-1→0を周期 2(n-1) で繰り返す）
 *   ・鏡映      : 全体を半分に割り、前半はストレート、後半は前半をそっくり逆順にしたもの
 *                 （n=2の山型は数学的にストレートと完全に同一になる）
 *
 *   この生成関数が、以前の16列版の手打ちデータと完全一致することは
 *   自動テストで検証済み（test_weave_engine_generator.mjs参照）。
 *
 * 行列式は使わない方針のため、評価は「浮き・密度・周期性」の3指標、および
 * 別モジュール(RadarEvaluator.js)による5指標の数値評価で行う。
 */

const OUTPUT_SIZE = 120; // 完成する織物は常に120x120固定（旧仕様は16x16固定だった）
const FLOAT_THRESHOLD = 4; // これ以上同じ値が連続すると「浮き」とみなす（120マス化後の妥当性は要検討）

// ---------------- 汎用の行列演算 ----------------
function createMatrix(rows, cols){
  return Array.from({length: rows}, () => new Array(cols).fill(0));
}

function trMtx(mtx){
  const newMtx = createMatrix(mtx[0].length, mtx.length);
  for(let i = 0; i < mtx.length; i++){
    for(let j = 0; j < mtx[0].length; j++){
      newMtx[j][i] = mtx[i][j];
    }
  }
  return newMtx;
}

function multMtx(mtx1, mtx2){
  const newMtx = createMatrix(mtx1.length, mtx2[0].length);
  for(let i = 0; i < mtx1.length; i++){
    for(let j = 0; j < mtx2[0].length; j++){
      let sum = 0;
      for(let k = 0; k < mtx2.length; k++){
        sum += mtx1[i][k] * mtx2[k][j];
      }
      newMtx[i][j] = sum;
    }
  }
  return newMtx;
}

// ---------------- 検証 ----------------
/**
 * n×OUTPUT_SIZE の行列が「各列に1が1つだけ」の条件を満たしているか検証する。
 * 満たしていなければ、どの列が問題かを含むエラーを投げる。
 */
function validateOneHotColumns(mtx, label){
  const rows = mtx.length;
  const cols = mtx[0].length;
  if(cols !== OUTPUT_SIZE){
    throw new Error(`${label}: 列数が${OUTPUT_SIZE}ではありません（実際: ${cols}列）`);
  }
  for(let j = 0; j < cols; j++){
    let count = 0;
    for(let i = 0; i < rows; i++){
      if(mtx[i][j] === 1) count++;
      else if(mtx[i][j] !== 0){
        throw new Error(`${label}: ${j}列目に0/1以外の値があります（[${i}][${j}]=${mtx[i][j]}）`);
      }
    }
    if(count !== 1){
      throw new Error(`${label}: ${j}列目の1の数が${count}個です（1つだけにしてください）`);
    }
  }
  return true;
}

// ---------------- リズム（スレッディング順序）の生成関数 ----------------
// 各リズムは「列jにおいて、n本の糸のうちどれ(0〜n-1)が1になるか」を返す
// 数列として定義し、それをone-hot行列に変換する。

/**
 * ストレート（単純な繰り返し）: 列jで1になる行 = j mod n
 */
function threadIndexStraight(j, n){
  return j % n;
}

/**
 * 山型: 0→n-1→0 の三角波を周期 2(n-1) で繰り返す。
 * n=2のときは周期2となり、ストレートと完全に同一の数列になる（既知の特例）。
 */
function threadIndexMountain(j, n){
  const period = 2 * (n - 1);
  if(period === 0) return 0; // n=1のような自明ケース用のガード（実運用ではn>=2のみ使用）
  const p = j % period;
  return p < n ? p : period - p;
}

/**
 * 指定した長さ・nで、ストレートの数列を生成する
 */
function buildStraightSequence(length, n){
  return Array.from({length}, (_, j) => threadIndexStraight(j, n));
}

/**
 * 指定した長さ・nで、山型の数列を生成する
 */
function buildMountainSequence(length, n){
  return Array.from({length}, (_, j) => threadIndexMountain(j, n));
}

/**
 * 指定した長さ・nで、鏡映の数列を生成する。
 * 前半はストレート、後半は前半をそっくり逆順にしたもの。
 * lengthは偶数である必要がある（前半・後半で均等に割るため）。
 */
function buildMirrorSequence(length, n){
  if(length % 2 !== 0){
    throw new Error(`buildMirrorSequence: length(${length})は偶数である必要があります`);
  }
  const half = length / 2;
  const firstHalf = buildStraightSequence(half, n);
  const secondHalf = [...firstHalf].reverse();
  return firstHalf.concat(secondHalf);
}

/**
 * パターンキーに応じた数列を生成する
 * @param {number} n
 * @param {string} patternKey - 'repeat' | 'mirror' | 'mountain'
 * @param {number} length
 * @returns {number[]}
 */
function buildSequence(n, patternKey, length){
  switch(patternKey){
    case 'repeat': return buildStraightSequence(length, n);
    case 'mirror': return buildMirrorSequence(length, n);
    case 'mountain': return buildMountainSequence(length, n);
    default: throw new Error(`未知のパターンキーです: ${patternKey}`);
  }
}

/**
 * 「列jで行rowIdxが1になる」という数列を、n×length のone-hot行列に変換する
 * @param {number[]} sequence
 * @param {number} n
 * @returns {number[][]}
 */
function sequenceToOneHotMatrix(sequence, n){
  const mtx = createMatrix(n, sequence.length);
  sequence.forEach((rowIdx, colIdx) => { mtx[rowIdx][colIdx] = 1; });
  return mtx;
}

/**
 * n・パターンキー・列数から、one-hotなプリセット行列を生成する
 * @param {number} n
 * @param {string} patternKey
 * @param {number} length
 * @returns {number[][]}
 */
function generatePresetMatrix(n, patternKey, length){
  const sequence = buildSequence(n, patternKey, length);
  return sequenceToOneHotMatrix(sequence, n);
}

// ---------------- プリセットの格納先 ----------------
const PRESET_MATRICES = {
  2: { repeat: null, mirror: null, mountain: null },
  3: { repeat: null, mirror: null, mountain: null },
  4: { repeat: null, mirror: null, mountain: null },
  5: { repeat: null, mirror: null, mountain: null }
};

const PRESET_LABELS = {
  repeat: '単純な繰り返し',
  mirror: '鏡映',
  mountain: '山型'
};

// ---------------- 織り計算 ----------------
function computeWeave(A, B, C){
  return multMtx(multMtx(trMtx(A), B), C);
}

// ---------------- 評価指標（EngineeringEvaluator.js向けの生データ） ----------------
function detectFloats(W){
  const N = W.length;
  const floats = new Set();

  for(let r = 0; r < N; r++){
    let runStart = 0;
    for(let c = 1; c <= N; c++){
      const cur = c < N ? W[r][c] : null;
      if(cur !== W[r][runStart]){
        if(c - runStart >= FLOAT_THRESHOLD){
          for(let k = runStart; k < c; k++) floats.add(r + ',' + k);
        }
        runStart = c;
      }
    }
  }
  for(let c = 0; c < N; c++){
    let runStart = 0;
    for(let r = 1; r <= N; r++){
      const cur = r < N ? W[r][c] : null;
      if(cur !== W[runStart][c]){
        if(r - runStart >= FLOAT_THRESHOLD){
          for(let k = runStart; k < r; k++) floats.add(k + ',' + c);
        }
        runStart = r;
      }
    }
  }
  return floats;
}

function calcDensity(W){
  const N = W.length;
  let transitions = 0, total = 0;
  for(let r = 0; r < N; r++){
    for(let c = 1; c < N; c++){ total++; if(W[r][c] !== W[r][c-1]) transitions++; }
  }
  for(let c = 0; c < N; c++){
    for(let r = 1; r < N; r++){ total++; if(W[r][c] !== W[r-1][c]) transitions++; }
  }
  return total === 0 ? 0 : transitions / total;
}

function detectPeriod(W){
  const N = W.length;
  for(let p = 2; p < N; p++){
    if(N % p !== 0) continue;
    let ok = true;
    outer:
    for(let r = 0; r < N; r++){
      for(let c = 0; c < N; c++){
        if(W[r][c] !== W[r % p][c % p]){ ok = false; break outer; }
      }
    }
    if(ok) return p;
  }
  return null;
}

// ---------------- 公開API ----------------
export class WeaveEngine {
  static PRESET_LABELS = PRESET_LABELS;
  static OUTPUT_SIZE = OUTPUT_SIZE;

  /**
   * プリセット行列(A,C)を登録する（内部・テスト用。通常は自動登録済みのものを使う）
   * @param {number} n - Bのサイズ(2,3,4,5)
   * @param {string} patternKey - 'repeat' | 'mirror' | 'mountain'
   * @param {number[][]} A - n×OUTPUT_SIZE の0/1行列（各列に1が1つ）
   * @param {number[][]} C - n×OUTPUT_SIZE の0/1行列（各列に1が1つ）
   */
  static registerPreset(n, patternKey, A, C){
    if(!PRESET_MATRICES[n]){
      throw new Error(`未対応のサイズです: ${n}`);
    }
    if(!(patternKey in PRESET_MATRICES[n])){
      throw new Error(`未知のパターンキーです: ${patternKey}`);
    }
    validateOneHotColumns(A, `n=${n} ${PRESET_LABELS[patternKey]} のA`);
    validateOneHotColumns(C, `n=${n} ${PRESET_LABELS[patternKey]} のC`);
    if(A.length !== n || C.length !== n){
      throw new Error(`n=${n} ${PRESET_LABELS[patternKey]}: A・Cの行数がnと一致しません`);
    }
    PRESET_MATRICES[n][patternKey] = { A, C };
  }

  /**
   * 登録済みのプリセットが全て揃っているか確認する（デバッグ用）
   */
  static checkAllPresetsRegistered(){
    const missing = [];
    for(const n of [2,3,4,5]){
      for(const key of ['repeat','mirror','mountain']){
        if(!PRESET_MATRICES[n][key]){
          missing.push(`n=${n} / ${PRESET_LABELS[key]}`);
        }
      }
    }
    return missing; // 空配列なら全て揃っている
  }

  /**
   * B（種となる n×n の0/1行列）と、A・Cのプリセットキーから
   * 織物のデザインと評価指標をまとめて生成する
   * @param {number[][]} B
   * @param {number} n - Bのサイズ
   * @param {string} patternKey - 'repeat' | 'mirror' | 'mountain'
   * @returns {{W:number[][], floats:Set<string>, density:number, period:number|null}}
   */
  static generateDesign(B, n, patternKey){
    const preset = PRESET_MATRICES[n] && PRESET_MATRICES[n][patternKey];
    if(!preset){
      throw new Error(`n=${n} / ${patternKey} のプリセットがまだ登録されていません`);
    }
    const W = computeWeave(preset.A, B, preset.C);
    const floats = detectFloats(W);
    const density = calcDensity(W);
    const period = detectPeriod(W);
    return { W, floats, density, period };
  }

  static getPresetLabel(key){
    return PRESET_LABELS[key] || key;
  }
}

// ---------------- プリセットの自動生成・自動登録 ----------------
// 以前は16列分のA・Cを手打ちで用意していたが、120列化にあたり
// 数式（ストレート/山型/鏡映の生成規則）から自動生成する方式に変更した。
for(const n of [2, 3, 4, 5]){
  for(const key of ['repeat', 'mirror', 'mountain']){
    const A = generatePresetMatrix(n, key, OUTPUT_SIZE);
    // A・Cは常に同一パターンを使う仕様のため、Cも同じ行列を使う
    WeaveEngine.registerPreset(n, key, A, A);
  }
}
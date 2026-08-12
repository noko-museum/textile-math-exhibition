/**
 * MathAnalyzer.js
 * 行列の数学的特徴量を計算する純粋関数モジュール
 */

export class MathAnalyzer {
  /**
   * 行列の解析結果をまとめて返却する
   * @param {number[][]} matrix - n x n の2次元配列 (n = 2, 3, 4)
   * @returns {Object} 解析結果のオブジェクト
   */
  static analyze(matrix) {
    if (!matrix || matrix.length === 0 || matrix.length !== matrix[0].length) {
      throw new Error("正方行列(2x2, 3x3, 4x4)を入力してください。");
    }

    const n = matrix.length;
    const det = this.calculateDeterminant(matrix);
    const trace = this.calculateTrace(matrix);
    const rank = this.calculateRank(matrix);
    const variance = this.calculateVariance(matrix);
    const symError = this.calculateSymmetryError(matrix);

    return {
      size: n,
      matrix: matrix,
      determinant: det,
      trace: trace,
      rank: rank,
      variance: variance,
      symmetryError: symError
    };
  }

  /**
   * 行列式 (Determinant) の計算
   * @param {number[][]} m
   * @returns {number}
   */
  static calculateDeterminant(m) {
    const n = m.length;
    if (n === 2) {
      return m[0][0] * m[1][1] - m[0][1] * m[1][0];
    }
    if (n === 3) {
      return m[0][0] * m[1][1] * m[2][2] + m[0][1] * m[1][2] * m[2][0] + m[0][2] * m[1][0] * m[2][1]
           - m[0][2] * m[1][1] * m[2][0] - m[0][1] * m[1][0] * m[2][2] - m[0][0] * m[1][2] * m[2][1];
    }
    if (n === 4) {
      let det = 0;
      for (let i = 0; i < 4; i++) {
        const subMatrix = [
          [m[1][(i + 1) % 4], m[1][(i + 2) % 4], m[1][(i + 3) % 4]],
          [m[2][(i + 1) % 4], m[2][(i + 2) % 4], m[2][(i + 3) % 4]],
          [m[3][(i + 1) % 4], m[3][(i + 2) % 4], m[3][(i + 3) % 4]]
        ];
        const sign = (i % 2 === 0) ? 1 : -1;
        // 列の順番が反転する場合の調整
        const subDet = this.calculateDeterminant(subMatrix) * (i === 1 || i === 2 ? -1 : 1);
        det += sign * m[0][i] * subDet;
      }
      return det;
    }
    return 0;
  }

  /**
   * トレース (Trace: 対角成分の和) の計算
   * @param {number[][]} m
   * @returns {number}
   */
  static calculateTrace(m) {
    let trace = 0;
    for (let i = 0; i < m.length; i++) {
      trace += m[i][i];
    }
    return trace;
  }

  /**
   * ランク (Rank) の計算 (ガウスの消去法ベース)
   * @param {number[][]} m
   * @returns {number}
   */
  static calculateRank(m) {
    const n = m.length;
    // 配列のディープコピー
    let mat = m.map(row => [...row]);
    let rank = n;
    const EPSILON = 1e-7;

    for (let row = 0; row < rank; row++) {
      if (Math.abs(mat[row][row]) < EPSILON) {
        let swapRow = -1;
        for (let i = row + 1; i < n; i++) {
          if (Math.abs(mat[i][row]) > EPSILON) {
            swapRow = i;
            break;
          }
        }
        if (swapRow !== -1) {
          const temp = mat[row];
          mat[row] = mat[swapRow];
          mat[swapRow] = temp;
        } else {
          rank--;
          for (let i = 0; i < n; i++) {
            mat[i][row] = mat[i][rank];
          }
          row--;
          continue;
        }
      }
      for (let i = 0; i < n; i++) {
        if (i !== row) {
          const factor = mat[i][row] / mat[row][row];
          for (let j = row; j < rank; j++) {
            mat[i][j] -= factor * mat[row][j];
          }
        }
      }
    }
    return rank;
  }

  /**
   * 対称性エラー (Symmetry Error) の計算
   * @param {number[][]} m
   * @returns {number}
   */
  static calculateSymmetryError(m) {
    let error = 0;
    const n = m.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        error += Math.abs(m[i][j] - m[j][i]);
      }
    }
    return error;
  }

  /**
   * 要素の分散 (Variance) の計算
   * @param {number[][]} m
   * @returns {number}
   */
  static calculateVariance(m) {
    const n = m.length;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sum += m[i][j];
      }
    }
    const mean = sum / (n * n);
    
    let sqSum = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        sqSum += Math.pow(m[i][j] - mean, 2);
      }
    }
    return sqSum / (n * n);
  }
}
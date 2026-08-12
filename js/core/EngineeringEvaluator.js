/**
 * EngineeringEvaluator.js
 * WeaveEngineが計算した評価指標（浮き・密度・周期）を、
 * 来館者向けの「布のさわりごこち」を伝える文言に変換する。
 *
 * 行列式・スコアといった数値は一切表示しない方針のため、
 * ここで生成するのは常に日本語の状態ラベル・説明文である。
 */

// 密度のしきい値（weaving-prototype.htmlでの検証結果を踏襲）
const DENSITY_THICK_THRESHOLD = 0.55;  // これ以上: 冬用の厚い布
const DENSITY_THIN_THRESHOLD = 0.28;   // これ未満: 夏用の透ける布

export class EngineeringEvaluator {
  /**
   * WeaveEngine.generateDesign() の結果から、来館者向けの評価情報を生成する
   * @param {Object} input
   * @param {Set<string>} input.floats - 浮きセルの集合（"row,col"形式）
   * @param {number} input.density - 交差頻度（0〜1）
   * @param {number|null} input.period - 検出された繰り返し周期（なければnull）
   * @returns {Object} 評価結果一式
   */
  static evaluate({ floats, density, period }){
    const hasFloat = floats.size > 0;

    return {
      // GASへの保存や、他コンポーネントでの判定に使う生データ
      hasFloat,
      density,
      period,

      // 来館者向けの表示情報（3枚のカードに対応）
      strength: this.buildStrengthInfo(hasFloat),
      thickness: this.buildThicknessInfo(density),
      beauty: this.buildBeautyInfo(period)
    };
  }

  /**
   * 「じょうぶさ」カードの内容
   */
  static buildStrengthInfo(hasFloat){
    if(hasFloat){
      return {
        state: 'warn',
        text: 'ひっかかりやすい ぶぶんが あるよ',
        sub: '糸がなが〜く浮いているところがあり、引っかかると破れやすいよ。'
      };
    }
    return {
      state: 'good',
      text: 'とても じょうぶ',
      sub: '糸がしっかり交差していて、引っぱっても丈夫な布になっているよ。'
    };
  }

  /**
   * 「あつさ・すけかた」カードの内容
   */
  static buildThicknessInfo(density){
    if(density >= DENSITY_THICK_THRESHOLD){
      return {
        state: 'good',
        text: 'ふゆよう の あつい 布',
        sub: '糸が細かく交差していて、向こう側が見えないくらい詰まっているよ。'
      };
    }
    if(density >= DENSITY_THIN_THRESHOLD){
      return {
        state: 'neutral',
        text: 'きせつの かわりめの 布',
        sub: 'ほどよく風が通る、春や秋向きの厚さだよ。'
      };
    }
    return {
      state: 'warn',
      text: 'なつよう の すける 布',
      sub: '交差が少なく、向こう側がうっすら透けて見える軽い布だよ。'
    };
  }

  /**
   * 「もようの うつくしさ」カードの内容
   */
  static buildBeautyInfo(period){
    if(period){
      return {
        state: 'good',
        text: `${period}マスごとに くりかえす もよう`,
        showSparkle: true
      };
    }
    return {
      state: 'neutral',
      text: 'ふぞろいで じゆうな もよう',
      showSparkle: false
    };
  }

  /**
   * GASへの保存payload用に、生データを整形する。
   * period が null の場合は空文字にする（シートの列にnullをそのまま書き込まないため）
   */
  static toPayloadFields({ hasFloat, density, period }){
    return {
      hasFloat,
      density,
      period: (period === null || period === undefined) ? '' : period
    };
  }
}
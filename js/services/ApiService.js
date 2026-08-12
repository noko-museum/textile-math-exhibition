/**
 * ApiService.js
 * Google Apps Script (バックエンド) との非同期通信を担当するサービス
 */

export class ApiService {
  // ※STEP11のデプロイ時に発行されるGASのWeb App URLに書き換えます
  static GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbwhkd7K4gqFzsDHDR-SQB_siIsoQp20mNhwKFSbSQMOoQ2J777ql1EW5K2tK6WqDYvFSw/exec";

  /**
   * 作品データをバックエンドに保存
   * @param {Object} payload 
   * @returns {Promise<Object>} 保存結果 (workId, qrUrl などを返す)
   */
  static async saveWork(payload) {
  try {
    const response = await fetch(this.GAS_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({
        action: "saveWork",
        data: payload
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "保存に失敗しました。");
    }

    return result.result;

  } catch (error) {
    console.error("ApiService.saveWork Error:", error);
    throw error;
  }
}

  /**
   * ギャラリー用データを取得
   * @returns {Promise<Array>} 作品データの配列
   */
  static async getGallery() {
    try {
      const url = `${this.GAS_ENDPOINT}?action=getWorks&limit=50`;
      const response = await fetch(url, { method: "GET" });
      const result = await response.json();
      
      if (!result.success) throw new Error("ギャラリー取得失敗");
      return result.items;
    } catch (error) {
      console.error("ApiService.getGallery Error:", error);
      return [];
    }
  }
}

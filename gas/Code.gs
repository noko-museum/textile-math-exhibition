/**
 * Code.gs
 * Weaving Matrix - GAS API メインエンドポイント
 * フロントエンドからの GET / POST リクエストを受け取り、適切な処理に振り分けます。
 */

/**
 * GETリクエストの処理（データ取得用）
 * ギャラリーや管理画面での一覧表示に使用します。
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === "getWorks") {
      // ⑨ SpreadsheetHelper.gs で定義する関数を呼び出し
      const data = getWorksData();
      return createJsonResponse({ success: true, items: data });
    }

    return createJsonResponse({ success: false, error: "不明なアクションです" });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * POSTリクエストの処理（データ保存用）
 * アプリから送信された作品データと画像を保存します。
 */
function doPost(e) {
  try {
    // フロントエンドから送られたJSONデータを読み込み
    // (CORS回避のため、text/plainで送られたものをJSONとして解釈します)
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === "saveWork") {
      // ⑨ SpreadsheetHelper.gs で定義する関数を呼び出し
      const result = saveNewWork(payload.data);
      return createJsonResponse({ success: true, result: result });
    }

    return createJsonResponse({ success: false, error: "不明なアクションです" });

  } catch (error) {
    return createJsonResponse({ success: false, error: error.message });
  }
}

/**
 * JSON形式でフロントエンドに結果を返すための共通関数
 */
function createJsonResponse(responseObject) {
  return ContentService.createTextOutput(JSON.stringify(responseObject))
    .setMimeType(ContentService.MimeType.JSON);
}
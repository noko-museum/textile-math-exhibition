/**
 * SpreadsheetHelper.gs
 * スプレッドシートおよびGoogleドライブとの連携処理を行う
 *
 * 【シート列構成】（1行目にヘッダーとして手動で設定してください）
 * A: ID | B: 日時 | C: サイズ | D: Bの行列 | E: Aプリセット | F: Cプリセット |
 * G: 浮きの有無 | H: 密度 | I: 周期 | J: 画像URL
 */

/**
 * 新しい作品データをスプレッドシートとドライブに保存する
 */
function saveNewWork(data) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME_WORKS);
  if (!sheet) {
    throw new Error("シート '" + CONFIG.SHEET_NAME_WORKS + "' が見つかりません。シート名を正しく作成してください。");
  }

  // 1. 画像データをGoogleドライブに保存
  // ※フロントエンド(ApiService.js)は "image64" というキーで送ってくるため、
  //   ここも "image64" で受け取る（以前は "imageData" と不一致で保存されないバグがあった）
  let imageUrl = "";
  if (data.image64) {
    imageUrl = saveImageToDrive(data.image64);
  }

  // 2. タイムスタンプとIDの生成
  const now = new Date();
  // 複数端末での同時保存によるID衝突を避けるため、末尾にランダムな文字列を付与
  const randomSuffix = Utilities.getUuid().slice(0, 6);
  const uniqueId = "WM-" + Utilities.formatDate(now, "Asia/Tokyo", "yyyyMMdd-HHmmss") + "-" + randomSuffix;
  const dateString = now.toISOString();

  // 3. スプレッドシートに書き込むデータの配列
  // カラム: [A:ID, B:日時, C:サイズ, D:Bの行列, E:Aプリセット, F:Cプリセット,
  //          G:浮きの有無, H:密度, I:周期, J:画像URL]
  const rowData = [
    uniqueId,
    dateString,
    data.size !== undefined ? data.size : "",
    data.matrixData || "",
    data.presetA || "",
    data.presetC || "",
    formatHasFloat(data.hasFloat),
    typeof data.density === "number" ? data.density : "",
    formatPeriod(data.period),
    imageUrl
  ];

  // シートの最終行にデータを追加
  sheet.appendRow(rowData);

  return {
    workId: uniqueId,
    imageUrl: imageUrl,
    qrUrl: imageUrl
  };
}

/**
 * hasFloat（true/false/undefined）をシート表示用の文字列に変換
 */
function formatHasFloat(hasFloat) {
  if (hasFloat === true) return "あり";
  if (hasFloat === false) return "なし";
  return "";
}

/**
 * period（数値/null/undefined）をシート保存用の値に変換
 * 周期性が無い場合は空文字にする（数値の0と紛れないように）
 */
function formatPeriod(period) {
  if (period === null || period === undefined || period === "") return "";
  return period;
}

/**
 * Base64形式の画像データをGoogleドライブに保存し、公開URLを返す
 */
function saveImageToDrive(base64Data) {
  const folderId = CONFIG.IMAGE_FOLDER_ID;
  if (!folderId || folderId === 'YOUR_FOLDER_ID_HERE') {
    throw new Error("GoogleドライブのフォルダIDが設定されていません。(Config.gsを確認してください)");
  }

  const folder = DriveApp.getFolderById(folderId);

  // "data:image/png;base64,iVBOR..." のような形式からデータ部分だけを抽出
  const base64String = base64Data.split(',')[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(base64String), 'image/png', "work_" + new Date().getTime() + ".png");

  const file = folder.createFile(blob);

  // 誰でもリンクを知っていれば画像を閲覧できるように権限を変更（Web上で表示するため）
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  // 画像の直リンクURLを作成（Webサイト上で <img> タグとして表示するための形式）
  const fileId = file.getId();
  return "https://drive.google.com/uc?export=view&id=" + fileId;
}

/**
 * スプレッドシートからすべての作品データを取得する
 */
function getWorksData() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME_WORKS);
  if (!sheet) {
    return [];
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();

  // ヘッダーのみ、または空の場合は空配列を返す
  if (values.length <= 1) {
    return [];
  }

  // ヘッダー行(0行目)をスキップしてデータ行を処理
  const items = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    items.push({
      id: row[0],
      date: row[1],
      size: row[2],
      matrixData: row[3],
      presetA: row[4],
      presetC: row[5],
      hasFloat: row[6],
      density: row[7],
      period: row[8],
      imageUrl: row[9]
    });
  }

  return items;
}
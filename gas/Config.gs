/**
 * Config.gs
 * Weaving Matrix - 環境設定ファイル
 * スプレッドシートのシート名や、画像を保存するGoogleドライブのフォルダIDを管理します。
 */

const CONFIG = {
  // データを保存するスプレッドシートのシート名
  SHEET_NAME_WORKS: 'Works',

  // 画像を保存するGoogleドライブのフォルダID
  // 【重要】画像を保存するフォルダのURLからIDをコピーして、ここに貼り付けてください
  // 例: https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ にアクセスしている場合
  // '1aBcDeFgHiJkLmNoPqRsTuVwXyZ' の部分がIDです。
  IMAGE_FOLDER_ID: '1R0Qp9lyLIbYZD9uw7MYxlzd3uXRGvnGl'
};

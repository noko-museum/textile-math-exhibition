import { formatDate, showNotification } from '../utils/helpers.js';

// 【重要】STEP11で取得したGASの「ウェブアプリのURL」をここに貼り付けてください
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwhkd7K4gqFzsDHDR-SQB_siIsoQp20mNhwKFSbSQMOoQ2J777ql1EW5K2tK6WqDYvFSw/exec';

export class AdminUI {
  constructor() {
    // DOM要素の取得
    this.tableBody = document.getElementById('worksTableBody');
    this.totalCountEl = document.getElementById('totalWorksCount');
    this.todayCountEl = document.getElementById('todayWorksCount');
    this.avgScoreEl = document.getElementById('averageScore');
    this.refreshBtn = document.getElementById('refreshBtn');

    this.initEvents();
    this.loadData();
  }

  initEvents() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        this.loadData();
      });
    }
  }

  /**
   * GASからデータを取得する
   */
  async loadData() {
    // URLが設定されていない場合の警告
    if (GAS_ENDPOINT === 'YOUR_GAS_WEB_APP_URL') {
      this.tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#ff7e67; font-weight:bold;">【設定エラー】AdminUI.js の 4行目にある GAS_ENDPOINT にウェブアプリのURLを設定してください。</td></tr>';
      return;
    }

    this.tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">GASからデータを読み込み中...</td></tr>';
    
    try {
      // GASの doGet 関数を呼び出し (action=getWorks)
      const response = await fetch(`${GAS_ENDPOINT}?action=getWorks`);
      const result = await response.json();

      if (result.success) {
        this.renderTable(result.items);
        this.updateStats(result.items);
        showNotification('データを最新に更新しました');
      } else {
        throw new Error(result.error || 'データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#ff7e67;">エラーが発生しました: ${error.message}</td></tr>`;
    }
  }

  /**
   * テーブルにデータを描画する
   */
  renderTable(items) {
    this.tableBody.innerHTML = '';
    
    if (!items || items.length === 0) {
      this.tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">まだ作品データがありません。</td></tr>';
      return;
    }

    // 最新のデータが上に来るように配列を反転
    const reversedItems = [...items].reverse();

    reversedItems.forEach(item => {
      const tr = document.createElement('tr');
      
      // 画像セル
      const tdImg = document.createElement('td');
      if (item.imageUrl) {
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.className = 'thumbnail';
        tdImg.appendChild(img);
      } else {
        tdImg.textContent = '画像なし';
      }

      // 日時
      const tdDate = document.createElement('td');
      tdDate.textContent = formatDate(item.date);

      // ID
      const tdId = document.createElement('td');
      tdId.textContent = item.id || '-';

      // 行列データ
      const tdMatrix = document.createElement('td');
      tdMatrix.textContent = item.matrixData || '-';

      // スコア
      const tdScore = document.createElement('td');
      tdScore.textContent = item.score !== undefined ? item.score : '-';

      // 模様・カラー
      const tdPattern = document.createElement('td');
      tdPattern.innerHTML = `${item.patternName || '-'}<br><small style="color: var(--text-sub);">${item.colorTheme || '-'}</small>`;

      // セルを行に追加
      tr.appendChild(tdImg);
      tr.appendChild(tdDate);
      tr.appendChild(tdId);
      tr.appendChild(tdMatrix);
      tr.appendChild(tdScore);
      tr.appendChild(tdPattern);

      this.tableBody.appendChild(tr);
    });
  }

  /**
   * 統計情報を計算して表示する
   */
  updateStats(items) {
    if (!items || items.length === 0) return;

    // 総作品数
    this.totalCountEl.textContent = items.length;

    // 本日の生成数
    const todayStr = new Date().toLocaleDateString();
    const todayItems = items.filter(item => {
      if (!item.date) return false;
      return new Date(item.date).toLocaleDateString() === todayStr;
    });
    this.todayCountEl.textContent = todayItems.length;

    // 平均スコア
    const validScores = items.filter(item => item.score !== undefined && item.score !== null && item.score !== '');
    if (validScores.length > 0) {
      const sum = validScores.reduce((acc, curr) => acc + Number(curr.score), 0);
      this.avgScoreEl.textContent = Math.round(sum / validScores.length);
    } else {
      this.avgScoreEl.textContent = '0';
    }
  }
}
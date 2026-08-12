import { showNotification } from '../utils/helpers.js';

// 【重要】STEP11で取得したGASの「ウェブアプリのURL」をここに貼り付けてください
// ※AdminUI.jsと同じURLになります
const GAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwhkd7K4gqFzsDHDR-SQB_siIsoQp20mNhwKFSbSQMOoQ2J777ql1EW5K2tK6WqDYvFSw/exec';

export class GalleryUI {
  /**
   * @param {string} containerId ギャラリーを描画するHTML要素のID
   */
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.works = [];
    
    if (this.container) {
      this.loadGalleryData();
    }
  }

  /**
   * GASからギャラリー用のデータを取得
   */
  async loadGalleryData() {
    if (GAS_ENDPOINT === 'YOUR_GAS_WEB_APP_URL') {
      this.container.innerHTML = '<p style="text-align:center; color:#ff7e67;">GASのエンドポイントURLが設定されていません。</p>';
      return;
    }

    this.container.innerHTML = '<div class="loading-spinner">作品データを読み込み中...</div>';

    try {
      const response = await fetch(`${GAS_ENDPOINT}?action=getWorks`);
      const result = await response.json();

      if (result.success) {
        this.works = result.items;
        this.renderGallery();
      } else {
        throw new Error(result.error || 'データの取得に失敗しました');
      }
    } catch (error) {
      console.error('Gallery loading error:', error);
      this.container.innerHTML = `<p style="text-align:center; color:#ff7e67;">ギャラリーの読み込みに失敗しました: ${error.message}</p>`;
    }
  }

  /**
   * 取得したデータをHTMLのカード形式にして描画
   */
  renderGallery() {
    this.container.innerHTML = '';

    if (this.works.length === 0) {
      this.container.innerHTML = '<p style="text-align:center;">まだ作品がありません。最初の作品を作りましょう！</p>';
      return;
    }

    // 最新の作品から順に表示
    const reversedWorks = [...this.works].reverse();

    reversedWorks.forEach(work => {
      // 画像がないデータはスキップ
      if (!work.imageUrl) return;

      // カード要素の作成
      const card = document.createElement('div');
      card.className = 'gallery-card';

      // 画像部分
      const img = document.createElement('img');
      img.src = work.imageUrl;
      img.alt = `Work ${work.id}`;
      img.className = 'gallery-img';

      // 情報部分
      const info = document.createElement('div');
      info.className = 'gallery-info';
      
      const title = document.createElement('h3');
      title.textContent = work.patternName || 'Unknown Pattern';
      
      const details = document.createElement('p');
      details.innerHTML = `
        <strong>Score:</strong> ${work.score || 0} <br>
        <strong>Matrix:</strong> [${work.matrixData || '-'}]
      `;

      info.appendChild(title);
      info.appendChild(details);
      
      card.appendChild(img);
      card.appendChild(info);

      this.container.appendChild(card);
    });
  }
}
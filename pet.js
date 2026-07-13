// pet.js — ペットの行動・アニメーション・感情システム

// ペットの状態
const PET = {
  name: 'ミハル',
  emoji: '🐱',
  x: 0.5,
  y: 0.68,
  targetX: 0.5,
  targetY: 0.68,
  hunger: 80,
  clean: 90,
  happy: 70,
  state: 'idle',
  stateTimer: 0,
  direction: 1,
  bobPhase: 0,
  reaction: null,
  reactionTimer: 0,
  delivering: false,
  diary: [],
};


// ペットの行動パターン
const PET_STATES = ['idle', 'wander', 'sleep', 'play', 'eat'];
const MOOD_TABLE = [
  { min: 80, label: 'ごきげん 😊' },
  { min: 60, label: 'ふつう 😐' },
  { min: 40, label: 'ちょっと不満 😕' },
  { min: 20, label: 'さみしい 😢' },
  { min: 0,  label: 'ぷんぷん 😠' },
];

// 日記テンプレート
const DIARY_TEMPLATES = [
  'きょうは ひなたぼっこ したにゃ。まどぎわが いちばん あったかい。',
  'おやつ もらえて うれしかったにゃ〜。もっと ほしいにゃ。',
  'なでなで してもらった！ のどが ゴロゴロ いっちゃう。',
  'おふろに はいったにゃ... みずは にがてなのに...',
  'あかいボールで あそんだにゃ！ たのしかった〜。',
  'メールを とどけに いったにゃ。{to}さんの おうちは いいにおいがした。',
  'きょうは だれも あそんでくれなかった... まどの そとを ずっと みてた。',
  'ほんだなの うえに のぼろうとしたけど、とどかなかったにゃ...',
  'おなか すいたにゃ〜。ボウルの まえで まってるにゃ。',
  'ランプの ひかりが あったかくて、まるくなって ねちゃったにゃ。',
  'しっぽを おいかけて ぐるぐる まわったにゃ。たのしい！',
  'たかいところから おへやを みおろすのが すきにゃ。',
  'まどから そらを みたにゃ。くもが ゆっくり ながれてた。',
  'ラグの うえで ごろごろ したにゃ。きもちいい〜。',
  'おおきく のびを したにゃ。からだが ぽきぽき いった。',
  'ぴょんぴょん はねたにゃ！ たかく とべた きがする。',
  'すわって ぼーっと してたにゃ。なにも かんがえない じかんも だいじ。',
  'かべの とけいを じーっと みてたにゃ。はりが うごくの おもしろい。',
  'きょうは いっぱい あるいたにゃ。おへやの すみずみまで たんけん。',
  'うえきに みずを あげたかったけど、てが みじかくて とどかなかったにゃ。',
  'ほんを よもうとしたけど、じが よめなかったにゃ... えほんが いいにゃ。',
  'おふろの あとは からだが ぽかぽか するにゃ。すきじゃないけど。',
  'ゆうやけが きれいだったにゃ。まどが オレンジいろに なった。',
  'よるの そらに ほしが みえたにゃ。きらきら してた。',
];

let petAnimFrame = null;

function initPet() {
  // localStorageから復元
  const saved = localStorage.getItem('postpet_state');
  if (saved) {
    const s = JSON.parse(saved);
    Object.assign(PET, s);
  }
  // セットアップから名前を読み取り
  const setup = localStorage.getItem('postpet_setup');
  if (setup) {
    const cfg = JSON.parse(setup);
    PET.name = cfg.name || 'ミハル';
  }
  // 時間経過による状態変化
  applyTimeDecay();
  // アニメーションループ開始
  petAnimFrame = requestAnimationFrame(petLoop);
  // 自動行動タイマー
  setInterval(autoAction, 4000);
  // 自動セーブ
  setInterval(savePet, 10000);
  // 自動日記
  setInterval(autoWriteDiary, 60000);
  // Canvas クリック
  document.getElementById('roomCanvas').addEventListener('click', onRoomClick);
  updateUI();
}


function petLoop(ts) {
  PET.bobPhase += 0.05;
  // 移動（3D版ではroom.jsのanimate()が処理するので座標同期のみ）
  const dx = PET.targetX - PET.x;
  const dy = PET.targetY - PET.y;
  // 寝ている/横になっている時は移動しない
  const isSleeping = PET.state === 'sleep' || PET.state === 'lyingOnRug' || PET.state === 'sitting';
  if (!isSleeping && (Math.abs(dx) > 0.005 || Math.abs(dy) > 0.005)) {
    PET.direction = dx > 0 ? 1 : -1;
    PET.state = 'wander';
  } else if (PET.state === 'wander') {
    PET.state = 'idle';
  }
  // 状態タイマー
  if (PET.stateTimer > 0) {
    PET.stateTimer--;
    if (PET.stateTimer === 0) {
      // ポーズリセット（腹這い等から戻す）
      if ((PET.state === 'lyingOnRug' || PET.state === 'lookWindow' || PET.state === 'stretch' || PET.state === 'hopping' || PET.state === 'sitting') 
          && typeof petGroup !== 'undefined' && petGroup) {
        petGroup.rotation.x = 0;
        petGroup.rotation.z = 0;
        petGroup.position.y = 0;
        if (petGroup.userData.armL) {
          petGroup.userData.armL.rotation.x = 0;
          petGroup.userData.armR.rotation.x = 0;
          petGroup.userData.armL.rotation.z = -0.35;
          petGroup.userData.armR.rotation.z = 0.35;
          petGroup.userData.legL.rotation.x = 0;
          petGroup.userData.legR.rotation.x = 0;
          petGroup.userData.legL.rotation.z = 0;
          petGroup.userData.legR.rotation.z = 0;
        }
      }
      PET.state = 'idle';
    }
  }
  // リアクションタイマー
  if (PET.reactionTimer > 0) {
    PET.reactionTimer--;
    if (PET.reactionTimer === 0) PET.reaction = null;
  }
  petAnimFrame = requestAnimationFrame(petLoop);
}

function drawPet() {
  if (!roomCtx) return;
  // 部屋を再描画してからペットを上に描く
  drawRoom();
  const w = roomW / devicePixelRatio;
  const h = roomH / devicePixelRatio;
  const ctx = roomCtx;
  const px = PET.x * w;
  const py = PET.y * h;
  const size = Math.min(w, h) * 0.24;
  const bob = Math.sin(PET.bobPhase) * 3;

  ctx.save();
  ctx.translate(px, py + bob);

  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.1)';
  ctx.beginPath();
  ctx.ellipse(0, size * 0.5, size * 0.5, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();

  // ペット本体（ピンクのクマ）
  const s = PET.direction;
  drawMomo(ctx, 0, 0, size, s);

  // 状態表示
  if (PET.state === 'sleep') {
    ctx.font = `${size * 0.4}px sans-serif`;
    ctx.fillText('💤', size * 0.3, -size * 0.6);
  }
  if (PET.state === 'eat') {
    ctx.font = `${size * 0.35}px sans-serif`;
    ctx.fillText('🍰', -size * 0.5, -size * 0.1);
  }

  // リアクション吹き出し
  if (PET.reaction) {
    ctx.font = `${size * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    const ry = -size * 0.9 + Math.sin(PET.bobPhase * 2) * 2;
    ctx.fillText(PET.reaction, 0, ry);
  }

  ctx.restore();
}


// モモ（ピンクのクマ）を描画
function drawMomo(ctx, cx, cy, size, dir) {
  const r = size * 0.4;
  // 耳
  ctx.fillStyle = '#f8a4c8';
  ctx.beginPath();
  ctx.arc(cx - r * 0.7 * dir, cy - r * 0.9, r * 0.3, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.7 * dir, cy - r * 0.9, r * 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 耳の内側
  ctx.fillStyle = '#f472b6';
  ctx.beginPath();
  ctx.arc(cx - r * 0.7 * dir, cy - r * 0.9, r * 0.15, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.7 * dir, cy - r * 0.9, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 体
  ctx.fillStyle = '#f8a4c8';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.4, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 頭
  ctx.fillStyle = '#f8a4c8';
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.2, r, 0, Math.PI * 2);
  ctx.fill();
  // 顔の白い部分
  ctx.fillStyle = '#fce4ec';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.05, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 目
  const eyeState = PET.state === 'sleep' ? 'closed' : 'open';
  const ex = r * 0.25 * dir;
  if (eyeState === 'open') {
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(cx - ex, cy - r * 0.2, r * 0.08, 0, Math.PI * 2);
    ctx.arc(cx + ex, cy - r * 0.2, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
    // ハイライト
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - ex + r * 0.02, cy - r * 0.23, r * 0.03, 0, Math.PI * 2);
    ctx.arc(cx + ex + r * 0.02, cy - r * 0.23, r * 0.03, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - ex - r * 0.06, cy - r * 0.2);
    ctx.lineTo(cx - ex + r * 0.06, cy - r * 0.2);
    ctx.moveTo(cx + ex - r * 0.06, cy - r * 0.2);
    ctx.lineTo(cx + ex + r * 0.06, cy - r * 0.2);
    ctx.stroke();
  }
  // 鼻
  ctx.fillStyle = '#e91e63';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.02, r * 0.07, r * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // 口
  ctx.strokeStyle = '#c2185b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (PET.happy > 60) {
    ctx.arc(cx, cy + r * 0.05, r * 0.12, 0.1, Math.PI - 0.1);
  } else {
    ctx.arc(cx, cy + r * 0.18, r * 0.1, Math.PI + 0.2, -0.2);
  }
  ctx.stroke();
  // 手
  ctx.fillStyle = '#f8a4c8';
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.7, cy + r * 0.3, r * 0.15, r * 0.2, -0.3, 0, Math.PI * 2);
  ctx.ellipse(cx + r * 0.7, cy + r * 0.3, r * 0.15, r * 0.2, 0.3, 0, Math.PI * 2);
  ctx.fill();
  // 足
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.3, cy + r * 0.85, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + r * 0.3, cy + r * 0.85, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
  ctx.fill();
}


// ユーザーアクション
function petAction(action) {
  if (PET.delivering) {
    showToast('ミハルは おでかけちゅう だよ');
    return;
  }
  // 寝ている・ポーズ中なら必ず起き上がってから動作する
  const posing = PET.state === 'sleep' || PET.state === 'lyingOnRug' || PET.state === 'sitting'
    || PET.state === 'stretch' || PET.state === 'hopping' || PET.state === 'lookWindow';
  if (posing) {
    wakeUpPet();
  }
  switch (action) {
    case 'feed':
      PET.hunger = Math.min(100, PET.hunger + 20);
      PET.happy = Math.min(100, PET.happy + 5);
      PET.state = 'eat';
      PET.stateTimer = 60;
      PET.reaction = '😋';
      PET.reactionTimer = 40;
      if (typeof showSnack3D === 'function') showSnack3D();
      showToast('おやつ あげたよ！');
      break;
    case 'pet':
      enterPettingMode();
      break;
    case 'bath':
      PET.clean = Math.min(100, PET.clean + 30);
      PET.happy = Math.min(100, PET.happy + 5);
      PET.reaction = '✨';
      PET.reactionTimer = 50;
      if (typeof showBath3D === 'function') showBath3D();
      showToast('おふろに はいるよ！');
      break;
    case 'play':
      if (typeof enterPlayMode === 'function') enterPlayMode();
      break;
  }
  updateUI();
  savePet();
}

// 部屋クリック → 3D版ではroom.jsのonRoomClick3Dが処理
function onRoomClick(e) {
  // 3D版では使わない（互換用）
}

// 自動行動
function autoAction() {
  if (PET.delivering || (PET.state !== 'idle' && PET.state !== 'wander')) return;
  // 遊ぶモード中は自律行動しない
  if (typeof playMode !== 'undefined' && playMode) return;
  // 寝ている/横になっている状態なら何もしない（stateTimerで自然に起きるのを待つ）
  if (PET.state === 'sleep' || PET.state === 'lyingOnRug' || PET.state === 'sitting') return;
  // 前のポーズをリセット
  if (typeof petGroup !== 'undefined' && petGroup && petGroup.userData.armL) {
    petGroup.rotation.x = 0;
  }
  const r = Math.random();
  if (r < 0.15) {
    // うろうろ
    PET.targetX = 0.15 + Math.random() * 0.7;
    PET.targetY = 0.6 + Math.random() * 0.25;
  } else if (r < 0.22 && PET.hunger < 40) {
    // お腹すいた → ボウルに行く
    PET.targetX = 0.2;
    PET.targetY = 0.78;
    PET.reaction = '🍽️';
    PET.reactionTimer = 40;
  } else if (r < 0.35) {
    // 窓を見に行く
    PET.targetX = 0.5;
    PET.targetY = 0.25;
    PET.state = 'lookWindow';
    PET.stateTimer = 100;
    PET.reaction = '🪟';
    PET.reactionTimer = 40;
  } else if (r < 0.50) {
    // ラグでゴロン（ラグの近くにいる時だけ）
    const onRug = Math.abs(PET.x - 0.5) < 0.15 && Math.abs(PET.y - 0.6) < 0.15;
    if (onRug) {
      PET.targetX = PET.x;
      PET.targetY = PET.y;
      PET.state = 'lyingOnRug';
      PET.stateTimer = 200;
      PET.reaction = '😴';
      PET.reactionTimer = 50;
    }
  } else if (r < 0.65) {
    // 伸び（その場でバンザイ）
    PET.state = 'stretch';
    PET.stateTimer = 150;
    PET.reaction = '🙆';
    PET.reactionTimer = 80;
  } else if (r < 0.72) {
    // 跳ねる（その場でぴょんぴょん）
    PET.state = 'hopping';
    PET.stateTimer = 120;
    PET.reaction = '🎵';
    PET.reactionTimer = 60;
  } else if (r < 0.80) {
    // ラグの上で座る（ラグの近くにいる時だけ）
    const onRug = Math.abs(PET.x - 0.5) < 0.15 && Math.abs(PET.y - 0.6) < 0.15;
    if (onRug) {
      PET.targetX = PET.x;
      PET.targetY = PET.y;
      PET.state = 'sitting';
      PET.stateTimer = 250;
      PET.reaction = '😊';
      PET.reactionTimer = 40;
    }
  } else if (r < 0.88) {
    // 寝る
    PET.state = 'sleep';
    PET.stateTimer = 120;
  }
}

// 時間経過による減衰
function applyTimeDecay() {
  const lastSave = localStorage.getItem('postpet_lastSave');
  if (lastSave) {
    const elapsed = (Date.now() - parseInt(lastSave)) / 60000; // 分
    PET.hunger = Math.max(0, PET.hunger - elapsed * 0.5);
    PET.clean = Math.max(0, PET.clean - elapsed * 0.3);
    PET.happy = Math.max(0, PET.happy - elapsed * 0.2);
  }
}


// UI更新
function updateUI() {
  document.getElementById('petName').textContent = PET.name;
  const avg = (PET.hunger + PET.clean + PET.happy) / 3;
  const mood = MOOD_TABLE.find(m => avg >= m.min) || MOOD_TABLE[MOOD_TABLE.length - 1];
  document.getElementById('petMood').textContent = mood.label;
  document.getElementById('hungerBar').style.width = PET.hunger + '%';
  document.getElementById('cleanBar').style.width = PET.clean + '%';
  document.getElementById('happyBar').style.width = PET.happy + '%';
  // ペット名を各所に反映
  const sendBtn = document.querySelector('.send-btn');
  if (sendBtn) sendBtn.textContent = '📨 ' + PET.name + 'におねがいする';
  const diaryTitle = document.querySelector('.diary-card h3');
  if (diaryTitle) diaryTitle.textContent = '📔 ' + PET.name + 'のひみつにっき';
}

// 保存
function savePet() {
  const { x, y, targetX, targetY, hunger, clean, happy, diary, name } = PET;
  localStorage.setItem('postpet_state', JSON.stringify({ x, y, targetX, targetY, hunger, clean, happy, diary, name }));
  localStorage.setItem('postpet_lastSave', Date.now().toString());
}

// 日記
function autoWriteDiary() {
  const tmpl = DIARY_TEMPLATES[Math.floor(Math.random() * DIARY_TEMPLATES.length)];
  const entry = {
    date: new Date().toLocaleString('ja-JP'),
    text: tmpl.replace('{to}', 'だれか'),
  };
  PET.diary.unshift(entry);
  if (PET.diary.length > 20) PET.diary.pop();
  savePet();
}

let diaryPage = 0;

function showDiary() {
  diaryPage = 0;
  renderDiaryPage();
  document.getElementById('diaryOverlay').classList.add('show');
}

function renderDiaryPage() {
  const el = document.getElementById('diaryContent');
  document.querySelector('.diary-card h3').textContent = '📔 ' + PET.name + 'のひみつにっき';

  if (PET.diary.length === 0) {
    el.innerHTML = '<p style="font-size:18px;text-align:center;padding:20px 0">まだ にっきは ないよ</p>';
    return;
  }

  const total = PET.diary.length;
  diaryPage = Math.max(0, Math.min(diaryPage, total - 1));
  const entry = PET.diary[diaryPage];

  // 日記本文には他ユーザー由来の文字列（配達先ペット名）が含まれるため必ずエスケープする（保存型XSS対策）
  el.innerHTML = `
    <div style="text-align:center;margin-bottom:16px">
      <span style="font-size:14px;color:#a0855a">${diaryPage + 1} / ${total}</span>
    </div>
    <div style="text-align:center;margin-bottom:8px">
      <span style="font-size:16px;color:#92400e;font-weight:600">${esc(entry.date)}</span>
    </div>
    <p style="font-size:18px;line-height:2;padding:12px 0;min-height:80px">${esc(entry.text)}</p>
    <div style="display:flex;justify-content:space-between;margin-top:20px">
      <button onclick="diaryPrev()" style="background:${diaryPage < total - 1 ? '#d97706' : '#ccc'};color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:18px;cursor:pointer" ${diaryPage >= total - 1 ? 'disabled' : ''}>← まえ</button>
      <button onclick="diaryNext()" style="background:${diaryPage > 0 ? '#d97706' : '#ccc'};color:#fff;border:none;border-radius:8px;padding:10px 24px;font-size:18px;cursor:pointer" ${diaryPage <= 0 ? 'disabled' : ''}>つぎ →</button>
    </div>
  `;
}

function diaryPrev() {
  diaryPage++;
  renderDiaryPage();
}

function diaryNext() {
  diaryPage--;
  renderDiaryPage();
}

function closeDiary() {
  document.getElementById('diaryOverlay').classList.remove('show');
}

// 配達アニメーション
function startDelivery(to, callback) {
  // 寝ていたら起こす
  if (PET.state === 'sleep' || PET.state === 'lyingOnRug' || PET.state === 'sitting') {
    wakeUpPet();
  }
  PET.delivering = true;
  PET.state = 'wander';

  // 3D演出: ドアに歩いて出ていく
  if (typeof deliveryWalkToDoor === 'function') {
    deliveryWalkToDoor(() => {
      // 出ていった後にオーバーレイ表示
      const overlay = document.getElementById('deliveryOverlay');
      const text = document.getElementById('deliveryText');
      overlay.classList.add('show');
      text.textContent = `${PET.name}が ${to}さんに メールを とどけにいっています...`;

      PET.clean = Math.max(0, PET.clean - 10);

      setTimeout(() => {
        text.textContent = `${to}さんの おうちに ついたにゃ！`;
      }, 2000);

      setTimeout(() => {
        text.textContent = `${PET.name}が かえってきた！`;
        PET.diary.unshift({
          date: new Date().toLocaleString('ja-JP'),
          text: `${to}さんの おうちに メールを とどけにいったにゃ。おへやが きれいだったにゃ〜。`,
        });
      }, 3500);

      setTimeout(() => {
        overlay.classList.remove('show');
        PET.delivering = false;
        PET.state = 'idle';
        // 3D演出: ドアから帰ってくる
        if (typeof deliveryReturn === 'function') deliveryReturn();
        PET.reaction = '📬';
        PET.reactionTimer = 60;
        PET.happy = Math.min(100, PET.happy + 10);
        updateUI();
        savePet();
        if (callback) callback();
      }, 5000);
    });
  }
}

// なでなでモード
let pettingMode = false;
let petStrokes = 0;
let lastPetPos = null;

function enterPettingMode() {
  if (PET.delivering) { showToast('ミハルは おでかけちゅう だよ'); return; }
  pettingMode = true;
  petStrokes = 0;
  lastPetPos = null;
  document.querySelector('.room-area').classList.add('petting');
  document.getElementById('pettingBanner').style.display = 'block';
  // マウス移動でなでなで検知
  const canvas = document.getElementById('roomCanvas');
  canvas.addEventListener('mousemove', onPettingMove);
  canvas.addEventListener('touchmove', onPettingTouch, { passive: false });
  canvas.addEventListener('click', onPettingClick);
}

function exitPettingMode() {
  pettingMode = false;
  document.querySelector('.room-area').classList.remove('petting');
  document.getElementById('pettingBanner').style.display = 'none';
  const canvas = document.getElementById('roomCanvas');
  canvas.removeEventListener('mousemove', onPettingMove);
  canvas.removeEventListener('touchmove', onPettingTouch);
  canvas.removeEventListener('click', onPettingClick);
  if (petStrokes > 0) {
    const bonus = Math.min(20, petStrokes * 2);
    PET.happy = Math.min(100, PET.happy + bonus);
    updateUI();
    savePet();
    showToast(`${petStrokes}回 なでなでした！ ミハル うれしそう ❤️`);
  }
}

function onPettingClick(e) {
  // なでなでモード中のクリックは歩行させない（モード終了のみ）
  e.stopPropagation();
}

function onPettingMove(e) {
  if (!pettingMode || !petGroup || !camera) return;

  // マウス位置からレイキャストでペットとの距離を判定
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(mx, my), camera);

  // ペットの位置との距離チェック（3D空間で近いか）
  const petWorldPos = new THREE.Vector3();
  petGroup.getWorldPosition(petWorldPos);
  petWorldPos.y += 0.5; // 体の中心あたり

  const ray = raycaster.ray;
  const closest = new THREE.Vector3();
  ray.closestPointToPoint(petWorldPos, closest);
  const dist = closest.distanceTo(petWorldPos);

  if (dist < 0.8) {
    // ペットの近くでマウスが動いた = なでなで
    const currentPos = { x: e.clientX, y: e.clientY };
    if (lastPetPos) {
      const moveDist = Math.sqrt(
        (currentPos.x - lastPetPos.x) ** 2 +
        (currentPos.y - lastPetPos.y) ** 2
      );
      if (moveDist > 15) {
        petStrokes++;
        lastPetPos = currentPos;

        // リアクション（段階的に喜ぶ）
        if (petStrokes === 1) {
          PET.reaction = '😊';
          PET.reactionTimer = 30;
        } else if (petStrokes === 3) {
          PET.reaction = '😆';
          PET.reactionTimer = 30;
        } else if (petStrokes === 5) {
          PET.reaction = '❤️';
          PET.reactionTimer = 40;
          // ゴロン！
          if (typeof petRollOver === 'function') petRollOver();
        } else if (petStrokes > 5 && petStrokes % 3 === 0) {
          PET.reaction = '💕';
          PET.reactionTimer = 30;
        }

        // 小さく揺れる（喜びの表現）
        if (petGroup && !pettingAnim) {
          petGroup.rotation.z = Math.sin(petStrokes * 2) * 0.08;
          setTimeout(() => { if (petGroup) petGroup.rotation.z = 0; }, 150);
        }
      }
    } else {
      lastPetPos = currentPos;
    }
  }
}

// タッチ版なでなで（スマホ対応）
function onPettingTouch(e) {
  if (!pettingMode) return;
  e.preventDefault();
  const touch = e.touches[0];
  if (touch) {
    onPettingMove({ clientX: touch.clientX, clientY: touch.clientY });
  }
}

// ペットを起こす
function wakeUpPet() {
  PET.state = 'idle';
  PET.stateTimer = 0;
  PET.reaction = '😳';
  PET.reactionTimer = 30;
  showToast(PET.name + ' おきたよ！');
  // 3Dのポーズを完全にリセット（体の回転・頭・手足すべて立ち姿に戻す）
  if (typeof resetPetPose === 'function') {
    resetPetPose();
  } else if (typeof petGroup !== 'undefined' && petGroup) {
    // フォールバック
    petGroup.rotation.x = 0;
    petGroup.rotation.z = 0;
    petGroup.position.y = 0;
    if (petGroup.userData.head) {
      petGroup.userData.head.rotation.z = 0;
      petGroup.userData.head.rotation.x = 0;
    }
  }
  // 小さくジャンプして起きる演出
  if (typeof petJump === 'function') {
    setTimeout(() => petJump(), 200);
  }
}

// トースト
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
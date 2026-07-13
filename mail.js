// mail.js — Firebase Firestoreベースのリアルメッセージングシステム
// ペットが配達する演出付き。実際に他のユーザーとメッセージを送り合える。

// HTMLエスケープ（保存型XSS対策）。他ユーザー由来の文字列をinnerHTMLに入れる前に必ず通す
function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// あいことばの正規化。全角→半角(NFKC)・小文字化・空白除去。
// 「PS」「ps」「ＰＳ」「P S」を同じ部屋として扱う（表記ゆれで人数が欠ける問題の対策）
function normRoom(value) {
  return String(value == null ? '' : value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, '');
}

// 色文字列のサニタイズ（style属性内に入れるためhex/rgbのみ許可、それ以外は無色）
function safeColor(value) {
  const v = String(value == null ? '' : value).trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(v) || /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/.test(v) ? v : '';
}

let currentTab = 'inbox';
let myUserId = null;
let myPetName = null;
let myPetColor = null;
let myPetAnimal = null;
let myOwnerName = null;
let myRoom = null;
let unsubInbox = null; // Firestoreリスナー解除用
let inboxInitialized = false; // 初回ロード完了フラグ

const MAIL_STORE = {
  inbox: [],
  sent: [],
};

// ユーザー登録/ログイン + Firestoreリスナー開始
async function initMail() {
  try {
    // 匿名認証でログイン
    const result = await auth.signInAnonymously();
    myUserId = result.user.uid;

    // ペット情報を取得
    const setup = localStorage.getItem('postpet_setup');
    if (setup) {
      const cfg = JSON.parse(setup);
      myPetName = cfg.name || 'ミハル';
      myPetColor = cfg.color || '#ffb347';
      myPetAnimal = cfg.animal || 'bear';
      myOwnerName = cfg.ownerName || '';
      myRoom = normRoom(cfg.room || '');
    } else {
      myPetName = PET.name || 'ミハル';
      myPetColor = '#ffb347';
      myPetAnimal = 'bear';
      myOwnerName = '';
      myRoom = '';
    }

    // Firestoreにユーザー情報を登録
    await db.collection('users').doc(myUserId).set({
      petName: myPetName,
      petColor: myPetColor,
      petAnimal: myPetAnimal,
      ownerName: myOwnerName,
      room: myRoom,
      lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // ローカルの送信済みを復元
    const savedSent = localStorage.getItem('postpet_sent');
    if (savedSent) {
      MAIL_STORE.sent = JSON.parse(savedSent);
    }

    // 受信メールをリアルタイムリッスン
    startInboxListener();

    // ウェルカムメールチェック
    const welcomed = localStorage.getItem('postpet_welcomed_' + myUserId);
    if (!welcomed) {
      await db.collection('users').doc(myUserId).collection('inbox').add({
        from: myPetName,
        fromPetName: myPetName,
        fromPetColor: myPetColor,
        to: 'あなた',
        room: myRoom,
        subject: 'はじめまして！',
        body: 'はじめまして！ ぼくは ' + myPetName + 'だよ。\nきょうから いっしょに くらそうね。\n\nメールを おくると、ぼくが とどけにいくよ！\nおやつも ちょうだいね 🍰',
        date: new Date().toISOString(),
        read: false,
        fromPet: true,
      });
      localStorage.setItem('postpet_welcomed_' + myUserId, 'true');
    }

    // 自分のIDを表示（友達に教える用）
    renderMyId();
    // ユーザーリストを取得してプルダウンに表示
    loadUserList();
    renderMailList();

  } catch (err) {
    console.error('Firebase初期化エラー:', err);
    showToast('⚠️ オンライン接続に失敗しました');
  }
}

// 受信メールのリアルタイムリッスン
function startInboxListener() {
  if (unsubInbox) unsubInbox(); // 既存リスナー解除

  unsubInbox = db.collection('users').doc(myUserId).collection('inbox')
    .orderBy('date', 'desc')
    .limit(50)
    .onSnapshot((snapshot) => {
      // メールリスト更新
      MAIL_STORE.inbox = [];
      snapshot.forEach((doc) => {
        MAIL_STORE.inbox.push({ id: doc.id, ...doc.data() });
      });

      if (!inboxInitialized) {
        // 初回ロード完了
        inboxInitialized = true;
        console.log('[PostPet] 受信箱初期化完了:', MAIL_STORE.inbox.length, '件');
        renderMailList();
        return;
      }

      // 初回以降: 新着を検出
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const msg = change.doc.data();
          console.log('[PostPet] 新着検出:', msg.fromPetName, 'fromPet:', msg.fromPet);
          // 今のクラスルーム以外からのメールは演出・通知しない
          const sameRoom = !myRoom || msg.room === myRoom;
          if (!msg.fromPet && sameRoom) {
            showToast('📬 ' + (msg.fromPetName || msg.from) + 'が メールを とどけてきたよ！');
            console.log('[PostPet] visitorPetArrive呼び出し:', typeof visitorPetArrive);
            if (typeof visitorPetArrive === 'function') {
              visitorPetArrive(msg.fromPetColor, msg.fromPetName, () => {
                console.log('[PostPet] 訪問演出完了');
                if (typeof PET !== 'undefined') {
                  PET.reaction = '📨';
                  PET.reactionTimer = 50;
                }
              });
            }
          }
        }
      });

      renderMailList();
    });
}

// メール送信
async function sendMail() {
  const toEl = document.getElementById('mailTo');
  const bodyEl = document.getElementById('mailBody');
  const recipientId = toEl.value;
  const body = bodyEl.value.trim().slice(0, 500);

  if (!recipientId) { showToast('あて先を えらんでね'); return; }
  if (!body) { showToast('メッセージを かいてね'); return; }

  if (recipientId === myUserId) {
    showToast('じぶんには おくれないよ');
    return;
  }

  // 「みんなに送る」の場合
  if (recipientId === '__all__') {
    await sendMailToAll(body);
    toEl.selectedIndex = 0;
    bodyEl.value = '';
    return;
  }

  // 相手の情報を取得
  let recipientName = recipientId;
  try {
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    if (recipientDoc.exists) {
      recipientName = recipientDoc.data().petName || recipientId;
    }
  } catch (e) { /* ignore */ }

  const mailData = {
    from: myUserId,
    fromPetName: myPetName,
    fromPetColor: myPetColor,
    fromPetAnimal: myPetAnimal,
    fromOwnerName: myOwnerName,
    to: recipientId,
    toPetName: recipientName,
    room: myRoom,
    subject: body.substring(0, 20) + (body.length > 20 ? '...' : ''),
    body: body,
    date: new Date().toISOString(),
    read: false,
    fromPet: false,
  };

  // 配達アニメーション
  startDelivery(recipientName, async () => {
    try {
      // 相手のinboxに書き込み
      await db.collection('users').doc(recipientId).collection('inbox').add(mailData);

      // ローカルの送信済みに追加（最大50件でlocalStorage肥大を防ぐ）
      MAIL_STORE.sent.push({
        ...mailData,
        id: 'sent_' + Date.now(),
      });
      if (MAIL_STORE.sent.length > 50) MAIL_STORE.sent = MAIL_STORE.sent.slice(-50);
      localStorage.setItem('postpet_sent', JSON.stringify(MAIL_STORE.sent));

      renderMailList();
      showToast('📮 ' + myPetName + 'が とどけたよ！');
    } catch (err) {
      console.error('送信エラー:', err);
      showToast('⚠️ おくれなかった...');
    }
  });

  toEl.selectedIndex = 0;
  bodyEl.value = '';
}

// 今のクラスルームで表示する受信メールだけを返す。
// 自分のペットからのメール(fromPet)は常に表示。
// あいことば未設定(myRoom空)のときは全部表示（＝みんな見える仕様）。
// room未設定の過去メールは、別のクラスルームにいるときは隠す。
function visibleInbox() {
  return MAIL_STORE.inbox.filter((m) => {
    if (m.fromPet) return true;
    if (!myRoom) return true;
    return m.room === myRoom;
  });
}

// メールリスト描画
function renderMailList() {
  const list = document.getElementById('mailList');
  let items = [];

  if (currentTab === 'inbox') {
    items = visibleInbox();
  } else if (currentTab === 'sent') {
    items = MAIL_STORE.sent;
  } else if (currentTab === 'diary') {
    list.innerHTML = (typeof PET === 'undefined' || PET.diary.length === 0)
      ? '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3)">まだ にっきは ないよ</div>'
      : PET.diary.map(d => `
        <div class="mail-item">
          <div class="from">📔 ${esc(PET.name)}のにっき</div>
          <div class="subject">${esc(d.text)}</div>
          <div class="time">${esc(d.date)}</div>
        </div>
      `).join('');
    return;
  }

  if (items.length === 0) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3)">メールは ないよ</div>';
    return;
  }

  list.innerHTML = items.map((m, i) => {
    const ownerPrefix = m.fromOwnerName ? m.fromOwnerName + 'さんの' : '';
    const displayFrom = m.fromPet ? ('🧸 ' + (m.fromPetName || m.from))
      : ('💌 ' + ownerPrefix + (m.fromPetName || m.from));
    const displayTo = m.toPetName || m.to;
    const dateStr = m.date ? new Date(m.date).toLocaleString('ja-JP') : '';
    const label = currentTab === 'sent'
      ? displayTo + 'さんへ'
      : displayFrom + 'から';

    return `
      <div class="mail-item ${!m.read ? 'unread' : ''}" onclick="openMail('${currentTab}',${i})">
        <div class="from">${esc(label)}</div>
        <div class="subject">${esc(m.subject)}</div>
        <div class="time">${esc(dateStr)}</div>
      </div>
    `;
  }).join('');
}

// メール開封
async function openMail(tab, index) {
  const items = tab === 'inbox' ? visibleInbox() : MAIL_STORE.sent;
  const mail = items[index];
  if (!mail) return;

  // 既読にする（Firestoreも更新）
  if (!mail.read && tab === 'inbox' && mail.id) {
    mail.read = true;
    try {
      await db.collection('users').doc(myUserId).collection('inbox').doc(mail.id).update({ read: true });
    } catch (e) { /* ignore */ }
  }

  const fromLabel = mail.fromPet ? '🧸' : '💌';
  const fromName = mail.fromPetName || mail.from;
  const dateStr = mail.date ? new Date(mail.date).toLocaleString('ja-JP') : '';

  const el = document.getElementById('diaryContent');
  const petColor = safeColor(mail.fromPetColor);
  el.innerHTML = `
    <p style="margin-bottom:4px;font-size:18px"><strong>${esc(fromLabel)} ${esc(fromName)}さんから</strong></p>
    ${petColor ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${petColor};margin-right:4px;vertical-align:middle;"></span>` : ''}
    <p style="font-size:14px;color:#a0855a;margin-bottom:10px">${esc(dateStr)}</p>
    <p style="white-space:pre-wrap;font-size:16px">${esc(mail.body)}</p>
  `;
  document.querySelector('.diary-card h3').textContent = '📮 メール';
  document.getElementById('diaryOverlay').classList.add('show');
  renderMailList();
}

function switchTab(tab, btn) {
  currentTab = tab;
  document.querySelectorAll('.mail-tabs button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMailList();
}

// 自分のIDを表示（友達に教える用）
function renderMyId() {
  const compose = document.querySelector('.compose-area');
  if (!compose || !myUserId) return;

  // 既に追加済みなら何もしない
  if (document.getElementById('myIdDisplay')) return;

  const animalEmoji = myPetAnimal === 'cat' ? '🐱' : myPetAnimal === 'dog' ? '🐶' : '🐻';
  const ownerLabel = myOwnerName ? myOwnerName + 'さんの' : '';

  const div = document.createElement('div');
  div.id = 'myIdDisplay';
  div.style.cssText = 'padding:8px 0;font-size:14px;color:rgba(255,255,255,0.5);text-align:center;';
  div.innerHTML = animalEmoji + ' <strong style="color:rgba(255,255,255,0.8)">' + esc(ownerLabel + myPetName) + '</strong>';
  compose.insertBefore(div, compose.firstChild);
}

// ユーザーリストを取得してプルダウンに表示（同じクラスルームのみ）
function loadUserList() {
  // クラスルームが設定されている場合はフィルタリング
  let query = db.collection('users');
  if (myRoom) {
    query = query.where('room', '==', myRoom);
  }

  query.onSnapshot((snapshot) => {
    const select = document.getElementById('mailTo');
    // 現在の選択値を保持
    const currentVal = select.value;
    // オプションをリセット（最初のplaceholderは残す）
    select.innerHTML = '<option value="" disabled selected>あて先を えらんでね</option>';
    // 「みんなに送る」オプション
    const allOpt = document.createElement('option');
    allOpt.value = '__all__';
    allOpt.textContent = '📢 みんなに おくる';
    allOpt.style.fontSize = '18px';
    select.appendChild(allOpt);
    snapshot.forEach((doc) => {
      if (doc.id === myUserId) return; // 自分は除外
      const data = doc.data();
      const animalEmoji = data.petAnimal === 'cat' ? '🐱' : data.petAnimal === 'dog' ? '🐶' : '🐻';
      const ownerLabel = data.ownerName ? data.ownerName + 'さんの' : '';
      const opt = document.createElement('option');
      opt.value = doc.id;
      opt.textContent = animalEmoji + ' ' + ownerLabel + (data.petName || '???');
      opt.style.fontSize = '18px';
      select.appendChild(opt);
    });
    // 選択値を復元
    if (currentVal) select.value = currentVal;

    // クラスルーム情報を表示
    updateRoomInfo(snapshot.size - 1); // 自分を除いた人数
  });
}

// クラスルーム情報表示
function updateRoomInfo(memberCount) {
  let infoEl = document.getElementById('roomInfo');
  if (!infoEl) {
    infoEl = document.createElement('div');
    infoEl.id = 'roomInfo';
    infoEl.style.cssText = 'padding:6px 0;font-size:14px;color:rgba(255,255,255,0.5);text-align:center;';
    const compose = document.querySelector('.compose-area');
    const myIdEl = document.getElementById('myIdDisplay');
    if (myIdEl) {
      myIdEl.after(infoEl);
    } else if (compose) {
      compose.insertBefore(infoEl, compose.firstChild);
    }
  }
  if (myRoom) {
    infoEl.innerHTML = '🏠 あいことば: <strong style="color:rgba(255,255,255,0.8)">' + esc(myRoom) + '</strong> (' + memberCount + '人)';
  } else {
    infoEl.innerHTML = '⚠️ あいことばが ないので、みんなが みえるよ';
  }
}

// みんなに送る
async function sendMailToAll(body) {
  // 同じクラスルームのユーザーを取得
  let query = db.collection('users');
  if (myRoom) {
    query = query.where('room', '==', myRoom);
  }

  const snapshot = await query.get();
  const recipients = [];
  snapshot.forEach((doc) => {
    if (doc.id !== myUserId) recipients.push(doc.id);
  });

  if (recipients.length === 0) {
    showToast('おくる あいてが いないよ');
    return;
  }

  const mailData = {
    from: myUserId,
    fromPetName: myPetName,
    fromPetColor: myPetColor,
    fromPetAnimal: myPetAnimal,
    fromOwnerName: myOwnerName,
    toPetName: 'みんな',
    room: myRoom,
    subject: body.substring(0, 20) + (body.length > 20 ? '...' : ''),
    body: body,
    date: new Date().toISOString(),
    read: false,
    fromPet: false,
  };

  // 配達アニメーション
  startDelivery('みんな', async () => {
    try {
      // 全員のinboxに書き込み
      const batch = db.batch();
      recipients.forEach((uid) => {
        const ref = db.collection('users').doc(uid).collection('inbox').doc();
        batch.set(ref, { ...mailData, to: uid });
      });
      await batch.commit();

      // ローカルの送信済みに追加（最大50件でlocalStorage肥大を防ぐ）
      MAIL_STORE.sent.push({
        ...mailData,
        to: '__all__',
        id: 'sent_' + Date.now(),
      });
      if (MAIL_STORE.sent.length > 50) MAIL_STORE.sent = MAIL_STORE.sent.slice(-50);
      localStorage.setItem('postpet_sent', JSON.stringify(MAIL_STORE.sent));

      renderMailList();
      showToast('📮 ' + myPetName + 'が みんなに とどけたよ！（' + recipients.length + '人）');
    } catch (err) {
      console.error('一斉送信エラー:', err);
      showToast('⚠️ おくれなかった...');
    }
  });
}

// ペットが勝手にメールを送る（ポストペットの特徴的機能）
async function petSendsSpontaneousMail() {
  if (!myUserId) return;

  const messages = [
    'きょうの おやつは おいしかったな〜。もっと ほしいな。',
    'さいきん おさんぽ してないな... おそと いきたいな。',
    'ぼくの おへやの ラグ、ふかふかで すきなんだ。',
    'まどの そとに くもが みえたよ。おおきかった！',
    'ほんだなの ほん、よめないけど いろが きれいだった。',
  ];

  const mailData = {
    from: myUserId,
    fromPetName: myPetName,
    fromPetColor: myPetColor,
    to: 'あなた',
    room: myRoom,
    subject: myPetName + 'からの おてがみ',
    body: messages[Math.floor(Math.random() * messages.length)],
    date: new Date().toISOString(),
    read: false,
    fromPet: true,
  };

  try {
    await db.collection('users').doc(myUserId).collection('inbox').add(mailData);
    showToast('📮 ' + myPetName + 'から おてがみが きたよ！');
    if (typeof PET !== 'undefined') {
      PET.reaction = '✉️';
      PET.reactionTimer = 40;
    }
  } catch (e) { /* ignore */ }
}

// 45秒ごとに15%の確率でペットが勝手にメールを送る（平均5分に1通くらい）
setInterval(() => {
  if (typeof PET !== 'undefined' && Math.random() < 0.15 && !PET.delivering) {
    petSendsSpontaneousMail();
  }
}, 45000);

// mail.js — Firebase Firestoreベースのリアルメッセージングシステム
// ペットが配達する演出付き。実際に他のユーザーとメッセージを送り合える。

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
      myRoom = cfg.room || '';
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
          if (!msg.fromPet) {
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
  const body = bodyEl.value.trim();

  if (!recipientId) { showToast('あて先を えらんでね'); return; }
  if (!body) { showToast('メッセージを かいてね'); return; }

  // 相手の情報を取得
  let recipientName = recipientId;
  try {
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    if (recipientDoc.exists) {
      recipientName = recipientDoc.data().petName || recipientId;
    }
  } catch (e) { /* ignore */ }

  if (recipientId === myUserId) {
    showToast('じぶんには おくれないよ');
    return;
  }

  const mailData = {
    from: myUserId,
    fromPetName: myPetName,
    fromPetColor: myPetColor,
    fromPetAnimal: myPetAnimal,
    fromOwnerName: myOwnerName,
    to: recipientId,
    toPetName: recipientName,
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

      // ローカルの送信済みに追加
      MAIL_STORE.sent.push({
        ...mailData,
        id: 'sent_' + Date.now(),
      });
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

// メールリスト描画
function renderMailList() {
  const list = document.getElementById('mailList');
  let items = [];

  if (currentTab === 'inbox') {
    items = MAIL_STORE.inbox;
  } else if (currentTab === 'sent') {
    items = MAIL_STORE.sent;
  } else if (currentTab === 'diary') {
    list.innerHTML = (typeof PET === 'undefined' || PET.diary.length === 0)
      ? '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.3)">まだ にっきは ないよ</div>'
      : PET.diary.map(d => `
        <div class="mail-item">
          <div class="from">📔 ${PET.name}のにっき</div>
          <div class="subject">${d.text}</div>
          <div class="time">${d.date}</div>
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
        <div class="from">${label}</div>
        <div class="subject">${m.subject}</div>
        <div class="time">${dateStr}</div>
      </div>
    `;
  }).join('');
}

// メール開封
async function openMail(tab, index) {
  const items = tab === 'inbox' ? MAIL_STORE.inbox : MAIL_STORE.sent;
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
  el.innerHTML = `
    <p style="margin-bottom:4px;font-size:18px"><strong>${fromLabel} ${fromName}さんから</strong></p>
    ${mail.fromPetColor ? `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${mail.fromPetColor};margin-right:4px;vertical-align:middle;"></span>` : ''}
    <p style="font-size:14px;color:#a0855a;margin-bottom:10px">${dateStr}</p>
    <p style="white-space:pre-wrap;font-size:16px">${mail.body}</p>
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
  div.innerHTML = animalEmoji + ' <strong style="color:rgba(255,255,255,0.8)">' + ownerLabel + myPetName + '</strong>';
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
    infoEl.innerHTML = '🏠 クラスルーム: <strong style="color:rgba(255,255,255,0.8)">' + myRoom + '</strong> (' + memberCount + '人)';
  } else {
    infoEl.innerHTML = '⚠️ あいことばが ないので、みんなが みえるよ';
  }
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

// 30秒〜2分のランダム間隔でペットが勝手にメールを送る
setInterval(() => {
  if (typeof PET !== 'undefined' && Math.random() < 0.3 && !PET.delivering) {
    petSendsSpontaneousMail();
  }
}, 45000);

// room.js — Three.jsによる3Dペットの部屋
// ローポリ＋パステルカラーでポストペット風の部屋を構築

let scene, camera, renderer, roomGroup, petMesh, petGroup;
let roomW, roomH;
const ROOM_SIZE = 6;
const WALL_HEIGHT = 3.5;

// Three.jsモジュールはCDNからimportmap経由で読み込み
// → index.htmlの<script type="importmap">で定義


function initRoom() {
  const container = document.querySelector('.room-area');
  roomW = container.clientWidth;
  roomH = container.clientHeight;

  // シーン
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd4e6f1);

  // カメラ（斜め上45度から見下ろし）
  camera = new THREE.PerspectiveCamera(44, roomW / roomH, 0.1, 100);
  camera.position.set(4.9, 4.2, 4.9);
  camera.lookAt(0, 0.5, 0);

  // レンダラー
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(roomW, roomH);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // 既存canvasを置き換え
  const oldCanvas = document.getElementById('roomCanvas');
  oldCanvas.replaceWith(renderer.domElement);
  renderer.domElement.id = 'roomCanvas';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  // ライト
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff5e0, 0.8);
  sun.position.set(4, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 20;
  sun.shadow.camera.left = -6;
  sun.shadow.camera.right = 6;
  sun.shadow.camera.top = 6;
  sun.shadow.camera.bottom = -6;
  scene.add(sun);

  // 部屋を構築
  roomGroup = new THREE.Group();
  buildRoom();
  scene.add(roomGroup);

  // ペットを構築
  petGroup = new THREE.Group();
  buildPet3D();
  scene.add(petGroup);

  // リサイズ
  window.addEventListener('resize', onResize);

  // クリック（レイキャスト）
  renderer.domElement.addEventListener('click', onRoomClick3D);

  // アニメーションループ
  animate();
}


function buildRoom() {
  const S = ROOM_SIZE;
  const H = WALL_HEIGHT;

  // 床
  const floorGeo = new THREE.PlaneGeometry(S, S);
  const floorMat = new THREE.MeshLambertMaterial({ color: 0xd4a574 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.name = 'floor';
  roomGroup.add(floor);

  // フローリング線
  for (let i = -S/2 + 0.5; i < S/2; i += 0.5) {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-S/2, 0.005, i),
      new THREE.Vector3(S/2, 0.005, i)
    ]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xc49464 }));
    roomGroup.add(line);
  }

  // 奥の壁（Z=-3）— 1枚の壁
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf8e8d4 });
  const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(S, H), wallMat);
  wallBack.position.set(0, H/2, -S/2);
  roomGroup.add(wallBack);

  // 左の壁（X=-3）— ドア穴を開けるため4分割
  const doorZ = 0.5;
  const doorHalfW = 0.5;
  const doorH = 2.2;
  // ドアの左側
  const wallLeftL = new THREE.Mesh(
    new THREE.PlaneGeometry(S/2 - doorHalfW - doorZ + S/2, H),
    wallMat.clone()
  );
  wallLeftL.position.set(-S/2, H/2, -(S/2 - (S/2 - doorHalfW - doorZ + S/2)/2 + doorZ + doorHalfW - S/2)/2);
  wallLeftL.rotation.y = Math.PI / 2;
  // 簡易: ドアの左・右・上の3パーツで壁を構成
  // 左パーツ（z = -3 ~ 0）
  const wLL = new THREE.Mesh(new THREE.PlaneGeometry(S/2 + doorZ - doorHalfW, H), wallMat.clone());
  wLL.position.set(-S/2, H/2, -(S/2 - (S/2 + doorZ - doorHalfW))/2 - (S/2 + doorZ - doorHalfW)/2 + (S/2 + doorZ - doorHalfW)/2 - S/2 + (S/2 + doorZ - doorHalfW)/2);
  // これは複雑すぎるので、シンプルに3パーツで
  const leftOfDoor = S/2 + (doorZ - doorHalfW); // -3 ~ 0 = 3m
  const rightOfDoor = S/2 - (doorZ + doorHalfW); // 1 ~ 3 = 2m
  const aboveDoor = H - doorH; // 3.5 - 2.2 = 1.3m

  // ドアの左側の壁
  const wL1 = new THREE.Mesh(new THREE.PlaneGeometry(leftOfDoor, H), wallMat.clone());
  wL1.position.set(-S/2, H/2, -S/2 + leftOfDoor/2);
  wL1.rotation.y = Math.PI / 2;
  roomGroup.add(wL1);
  // ドアの右側の壁
  const wL2 = new THREE.Mesh(new THREE.PlaneGeometry(rightOfDoor, H), wallMat.clone());
  wL2.position.set(-S/2, H/2, doorZ + doorHalfW + rightOfDoor/2);
  wL2.rotation.y = Math.PI / 2;
  roomGroup.add(wL2);
  // ドアの上の壁
  const wL3 = new THREE.Mesh(new THREE.PlaneGeometry(doorHalfW * 2, aboveDoor), wallMat.clone());
  wL3.position.set(-S/2, doorH + aboveDoor/2, doorZ);
  wL3.rotation.y = Math.PI / 2;
  roomGroup.add(wL3);

  // 巾木（壁の下端）
  const baseGeo = new THREE.BoxGeometry(S, 0.12, 0.05);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const baseBack = new THREE.Mesh(baseGeo, baseMat);
  baseBack.position.set(0, 0.06, -S/2 + 0.025);
  roomGroup.add(baseBack);
  const baseLeft = new THREE.Mesh(baseGeo, baseMat);
  baseLeft.position.set(-S/2 + 0.025, 0.06, 0);
  baseLeft.rotation.y = Math.PI / 2;
  roomGroup.add(baseLeft);

  // 窓（奥の壁）1.5倍サイズ
  buildWindow(0, 1.8, -S/2 + 0.01, 0);

  // 掛け時計（奥の壁、窓の右側）
  buildClock(1.8, 2.2, -S/2 + 0.02);

  // ドア（左の壁）
  buildDoor(-S/2 + 0.01, 0, 0.5);

  // 日めくりカレンダー（左の壁、ドアの上）
  buildCalendar(-S/2 + 0.02, 2.0, 1.8);

  // 家具
  buildShelf(-2.2, 0, -S/2 + 0.3);
  buildLamp(1.8, 0, -S/2 + 0.5);
  buildRug(0, 0.01, 0.5);
  buildPlant(S/2 - 0.6, 0, -S/2 + 0.6);
  buildBowl(-1.5, 0, 1.5);
  // ボールは「遊ぶ」モード時のみ出現するため、家具としては置かない
}


let windowGlass = null;
let windowSky = null;
function buildWindow(x, y, z, rotY) {
  // 窓の空（壁の手前に配置）
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x87ceeb });
  windowSky = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.5), skyMat);
  windowSky.position.set(x, y, z + 0.01);
  roomGroup.add(windowSky);
  // 枠（4本の棒で額縁を作る）
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  // 上枠
  const fTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.06), frameMat);
  fTop.position.set(x, y + 0.81, z + 0.03); roomGroup.add(fTop);
  // 下枠
  const fBot = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.12, 0.06), frameMat);
  fBot.position.set(x, y - 0.81, z + 0.03); roomGroup.add(fBot);
  // 左枠
  const fLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.74, 0.06), frameMat);
  fLeft.position.set(x - 1.14, y, z + 0.03); roomGroup.add(fLeft);
  // 右枠
  const fRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.74, 0.06), frameMat);
  fRight.position.set(x + 1.14, y, z + 0.03); roomGroup.add(fRight);
  // ガラス（薄い半透明）
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 });
  windowGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.5), glassMat);
  windowGlass.position.set(x, y, z + 0.02);
  roomGroup.add(windowGlass);
  // 桟（十字）
  const barMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const barH = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.04, 0.04), barMat);
  barH.position.set(x, y, z + 0.06);
  roomGroup.add(barH);
  const barV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.04), barMat);
  barV.position.set(x, y, z + 0.06);
  roomGroup.add(barV);
}

// 掛け時計（実時刻で針が動く）
let clockHourHand, clockMinHand, clockSecHand;

function buildClock(x, y, z) {
  // 文字盤（白い円）
  const faceMat = new THREE.MeshLambertMaterial({ color: 0xfff8f0 });
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.25, 24), faceMat);
  face.position.set(x, y, z);
  roomGroup.add(face);
  // 枠（茶色リング）
  const rimMat = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.23, 0.27, 24), rimMat);
  rim.position.set(x, y, z + 0.005);
  roomGroup.add(rim);
  // 目盛り（12個の点）
  const dotMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.015, 6), dotMat);
    dot.position.set(x + Math.cos(angle) * 0.19, y + Math.sin(angle) * 0.19, z + 0.008);
    roomGroup.add(dot);
  }
  // 時針
  const hourGeo = new THREE.PlaneGeometry(0.02, 0.12);
  hourGeo.translate(0, 0.06, 0);
  clockHourHand = new THREE.Mesh(hourGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
  clockHourHand.position.set(x, y, z + 0.01);
  roomGroup.add(clockHourHand);
  // 分針
  const minGeo = new THREE.PlaneGeometry(0.015, 0.17);
  minGeo.translate(0, 0.085, 0);
  clockMinHand = new THREE.Mesh(minGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
  clockMinHand.position.set(x, y, z + 0.012);
  roomGroup.add(clockMinHand);
  // 秒針
  const secGeo = new THREE.PlaneGeometry(0.006, 0.19);
  secGeo.translate(0, 0.095, 0);
  clockSecHand = new THREE.Mesh(secGeo, new THREE.MeshBasicMaterial({ color: 0xe74c3c }));
  clockSecHand.position.set(x, y, z + 0.014);
  roomGroup.add(clockSecHand);
  // 中心の丸
  const center = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), new THREE.MeshBasicMaterial({ color: 0x333333 }));
  center.position.set(x, y, z + 0.016);
  roomGroup.add(center);
}

function updateClock() {
  if (!clockHourHand) return;
  const now = new Date();
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  clockHourHand.rotation.z = -((h + m / 60) / 12) * Math.PI * 2;
  clockMinHand.rotation.z = -(m / 60) * Math.PI * 2;
  clockSecHand.rotation.z = -(s / 60) * Math.PI * 2;
}

// 日めくりカレンダー（Canvasテクスチャで日付を描画）
function buildCalendar(x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');

  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[now.getDay()];
  const weekColor = now.getDay() === 0 ? '#e74c3c' : now.getDay() === 6 ? '#3498db' : '#333';

  // 背景（白い紙）
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 128, 160);

  // 上部（赤帯＋月）
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(0, 0, 128, 36);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(month + '月', 64, 26);

  // 日付（大きく）
  ctx.fillStyle = '#222';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText(day, 64, 105);

  // 曜日
  ctx.fillStyle = weekColor;
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(weekday + 'ようび', 64, 140);

  // 穴（上部に2つ）
  ctx.fillStyle = '#ddd';
  ctx.beginPath();
  ctx.arc(35, 10, 5, 0, Math.PI * 2);
  ctx.arc(93, 10, 5, 0, Math.PI * 2);
  ctx.fill();

  // テクスチャ
  const texture = new THREE.CanvasTexture(canvas);
  const calMat = new THREE.MeshLambertMaterial({ map: texture });
  const cal = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.5625), calMat);
  cal.position.set(x, y, z);
  cal.rotation.y = Math.PI / 2;
  roomGroup.add(cal);

  // 影（少し浮いてる感）
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.08 });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.5625), shadowMat);
  shadow.position.set(x - 0.005, y - 0.01, z);
  shadow.rotation.y = Math.PI / 2;
  roomGroup.add(shadow);
}

let doorPivot = null; // ドア回転用

function buildDoor(x, y, z) {
  // ドア枠
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x8b7355 });
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), frameMat);
  frameL.position.set(x, 1.1, z - 0.5);
  roomGroup.add(frameL);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.08), frameMat);
  frameR.position.set(x, 1.1, z + 0.5);
  roomGroup.add(frameR);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.08), frameMat);
  frameTop.position.set(x, 2.2, z);
  roomGroup.add(frameTop);

  // ドア本体（ピボットで回転）
  doorPivot = new THREE.Group();
  doorPivot.position.set(x + 0.02, 0, z - 0.46); // ヒンジ位置（左端）

  // ドアの奥に外の景色（壁の外側に配置）
  const outsideX = x - 0.15;
  // 空
  const skyGeo = new THREE.PlaneGeometry(1.0, 2.2);
  const skyGrad = new THREE.MeshBasicMaterial({ color: 0x87ceeb });
  const sky = new THREE.Mesh(skyGeo, skyGrad);
  sky.position.set(outsideX, 1.1, z);
  sky.rotation.y = Math.PI / 2;
  roomGroup.add(sky);
  // 地面（緑）
  const groundGeo = new THREE.PlaneGeometry(1.0, 0.6);
  const groundMat = new THREE.MeshBasicMaterial({ color: 0x7ec850 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(outsideX, 0.3, z);
  ground.rotation.y = Math.PI / 2;
  roomGroup.add(ground);
  // 太陽
  const sunMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.08, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff176 })
  );
  sunMesh.position.set(outsideX - 0.01, 1.8, z + 0.2);
  sunMesh.rotation.y = Math.PI / 2;
  roomGroup.add(sunMesh);
  // 雲
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cloud1 = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), cloudMat);
  cloud1.position.set(outsideX - 0.01, 1.6, z - 0.15);
  cloud1.rotation.y = Math.PI / 2;
  roomGroup.add(cloud1);
  const cloud2 = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), cloudMat);
  cloud2.position.set(outsideX - 0.01, 1.62, z - 0.05);
  cloud2.rotation.y = Math.PI / 2;
  roomGroup.add(cloud2);

  const doorMat = new THREE.MeshLambertMaterial({ color: 0xc4956a });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.1), doorMat);
  door.position.set(0, 1.05, 0.46); // ピボットからのオフセット
  door.rotation.y = Math.PI / 2;
  doorPivot.add(door);

  // ドアの裏面
  const doorBack = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.1), doorMat);
  doorBack.position.set(0, 1.05, 0.46);
  doorBack.rotation.y = -Math.PI / 2;
  doorPivot.add(doorBack);

  // ドアノブ
  const knobMat = new THREE.MeshLambertMaterial({ color: 0xd4af37 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), knobMat);
  knob.position.set(0.06, 1.0, 0.76);
  doorPivot.add(knob);

  roomGroup.add(doorPivot);
}

// ドア開閉アニメーション
function animateDoor(open, callback) {
  if (!doorPivot) { if (callback) callback(); return; }
  const targetAngle = open ? -Math.PI / 2.5 : 0;
  const startAngle = doorPivot.rotation.y;
  const startTime = performance.now();
  const duration = 400;

  function tick(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const ease = t * t * (3 - 2 * t); // smoothstep
    doorPivot.rotation.y = startAngle + (targetAngle - startAngle) * ease;
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      doorPivot.rotation.y = targetAngle;
      if (callback) callback();
    }
  }
  requestAnimationFrame(tick);
}

function buildShelf(x, y, z) {
  const wood = new THREE.MeshLambertMaterial({ color: 0x8b6f47 });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0x6b5535 });
  const W = 0.9, H = 1.8, D = 0.3;
  // 側板
  const sideGeo = new THREE.BoxGeometry(0.04, H, D);
  [x - W/2, x + W/2].forEach(sx => {
    const s = new THREE.Mesh(sideGeo.clone(), wood); s.position.set(sx, H/2, z); s.castShadow = true; roomGroup.add(s);
  });
  // 天板＋底板
  const tbGeo = new THREE.BoxGeometry(W + 0.04, 0.04, D);
  [H, 0.02].forEach(ty => { const t = new THREE.Mesh(tbGeo.clone(), wood); t.position.set(x, ty, z); roomGroup.add(t); });
  // 背板
  const bk = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), woodDark);
  bk.position.set(x, H/2, z - D/2 + 0.01); roomGroup.add(bk);
  // 棚板3枚
  for (let i = 1; i <= 3; i++) {
    const sh = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.03, D - 0.02), wood);
    sh.position.set(x, i * (H / 4), z); roomGroup.add(sh);
  }
  // 本（まばらに、段によって量を変える）
  const cols = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0xe67e22, 0x1abc9c, 0xc0392b];
  const booksPerRow = [5, 3, 4, 2]; // 段ごとの本の数
  for (let row = 0; row < 4; row++) {
    const sy = row * (H / 4) + 0.03, maxH = (H / 4) - 0.06;
    const startX = x - W/2 + 0.08;
    const count = booksPerRow[row];
    for (let bi = 0; bi < count; bi++) {
      const bw = 0.05 + Math.random() * 0.04;
      const bh = maxH * (0.6 + Math.random() * 0.35);
      const bx = startX + bi * 0.1 + Math.random() * 0.03;
      const tilt = (Math.random() < 0.15) ? (Math.random() - 0.5) * 0.2 : 0;
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, D * 0.55), new THREE.MeshLambertMaterial({ color: cols[(row * 5 + bi) % cols.length] }));
      b.position.set(bx, sy + bh/2, z + 0.02);
      b.rotation.z = tilt;
      roomGroup.add(b);
    }
  }
}

function buildLamp(x, y, z) {
  // 支柱
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8),
    new THREE.MeshLambertMaterial({ color: 0x666666 })
  );
  pole.position.set(x, 0.6, z);
  pole.castShadow = true;
  roomGroup.add(pole);
  // シェード
  const shade = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.25, 8, 1, true),
    new THREE.MeshLambertMaterial({ color: 0xf5deb3, side: THREE.DoubleSide })
  );
  shade.position.set(x, 1.3, z);
  roomGroup.add(shade);
  // 光源
  const light = new THREE.PointLight(0xfff5c0, 0.5, 4);
  light.position.set(x, 1.2, z);
  scene.add(light);
}

function buildRug(x, y, z) {
  const rug = new THREE.Mesh(
    new THREE.CircleGeometry(1.2, 32),
    new THREE.MeshLambertMaterial({ color: 0xe8a0b0 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, y, z);
  roomGroup.add(rug);
  // 縁
  const border = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.2, 32),
    new THREE.MeshLambertMaterial({ color: 0xd4708a, side: THREE.DoubleSide })
  );
  border.rotation.x = -Math.PI / 2;
  border.position.set(x, y + 0.001, z);
  roomGroup.add(border);
}

function buildPlant(x, y, z) {
  // 鉢
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8),
    new THREE.MeshLambertMaterial({ color: 0xc0784a })
  );
  pot.position.set(x, 0.15, z);
  pot.castShadow = true;
  roomGroup.add(pot);
  // 葉
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x27ae60 });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.15, 6, 6), leafMat);
    leaf.position.set(
      x + Math.cos(angle) * 0.15,
      0.45 + Math.random() * 0.1,
      z + Math.sin(angle) * 0.15
    );
    leaf.scale.set(1, 0.6, 1);
    roomGroup.add(leaf);
  }
}

function buildBowl(x, y, z) {
  const bowl = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.12, 0.08, 16),
    new THREE.MeshLambertMaterial({ color: 0xe8a0b0 })
  );
  bowl.position.set(x, 0.04, z);
  roomGroup.add(bowl);
  // 中身
  const food = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.03, 16),
    new THREE.MeshLambertMaterial({ color: 0xd4708a })
  );
  food.position.set(x, 0.07, z);
  roomGroup.add(food);
}

function buildBall(x, y, z) {
  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 16, 16),
    new THREE.MeshLambertMaterial({ color: 0xe74c3c })
  );
  ball.position.set(x, 0.12, z);
  ball.castShadow = true;
  roomGroup.add(ball);
}


// ペット3Dモデル（ローポリのクマ「ミハル」）
let petEyeL = null, petEyeR = null;
let petWhiteL = null, petWhiteR = null;
function buildPet3D() {
  // セットアップから色と動物種類を読み取り
  let petColor = 0xffb347;
  let petAnimal = 'bear';
  const setup = localStorage.getItem('postpet_setup');
  if (setup) {
    const cfg = JSON.parse(setup);
    if (cfg.color) petColor = parseInt(cfg.color.replace('#', ''), 16);
    if (cfg.animal) petAnimal = cfg.animal;
  }
  // メインカラーから暗い色と明るい色を自動生成
  const r = (petColor >> 16) & 0xff, g = (petColor >> 8) & 0xff, b = petColor & 0xff;
  const darkColor = ((Math.max(0,r-30))<<16) | ((Math.max(0,g-30))<<8) | Math.max(0,b-30);

  const main = new THREE.MeshLambertMaterial({ color: petColor });
  const dark = new THREE.MeshLambertMaterial({ color: darkColor });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const blk = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const nose = new THREE.MeshLambertMaterial({ color: 0xe91e63 });

  // 体（小さめ）
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), main);
  body.position.y = 0.35; body.scale.set(1, 0.85, 0.9); body.castShadow = true;
  petGroup.add(body);
  // おなか（白）
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), white);
  belly.position.set(0, 0.33, 0.1); belly.scale.set(0.8, 0.75, 0.5);
  petGroup.add(belly);
  // 頭グループ（首振り・傾げ用）
  const headGroup = new THREE.Group();
  headGroup.position.y = 0.75;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), main);
  head.castShadow = true; headGroup.add(head);
  // マズル
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), white);
  muzzle.position.set(0, -0.08, 0.22); muzzle.scale.set(1, 0.7, 0.8);
  headGroup.add(muzzle);
  // 耳
  const earL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), main);
  earL.position.set(-0.22, 0.25, 0); headGroup.add(earL);
  const earR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), main);
  earR.position.set(0.22, 0.25, 0); headGroup.add(earR);
  const earInL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), dark);
  earInL.position.set(-0.22, 0.25, 0.05); headGroup.add(earInL);
  const earInR = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), dark);
  earInR.position.set(0.22, 0.25, 0.05); headGroup.add(earInR);
  // 白目
  const eyeWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
  petWhiteL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeWhite);
  petWhiteL.position.set(-0.1, 0.03, 0.27); petWhiteL.scale.set(0.7, 1.1, 0.25);
  headGroup.add(petWhiteL);
  petWhiteR = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeWhite);
  petWhiteR.position.set(0.1, 0.03, 0.27); petWhiteR.scale.set(0.7, 1.1, 0.25);
  headGroup.add(petWhiteR);
  // 黒目
  petEyeL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), blk);
  petEyeL.position.set(-0.1, 0.03, 0.28); petEyeL.scale.set(0.7, 1.1, 0.3);
  headGroup.add(petEyeL);
  petEyeR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), blk);
  petEyeR.position.set(0.1, 0.03, 0.28); petEyeR.scale.set(0.7, 1.1, 0.3);
  headGroup.add(petEyeR);
  // 鼻
  const noseM = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), nose);
  noseM.position.set(0, -0.05, 0.36); noseM.scale.set(1.2, 0.8, 1); headGroup.add(noseM);
  petGroup.add(headGroup);
  petGroup.userData.head = headGroup;
  // 手（縦長楕円＝ソーセージ型、Groupでピボット化）
  const armLGroup = new THREE.Group();
  armLGroup.position.set(-0.22, 0.4, 0.05);
  const armLMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), main);
  armLMesh.scale.set(0.9, 1.8, 0.9);
  armLMesh.position.y = -0.09;
  armLGroup.add(armLMesh);
  const armLTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), white);
  armLTip.position.y = -0.22;
  armLGroup.add(armLTip);
  armLGroup.rotation.z = -0.35;
  petGroup.add(armLGroup);
  const armRGroup = new THREE.Group();
  armRGroup.position.set(0.22, 0.4, 0.05);
  const armRMesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), main);
  armRMesh.scale.set(0.9, 1.8, 0.9);
  armRMesh.position.y = -0.09;
  armRGroup.add(armRMesh);
  const armRTip = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), white);
  armRTip.position.y = -0.22;
  armRGroup.add(armRTip);
  armRGroup.rotation.z = 0.35;
  petGroup.add(armRGroup);
  // 足（縦長楕円、少し太め）
  const legLGroup = new THREE.Group();
  legLGroup.position.set(-0.1, 0.15, 0.05);
  const legLMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), main);
  legLMesh.scale.set(1, 1.5, 1);
  legLMesh.position.y = -0.06;
  legLGroup.add(legLMesh);
  const legLTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), white);
  legLTip.position.y = -0.17;
  legLTip.scale.set(1.4, 0.7, 1.2);
  legLGroup.add(legLTip);
  petGroup.add(legLGroup);
  const legRGroup = new THREE.Group();
  legRGroup.position.set(0.1, 0.15, 0.05);
  const legRMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), main);
  legRMesh.scale.set(1, 1.5, 1);
  legRMesh.position.y = -0.06;
  legRGroup.add(legRMesh);
  const legRTip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), white);
  legRTip.position.y = -0.17;
  legRTip.scale.set(1.4, 0.7, 1.2);
  legRGroup.add(legRTip);
  petGroup.add(legRGroup);

  // 手足グループを保存（歩行アニメーション用）
  petGroup.userData.armL = armLGroup;
  petGroup.userData.armR = armRGroup;
  petGroup.userData.legL = legLGroup;
  petGroup.userData.legR = legRGroup;

  petGroup.position.set(0, 0, 0.5);
}


// アニメーションループ
function animate() {
  requestAnimationFrame(animate);

  // ペットの移動（3D空間内）
  if (petGroup && typeof PET !== 'undefined') {
    // PET.x/y (0-1) → 3D座標 (-2.5 ~ 2.5)
    const tx = (PET.targetX - 0.5) * 5;
    const tz = (PET.targetY - 0.5) * 5;
    const dx = tx - petGroup.position.x;
    const dz = tz - petGroup.position.z;

    // ポーズ中は移動しない
    const posing = PET.state === 'lyingOnRug' || PET.state === 'sitting' || PET.state === 'hopping' || PET.state === 'stretch';

    if (!posing && (Math.abs(dx) > 0.05 || Math.abs(dz) > 0.05)) {
      petGroup.position.x += dx * 0.04;
      petGroup.position.z += dz * 0.04;
      // 進行方向を向く
      const angle = Math.atan2(dx, dz);
      petGroup.rotation.y += (angle - petGroup.rotation.y) * 0.1;
      PET.x += (PET.targetX - PET.x) * 0.04;
      PET.y += (PET.targetY - PET.y) * 0.04;
      // 歩行時の手足振り
      if (petGroup.userData.armL) {
        const swing = Math.sin(PET.bobPhase * 1.5) * 0.3;
        petGroup.userData.armL.rotation.x = swing;
        petGroup.userData.armR.rotation.x = -swing;
        petGroup.userData.legL.rotation.x = -swing * 0.5;
        petGroup.userData.legR.rotation.x = swing * 0.5;
      }
    } else {
      // なでなでモード中はバンザイ＋ジタバタ
      if (petGroup.userData.armL && typeof pettingMode !== 'undefined' && pettingMode) {
        const slow = Math.sin(PET.bobPhase * 2) * 0.15;
        // 腕をバンザイ（上に大きく振り上げ）＋ゆっくり揺れ
        petGroup.userData.armL.rotation.x = -1.5 + slow;
        petGroup.userData.armR.rotation.x = -1.5 - slow;
        petGroup.userData.armL.rotation.z = -0.4 + Math.sin(PET.bobPhase * 1.5) * 0.1;
        petGroup.userData.armR.rotation.z = 0.4 - Math.sin(PET.bobPhase * 1.5) * 0.1;
        // 足はゆっくりバタバタ
        petGroup.userData.legL.rotation.x = Math.sin(PET.bobPhase * 2.5) * 0.15;
        petGroup.userData.legR.rotation.x = -Math.sin(PET.bobPhase * 2.5) * 0.15;
      } else if (petGroup.userData.armL && !posing) {
        // 停止時は手足をデフォルトに戻す（ポーズ中はスキップ）
        petGroup.userData.armL.rotation.x *= 0.9;
        petGroup.userData.armR.rotation.x *= 0.9;
        petGroup.userData.armL.rotation.z += (-0.35 - petGroup.userData.armL.rotation.z) * 0.1;
        petGroup.userData.armR.rotation.z += (0.35 - petGroup.userData.armR.rotation.z) * 0.1;
        petGroup.userData.legL.rotation.x *= 0.9;
        petGroup.userData.legR.rotation.x *= 0.9;
        // ラグに到着したら座る or 寝る
        if (PET.state === 'idle' || PET.state === 'wander') {
          const onRug = Math.abs(petGroup.position.x - 0) < 0.8 && Math.abs(petGroup.position.z - 0.5) < 0.8;
          if (onRug && !playMode && Math.abs(dx) < 0.1 && Math.abs(dz) < 0.1) {
            PET.targetX = PET.x;
            PET.targetY = PET.y;
            if (Math.random() < 0.5) {
              PET.state = 'sitting';
              PET.stateTimer = 250;
              PET.reaction = '😊';
              PET.reactionTimer = 40;
            } else {
              PET.state = 'lyingOnRug';
              PET.stateTimer = 200;
              PET.reaction = '😴';
              PET.reactionTimer = 50;
            }
          }
        }
      }
    }

    // ボブ（上下揺れ）— ポーズ中は止める
    PET.bobPhase += 0.05;
    if (!posing) {
      petGroup.position.y = Math.sin(PET.bobPhase) * 0.03;
    }

    // 頭の動き（首振り・傾げ・ボール追従）
    if (petGroup.userData.head) {
      const h = petGroup.userData.head;
      if (playMode && throwBall && !playBallFlying) {
        // ボールを目で追う: 体をボール方向に向け、首で微調整
        const bx = throwBall.position.x - petGroup.position.x;
        const bz = throwBall.position.z - petGroup.position.z;
        const by = throwBall.position.y - 0.75;
        const lookAngle = Math.atan2(bx, bz);
        // 体をボール方向にゆっくり回す
        const bodyDiff = Math.atan2(Math.sin(lookAngle - petGroup.rotation.y), Math.cos(lookAngle - petGroup.rotation.y));
        petGroup.rotation.y += bodyDiff * 0.06;
        // 首は残りの差分（±30度以内）
        const remain = Math.atan2(Math.sin(lookAngle - petGroup.rotation.y), Math.cos(lookAngle - petGroup.rotation.y));
        const maxNeck = 0.52;
        const neckY = Math.max(-maxNeck, Math.min(maxNeck, remain));
        h.rotation.y += (neckY - h.rotation.y) * 0.15;
        // 上下
        const targetX = -Math.atan2(by, Math.sqrt(bx*bx + bz*bz));
        h.rotation.x += (targetX - h.rotation.x) * 0.15;
        h.rotation.z = 0;
      } else if (PET.state === 'idle' || PET.state === 'sitting') {
        // ゆっくり横を見る＋たまに首を傾げる
        h.rotation.y = Math.sin(PET.bobPhase * 0.4) * 0.25;
        h.rotation.z = Math.sin(PET.bobPhase * 0.25) * 0.1;
      } else {
        // 歩行中等は正面に戻す
        h.rotation.y *= 0.9;
        h.rotation.z *= 0.9;
      }
    }
  }

  renderer.render(scene, camera);

  // 時計の針を更新
  updateClock();

  // まばたき（3〜6秒ごとにランダム）
  if (petEyeL && petEyeR) {
    const t = Date.now() % 4000;
    if (t < 120) {
      const bt = t < 60 ? t / 60 : (120 - t) / 60;
      const sy = 1 - bt * 0.85;
      petEyeL.scale.y = 1.1 * sy;
      petEyeR.scale.y = 1.1 * sy;
      if (petWhiteL && petWhiteR) {
        petWhiteL.scale.y = 1.1 * sy;
        petWhiteR.scale.y = 1.1 * sy;
      }
    } else {
      petEyeL.scale.y = 1.1;
      petEyeR.scale.y = 1.1;
      if (petWhiteL && petWhiteR) {
        petWhiteL.scale.y = 1.1;
        petWhiteR.scale.y = 1.1;
      }
    }
  }

  // 窓の色を時刻で変える
  if (windowGlass) {
    const h = new Date().getHours();
    let skyColor, skyOpacity;
    if (h >= 6 && h < 8) { skyColor = 0xffb347; skyOpacity = 0.6; }
    else if (h >= 8 && h < 12) { skyColor = 0x5cb8e6; skyOpacity = 0.5; }
    else if (h >= 12 && h < 16) { skyColor = 0x4aa3d4; skyOpacity = 0.5; }
    else if (h >= 16 && h < 18) { skyColor = 0xff7043; skyOpacity = 0.6; }
    else if (h >= 18 && h < 20) { skyColor = 0x4a5080; skyOpacity = 0.7; }
    else { skyColor = 0x1a1a3e; skyOpacity = 0.8; }
    windowGlass.material.color.setHex(0xffffff);
    windowGlass.material.opacity = 0.1;
    // 窓の後ろの空も連動
    if (windowSky) windowSky.material.color.setHex(skyColor);
    // 背景色（ドアの隙間から見える空）も連動
    scene.background.setHex(skyColor);
  }

  // 自律ポーズアニメーション
  if (petGroup && petGroup.userData.armL && typeof PET !== 'undefined') {
    if (PET.state === 'lookWindow') {
      petGroup.userData.armR.rotation.x = -1.0 + Math.sin(PET.bobPhase * 1.5) * 0.1;
      petGroup.userData.armR.rotation.z = -0.3;
    } else if (PET.state === 'lyingOnRug') {
      // ゴロン（横向きに寝転がる）
      petGroup.position.y = -0.05;
      petGroup.rotation.z = 1.2;
    } else if (PET.state === 'stretch') {
      const st = Math.sin(PET.bobPhase * 2) * 0.1;
      petGroup.userData.armL.rotation.x = -1.8 + st;
      petGroup.userData.armR.rotation.x = -1.8 - st;
      petGroup.userData.armL.rotation.z = -0.3;
      petGroup.userData.armR.rotation.z = 0.3;
    } else if (PET.state === 'hopping') {
      // ゆっくり3回跳ねる＋腕を広げる
      const hop = Math.abs(Math.sin(PET.bobPhase * 1.5)) * 0.25;
      petGroup.position.y = hop;
      petGroup.userData.armL.rotation.z = -1.3;
      petGroup.userData.armR.rotation.z = 1.3;
      petGroup.userData.armL.rotation.x = -0.2;
      petGroup.userData.armR.rotation.x = -0.2;
    } else if (PET.state === 'sitting') {
      // 座る: 足を前に伸ばして、キョロキョロ
      petGroup.position.y = -0.05;
      petGroup.userData.legL.rotation.x = -1.57;
      petGroup.userData.legR.rotation.x = -1.57;
      petGroup.userData.legL.rotation.z = -0.25;
      petGroup.userData.legR.rotation.z = 0.25;
    }
  }
}

// リサイズ
function onResize() {
  const container = document.querySelector('.room-area');
  roomW = container.clientWidth;
  roomH = container.clientHeight;
  camera.aspect = roomW / roomH;
  camera.updateProjectionMatrix();
  renderer.setSize(roomW, roomH);
}

// 3Dクリック（レイキャスト → 床の交点を取得）
function onRoomClick3D(e) {
  if (typeof PET !== 'undefined' && PET.delivering) return;
  // ボール投げモード中・なでなでモード中は歩行させない
  if (playMode || pettingMode) return;

  // ポーズ中ならまず起き上がる
  if (typeof PET !== 'undefined') {
    const wasPosing = PET.state === 'lyingOnRug' || PET.state === 'sitting' || PET.state === 'hopping' || PET.state === 'stretch' || PET.state === 'lookWindow';
    if (wasPosing) {
      PET.state = 'idle';
      PET.stateTimer = 0;
      if (petGroup) {
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
    }
  }

  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  // 床との交差
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersection = new THREE.Vector3();
  raycaster.ray.intersectPlane(floorPlane, intersection);

  if (intersection) {
    const S = ROOM_SIZE / 2 - 0.5;
    const cx = Math.max(-S, Math.min(S, intersection.x));
    const cz = Math.max(-S, Math.min(S, intersection.z));
    // 3D座標 → PET座標 (0-1)
    if (typeof PET !== 'undefined') {
      PET.targetX = cx / 5 + 0.5;
      PET.targetY = cz / 5 + 0.5;
    }
  }
}

// drawRoom/drawPetは3D版では不要（互換用の空関数）
function drawRoom() {}
function drawPet() {}

// お風呂3D演出
let bathGroup = null;
let bubbles = [];
let bathAnimId = null;

function showBath3D() {
  if (bathGroup) { scene.remove(bathGroup); bathGroup = null; }
  bubbles = [];

  bathGroup = new THREE.Group();

  // 木桶（全周の丸い桶）
  const woodColor = new THREE.MeshLambertMaterial({ color: 0xc8956c });
  const woodDark = new THREE.MeshLambertMaterial({ color: 0xa07050 });
  // 桶の外壁
  const tubOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.38, 0.3, 20, 1, true), woodColor);
  tubOuter.position.y = 0.15;
  bathGroup.add(tubOuter);
  // 桶の内壁（少し小さく、暗い色）
  const tubInner = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.34, 0.28, 20, 1, true), woodDark);
  tubInner.position.y = 0.15;
  bathGroup.add(tubInner);
  // 底
  const tubBottom = new THREE.Mesh(
    new THREE.CircleGeometry(0.34, 20),
    woodDark
  );
  tubBottom.rotation.x = -Math.PI / 2;
  tubBottom.position.y = 0.01;
  bathGroup.add(tubBottom);
  // たが（桶の帯、2本）
  const bandMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const band1 = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.012, 8, 20), bandMat);
  band1.rotation.x = Math.PI / 2; band1.position.y = 0.08;
  bathGroup.add(band1);
  const band2 = new THREE.Mesh(new THREE.TorusGeometry(0.40, 0.012, 8, 20), bandMat);
  band2.rotation.x = Math.PI / 2; band2.position.y = 0.24;
  bathGroup.add(band2);
  // お湯（水色、半透明）
  const waterMat = new THREE.MeshLambertMaterial({ color: 0xadd8e6, transparent: true, opacity: 0.6 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.02, 20), waterMat);
  water.position.y = 0.25;
  bathGroup.add(water);

  // ペットの前に配置
  const bx = petGroup.position.x + 0.5;
  const bz = petGroup.position.z;
  bathGroup.position.set(bx, 0, bz);
  bathGroup.scale.set(0.01, 0.01, 0.01);
  scene.add(bathGroup);

  // ポップアニメーション
  const startTime = performance.now();
  function animPop(now) {
    const t = (now - startTime) / 300;
    if (t < 1) {
      const s = t * t * (3 - 2 * t);
      bathGroup.scale.set(s, s, s);
      requestAnimationFrame(animPop);
    } else {
      bathGroup.scale.set(1, 1, 1);
      // ペットをお風呂に向かわせる
      PET.targetX = (bx / 5) + 0.5;
      PET.targetY = (bz / 5) + 0.5;
      // 到着したらお風呂に入る
      setTimeout(() => petEnterBath(), 1500);
    }
  }
  requestAnimationFrame(animPop);
}

function petEnterBath() {
  if (!petGroup || !bathGroup) return;
  // まずペットを桶の真上に移動させる
  const bx = bathGroup.position.x;
  const bz = bathGroup.position.z;
  petGroup.position.x = bx;
  petGroup.position.z = bz;
  PET.x = (bx / 5) + 0.5;
  PET.y = (bz / 5) + 0.5;
  PET.targetX = PET.x;
  PET.targetY = PET.y;
  // カメラ方向を向かせる
  const faceAngle = Math.atan2(
    camera.position.x - bx,
    camera.position.z - bz
  );
  petGroup.rotation.y = faceAngle;

  const startTime = performance.now();
  const origY = petGroup.position.y;
  const origRotX = petGroup.rotation.x;
  function sink(now) {
    const t = Math.min((now - startTime) / 700, 1);
    const ease = t * t * (3 - 2 * t);
    // 沈む（胴体が水面下に）
    petGroup.position.y = origY - ease * 0.22;
    // 少し顔を上に向ける
    petGroup.rotation.x = origRotX + ease * 0.25;
    // 体育座り: 足を前に曲げる＋腕を膝に乗せる
    if (petGroup.userData.legL) {
      petGroup.userData.legL.rotation.x = ease * 1.2;
      petGroup.userData.legR.rotation.x = ease * 1.2;
      petGroup.userData.armL.rotation.x = ease * 0.8;
      petGroup.userData.armR.rotation.x = ease * 0.8;
      petGroup.userData.armL.rotation.z = -ease * 0.5;
      petGroup.userData.armR.rotation.z = ease * 0.5;
    }
    if (t < 1) requestAnimationFrame(sink);
    else startBubbles();
  }
  requestAnimationFrame(sink);
}

function startBubbles() {
  // 泡＋シャワー水滴（3秒間）
  const bubbleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
  const dropMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5 });
  let elapsed = 0;
  let drops = [];

  function spawnBubble() {
    if (elapsed > 3000 || !bathGroup) {
      // 水滴を全部消す
      drops.forEach(d => scene.remove(d));
      drops = [];
      endBath();
      return;
    }
    const size = 0.02 + Math.random() * 0.03;
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 6), bubbleMat.clone());
    bubble.position.set(
      bathGroup.position.x + (Math.random() - 0.5) * 0.5,
      0.25,
      bathGroup.position.z + (Math.random() - 0.5) * 0.5
    );
    bubble.userData = { vy: 0.005 + Math.random() * 0.005, life: 0 };
    scene.add(bubble);
    bubbles.push(bubble);
    // シャワー水滴（上から落ちてくる）
    for (let i = 0; i < 3; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.01, 4, 4), dropMat.clone());
      drop.position.set(
        bathGroup.position.x + (Math.random() - 0.5) * 0.5,
        1.2 + Math.random() * 0.3,
        bathGroup.position.z + (Math.random() - 0.5) * 0.5
      );
      drop.userData = { vy: -0.03 - Math.random() * 0.02 };
      scene.add(drop);
      drops.push(drop);
    }
    elapsed += 150;
    setTimeout(spawnBubble, 150);
  }
  spawnBubble();

  // 泡＋水滴のアニメーション
  function animBubbles() {
    bubbles.forEach((b, i) => {
      b.position.y += b.userData.vy;
      b.userData.life++;
      b.material.opacity = Math.max(0, 0.7 - b.userData.life * 0.02);
      if (b.userData.life > 35) {
        scene.remove(b);
        bubbles.splice(i, 1);
      }
    });
    // 水滴の落下
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.position.y += d.userData.vy;
      if (d.position.y < 0.25) {
        scene.remove(d);
        drops.splice(i, 1);
      }
    }
    if (bubbles.length > 0 || drops.length > 0 || elapsed <= 3000) {
      bathAnimId = requestAnimationFrame(animBubbles);
    }
  }
  bathAnimId = requestAnimationFrame(animBubbles);
}

function endBath() {
  // ペットを元の高さ＋姿勢に戻す
  if (petGroup) {
    const startTime = performance.now();
    const curY = petGroup.position.y;
    const curRotX = petGroup.rotation.x;
    function rise(now) {
      const t = Math.min((now - startTime) / 400, 1);
      const ease = t * t * (3 - 2 * t);
      petGroup.position.y = curY + ease * 0.22;
      petGroup.rotation.x = curRotX - ease * 0.25;
      // 手足を元に戻す
      if (petGroup.userData.legL) {
        petGroup.userData.legL.rotation.x *= (1 - ease);
        petGroup.userData.legR.rotation.x *= (1 - ease);
        petGroup.userData.armL.rotation.x *= (1 - ease);
        petGroup.userData.armR.rotation.x *= (1 - ease);
        petGroup.userData.armL.rotation.z *= (1 - ease);
        petGroup.userData.armR.rotation.z *= (1 - ease);
      }
      if (t < 1) requestAnimationFrame(rise);
    }
    requestAnimationFrame(rise);
  }
  // たらいを消す
  setTimeout(() => {
    if (bathGroup) { scene.remove(bathGroup); bathGroup = null; }
    // 残った泡を消す
    bubbles.forEach(b => scene.remove(b));
    bubbles = [];
    if (bathAnimId) cancelAnimationFrame(bathAnimId);
    // きらきらジャンプ
    petJump();
  }, 600);
}

// ボール投げモード
let playMode = false;
let throwBall = null;
let playBallFlying = false;
let playChaseInterval = null;
let playPickupTimer = null;
const BALL_HOME = new THREE.Vector3(1.2, 0.1, 1.8);

let ballDragging = false;
let ballDragStart = null;

function enterPlayMode() {
  if (PET.delivering) { showToast('ミハルは おでかけちゅう だよ'); return; }
  playMode = true;
  playBallFlying = false;
  ballDragging = false;
  document.querySelector('.room-area').style.cursor = 'crosshair';
  document.getElementById('playBanner').style.display = 'block';

  // ボールを床に出現させる
  if (throwBall) scene.remove(throwBall);
  const ballMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  throwBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), ballMat);
  throwBall.position.set(BALL_HOME.x, 0.1, BALL_HOME.z);
  throwBall.castShadow = true;
  scene.add(throwBall);

  renderer.domElement.addEventListener('click', onThrowClick);
  renderer.domElement.addEventListener('mousedown', onBallDragStart);
  renderer.domElement.addEventListener('mousemove', onBallDragMove);
  renderer.domElement.addEventListener('mouseup', onBallDragEnd);
  showToast('ボールをドラッグで揺らすか、床をクリックして投げよう！');
}

function exitPlayMode() {
  playMode = false;
  playBallFlying = false;
  ballDragging = false;
  if (playChaseInterval) { clearInterval(playChaseInterval); playChaseInterval = null; }
  if (playPickupTimer) { clearTimeout(playPickupTimer); playPickupTimer = null; }
  document.querySelector('.room-area').style.cursor = '';
  document.getElementById('playBanner').style.display = 'none';
  renderer.domElement.removeEventListener('click', onThrowClick);
  renderer.domElement.removeEventListener('mousedown', onBallDragStart);
  renderer.domElement.removeEventListener('mousemove', onBallDragMove);
  renderer.domElement.removeEventListener('mouseup', onBallDragEnd);
  if (throwBall) { scene.remove(throwBall); throwBall = null; }
}

function getFloorPoint(e) {
  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pt = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, pt);
  return pt;
}

function onBallDragStart(e) {
  if (!playMode || !throwBall || playBallFlying) return;
  const pt = getFloorPoint(e);
  if (!pt) return;
  const dx = pt.x - throwBall.position.x;
  const dz = pt.z - throwBall.position.z;
  if (Math.sqrt(dx*dx + dz*dz) < 0.5) {
    ballDragging = true;
    ballDragStart = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
}

function onBallDragMove(e) {
  if (!ballDragging || !throwBall) return;
  const pt = getFloorPoint(e);
  if (!pt) return;
  const S = ROOM_SIZE / 2 - 0.3;
  throwBall.position.x = Math.max(-S, Math.min(S, pt.x));
  throwBall.position.z = Math.max(-S, Math.min(S, pt.z));
  // マウスのY位置でボールの高さを変える（上に持ち上げる）
  const rect = renderer.domElement.getBoundingClientRect();
  const normY = 1 - (e.clientY - rect.top) / rect.height;
  throwBall.position.y = 0.1 + normY * 1.0;
}

function onBallDragEnd(e) {
  if (!ballDragging) return;
  ballDragging = false;
  if (throwBall) throwBall.position.y = 0.1;
}

function onThrowClick(e) {
  if (!playMode || typeof PET === 'undefined' || PET.delivering) return;
  // ドラッグ操作だった場合は投げない
  if (ballDragStart) { ballDragStart = null; return; }
  // ボールが飛行中（アニメーション中）は無視
  if (playBallFlying) return;

  // ポーズ中なら先に起き上がる
  const wasPosing = PET.state === 'lyingOnRug' || PET.state === 'sitting' || PET.state === 'hopping' || PET.state === 'stretch' || PET.state === 'lookWindow';
  if (wasPosing) {
    PET.state = 'idle';
    PET.stateTimer = 0;
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

  const rect = renderer.domElement.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top) / rect.height) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const target = new THREE.Vector3();
  raycaster.ray.intersectPlane(floorPlane, target);
  if (!target) return;

  // 前回の追跡を中断
  if (playChaseInterval) { clearInterval(playChaseInterval); playChaseInterval = null; }
  if (playPickupTimer) { clearTimeout(playPickupTimer); playPickupTimer = null; }

  // 前のボールがあれば手から外してシーンから消す
  if (throwBall) {
    if (petGroup.userData.armR) petGroup.userData.armR.remove(throwBall);
    scene.remove(throwBall);
    throwBall = null;
    // 腕をデフォルトに戻す
    if (petGroup.userData.armR) {
      petGroup.userData.armR.rotation.x = 0;
      petGroup.userData.armR.rotation.z = 0.35;
    }
  }
  const ballMat = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
  throwBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), ballMat);
  throwBall.position.set(petGroup.position.x, 0.1, petGroup.position.z + 0.3);
  throwBall.castShadow = true;
  scene.add(throwBall);

  const ballStart = throwBall.position.clone();
  const S = ROOM_SIZE / 2 - 0.3;

  // 投げる方向ベクトル（ペット→クリック地点）
  const throwDir = new THREE.Vector2(target.x - ballStart.x, target.z - ballStart.z);
  const throwLen = throwDir.length() || 1;

  // 壁との交差判定（レイキャスト的に最初にぶつかる壁を探す）
  let wallHitPoint = null;
  let wallNormal = null;
  const dx = throwDir.x / throwLen;
  const dz = throwDir.y / throwLen;

  // 4壁との交差距離を計算（正方向のみ）
  let minT = Infinity;
  // z = -S (奥壁)
  if (dz < -0.001) { const tt = (-S - ballStart.z) / dz; if (tt > 0 && tt < minT) { const hx = ballStart.x + dx * tt; if (hx >= -S && hx <= S) { minT = tt; wallHitPoint = new THREE.Vector3(hx, 0.1, -S); wallNormal = new THREE.Vector2(0, 1); } } }
  // x = -S (左壁)
  if (dx < -0.001) { const tt = (-S - ballStart.x) / dx; if (tt > 0 && tt < minT) { const hz = ballStart.z + dz * tt; if (hz >= -S && hz <= S) { minT = tt; wallHitPoint = new THREE.Vector3(-S, 0.1, hz); wallNormal = new THREE.Vector2(1, 0); } } }
  // z = +S (手前壁)
  if (dz > 0.001) { const tt = (S - ballStart.z) / dz; if (tt > 0 && tt < minT) { const hx = ballStart.x + dx * tt; if (hx >= -S && hx <= S) { minT = tt; wallHitPoint = new THREE.Vector3(hx, 0.1, S); wallNormal = new THREE.Vector2(0, -1); } } }
  // x = +S (右壁)
  if (dx > 0.001) { const tt = (S - ballStart.x) / dx; if (tt > 0 && tt < minT) { const hz = ballStart.z + dz * tt; if (hz >= -S && hz <= S) { minT = tt; wallHitPoint = new THREE.Vector3(S, 0.1, hz); wallNormal = new THREE.Vector2(-1, 0); } } }

  // クリック地点が壁の外 → 壁に当たって反射
  const clickOutside = Math.abs(target.x) > S || Math.abs(target.z) > S;
  const hitsWall = clickOutside && wallHitPoint;

  let wallTarget, bounceTarget;
  if (hitsWall) {
    wallTarget = wallHitPoint;
    // 入射ベクトルを壁法線で反射: r = d - 2(d·n)n
    const inDir = new THREE.Vector2(dx, dz);
    const dot = inDir.dot(wallNormal);
    const reflDir = new THREE.Vector2(inDir.x - 2 * dot * wallNormal.x, inDir.y - 2 * dot * wallNormal.y);
    // 反射後の距離（減衰）
    const reflDist = 1.2 + Math.random() * 0.8;
    bounceTarget = new THREE.Vector3(
      Math.max(-S, Math.min(S, wallTarget.x + reflDir.x * reflDist)),
      0.1,
      Math.max(-S, Math.min(S, wallTarget.z + reflDir.y * reflDist))
    );
  } else {
    wallTarget = target.clone();
    wallTarget.x = Math.max(-S, Math.min(S, wallTarget.x));
    wallTarget.z = Math.max(-S, Math.min(S, wallTarget.z));
    bounceTarget = null;
  }
  const finalTarget = bounceTarget || wallTarget;

  // 壁面クリック → 浮いた放物線で投げる
  const loftThrow = hitsWall;
  const loftHeight = loftThrow ? 0.8 : 0.05;

  const ball = throwBall;
  const startTime = performance.now();
  const duration = 600;
  playBallFlying = true;

  function animThrow(now) {
    // ボールが差し替えられた場合は中断
    if (ball !== throwBall) return;
    const t = Math.min((now - startTime) / duration, 1);
    if (bounceTarget) {
      if (t < 0.5) {
        const t2 = t / 0.5;
        ball.position.x = ballStart.x + (wallTarget.x - ballStart.x) * t2;
        ball.position.z = ballStart.z + (wallTarget.z - ballStart.z) * t2;
        // 壁に向かって放物線で浮く
        ball.position.y = 0.1 + Math.sin(t2 * Math.PI) * loftHeight;
      } else {
        const t2 = (t - 0.5) / 0.5;
        ball.position.x = wallTarget.x + (bounceTarget.x - wallTarget.x) * t2;
        ball.position.z = wallTarget.z + (bounceTarget.z - wallTarget.z) * t2;
        // 反射後は落ちてくる
        ball.position.y = 0.1 + (1 - t2) * loftHeight * 0.4 + Math.sin(t2 * Math.PI) * 0.15;
      }
    } else {
      ball.position.x = ballStart.x + (wallTarget.x - ballStart.x) * t;
      ball.position.z = ballStart.z + (wallTarget.z - ballStart.z) * t;
      ball.position.y = 0.1 + Math.sin(t * Math.PI) * loftHeight;
    }
    ball.rotation.x += 0.2;
    ball.rotation.z += 0.08;

    if (t < 1) {
      requestAnimationFrame(animThrow);
    } else {
      ball.position.y = 0.1;
      const bounceHeights = [0.25, 0.12, 0.05];
      const bounceDurations = [250, 200, 150];
      const bounceDrifts = [0.35, 0.18, 0.08];
      let bounceIdx = 0;

      // バウンスの転がり方向（壁反射時は反射方向、床投げ時は投げ方向）
      let dirX, dirZ;
      if (bounceTarget) {
        const rdx = bounceTarget.x - wallTarget.x;
        const rdz = bounceTarget.z - wallTarget.z;
        const rdist = Math.sqrt(rdx * rdx + rdz * rdz) || 1;
        dirX = rdx / rdist;
        dirZ = rdz / rdist;
      } else {
        const throwDx = finalTarget.x - ballStart.x;
        const throwDz = finalTarget.z - ballStart.z;
        const throwDist2 = Math.sqrt(throwDx * throwDx + throwDz * throwDz) || 1;
        dirX = throwDx / throwDist2;
        dirZ = throwDz / throwDist2;
      }

      function doBounce() {
        if (ball !== throwBall) return;
        if (bounceIdx >= bounceHeights.length) {
          ball.position.y = 0.1;
          // バウンス後の最終位置を追跡先に反映
          const landX = ball.position.x;
          const landZ = ball.position.z;
          finalTarget.x = landX;
          finalTarget.z = landZ;
          playBallFlying = false;

          // ミハルが追いかける
          PET.targetX = (landX / 5) + 0.5;
          PET.targetY = (landZ / 5) + 0.5;
          PET.state = 'play';
          PET.stateTimer = 80;
          PET.reaction = '❗';
          PET.reactionTimer = 30;

          playChaseInterval = setInterval(() => {
            if (ball !== throwBall) { clearInterval(playChaseInterval); playChaseInterval = null; return; }
            const dx = petGroup.position.x - finalTarget.x;
            const dz = petGroup.position.z - finalTarget.z;
            if (Math.abs(dx) < 0.4 && Math.abs(dz) < 0.4) {
              clearInterval(playChaseInterval);
              playChaseInterval = null;
              PET.reaction = '🎾';
              PET.reactionTimer = 50;
              PET.happy = Math.min(100, PET.happy + 8);
              PET.hunger = Math.max(0, PET.hunger - 3);
              if (typeof updateUI === 'function') updateUI();

              // ボールを右手に持って腕を上げる
              if (ball === throwBall && petGroup.userData.armR) {
                scene.remove(ball);
                ball.position.set(0, -0.25, 0);
                petGroup.userData.armR.add(ball);
                petGroup.userData.armR.rotation.x = -2.2;
                petGroup.userData.armR.rotation.z = 0;
              }
              petJump();

              playPickupTimer = setTimeout(() => {
                playPickupTimer = null;
                // ボールを床に戻す
                if (ball === throwBall && petGroup.userData.armR) {
                  petGroup.userData.armR.remove(ball);
                  scene.add(ball);
                  ball.position.set(petGroup.position.x + 0.3, 0.1, petGroup.position.z);
                  petGroup.userData.armR.rotation.x = 0;
                  petGroup.userData.armR.rotation.z = 0.35;
                }
                playBallFlying = false;
                PET.targetX = PET.x;
                PET.targetY = PET.y;
                PET.state = 'idle';
              }, 1200);
            }
          }, 100);
          return;
        }

        const h = bounceHeights[bounceIdx];
        const dur = bounceDurations[bounceIdx];
        const drift = bounceDrifts[bounceIdx];
        const bStart = performance.now();
        const bStartX = ball.position.x;
        const bStartZ = ball.position.z;
        // 転がり先を部屋の範囲内にクランプ
        const S = ROOM_SIZE / 2 - 0.3;
        const bEndX = Math.max(-S, Math.min(S, bStartX + dirX * drift));
        const bEndZ = Math.max(-S, Math.min(S, bStartZ + dirZ * drift));
        bounceIdx++;

        function animBounce(now2) {
          if (ball !== throwBall) return;
          const bt = Math.min((now2 - bStart) / dur, 1);
          ball.position.y = 0.1 + Math.sin(bt * Math.PI) * h;
          ball.position.x = bStartX + (bEndX - bStartX) * bt;
          ball.position.z = bStartZ + (bEndZ - bStartZ) * bt;
          ball.rotation.x += 0.08;
          if (bt < 1) {
            requestAnimationFrame(animBounce);
          } else {
            ball.position.y = 0.1;
            doBounce();
          }
        }
        requestAnimationFrame(animBounce);
      }
      doBounce();
    }
  }
  requestAnimationFrame(animThrow);
}

// おやつ3D演出
let snackMesh = null;
function showSnack3D() {
  if (snackMesh) { petGroup.remove(snackMesh); snackMesh = null; }

  // ペットをカメラ方向（正面）に向ける
  const faceAngle = Math.atan2(
    camera.position.x - petGroup.position.x,
    camera.position.z - petGroup.position.z
  );
  petGroup.rotation.y = faceAngle;
  // 移動を止めて正面を維持
  PET.targetX = PET.x;
  PET.targetY = PET.y;

  // ケーキをペットの手の横に配置（petGroupの子として追加）
  const group = new THREE.Group();
  const cake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.1, 0.07, 12),
    new THREE.MeshLambertMaterial({ color: 0xfff8dc })
  );
  cake.position.y = 0.035;
  group.add(cake);
  const cream = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.08, 0.03, 12),
    new THREE.MeshLambertMaterial({ color: 0xfffaf0 })
  );
  cream.position.y = 0.07;
  group.add(cream);
  const berry = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xe74c3c })
  );
  berry.position.set(0, 0.1, 0);
  group.add(berry);

  // 手の横（右手の位置）に配置
  group.position.set(0.4, 0.45, 0.15);
  group.scale.set(0.01, 0.01, 0.01);
  petGroup.add(group);
  snackMesh = group;

  // ポップアニメーション
  const startTime = performance.now();
  function animateSnack(now) {
    const t = (now - startTime) / 300;
    if (t < 1) {
      const s = t * t * (3 - 2 * t);
      group.scale.set(s, s, s);
      requestAnimationFrame(animateSnack);
    } else {
      group.scale.set(1, 1, 1);
      // 食べるアニメーション（2秒後に縮小して消える＋ジャンプ）
      setTimeout(() => {
        const eatStart = performance.now();
        function eatAnim(now2) {
          const et = Math.min((now2 - eatStart) / 400, 1);
          const s = 1 - et;
          group.scale.set(s, s, s);
          // 口に近づける
          group.position.y = 0.45 + et * 0.15;
          group.position.x = 0.4 - et * 0.3;
          if (et < 1) {
            requestAnimationFrame(eatAnim);
          } else {
            petGroup.remove(group);
            snackMesh = null;
            // 喜びリアクション
            PET.reaction = '💕';
            PET.reactionTimer = 60;
            petJump();
          }
        }
        requestAnimationFrame(eatAnim);
      }, 1500);
    }
  }
  requestAnimationFrame(animateSnack);
}

// 配達3D演出: ペットがドアに歩いて出ていく
let letterMesh = null;
function deliveryWalkToDoor(callback) {
  // 手紙を持たせる
  const letterGroup = new THREE.Group();
  const envelope = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.1, 0.02),
    new THREE.MeshLambertMaterial({ color: 0xfff8dc })
  );
  letterGroup.add(envelope);
  const seal = new THREE.Mesh(
    new THREE.CircleGeometry(0.025, 8),
    new THREE.MeshLambertMaterial({ color: 0xe74c3c })
  );
  seal.position.set(0, 0, 0.015);
  letterGroup.add(seal);
  letterGroup.position.set(0, 0.55, 0.25);
  petGroup.add(letterGroup);
  letterMesh = letterGroup;

  // ドアの位置（左の壁、z=0.5）
  const doorX = -ROOM_SIZE / 2 + 0.3;
  const doorZ = 0.5;
  PET.targetX = (doorX / 5) + 0.5;
  PET.targetY = (doorZ / 5) + 0.5;

  // ドアに到着したら消える
  const checkArrival = setInterval(() => {
    const dx = petGroup.position.x - doorX;
    const dz = petGroup.position.z - doorZ;
    if (Math.abs(dx) < 0.3 && Math.abs(dz) < 0.3) {
      clearInterval(checkArrival);
      // ドアを開ける→猫が壁の向こうに歩いて出ていく→ドアを閉める
      animateDoor(true, () => {
        // 壁の向こうに歩いていく
        const exitX = -ROOM_SIZE / 2 - 1.5;
        const startTime = performance.now();
        const startX = petGroup.position.x;
        const duration = 800;
        function walkOut(now) {
          const t = Math.min((now - startTime) / duration, 1);
          petGroup.position.x = startX + (exitX - startX) * t;
          if (t < 1) {
            requestAnimationFrame(walkOut);
          } else {
            petGroup.visible = false;
            petGroup.position.x = startX;
            if (letterMesh) { petGroup.remove(letterMesh); letterMesh = null; }
            animateDoor(false, () => {
              if (callback) callback();
            });
          }
        }
        requestAnimationFrame(walkOut);
      });
    }
  }, 100);
}

// 配達から帰ってくる演出
function deliveryReturn() {
  const doorX = -ROOM_SIZE / 2 + 0.3;
  const doorZ = 0.5;
  const outsideX = -ROOM_SIZE / 2 - 1.5;

  // 壁の外からスタート
  petGroup.position.set(outsideX, 0, doorZ);
  petGroup.scale.set(1, 1, 1);
  petGroup.visible = true;

  // ドアを開ける
  animateDoor(true, () => {
    // 部屋の中に歩いて入ってくる
    const startTime = performance.now();
    const duration = 800;
    function walkIn(now) {
      const t = Math.min((now - startTime) / duration, 1);
      petGroup.position.x = outsideX + (doorX - outsideX) * t;
      if (t < 1) {
        requestAnimationFrame(walkIn);
      } else {
        // ドアを閉める
        animateDoor(false, () => {
          // 部屋の中央に戻る
          PET.targetX = 0.5;
          PET.targetY = 0.6;
          petJump();
        });
      }
    }
    requestAnimationFrame(walkIn);
  });
}

// なでなでゴロン演出（仰向けでジタバタ）
let pettingAnim = false;
function petRollOver() {
  if (!petGroup || pettingAnim) return;
  pettingAnim = true;
  const startTime = performance.now();
  const origY = petGroup.position.y;
  const duration = 2500;

  function tick(now) {
    const t = (now - startTime) / duration;
    if (t >= 1) {
      // 元に戻す
      petGroup.rotation.x = 0;
      petGroup.rotation.z = 0;
      petGroup.position.y = origY;
      pettingAnim = false;
      return;
    }

    if (t < 0.15) {
      // ゴロンと倒れる（X軸回転で仰向けに）
      const p = t / 0.15;
      petGroup.rotation.x = p * (-Math.PI / 2.2);
      petGroup.position.y = origY + p * 0.05;
    } else if (t < 0.85) {
      // ジタバタ（手足をバタバタ＝Z軸で左右に揺れる）
      const jt = (t - 0.15) / 0.7;
      petGroup.rotation.x = -Math.PI / 2.2;
      petGroup.rotation.z = Math.sin(jt * Math.PI * 8) * 0.25;
      petGroup.position.y = origY + 0.05 + Math.sin(jt * Math.PI * 6) * 0.02;
    } else {
      // 起き上がる
      const p = (t - 0.85) / 0.15;
      petGroup.rotation.x = -Math.PI / 2.2 * (1 - p);
      petGroup.rotation.z = 0;
      petGroup.position.y = origY + 0.05 * (1 - p);
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// 嬉しいジャンプ演出
function petJump() {
  if (!petGroup) return;
  const startY = petGroup.position.y;
  const startTime = performance.now();
  function animJump(now) {
    const t = (now - startTime) / 500;
    if (t < 1) {
      petGroup.position.y = startY + Math.sin(t * Math.PI) * 0.4;
      requestAnimationFrame(animJump);
    } else {
      petGroup.position.y = startY;
      // 2回目の小ジャンプ
      const start2 = performance.now();
      function animJump2(now2) {
        const t2 = (now2 - start2) / 350;
        if (t2 < 1) {
          petGroup.position.y = startY + Math.sin(t2 * Math.PI) * 0.2;
          requestAnimationFrame(animJump2);
        } else {
          petGroup.position.y = startY;
        }
      }
      requestAnimationFrame(animJump2);
    }
  }
  requestAnimationFrame(animJump);
}


// ===== 訪問ペット演出 =====
// 相手のペットが部屋に入ってきて、自分のペットとじゃれ合って、帰っていく

let visitorGroup = null;
let visitorAnimating = false;

function buildVisitorPet(hexColor) {
  const group = new THREE.Group();
  const c = parseInt(hexColor.replace('#', ''), 16) || 0xffb347;
  const r = (c >> 16) & 0xff, g = (c >> 8) & 0xff, b = c & 0xff;
  const dark = ((Math.max(0, r - 30)) << 16) | ((Math.max(0, g - 30)) << 8) | Math.max(0, b - 30);
  const main = new THREE.MeshLambertMaterial({ color: c });
  const darkM = new THREE.MeshLambertMaterial({ color: dark });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const blk = new THREE.MeshLambertMaterial({ color: 0x333333 });
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xe91e63 });

  // 体
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), main);
  body.position.y = 0.35; body.scale.set(1, 0.85, 0.9); body.castShadow = true; group.add(body);
  // おなか
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), white);
  belly.position.set(0, 0.33, 0.1); belly.scale.set(0.8, 0.75, 0.5); group.add(belly);
  // 頭
  const headG = new THREE.Group(); headG.position.y = 0.75;
  headG.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), main));
  // マズル
  const mz = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), white);
  mz.position.set(0, -0.08, 0.22); mz.scale.set(1, 0.7, 0.8); headG.add(mz);
  // 耳
  const eL = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), main); eL.position.set(-0.22, 0.25, 0); headG.add(eL);
  const eR = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), main); eR.position.set(0.22, 0.25, 0); headG.add(eR);
  const earInL2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), darkM); earInL2.position.set(-0.22, 0.25, 0.05); headG.add(earInL2);
  const earInR2 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), darkM); earInR2.position.set(0.22, 0.25, 0.05); headG.add(earInR2);
  // 目
  const eyeW = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const wL = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeW); wL.position.set(-0.1, 0.03, 0.27); wL.scale.set(0.7, 1.1, 0.25); headG.add(wL);
  const wR = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 8), eyeW); wR.position.set(0.1, 0.03, 0.27); wR.scale.set(0.7, 1.1, 0.25); headG.add(wR);
  const bL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), blk); bL.position.set(-0.1, 0.03, 0.28); bL.scale.set(0.7, 1.1, 0.3); headG.add(bL);
  const bR = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), blk); bR.position.set(0.1, 0.03, 0.28); bR.scale.set(0.7, 1.1, 0.3); headG.add(bR);
  // 鼻
  const n = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), noseMat); n.position.set(0, -0.05, 0.36); n.scale.set(1.2, 0.8, 1); headG.add(n);
  group.add(headG);
  group.userData.head = headG;

  // 手
  function makeArm(side) {
    const ag = new THREE.Group(); ag.position.set(side * 0.22, 0.4, 0.05);
    const am = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), main); am.scale.set(0.9, 1.8, 0.9); am.position.y = -0.09; ag.add(am);
    const at = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), white); at.position.y = -0.22; ag.add(at);
    ag.rotation.z = side * 0.35; return ag;
  }
  group.add(makeArm(-1)); group.add(makeArm(1));
  // 足
  function makeLeg(side) {
    const lg = new THREE.Group(); lg.position.set(side * 0.1, 0.15, 0.05);
    const lm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), main); lm.scale.set(1, 1.5, 1); lm.position.y = -0.06; lg.add(lm);
    const lt = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), white); lt.position.y = -0.17; lt.scale.set(1.4, 0.7, 1.2); lg.add(lt);
    return lg;
  }
  group.add(makeLeg(-1)); group.add(makeLeg(1));

  // 手紙を持たせる
  const letter = new THREE.Group();
  const env = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.02), new THREE.MeshLambertMaterial({ color: 0xfff8dc }));
  letter.add(env);
  const seal = new THREE.Mesh(new THREE.CircleGeometry(0.025, 8), new THREE.MeshLambertMaterial({ color: 0xe74c3c }));
  seal.position.set(0, 0, 0.015); letter.add(seal);
  letter.position.set(0, 0.55, 0.25);
  group.add(letter);
  group.userData.letter = letter;

  return group;
}

// 訪問ペットが来る演出
function visitorPetArrive(petColor, petName, callback) {
  if (visitorAnimating || !scene) return;
  visitorAnimating = true;

  const doorX = -ROOM_SIZE / 2 + 0.3;
  const doorZ = 0.5;
  const outsideX = -ROOM_SIZE / 2 - 1.5;

  // 訪問ペットを構築
  visitorGroup = buildVisitorPet(petColor || '#ff8fa3');
  visitorGroup.position.set(outsideX, 0, doorZ);
  visitorGroup.scale.set(0.85, 0.85, 0.85); // 少し小さめ
  scene.add(visitorGroup);

  // フェーズ1: ドアを開けて入ってくる
  animateDoor(true, () => {
    const startTime = performance.now();
    function walkIn(now) {
      const t = Math.min((now - startTime) / 1000, 1);
      visitorGroup.position.x = outsideX + (doorX - outsideX) * t;
      // 歩行アニメーション（左右揺れ）
      visitorGroup.position.y = Math.abs(Math.sin(t * Math.PI * 4)) * 0.05;
      if (t < 1) {
        requestAnimationFrame(walkIn);
      } else {
        animateDoor(false, () => {
          // フェーズ2: 自分のペットに近づく
          walkToMyPet();
        });
      }
    }
    requestAnimationFrame(walkIn);
  });

  function walkToMyPet() {
    if (!petGroup) { finishVisit(); return; }
    const targetX = petGroup.position.x - 0.5;
    const targetZ = petGroup.position.z;
    const startX = visitorGroup.position.x;
    const startZ = visitorGroup.position.z;
    const startTime = performance.now();

    function walkApproach(now) {
      const t = Math.min((now - startTime) / 1200, 1);
      visitorGroup.position.x = startX + (targetX - startX) * t;
      visitorGroup.position.z = startZ + (targetZ - startZ) * t;
      visitorGroup.position.y = Math.abs(Math.sin(t * Math.PI * 5)) * 0.04;
      // 自分のペットの方を向く
      visitorGroup.lookAt(petGroup.position.x, 0, petGroup.position.z);
      if (t < 1) {
        requestAnimationFrame(walkApproach);
      } else {
        // フェーズ3: じゃれ合い
        playTogether();
      }
    }
    requestAnimationFrame(walkApproach);
  }

  function playTogether() {
    // 自分のペットも訪問ペットの方を向く
    if (petGroup) {
      petGroup.lookAt(visitorGroup.position.x, 0, visitorGroup.position.z);
    }

    const startTime = performance.now();
    const duration = 2500; // 2.5秒じゃれ合い

    function animPlay(now) {
      const t = (now - startTime) / duration;
      if (t > 1) {
        // じゃれ合い終了 → 手紙を渡す演出
        dropLetter();
        return;
      }

      // 2匹が交互にぴょんぴょん
      const bounce1 = Math.abs(Math.sin(t * Math.PI * 6)) * 0.15;
      const bounce2 = Math.abs(Math.sin(t * Math.PI * 6 + Math.PI / 2)) * 0.15;
      if (visitorGroup) visitorGroup.position.y = bounce1;
      if (petGroup) petGroup.position.y = bounce2;

      // 頭を傾げ合う
      const tilt = Math.sin(t * Math.PI * 4) * 0.2;
      if (visitorGroup.userData.head) visitorGroup.userData.head.rotation.z = tilt;
      if (petGroup && petGroup.userData.head) petGroup.userData.head.rotation.z = -tilt;

      // 少しずつ近づく→離れるを繰り返す
      const sway = Math.sin(t * Math.PI * 3) * 0.1;
      if (visitorGroup) visitorGroup.position.x += sway * 0.01;

      requestAnimationFrame(animPlay);
    }
    requestAnimationFrame(animPlay);
  }

  function dropLetter() {
    // 手紙を床に落とす
    if (visitorGroup && visitorGroup.userData.letter) {
      const letter = visitorGroup.userData.letter;
      visitorGroup.remove(letter);
      letter.position.copy(visitorGroup.position);
      letter.position.y = 0.05;
      letter.position.z += 0.3;
      letter.rotation.x = -Math.PI / 2;
      scene.add(letter);

      // 3秒後に手紙を消す
      setTimeout(() => { scene.remove(letter); }, 3000);
    }

    // 自分のペットがジャンプして喜ぶ
    if (typeof petJump === 'function') petJump();

    // 少し間を置いて帰る
    setTimeout(() => { visitorLeave(); }, 800);
  }

  function visitorLeave() {
    const doorX = -ROOM_SIZE / 2 + 0.3;
    const doorZ = 0.5;
    const startX = visitorGroup.position.x;
    const startZ = visitorGroup.position.z;
    const startTime = performance.now();

    // ドアに向かって歩く
    function walkToDoor(now) {
      const t = Math.min((now - startTime) / 1000, 1);
      visitorGroup.position.x = startX + (doorX - startX) * t;
      visitorGroup.position.z = startZ + (doorZ - startZ) * t;
      visitorGroup.position.y = Math.abs(Math.sin(t * Math.PI * 4)) * 0.04;
      visitorGroup.lookAt(doorX - 1, 0, doorZ);
      if (t < 1) {
        requestAnimationFrame(walkToDoor);
      } else {
        // ドアを開けて出ていく
        animateDoor(true, () => {
          const outsideX = -ROOM_SIZE / 2 - 1.5;
          const exitStart = performance.now();
          function walkOut(now2) {
            const t2 = Math.min((now2 - exitStart) / 800, 1);
            visitorGroup.position.x = doorX + (outsideX - doorX) * t2;
            if (t2 < 1) {
              requestAnimationFrame(walkOut);
            } else {
              animateDoor(false, () => { finishVisit(); });
            }
          }
          requestAnimationFrame(walkOut);
        });
      }
    }
    requestAnimationFrame(walkToDoor);
  }

  function finishVisit() {
    if (visitorGroup) { scene.remove(visitorGroup); visitorGroup = null; }
    visitorAnimating = false;
    // 自分のペットの位置をリセット
    if (petGroup) {
      petGroup.position.y = 0;
      if (petGroup.userData.head) petGroup.userData.head.rotation.z = 0;
    }
    if (callback) callback();
  }
}

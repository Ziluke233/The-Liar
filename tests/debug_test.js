// debug_test.js - 精确模拟质疑成功场景，追踪每一行执行

const MAX_HP = 6;
const GUN_CHAMBERS = 6;
const MAX_PLAYERS = 4;
const CARDS_PER_HAND = 5;

// 模拟DOM操作（无实际DOM，只追踪调用）
const domCalls = [];
function mockQuerySelector(sel) {
  domCalls.push('querySelector: ' + sel);
  return {
    getBoundingClientRect: () => ({left:100, top:100, width:80, height:120}),
    classList: { add: ()=>{}, remove: ()=>{} },
    querySelector: () => ({getBoundingClientRect: () => ({left:100, top:100, width:80, height:120})}),
    remove: ()=>{},
    appendChild: ()=>{},
    style: {}
  };
}
function mockCreateElement(tag) {
  domCalls.push('createElement: ' + tag);
  return {
    className: '', id: '', textContent: '', innerHTML: '',
    style: {}, dataset: {},
    classList: { add: (c)=>{}, remove: (c)=>{} },
    remove: ()=>{},
    appendChild: ()=>{},
    animate: ()=>{},
    getBoundingClientRect: () => ({left:100, top:100, width:80, height:120})
  };
}

// 全局模拟
global.document = {
  querySelector: mockQuerySelector,
  getElementById: (id) => mockQuerySelector('#' + id),
  createElement: mockCreateElement,
  body: { appendChild: ()=>{}, classList: { add: ()=>{}, remove: ()=>{} } }
};
global.window = { innerWidth: 1200, innerHeight: 800, requestAnimationFrame: (cb) => cb() };
global.setTimeout = (cb, ms) => { console.log('  [setTimeout ' + ms + 'ms scheduled]'); cb(); };
global.Math.random = () => 0.5;

// 日志追踪
const logs = [];
function addLog(msg, type) {
  logs.push(msg);
  console.log('  LOG: ' + msg);
}

// 游戏状态
const gameState = {
  gameStarted: true,
  gameOver: false,
  currentPlayerIdx: 0,
  lastPlayerIdx: -1,
  awaitingChallenge: false,
  players: [],
  targetCard: 'Q',
  lastPlayedCards: [],
  deck: [],
  tension: 0,
  roundCount: 1,
  selectedCards: [],
  humanPlayedThisTurn: false
};

function createDeck() {
  const deck = [...Array(6).fill('Q'), ...Array(6).fill('K'), ...Array(6).fill('A'), ...Array(2).fill('Joker')];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCards() {
  gameState.deck = createDeck();
  gameState.players.forEach(p => {
    p.hand = [];
    for (let i = 0; i < CARDS_PER_HAND; i++) {
      if (gameState.deck.length > 0) p.hand.push(gameState.deck.pop());
    }
  });
}

// 初始化
const configs = [
  { id: 0, name: 'Human', isHuman: true, personality: 'human' },
  { id: 1, name: 'Gamer', isHuman: false, personality: 'aggressive' },
  { id: 2, name: 'Professor', isHuman: false, personality: 'analytical' },
  { id: 3, name: 'Cool Girl', isHuman: false, personality: 'timid' }
];
gameState.players = configs.map(cfg => ({
  ...cfg,
  hp: MAX_HP,
  alive: true,
  hand: [],
  bulletPosition: 0, // 预设：实弹在第0个弹舱（确保质疑成功会被击中）
  currentBullet: 0,
  bulletsFired: 0,
  trustLevels: {},
  lastLied: false,
  caughtLying: false
}));
dealCards();

// ======== 追踪执行的关键函数 ========

function getNextAliveIndex(idx) {
  let i = (idx + 1) % MAX_PLAYERS;
  let safety = 0;
  while (!gameState.players[i].alive && safety < MAX_PLAYERS) { i = (i + 1) % MAX_PLAYERS; safety++; }
  return i;
}

function advanceTurn() {
  let safety = 0;
  do {
    gameState.currentPlayerIdx = (gameState.currentPlayerIdx + 1) % MAX_PLAYERS;
    safety++;
    if (safety > MAX_PLAYERS) {
      gameState.gameOver = true;
      return;
    }
  } while (!gameState.players[gameState.currentPlayerIdx].alive);
}

function playCards(player, cards, isLying) {
  console.log('  playCards: ' + player.name + ' plays ' + cards.length + ' cards, lying=' + isLying);
  cards.forEach(c => {
    const idx = player.hand.indexOf(c);
    if (idx > -1) player.hand.splice(idx, 1);
  });
  gameState.lastPlayedCards = [...cards];
  gameState.lastPlayerIdx = player.id;
  player.lastLied = isLying;

  if (player.hand.length === 0) {
    addLog(player.name + ' wins by empty hand!');
    gameState.gameOver = true;
    return;
  }
  const aliveCount = gameState.players.filter(p => p.alive).length;
  if (aliveCount <= 1) {
    gameState.gameOver = true;
  }
}

// 模拟特效
function triggerDeathEffects(player) { console.log('  triggerDeathEffects for ' + player.name); }
function triggerParticles(player, n) { console.log('  triggerParticles: ' + n); }
function updateTension(v) { console.log('  updateTension: ' + v); }

function showBubble(player, text) {
  console.log('  showBubble: ' + player.name + ' says "' + text + '"');
}

function getDialogue(player, situation) {
  return '...';
}

function showPenaltyPopup(player, isBullet) {
  console.log('  showPenaltyPopup: ' + player.name + ' isBullet=' + isBullet);
}

function hideReactionModal() { console.log('  hideReactionModal'); }

// ==== 核心：performPenalty 追踪版 ====
function performPenalty(player) {
  console.log('\n>>> performPenalty START for ' + player.name);
  if (gameState.gameOver) { console.log('  gameOver=true, returning'); return; }
  
  hideReactionModal();
  const chamber = player.currentBullet;
  const isBullet = chamber === player.bulletPosition;
  console.log('  chamber=' + chamber + ', bulletPosition=' + player.bulletPosition + ', isBullet=' + isBullet);
  
  player.currentBullet = (player.currentBullet + 1) % GUN_CHAMBERS;
  player.bulletsFired++;
  showPenaltyPopup(player, isBullet);

  if (isBullet) {
    addLog('💥 砰！' + player.name + '中弹了！');
    player.hp = 0;
    triggerDeathEffects(player);
  } else {
    addLog('🔘 咔...' + player.name + '安全');
  }

  console.log('  After bullet check: player.hp=' + player.hp + ', player.alive=' + player.alive);

  if (player.hp <= 0) {
    console.log('  DEATH BRANCH');
    player.alive = false;
    showBubble(player, getDialogue(player, 'death'));
    addLog('💀 ' + player.name + ' eliminated');
    
    const aliveCount = gameState.players.filter(p => p.alive).length;
    console.log('  aliveCount=' + aliveCount);
    
    if (aliveCount <= 1) {
      const winner = gameState.players.find(p => p.alive);
      console.log('  GAME OVER, winner=' + (winner ? winner.name : 'none'));
      gameState.gameOver = true;
      return;
    }
    
    console.log('  Death but not game over. currentPlayerIdx=' + gameState.currentPlayerIdx);
    gameState.currentPlayerIdx = player.id;
    console.log('  Set currentPlayerIdx to dead player id=' + player.id + ', now advanceTurn...');
    advanceTurn();
    console.log('  After advanceTurn: currentPlayerIdx=' + gameState.currentPlayerIdx + ' (' + gameState.players[gameState.currentPlayerIdx].name + ')');
    updateTension(-20);
    
    console.log('  Scheduling startRound in 1500ms...');
    setTimeout(() => {
      if (!gameState.gameOver) {
        console.log('  >>> startRound executing');
        startRound();
        console.log('  <<< startRound completed');
      }
    }, 1500);
    console.log('  Returning from performPenalty (death branch)');
    return;
  }

  // 空弹分支
  console.log('  EMPTY BRANCH');
  gameState.currentPlayerIdx = player.id;
  advanceTurn();
  console.log('  After advanceTurn (empty): currentPlayerIdx=' + gameState.currentPlayerIdx + ' (' + gameState.players[gameState.currentPlayerIdx].name + ')');
  updateTension(-5);
  
  console.log('  Scheduling nextTurn in 600ms...');
  setTimeout(() => {
    if (!gameState.gameOver) {
      console.log('  >>> nextTurn executing');
      nextTurn();
      console.log('  <<< nextTurn completed');
    }
  }, 600);
  console.log('  Returning from performPenalty (empty branch)');
}

// ==== startRound 追踪版 ====
function startRound() {
  console.log('\n>>> startRound START');
  if (gameState.gameOver) { console.log('  gameOver, returning'); return; }
  
  gameState.roundCount++;
  gameState.lastPlayedCards = [];
  gameState.lastPlayerIdx = -1;
  gameState.humanPlayedThisTurn = false;
  gameState.awaitingChallenge = false;
  gameState.selectedCards = [];
  
  console.log('  Dealing cards...');
  dealCards();
  gameState.targetCard = ['Q','K','A'][Math.floor(Math.random()*3)];
  
  gameState.players.forEach(p => {
    if (p.alive) {
      p.bulletPosition = Math.floor(Math.random() * GUN_CHAMBERS);
      p.currentBullet = 0;
      p.bulletsFired = 0;
    }
  });
  
  addLog('Round ' + gameState.roundCount + ' starts, target=' + gameState.targetCard);
  
  console.log('  Calling nextTurn...');
  nextTurn();
  console.log('<<< startRound END');
}

// ==== nextTurn 追踪版 ====
function nextTurn() {
  console.log('\n>>> nextTurn START, currentPlayerIdx=' + gameState.currentPlayerIdx);
  if (gameState.gameOver) { console.log('  gameOver, returning'); return; }
  
  gameState.humanPlayedThisTurn = false;
  const alivePlayers = gameState.players.filter(p => p.alive);
  console.log('  Alive players: ' + alivePlayers.length);
  
  if (alivePlayers.length <= 1) {
    const winner = gameState.players.find(p => p.alive);
    console.log('  Only 1 alive, gameOver. Winner=' + (winner ? winner.name : 'none'));
    gameState.gameOver = true;
    return;
  }
  
  const current = gameState.players[gameState.currentPlayerIdx];
  console.log('  Current player: ' + current.name + ', alive=' + current.alive);
  
  if (!current.alive) {
    console.log('  Current player dead, advanceTurn + nextTurn');
    advanceTurn();
    nextTurn();
    return;
  }
  
  console.log('  It is ' + current.name + '\'s turn to play');
  console.log('<<< nextTurn END');
}

// ==== 模拟质疑成功场景 ====
console.log('=== SCENARIO: Player 0质疑Player 1成功，Player 1被实弹击中 ===\n');
console.log('Initial state:');
console.log('  Player 0 (Human): hp=' + gameState.players[0].hp + ', alive=' + gameState.players[0].alive);
console.log('  Player 1 (Gamer): hp=' + gameState.players[1].hp + ', alive=' + gameState.players[1].alive + ', hand=[' + gameState.players[1].hand.join(',') + ']');
console.log('  Player 2 (Professor): hp=' + gameState.players[2].hp + ', alive=' + gameState.players[2].alive);
console.log('  Player 3 (Cool Girl): hp=' + gameState.players[3].hp + ', alive=' + gameState.players[3].alive);
console.log('  currentPlayerIdx=' + gameState.currentPlayerIdx);
console.log('  lastPlayerIdx=' + gameState.lastPlayerIdx);

// Player 1出牌（说谎）
console.log('\n--- Player 1 plays cards ---');
const cardsToPlay = gameState.players[1].hand.slice(0, 2);
playCards(gameState.players[1], cardsToPlay, true); // isLying=true
console.log('  After playCards: lastPlayerIdx=' + gameState.lastPlayerIdx);

// 轮到Player 0，Player 0质疑
console.log('\n--- Player 0 challenges ---');
gameState.currentPlayerIdx = 0;
gameState.lastPlayerIdx = 1;
const challenger = gameState.players[0];
const targetPlayer = gameState.players[1];
const cards = gameState.lastPlayedCards;
const wasLying = targetPlayer.lastLied;

console.log('  Challenger: ' + challenger.name);
console.log('  Target: ' + targetPlayer.name);
console.log('  wasLying: ' + wasLying);

// resolveChallenge
console.log('\n--- resolveChallenge ---');
gameState.lastPlayerIdx = -1;
gameState.awaitingChallenge = false;

if (!cards.every(c => c === gameState.targetCard || c === 'Joker') || wasLying) {
  console.log('  Challenge SUCCESSFUL! Target ' + targetPlayer.name + ' will be penalized');
  performPenalty(targetPlayer);
} else {
  console.log('  Challenge failed');
  performPenalty(challenger);
}

console.log('\n=== After resolveChallenge ===');
console.log('  gameOver=' + gameState.gameOver);
console.log('  currentPlayerIdx=' + gameState.currentPlayerIdx + ' (' + gameState.players[gameState.currentPlayerIdx].name + ')');
console.log('  Alive players:');
gameState.players.forEach(p => console.log('    ' + p.name + ': hp=' + p.hp + ', alive=' + p.alive));

console.log('\n=== SIMULATION COMPLETE ===');

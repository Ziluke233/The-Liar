// test_game.js - 游戏流程模拟测试
// 提取核心逻辑，模拟多局完整游戏，检测卡死/逻辑错误

const MAX_HP = 6;
const GUN_CHAMBERS = 6;
const MAX_PLAYERS = 4;
const CARDS_PER_HAND = 5;

function createDeck() {
  const deck = [...Array(6).fill('Q'), ...Array(6).fill('K'), ...Array(6).fill('A'), ...Array(2).fill('Joker')];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function initPlayers() {
  const configs = [
    { id: 0, name: 'Human', isHuman: true, personality: 'human' },
    { id: 1, name: 'Gamer', isHuman: false, personality: 'aggressive' },
    { id: 2, name: 'Professor', isHuman: false, personality: 'analytical' },
    { id: 3, name: 'Cool Girl', isHuman: false, personality: 'timid' }
  ];
  return configs.map(cfg => ({
    ...cfg,
    hp: MAX_HP,
    alive: true,
    hand: [],
    bulletPosition: Math.floor(Math.random() * GUN_CHAMBERS),
    currentBullet: 0,
    bulletsFired: 0,
    trustLevels: {},
    lastLied: false,
    caughtLying: false
  }));
}

function getNextAliveIndex(players, idx) {
  let i = (idx + 1) % MAX_PLAYERS;
  let safety = 0;
  while (!players[i].alive && safety < MAX_PLAYERS) { i = (i + 1) % MAX_PLAYERS; safety++; }
  return i;
}

// AI出牌决策
function aiChooseCards(player, target) {
  const hand = player.hand;
  const hasTarget = hand.filter(c => c === target || c === 'Joker');
  const others = hand.filter(c => c !== target && c !== 'Joker');
  let chosen = [];
  let isLying = false;

  if (player.personality === 'aggressive') {
    if (hasTarget.length > 0 && Math.random() < 0.7) {
      chosen = [hasTarget[0]];
      if (hasTarget.length > 1 && Math.random() < 0.4) chosen.push(hasTarget[1]);
    } else if (others.length > 0) {
      chosen = [others[0]];
      if (others.length > 1 && Math.random() < 0.3) chosen.push(others[1]);
      isLying = true;
    } else if (hasTarget.length > 0) {
      chosen = [hasTarget[0]];
    }
  } else if (player.personality === 'analytical') {
    if (hasTarget.length >= 2) chosen = hasTarget.slice(0, 2);
    else if (hasTarget.length === 1) chosen = [hasTarget[0]];
    else if (others.length > 0) { chosen = [others[0]]; isLying = true; }
  } else {
    if (hasTarget.length > 0) chosen = [hasTarget[0]];
    else if (others.length > 0) { chosen = [others[0]]; isLying = true; }
  }
  if (chosen.length === 0 && hand.length > 0) {
    chosen = [hand[0]];
    isLying = hand[0] !== target && hand[0] !== 'Joker';
  }
  return { chosen, isLying };
}

// AI质疑决策
function aiShouldChallenge(challenger, targetPlayer, cards, isLying) {
  let shouldChallenge = false;
  const rand = Math.random();
  if (challenger.personality === 'aggressive') shouldChallenge = isLying ? rand < 0.85 : rand < 0.4;
  else if (challenger.personality === 'analytical') shouldChallenge = isLying ? rand < 0.75 : rand < 0.25;
  else shouldChallenge = isLying ? rand < 0.5 : rand < 0.15;
  if (cards.length >= 3) shouldChallenge = shouldChallenge || rand < 0.3;
  return shouldChallenge;
}

// 模拟一局游戏
function simulateGame(gameNum) {
  let players = initPlayers();
  let gameOver = false;
  let currentPlayerIdx = Math.floor(Math.random() * MAX_PLAYERS);
  let stepCount = 0;
  const MAX_STEPS = 500;
  const errors = [];
  let log = [];

  function addLog(msg) { log.push(msg); }

  function endGame(winner) {
    gameOver = true;
    if (!winner) {
      errors.push('endGame called with no winner');
    }
  }

  function startRound() {
    if (gameOver) return;
    // 每轮重新发牌
    const deck = createDeck();
    players.forEach(p => {
      p.hand = [];
      for (let i = 0; i < CARDS_PER_HAND; i++) {
        if (deck.length > 0) p.hand.push(deck.pop());
      }
    });
    players.forEach(p => {
      if (p.alive) {
        p.bulletPosition = Math.floor(Math.random() * GUN_CHAMBERS);
        p.currentBullet = 0;
        p.bulletsFired = 0;
      }
    });
  }

  function performPenalty(player) {
    const chamber = player.currentBullet;
    const isBullet = chamber === player.bulletPosition;
    player.currentBullet = (player.currentBullet + 1) % GUN_CHAMBERS;
    player.bulletsFired++;

    if (isBullet) {
      player.hp = 0;
      player.alive = false;
      const aliveCount = players.filter(p => p.alive).length;
      if (aliveCount <= 1) {
        const winner = players.find(p => p.alive);
        endGame(winner);
        return;
      }
      // 死亡但不结束：推进到下一位
      currentPlayerIdx = player.id;
      advanceTurn();
      // 重新开始一轮
      startRound();
    } else {
      // 空弹：推进到下一位
      currentPlayerIdx = player.id;
      advanceTurn();
    }
  }

  function advanceTurn() {
    let safety = 0;
    do {
      currentPlayerIdx = (currentPlayerIdx + 1) % MAX_PLAYERS;
      safety++;
      if (safety > MAX_PLAYERS) {
        endGame(null);
        return;
      }
    } while (!players[currentPlayerIdx].alive);
  }

  function playCards(player, cards, isLying) {
    cards.forEach(c => {
      const idx = player.hand.indexOf(c);
      if (idx > -1) player.hand.splice(idx, 1);
    });
    player.lastLied = isLying;

    // 手牌清空 -> 获胜
    if (player.hand.length === 0) {
      endGame(player);
      return;
    }

    // 只剩一人存活
    const aliveCount = players.filter(p => p.alive).length;
    if (aliveCount <= 1) {
      endGame(players.find(p => p.alive));
    }
  }

  function resolveChallenge(challenger, targetPlayer, cards, wasLying) {
    const allValid = cards.every(c => c === target || c === 'Joker');
    if (!allValid || wasLying) {
      // 质疑成功，说谎者被惩罚
      performPenalty(targetPlayer);
    } else {
      // 质疑失败，质疑者被惩罚
      performPenalty(challenger);
    }
  }

  // 初始化
  const deck = createDeck();
  players.forEach(p => {
    p.hand = [];
    for (let i = 0; i < CARDS_PER_HAND; i++) {
      if (deck.length > 0) p.hand.push(deck.pop());
    }
  });
  let target = ['Q','K','A'][Math.floor(Math.random()*3)];
  let lastPlayerIdx = -1;
  let lastPlayedCards = [];

  // 主循环
  while (!gameOver && stepCount < MAX_STEPS) {
    stepCount++;
    const current = players[currentPlayerIdx];
    if (!current.alive) {
      advanceTurn();
      continue;
    }

    // 出牌
    if (current.isHuman) {
      // 模拟人类：随机选择1-3张牌
      const handCopy = [...current.hand];
      const numToPlay = Math.min(Math.floor(Math.random() * 3) + 1, handCopy.length);
      const chosen = handCopy.slice(0, numToPlay);
      const isLying = chosen.some(c => c !== target && c !== 'Joker');
      playCards(current, chosen, isLying);
      if (gameOver) break;
      lastPlayedCards = [...chosen];
      lastPlayerIdx = current.id;
    } else {
      // AI出牌
      const { chosen, isLying } = aiChooseCards(current, target);
      playCards(current, chosen, isLying);
      if (gameOver) break;
      lastPlayedCards = [...chosen];
      lastPlayerIdx = current.id;
    }

    if (gameOver) break;

    // 下一位玩家质疑决策
    const nextIdx = getNextAliveIndex(players, currentPlayerIdx);
    const nextPlayer = players[nextIdx];
    currentPlayerIdx = nextIdx;

    if (nextPlayer.isHuman) {
      // 人类模拟：50%质疑
      if (Math.random() < 0.5) {
        // 质疑
        const targetPlayer = players[lastPlayerIdx];
        resolveChallenge(nextPlayer, targetPlayer, lastPlayedCards, targetPlayer.lastLied);
      } else {
        // 不质疑，当前玩家继续出牌
        // currentPlayerIdx 已经是 nextPlayer
      }
    } else {
      // AI质疑
      const targetPlayer = players[lastPlayerIdx];
      const shouldChallenge = aiShouldChallenge(nextPlayer, targetPlayer, lastPlayedCards, targetPlayer.lastLied);
      if (shouldChallenge) {
        resolveChallenge(nextPlayer, targetPlayer, lastPlayedCards, targetPlayer.lastLied);
      } else {
        // 不质疑，当前玩家继续出牌
        // currentPlayerIdx 已经是 nextPlayer
      }
    }

    if (gameOver) break;

    // 检查弹舱溢出
    players.forEach(p => {
      if (p.bulletsFired > GUN_CHAMBERS) {
        errors.push('Player ' + p.name + ' bulletsFired=' + p.bulletsFired + ' > GUN_CHAMBERS');
      }
    });
  }

  if (stepCount >= MAX_STEPS) {
    errors.push('Game ' + gameNum + ' hit MAX_STEPS - possible infinite loop');
  }

  return {
    gameNum,
    steps: stepCount,
    winner: gameOver ? players.find(p => p.alive) : null,
    errors,
    aliveCount: players.filter(p => p.alive).length,
    log: log.slice(-10) // last 10 log entries
  };
}

// 运行100局模拟
console.log('=== Running 100 game simulations ===\n');
let totalErrors = [];
let totalGames = 100;

for (let i = 1; i <= totalGames; i++) {
  const result = simulateGame(i);
  if (result.errors.length > 0) {
    totalErrors.push(result);
  }
}

console.log('Total games:', totalGames);
console.log('Games with errors:', totalErrors.length);
console.log('');

if (totalErrors.length > 0) {
  console.log('=== Error Details ===\n');
  totalErrors.forEach(r => {
    console.log('Game ' + r.gameNum + ':');
    r.errors.forEach(e => console.log('  - ' + e));
    console.log('');
  });
} else {
  console.log('All 100 games completed without errors!');
}

// 测试极端场景
console.log('\n=== Edge Case Tests ===\n');

// Test 1: 全员空弹（直到弹舱用完应该重置）
function testChamberWrap() {
  const players = initPlayers();
  players[0].bulletPosition = 3;
  players[0].currentBullet = 0;
  players[0].bulletsFired = 0;

  // 开6枪
  for (let i = 0; i < 6; i++) {
    const chamber = players[0].currentBullet;
    const isBullet = chamber === players[0].bulletPosition;
    players[0].currentBullet = (players[0].currentBullet + 1) % GUN_CHAMBERS;
    players[0].bulletsFired++;
    if (isBullet) {
      console.log('Test chamber wrap: bullet at position', chamber, 'on shot', i + 1);
      break;
    }
  }
  console.log('bulletsFired after 6 shots:', players[0].bulletsFired);
  console.log('currentBullet after wrap:', players[0].currentBullet);

  // 检查弹舱渲染逻辑
  const p = players[0];
  let spentCount = 0;
  for (let i = 0; i < GUN_CHAMBERS; i++) {
    let isSpent = false;
    let pos = p.currentBullet - 1;
    for (let s = 0; s < p.bulletsFired; s++) {
      if (pos < 0) pos = GUN_CHAMBERS - 1;
      if (i === pos) { isSpent = true; break; }
      pos--;
    }
    if (isSpent) spentCount++;
  }
  console.log('Expected spent chambers:', p.bulletsFired, 'Actual spent:', spentCount);
  if (spentCount !== Math.min(p.bulletsFired, GUN_CHAMBERS)) {
    console.log('ERROR: spent count mismatch!');
  } else {
    console.log('OK: spent count matches');
  }
}
testChamberWrap();

console.log('\n=== Test Complete ===');

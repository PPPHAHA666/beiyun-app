// ============ 常量与状态 ============
// 版本号按北京时间（UTC+8）生成
const APP_VERSION = 'V2026-0822-1717';
const LS_MODULES = 'dk_modules';
const LS_SETTINGS = 'dk_settings';
const LS_CHECKINS = 'dk_checkins';      // { 'YYYY-MM-DD': true }
const LS_LEARNED = 'dk_learned';        // { itemId: 'YYYY-MM-DD' }
const LS_FAVORITES = 'dk_favorites';    // { itemId: true }

let state = {
  modules: [],
  settings: { moduleId: null, dailyCount: 5 },
  checkins: {},
  learned: {},
  favorites: {},
  module: null,
  learnQueue: [],
  learnIndex: 0,
};

// ============ 工具函数 ============
const $ = (sel) => document.querySelector(sel);
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const load = (key, def) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; }
};
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

// ============ 数据加载 ============
async function loadModules() {
  let mods = load(LS_MODULES, null);
  try {
    const res = await fetch('data/modules.json');
    const fresh = (await res.json()).modules;
    save(LS_MODULES, fresh);
    mods = fresh;
  } catch (e) {
    // 离线时用缓存
  }
  state.modules = mods || [];
}

// ============ 初始化 ============
async function init() {
  state.settings = { ...state.settings, ...load(LS_SETTINGS, {}) };
  state.checkins = load(LS_CHECKINS, {});
  state.learned = load(LS_LEARNED, {});
  state.favorites = load(LS_FAVORITES, {});

  await loadModules();

  // 模块选择器
  const sel = $('#moduleSelect');
  sel.innerHTML = state.modules.map(m =>
    `<option value="${m.id}">${esc(m.name)}</option>`).join('');
  if (!state.settings.moduleId && state.modules.length) {
    state.settings.moduleId = state.modules[0].id;
  }
  sel.value = state.settings.moduleId;
  sel.addEventListener('change', () => {
    state.settings.moduleId = sel.value;
    save(LS_SETTINGS, state.settings);
    switchModule();
  });

  // 设置项
  $('#dailyCount').value = state.settings.dailyCount;
  $('#dailyCount').addEventListener('change', (e) => {
    state.settings.dailyCount = clamp(parseInt(e.target.value) || 5, 1, 20);
    e.target.value = state.settings.dailyCount;
    save(LS_SETTINGS, state.settings);
  });

  $('#checkinBtn').addEventListener('click', doCheckin);
  $('#resetBtn').addEventListener('click', resetAll);

  // 设置页显示版本号
  $('#appVersion').textContent = '版本号 ' + APP_VERSION;

  initTabs();
  switchModule();
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// ============ 标签页切换 ============
function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

// ============ 模块切换/刷新 ============
function switchModule() {
  state.module = state.modules.find(m => m.id === state.settings.moduleId) || state.modules[0];
  if (!state.module) return;
  renderCheckin();
  prepareLearn();
  renderFavorites();
  renderRecords();
}

// ============ 打卡 ============
function isCheckedIn() { return !!state.checkins[todayKey()]; }

// 今日已学条数（当前模块）
function todayLearnedCount() {
  const today = todayKey();
  return (state.module.items || []).filter(i => state.learned[i.id] === today).length;
}

// 今日打卡需完成的条数（不超过模块总量）
function requiredCount() {
  return Math.min(state.settings.dailyCount, (state.module.items || []).length);
}

// 是否达到今日打卡门槛
function canCheckIn() { return todayLearnedCount() >= requiredCount(); }

function calcStreak() {
  let streak = 0;
  const d = new Date();
  if (!isCheckedIn()) d.setDate(d.getDate() - 1);
  while (true) {
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (state.checkins[k]) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

function renderCheckin() {
  const now = new Date();
  $('#todayDate').textContent = `${now.getMonth()+1}月${now.getDate()}日 ${['日','一','二','三','四','五','六'][now.getDay()]}`;
  const streak = calcStreak();
  $('#streakDisplay').textContent = `连续打卡 ${streak} 天`;
  const btn = $('#checkinBtn');
  const learned = todayLearnedCount();
  const need = requiredCount();
  if (isCheckedIn()) {
    btn.textContent = '今日已打卡 ✓';
    btn.disabled = true;
  } else if (canCheckIn()) {
    btn.textContent = '今日打卡';
    btn.disabled = false;
  } else {
    btn.textContent = `先完成今日学习（${learned}/${need}）`;
    btn.disabled = true;
  }
  $('#todayPlan').innerHTML = `<p>今日计划：学习 ${need} 条后可打卡 · 已学 ${learned} 条${learned >= need ? '，达到打卡条件 ✓' : ''}</p>`;
}

function doCheckin() {
  state.checkins[todayKey()] = true;
  save(LS_CHECKINS, state.checkins);
  renderCheckin();
}

// ============ 收藏 ============
function isFavorite(id) { return !!state.favorites[id]; }

function toggleFavorite(id) {
  if (state.favorites[id]) delete state.favorites[id];
  else state.favorites[id] = true;
  save(LS_FAVORITES, state.favorites);
  renderFavorites();
  renderLearn(); // 刷新当前学习条目的收藏按钮
}

function renderFavorites() {
  const area = $('#favoritesArea');
  const favIds = Object.keys(state.favorites);
  $('#favCount').textContent = favIds.length ? `${favIds.length} 条` : '';
  if (!favIds.length) {
    area.innerHTML = `<div class="empty-tip">还没有收藏，学习时点「☆ 收藏」即可加入。</div>`;
    return;
  }
  const html = [];
  state.modules.forEach(mod => {
    const list = (mod.items || []).filter(i => state.favorites[i.id]);
    if (!list.length) return;
    html.push(`<div class="record-block"><h3>${esc(mod.name)}</h3>`);
    list.forEach(item => {
      html.push(`
        <div class="fav-item" data-id="${item.id}">
          <div class="fav-head">
            <span class="item-title">${esc(item.title)}</span>
            <button class="small-btn fav-remove" data-id="${item.id}">取消收藏</button>
          </div>
          <div class="item-content">${esc(item.content)}</div>
          <div class="fav-open">去学习此条 →</div>
        </div>`);
    });
    html.push('</div>');
  });
  area.innerHTML = html.join('');
  // 点击条目跳转学习页学这一条
  area.querySelectorAll('.fav-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.fav-remove')) return;
      learnItem(el.dataset.id);
    });
  });
  area.querySelectorAll('.fav-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      delete state.favorites[btn.dataset.id];
      save(LS_FAVORITES, state.favorites);
      renderFavorites();
      renderLearn();
    });
  });
}

// 从收藏页跳到学习页，直接学指定条目
function learnItem(id) {
  const owner = state.modules.find(m => (m.items || []).some(i => i.id === id));
  if (!owner) return;
  if (owner.id !== state.module.id) {
    state.settings.moduleId = owner.id;
    save(LS_SETTINGS, state.settings);
    $('#moduleSelect').value = owner.id;
    switchModule();
  }
  const item = owner.items.find(i => i.id === id);
  if (!item) return;
  state.learnQueue = [item];
  state.learnIndex = 0;
  renderLearn();
  switchTab('learn');
}

// ============ 学习 ============
function prepareLearn() {
  const items = state.module.items;
  const today = todayKey();
  const unlearned = items.filter(i => state.learned[i.id] !== today);
  if (!unlearned.length) {
    state.learnQueue = [];
    state.learnIndex = 0;
    renderLearn();
    return;
  }
  const count = Math.min(state.settings.dailyCount, unlearned.length);
  state.learnQueue = shuffle(unlearned).slice(0, count);
  state.learnIndex = 0;
  renderLearn();
}

function renderLearn() {
  const area = $('#learnArea');
  if (!state.learnQueue.length) {
    const need = requiredCount();
    const learned = todayLearnedCount();
    const finished = learned >= (state.module.items || []).length;
    area.innerHTML = `<div class="empty-tip">${finished ? '今日知识已全部学完 🎉' : '当前模块还没有知识条目，请先在数据中添加。'}</div>`;
    $('#learnProgress').textContent = finished ? `已完成 ${learned} 条` : '';
    renderCheckin();
    return;
  }
  $('#learnProgress').textContent = `${state.learnIndex + 1} / ${state.learnQueue.length}`;
  const item = state.learnQueue[state.learnIndex];
  const done = state.learned[item.id] === todayKey();
  const fav = isFavorite(item.id);
  const prevBtn = state.learnIndex > 0
    ? `<button class="small-btn" id="learnPrevBtn">上一题</button>` : '';
  area.innerHTML = `
    <div class="learn-item">
      <div class="item-title">${esc(item.title)}</div>
      <div class="item-content">${esc(item.content)}</div>
      <div class="item-actions">
        ${prevBtn}
        <button class="small-btn ${fav ? 'fav-active' : ''}" id="learnFavBtn">${fav ? '★ 已收藏' : '☆ 收藏'}</button>
        <button class="small-btn" id="learnDoneBtn">${done ? '已学会 ✓' : '标记学会了'}</button>
        <button class="small-btn" id="learnNextBtn">${state.learnIndex === state.learnQueue.length-1 ? '完成' : '下一题'}</button>
      </div>
    </div>`;
  $('#learnFavBtn').addEventListener('click', () => toggleFavorite(item.id));
  $('#learnDoneBtn').addEventListener('click', () => {
    state.learned[item.id] = todayKey();
    save(LS_LEARNED, state.learned);
    renderLearn();
  });
  if (state.learnIndex > 0) {
    $('#learnPrevBtn').addEventListener('click', () => {
      state.learnIndex--;
      renderLearn();
    });
  }
  $('#learnNextBtn').addEventListener('click', () => {
    if (state.learnIndex < state.learnQueue.length - 1) {
      state.learnIndex++;
      renderLearn();
    } else {
      finishBatch();
    }
  });
}

// 一批学完：达到设定数后继续可再学，全部学完则结束
function finishBatch() {
  const area = $('#learnArea');
  const today = todayKey();
  const unlearned = (state.module.items || []).filter(i => state.learned[i.id] !== today);
  const learned = todayLearnedCount();
  const need = requiredCount();
  if (!unlearned.length) {
    area.innerHTML = `<div class="empty-tip">今日知识已全部学完 🎉（共 ${learned} 条）</div>`;
    $('#learnProgress').textContent = '已完成';
  } else {
    const msg = learned >= need
      ? `今日设定学习已完成（${learned}/${need}），还可继续学习剩余 ${unlearned.length} 条`
      : `今日学习进度 ${learned}/${need}，继续学习剩余 ${unlearned.length} 条`;
    area.innerHTML = `
      <div class="empty-tip">${msg}</div>
      <div style="text-align:center;margin-top:8px;">
        <button class="primary-btn" id="continueLearnBtn">继续学习</button>
      </div>`;
    $('#learnProgress').textContent = `已完成 ${learned} 条`;
    $('#continueLearnBtn').addEventListener('click', () => prepareLearn());
  }
  renderCheckin();
}

// ============ 记录 ============
function renderRecords() {
  const area = $('#recordsArea');
  const days = Object.keys(state.checkins).sort().reverse().slice(0, 30);
  const checkinHtml = days.length
    ? `<div class="record-list">${days.map(d => `<span class="record-chip good">${d}</span>`).join('')}</div>`
    : `<div class="record-empty">还没有打卡记录</div>`;

  const moduleName = state.module ? state.module.name : '—';
  const total = state.module ? (state.module.items || []).length : 0;
  const todayLearned = todayLearnedCount();

  area.innerHTML = `
    <div class="record-block">
      <h3>学习统计（${esc(moduleName)}）</h3>
      <div class="record-list">
        <span class="record-chip good">今日已学 ${todayLearned} 条</span>
        <span class="record-chip">总题数 ${total} 条</span>
      </div>
    </div>
    <div class="record-block">
      <h3>打卡记录（近30天）</h3>${checkinHtml}
    </div>`;
}

// ============ 重置 ============
function resetAll() {
  if (!confirm('确定要清空所有打卡、学习、收藏记录吗？此操作不可恢复。')) return;
  localStorage.removeItem(LS_CHECKINS);
  localStorage.removeItem(LS_LEARNED);
  localStorage.removeItem(LS_FAVORITES);
  state.checkins = {};
  state.learned = {};
  state.favorites = {};
  switchModule();
}

init();
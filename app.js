const DEFAULT_ACCOUNT_SIZE = 1000;
const DEFAULT_TRADE_COUNT = 3;
const REMINDER_HOUR = 9;
const REMINDER_MINUTE = 0;
const SIMPLE_MODE_KEY = "trade-discipline-simple-mode";
let deferredInstallPrompt = null;

const dom = {
  reviewDate: document.getElementById("review-date"),
  accountSize: document.getElementById("account-size"),
  positionLimit: document.getElementById("position-limit"),
  lossLimit: document.getElementById("loss-limit"),
  takeProfitLock: document.getElementById("take-profit-lock"),
  simpleModeToggle: document.getElementById("simple-mode-toggle"),
  mobileModeToggle: document.getElementById("mobile-mode-toggle"),
  saveStatus: document.getElementById("save-status"),
  violationChaseHigh: document.getElementById("violation-chase-high"),
  violationNoStop: document.getElementById("violation-no-stop"),
  violationEmotional: document.getElementById("violation-emotional"),
  overallViolation: document.getElementById("overall-violation"),
  strategyHot: document.getElementById("strategy-hot"),
  strategyVolume: document.getElementById("strategy-volume"),
  strategyTrend: document.getElementById("strategy-trend"),
  strategyResult: document.getElementById("strategy-result"),
  tradeList: document.getElementById("trade-list"),
  addTrade: document.getElementById("add-trade"),
  averageScore: document.getElementById("average-score"),
  zeroScoreCount: document.getElementById("zero-score-count"),
  riskPosition: document.getElementById("risk-position"),
  riskPositionAmount: document.getElementById("risk-position-amount"),
  riskStopLoss: document.getElementById("risk-stop-loss"),
  riskLossCap: document.getElementById("risk-loss-cap"),
  riskTakeProfit: document.getElementById("risk-take-profit"),
  riskChaseAdd: document.getElementById("risk-chase-add"),
  dailySummary: document.getElementById("daily-summary"),
  tomorrowPlan: document.getElementById("tomorrow-plan"),
  violationCount: document.getElementById("violation-count"),
  penaltyToday: document.getElementById("penalty-today"),
  penaltyNextDay: document.getElementById("penalty-next-day"),
  installApp: document.getElementById("install-app"),
  installStatus: document.getElementById("install-status"),
  saveReview: document.getElementById("save-review"),
  exportMarkdown: document.getElementById("export-markdown"),
  resetReview: document.getElementById("reset-review"),
  mobileSave: document.getElementById("mobile-save"),
  mobileAddTrade: document.getElementById("mobile-add-trade"),
  markdownPreview: document.getElementById("markdown-preview"),
  enableNotification: document.getElementById("enable-notification"),
  notificationState: document.getElementById("notification-state"),
  tradeRowTemplate: document.getElementById("trade-row-template"),
  tierCards: Array.from(document.querySelectorAll(".tier-card")),
};

let saveTimer = null;

function todayLocalISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function storageKey(date) {
  return `trade-discipline-review:${date}`;
}

function notificationKey(date) {
  return `trade-discipline-reminded:${date}`;
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setInstallStatus(message) {
  if (dom.installStatus) {
    dom.installStatus.textContent = message;
  }
}

function updateInstallState() {
  if (!dom.installApp) {
    return;
  }

  if (isStandaloneMode()) {
    dom.installApp.textContent = "已安装";
    dom.installApp.disabled = true;
    setInstallStatus("当前已作为 App 运行");
    return;
  }

  dom.installApp.disabled = false;
  dom.installApp.textContent = "安装 App";
  setInstallStatus(deferredInstallPrompt ? "已可安装，适合加到主屏幕或桌面" : "也可用浏览器菜单手动“添加到主屏幕”");
}

function isSmallScreen() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function createDefaultTrade() {
  return {
    symbol: "",
    reason: "",
    execution: "",
    score: "100",
    note: "",
  };
}

function getDefaultState() {
  return {
    date: todayLocalISO(),
    accountSize: DEFAULT_ACCOUNT_SIZE,
    violations: {
      chaseHigh: "no",
      noStop: "no",
      emotional: "no",
    },
    strategy: {
      hot: "yes",
      volume: "yes",
      trend: "yes",
    },
    trades: Array.from({ length: DEFAULT_TRADE_COUNT }, createDefaultTrade),
    risk: {
      position: "yes",
      positionAmount: "yes",
      stopLoss: "yes",
      lossCap: "yes",
      takeProfit: "yes",
      chaseAdd: "no",
    },
    dailySummary: "",
    tomorrowPlan: "明天我只做：",
  };
}

function loadState(date) {
  const raw = localStorage.getItem(storageKey(date));
  if (!raw) {
    const defaults = getDefaultState();
    defaults.date = date;
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultState(),
      ...parsed,
      date,
      violations: { ...getDefaultState().violations, ...(parsed.violations || {}) },
      strategy: { ...getDefaultState().strategy, ...(parsed.strategy || {}) },
      risk: { ...getDefaultState().risk, ...(parsed.risk || {}) },
      trades: Array.isArray(parsed.trades) && parsed.trades.length > 0 ? parsed.trades : Array.from({ length: DEFAULT_TRADE_COUNT }, createDefaultTrade),
    };
  } catch {
    const defaults = getDefaultState();
    defaults.date = date;
    return defaults;
  }
}

function readStateFromForm() {
  const trades = Array.from(dom.tradeList.querySelectorAll(".trade-card")).map((card) => ({
    symbol: card.querySelector(".trade-symbol").value.trim(),
    reason: card.querySelector(".trade-reason").value.trim(),
    execution: card.querySelector(".trade-execution").value.trim(),
    score: card.querySelector(".trade-score").value,
    note: card.querySelector(".trade-note").value.trim(),
  }));

  return {
    date: dom.reviewDate.value,
    accountSize: Number(dom.accountSize.value) || 0,
    violations: {
      chaseHigh: dom.violationChaseHigh.value,
      noStop: dom.violationNoStop.value,
      emotional: dom.violationEmotional.value,
    },
    strategy: {
      hot: dom.strategyHot.value,
      volume: dom.strategyVolume.value,
      trend: dom.strategyTrend.value,
    },
    trades,
    risk: {
      position: dom.riskPosition.value,
      positionAmount: dom.riskPositionAmount.value,
      stopLoss: dom.riskStopLoss.value,
      lossCap: dom.riskLossCap.value,
      takeProfit: dom.riskTakeProfit.value,
      chaseAdd: dom.riskChaseAdd.value,
    },
    dailySummary: dom.dailySummary.value.trim(),
    tomorrowPlan: dom.tomorrowPlan.value.trim(),
  };
}

function setSaveStatus(text, tone = "neutral") {
  dom.saveStatus.textContent = text;
  dom.saveStatus.style.color = tone === "good" ? "var(--good)" : tone === "danger" ? "var(--danger)" : "var(--muted)";
}

function renderTradeRow(trade, index) {
  const fragment = dom.tradeRowTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".trade-card");

  card.querySelector(".trade-number").textContent = `交易 ${index + 1}`;
  card.querySelector(".trade-symbol").value = trade.symbol || "";
  card.querySelector(".trade-reason").value = trade.reason || "";
  card.querySelector(".trade-execution").value = trade.execution || "";
  card.querySelector(".trade-score").value = trade.score || "100";
  card.querySelector(".trade-note").value = trade.note || "";

  const removeButton = card.querySelector(".remove-trade");
  removeButton.addEventListener("click", () => {
    if (dom.tradeList.children.length <= 1) {
      return;
    }
    card.remove();
    renumberTrades();
    recomputeAndPreview();
    queueAutoSave();
  });

  const inputs = card.querySelectorAll("input, select");
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      recomputeAndPreview();
      queueAutoSave();
    });
    input.addEventListener("change", () => {
      recomputeAndPreview();
      queueAutoSave();
    });
  });

  dom.tradeList.appendChild(fragment);
}

function renumberTrades() {
  Array.from(dom.tradeList.querySelectorAll(".trade-card")).forEach((card, index) => {
    card.querySelector(".trade-number").textContent = `交易 ${index + 1}`;
  });
}

function fillForm(state) {
  dom.reviewDate.value = state.date;
  dom.accountSize.value = state.accountSize;

  dom.violationChaseHigh.value = state.violations.chaseHigh;
  dom.violationNoStop.value = state.violations.noStop;
  dom.violationEmotional.value = state.violations.emotional;

  dom.strategyHot.value = state.strategy.hot;
  dom.strategyVolume.value = state.strategy.volume;
  dom.strategyTrend.value = state.strategy.trend;

  dom.tradeList.innerHTML = "";
  state.trades.forEach((trade, index) => renderTradeRow(trade, index));

  dom.riskPosition.value = state.risk.position;
  dom.riskPositionAmount.value = state.risk.positionAmount;
  dom.riskStopLoss.value = state.risk.stopLoss;
  dom.riskLossCap.value = state.risk.lossCap;
  dom.riskTakeProfit.value = state.risk.takeProfit;
  dom.riskChaseAdd.value = state.risk.chaseAdd;

  dom.dailySummary.value = state.dailySummary;
  dom.tomorrowPlan.value = state.tomorrowPlan || "明天我只做：";

  recomputeAndPreview();
}

function formatAmount(amount) {
  return `${Number(amount || 0).toFixed(0)}u`;
}

function renderSizingTable(accountSize) {
  dom.tierCards.forEach((card) => {
    const ratio = Number(card.dataset.tierRatio || 0);
    const amount = Math.round(accountSize * ratio);
    const risk = Math.round(amount * 0.1);
    const lockedProfit = Math.round(amount * 0.15);

    card.querySelector(".tier-amount").textContent = `${amount}u`;
    card.querySelector(".tier-risk").textContent = `止损约 ${risk}u`;
    card.querySelector(".tier-profit").textContent = `先落袋约 ${lockedProfit}u`;
  });
}

function setSimpleMode(enabled, persist = true) {
  document.body.classList.toggle("simple-mode", enabled);
  dom.simpleModeToggle.textContent = enabled ? "极简模式：开" : "极简模式：关";
  dom.mobileModeToggle.textContent = enabled ? "完整模式" : "极简模式";

  if (persist) {
    localStorage.setItem(SIMPLE_MODE_KEY, enabled ? "yes" : "no");
  }
}

function toggleSimpleMode() {
  setSimpleMode(!document.body.classList.contains("simple-mode"));
}

function initSimpleMode() {
  const saved = localStorage.getItem(SIMPLE_MODE_KEY);
  const enabled = saved ? saved === "yes" : isSmallScreen();
  setSimpleMode(enabled, false);
}

function addTradeRow() {
  renderTradeRow(createDefaultTrade(), dom.tradeList.children.length);
  renumberTrades();
  recomputeAndPreview();
  queueAutoSave();
}

async function registerPWA() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch {
      setInstallStatus("离线安装未注册成功，但页面仍可正常使用");
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallState();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    updateInstallState();
  });
}

async function promptInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallState();
    return;
  }

  updateInstallState();
}

function computeDerived(state) {
  const accountSize = Number(state.accountSize) || 0;
  const positionLimit = accountSize * 0.1;
  const lossLimit = positionLimit * 0.1;
  const takeProfitLock = positionLimit * 0.15;

  const explicitViolations = [
    state.violations.chaseHigh === "yes",
    state.violations.noStop === "yes",
    state.violations.emotional === "yes",
  ];

  const overallViolation = explicitViolations.some(Boolean) ? "是" : "否";
  const strategyOk = [state.strategy.hot, state.strategy.volume, state.strategy.trend].every((item) => item === "yes");

  const scores = state.trades.map((trade) => Number(trade.score) || 0);
  const averageScore = scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
  const zeroScoreCount = scores.filter((score) => score === 0).length;
  const violationCount = explicitViolations.filter(Boolean).length;

  const hasHardStop = zeroScoreCount > 0 || violationCount >= 3 || state.violations.emotional === "yes";
  let penaltyToday = "无";
  let penaltyNextDay = "正常执行：单笔 ≤ 10%";

  if (hasHardStop) {
    penaltyToday = "情绪或严重违规，立即结束当日交易";
    penaltyNextDay = "次日停止实盘，只允许复盘和观察";
  } else if (violationCount >= 2) {
    penaltyToday = "中度违规，立即压缩出手机会";
    penaltyNextDay = "次日只允许 1 笔试错单，单笔 ≤ 5%";
  } else if (violationCount >= 1) {
    penaltyToday = "轻度违规，立即降仓";
    penaltyNextDay = "次日单笔 ≤ 5%，且最多 2 笔";
  }

  return {
    positionLimit,
    lossLimit,
    takeProfitLock,
    overallViolation,
    strategyOk,
    averageScore,
    zeroScoreCount,
    violationCount,
    penaltyToday,
    penaltyNextDay,
  };
}

function generateMarkdown(state, derived) {
  const tradeRows = state.trades
    .map(
      (trade, index) =>
        `| ${index + 1} | ${trade.symbol || ""} | ${trade.reason || ""} | ${trade.execution || ""} | ${trade.score || ""} | ${trade.note || ""} |`
    )
    .join("\n");

  return `# 每日交易复盘 - ${state.date}

## 1. 今日是否违规

- 今日是否违规（是/否）：${derived.overallViolation}
- 是否追高（是/否）：${state.violations.chaseHigh === "yes" ? "是" : "否"}
- 是否未执行止损（是/否）：${state.violations.noStop === "yes" ? "是" : "否"}
- 是否情绪下单（是/否）：${state.violations.emotional === "yes" ? "是" : "否"}

## 2. 今日交易是否符合策略

- 是否只做热点（是/否）：${state.strategy.hot === "yes" ? "是" : "否"}
- 是否有成交量（是/否）：${state.strategy.volume === "yes" ? "是" : "否"}
- 是否在上涨趋势中入场（是/否）：${state.strategy.trend === "yes" ? "是" : "否"}

## 3. 每笔交易评分

评分标准：

- 完全按规则执行：\`100分\`
- 部分违规：\`60分\`
- 情绪交易：\`0分\`

| 交易编号 | 标的/方向 | 入场理由 | 是否按规则执行 | 评分 | 备注 |
| --- | --- | --- | --- | --- | --- |
${tradeRows}

- 今日平均分：${derived.averageScore}

## 4. 风控检查

- 单笔仓位是否 \`<= 10%\`：${state.risk.position === "yes" ? "是" : "否"}
- 若账户为 \`${state.accountSize}u\`，单笔是否 \`<= ${Math.round(derived.positionLimit)}u\`：${state.risk.positionAmount === "yes" ? "是" : "否"}
- 每笔是否执行 \`-10%\` 止损：${state.risk.stopLoss === "yes" ? "是" : "否"}
- 若账户为 \`${state.accountSize}u\`，单笔实际亏损是否控制在约 \`${Math.round(derived.lossLimit)}u\` 内：${state.risk.lossCap === "yes" ? "是" : "否"}
- 是否执行 \`+30%\` 卖一半：${state.risk.takeProfit === "yes" ? "是" : "否"}
- 是否存在追涨加仓：${state.risk.chaseAdd === "yes" ? "是" : "否"}

## 5. 今日总结

- 今日总结（1句话）：${state.dailySummary || ""}

## 6. 明日计划

- ${state.tomorrowPlan || "明天我只做：____"}

## 7. 处罚结果

- 今日触发的处罚：${derived.penaltyToday}
- 明日执行限制：${derived.penaltyNextDay}
`;
}

function recomputeAndPreview() {
  const state = readStateFromForm();
  const derived = computeDerived(state);

  dom.positionLimit.textContent = formatAmount(derived.positionLimit);
  dom.lossLimit.textContent = formatAmount(derived.lossLimit);
  dom.takeProfitLock.textContent = formatAmount(derived.takeProfitLock);
  renderSizingTable(Number(state.accountSize) || 0);
  dom.overallViolation.textContent = derived.overallViolation;
  dom.strategyResult.textContent = derived.strategyOk ? "符合" : "不符合";
  dom.averageScore.textContent = String(derived.averageScore);
  dom.zeroScoreCount.textContent = String(derived.zeroScoreCount);
  dom.violationCount.textContent = String(derived.violationCount);
  dom.penaltyToday.textContent = derived.penaltyToday;
  dom.penaltyNextDay.textContent = derived.penaltyNextDay;
  dom.markdownPreview.textContent = generateMarkdown(state, derived);
}

function saveCurrentReview() {
  const state = readStateFromForm();
  localStorage.setItem(storageKey(state.date), JSON.stringify(state));
  setSaveStatus(`已保存 ${new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`, "good");
}

function queueAutoSave() {
  setSaveStatus("自动保存中...");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(saveCurrentReview, 320);
}

function downloadMarkdown() {
  const state = readStateFromForm();
  const derived = computeDerived(state);
  const content = generateMarkdown(state, derived);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.date}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetCurrentReview() {
  const date = dom.reviewDate.value;
  localStorage.removeItem(storageKey(date));
  fillForm(loadState(date));
  setSaveStatus("已清空", "danger");
}

function ensureTomorrowPlanPrefix() {
  const value = dom.tomorrowPlan.value.trimStart();
  if (!value) {
    dom.tomorrowPlan.value = "明天我只做：";
    return;
  }
  if (!value.startsWith("明天我只做：")) {
    dom.tomorrowPlan.value = `明天我只做：${value}`;
  }
}

function notifyIfNeeded() {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return;
  }

  const now = new Date();
  const today = todayLocalISO();
  const alreadyNotified = localStorage.getItem(notificationKey(today)) === "yes";

  if (alreadyNotified) {
    return;
  }

  if (now.getHours() === REMINDER_HOUR && now.getMinutes() === REMINDER_MINUTE) {
    new Notification("每日交易复盘", {
      body: "请按模板完成复盘：100u 上限、-10% 止损、+30% 卖半、禁止追涨加仓。",
    });
    localStorage.setItem(notificationKey(today), "yes");
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    dom.notificationState.textContent = "当前浏览器不支持通知";
    return;
  }

  const result = await Notification.requestPermission();
  if (result === "granted") {
    dom.notificationState.textContent = "通知已授权，页面打开时会在 09:00 提醒";
  } else {
    dom.notificationState.textContent = "通知未授权，仍可手动使用本页复盘";
  }
}

function updateNotificationState() {
  if (!("Notification" in window)) {
    dom.notificationState.textContent = "当前浏览器不支持通知";
    return;
  }

  const map = {
    granted: "通知已授权，页面打开时会在 09:00 提醒",
    denied: "通知被拒绝，可继续手动复盘",
    default: "尚未授权通知",
  };

  dom.notificationState.textContent = map[Notification.permission] || map.default;
}

function attachCoreListeners() {
  const formInputs = document.querySelectorAll("input, select, textarea");
  formInputs.forEach((element) => {
    element.addEventListener("input", () => {
      if (element === dom.tomorrowPlan) {
        ensureTomorrowPlanPrefix();
      }
      recomputeAndPreview();
      queueAutoSave();
    });
    element.addEventListener("change", () => {
      recomputeAndPreview();
      queueAutoSave();
    });
  });

  dom.reviewDate.addEventListener("change", () => {
    const nextState = loadState(dom.reviewDate.value);
    fillForm(nextState);
    setSaveStatus("已切换日期");
  });

  dom.addTrade.addEventListener("click", addTradeRow);
  dom.mobileAddTrade.addEventListener("click", addTradeRow);

  dom.saveReview.addEventListener("click", saveCurrentReview);
  dom.mobileSave.addEventListener("click", saveCurrentReview);
  dom.exportMarkdown.addEventListener("click", downloadMarkdown);
  dom.resetReview.addEventListener("click", resetCurrentReview);
  dom.enableNotification.addEventListener("click", requestNotificationPermission);
  dom.simpleModeToggle.addEventListener("click", toggleSimpleMode);
  dom.mobileModeToggle.addEventListener("click", toggleSimpleMode);
  if (dom.installApp) {
    dom.installApp.addEventListener("click", promptInstall);
  }
}

function init() {
  const initialDate = todayLocalISO();
  initSimpleMode();
  dom.reviewDate.value = initialDate;
  fillForm(loadState(initialDate));
  updateNotificationState();
  attachCoreListeners();
  setSaveStatus("本地模式");
  registerPWA();
  updateInstallState();
  window.setInterval(notifyIfNeeded, 30_000);
  notifyIfNeeded();
}

init();

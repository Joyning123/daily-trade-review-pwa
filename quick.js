const QUICK_DEFAULT_ACCOUNT_SIZE = 1000;
const QUICK_STORAGE_KEY = "trade-discipline-review:";
let quickDeferredInstallPrompt = null;

const dom = {
  date: document.getElementById("quick-date"),
  accountSize: document.getElementById("quick-account-size"),
  tradeCount: document.getElementById("quick-trade-count"),
  overallViolation: document.getElementById("quick-overall-violation"),
  strategyResult: document.getElementById("quick-strategy-result"),
  averageScore: document.getElementById("quick-average-score"),
  violationCount: document.getElementById("quick-violation-count"),
  nextDayLimit: document.getElementById("quick-next-day-limit"),
  penaltyToday: document.getElementById("quick-penalty-today"),
  penaltyNext: document.getElementById("quick-penalty-next"),
  summary: document.getElementById("quick-summary"),
  plan: document.getElementById("quick-plan"),
  save: document.getElementById("quick-save"),
  export: document.getElementById("quick-export"),
  installApp: document.getElementById("quick-install-app"),
  installStatus: document.getElementById("quick-install-status"),
  scoreItems: Array.from(document.querySelectorAll(".quick-score-item")),
  toggleGroups: Array.from(document.querySelectorAll(".toggle-group")),
};

function todayLocalISO() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function storageKey(date) {
  return `${QUICK_STORAGE_KEY}${date}`;
}

function isStandaloneMode() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setInstallStatus(message) {
  dom.installStatus.textContent = message;
}

function updateInstallState() {
  if (isStandaloneMode()) {
    dom.installApp.textContent = "已安装";
    dom.installApp.disabled = true;
    setInstallStatus("当前已作为 App 运行");
    return;
  }

  dom.installApp.disabled = false;
  dom.installApp.textContent = "安装 App";
  setInstallStatus(quickDeferredInstallPrompt ? "已可安装，适合加到主屏幕或桌面" : "也可用浏览器菜单手动“添加到主屏幕”");
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
    quickDeferredInstallPrompt = event;
    updateInstallState();
  });

  window.addEventListener("appinstalled", () => {
    quickDeferredInstallPrompt = null;
    updateInstallState();
  });
}

async function promptInstall() {
  if (quickDeferredInstallPrompt) {
    quickDeferredInstallPrompt.prompt();
    await quickDeferredInstallPrompt.userChoice;
    quickDeferredInstallPrompt = null;
  }

  updateInstallState();
}

function createEmptyTrade(score = "100") {
  return {
    symbol: "",
    reason: "",
    execution: scoreToExecution(score),
    score: String(score),
    note: "",
  };
}

function scoreToExecution(score) {
  const map = {
    100: "完全按规则执行",
    60: "部分违规",
    0: "情绪交易",
  };

  return map[String(score)] || "";
}

function getDefaultState() {
  return {
    date: todayLocalISO(),
    accountSize: QUICK_DEFAULT_ACCOUNT_SIZE,
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
    risk: {
      position: "yes",
      positionAmount: "yes",
      stopLoss: "yes",
      lossCap: "yes",
      takeProfit: "yes",
      chaseAdd: "no",
    },
    trades: [],
    dailySummary: "",
    tomorrowPlan: "明天我只做：",
  };
}

function loadState(date) {
  const raw = localStorage.getItem(storageKey(date));
  if (!raw) {
    const fallback = getDefaultState();
    fallback.date = date;
    return fallback;
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
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
    };
  } catch {
    const fallback = getDefaultState();
    fallback.date = date;
    return fallback;
  }
}

function syncToggleGroup(group, value) {
  const input = document.getElementById(group.dataset.target);
  if (!input) {
    return;
  }

  input.value = String(value);
  group.querySelectorAll(".toggle-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === String(value));
  });
}

function setupToggleGroups() {
  dom.toggleGroups.forEach((group) => {
    group.addEventListener("click", (event) => {
      const button = event.target.closest(".toggle-button");
      if (!button) {
        return;
      }
      syncToggleGroup(group, button.dataset.value);
      render();
      saveCurrentReview();
    });
  });
}

function updateScoreVisibility(count) {
  dom.scoreItems.forEach((item) => {
    item.classList.toggle("is-hidden", Number(item.dataset.tradeIndex) >= count);
  });
}

function fillForm(state) {
  dom.date.value = state.date;
  dom.accountSize.value = state.accountSize;
  dom.tradeCount.value = String(Math.min(state.trades.length, 3));

  syncToggleGroup(document.querySelector('[data-target="quick-violation-chase"]'), state.violations.chaseHigh);
  syncToggleGroup(document.querySelector('[data-target="quick-violation-stop"]'), state.violations.noStop);
  syncToggleGroup(document.querySelector('[data-target="quick-violation-emotional"]'), state.violations.emotional);
  syncToggleGroup(document.querySelector('[data-target="quick-strategy-hot"]'), state.strategy.hot);
  syncToggleGroup(document.querySelector('[data-target="quick-strategy-volume"]'), state.strategy.volume);
  syncToggleGroup(document.querySelector('[data-target="quick-strategy-trend"]'), state.strategy.trend);
  syncToggleGroup(document.querySelector('[data-target="quick-risk-position"]'), state.risk.position);
  syncToggleGroup(document.querySelector('[data-target="quick-risk-stop"]'), state.risk.stopLoss);
  syncToggleGroup(document.querySelector('[data-target="quick-risk-profit"]'), state.risk.takeProfit);
  syncToggleGroup(document.querySelector('[data-target="quick-risk-chase-add"]'), state.risk.chaseAdd);

  for (let index = 0; index < 3; index += 1) {
    const trade = state.trades[index] || createEmptyTrade();
    syncToggleGroup(document.querySelector(`[data-target="quick-trade-score-${index}"]`), trade.score || "100");
  }

  dom.summary.value = state.dailySummary || "";
  dom.plan.value = state.tomorrowPlan || "明天我只做：";
  updateScoreVisibility(Number(dom.tradeCount.value));
  render();
}

function ensureTomorrowPlanPrefix() {
  const value = dom.plan.value.trimStart();
  if (!value) {
    dom.plan.value = "明天我只做：";
    return;
  }
  if (!value.startsWith("明天我只做：")) {
    dom.plan.value = `明天我只做：${value}`;
  }
}

function readStateFromForm() {
  const tradeCount = Number(dom.tradeCount.value) || 0;
  const trades = [];

  for (let index = 0; index < tradeCount; index += 1) {
    const score = document.getElementById(`quick-trade-score-${index}`).value;
    trades.push(createEmptyTrade(score));
  }

  return {
    date: dom.date.value,
    accountSize: Number(dom.accountSize.value) || 0,
    violations: {
      chaseHigh: document.getElementById("quick-violation-chase").value,
      noStop: document.getElementById("quick-violation-stop").value,
      emotional: document.getElementById("quick-violation-emotional").value,
    },
    strategy: {
      hot: document.getElementById("quick-strategy-hot").value,
      volume: document.getElementById("quick-strategy-volume").value,
      trend: document.getElementById("quick-strategy-trend").value,
    },
    risk: {
      position: document.getElementById("quick-risk-position").value,
      positionAmount: document.getElementById("quick-risk-position").value,
      stopLoss: document.getElementById("quick-risk-stop").value,
      lossCap: document.getElementById("quick-risk-stop").value,
      takeProfit: document.getElementById("quick-risk-profit").value,
      chaseAdd: document.getElementById("quick-risk-chase-add").value,
    },
    trades,
    dailySummary: dom.summary.value.trim(),
    tomorrowPlan: dom.plan.value.trim(),
  };
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
  const tradeRows = state.trades.length > 0
    ? state.trades
        .map(
          (trade, index) =>
            `| ${index + 1} | ${trade.symbol || ""} | ${trade.reason || ""} | ${trade.execution || ""} | ${trade.score || ""} | ${trade.note || ""} |`
        )
        .join("\n")
    : "| 1 |  |  |  |  |  |";

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

function render() {
  const state = readStateFromForm();
  const derived = computeDerived(state);
  dom.overallViolation.textContent = derived.overallViolation;
  dom.strategyResult.textContent = derived.strategyOk ? "符合" : "不符合";
  dom.averageScore.textContent = String(derived.averageScore);
  dom.violationCount.textContent = String(derived.violationCount);
  dom.nextDayLimit.textContent = derived.penaltyNextDay.replace("次日", "");
  dom.penaltyToday.textContent = derived.penaltyToday;
  dom.penaltyNext.textContent = derived.penaltyNextDay;
}

function saveCurrentReview() {
  const state = readStateFromForm();
  localStorage.setItem(storageKey(state.date), JSON.stringify(state));
}

function downloadMarkdown() {
  const state = readStateFromForm();
  const derived = computeDerived(state);
  const content = generateMarkdown(state, derived);
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.date}-quick.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function attachListeners() {
  [dom.date, dom.accountSize, dom.tradeCount, dom.summary, dom.plan].forEach((element) => {
    element.addEventListener("input", () => {
      if (element === dom.plan) {
        ensureTomorrowPlanPrefix();
      }
      if (element === dom.tradeCount) {
        updateScoreVisibility(Number(dom.tradeCount.value));
      }
      render();
      saveCurrentReview();
    });
    element.addEventListener("change", () => {
      if (element === dom.date) {
        fillForm(loadState(dom.date.value));
        return;
      }
      if (element === dom.tradeCount) {
        updateScoreVisibility(Number(dom.tradeCount.value));
      }
      render();
      saveCurrentReview();
    });
  });

  dom.save.addEventListener("click", saveCurrentReview);
  dom.export.addEventListener("click", downloadMarkdown);
  dom.installApp.addEventListener("click", promptInstall);
}

function init() {
  const initialDate = todayLocalISO();
  dom.date.value = initialDate;
  fillForm(loadState(initialDate));
  setupToggleGroups();
  attachListeners();
  registerPWA();
  updateInstallState();
}

init();

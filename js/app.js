import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc, doc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (!user) signInAnonymously(auth).catch((err) => {
    console.error("Anonymous sign-in failed", err);
    showToast("Couldn't connect to the shared database. Check js/firebase-config.js.");
  });
});

// ---------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------
function showToast(msg, ms = 2600) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.add("hidden"), ms);
}

function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function timeAgo(date) {
  if (!date) return "";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

export function generateDistractors(answer, pool) {
  const numRegex = /\d+(\.\d+)?/;
  const match = answer.match(numRegex);
  if (match) {
    const original = match[0];
    const hasDecimal = original.includes(".");
    const decimals = hasDecimal ? original.split(".")[1].length : 0;
    const num = parseFloat(original);
    const factors = shuffleArr([0.5, 0.6, 0.75, 1.25, 1.5, 1.75, 2, 2.5]);
    const used = new Set([hasDecimal ? num.toFixed(decimals) : String(num)]);
    const results = [];
    for (const f of factors) {
      if (results.length === 3) break;
      let newNum = num * f;
      newNum = hasDecimal ? parseFloat(newNum.toFixed(decimals)) : Math.round(newNum);
      const newStr = hasDecimal ? newNum.toFixed(decimals) : String(newNum);
      if (!used.has(newStr) && newNum > 0) {
        used.add(newStr);
        results.push(answer.replace(original, newStr));
      }
    }
    let guard = 0;
    while (results.length < 3 && guard < 20) {
      guard++;
      const f = 1 + (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random());
      let newNum = num * f;
      newNum = hasDecimal ? parseFloat(newNum.toFixed(decimals)) : Math.round(newNum);
      const newStr = hasDecimal ? newNum.toFixed(decimals) : String(newNum);
      if (!used.has(newStr) && newNum > 0) {
        used.add(newStr);
        results.push(answer.replace(original, newStr));
      }
    }
    return results.slice(0, 3);
  } else {
    const others = (pool || []).filter(
      (a) => a && a.trim().toLowerCase() !== answer.trim().toLowerCase()
    );
    const uniqueOthers = [...new Set(others)];
    const results = shuffleArr(uniqueOthers).slice(0, 3);
    const fallbacks = ["None of the above", "All of the above", "Not enough information given"];
    let fi = 0;
    while (results.length < 3) {
      results.push(fallbacks[fi] || `Alternative answer ${fi + 1}`);
      fi++;
    }
    return results;
  }
}

// ---------------------------------------------------------------
// Weeks — Week 1 = Mon Jul 13 2026 - Sun Jul 19 2026, then +7 days each week
// ---------------------------------------------------------------
const WEEK_ANCHOR = new Date(2026, 6, 13); // July 13, 2026 (month is 0-indexed)

export function computeWeek(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const anchor = new Date(WEEK_ANCHOR.getFullYear(), WEEK_ANCHOR.getMonth(), WEEK_ANCHOR.getDate());
  const diffDays = Math.round((d - anchor) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

// ---------------------------------------------------------------
// Name gate / current user
// ---------------------------------------------------------------
const nameGate = document.getElementById("nameGate");
const appRoot = document.getElementById("app");
const nameInput = document.getElementById("nameInput");
const currentUserLabel = document.getElementById("currentUserLabel");

function getCurrentUser() {
  return localStorage.getItem("leoprep_username") || "";
}

function setCurrentUser(name) {
  localStorage.setItem("leoprep_username", name);
  currentUserLabel.textContent = name;
}

function initNameGate() {
  const existing = getCurrentUser();
  if (existing) {
    currentUserLabel.textContent = existing;
    nameGate.classList.add("hidden");
    appRoot.classList.remove("hidden");
  } else {
    nameGate.classList.remove("hidden");
    appRoot.classList.add("hidden");
  }
}

document.getElementById("nameSubmit").addEventListener("click", () => {
  const val = nameInput.value.trim();
  if (!val) { nameInput.focus(); return; }
  setCurrentUser(val);
  nameGate.classList.add("hidden");
  appRoot.classList.remove("hidden");
});
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("nameSubmit").click();
});

document.getElementById("changeNameBtn").addEventListener("click", () => {
  nameInput.value = getCurrentUser();
  nameGate.classList.remove("hidden");
  appRoot.classList.add("hidden");
  nameInput.focus();
});

initNameGate();

// ---------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

export function switchTab(tabName) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tabName));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${tabName}`));
}

// ---------------------------------------------------------------
// Question bank (Firestore: "questions")
// ---------------------------------------------------------------
let questions = []; // local cache, live-synced
let editingId = null;
let editingWeek = null;

const questionForm = document.getElementById("questionForm");
const qType = document.getElementById("qType");
const qQuestion = document.getElementById("qQuestion");
const qAnswer = document.getElementById("qAnswer");
const qCategory = document.getElementById("qCategory");
const qCategoryTF = document.getElementById("qCategoryTF");
const qTFAnswer = document.getElementById("qTFAnswer");
const qGold = document.getElementById("qGold");
const standardAnswerFields = document.getElementById("standardAnswerFields");
const tfAnswerFields = document.getElementById("tfAnswerFields");
const distractorFields = document.getElementById("distractorFields");
const genDistractorsBtn = document.getElementById("genDistractorsBtn");
const questionList = document.getElementById("questionList");
const questionCount = document.getElementById("questionCount");
const bankSearch = document.getElementById("bankSearch");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const categoryList = document.getElementById("categoryList");
const studyCategory = document.getElementById("studyCategory");
const studyWeek = document.getElementById("studyWeek");

qType.addEventListener("change", () => {
  const isTF = qType.value === "truefalse";
  standardAnswerFields.classList.toggle("hidden", isTF);
  tfAnswerFields.classList.toggle("hidden", !isTF);
  if (isTF) distractorFields.classList.add("hidden");
});

const questionsQuery = query(collection(db, "questions"), orderBy("createdAt", "desc"));
onSnapshot(questionsQuery, (snap) => {
  questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderQuestionList();
  renderFilterOptions();
}, (err) => {
  console.error(err);
  questionList.innerHTML = `<p class="muted small">Couldn't load the question bank. Check your Firebase setup in js/firebase-config.js and README.md.</p>`;
});

genDistractorsBtn.addEventListener("click", () => {
  const answer = qAnswer.value.trim();
  if (!answer) { qAnswer.focus(); return; }
  const pool = questions.filter((q) => q.type !== "truefalse").map((q) => q.answer);
  const [d0, d1, d2] = generateDistractors(answer, pool);
  document.getElementById("d0").value = d0;
  document.getElementById("d1").value = d1;
  document.getElementById("d2").value = d2;
  distractorFields.classList.remove("hidden");
});

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  const type = qType.value;
  const question = qQuestion.value.trim();
  const gold = qGold.checked;
  if (!question) return;

  let payload = { question, type, gold, updatedBy: user, updatedAt: serverTimestamp() };

  if (type === "truefalse") {
    payload.answer = qTFAnswer.value;
    payload.category = qCategoryTF.value.trim();
    payload.distractors = [];
  } else {
    const answer = qAnswer.value.trim();
    if (!answer) { qAnswer.focus(); return; }
    payload.answer = answer;
    payload.category = qCategory.value.trim();
    payload.distractors = distractorFields.classList.contains("hidden")
      ? []
      : ["d0", "d1", "d2"].map((id) => document.getElementById(id).value.trim()).filter(Boolean);
  }

  try {
    if (editingId) {
      await updateDoc(doc(db, "questions", editingId), payload);
      showToast("Question updated");
    } else {
      const now = new Date();
      await addDoc(collection(db, "questions"), {
        ...payload,
        week: computeWeek(now),
        createdBy: user, createdAt: serverTimestamp()
      });
      showToast("Question added to the bank");
    }
    resetQuestionForm();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check your Firebase setup.");
  }
});

cancelEditBtn.addEventListener("click", resetQuestionForm);

function resetQuestionForm() {
  editingId = null;
  editingWeek = null;
  questionForm.reset();
  qType.value = "standard";
  standardAnswerFields.classList.remove("hidden");
  tfAnswerFields.classList.add("hidden");
  distractorFields.classList.add("hidden");
  cancelEditBtn.classList.add("hidden");
  questionForm.querySelector("button[type=submit]").textContent = "Save to question bank";
}

function renderFilterOptions() {
  const cats = [...new Set(questions.map((q) => q.category).filter(Boolean))].sort();
  categoryList.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join("");
  const prevCat = studyCategory.value;
  studyCategory.innerHTML = `<option value="all">All categories</option>` +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if ([...studyCategory.options].some((o) => o.value === prevCat)) studyCategory.value = prevCat;

  const weeks = [...new Set(questions.map((q) => q.week).filter((w) => w !== undefined && w !== null))].sort((a, b) => a - b);
  const prevWeek = studyWeek.value;
  studyWeek.innerHTML = `<option value="all">All weeks</option>` +
    weeks.map((w) => `<option value="${w}">Week ${w}</option>`).join("");
  if ([...studyWeek.options].some((o) => o.value === prevWeek)) studyWeek.value = prevWeek;
}

function renderQuestionList() {
  const term = bankSearch.value.trim().toLowerCase();
  const filtered = questions.filter((q) =>
    !term || q.question.toLowerCase().includes(term) || q.answer.toLowerCase().includes(term) || (q.category || "").toLowerCase().includes(term)
  );
  questionCount.textContent = `(${questions.length})`;

  if (filtered.length === 0) {
    questionList.innerHTML = `<p class="muted small">No questions yet. Add your first one above.</p>`;
    return;
  }

  questionList.innerHTML = filtered.map((q) => {
    const created = q.createdAt?.toDate ? timeAgo(q.createdAt.toDate()) : "";
    const editedNote = (q.updatedBy && q.updatedBy !== q.createdBy) ? ` &middot; edited by ${escapeHtml(q.updatedBy)}` : "";
    const isTF = q.type === "truefalse";
    return `
      <div class="question-card ${q.gold ? "gold-card" : ""}" data-id="${q.id}">
        <div class="q-top">
          <div>
            <span class="q-type-tag">${isTF ? "True / False" : "Standard"}</span>
            <p class="q-text">${escapeHtml(q.question)}</p>
            <p class="q-answer">&#10003; ${escapeHtml(q.answer)}</p>
            ${!isTF ? (q.distractors && q.distractors.length ? `<p class="q-distractors">Wrong answers: ${q.distractors.map(escapeHtml).join(" &nbsp;|&nbsp; ")}</p>` : `<p class="q-distractors">No multiple-choice options yet</p>`) : ""}
            <div class="q-meta">
              ${q.category ? `<span class="q-category-tag">${escapeHtml(q.category)}</span>` : ""}
              ${q.week !== undefined ? `<span class="q-week-tag">Week ${q.week}</span>` : ""}
              <span>added by <strong>${escapeHtml(q.createdBy || "unknown")}</strong> ${created}${editedNote}</span>
            </div>
          </div>
          <div class="q-actions">
            <button class="gold-toggle-btn ${q.gold ? "is-gold" : ""}" data-action="gold" title="Toggle gold">&#11088;</button>
            <button class="btn btn-ghost small" data-action="edit">Edit</button>
            <button class="btn btn-danger small" data-action="delete">Delete</button>
          </div>
        </div>
      </div>`;
  }).join("");

  questionList.querySelectorAll(".question-card").forEach((card) => {
    const id = card.dataset.id;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => startEditQuestion(id));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => deleteQuestion(id));
    card.querySelector('[data-action="gold"]').addEventListener("click", () => toggleGold(id));
  });
}

async function toggleGold(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  try {
    await updateDoc(doc(db, "questions", id), { gold: !q.gold });
  } catch (err) {
    console.error(err);
    showToast("Couldn't update gold status.");
  }
}

function startEditQuestion(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  editingId = id;
  editingWeek = q.week;
  qType.value = q.type === "truefalse" ? "truefalse" : "standard";
  qType.dispatchEvent(new Event("change"));
  qQuestion.value = q.question;
  qGold.checked = !!q.gold;
  if (q.type === "truefalse") {
    qTFAnswer.value = q.answer;
    qCategoryTF.value = q.category || "";
  } else {
    qAnswer.value = q.answer;
    qCategory.value = q.category || "";
    if (q.distractors && q.distractors.length) {
      document.getElementById("d0").value = q.distractors[0] || "";
      document.getElementById("d1").value = q.distractors[1] || "";
      document.getElementById("d2").value = q.distractors[2] || "";
      distractorFields.classList.remove("hidden");
    }
  }
  cancelEditBtn.classList.remove("hidden");
  questionForm.querySelector("button[type=submit]").textContent = "Save changes";
  switchTab("bank");
  questionForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteQuestion(id) {
  if (!confirm("Delete this question for everyone?")) return;
  try {
    await deleteDoc(doc(db, "questions", id));
    showToast("Question deleted");
  } catch (err) {
    console.error(err);
    showToast("Delete failed.");
  }
}

bankSearch.addEventListener("input", renderQuestionList);

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Allow notes-assist.js to push a draft into this form
window.leoprepFillQuestionForm = (question, answer, opts = {}) => {
  resetQuestionForm();
  const type = opts.type === "truefalse" ? "truefalse" : "standard";
  qType.value = type;
  qType.dispatchEvent(new Event("change"));
  qQuestion.value = question;
  qGold.checked = !!opts.gold;
  if (type === "truefalse") {
    qTFAnswer.value = (answer === "False" ? "False" : "True");
  } else {
    qAnswer.value = answer;
  }
  switchTab("bank");
  questionForm.scrollIntoView({ behavior: "smooth" });
  if (question) qCategory.focus(); else qQuestion.focus();
};

// ---------------------------------------------------------------
// Study sessions
// ---------------------------------------------------------------
const startStudyBtn = document.getElementById("startStudyBtn");
const studyEmptyMsg = document.getElementById("studyEmptyMsg");
const studyArea = document.getElementById("studyArea");
const flashcardView = document.getElementById("flashcardView");
const mcView = document.getElementById("mcView");
const tfView = document.getElementById("tfView");
const flashcard = document.getElementById("flashcard");
const flashcardFront = document.getElementById("flashcardFront");
const flashcardBack = document.getElementById("flashcardBack");
const mcQuestion = document.getElementById("mcQuestion");
const mcOptions = document.getElementById("mcOptions");
const tfQuestion = document.getElementById("tfQuestion");
const tfTrueBtn = document.getElementById("tfTrueBtn");
const tfFalseBtn = document.getElementById("tfFalseBtn");
const progressLabel = document.getElementById("progressLabel");
const scoreLabel = document.getElementById("scoreLabel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const endStudyBtn = document.getElementById("endStudyBtn");
const markCorrectBtn = document.getElementById("markCorrectBtn");

let sessionQuestions = [];
let sessionIndex = 0;
let sessionFormat = "flashcard";
let sessionScore = 0;
let sessionWrong = 0;
let sessionAnswered = [];

startStudyBtn.addEventListener("click", () => {
  sessionFormat = document.getElementById("studyFormat").value;
  const cat = studyCategory.value;
  const wk = studyWeek.value;

  let pool = questions.filter((q) => (sessionFormat === "truefalse") === (q.type === "truefalse"));
  if (cat !== "all") pool = pool.filter((q) => q.category === cat);
  if (wk !== "all") pool = pool.filter((q) => String(q.week) === wk);

  if (pool.length === 0) {
    studyEmptyMsg.classList.remove("hidden");
    studyArea.classList.add("hidden");
    return;
  }
  studyEmptyMsg.classList.add("hidden");
  const shuffle = document.getElementById("shuffleToggle").checked;
  sessionQuestions = shuffle ? shuffleArr(pool) : [...pool];
  sessionIndex = 0;
  sessionScore = 0;
  sessionWrong = 0;
  sessionAnswered = new Array(sessionQuestions.length).fill(false);
  studyArea.classList.remove("hidden");
  markCorrectBtn.classList.toggle("hidden", sessionFormat !== "flashcard");
  renderStudyQuestion();
});

function updateScoreLabel() {
  scoreLabel.textContent = `\u2713 ${sessionScore}   \u2717 ${sessionWrong}`;
}

function renderStudyQuestion() {
  const q = sessionQuestions[sessionIndex];
  progressLabel.textContent = `${sessionIndex + 1} / ${sessionQuestions.length}`;
  updateScoreLabel();

  flashcardView.classList.add("hidden");
  mcView.classList.add("hidden");
  tfView.classList.add("hidden");

  if (sessionFormat === "flashcard") {
    flashcardView.classList.remove("hidden");
    flashcard.classList.remove("flipped", "flash-good", "flash-bad");
    flashcard.classList.toggle("is-gold", !!q.gold);
    flashcardFront.textContent = q.question;
    flashcardBack.textContent = q.answer;
  } else if (sessionFormat === "mc") {
    mcView.classList.remove("hidden");
    mcQuestion.innerHTML = (q.gold ? `<span class="gold-question-tag">&#11088; Gold</span><br>` : "") + escapeHtml(q.question);
    const pool = questions.filter((x) => x.type !== "truefalse").map((x) => x.answer);
    const distractors = (q.distractors && q.distractors.length === 3) ? q.distractors : generateDistractors(q.answer, pool);
    const opts = shuffleArr([{ text: q.answer, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
    mcOptions.innerHTML = "";
    opts.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "mc-option";
      b.textContent = opt.text;
      b.addEventListener("click", () => handleChoiceAnswer(b, opt, opts, mcOptions, mcView));
      mcOptions.appendChild(b);
    });
  } else {
    tfView.classList.remove("hidden");
    tfQuestion.innerHTML = (q.gold ? `<span class="gold-question-tag">&#11088; Gold</span><br>` : "") + escapeHtml(q.question);
    [tfTrueBtn, tfFalseBtn].forEach((b) => {
      b.disabled = false;
      b.classList.remove("correct", "incorrect");
      b.onclick = () => handleChoiceAnswer(b, { text: b.dataset.value, correct: b.dataset.value === q.answer }, [
        { text: "True", correct: q.answer === "True" }, { text: "False", correct: q.answer === "False" }
      ], null, tfView, [tfTrueBtn, tfFalseBtn]);
    });
  }
}

function handleChoiceAnswer(btn, opt, allOpts, optionsContainer, viewEl, explicitButtons) {
  if (sessionAnswered[sessionIndex]) return;
  sessionAnswered[sessionIndex] = true;
  const buttons = explicitButtons || [...optionsContainer.querySelectorAll(".mc-option, .tf-option")];
  buttons.forEach((b) => (b.disabled = true));
  btn.classList.add(opt.correct ? "correct" : "incorrect");
  if (opt.correct) {
    sessionScore++;
  } else {
    sessionWrong++;
    const correctBtn = buttons.find((b, i) => allOpts[i] ? allOpts[i].correct : b.dataset.value === sessionQuestions[sessionIndex].answer);
    if (correctBtn) correctBtn.classList.add("correct");
  }
  viewEl.classList.remove("flash-good", "flash-bad");
  void viewEl.offsetWidth;
  viewEl.classList.add(opt.correct ? "flash-good" : "flash-bad");
  updateScoreLabel();
}

flashcard.addEventListener("click", () => flashcard.classList.toggle("flipped"));

markCorrectBtn.addEventListener("click", () => {
  if (!sessionAnswered[sessionIndex]) {
    sessionAnswered[sessionIndex] = true;
    sessionScore++;
    updateScoreLabel();
  }
  flashcard.classList.remove("flash-bad");
  void flashcard.offsetWidth;
  flashcard.classList.add("flash-good");
  setTimeout(() => advanceCard(), 350);
});

function advanceCard() {
  if (sessionIndex < sessionQuestions.length - 1) { sessionIndex++; renderStudyQuestion(); }
  else showToast("That's the last card in this session.");
}

prevBtn.addEventListener("click", () => {
  if (sessionIndex > 0) { sessionIndex--; renderStudyQuestion(); }
});
nextBtn.addEventListener("click", () => {
  if (sessionFormat === "flashcard" && !sessionAnswered[sessionIndex]) {
    sessionAnswered[sessionIndex] = true;
    sessionWrong++;
    updateScoreLabel();
  }
  advanceCard();
});
endStudyBtn.addEventListener("click", () => {
  studyArea.classList.add("hidden");
});

// ---------------------------------------------------------------
// Calendar (Firestore: "events")
// ---------------------------------------------------------------
let events = [];
let calView = "month";
let calCursor = new Date();
let selectedEventId = null;

const calMonthGrid = document.getElementById("calMonthGrid");
const calWeekView = document.getElementById("calWeekView");
const calDayView = document.getElementById("calDayView");
const calLabel = document.getElementById("calLabel");
const calDayDetail = document.getElementById("calDayDetail");
const dayDetailTitle = document.getElementById("dayDetailTitle");
const dayDetailEvents = document.getElementById("dayDetailEvents");

const eventsQuery = query(collection(db, "events"), orderBy("date", "asc"));
onSnapshot(eventsQuery, (snap) => {
  events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderCalendar();
}, (err) => {
  console.error(err);
  calMonthGrid.innerHTML = `<p class="muted small">Couldn't load the calendar. Check your Firebase setup.</p>`;
});

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    calView = btn.dataset.view;
    document.querySelectorAll(".view-btn").forEach((b) => b.classList.toggle("active", b === btn));
    renderCalendar();
  });
});

document.getElementById("calPrevBtn").addEventListener("click", () => stepCalendar(-1));
document.getElementById("calNextBtn").addEventListener("click", () => stepCalendar(1));
document.getElementById("calTodayBtn").addEventListener("click", () => { calCursor = new Date(); renderCalendar(); });

function stepCalendar(dir) {
  const d = new Date(calCursor);
  if (calView === "month") d.setMonth(d.getMonth() + dir);
  else if (calView === "week") d.setDate(d.getDate() + dir * 7);
  else d.setDate(d.getDate() + dir);
  calCursor = d;
  renderCalendar();
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function sameDay(a, b) { return isoDate(a) === isoDate(b); }

function eventsOn(dateStr) {
  return events.filter((e) => e.date === dateStr).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

function renderCalendar() {
  calMonthGrid.classList.add("hidden");
  calWeekView.classList.add("hidden");
  calDayView.classList.add("hidden");
  if (calView === "month") { calMonthGrid.classList.remove("hidden"); renderMonth(); }
  else if (calView === "week") { calWeekView.classList.remove("hidden"); renderWeek(); }
  else { calDayView.classList.remove("hidden"); renderDay(); }
}

function renderMonth() {
  const year = calCursor.getFullYear();
  const month = calCursor.getMonth();
  calLabel.textContent = calCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const firstOfMonth = new Date(year, month, 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(year, month, 1 - startOffset);
  const today = new Date();

  const dows = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = dows.map((d) => `<div class="cal-dow">${d}</div>`).join("");

  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const dateStr = isoDate(d);
    const dayEvents = eventsOn(dateStr);
    const classes = ["cal-day"];
    if (d.getMonth() !== month) classes.push("other-month");
    if (sameDay(d, today)) classes.push("today");
    html += `
      <div class="${classes.join(" ")}" data-date="${dateStr}">
        <span class="cal-day-num">${d.getDate()}</span>
        ${dayEvents.slice(0, 3).map((e) => `<span class="cal-event-dot">${escapeHtml(e.title)}</span>`).join("")}
        ${dayEvents.length > 3 ? `<span class="cal-event-dot">+${dayEvents.length - 3} more</span>` : ""}
      </div>`;
  }
  calMonthGrid.innerHTML = html;
  calMonthGrid.querySelectorAll(".cal-day").forEach((el) => {
    el.addEventListener("click", () => openDayDetail(el.dataset.date));
  });
}

function renderWeek() {
  const d = new Date(calCursor);
  const startOffset = d.getDay();
  const weekStart = new Date(d); weekStart.setDate(d.getDate() - startOffset);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  calLabel.textContent = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  const today = new Date();
  let html = "";
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart); day.setDate(weekStart.getDate() + i);
    const dateStr = isoDate(day);
    const dayEvents = eventsOn(dateStr);
    html += `
      <div class="cal-week-row ${sameDay(day, today) ? "today" : ""}" data-date="${dateStr}">
        <strong>${day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</strong>
        <span class="muted small">${dayEvents.length ? dayEvents.map((e) => e.title).join(", ") : "No events"}</span>
      </div>`;
  }
  calWeekView.innerHTML = html;
  calWeekView.querySelectorAll(".cal-week-row").forEach((el) => {
    el.addEventListener("click", () => openDayDetail(el.dataset.date));
  });
}

function renderDay() {
  const dateStr = isoDate(calCursor);
  calLabel.textContent = calCursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const dayEvents = eventsOn(dateStr);
  calDayView.innerHTML = dayEvents.length
    ? dayEvents.map((e) => `
        <div class="cal-day-row today" data-id="${e.id}">
          <strong>${e.time ? formatTime(e.time) + " — " : ""}${escapeHtml(e.title)}</strong>
          <span class="muted small">${escapeHtml(e.location || "")}</span>
        </div>`).join("")
    : `<p class="muted small">No events on this day.</p>`;
  calDayView.querySelectorAll(".cal-day-row").forEach((el) => {
    el.addEventListener("click", () => openEventModal(events.find((e) => e.id === el.dataset.id)));
  });
  openDayDetail(dateStr, false);
}

function formatTime(t) {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function openDayDetail(dateStr, toggle = true) {
  const dayEvents = eventsOn(dateStr);
  const dateObj = new Date(dateStr + "T00:00:00");
  dayDetailTitle.textContent = dateObj.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  dayDetailEvents.innerHTML = dayEvents.length
    ? dayEvents.map((e) => `
        <div class="event-item" data-id="${e.id}">
          <h4>${e.time ? formatTime(e.time) + " — " : ""}${escapeHtml(e.title)}</h4>
          ${e.location ? `<span class="muted small">${escapeHtml(e.location)}</span>` : ""}
          ${e.notes ? `<p class="small">${escapeHtml(e.notes)}</p>` : ""}
          <span class="muted small">added by ${escapeHtml(e.createdBy || "unknown")}</span>
        </div>`).join("") + `<button class="btn btn-secondary small" id="addEventForDay">+ Add event on this day</button>`
    : `<p class="muted small">No events yet.</p><button class="btn btn-secondary small" id="addEventForDay">+ Add event on this day</button>`;

  dayDetailEvents.querySelectorAll(".event-item").forEach((el) => {
    el.addEventListener("click", () => openEventModal(events.find((e) => e.id === el.dataset.id)));
  });
  const addForDay = document.getElementById("addEventForDay");
  if (addForDay) addForDay.addEventListener("click", () => openEventModal(null, dateStr));

  if (toggle) calDayDetail.classList.remove("hidden");
}
document.getElementById("closeDayDetail").addEventListener("click", () => calDayDetail.classList.add("hidden"));

// ---- Event modal ----
const eventModal = document.getElementById("eventModal");
const eventForm = document.getElementById("eventForm");
const eventModalTitle = document.getElementById("eventModalTitle");
const evTitle = document.getElementById("evTitle");
const evDate = document.getElementById("evDate");
const evTime = document.getElementById("evTime");
const evLocation = document.getElementById("evLocation");
const evNotes = document.getElementById("evNotes");
const deleteEventBtn = document.getElementById("deleteEventBtn");

document.getElementById("addEventBtn").addEventListener("click", () => openEventModal(null, isoDate(calCursor)));
document.getElementById("closeEventModal").addEventListener("click", closeEventModal);

function openEventModal(evt, defaultDate) {
  selectedEventId = evt ? evt.id : null;
  eventModalTitle.textContent = evt ? "Edit event" : "Add event";
  evTitle.value = evt ? evt.title : "";
  evDate.value = evt ? evt.date : (defaultDate || isoDate(new Date()));
  evTime.value = evt ? (evt.time || "") : "";
  evLocation.value = evt ? (evt.location || "") : "";
  evNotes.value = evt ? (evt.notes || "") : "";
  deleteEventBtn.classList.toggle("hidden", !evt);
  eventModal.classList.remove("hidden");
}
function closeEventModal() { eventModal.classList.add("hidden"); selectedEventId = null; }

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  const data = {
    title: evTitle.value.trim(),
    date: evDate.value,
    time: evTime.value || "",
    location: evLocation.value.trim(),
    notes: evNotes.value.trim(),
    updatedBy: user, updatedAt: serverTimestamp()
  };
  if (!data.title || !data.date) return;

  try {
    if (selectedEventId) {
      await updateDoc(doc(db, "events", selectedEventId), data);
      showToast("Event updated");
    } else {
      await addDoc(collection(db, "events"), { ...data, createdBy: user, createdAt: serverTimestamp() });
      showToast("Event added");
    }
    closeEventModal();
  } catch (err) {
    console.error(err);
    showToast("Save failed — check your Firebase setup.");
  }
});

deleteEventBtn.addEventListener("click", async () => {
  if (!selectedEventId) return;
  if (!confirm("Delete this event for everyone?")) return;
  try {
    await deleteDoc(doc(db, "events", selectedEventId));
    showToast("Event deleted");
    closeEventModal();
  } catch (err) {
    console.error(err);
    showToast("Delete failed.");
  }
});

renderCalendar();

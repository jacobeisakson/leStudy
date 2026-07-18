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

const questionForm = document.getElementById("questionForm");
const qQuestion = document.getElementById("qQuestion");
const qAnswer = document.getElementById("qAnswer");
const qCategory = document.getElementById("qCategory");
const distractorFields = document.getElementById("distractorFields");
const genDistractorsBtn = document.getElementById("genDistractorsBtn");
const questionList = document.getElementById("questionList");
const questionCount = document.getElementById("questionCount");
const bankSearch = document.getElementById("bankSearch");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const categoryList = document.getElementById("categoryList");
const studyCategory = document.getElementById("studyCategory");

const questionsQuery = query(collection(db, "questions"), orderBy("createdAt", "desc"));
onSnapshot(questionsQuery, (snap) => {
  questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderQuestionList();
  renderCategoryOptions();
}, (err) => {
  console.error(err);
  questionList.innerHTML = `<p class="muted small">Couldn't load the question bank. Check your Firebase setup in js/firebase-config.js and README.md.</p>`;
});

genDistractorsBtn.addEventListener("click", () => {
  const answer = qAnswer.value.trim();
  if (!answer) { qAnswer.focus(); return; }
  const pool = questions.map((q) => q.answer);
  const [d0, d1, d2] = generateDistractors(answer, pool);
  document.getElementById("d0").value = d0;
  document.getElementById("d1").value = d1;
  document.getElementById("d2").value = d2;
  distractorFields.classList.remove("hidden");
});

questionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const user = getCurrentUser();
  const question = qQuestion.value.trim();
  const answer = qAnswer.value.trim();
  const category = qCategory.value.trim();
  const distractors = distractorFields.classList.contains("hidden")
    ? []
    : ["d0", "d1", "d2"].map((id) => document.getElementById(id).value.trim()).filter(Boolean);

  if (!question || !answer) return;

  try {
    if (editingId) {
      await updateDoc(doc(db, "questions", editingId), {
        question, answer, category, distractors,
        updatedBy: user, updatedAt: serverTimestamp()
      });
      showToast("Question updated");
    } else {
      await addDoc(collection(db, "questions"), {
        question, answer, category, distractors,
        createdBy: user, createdAt: serverTimestamp(),
        updatedBy: user, updatedAt: serverTimestamp()
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
  questionForm.reset();
  distractorFields.classList.add("hidden");
  cancelEditBtn.classList.add("hidden");
  questionForm.querySelector("button[type=submit]").textContent = "Save to question bank";
}

function renderCategoryOptions() {
  const cats = [...new Set(questions.map((q) => q.category).filter(Boolean))].sort();
  categoryList.innerHTML = cats.map((c) => `<option value="${escapeHtml(c)}">`).join("");
  const prevVal = studyCategory.value;
  studyCategory.innerHTML = `<option value="all">All categories</option>` +
    cats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  if ([...studyCategory.options].some((o) => o.value === prevVal)) studyCategory.value = prevVal;
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
    return `
      <div class="question-card" data-id="${q.id}">
        <div class="q-top">
          <div>
            <p class="q-text">${escapeHtml(q.question)}</p>
            <p class="q-answer">&#10003; ${escapeHtml(q.answer)}</p>
            ${q.distractors && q.distractors.length ? `<p class="q-distractors">Wrong answers: ${q.distractors.map(escapeHtml).join(" &nbsp;|&nbsp; ")}</p>` : `<p class="q-distractors">No multiple-choice options yet</p>`}
            <div class="q-meta">
              ${q.category ? `<span class="q-category-tag">${escapeHtml(q.category)}</span>` : ""}
              <span>added by <strong>${escapeHtml(q.createdBy || "unknown")}</strong> ${created}${editedNote}</span>
            </div>
          </div>
          <div class="q-actions">
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
  });
}

function startEditQuestion(id) {
  const q = questions.find((x) => x.id === id);
  if (!q) return;
  editingId = id;
  qQuestion.value = q.question;
  qAnswer.value = q.answer;
  qCategory.value = q.category || "";
  if (q.distractors && q.distractors.length) {
    document.getElementById("d0").value = q.distractors[0] || "";
    document.getElementById("d1").value = q.distractors[1] || "";
    document.getElementById("d2").value = q.distractors[2] || "";
    distractorFields.classList.remove("hidden");
  } else {
    distractorFields.classList.add("hidden");
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
window.leoprepFillQuestionForm = (question, answer) => {
  resetQuestionForm();
  qQuestion.value = question;
  qAnswer.value = answer;
  switchTab("bank");
  questionForm.scrollIntoView({ behavior: "smooth" });
  if (question) qCategory.focus();
  else qQuestion.focus();
};

// ---------------------------------------------------------------
// Study sessions
// ---------------------------------------------------------------
const startStudyBtn = document.getElementById("startStudyBtn");
const studyEmptyMsg = document.getElementById("studyEmptyMsg");
const studyArea = document.getElementById("studyArea");
const flashcardView = document.getElementById("flashcardView");
const mcView = document.getElementById("mcView");
const flashcard = document.getElementById("flashcard");
const flashcardFront = document.getElementById("flashcardFront");
const flashcardBack = document.getElementById("flashcardBack");
const mcQuestion = document.getElementById("mcQuestion");
const mcOptions = document.getElementById("mcOptions");
const progressLabel = document.getElementById("progressLabel");
const scoreLabel = document.getElementById("scoreLabel");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const endStudyBtn = document.getElementById("endStudyBtn");

let sessionQuestions = [];
let sessionIndex = 0;
let sessionFormat = "flashcard";
let sessionScore = 0;
let sessionAnswered = [];

startStudyBtn.addEventListener("click", () => {
  const cat = studyCategory.value;
  const pool = cat === "all" ? questions : questions.filter((q) => q.category === cat);
  if (pool.length === 0) {
    studyEmptyMsg.classList.remove("hidden");
    studyArea.classList.add("hidden");
    return;
  }
  studyEmptyMsg.classList.add("hidden");
  sessionFormat = document.getElementById("studyFormat").value;
  const shuffle = document.getElementById("shuffleToggle").checked;
  sessionQuestions = shuffle ? shuffleArr(pool) : [...pool];
  sessionIndex = 0;
  sessionScore = 0;
  sessionAnswered = new Array(sessionQuestions.length).fill(false);
  studyArea.classList.remove("hidden");
  renderStudyQuestion();
});

function renderStudyQuestion() {
  const q = sessionQuestions[sessionIndex];
  progressLabel.textContent = `${sessionIndex + 1} / ${sessionQuestions.length}`;
  scoreLabel.textContent = sessionFormat === "mc" ? `Score: ${sessionScore}` : "";

  if (sessionFormat === "flashcard") {
    flashcardView.classList.remove("hidden");
    mcView.classList.add("hidden");
    flashcard.classList.remove("flipped");
    flashcardFront.textContent = q.question;
    flashcardBack.textContent = q.answer;
  } else {
    flashcardView.classList.add("hidden");
    mcView.classList.remove("hidden");
    mcQuestion.textContent = q.question;
    const pool = questions.map((x) => x.answer);
    const distractors = (q.distractors && q.distractors.length === 3) ? q.distractors : generateDistractors(q.answer, pool);
    const opts = shuffleArr([{ text: q.answer, correct: true }, ...distractors.map((d) => ({ text: d, correct: false }))]);
    mcOptions.innerHTML = "";
    opts.forEach((opt) => {
      const b = document.createElement("button");
      b.className = "mc-option";
      b.textContent = opt.text;
      b.addEventListener("click", () => handleMcAnswer(b, opt, opts));
      mcOptions.appendChild(b);
    });
  }
}

function handleMcAnswer(btn, opt, allOpts) {
  if (sessionAnswered[sessionIndex]) return;
  sessionAnswered[sessionIndex] = true;
  const buttons = [...mcOptions.querySelectorAll(".mc-option")];
  buttons.forEach((b) => (b.disabled = true));
  btn.classList.add(opt.correct ? "correct" : "incorrect");
  if (opt.correct) {
    sessionScore++;
  } else {
    const correctBtn = buttons.find((b, i) => allOpts[i].correct);
    if (correctBtn) correctBtn.classList.add("correct");
  }
  scoreLabel.textContent = `Score: ${sessionScore}`;
}

flashcard.addEventListener("click", () => flashcard.classList.toggle("flipped"));

prevBtn.addEventListener("click", () => {
  if (sessionIndex > 0) { sessionIndex--; renderStudyQuestion(); }
});
nextBtn.addEventListener("click", () => {
  if (sessionIndex < sessionQuestions.length - 1) { sessionIndex++; renderStudyQuestion(); }
  else showToast("That's the last card in this session.");
});
endStudyBtn.addEventListener("click", () => {
  studyArea.classList.add("hidden");
});

// ---------------------------------------------------------------
// Calendar (Firestore: "events")
// ---------------------------------------------------------------
let events = [];
let calView = "month";
let calCursor = new Date(); // anchor date for current view
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
  const startOffset = firstOfMonth.getDay(); // 0=Sun
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

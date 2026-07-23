// Upload tab: parses the Q:/A: import format that Claude generates in
// chat (see the format example on the tab, and README.md). No network
// calls, no API key — this is a plain text parser.

const importText = document.getElementById("importText");
const extractBtn = document.getElementById("extractBtn");
const notesStatus = document.getElementById("notesStatus");
const candidateList = document.getElementById("candidateList");
const candidateBulkActions = document.getElementById("candidateBulkActions");
const sendAllBtn = document.getElementById("sendAllBtn");

let currentCards = [];

extractBtn.addEventListener("click", () => {
  const raw = importText.value.trim();
  if (!raw) {
    notesStatus.textContent = "Paste some Q:/A: text first.";
    return;
  }
  currentCards = parseImportText(raw);
  renderCandidates(currentCards);
  if (currentCards.length === 0) {
    notesStatus.textContent = "Couldn't find any valid Q:/A: blocks. Check the format example above.";
    candidateBulkActions.classList.add("hidden");
  } else {
    notesStatus.textContent = `Parsed ${currentCards.length} question(s). Review below, then send them individually or all at once.`;
    candidateBulkActions.classList.remove("hidden");
  }
});

// ---------------------------------------------------------------
// Parser
// ---------------------------------------------------------------
function parseImportText(raw) {
  const blocks = raw.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
  const cards = [];

  for (const block of blocks) {
    let question = null, answer = null, type = null, category = "", gold = false;

    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      const m = line.match(/^([A-Za-z]+):\s*(.*)$/);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === "q" || key === "question") question = val;
      else if (key === "a" || key === "answer") answer = val;
      else if (key === "type") type = val.toLowerCase().replace(/[\s/_-]/g, "");
      else if (key === "category") category = val;
      else if (key === "gold") gold = /^(yes|true|1|y)$/i.test(val);
    }

    if (!question || !answer) continue;

    let kind = "standard";
    if (type) {
      kind = (type === "truefalse" || type === "tf") ? "truefalse" : "standard";
    } else if (/^(true|false)$/i.test(answer)) {
      kind = "truefalse";
    }
    if (kind === "truefalse") {
      answer = /^true$/i.test(answer) ? "True" : "False";
    }

    cards.push({ question, answer, kind, category, gold });
  }

  return cards;
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function renderCandidates(cards) {
  if (cards.length === 0) {
    candidateList.innerHTML = "";
    return;
  }
  candidateList.innerHTML = cards.map((c, i) => `
    <div class="candidate-item" data-idx="${i}">
      <span class="cand-type">${c.kind === "truefalse" ? "True / False" : "Flashcard"}${c.category ? ` &middot; ${escapeHtml(c.category)}` : ""}</span>
      <p class="cand-q">${escapeHtml(c.question)}</p>
      <p class="cand-a">&#10003; ${escapeHtml(c.answer)}</p>
      <div class="cand-actions">
        <label class="cand-gold-label"><input type="checkbox" data-gold-idx="${i}" ${c.gold ? "checked" : ""}> &#11088; Gold</label>
        <button class="btn btn-secondary small" data-send-idx="${i}">Send to Question Bank</button>
      </div>
    </div>`).join("");

  candidateList.querySelectorAll("button[data-send-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = btn.dataset.sendIdx;
      const c = cards[idx];
      const goldBox = candidateList.querySelector(`input[data-gold-idx="${idx}"]`);
      window.leoprepFillQuestionForm(c.question, c.answer, {
        type: c.kind === "truefalse" ? "truefalse" : "standard",
        gold: goldBox ? goldBox.checked : false
      });
    });
  });
}

sendAllBtn.addEventListener("click", async () => {
  if (currentCards.length === 0) return;
  const goldOverrides = currentCards.map((_, i) => {
    const box = candidateList.querySelector(`input[data-gold-idx="${i}"]`);
    return box ? box.checked : false;
  });
  const cardsToSend = currentCards.map((c, i) => ({ ...c, gold: goldOverrides[i] }));

  if (!confirm(`Add all ${cardsToSend.length} questions directly to the shared Question Bank? This skips individual review.`)) return;

  sendAllBtn.disabled = true;
  notesStatus.textContent = "Adding questions...";
  const { success, fail } = await window.leoprepBulkAddQuestions(cardsToSend);
  sendAllBtn.disabled = false;
  notesStatus.textContent = fail
    ? `Added ${success} question(s), ${fail} failed — check your connection and try again for the rest.`
    : `Added all ${success} question(s) to the bank.`;
  if (success > 0) {
    currentCards = [];
    candidateList.innerHTML = "";
    candidateBulkActions.classList.add("hidden");
    importText.value = "";
  }
});

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

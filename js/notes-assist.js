const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";

const dropZone = document.getElementById("dropZone");
const pdfInput = document.getElementById("pdfInput");
const pdfBrowseBtn = document.getElementById("pdfBrowseBtn");
const pasteNotes = document.getElementById("pasteNotes");
const extractBtn = document.getElementById("extractBtn");
const notesStatus = document.getElementById("notesStatus");
const candidateList = document.getElementById("candidateList");

let pdfjsLib = null;

// ---------------------------------------------------------------
// PDF upload / extraction (preserves rough indentation from layout)
// ---------------------------------------------------------------
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import(PDFJS_URL);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  return pdfjsLib;
}

pdfBrowseBtn.addEventListener("click", () => pdfInput.click());
pdfInput.addEventListener("change", () => {
  if (pdfInput.files[0]) handlePdfFile(pdfInput.files[0]);
});

["dragover", "dragenter"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
});
["dragleave", "drop"].forEach((evt) => {
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove("dragover"); });
});
dropZone.addEventListener("drop", (e) => {
  const file = e.dataTransfer.files[0];
  if (file && file.type === "application/pdf") handlePdfFile(file);
  else notesStatus.textContent = "Please drop a PDF file.";
});

async function handlePdfFile(file) {
  notesStatus.textContent = "Reading PDF...";
  try {
    const lib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const doc = await lib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      text += reconstructLines(content.items) + "\n";
    }
    pasteNotes.value = text.trim();
    notesStatus.textContent = `Extracted text from ${doc.numPages} page(s) of "${file.name}". Structure detection is best-effort for PDFs — check the box above and fix indentation/bullets if anything looks off, then click "Generate Questions".`;
  } catch (err) {
    console.error(err);
    notesStatus.textContent = "Couldn't read that PDF — it may be a scanned image without a text layer. Try pasting the text instead.";
  }
}

// Groups text items into lines by y-position, and estimates an indent
// level from each line's x-position so bullet/definition/topic structure
// can be recovered from a PDF that has no literal whitespace characters.
function reconstructLines(items) {
  if (!items.length) return "";
  const lines = [];
  let current = null;
  const Y_TOLERANCE = 2.5;

  const sorted = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  for (const it of sorted) {
    const x = it.transform[4];
    const y = it.transform[5];
    if (!current || Math.abs(current.y - y) > Y_TOLERANCE) {
      current = { y, minX: x, parts: [] };
      lines.push(current);
    }
    current.minX = Math.min(current.minX, x);
    current.parts.push({ x, str: it.str });
  }

  const pageMinX = Math.min(...lines.map((l) => l.minX));
  const INDENT_UNIT = 16; // pt per indent level, approximate

  return lines.map((line) => {
    const text = line.parts.sort((a, b) => a.x - b.x).map((p) => p.str.trim()).filter(Boolean).join(" ").trim();
    if (!text) return "";
    const level = Math.max(0, Math.round((line.minX - pageMinX) / INDENT_UNIT));
    return "  ".repeat(level) + text;
  }).join("\n");
}

// ---------------------------------------------------------------
// Structural parser: topics / nested bullets / term-definition splits
// ---------------------------------------------------------------
extractBtn.addEventListener("click", () => {
  const raw = pasteNotes.value.trim();
  if (!raw) {
    notesStatus.textContent = "Upload a PDF or paste some notes first.";
    return;
  }
  const cards = parseNotes(raw);
  renderCandidates(cards);
  notesStatus.textContent = `Drafted ${cards.length} question(s). Review, mark any as gold, and send them to the Question Bank.`;
});

// Separator characters that split a line into a front (term/prompt) and
// back (answer) — e.g. "Ethics - values of right and wrong" or
// "Ethics: values of right and wrong".
const SEP_REGEX = /^(.{2,70}?)\s*[-–—:]\s+(.{2,300})$/;
// Period-based split, kept strict (short front only) so normal sentences
// don't get chopped in half.
const PERIOD_SEP_REGEX = /^(.{2,50}?)\.\s+(.{2,300})$/;

function parseNotes(raw) {
  const cards = [];
  const rawLines = raw.split(/\r?\n/);

  const lines = rawLines.map((line) => {
    if (!line.trim()) return null;
    const bulletMatch = line.match(/^(\s*)[*\-•▪◦‣]\s+(.*)$/);
    if (bulletMatch) {
      return { indent: bulletMatch[1].replace(/\t/g, "  ").length, isBullet: true, text: bulletMatch[2].trim() };
    }
    const leadingWs = line.match(/^(\s*)/)[1].replace(/\t/g, "  ").length;
    return { indent: leadingWs, isBullet: false, text: line.trim() };
  });

  let currentTopic = "";
  const bulletStack = []; // {indent, text}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const { front, back } = splitFrontBack(line.text);
    if (front && back) {
      cards.push({ kind: "flashcard", question: front, answer: back });
      const tf = buildTrueFalseCompanion(front, back, cards);
      if (tf) cards.push(tf);
      continue;
    }

    if (!line.isBullet) {
      bulletStack.length = 0;
      currentTopic = line.text;
      continue;
    }

    while (bulletStack.length && bulletStack[bulletStack.length - 1].indent >= line.indent) {
      bulletStack.pop();
    }
    bulletStack.push({ indent: line.indent, text: line.text });

    let hasChild = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j]) continue;
      if (!lines[j].isBullet) break;
      hasChild = lines[j].indent > line.indent;
      break;
    }

    if (!hasChild) {
      const path = [currentTopic, ...bulletStack.slice(0, -1).map((b) => b.text)].filter(Boolean);
      const question = path.length ? `Under ${path.join(" > ")}, what is noted?` : `What is noted here?`;
      cards.push({ kind: "flashcard", question, answer: line.text });
    }
  }

  return cards;
}

function splitFrontBack(text) {
  let match = text.match(SEP_REGEX);
  if (match) {
    const front = match[1].trim();
    const back = match[2].trim();
    if (front.split(/\s+/).length <= 8) return { front, back };
  }
  match = text.match(PERIOD_SEP_REGEX);
  if (match && match[1].trim().split(/\s+/).length <= 6) {
    return { front: match[1].trim(), back: match[2].trim() };
  }
  return { front: null, back: null };
}

function buildTrueFalseCompanion(front, back, existingCards) {
  const others = existingCards.filter((c) => c.kind === "flashcard" && c.answer !== back).map((c) => c.answer);
  const makeFalse = others.length > 0 && Math.random() < 0.5;
  if (makeFalse) {
    const fakeBack = others[Math.floor(Math.random() * others.length)];
    return { kind: "truefalse", question: `True or False: ${front} — ${fakeBack}`, answer: "False" };
  }
  return { kind: "truefalse", question: `True or False: ${front} — ${back}`, answer: "True" };
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function renderCandidates(cards) {
  if (cards.length === 0) {
    candidateList.innerHTML = `<p class="muted small">No patterns matched. Make sure your notes use bullets (* or -) or "Term - definition" style lines.</p>`;
    return;
  }
  candidateList.innerHTML = cards.map((c, i) => `
    <div class="candidate-item" data-idx="${i}">
      <span class="cand-type">${c.kind === "truefalse" ? "True / False" : "Flashcard"}</span>
      <p class="cand-q">${escapeHtml(c.question)}</p>
      <p class="cand-a">&#10003; ${escapeHtml(c.answer)}</p>
      <div class="cand-actions">
        <label class="cand-gold-label"><input type="checkbox" data-gold-idx="${i}"> &#11088; Gold</label>
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

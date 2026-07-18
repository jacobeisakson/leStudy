const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.149/pdf.worker.min.mjs";
const GEMINI_MODEL = "gemini-2.5-flash-lite"; // free-tier model with the most generous quota

const dropZone = document.getElementById("dropZone");
const pdfInput = document.getElementById("pdfInput");
const pdfBrowseBtn = document.getElementById("pdfBrowseBtn");
const pasteNotes = document.getElementById("pasteNotes");
const extractBtn = document.getElementById("extractBtn");
const notesStatus = document.getElementById("notesStatus");
const candidateList = document.getElementById("candidateList");
const aiToggleBtn = document.getElementById("aiToggleBtn");
const aiSection = document.getElementById("aiSection");
const geminiKey = document.getElementById("geminiKey");
const aiGenerateBtn = document.getElementById("aiGenerateBtn");
const saveKeyBtn = document.getElementById("saveKeyBtn");
const aiStatus = document.getElementById("aiStatus");

let pdfjsLib = null;
let extractedPdfText = "";

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
    extractedPdfText = text;
    pasteNotes.value = text.trim();
    notesStatus.textContent = `Extracted text from ${doc.numPages} page(s) of "${file.name}". Structure detection is best-effort for PDFs — check the box above and fix indentation/bullets if anything looks off, then click "Parse notes".`;
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
    const text = line.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(" ").replace(/\s+/g, " ").trim();
    if (!text) return "";
    const level = Math.max(0, Math.round((line.minX - pageMinX) / INDENT_UNIT));
    return "  ".repeat(level) + text;
  }).join("\n");
}

// ---------------------------------------------------------------
// Structural parser (non-AI): topics / nested bullets / definitions / bold
// ---------------------------------------------------------------
extractBtn.addEventListener("click", () => {
  const raw = pasteNotes.value.trim();
  if (!raw) {
    notesStatus.textContent = "Upload a PDF or paste some notes first.";
    return;
  }
  const cards = parseNotes(raw);
  renderCandidates(cards);
  notesStatus.textContent = `Found ${cards.length} candidate question(s).`;
});

function parseNotes(raw) {
  const cards = [];

  // Pass 1: anything wrapped in **double asterisks** must become a question,
  // regardless of what else happens to that line.
  const boldRegex = /\*\*(.+?)\*\*/g;
  let m;
  while ((m = boldRegex.exec(raw)) !== null) {
    const term = m[1].trim();
    if (!term) continue;
    const lineStart = raw.lastIndexOf("\n", m.index) + 1;
    const lineEnd = raw.indexOf("\n", m.index);
    const fullLine = raw.slice(lineStart, lineEnd === -1 ? raw.length : lineEnd);
    const cleanedLine = fullLine.replace(/\*\*/g, "").trim();
    const blanked = fullLine.replace(/\*\*/g, "").replace(term, "_____").trim();
    cards.push({
      type: "key fact",
      question: blanked !== cleanedLine ? `Fill in the blank: ${stripLeadingBullet(blanked)}` : `What is significant about: "${term}"?`,
      answer: term
    });
  }

  // Pass 2: strip bold markers so the rest of parsing sees clean text.
  const cleaned = raw.replace(/\*\*/g, "");
  const rawLines = cleaned.split(/\r?\n/);

  // Parse each line into { indent, isBullet, text }
  const lines = rawLines.map((line) => {
    if (!line.trim()) return null;
    const bulletMatch = line.match(/^(\s*)[*\-•▪◦‣]\s+(.*)$/);
    if (bulletMatch) {
      return { indent: bulletMatch[1].replace(/\t/g, "  ").length, isBullet: true, text: bulletMatch[2].trim() };
    }
    const leadingWs = line.match(/^(\s*)/)[1].replace(/\t/g, "  ").length;
    return { indent: leadingWs, isBullet: false, text: line.trim() };
  });

  const DEF_REGEX = /^([A-Za-z][\w' ]{1,50}?)\s*[-–—:]\s+(.{3,300})$/;
  let currentTopic = "";
  const bulletStack = []; // {indent, text}

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const defMatch = line.text.match(DEF_REGEX);
    if (defMatch && defMatch[1].trim().split(/\s+/).length <= 6) {
      cards.push({ type: "definition", question: `What is ${defMatch[1].trim()}?`, answer: defMatch[2].trim() });
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

    // peek ahead: does a deeper bullet follow (meaning this one is a parent, not a leaf)?
    let hasChild = false;
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j]) continue;
      if (!lines[j].isBullet) break;
      hasChild = lines[j].indent > line.indent;
      break;
    }

    if (!hasChild) {
      const path = [currentTopic, ...bulletStack.slice(0, -1).map((b) => b.text)].filter(Boolean);
      const question = path.length
        ? `Under ${path.join(" > ")}, what is noted?`
        : `What is noted here?`;
      cards.push({ type: "note", question, answer: line.text });
    }
  }

  return cards;
}

function stripLeadingBullet(text) {
  return text.replace(/^[\s*\-•▪◦‣]+/, "").trim();
}

// ---------------------------------------------------------------
// AI-assisted generation via Gemini (free tier, user's own key)
// ---------------------------------------------------------------
const KEY_STORAGE = "leoprep_gemini_key";
geminiKey.value = localStorage.getItem(KEY_STORAGE) || "";

aiToggleBtn.addEventListener("click", () => {
  const showing = !aiSection.classList.contains("hidden");
  aiSection.classList.toggle("hidden", showing);
  aiToggleBtn.textContent = showing ? "show" : "hide";
});

saveKeyBtn.addEventListener("click", () => {
  localStorage.setItem(KEY_STORAGE, geminiKey.value.trim());
  aiStatus.textContent = "Key saved to this browser.";
});

aiGenerateBtn.addEventListener("click", async () => {
  const key = geminiKey.value.trim();
  const raw = pasteNotes.value.trim();
  if (!key) { aiStatus.textContent = "Paste your Gemini API key first."; return; }
  if (!raw) { aiStatus.textContent = "Upload a PDF or paste some notes first."; return; }

  aiGenerateBtn.disabled = true;
  aiStatus.textContent = "Asking Gemini...";

  try {
    const cards = await generateWithGemini(raw, key);
    renderCandidates(cards, true);
    aiStatus.textContent = `AI drafted ${cards.length} question(s). Review before saving — verify against your notes.`;
  } catch (err) {
    console.error(err);
    aiStatus.textContent = `AI generation failed: ${err.message}`;
  } finally {
    aiGenerateBtn.disabled = false;
  }
});

async function generateWithGemini(notesText, apiKey) {
  const prompt = `You extract exam-style study questions from law-enforcement training notes.
Given the RAW NOTES below, return ONLY a JSON array (no prose, no markdown fences) of objects
shaped like {"question": string, "answer": string}. Rules:
1. Any text wrapped in double asterisks (**like this**) MUST produce at least one question testing that fact.
2. Lines shaped like "Term - definition" become "What is Term?" style questions.
3. Bulleted facts/quotes nested under a topic or section become questions that reference that context (e.g. "Under Topic > Section, what is stated about...?").
4. Keep answers concise and exactly faithful to the source notes. Do not invent facts not present in the notes.
5. Skip pure section headers that have no factual content of their own.

RAW NOTES:
<<<
${notesText}
>>>`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    })
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${res.status} ${res.statusText} — ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "[]";
  const cleaned = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Unexpected response shape from Gemini.");
  return parsed
    .filter((c) => c && c.question && c.answer)
    .map((c) => ({ type: "AI draft", question: String(c.question).trim(), answer: String(c.answer).trim() }));
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function renderCandidates(cards, append = false) {
  if (cards.length === 0 && !append) {
    candidateList.innerHTML = `<p class="muted small">No patterns matched. Make sure your notes use bullets (* or -), "Term - definition" lines, or **bold** for exam-critical facts — or try the AI-assisted option above.</p>`;
    return;
  }
  const html = cards.map((c) => {
    const idx = Math.random().toString(36).slice(2);
    return `
    <div class="candidate-item" data-idx="${idx}">
      <span class="cand-type">${escapeHtml(c.type)}</span>
      <p class="cand-q">${escapeHtml(c.question)}</p>
      <p class="cand-a">&#10003; ${escapeHtml(c.answer)}</p>
      <div class="cand-actions">
        <button class="btn btn-secondary small" data-q="${escapeAttr(c.question)}" data-a="${escapeAttr(c.answer)}">Send to Question Bank</button>
      </div>
    </div>`;
  }).join("");

  candidateList.innerHTML = append ? html + candidateList.innerHTML : html;

  candidateList.querySelectorAll("button[data-q]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.leoprepFillQuestionForm(btn.dataset.q, btn.dataset.a);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/\n/g, " ");
}

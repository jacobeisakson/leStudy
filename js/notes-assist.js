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

let extractedPdfText = "";

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
      text += content.items.map((it) => it.str).join(" ") + "\n";
    }
    extractedPdfText = text;
    notesStatus.textContent = `Extracted text from ${doc.numPages} page(s) of "${file.name}". Click "Find candidate sentences" below.`;
  } catch (err) {
    console.error(err);
    notesStatus.textContent = "Couldn't read that PDF — it may be a scanned image without a text layer. Try pasting the text instead.";
  }
}

extractBtn.addEventListener("click", () => {
  const raw = (pasteNotes.value.trim() ? pasteNotes.value : extractedPdfText).trim();
  if (!raw) {
    notesStatus.textContent = "Upload a PDF or paste some notes first.";
    return;
  }
  const sentences = splitIntoCandidates(raw);
  renderCandidates(sentences);
  notesStatus.textContent = `Found ${sentences.length} candidate sentence(s).`;
});

function splitIntoCandidates(raw) {
  const cleaned = raw.replace(/\s+/g, " ").replace(/\u2022/g, ". ").trim();
  const rough = cleaned.split(/(?<=[.?!])\s+(?=[A-Z0-9])/g);
  const seen = new Set();
  const results = [];
  for (let s of rough) {
    s = s.trim();
    const wordCount = s.split(/\s+/).length;
    if (wordCount < 5 || wordCount > 45) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(s);
    if (results.length >= 40) break;
  }
  return results;
}

function renderCandidates(sentences) {
  if (sentences.length === 0) {
    candidateList.innerHTML = `<p class="muted small">No usable sentences found. Try pasting cleaner text.</p>`;
    return;
  }
  candidateList.innerHTML = sentences.map((s, i) => `
    <div class="candidate-item">
      <p>${escapeHtml(s)}</p>
      <button class="btn btn-secondary small" data-idx="${i}">Draft Q&amp;A</button>
    </div>`).join("");

  candidateList.querySelectorAll("button[data-idx]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sentence = sentences[btn.dataset.idx];
      window.leoprepFillQuestionForm("", sentence);
    });
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

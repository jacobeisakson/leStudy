# WRPD StudyBoard — CRA 2026-2

A shared study site for you and your squad: flashcards, multiple choice quizzes,
a question bank anyone can add to, a group calendar for test dates, and a
notes-to-questions parser that reads your outline structure. Runs entirely as
static files on GitHub Pages, with Firebase (free tier) as the shared database
so everyone sees the same data.

## What's in each tab

1. **Study** — Pick flashcards or multiple choice, filter by category, and go
   through the shared question bank.
2. **Question Bank** — Add a question and correct answer. Click "Generate
   multiple-choice options" and it drafts 3 wrong answers (tweaks the numbers
   in your answer, or borrows other answers from the bank if there's no
   number to work with) — edit them freely before saving.
3. **Notes Assist** — Upload a PDF or paste text. It parses your actual
   outline structure instead of just splitting sentences:
   - **Topic / nested bullets** (e.g. `Topic` → `* section` → `   * quote`)
     become questions like "Under Topic > section, what is noted?"
   - **`Term - definition`** lines become "What is Term?" questions.
   - **`**anything wrapped in double asterisks**`** always becomes a
     fill-in-the-blank question, since those are your flagged exam facts.
   - An optional **AI-assisted** pass (see below) can also generate
     questions using Google's free Gemini API, for notes that don't follow
     a strict pattern.
4. **Calendar** — Shared calendar for test dates and study sessions, with
   month/week/day views.

Every question and event is stamped with the name of whoever added or last
edited it.

### Formatting your notes for best results

The parser looks for:

```
Ethics - values of right and wrong

Use of Force
* De-escalation
   * Officers must attempt **verbal de-escalation** before force when feasible
```

- Indent nested bullets with spaces or tabs so the parser can tell a
  section from its children.
- Use `*`, `-`, or `•` for bullets.
- Wrap anything you know will be tested in `**double asterisks**` —
  those always become a question, regardless of anything else on the line.
- For PDFs, the parser estimates indentation from the text's position on
  the page, which works well for typed/exported notes but is best-effort —
  double check the parsed results, and paste as plain text instead if a PDF's
  structure doesn't come through cleanly.

---

## 1. Set up Firebase (free, ~10 minutes)

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a new project (you can turn off Google Analytics, you don't need it).
2. In the project, click the **`</>`** (web app) icon to register a new web
   app. Give it any nickname. You do **not** need Firebase Hosting.
3. Firebase will show you a `firebaseConfig` object. Copy your real values into
   `js/firebase-config.js` in this project, replacing the placeholder values.
4. In the left sidebar, go to **Build > Firestore Database** and click
   **Create database**. Choose a region close to you and start in
   **production mode**.
5. Go to **Build > Authentication > Sign-in method** and enable **Anonymous**.
   This lets the site tell requests apart without anyone needing a password —
   your display name is separate and just stored in each person's browser.
6. Go to **Firestore Database > Rules** and replace the contents with:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /questions/{id} {
         allow read, write: if request.auth != null;
       }
       match /events/{id} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```

   Click **Publish**. This means anyone who opens your deployed site (and
   gets an anonymous sign-in) can read and write the shared question bank and
   calendar — fine for a small trusted friend group, but don't post the URL
   publicly.

---

## 2. Deploy to GitHub Pages

1. Create a new GitHub repository (public is free and simplest).
2. Upload all the files in this folder (`index.html`, `css/`, `js/`,
   `README.md`, `.nojekyll`) to the repo, preserving the folder structure.
3. In the repo, go to **Settings > Pages**.
4. Under **Build and deployment > Source**, choose **Deploy from a branch**.
5. Pick your default branch (usually `main`) and the `/ (root)` folder, then **Save**.
6. After a minute or two, GitHub will show your live URL, something like
   `https://yourusername.github.io/your-repo-name/`.
7. Share that URL with your friends. First visit, everyone picks a display name.

Any time you edit a file, just commit and push — GitHub Pages redeploys automatically.

---

## 3. Adding AI-assisted generation (free)

The Notes Assist tab has an optional "AI-assisted generation" section that
calls **Google's Gemini API**, which has a genuinely free tier (no credit
card required) for the Flash and Flash-Lite models — that's what the app
uses by default.

Because GitHub Pages can't hide a secret key (anything in the site's
JavaScript is visible to anyone who views the page source), each person
pastes their **own** free key into the site. It's stored only in that
person's browser (`localStorage`) and sent directly to Google — never to
Firebase or anyone else in the group.

**Getting a free Gemini API key:**

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   and sign in with a Google account.
2. Click **Create API key**. No credit card or billing setup is required to
   stay on the free tier.
3. Copy the key.
4. In the Notes Assist tab, click **show** next to "AI-assisted generation",
   paste the key into the field, and click **Save key to this browser**.
5. Paste or upload your notes as usual, then click **Generate with AI**.

The free tier has daily/per-minute request limits (they change over time —
check [ai.google.dev/pricing](https://ai.google.dev/pricing) for current
numbers), which is plenty for occasional note-processing but will throttle
if hammered constantly. If you outgrow it, Gemini's paid tier or the
Anthropic API are both drop-in alternatives — you'd swap the fetch call in
`js/notes-assist.js`.

**Alternative: no API key at all.** It's also possible to run a small AI
model entirely inside the browser (via WebGPU, using a library like
`@mlc-ai/web-llm`) — genuinely free forever, no key, no per-person setup,
but each person downloads a multi-gigabyte model file the first time and
needs a WebGPU-capable browser. Worth considering later if the API route
becomes annoying; happy to build that version if you want it.

---

## 4. Changing the site's name or URL

What you can rename depends on whether you want the **GitHub Pages URL** to
change, or just labels inside the app.

**A. Change the in-app title/subtitle** — already set to "WRPD StudyBoard" /
"CRA 2026-2". To change it again, edit these two spots in `index.html`:
- `<title>WRPD StudyBoard</title>` (browser tab title)
- `<span class="brand-title">WRPD StudyBoard</span>` and
  `<span class="brand-sub">CRA 2026-2</span>` (header)

Commit and push — no other setup needed.

**B. Change the GitHub Pages URL by renaming the repo:**
1. In the repo, go to **Settings > General**.
2. Under **Repository name**, type the new name and click **Rename**.
3. GitHub automatically updates your Pages URL to
   `https://yourusername.github.io/new-repo-name/` and redirects the old
   one for a while — but update any bookmarks/links you've shared, since the
   redirect isn't permanent.

**C. Use your own custom domain instead of `github.io`:**
1. Buy a domain from any registrar (Namecheap, Google Domains successor,
   Cloudflare, etc.) if you don't have one.
2. In the repo, go to **Settings > Pages > Custom domain**, and enter your
   domain (e.g. `study.yourdomain.com`).
3. At your domain registrar, add a **CNAME record** pointing
   `study` (or whichever subdomain) to `yourusername.github.io`.
   For a root domain (`yourdomain.com` with no subdomain), use the **A
   records** GitHub's docs list instead of a CNAME.
4. Wait for DNS to propagate (can take a few minutes to a few hours), then
   check the box for **Enforce HTTPS** back in the Pages settings once it's
   available.

GitHub's official custom domain guide has more detail if you hit a snag:
[docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

## File structure

```
index.html
css/style.css
js/firebase-config.js   <- put your real Firebase config here
js/app.js                <- main app logic (tabs, question bank, study, calendar)
js/notes-assist.js       <- outline-structure parser + optional Gemini AI generation
.nojekyll
README.md
```

## Troubleshooting

- **"Couldn't connect to the shared database"** — double check
  `js/firebase-config.js` has your real project values, and that Anonymous
  auth is enabled in the Firebase console.
- **Question bank / calendar won't load** — check the Firestore rules were
  published, and that Firestore Database itself was created.
- **PDF upload does nothing** — some scanned PDFs have no selectable text
  layer (they're just images), so there's nothing to extract. Paste the text
  manually instead, or run the PDF through an OCR tool first.
- **Notes Assist finds nothing** — the parser needs bullets (`*`/`-`/`•`),
  `Term - definition` lines, or `**bold**` text to find patterns. Plain
  paragraphs with none of those won't produce cards; either reformat, or use
  the AI-assisted option instead.
- **AI generation fails** — double check the Gemini key is correct and that
  you haven't hit the free tier's rate limit (it resets daily); the error
  message in the app will show the HTTP status Google returned.

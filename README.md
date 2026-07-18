# WRPD StudyBoard — CRA 2026-2

A shared study site for you and your squad: flashcards, multiple choice,
true/false, a question bank anyone can add to, a group calendar, and a
notes-to-questions parser that reads your outline structure. Runs entirely
as static files on GitHub Pages, with Firebase (free tier) as the shared
database so everyone sees the same data.

## What's in each tab

1. **Study** — Run a session as flashcards, multiple choice, or true/false.
   Filter by category and/or week, shuffle if you want. Flashcards track
   right/wrong via a "Mark correct" button; multiple choice and true/false
   score automatically as you answer (and flash green/red on each pick).
2. **Question Bank** — Add a question by hand as Standard (flashcard +
   multiple choice) or True/False. Standard questions can auto-draft 3
   wrong-answer options — edit them freely before saving. Any question can
   be flagged **gold** (guaranteed on the exam) — gold questions get a gold
   outline everywhere they show up. New questions are auto-tagged with the
   current week.
3. **Upload** — Upload a PDF or paste text. It parses your outline
   structure instead of splitting sentences:
   - **`Term - definition`** (or `Term: definition`) lines split into a
     front/back flashcard, plus a companion true/false question.
   - **Nested bullets** (e.g. `Topic` → `* section` → `   * quote`) become
     questions like "Under Topic > section, what is noted?"
   Review each draft, mark it gold if it's need-to-know, then send it to
   the Question Bank.
4. **Calendar** — Shared calendar for test dates and study sessions, with
   month/week/day views.
5. **Help** — Contact info and a quick how-to.

Every question and event is stamped with the name of whoever added or last
edited it.

### Formatting your notes for best results

The parser looks for:

```
Ethics - values of right and wrong

Use of Force
* De-escalation
   * Officers must attempt verbal de-escalation before force when feasible
```

- Indent nested bullets with spaces or tabs so the parser can tell a
  section from its children.
- Use `*`, `-`, or `•` for bullets.
- Use a dash, colon, or period to split a "term" from its "definition" on
  one line — that becomes a direct front/back flashcard.
- For PDFs, the parser estimates indentation from the text's position on
  the page, which works well for typed/exported notes but is best-effort —
  double check the parsed results, and paste as plain text instead if a
  PDF's structure doesn't come through cleanly.

### Weeks

Every question is automatically filed under the week it was created in:
**Week 1 is July 13–19, 2026**, Week 2 is July 20–26, and so on — each
week starts Monday. Use the Week filter on the Study tab to study just
this week's material, or everything so far.

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

## 3. Changing the site's name or URL

**A. Change the in-app title/subtitle** — currently "WRPD StudyBoard" /
"CRA 2026-2". Edit these two spots in `index.html`:
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
1. Buy a domain from any registrar (Namecheap, Cloudflare, etc.) if you
   don't have one.
2. In the repo, go to **Settings > Pages > Custom domain**, and enter your
   domain (e.g. `study.yourdomain.com`).
3. At your domain registrar, add a **CNAME record** pointing
   `study` (or whichever subdomain) to `yourusername.github.io`.
   For a root domain (`yourdomain.com` with no subdomain), use the **A
   records** GitHub's docs list instead of a CNAME.
4. Wait for DNS to propagate (a few minutes to a few hours), then check
   **Enforce HTTPS** back in the Pages settings once it's available.

GitHub's official guide has more detail if you hit a snag:
[docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

## File structure

```
index.html
css/style.css
js/firebase-config.js   <- put your real Firebase config here
js/app.js                <- main app logic (tabs, question bank, study, calendar)
js/notes-assist.js       <- outline-structure parser for the Upload tab
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
- **Upload tab finds nothing** — the parser needs bullets (`*`/`-`/`•`) or
  `Term - definition` style lines to find patterns. Plain paragraphs with
  neither won't produce cards; reformat, or add the question manually in
  the Question Bank tab.

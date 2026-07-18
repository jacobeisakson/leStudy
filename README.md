# 10-22 Prep — LEO Exam Study Squad

A shared study site for you and your friends: flashcards, multiple choice quizzes,
a question bank anyone can add to, a group calendar for test dates, and a
notes-to-questions helper. Runs entirely as static files on GitHub Pages, with
Firebase (free tier) as the shared database so everyone sees the same data.

## What's in each tab

1. **Notes Assist** — Upload a PDF or paste text. It pulls out candidate
   sentences (all in your browser, nothing uploaded anywhere) so you can
   quickly turn them into flashcards. This is a plain text-processing tool,
   not AI — see "Adding real AI generation later" below if you want to upgrade it.
2. **Study** — Pick flashcards or multiple choice, filter by category, and
   go through the shared question bank.
3. **Question Bank** — Add a question and correct answer. Click "Generate
   multiple-choice options" and it'll draft 3 wrong answers (it tweaks the
   numbers in your answer, or borrows other answers from the bank if there's
   no number to work with) — edit them freely before saving.
4. **Calendar** — Shared calendar for test dates and study sessions, with
   month/week/day views.

Every question and event is stamped with the name of whoever added or last
edited it.

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

That's it — no server, no monthly bill at this scale (Firebase's free Spark
plan comfortably covers a study group).

---

## 2. Deploy to GitHub Pages

1. Create a new GitHub repository (public or private — private repos can
   still use GitHub Pages on paid plans; public is free and simplest).
2. Upload all the files in this folder (`index.html`, `css/`, `js/`,
   `README.md`) to the repo, preserving the folder structure.
3. In the repo, go to **Settings > Pages**.
4. Under **Build and deployment > Source**, choose **Deploy from a branch**.
5. Pick your default branch (usually `main`) and the `/ (root)` folder, then **Save**.
6. After a minute or two, GitHub will show your live URL, something like
   `https://yourusername.github.io/your-repo-name/`.
7. Share that URL with your friends. First visit, everyone picks a display name.

Any time you edit `js/firebase-config.js` (e.g. real config values) or any
other file, just commit and push — GitHub Pages redeploys automatically.

---

## 3. Adding real AI generation later (optional upgrade)

The Notes Assist tab currently uses plain sentence-splitting, no AI. If you
later want it to actually write good questions and answers from your notes,
you'd add a call to an AI API (like the Anthropic API) from the browser. Two
things to know before doing that:

- GitHub Pages can't hide a secret key — any key placed directly in the
  site's JavaScript is visible to anyone who views the page source.
- The straightforward approach is to have each person paste their **own**
  API key into a field in the site (stored only in their own browser's
  local storage, never sent anywhere but the AI provider). It's a bit of
  friction, but it means no one's key is exposed to the group or the public.
- Alternatively, you could stand up a small serverless function (e.g. a
  free Cloudflare Worker or Firebase Cloud Function) that holds the key
  server-side and the site calls that instead — more setup, but no key
  exposure and no per-person key needed.

Happy to build either version if you want to revisit this later.

---

## File structure

```
index.html
css/style.css
js/firebase-config.js   <- put your real Firebase config here
js/app.js                <- main app logic (tabs, question bank, study, calendar)
js/notes-assist.js       <- PDF/text -> candidate sentence extraction
README.md
```

## Troubleshooting

- **"Couldn't connect to the shared database"** — double check
  `js/firebase-config.js` has your real project values, and that Anonymous
  auth is enabled in the Firebase console.
- **Question bank / calendar won't load** — check the Firestore rules were
  published, and that Firestore Database itself was created (step 4 above).
- **PDF upload does nothing** — some scanned PDFs have no selectable text
  layer (they're just images), so there's nothing to extract. Paste the text
  manually instead, or run the PDF through an OCR tool first.

# ListLift — AI Listing Optimizer

A tiny web app that turns rough product info into an optimized e-commerce listing
(title, tags, description) for Etsy, Amazon, or eBay. Powered by the Gemini API.

## How it works
- `index.html` — the website (what visitors see)
- `api/optimize.js` — a serverless function that calls Gemini using your **secret** API key
- Your key lives only on the server (Vercel env variable), never in the browser

---

## Deploy in ~10 minutes (no coding needed)

### 1. Get a FREE Gemini API key
1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **Create API key** → copy it somewhere safe
   (This is FREE and separate from your Gemini Pro subscription.)

### 2. Put this project on GitHub
1. Create a free account at https://github.com if you don't have one
2. Click **New repository** → name it `listlift` → Create
3. On the repo page, click **uploading an existing file**
4. Drag in ALL these files/folders: `index.html`, `package.json`,
   `.gitignore`, and the `api` folder (with `optimize.js` inside it)
5. Click **Commit changes**

### 3. Deploy on Vercel
1. Go to https://vercel.com and sign up with your GitHub account (free)
2. Click **Add New… → Project**
3. Select your `listlift` repository → **Import**
4. Before clicking Deploy, open **Environment Variables** and add:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** (paste the key from step 1)
5. Click **Deploy**

After ~1 minute you'll get a live link like `https://listlift.vercel.app`.
That's your real, working product. Share that link with anyone.

---

## Notes
- Free Gemini tier allows roughly 5–15 requests/minute and 100–1,000/day —
  plenty for testing with real sellers.
- The model used is `gemini-2.5-flash` (fast + free tier eligible).
- To change wording or marketplace rules, edit `api/optimize.js`.

## Next step after launch
Add a payment link (Stripe Payment Links or Gumroad — both free to start) so
you can charge once people want more than a free sample.

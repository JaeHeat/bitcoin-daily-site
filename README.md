# bitcoin-daily.com

Brand hub + content blog for **Bitcoin Daily**. Static HTML/CSS, no build step. The blog is the
repurposing engine for IG carousels / YouTube videos (see `../content-repurposing-workflow.md`).

## Deploy
Hosted on **Netlify**, auto-deploys on every push to `main`.
- Build command: _(none)_
- Publish directory: repo root (`.`)

Connected custom domain: `bitcoin-daily.com` (primary).

## Edit
Edit the `.html` / `styles.css` files directly and push — Netlify rebuilds automatically.
After adding a new blog post, also add its URL to `sitemap.xml` and a card to `blog/index.html`.

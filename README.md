GitHub Pages deployment — Apps Script URL injection

This repo includes a GitHub Actions workflow that injects your Apps Script web app URL at deploy time so the URL is not stored in git.

Setup steps

1. Create the repository secret
   - Go to your GitHub repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `APPS_SCRIPT_URL`
   - Value: the full Apps Script web app URL (for example: `https://script.google.com/macros/s/ABCD.../exec`)

2. Push to `main` or trigger the workflow manually
   - The workflow `.github/workflows/pages-deploy.yml` runs on push to `main` or via `Actions → pages-deploy → Run workflow`.
   - During the run, the secret is written into the built `site/apps-script-url.txt` artifact (not committed) and deployed to Pages.

3. Verify Pages
   - After the workflow finishes, open your GitHub Pages site URL; the app will attempt to load `apps-script-url.txt` from the site root and auto-sync.

Security notes

- The secret never appears in git history or the repo. Only GitHub Actions can access it during the workflow.
- Consider adding a lightweight secret/token check inside your Apps Script endpoint so requests without the token are rejected.

Troubleshooting

- If the app still shows "Apps Script URL not set", open Actions and inspect the workflow logs for the `Prepare site directory` step to confirm the secret was read.
- Ensure your workflow runs on the branch you use for Pages (default: `main`).

If you want, I can add a small Apps Script snippet to validate a token parameter on incoming requests.
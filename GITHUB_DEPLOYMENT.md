# GitHub Pages deployment

This repository is ready to deploy the browser application from `app/` using GitHub Actions.

## Privacy

Do not commit real student PDFs, exported student JSON files, or generated reports. The `.gitignore` excludes common private-output patterns, but always review `git status` before every commit.

The deployed application parses selected files in the user's browser. GitHub Pages hosts only the application files and does not store selected diagnostics unless the code is later changed to upload them.

## First deployment

1. Create an empty public GitHub repository.
2. Run the terminal commands supplied with this package.
3. In the repository, open **Settings → Pages**.
4. Set **Source** to **GitHub Actions**.
5. Open **Actions** and wait for `Deploy TestPrep SAT Roadmap to GitHub Pages` to finish.
6. Use the URL shown in the deployment or under **Settings → Pages**.

## Updating

After changing the application:

```bash
git add .
git status
git commit -m "Describe the update"
git push
```

Each push to `main` deploys the current contents of `app/` automatically.

## Important path rule

Runtime assets must use relative paths such as `css/app.css` and `vendor/pdfjs/pdf.worker.min.js`. Do not change them to domain-root paths beginning with `/` because project Pages sites are served under `/REPOSITORY-NAME/`.

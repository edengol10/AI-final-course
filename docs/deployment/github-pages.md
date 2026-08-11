# GitHub Pages deployment

The public site is deployed from GitHub Actions to <https://edengol10.github.io/AI-final-course/>.

The default workflow replays the checked-in synthetic fixture, validates the static snapshot, builds the Vite application for the repository subpath, scans the artifact for restricted material, and deploys with the GitHub Pages actions.

The optional live workflow runs only when `PUBLIC_RESEARCH_DATA_APPROVED=true` and `WANDB_API_KEY` are configured in repository settings. It scans the approved narrow W&B history, validates the resulting snapshot, builds, scans, and deploys only after all checks pass. A failed export leaves the last deployed site in place.

# Course report

The final four-page submission report is authored in Hebrew with LaTeX. The public URL,
current reviewed W&B counts, browser evidence, and deployment checks are incorporated.
The only unresolved submission field is the second participant name, which was not supplied.

Build from the repository root:

```bash
python -m pip install -e '.[report]'
python report/generate_assets.py
npx playwright screenshot --wait-for-timeout 5000 --viewport-size "1800,820" \
  https://edengol10.github.io/AI-final-course/ report/assets/dashboard-live.png
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -outdir=report/build report/airfoil_explorer_report_he.tex
```

The Hebrew source uses `polyglossia` with XeLaTeX and requires the macOS `Arial Hebrew`
and `Arial` fonts. The submission PDF is
`output/pdf/Airfoil_Explorer_Course_Report_HE_FINAL.pdf`. The dashboard figure is a browser
screenshot of the deployed site; the QR code is generated from the same public URL.

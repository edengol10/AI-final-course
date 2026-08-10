# Course report

The report is authored in LaTeX and intentionally remains a submission draft until the
second participant name, reviewed live W&B export, protected production URL, and final
browser/Cloudflare evidence are available.

Build from the repository root:

```bash
python -m pip install -e '.[report]'
python report/generate_assets.py
latexmk -xelatex -interaction=nonstopmode -halt-on-error \
  -outdir=report/build report/airfoil_explorer_report.tex
```

The committed PDF is `Airfoil_Explorer_Course_Report_DRAFT.pdf`. Report-only figures are
generated deterministically from the validated synthetic fixture; they are visibly labelled
as fixture evidence and are not presented as live W&B results or browser screenshots.

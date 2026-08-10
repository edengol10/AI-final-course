#!/usr/bin/env python3
"""Generate report-only visuals from the repository's validated QA fixture."""

from __future__ import annotations

import json
from pathlib import Path

import qrcode
from airfoil_exporter.geometry import build_bp3333_coordinates
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "report" / "assets"
SOURCE_URL = "https://github.com/edengol10/AI-final-course"

def font(size: int, *, bold: bool = False):
    candidates = [
        Path(
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
            if bold
            else "/System/Library/Fonts/Supplemental/Arial.ttf"
        ),
        Path(
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
            if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        ),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def rounded_card(draw, box, *, fill, outline="#DCE4EE", radius=28):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=2)


def dashboard_figure() -> Path:
    fixture = ROOT / (
        "public/data/datasets/"
        "cg-fc79df12b8678cd4.000.a742d95bd4bda796.json"
    )
    dataset = json.loads(fixture.read_text())
    row = 1
    columns = dataset["columns"]
    parameters = columns["parameters"][row]
    x_values, y_values = build_bp3333_coordinates(parameters)

    width, height = 1800, 730
    canvas = Image.new("RGB", (width, height), "#F6F8FB")
    draw = ImageDraw.Draw(canvas)
    title = font(43, bold=True)
    label = font(23, bold=True)
    body = font(21)
    value = font(49, bold=True)
    small = font(17)

    draw.text((60, 36), "Selected database wing", font=title, fill="#17233B")
    draw.text(
        (60, 94),
        (
            f"Run {columns['runId'][row]} · step {columns['globalStep'][row]} · "
            f"{columns['replicateCount'][row]} valid replicates"
        ),
        font=body,
        fill="#657287",
    )

    wing_box = (52, 146, 1190, 602)
    rounded_card(draw, wing_box, fill="#FFFFFF")
    left, top, right, bottom = 108, 206, 1134, 548
    draw.line((left, (top + bottom) / 2, right, (top + bottom) / 2), fill="#D9E2EC", width=2)
    draw.text((108, 164), "BP3333 geometry · equal axes", font=label, fill="#223047")

    y_min, y_max = min(y_values) - 0.025, max(y_values) + 0.025
    x_min, x_max = min(x_values), max(x_values)
    scale = min((right - left) / (x_max - x_min), (bottom - top) / (y_max - y_min))
    x_offset = left + ((right - left) - (x_max - x_min) * scale) / 2
    y_offset = top + ((bottom - top) - (y_max - y_min) * scale) / 2
    points = [
        (
            x_offset + (x_item - x_min) * scale,
            y_offset + (y_max - y_item) * scale,
        )
        for x_item, y_item in zip(x_values, y_values, strict=True)
    ]
    draw.polygon(points, fill="#DCEBFA")
    draw.line(points + [points[0]], fill="#1877D2", width=6, joint="curve")
    draw.text(
        (108, 558),
        "Wing and all metrics come from one stored row; no interpolation.",
        font=small,
        fill="#657287",
    )

    cards = [
        ((1220, 146, 1748, 278), f"{columns['cl'][row]:+.3f}", "Cl · lift coefficient", "#0A7D54"),
        ((1220, 294, 1748, 426), f"{columns['cd'][row]:+.3f}", "Cd · drag coefficient", "#B42318"),
    ]
    for box, shown_value, shown_label, color in cards:
        rounded_card(draw, box, fill="#FFFFFF")
        draw.text((box[0] + 28, box[1] + 18), shown_value, font=value, fill=color)
        draw.text((box[0] + 30, box[1] + 89), shown_label, font=body, fill="#657287")

    peak_box = (1220, 442, 1748, 602)
    rounded_card(draw, peak_box, fill="#17233B", outline="#17233B")
    draw.text((peak_box[0] + 26, peak_box[1] + 20), "SPOD mode 1 peaks", font=label, fill="#FFFFFF")
    draw.text(
        (peak_box[0] + 28, peak_box[1] + 68),
        f"1st  {columns['spodMode1PeakFreq1'][row]:.2f} TU⁻¹",
        font=body,
        fill="#B6D8F7",
    )
    draw.text(
        (peak_box[0] + 272, peak_box[1] + 68),
        f"2nd  {columns['spodMode1PeakFreq2'][row]:.2f} TU⁻¹",
        font=body,
        fill="#B6D8F7",
    )

    draw.text((60, 638), "VALIDATED SYNTHETIC FIXTURE STATE", font=label, fill="#A15C00")
    draw.text(
        (60, 681),
        "Programmatic report figure — not a production screenshot or live W&B result.",
        font=body,
        fill="#657287",
    )
    output = ASSET_DIR / "dashboard-fixture-figure.png"
    canvas.save(output, quality=95)
    return output


def source_qr() -> Path:
    code = qrcode.QRCode(version=None, box_size=9, border=2)
    code.add_data(SOURCE_URL)
    code.make(fit=True)
    output = ASSET_DIR / "source-repository-qr.png"
    code.make_image(fill_color="#17233B", back_color="white").convert("RGB").save(output)
    return output


def main() -> None:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    print(dashboard_figure())
    print(source_qr())


if __name__ == "__main__":
    main()

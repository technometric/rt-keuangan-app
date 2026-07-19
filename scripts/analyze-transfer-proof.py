#!/usr/bin/env python3
import json
import re
import sys


def emit(data):
    print(json.dumps(data, ensure_ascii=False))


def normalize_amount(raw):
    if not raw:
        return 0
    digits = re.sub(r"[^0-9]", "", raw)
    return int(digits) if digits else 0


def pick_amount(text):
    # Prioritas 1: angka yang eksplisit didahului kata kunci nominal
    # (Rp/IDR/nominal/jumlah/total/amount/transfer). Ini paling akurat
    # karena tidak akan ketuker sama nomor rekening/No. Ref.
    priority_pattern = r"(?:rp|idr|nominal|jumlah|total|amount|transfer)\s*[:.]?\s*([0-9][0-9.\s,]{3,})"
    candidates = []
    for match in re.finditer(priority_pattern, text, flags=re.I):
        value = normalize_amount(match.group(1))
        if value >= 1000:
            candidates.append(value)
    if candidates:
        return max(candidates)

    # Fallback: cuma dipakai kalau prioritas di atas nihil sama sekali.
    # Rawan salah tangkap nomor rekening, jadi ini jalur terakhir.
    fallback_pattern = r"([0-9]{1,3}(?:[.,\s][0-9]{3}){1,4})"
    for match in re.finditer(fallback_pattern, text, flags=re.I):
        value = normalize_amount(match.group(1))
        if value >= 1000:
            candidates.append(value)
    return max(candidates) if candidates else 0


def pick_status(text):
    match = re.search(
        r"(Transaksi\s+Berhasil|Transaksi\s+Gagal|Transaksi\s+Diproses|Transaksi\s+Pending)",
        text,
        flags=re.I,
    )
    return match.group(1).title() if match else ""


def pick_date(text):
    patterns = [
        # tanggal panjang + jam + WIB, mis: "06 Juli 2026, 16:59:18 WIB"
        r"\b([0-3]?\d\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|agust|sep|okt|nov|des)[a-z]*\s+(?:20)?\d{2},?\s*\d{1,2}[:.]\d{2}(?:[:.]\d{2})?\s*WIB?)\b",
        r"\b([0-3]?\d[/-][01]?\d[/-](?:20)?\d{2})\b",
        r"\b([0-3]?\d\s+(?:jan|feb|mar|apr|mei|jun|jul|agu|agust|sep|okt|nov|des)[a-z]*\s+(?:20)?\d{2})\b",
        r"\b((?:20)\d{2}[/-][01]?\d[/-][0-3]?\d)\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.I)
        if match:
            return match.group(1)
    return ""


def pick_account(text, expected):
    expected_digits = re.sub(r"\D", "", expected or "")
    if expected_digits and expected_digits in re.sub(r"\D", "", text):
        return expected_digits

    # Prioritas: ambil angka dari blok setelah baris "Tujuan", karena itu
    # rekening penerima. Baris di blok "Sumber Dana" (biasanya ada '*'
    # sensor) dan "No. Ref" harus dilewati.
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    tujuan_idx = None
    for i, line in enumerate(lines):
        if re.search(r"\btujuan\b", line, flags=re.I) and "sumber" not in line.lower():
            tujuan_idx = i
            break

    if tujuan_idx is not None:
        block = lines[tujuan_idx + 1: tujuan_idx + 6]
        for line in block:
            if "*" in line or re.search(r"ref", line, flags=re.I):
                continue
            digits = re.sub(r"\D", "", line)
            if 8 <= len(digits) <= 24:
                return digits

    # Fallback: cara lama, tapi skip baris yang mengandung '*' (rekening
    # sensor) dan skip yang muncul tepat setelah "No. Ref" / "Ref".
    candidates = re.findall(r"\b[0-9][0-9\s.-]{7,24}[0-9]\b", text)
    normalized = [re.sub(r"\D", "", c) for c in candidates]
    normalized = [c for c in normalized if 8 <= len(c) <= 24]
    return normalized[0] if normalized else ""


def preprocess_image(image):
    from PIL import Image, ImageOps, ImageFilter

    image = image.convert("L")  # grayscale
    w, h = image.size
    if w < 1200:
        scale = 1600 / w
        image = image.resize((int(w * scale), int(h * scale)), Image.LANCZOS)
    image = ImageOps.autocontrast(image)
    image = image.filter(ImageFilter.SHARPEN)
    return image


def read_text(image_path):
    try:
        from PIL import Image
        import pytesseract
    except Exception as exc:
        raise RuntimeError("Dependency OCR belum tersedia. Install: pip install pytesseract pillow dan paket tesseract-ocr.") from exc

    image = Image.open(image_path)
    image = preprocess_image(image)
    config = "--psm 6"
    try:
        return pytesseract.image_to_string(image, lang="ind+eng", config=config)
    except Exception:
        return pytesseract.image_to_string(image, config=config)


def main():
    if len(sys.argv) < 2:
        raise RuntimeError("Path gambar wajib diisi")
    image_path = sys.argv[1]
    expected_account = sys.argv[2] if len(sys.argv) > 2 else ""
    nama_warga = sys.argv[3] if len(sys.argv) > 3 else ""
    no_rumah = sys.argv[4] if len(sys.argv) > 4 else ""

    text = read_text(image_path)
    account = pick_account(text, expected_account)
    amount = pick_amount(text)
    date = pick_date(text)
    status_transaksi = pick_status(text)
    confidence = 0.3
    if account:
        confidence += 0.25
    if amount:
        confidence += 0.25
    if date:
        confidence += 0.15
    if expected_account and account and re.sub(r"\D", "", expected_account) == account:
        confidence += 0.05

    notes = []
    if expected_account and account and re.sub(r"\D", "", expected_account) != account:
        notes.append("No rekening tujuan terbaca berbeda dari rekening setting.")
    if not account:
        notes.append("No rekening tujuan belum terbaca.")
    if not amount:
        notes.append("Nominal transfer belum terbaca.")
    if not date:
        notes.append("Tanggal transfer belum terbaca.")
    if nama_warga or no_rumah:
        notes.append(f"Bukti dari {nama_warga or '-'} / {no_rumah or '-'}.")

    emit({
        "status_analisa": "berhasil",
        "status_transaksi": status_transaksi,
        "no_rekening_tujuan": account,
        "nominal_transfer": amount,
        "tanggal_transfer": date,
        "catatan": " ".join(notes) or "OCR lokal berhasil membaca bukti transfer.",
        "raw_text": text.strip(),
        "confidence": min(round(confidence, 2), 1),
    })


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        emit({
            "status_analisa": "gagal",
            "no_rekening_tujuan": "",
            "nominal_transfer": 0,
            "tanggal_transfer": "",
            "catatan": str(exc),
            "raw_text": "",
            "confidence": 0,
        })
        sys.exit(0)
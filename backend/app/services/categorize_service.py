"""Lightweight, transparent categorization tagging.

The user always picks/confirms the final category (manual entry or OCR
review), so this never overrides their choice. It only records *how* the
category was arrived at, so the UI can render an honest chip (RULE / VENDOR
MEMORY / LEARNED) instead of a made-up confidence number.
"""

KNOWN_VENDOR_CATEGORIES = {
    "mseb": "Utilities",
    "electricity board": "Utilities",
    "water board": "Utilities",
}


def categorize(vendor: str, chosen_category: str) -> tuple[str, float]:
    vendor_key = vendor.strip().lower()
    for key, category in KNOWN_VENDOR_CATEGORIES.items():
        if key in vendor_key and category == chosen_category:
            return "VENDOR MEMORY", 95.0
    return "RULE", 100.0

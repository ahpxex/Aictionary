"""Build the independent English frequency database with wordfreq 3.1.1.

Run: uv run --with wordfreq==3.1.1 python scripts/build-word-frequency.py
Only exact alphabetic English tokens (including apostrophes) are exported.
Numbers and multi-token phrases need wordfreq's Python tokenizer and are
intentionally left unknown rather than assigned an invented frequency.
"""
import gzip
import importlib.metadata
import math
from pathlib import Path
import sqlite3
import tempfile
import wordfreq

VERSION = "3.1.1"
assert importlib.metadata.version("wordfreq") == VERSION
output = Path(__file__).resolve().parents[1] / "src-tauri/data/wordfreq-en-3.1.1.sqlite.gz"
distribution = importlib.metadata.distribution("wordfreq")
# Keep upstream attribution and source citations INSIDE the database.
notices = distribution.read_text("METADATA") or ""
license_text = distribution.read_text("LICENSE.txt") or ""
assert "SUBTLEX" in notices and "Creative Commons" in notices
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory) / "frequency.sqlite"
    conn = sqlite3.connect(path)
    conn.executescript("""
        CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
        CREATE TABLE frequencies (word TEXT PRIMARY KEY, zipf REAL NOT NULL) WITHOUT ROWID;
    """)
    metadata = {
        "source": f"wordfreq {VERSION} by Robyn Speer",
        "source_url": "https://github.com/rspeer/wordfreq",
        "license": "CC BY-SA 4.0",
        "license_url": "https://creativecommons.org/licenses/by-sa/4.0/",
        "language": "en",
        "scope": "Exact English tokens only; no number or phrase estimation. Converted to SQLite by Aictionary.",
        "upstream_notices": notices,
        "upstream_code_license": license_text,
    }
    conn.executemany("INSERT INTO metadata VALUES (?, ?)", sorted(metadata.items()))
    rows = [(word, round(math.log10(frequency) + 9, 2))
            for word, frequency in wordfreq.get_frequency_dict("en", wordlist="large").items()
            if word.isascii() and any(char.isalpha() for char in word)
            and all(char.isalpha() or char == "'" for char in word)]
    conn.executemany("INSERT INTO frequencies VALUES (?, ?)", sorted(rows))
    conn.commit()
    conn.execute("VACUUM")
    conn.close()
    output.write_bytes(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
    print(f"{len(rows)} tokens; {output.stat().st_size:,} compressed bytes")

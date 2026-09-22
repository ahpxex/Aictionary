# English word frequency

`wordfreq-en-3.1.1.sqlite.gz` is a separate corpus-frequency database, derived
from [wordfreq 3.1.1](https://github.com/rspeer/wordfreq) by Robyn Speer.
The frequency data is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
independently of Aictionary's application code. The SQLite `metadata` table
contains the upstream package metadata, full attribution, source citations,
license information, and a description of this conversion. Preserve that table
when redistributing the database. SUBTLEX data by Marc Brysbaert and colleagues
is freely available; the embedded notices also credit Google Books Ngrams,
OpenSubtitles, Wikipedia, Leeds Internet Corpus, and the other upstream sources.

Regenerate with `uv run --with wordfreq==3.1.1 python scripts/build-word-frequency.py`.
The build is deterministic. It retains exact ASCII alphabetic English tokens
and apostrophes; numeric templates and multi-token phrase estimates are omitted
because those require wordfreq's tokenizer. A missing score means unknown, not
zero frequency. This is historical corpus data, not a live frequency feed.

The app extracts the database to its own versioned cache file. Neither updating
the distribution dictionary nor regenerating user entries changes this data.

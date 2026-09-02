#!/usr/bin/env python3
"""Fetch the RSS feeds listed in feeds.yaml and write docs/data/articles.json.

Run locally:
    python -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    python scripts/fetch_feeds.py

In production this is run on a schedule by
.github/workflows/update-feeds.yml, which commits the refreshed
docs/data/articles.json back to the repository.
"""
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import yaml

ROOT = Path(__file__).resolve().parent.parent
FEEDS_FILE = ROOT / "feeds.yaml"
OUTPUT_FILE = ROOT / "docs" / "data" / "articles.json"
MAX_ARTICLES_PER_FEED = 30
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
HTML_TAG_RE = re.compile(r"<[^<]+?>")


def parse_entry_date(entry):
    for key in ("published_parsed", "updated_parsed"):
        value = entry.get(key)
        if value:
            return datetime.fromtimestamp(time.mktime(value), tz=timezone.utc)
    return None


def clean_summary(entry, limit=300):
    summary = entry.get("summary", "") or ""
    text = HTML_TAG_RE.sub("", summary).strip()
    return text[:limit]


def fetch_raw(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/rss+xml, application/xml, text/xml, */*;q=0.1",
        },
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        return resp.read()


def fetch_feed(source):
    print(f"Fetching {source['name']}...", file=sys.stderr)
    try:
        raw = fetch_raw(source["url"])
    except Exception as exc:  # noqa: BLE001 - keep going on a per-feed basis
        print(f"  WARNING: request failed for {source['name']}: {exc}", file=sys.stderr)
        return []

    parsed = feedparser.parse(raw)
    if parsed.bozo and not parsed.entries:
        print(f"  WARNING: failed to parse {source['name']}: {parsed.get('bozo_exception')}", file=sys.stderr)
        print(f"  DEBUG raw snippet: {raw[:400]!r}", file=sys.stderr)
        return []

    articles = []
    for entry in parsed.entries[:MAX_ARTICLES_PER_FEED]:
        published = parse_entry_date(entry)
        articles.append(
            {
                "title": entry.get("title", "").strip(),
                "link": entry.get("link", ""),
                "source": source["name"],
                "category": source["category"],
                "lang": source.get("lang", "en"),
                "published": published.isoformat() if published else None,
                "summary": clean_summary(entry),
            }
        )
    return articles


def main():
    with open(FEEDS_FILE, encoding="utf-8") as f:
        feeds = yaml.safe_load(f)["feeds"]

    all_articles = []
    failures = []
    for source in feeds:
        try:
            articles = fetch_feed(source)
            if not articles:
                failures.append(source["name"])
            all_articles.extend(articles)
        except Exception as exc:  # noqa: BLE001 - keep going on a per-feed basis
            print(f"  ERROR fetching {source['name']}: {exc}", file=sys.stderr)
            failures.append(source["name"])

    seen_links = set()
    unique_articles = []
    for article in sorted(all_articles, key=lambda a: a["published"] or "", reverse=True):
        if article["link"] in seen_links:
            continue
        seen_links.add(article["link"])
        unique_articles.append(article)

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(unique_articles),
        "failed_sources": failures,
        "articles": unique_articles,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(unique_articles)} articles to {OUTPUT_FILE}", file=sys.stderr)
    if failures:
        print(f"{len(failures)} source(s) failed: {', '.join(failures)}", file=sys.stderr)


if __name__ == "__main__":
    main()

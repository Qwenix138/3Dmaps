import re
from html.parser import HTMLParser
from pathlib import Path

from mapgen import __version__
from mapgen.web import app

ROOT = Path(__file__).resolve().parent.parent


class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids: list[str] = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if "id" in values:
            self.ids.append(values["id"])


def test_android_ui_has_language_quality_and_no_duplicate_ids():
    html = (ROOT / "android/app/src/main/assets/web/index.html").read_text(encoding="utf-8")
    parser = IdParser()
    parser.feed(html)
    assert len(parser.ids) == len(set(parser.ids))
    assert 'id="langSelect"' in html
    assert 'data-quality="fast"' in html
    assert 'id="resultSummary"' in html
    assert 'id="smoothing"' in html


def test_android_i18n_keys_exist_in_both_languages():
    html = (ROOT / "android/app/src/main/assets/web/index.html").read_text(encoding="utf-8")
    js = (ROOT / "android/app/src/main/assets/web/app.js").read_text(encoding="utf-8")
    keys = set(re.findall(r'data-i18n(?:-html|-placeholder|-aria|-title)?="([^"]+)"', html))
    assert keys
    for key in keys:
        assert f"'{key}':" in js, key
    ru_part, en_part = js.split("    en: {", 1)
    en_part = en_part.split("    }\n  };", 1)[0]
    ru = set(re.findall(r"^      '([^']+)':", ru_part, re.M))
    en = set(re.findall(r"^      '([^']+)':", en_part, re.M))
    assert ru == en


def test_desktop_ui_has_language_quality_and_smoothing():
    response = app.test_client().get("/")
    assert response.status_code == 200
    html = response.get_data(as_text=True)
    parser = IdParser()
    parser.feed(html)
    assert len(parser.ids) == len(set(parser.ids))
    for marker in ('id="langSelect"', 'id="smoothing"', 'data-quality="detail"', f'v{__version__}'):
        assert marker in html
    keys = set(re.findall(r'data-i18n(?:-html|-placeholder|-aria|-title)?="([^"]+)"', html))
    assert keys
    for key in keys:
        assert f"'{key}':" in html, key

"""Copy code/*.py into the HTML pages.

Each page marks a spot like this:

    <!-- CODE:adaboost.py -->  ...anything...  <!-- /CODE -->

Running this script replaces the inside with a highlighted <pre> block of that
file, so the runnable .py files and the pages never drift apart.

Usage:  python3 tools/embed_code.py
"""
import html
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
PATTERN = re.compile(r"(<!-- CODE:(?P<name>[\w.\-]+) -->)(.*?)(<!-- /CODE -->)", re.S)


def render(name):
    source = (ROOT / "code" / name).read_text().rstrip() + "\n"
    body = html.escape(source, quote=False)
    return f'\n<pre class="code"><code class="language-python">{body}</code></pre>\n'


def main():
    for page in sorted((ROOT / "pages").glob("*.html")):
        text = page.read_text()
        new = PATTERN.sub(lambda m: m.group(1) + render(m.group("name")) + m.group(4), text)
        if new != text:
            page.write_text(new)
            print("updated", page.name)


if __name__ == "__main__":
    main()

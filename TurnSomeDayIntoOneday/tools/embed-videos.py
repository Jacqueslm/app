#!/usr/bin/env python3
"""Put each YouTube video on the page that already ranks for its question.

The channel and the site were running as two separate businesses. This joins
them: the page gets a video (Google can show a video thumbnail in results, which
roughly doubles click rate on a text listing), and the video gets watch time
from people who arrived with the problem already - the only signal that makes
YouTube start recommending it.

The player is a click-to-load facade: a static thumbnail until tapped, so the
page keeps its speed score and nothing is sent to YouTube until someone asks
for it. That matters on these pages - people read them at 4am on a phone.

Idempotent. Run it again after editing data/page-videos.json; it replaces what
it wrote before rather than stacking a second copy.
"""
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MAP = json.loads((ROOT / 'data' / 'page-videos.json').read_text())

START = '<!-- video:start -->'
END = '<!-- video:end -->'
LD_START = '<!-- video-ld:start -->'
LD_END = '<!-- video-ld:end -->'

CSS = """
<style>
/* click-to-load video facade - nothing loads from YouTube until tapped */
.vid{margin:0 0 40px}
.vid h2{margin-bottom:10px}
.vid p.vid-blurb{font-size:15px;color:var(--ts,#c3c1e0);line-height:1.6;margin-bottom:16px}
.vid-frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;
  background:#0b0a1c;border:1px solid var(--bdr,#302c58);cursor:pointer;display:block;padding:0}
.vid-frame img{width:100%;height:100%;object-fit:cover;display:block;border:0}
.vid-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.vid-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(180deg,rgba(8,7,26,.15),rgba(8,7,26,.55))}
.vid-play svg{width:66px;height:66px;filter:drop-shadow(0 3px 10px rgba(0,0,0,.5))}
.vid-frame:hover .vid-play svg,.vid-frame:focus-visible .vid-play svg{transform:scale(1.06)}
.vid-play svg{transition:transform .18s ease}
@media (prefers-reduced-motion:reduce){.vid-play svg{transition:none}}
.vid-frame:focus-visible{outline:2px solid var(--green,#7ee8a2);outline-offset:3px}
.vid-more{display:inline-block;margin-top:12px;font-size:14px;color:var(--tm,#8b89ad);text-decoration:underline}
</style>
"""

BLOCK = """{start}
{css}  <section class="partner vid">
    <h2>{heading}</h2>
    <p class="vid-blurb">{blurb}</p>
    <button class="vid-frame" type="button" data-yt="{vid}" aria-label="Play: {title_attr}">
      <img src="https://i.ytimg.com/vi/{vid}/hqdefault.jpg" alt="" width="480" height="360" loading="lazy">
      <span class="vid-play"><svg viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7a8.6 8.6 0 0 0-6-6C55.2 0 34 0 34 0S12.8 0 7.5 1.6a8.6 8.6 0 0 0-6 6.1A90 90 0 0 0 0 24a90 90 0 0 0 1.5 16.3 8.6 8.6 0 0 0 6 6C12.8 48 34 48 34 48s21.2 0 26.5-1.6a8.6 8.6 0 0 0 6-6.1A90 90 0 0 0 68 24a90 90 0 0 0-1.5-16.3z" fill="#f00"/><path d="M27 34.3 44.8 24 27 13.7z" fill="#fff"/></svg></span>
    </button>
    <a class="vid-more" href="https://www.youtube.com/watch?v={vid}" target="_blank" rel="noopener">Watch on YouTube instead →</a>
  </section>
<script>
document.querySelectorAll('.vid-frame').forEach(function(b){{
  b.addEventListener('click', function(){{
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + b.dataset.yt + '?autoplay=1&rel=0';
    f.title = b.getAttribute('aria-label').replace(/^Play: /, '');
    f.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    b.replaceChildren(f);
  }}, {{once:true}});
}});
</script>
{end}"""

LD = """{ld_start}
<script type="application/ld+json">
{json}
</script>
{ld_end}"""


def strip(text, a, b):
    return re.sub(re.escape(a) + r'.*?' + re.escape(b), '', text, flags=re.S)


def main():
    changed = []
    for slug, v in MAP.items():
        if slug.startswith('_'):
            continue
        page = ROOT / (slug + '.html')
        if not page.exists():
            print(f'  skip  {slug} - no such page', file=sys.stderr)
            continue
        html = page.read_text()
        html = strip(html, START, END)
        html = strip(html, LD_START, LD_END)

        block = BLOCK.format(
            start=START, end=END, css=CSS, vid=v['id'],
            heading=v['heading'], blurb=v['blurb'],
            title_attr=v['title'].replace('"', '&quot;'))

        ld = LD.format(ld_start=LD_START, ld_end=LD_END, json=json.dumps({
            '@context': 'https://schema.org',
            '@type': 'VideoObject',
            'name': v['title'],
            'description': v['description'],
            'thumbnailUrl': [f"https://i.ytimg.com/vi/{v['id']}/maxresdefault.jpg"],
            'uploadDate': v['date'],
            'duration': v['duration'],
            'embedUrl': f"https://www.youtube.com/embed/{v['id']}",
            'contentUrl': f"https://www.youtube.com/watch?v={v['id']}",
            'publisher': {
                '@type': 'Organization',
                'name': 'Turn Someday Into Day One',
                'url': 'https://www.turnsomedayintodayone.com'
            }
        }, indent=2))

        # schema goes in the head; the player goes right after the hero, where
        # somebody who is skimming will actually see it
        html = html.replace('</head>', ld + '\n</head>', 1)
        m = re.search(r'<section class="hero">.*?</section>\s*', html, flags=re.S)
        if not m:
            print(f'  skip  {slug} - no hero section to anchor to', file=sys.stderr)
            continue
        html = html[:m.end()] + '\n' + block + '\n\n' + html[m.end():]
        page.write_text(html)
        changed.append(slug)
        print(f'  ok    {slug} <- {v["id"]}')
    print(f'\n{len(changed)} page(s) updated.')


if __name__ == '__main__':
    main()

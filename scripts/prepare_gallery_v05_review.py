from pathlib import Path
root=Path(r'C:\Personal_Projects\Framers')
code=(root/'scripts/review_gallery_browser.mjs').read_text()
code=code.replace('gallery_v04','gallery_v05').replace(':8765',':8766').replace(':9335',':9336').replace('i<90','i<240').replace('45 seconds','120 seconds')
(root/'scripts/review_gallery_v05_browser.mjs').write_text(code)

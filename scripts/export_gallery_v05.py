import bpy
from pathlib import Path
ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v05'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'framers_gallery_v05.blend'))
scene=bpy.context.scene;SHELL=bpy.data.objects['00_CONTINUOUS_ARCHITECTURE']
exec((ROOT/'scripts/apply_gallery_v05_bakes.py').read_text(encoding='utf-8'))
code=(ROOT/'scripts/build_gallery_v05.py').read_text(encoding='utf-8')
exec(code[code.index('# Resolve modifiers and join'):])

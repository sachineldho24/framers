"""Reuse the tested gallery controls with the current Meshy scene and live PBR light."""
from pathlib import Path
import shutil
ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v06';BASE=ROOT/'gallery_v05'
shutil.copytree(BASE/'vendor',OUT/'vendor',dirs_exist_ok=True)
html=(BASE/'index.html').read_text(encoding='utf-8')
html=html.replace('framers_gallery_v05.glb','framers_gallery_v06.glb')
html=html.replace("loadAsync('./framers_gallery_v06.glb'","loadAsync('./framers_gallery_v06.glb?v=sofa-left-20260908'")
html=html.replace('<title>Framers — Continuous Gallery</title>','<title>Framers — Meshy Gallery v06</title>')
html=html.replace('FRAMERS / CONTINUOUS GALLERY','FRAMERS / GALLERY V06')
html=html.replace('floor-plan.png','furniture-layout.png')
html=html.replace('scene.environmentIntensity=.30','scene.environmentIntensity=.50')
html=html.replace('0x534736,.20','0x534736,.38')
html=html.replace('Math.min(devicePixelRatio,1.5)','Math.min(devicePixelRatio,1.25)')
html=html.replace("window.gallery={gltf,routeAt,pose,scene,renderer,rooms:names}","window.gallery={gltf,routeAt,pose,scene,renderer,rooms:names,revision:'v06'}")
(OUT/'index.html').write_text(html,encoding='utf-8')
review=(ROOT/'scripts/review_gallery_v05_browser.mjs').read_text(encoding='utf-8').replace('gallery_v05','gallery_v06')
review=review.replace('i<240','i<480').replace('120 seconds','240 seconds')
review=review.replace('({duration:gallery.gltf.animations[0].duration','({revision:gallery.revision,meshyMeshes:(()=>{let count=0;gallery.gltf.scene.traverse(o=>{if(o.isMesh&&o.name.includes("MESHY"))count++});return count})(),duration:gallery.gltf.animations[0].duration')
review_path=ROOT/'scripts/review_gallery_v06_browser.mjs'
if not review_path.exists():
    review_path.write_text(review,encoding='utf-8')
opt=(ROOT/'scripts/optimize_gallery_v05_glb.py').read_text(encoding='utf-8').replace('gallery_v05','gallery_v06')
(ROOT/'scripts/optimize_gallery_v06_glb.py').write_text(opt,encoding='utf-8')
print('V06_WEB_VIEWER_PREPARED')

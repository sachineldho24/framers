"""Blender inspection renders of the five unmodified supplied room assets."""
import bpy, json, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(r'C:\Personal_Projects\Framers'); OUT=ROOT/'gallery_v06'/'analysis'
OUT.mkdir(parents=True,exist_ok=True)
report={}
extracted='--extracted' in sys.argv
for label in ['Kids_Room','Living_Room','Workplace','Couple_Room','Dining_Room']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    path=ROOT/'gallery_v06'/'components'/(label+'-furniture.glb') if extracted else Path(r'C:\Users\Sachin\Downloads')/(label+'.glb')
    bpy.ops.import_scene.gltf(filepath=str(path))
    s=bpy.context.scene; s.view_layers.update()
    meshes=[o for o in s.objects if o.type=='MESH']
    points=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center=(lo+hi)/2; size=hi-lo
    report[label]=dict(min=list(lo),max=list(hi),dimensions=list(size),
        objects=[dict(name=o.name,vertices=len(o.data.vertices),polygons=len(o.data.polygons)) for o in meshes],
        images=[dict(name=i.name,size=list(i.size),packed=bool(i.packed_file)) for i in bpy.data.images])
    d=bpy.data.cameras.new('Inspection'); cam=bpy.data.objects.new('Inspection',d);s.collection.objects.link(cam);s.camera=cam
    d.type='ORTHO';d.ortho_scale=max(size)*1.45
    s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=900;s.render.resolution_y=750;s.render.resolution_percentage=100
    s.render.image_settings.file_format='PNG';s.render.threads_mode='FIXED';s.render.threads=3
    sh=s.display.shading;sh.light='STUDIO';sh.studio_light='paint.sl';sh.color_type='TEXTURE';sh.show_shadows=True
    sh.show_cavity=True;sh.cavity_type='BOTH';sh.background_type='WORLD';sh.background_color=(.10,.10,.10)
    s.world=bpy.data.worlds.new('Inspection World');s.world.color=(.12,.12,.12)
    s.view_settings.view_transform='Standard'
    for view,direction in [('front',(0,-1,.14)),('iso',(1,-1,.85))]:
        cam.location=center+Vector(direction).normalized()*max(size)*3
        cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(OUT/(label+('-extracted' if extracted else '')+'-'+view+'.png'))
        bpy.ops.render.render(write_still=True)
    (OUT/('extracted-blender-inventory.json' if extracted else 'source-blender-inventory.json')).write_text(json.dumps(report,indent=2))
    print('V06_INSPECTED',label,flush=True)
print('V06_SOURCE_PREVIEWS_COMPLETE',flush=True)

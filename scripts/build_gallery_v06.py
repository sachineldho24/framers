"""Integrate original-detail Meshy furnishings into the approved continuous gallery."""
import bpy,json,math,hashlib,warnings
warnings.filterwarnings('ignore',category=DeprecationWarning)
from pathlib import Path
from mathutils import Vector,Matrix

ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v06'
(OUT/'previews').mkdir(exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'gallery_v05/framers_gallery_v05.blend'))
s=bpy.context.scene;s.name='FRAMERS_CONTINUOUS_GALLERY_V06_MESHY'
s.frame_set(1);s.view_layers.update()
meta=json.loads((ROOT/'gallery_v05/gallery-structure.json').read_text())
manifest=json.loads((OUT/'component-manifest.json').read_text())

def signature():
    rows=[]
    for o in s.objects:
        if o.type=='CAMERA' or o.name.startswith(('ART_','FRAME_','ARCH_','TRANSITION_')):
            rows.append((o.name,[round(v,7) for row in o.matrix_world for v in row],
                         len(o.data.vertices) if o.type=='MESH' else None))
    return hashlib.sha256(json.dumps(sorted(rows)).encode()).hexdigest()
before_signature=signature();removed=[];placements=[]

def remove_tree(o):
    names=[c.name for c in o.children_recursive]+[o.name]
    for name in names:
        obj=bpy.data.objects.get(name)
        if obj:removed.append(name);bpy.data.objects.remove(obj,do_unlink=True)

def common_keep(o):
    return o.type=='CAMERA' or o.name.startswith(('ART_','FRAME_','DETAIL_','LIGHT_Artwork_',
        'LIGHT_Key_','LIGHT_Fill_','LUMINAIRE_Track_','TEXTILE_Handwoven_Rug','TEXTILE_Border_Stitch'))

# Remove only furnishings replaced by the supplied models; retain complementary pieces.
for rid in ['01_LIVING','03_TOGETHER','04_CHILDHOOD','05_STUDY','06_ANNIVERSARY']:
    room=bpy.data.objects['ROOM_'+rid]
    for name in [o.name for o in room.children]:
        o=bpy.data.objects.get(name)
        if not o or common_keep(o):continue
        keep=False
        if rid=='03_TOGETHER':
            keep=o.name.startswith(('FURN_Dining_Sideboard','FURN_Sideboard_Door','LUMINAIRE_Table_Lamp'))
            keep|=o.name.startswith(('PROP_Art_Book','PROP_Handthrown_Vase')) and o.location.y>-.8
        elif rid=='04_CHILDHOOD':
            keep=o.name.startswith('FURN_Childhood_Floating_Shelf')
            keep|=o.name.startswith('PROP_') and o.location.y>-.6
            if o.name in ['FURN_Bedside_Cabinet','FURN_Bedside_Drawer','FURN_Bedside_Bronze_Pull',
                          'PROP_Art_Book.004','LUMINAIRE_Table_Lamp.002']:
                keep=True;o.location.x-=.85
        elif rid=='05_STUDY':
            keep=o.name.startswith(('FURN_Library_','LIGHT_Library_'))
            keep|=o.name.startswith('PROP_') and o.location.x>1.3 and o.location.y>-.6
        elif rid=='06_ANNIVERSARY':
            keep=o.name.startswith('TEXTILE_Fullheight_Linen_Drapery')
        if not keep:remove_tree(o)

master=bpy.data.collections.new('MESHY — Full Detail Furnishings');s.collection.children.link(master)

def transform(scale,anchor,target,angle=0):
    return Matrix.Translation(Vector(target))@Matrix.Rotation(angle,4,'Z')@Matrix.Scale(scale,4)@Matrix.Translation(-Vector(anchor))

def locate(o,parent,matrix):
    # Use a useful object origin at the component's bottom centre, preserving its final surface.
    points=[Vector(v) for v in o.bound_box]
    lo=Vector(tuple(min(v[i] for v in points) for i in range(3)))
    hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
    pivot=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z))
    o.data.transform(Matrix.Translation(-pivot));o.parent=parent;o.matrix_parent_inverse=Matrix.Identity(4)
    o.matrix_basis=matrix@Matrix.Translation(pivot)
    o['integration_revision']='v06';o['source_geometry_decimated']=False

mapping={'Living_Room':'01_LIVING','Dining_Room':'03_TOGETHER','Kids_Room':'04_CHILDHOOD',
         'Workplace':'05_STUDY','Couple_Room':'06_ANNIVERSARY'}
for source,rid in mapping.items():
    old=set(bpy.data.objects);old_mats=set(bpy.data.materials);old_images=set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=str(OUT/'components'/(source+'-furniture.glb')))
    imported=[o for o in bpy.data.objects if o not in old];s.view_layers.update()
    col=bpy.data.collections.new(rid+' — '+source);master.children.link(col)
    root=bpy.data.objects.new('MESHY_SET_'+rid,None);col.objects.link(root);root.parent=bpy.data.objects['ROOM_'+rid]
    root['source_file']=manifest[source]['source'];root['source_sha256']=manifest[source]['source_sha256']
    root['original_detail_preserved']=True
    for im in [im for im in bpy.data.images if im not in old_images]:im.name='MESHY_'+source+'_'+im.name
    for m in [m for m in bpy.data.materials if m not in old_mats]:
        m.name='MESHY_PBR_'+source
        p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if p and p.inputs['Base Color'].links:
            n=p.inputs['Base Color'].links[0].from_node
            if n.type=='TEX_IMAGE':m.node_tree.nodes.active=n
    for o in imported:
        if o.type!='MESH':continue
        for c in list(o.users_collection):c.objects.unlink(o)
        col.objects.link(o)
        if source=='Living_Room':
            if 'Chaise_Sofa' in o.name:
                matrix=transform(2.35,(-.442299,-.271764,-.666958),(-1.55,-2.50,.039),0)
            elif 'Coffee_Table' in o.name:
                matrix=transform(2.05,(.105312,-.396909,-.665389),(-.80,-2.70,.039))
            else:
                matrix=transform(2.8,(0,.925,-.676642),(0,-.13,.006))
        elif source=='Dining_Room':matrix=transform(2.05,(0,0,-.257536),(0,-2.25,.039))
        elif source=='Couple_Room':matrix=transform(1.83,(-.05505,.66297,-.299026),(0,-.36,.039))
        elif source=='Workplace':matrix=transform(1.05,(0,-.41442,-.647262),(-.42,-2.30,.039))
        elif 'Ride_On' in o.name:
            matrix=transform(1.65,(.448527,.037881,-.376807),(1.48,-2.45,.039))
        else:matrix=transform(1.65,(-.515,.753371,-.364780),(-.52,-.28,.039))
        locate(o,root,matrix)
        placements.append(dict(object=o.name,room=rid,source=source,triangles=len(o.data.polygons)))
    room_meta=next(r for r in meta['rooms'] if r['id']==rid)
    room_meta['source']=source+'.glb — original-detail Meshy furniture'
    print('V06_INTEGRATED',source,flush=True)

# Practical bulbs follow the imported lamps; gallery lights and camera exposure stay consistent.
def point(name,rid,loc,power):
    d=bpy.data.lights.new(name,'POINT');d.energy=power;d.color=(1,.79,.55);d.shadow_soft_size=.09
    o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.parent=bpy.data.objects['ROOM_'+rid];o.location=loc
point('LIGHT_Meshy_Living_Floor_Lamp','01_LIVING',(-1.99,-.41,1.84),9)
point('LIGHT_Meshy_Study_Desk_Lamp','05_STUDY',(-1.10,-2.25,1.17),5)
point('LIGHT_Meshy_Anniversary_Bedside','06_ANNIVERSARY',(1.25,-.56,.84),4)

# Keep the original textures self-contained in the editable file.
for m in bpy.data.materials:
    if not m.use_nodes:continue
    p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
    if p and p.inputs['Base Color'].links:
        n=p.inputs['Base Color'].links[0].from_node
        if n.type=='TEX_IMAGE':m.node_tree.nodes.active=n
bpy.context.view_layer.update();after_signature=signature()
assert before_signature==after_signature,'Protected architecture, artwork or camera transforms changed'
for rec in placements:
    o=bpy.data.objects[rec['object']];room=bpy.data.objects['ROOM_'+rec['room']]
    points=[room.matrix_world.inverted()@o.matrix_world@Vector(c) for c in o.bound_box]
    rec['room_bounds']={'min':[min(p[i] for p in points) for i in range(3)],'max':[max(p[i] for p in points) for i in range(3)]}
    rec['dimensions_metres']=list(o.dimensions)
    rec['matrix_world']=[list(row) for row in o.matrix_world]
    rec['materials']=[m.name for m in o.data.materials]

meta['revision']='v06';meta['furniture_detail']='Original Meshy geometry and 2048px PBR images'
meta['furniture_sources']={k:v['source'] for k,v in manifest.items()}
meta['physical_lights']=[dict(name=o.name,type=o.data.type,power=o.data.energy,position_blender=list(o.matrix_world.translation)) for o in s.objects if o.type=='LIGHT']
(OUT/'gallery-structure.json').write_text(json.dumps(meta,indent=2))
report=dict(base_file=str(ROOT/'gallery_v05/framers_gallery_v05.blend'),
    protected_scene_signature=after_signature,protected_scene_unchanged=before_signature==after_signature,
    removed_objects=removed,placements=placements,retained_source_triangles=sum(p['triangles'] for p in placements))
(OUT/'integration-manifest.json').write_text(json.dumps(report,indent=2))
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.use_denoising=True;s.cycles.denoising_use_gpu=False
s.cycles.samples=64;s.cycles.adaptive_threshold=.035;s.render.threads_mode='FIXED';s.render.threads=3
s.camera=bpy.data.objects['CAM_TOUR'];s.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=s.camera
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.overlay.show_overlays=False
            area.spaces.active.shading.type='SOLID';area.spaces.active.shading.color_type='TEXTURE'
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.file.pack_all();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'framers_gallery_v06_meshy.blend'),compress=True)
print('V06_BUILD_COMPLETE',report['retained_source_triangles'],'Meshy triangles',flush=True)

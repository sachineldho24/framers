"""Extract full-detail furniture GLBs, preserving original UVs, normals and images."""
import copy,json,struct,hashlib
from pathlib import Path
import numpy as np
from segment_gallery_v06_sources import read_glb

ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v06';CACHE=OUT/'components'
CACHE.mkdir(parents=True,exist_ok=True)
manifest={}
for name in ['Kids_Room','Living_Room','Workplace','Couple_Room','Dining_Room']:
    path=Path(r'C:\Users\Sachin\Downloads')/(name+'.glb')
    original,blob,pos,tri,uv=read_glb(path)
    comp=np.load(OUT/'analysis'/(name+'-components.npz'))['face_component']
    xyz=pos[:,[0,2,1]].copy();xyz[:,1]*=-1
    centers=xyz[tri].mean(axis=1);x,y,z=centers.T
    if name=='Kids_Room':
        # Remove both side returns and the rear panel beyond the width of the bed.
        bed=(comp==0)&(x<-.075)&((y<.642)|((x>-.880)&(x<-.165)))
        bed&=~((x<-.880)&(y>.20))
        bed&=~((x<-.855)&(y>.10)&(z>.09))
        groups={'Child_Bed_Quilt_Pillows_Headboard':bed,'Ride_On_Toys_Round_Rug':comp==1}
    elif name=='Living_Room':
        # The wall is a slab at Y > .93; lamps and foliage protrude in front of it.
        free=(comp==1)&(y<.925)
        groups={'Chaise_Sofa_Cushions':np.isin(comp,[0,2]),'Coffee_Table_Plant_Books':comp==5,
                'Walnut_Console':comp==4,'Floor_Lamp':(comp==3)|(free&(x<-.5)),
                'Planters_Foliage':np.isin(comp,[6,7,8])|(free&(x>.45))}
    elif name=='Workplace':
        groups={'Executive_Desk_Lamp_Accessories':comp==0,'Swivel_Office_Chair':comp==1}
    elif name=='Couple_Room':
        groups={'Double_Bed_Linen_Pillows':comp==2,'Left_Nightstand_Books':np.isin(comp,[0,1]),
                'Right_Nightstand_Lamp':np.isin(comp,[3,4]),'Potted_Plant':np.isin(comp,[5,6])}
    else:
        groups={'Dining_Table_Centrepiece':comp==1}
        groups.update({'Dining_Chair_'+str(i+1):comp==v for i,v in enumerate([0,2,3,4,5,6])})
    d={k:copy.deepcopy(original[k]) for k in ['asset','materials','textures','samplers'] if k in original}
    d.update(buffers=[{'byteLength':0}],bufferViews=[],accessors=[],images=[],meshes=[],nodes=[],scenes=[{'nodes':[]}],scene=0)
    d['asset']['generator']='Framers selective Meshy furniture extraction; original resolution'
    binary=bytearray()
    def buffer(data,target=None):
        binary.extend(b'\x00'*((-len(binary))%4));offset=len(binary);binary.extend(data)
        v={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
        if target:v['target']=target
        d['bufferViews'].append(v);return len(d['bufferViews'])-1
    for im in original['images']:
        im=copy.deepcopy(im);v=original['bufferViews'][im['bufferView']];a=v.get('byteOffset',0)
        im['bufferView']=buffer(blob[a:a+v['byteLength']]);d['images'].append(im)
    if 'extensionsUsed' in original:d['extensionsUsed']=copy.deepcopy(original['extensionsUsed'])
    attrs=original['meshes'][0]['primitives'][0]['attributes'];arrays={}
    for key,idx in attrs.items():
        a=original['accessors'][idx];v=original['bufferViews'][a['bufferView']]
        dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
        cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        assert 'byteStride' not in v,'Interleaved input requires stride handling'
        arrays[key]=np.frombuffer(blob,dtype=dt,count=a['count']*cols,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,cols)
    records=[];kept=np.zeros(len(tri),bool)
    for part,mask in groups.items():
        assert not np.any(kept&mask),'Overlapping part selection';kept|=mask
        triangles=tri[mask];ids,indices=np.unique(triangles.reshape(-1),return_inverse=True)
        attributes={}
        for key,array in arrays.items():
            data=np.ascontiguousarray(array[ids]);a=copy.deepcopy(original['accessors'][attrs[key]])
            a.pop('byteOffset',None);a.pop('min',None);a.pop('max',None)
            a.update(bufferView=buffer(data.tobytes(),34962),count=len(data))
            if key=='POSITION':a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
            attributes[key]=len(d['accessors']);d['accessors'].append(a)
        a={'bufferView':buffer(indices.astype('<u4').tobytes(),34963),'componentType':5125,'type':'SCALAR','count':len(indices)}
        idx=len(d['accessors']);d['accessors'].append(a)
        pname='MESHY_'+name+'_'+part
        d['meshes'].append({'name':pname,'primitives':[{'attributes':attributes,'indices':idx,'material':0,'mode':4}]})
        d['nodes'].append({'mesh':len(d['meshes'])-1,'name':pname,'extras':{'source_file':str(path),'source_component':part,'original_detail_preserved':True}})
        d['scenes'][0]['nodes'].append(len(d['nodes'])-1)
        points=xyz[ids]
        records.append(dict(name=pname,triangles=len(triangles),vertices=len(ids),min=points.min(axis=0).tolist(),max=points.max(axis=0).tolist()))
    binary.extend(b'\x00'*((-len(binary))%4));d['buffers'][0]['byteLength']=len(binary)
    payload=json.dumps(d,separators=(',',':')).encode();payload+=b' '*((-len(payload))%4)
    target=CACHE/(name+'-furniture.glb')
    with target.open('wb') as f:
        f.write(struct.pack('<III',0x46546c67,2,12+8+len(payload)+8+len(binary)))
        f.write(struct.pack('<II',len(payload),0x4e4f534a));f.write(payload)
        f.write(struct.pack('<II',len(binary),0x004e4942));f.write(binary)
    manifest[name]=dict(source=str(path),source_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
        original_triangles=len(tri),retained_triangles=int(kept.sum()),removed_triangles=int((~kept).sum()),
        geometry_decimation=False,output=str(target),parts=records)
    (OUT/'component-manifest.json').write_text(json.dumps(manifest,indent=2))
    print('EXTRACTED',name,len(records),'parts',int(kept.sum()),'triangles',flush=True)

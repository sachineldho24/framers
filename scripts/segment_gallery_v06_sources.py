"""Find geometric islands across UV seams, retaining the original triangles and UVs."""
import json, struct, time
from pathlib import Path
import numpy as np

ROOT=Path(r'C:\Personal_Projects\Framers');OUT=ROOT/'gallery_v06'/'analysis'
def read_glb(path):
    with path.open('rb') as f:
        f.read(12);n,_=struct.unpack('<II',f.read(8));doc=json.loads(f.read(n))
        n,_=struct.unpack('<II',f.read(8));blob=f.read(n)
    def accessor(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        dt={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]
        cols={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
        return np.frombuffer(blob,dtype=dt,count=a['count']*cols,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,cols)
    p=doc['meshes'][0]['primitives'][0]
    return doc,blob,accessor(p['attributes']['POSITION']).copy(),accessor(p['indices']).reshape(-1,3).copy(),accessor(p['attributes']['TEXCOORD_0']).copy()

if __name__=='__main__':
    reports={}
    for name in ['Kids_Room','Living_Room','Workplace','Couple_Room','Dining_Room']:
        start=time.time();doc,blob,pos,tri,uv=read_glb(Path(r'C:\Users\Sachin\Downloads')/(name+'.glb'))
        unique,inverse=np.unique(pos,axis=0,return_inverse=True)
        faces=inverse[tri];parent=list(range(len(unique)))
        def find(a):
            while parent[a]!=a:
                parent[a]=parent[parent[a]];a=parent[a]
            return a
        for a,b,c in faces.tolist():
            a=find(a);b=find(b);c=find(c)
            root=min(a,b,c);parent[a]=root;parent[b]=root;parent[c]=root
        labels=np.array([find(i) for i in range(len(unique))],dtype=np.int32)
        roots,compact=np.unique(labels,return_inverse=True)
        fl=compact[faces[:,0]];counts=np.bincount(fl,minlength=len(roots))
        xyz=unique[:,[0,2,1]].copy();xyz[:,1]*=-1
        lo=np.full((len(roots),3),np.inf);hi=-lo.copy()
        np.minimum.at(lo,compact,xyz);np.maximum.at(hi,compact,xyz)
        order=np.argsort(-counts)
        items=[dict(id=int(i),triangles=int(counts[i]),min=lo[i].tolist(),max=hi[i].tolist(),dimensions=(hi[i]-lo[i]).tolist()) for i in order if counts[i]>=10]
        reports[name]=dict(total_triangles=len(tri),geometric_islands=len(roots),components=items)
        np.savez_compressed(OUT/(name+'-components.npz'),face_component=fl)
        (OUT/'source-components.json').write_text(json.dumps(reports,indent=2))
        print(name,'islands',len(roots),'top',items[:8],'seconds',round(time.time()-start,1),flush=True)

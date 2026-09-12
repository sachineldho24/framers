import bpy


SOURCE_PATHS = [
    r"C:\Users\Sachin\Downloads\dining.glb",
    r"C:\Users\Sachin\Downloads\kids.glb",
    r"C:\Users\Sachin\Downloads\living.glb",
    r"C:\Users\Sachin\Downloads\bedroom.glb",
    r"C:\Users\Sachin\Downloads\chair.glb",
]


audits = {}
for source_path in SOURCE_PATHS:
    before_objects = set(bpy.data.objects)
    before_meshes = set(bpy.data.meshes)
    before_materials = set(bpy.data.materials)
    before_images = set(bpy.data.images)
    bpy.ops.import_scene.gltf(filepath=source_path)
    imported = [obj for obj in bpy.data.objects if obj not in before_objects]
    meshes = [obj.data for obj in imported if obj.type == "MESH"]
    new_images = [image for image in bpy.data.images if image not in before_images]
    audits[source_path] = {
        "vertices": sum(len(mesh.vertices) for mesh in meshes),
        "polygons": sum(len(mesh.polygons) for mesh in meshes),
        "triangles": sum(sum(max(1, len(poly.vertices) - 2) for poly in mesh.polygons) for mesh in meshes),
        "images": [
            {
                "name": image.name,
                "size": list(image.size),
                "packed": image.packed_file is not None,
            }
            for image in new_images
        ],
    }

    for obj in imported:
        bpy.data.objects.remove(obj, do_unlink=True)
    for mesh in [mesh for mesh in bpy.data.meshes if mesh not in before_meshes]:
        bpy.data.meshes.remove(mesh)
    for material in [material for material in bpy.data.materials if material not in before_materials]:
        bpy.data.materials.remove(material)
    for image in [image for image in bpy.data.images if image not in before_images]:
        bpy.data.images.remove(image)

result = audits

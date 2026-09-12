import bpy


scenes_before = {scene.name: len(scene.objects) for scene in bpy.data.scenes}
gallery_scene = max(bpy.data.scenes, key=lambda scene: len(scene.objects))
bpy.context.window.scene = gallery_scene

removed_scenes = []
for scene in list(bpy.data.scenes):
    if scene != gallery_scene and scene.name.startswith("TEMP_SUPPLIED_GLB_PREVIEW"):
        removed_scenes.append(scene.name)
        bpy.data.scenes.remove(scene)

for world in list(bpy.data.worlds):
    if world.name.startswith("TEMP_SUPPLIED_GLB_PREVIEW_WORLD") and world.users == 0:
        bpy.data.worlds.remove(world)

result = {
    "scenes_before": scenes_before,
    "active_scene": bpy.context.scene.name,
    "active_scene_object_count": len(bpy.context.scene.objects),
    "removed_scenes": removed_scenes,
}

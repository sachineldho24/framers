"""Copy original camera keyframes through a geometry-only GLB round trip."""
import copy
import json
import struct
import sys
from pathlib import Path


def read_glb(path):
    raw = Path(path).read_bytes()
    assert struct.unpack_from('<4sII', raw) == (b'glTF', 2, len(raw))
    json_size, json_type = struct.unpack_from('<II', raw, 12)
    assert json_type == 0x4E4F534A
    doc = json.loads(raw[20:20 + json_size])
    offset = 20 + json_size
    bin_size, bin_type = struct.unpack_from('<II', raw, offset)
    assert bin_type == 0x004E4942
    return doc, raw[offset + 8:offset + 8 + bin_size]


def preserve_animation(original, destination):
    source, source_bin = read_glb(original)
    target, target_bin = read_glb(destination)
    data = bytearray(target_bin)
    nodes = {node.get('name'): i for i, node in enumerate(target['nodes'])}
    accessor_map, view_map = {}, {}

    def copy_accessor(index):
        if index in accessor_map:
            return accessor_map[index]
        accessor = copy.deepcopy(source['accessors'][index])
        assert 'sparse' not in accessor
        view_index = accessor['bufferView']
        if view_index not in view_map:
            view = copy.deepcopy(source['bufferViews'][view_index])
            assert view['buffer'] == 0
            offset = view.get('byteOffset', 0)
            data.extend(b'\0' * (-len(data) % 4))
            view['byteOffset'] = len(data)
            data.extend(source_bin[offset:offset + view['byteLength']])
            view_map[view_index] = len(target['bufferViews'])
            target['bufferViews'].append(view)
        accessor['bufferView'] = view_map[view_index]
        accessor_map[index] = len(target['accessors'])
        target['accessors'].append(accessor)
        return accessor_map[index]

    animations = copy.deepcopy(source.get('animations', []))
    for animation in animations:
        for sampler in animation['samplers']:
            sampler['input'] = copy_accessor(sampler['input'])
            sampler['output'] = copy_accessor(sampler['output'])
        for channel in animation['channels']:
            source_node = source['nodes'][channel['target']['node']]
            channel['target']['node'] = nodes[source_node['name']]
    target['animations'] = animations
    target['buffers'][0]['byteLength'] = len(data)
    data.extend(b'\0' * (-len(data) % 4))
    encoded = json.dumps(target, separators=(',', ':'), ensure_ascii=False).encode()
    encoded += b' ' * (-len(encoded) % 4)
    result = struct.pack('<4sII', b'glTF', 2, 28 + len(encoded) + len(data))
    result += struct.pack('<II', len(encoded), 0x4E4F534A) + encoded
    result += struct.pack('<II', len(data), 0x004E4942) + data
    staging = Path(destination).with_suffix('.animation.tmp')
    staging.write_bytes(result)
    staging.replace(destination)
    print('Original animation preserved:', len(animations), 'clip(s),', len(accessor_map), 'accessors')


if __name__ == '__main__':
    preserve_animation(*sys.argv[1:])

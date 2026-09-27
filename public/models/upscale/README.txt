realesr-general-x4v3.onnx

Real-ESRGAN "general x4 v3" (SRVGGNetCompact, 4x super-resolution), used by the
studio's Enhance tool (src/lib/studio/imageAi).

Source weights: realesr-general-x4v3.pth from the official Real-ESRGAN release
https://github.com/xinntao/Real-ESRGAN/releases/tag/v0.2.5.0
(sha256 8dc7edb9ac80ccdc30c3a5dca6616509367f05fbc184ad95b731f05bece96292)

Exported to ONNX (opset 17, dynamic height/width, input "input" / output
"output", RGB 0-1 NCHW) with the upstream architecture and strict weight
loading; output matches PyTorch to within 4e-6.

License: BSD 3-Clause, see LICENSE.txt.

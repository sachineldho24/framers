# PosterX artwork library

The original 185 images were visually reviewed and named by subject and design type. After removing 60 visually duplicate or near-identical exports, this folder contains 125 images. The retained files preserve their original bytes, dimensions, and quality.

Filenames use `category-subject-variant.ext`, for example `cars-bmw-m3-yellow-1.png` and `birthday-jobin-xavier-photo-collage-2.png`. Variant numbers retain their original identifiers, so gaps after duplicate removal are expected.

`image-catalog.csv` lists the retained images, including category, visual description, original filename, dimensions, file size, and SHA-256 checksum.

Repeated compositions that differ only in minor crop, grading, grain, glow, or export size were consolidated. Distinct photographs, layouts, mockups, and meaningful text variants remain. Higher-resolution or clearer completed versions were preferred. Removed files were sent to the Windows Recycle Bin; the removal-to-retained-file mapping is saved in `tmp/posterx-dedup/removed-images.csv` at the repository root.

## Categories

- anniversary: 1
- bikes: 26
- birthday: 5
- buses: 6
- cars: 81
- mockups: 2
- portraits: 2
- vans: 2

Vehicle models are used where the artwork identifies them clearly. Broader subject names are used when the image and printed model label are ambiguous. Birthday labels are used only where the artwork indicates a birthday; other personal collages are classified as portraits.

## Website galleries

All retained works appear at `/works`, with category pages at `/works/cars`, `/works/bikes`, `/works/buses`, `/works/birthday`, `/works/anniversary`, `/works/portraits`, `/works/vans`, and `/works/mockups`.

Run `npm run assets:works` after changing `image-catalog.csv`. It creates web-sized WebP previews and full-view images under `public/work-images` and regenerates `src/lib/works-data.ts`. The print originals in this folder remain unchanged. Homepage hero and category selections are maintained in `src/lib/works.ts`.

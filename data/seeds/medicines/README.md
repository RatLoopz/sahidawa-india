# Reference medicine packaging images

This folder contains reference images of genuine medicine packaging used by the visual verification pipeline.

## Naming convention

Use filenames in the format:

- `{medicine-name}-{batch-variant}.jpg`
- Example: `amoxicillin-02.jpg`

## Guidance

- Store at least 3 reference images per medicine for reliable ORB-based matching.
- Prefer high-resolution, well-lit packaging photos with the label clearly visible.
- Keep filenames consistent so the ML service can pick the best matching reference image.

## Placeholder images

The following placeholder `.jpg` files are included temporarily. Replace them with actual reference images before using the comparison pipeline in production.

- `placeholder-cipla-01.jpg`
- `placeholder-cipla-02.jpg`
- `placeholder-cipla-03.jpg`

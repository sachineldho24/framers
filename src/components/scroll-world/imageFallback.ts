export type RecoverableImage = {
  src: string;
  complete: boolean;
  naturalWidth: number;
};

export function selectInitialImageSource(
  generatedSource: string,
  _fallbackSource: string,
): string {
  return generatedSource;
}

export function recoverBrokenImage(
  image: RecoverableImage,
  fallbackSource: string,
): boolean {
  if (
    !image.complete ||
    image.naturalWidth > 0 ||
    image.src.endsWith(fallbackSource)
  ) {
    return false;
  }

  image.src = fallbackSource;
  return true;
}

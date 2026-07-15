export const DEFAULT_VISIBLE_TAG_COUNT = 2;

interface ResolveVisibleTagCountOptions {
  containerWidth: number;
  tagWidths: number[];
  summaryWidths: ReadonlyMap<number, number>;
  gap: number;
  fallbackCount?: number;
}

export function resolveVisibleTagCount({
  containerWidth,
  tagWidths,
  summaryWidths,
  gap,
  fallbackCount = DEFAULT_VISIBLE_TAG_COUNT,
}: ResolveVisibleTagCountOptions): number {
  const totalCount = tagWidths.length;

  if (totalCount === 0) {
    return 0;
  }

  if (containerWidth <= 0 || tagWidths.some((width) => width <= 0)) {
    return Math.min(totalCount, fallbackCount);
  }

  let usedWidth = 0;
  let bestCount = 1;

  for (let index = 0; index < totalCount; index += 1) {
    if (index > 0) {
      usedWidth += gap;
    }

    usedWidth += tagWidths[index];

    const visibleCount = index + 1;
    const hiddenCount = totalCount - visibleCount;
    const summaryWidth = hiddenCount > 0 ? summaryWidths.get(hiddenCount) ?? 0 : 0;
    const totalWidth = hiddenCount > 0 ? usedWidth + gap + summaryWidth : usedWidth;

    if (visibleCount === 1 || totalWidth <= containerWidth + 0.5) {
      bestCount = visibleCount;
    }

    if (visibleCount > 1 && totalWidth > containerWidth + 0.5) {
      break;
    }
  }

  return bestCount;
}

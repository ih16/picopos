export function virtualWindow(heights: number[], scrollTop: number, viewportHeight: number, overscan = 5) {
  const offsets = [0];
  for (const height of heights) offsets.push(offsets[offsets.length - 1] + height);
  let first = 0;
  while (first < heights.length && offsets[first + 1] <= scrollTop) first++;
  let last = first;
  while (last < heights.length && offsets[last] < scrollTop + viewportHeight) last++;
  const start = Math.max(0, first - overscan);
  const end = Math.min(heights.length, last + overscan);
  return { start, end, before: offsets[start], after: offsets[heights.length] - offsets[end] };
}

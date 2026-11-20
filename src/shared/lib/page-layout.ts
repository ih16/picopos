export const PAGE_SIZE = 12;
export const BAND_HEIGHT = 256;

// Index the physical scroll range once per measurement, independently of scroll events.
export function pageLayout(length: number, estimate: number, measured: Readonly<Record<number, number>>) {
  const starts = [0];
  const bands: { first: number; last: number }[] = [];
  for (let i = 0; i * PAGE_SIZE < length; i++) {
    const start = starts[i];
    const end = start + (measured[i] ?? Math.min(PAGE_SIZE, length - i * PAGE_SIZE) * estimate);
    starts.push(end);
    for (let band = Math.floor(start / BAND_HEIGHT); band < Math.ceil(end / BAND_HEIGHT); band++) {
      if (bands[band]) bands[band].last = i;
      else bands[band] = { first: i, last: i };
    }
  }
  return { starts, bands };
}

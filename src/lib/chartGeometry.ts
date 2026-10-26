export function chartPoints(data: { label: string; value: number }[], width: number, height: number, progress = 1) {
  const padX = 12;
  const padY = 18;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const plotHeight = height - padY * 2;
  const baseline = padY + (max / (max - min)) * plotHeight;
  return data.map((d, i) => {
    const target = padY + ((max - d.value) / (max - min)) * plotHeight;
    return { ...d, x: data.length === 1 ? width / 2 : padX + i / (data.length - 1) * (width - padX * 2), y: baseline + (target - baseline) * progress };
  });
}

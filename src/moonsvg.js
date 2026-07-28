export function moonPhaseName(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (a < 22.5) return "New Moon";
  if (a < 67.5) return "Waxing Crescent";
  if (a < 112.5) return "First Quarter";
  if (a < 157.5) return "Waxing Gibbous";
  if (a < 202.5) return "Full Moon";
  if (a < 247.5) return "Waning Gibbous";
  if (a < 292.5) return "Last Quarter";
  if (a < 337.5) return "Waning Crescent";
  return "New Moon";
}

export function moonSVGDataURL(phase, size = 20, opacity = 1, fill = "#ffffff") {
  if (phase == null) return null;
  const R = size / 2 - 1.5;
  const theta = phase * 2 * Math.PI;
  const cosT = Math.cos(theta);
  const rx = Math.max(Math.abs(cosT) * R, 0.5);

  const lit = `fill="${fill}" fill-opacity="${opacity}"`;
  const stroke = `stroke="${fill}" stroke-width="1.5"`;
  const grad = `fill="url(#g)" opacity="${opacity}"`;

  let body, glow;
  if (phase < 0.002 || phase > 0.998) {
    body = `<circle cx="0" cy="0" r="${R}" fill="none" ${stroke} opacity="${opacity * 0.4}"/>`;
    glow = "";
  } else if (Math.abs(phase - 0.5) < 0.002) {
    body = `<circle cx="0" cy="0" r="${R}" ${lit} />`;
    glow = `<circle cx="0" cy="0" r="${R}" ${grad} />`;
  } else if (phase < 0.5) {
    const termSweep = phase < 0.25 ? 0 : 1;
    const d = `M 0,${-R} A ${R},${R} 0 0,1 0,${R} A ${rx},${R} 0 0,${termSweep} 0,${-R} Z`;
    body = `<path d="${d}" ${lit} />`;
    glow = `<path d="${d}" ${grad} />`;
  } else {
    const termSweep = phase < 0.75 ? 0 : 1;
    const d = `M 0,${-R} A ${R},${R} 0 0,0 0,${R} A ${rx},${R} 0 0,${termSweep} 0,${-R} Z`;
    body = `<path d="${d}" ${lit} />`;
    glow = `<path d="${d}" ${grad} />`;
  }

  const defs = `<defs><radialGradient id="g" cx="35%" cy="35%" r="60%"><stop offset="0%" stop-color="#ffe0a0" stop-opacity="0.3"/><stop offset="100%" stop-color="#ffe0a0" stop-opacity="0"/></radialGradient></defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${size / 2} -${size / 2} ${size} ${size}" width="${size}" height="${size}">${defs}${body}${glow}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Formation colours shared by the Subsurface 3D view and the correlation chart. */
export const FORMATION_COLORS = {
  Alluvium: [214, 196, 150],
  Dhekiajuli: [201, 162, 39],
  Tipam: [232, 135, 30],
  Girujan: [150, 111, 51],
  Namsang: [59, 111, 216],
  Barail: [30, 142, 90],
  Kopili: [124, 58, 237],
  Langpar: [100, 116, 139],
};

const FALLBACK = [148, 163, 184];

export const formationRgb = (name) => FORMATION_COLORS[name] || FALLBACK;
export const formationCss = (name, alpha = 1) => `rgba(${formationRgb(name).join(',')},${alpha})`;

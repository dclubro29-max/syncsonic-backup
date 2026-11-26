/**
 * Benzile de frecvență care pot fi trimise separat către fiecare boxă.
 *
 * Două filtre în serie per ieșire: `a` taie jos, `b` taie sus.
 * `gain` compensează scăderea de nivel după filtrare, ca boxa să rămână puternică.
 */
export const BANDS = [
  {
    id: "full",
    label: "Complet",
    hint: "Toată banda — boxa se comportă normal.",
    a: { type: "allpass", freq: 20000 },
    b: { type: "allpass", freq: 20000 },
    gain: 1,
  },
  {
    id: "bass",
    label: "Bass (joase)",
    hint: "Doar joasele, sub ~180 Hz. Pentru boxa care preia bass-ul.",
    a: { type: "lowpass", freq: 180, q: 0.7 },
    b: { type: "allpass", freq: 20000 },
    gain: 1.8,
  },
  {
    id: "mids",
    label: "Medii",
    hint: "Zona medie, ~300 Hz – 3 kHz. Corpul instrumentelor.",
    a: { type: "highpass", freq: 300, q: 0.7 },
    b: { type: "lowpass", freq: 3000, q: 0.7 },
    gain: 1.5,
  },
  {
    id: "vocals",
    label: "Vocale",
    hint: "Zona vocii, ~900 Hz – 4,5 kHz. Nu izolează vocea, o scoate în față.",
    a: { type: "highpass", freq: 900, q: 0.7 },
    b: { type: "lowpass", freq: 4500, q: 0.7 },
    gain: 1.7,
  },
  {
    id: "highs",
    label: "Înalte",
    hint: "Doar înaltele, peste ~3,5 kHz. Percuție și aer.",
    a: { type: "highpass", freq: 3500, q: 0.7 },
    b: { type: "allpass", freq: 20000 },
    gain: 1.4,
  },
];

export const DEFAULT_BAND = "full";

export function getBand(id) {
  return BANDS.find((b) => b.id === id) || BANDS[0];
}
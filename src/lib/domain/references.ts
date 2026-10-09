/**
 * Referencias publicadas de tiempo de trabajo concentrado. A diferencia de los rangos simbólicos,
 * estas cifras sí proceden de estudios o fuentes citables; se muestran como contexto, no como ranking.
 */
export type Reference = { minutes: number; who: string; source: string };

export const REFERENCES: Reference[] = [
  {
    minutes: 168,
    who: "Un trabajador del conocimiento medio",
    source: "RescueTime: unas 2 h 48 min de tiempo productivo al día",
  },
  {
    minutes: 210,
    who: "Los mejores estudiantes de violín de una academia de élite",
    source: "Ericsson, Krampe y Tesch-Römer (1993): unas 3,5 h diarias de práctica deliberada",
  },
  {
    minutes: 240,
    who: "El máximo de práctica deliberada sostenible observado en expertos",
    source: "Ericsson (1993) y Cal Newport (Deep Work): unas 4 h al día de trabajo profundo",
  },
];

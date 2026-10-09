export type IdeaArea =
  | "lenguas"
  | "tecnologia"
  | "datos"
  | "diseno"
  | "negocios"
  | "finanzas"
  | "marketing"
  | "oficios"
  | "salud"
  | "mente"
  | "filosofia"
  | "lectura"
  | "espiritual"
  | "cultura"
  | "musica"
  | "social"
  | "familia"
  | "cocina"
  | "ciencia"
  | "naturaleza"
  | "servicio"
  | "habitos";

export type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export type Idea = {
  /** Identificador estable (se guarda en el horario). */
  key: string;
  title: string;
  area: IdeaArea;
  /** 1 = muy fácil … 5 = muy difícil. */
  difficulty: number;
  /** Horas totales orientativas para alcanzar el objetivo descrito. */
  hours: number;
  /** Utilidad a futuro (1-5): cuánto te seguirá sirviendo en 5-10 años. */
  future: number;
  /** Potencial para ganar dinero (1-5). */
  money: number;
  /** Primeros pasos concretos: cómo empezar y con qué. */
  how: string;
  /** Otras ideas que esta complementa o desbloquea. */
  complements: string[];
  /** Solo idiomas: nivel del Marco Común Europeo (MCER). */
  level?: Cefr;
};

/** Forma compacta para escribir el catálogo: [clave, título, dificultad, horas, futuro, dinero, cómo, complementa?]. */
export type IdeaRow = [string, string, number, number, number, number, string, string[]?];

/**
 * "Just Start": propone pasos mínimos para empezar una tarea abrumadora.
 * Reglas simples por palabras clave; preparado para sustituirse por un proveedor de IA (Fase 5).
 */
export type Breakdown = { firstStep: string; steps: string[] };

const RULES: { match: RegExp; steps: string[] }[] = [
  {
    match: /gimnasio|entren|correr|deporte|hacer ejercicio|ejercicio f[ií]sico|yoga/i,
    steps: [
      "Ponerte la ropa de deporte",
      "Calentar 2 minutos",
      "Hacer la primera serie o el primer kilómetro",
      "Completar la rutina planificada",
    ],
  },
  {
    match: /estudi|examen|repas|tema|apuntes|leer|lectura|libro|cap[ií]tulo/i,
    steps: [
      "Abrir el material y dejarlo a la vista",
      "Leer solo los títulos y el resumen (2 min)",
      "Elegir un único apartado para hoy",
      "Hacer una primera pasada de 10 minutos",
      "Anotar 3 ideas clave o dudas",
    ],
  },
  {
    match: /ejercicios|problemas?|práctica|practica|deberes|tarea de/i,
    steps: [
      "Copiar el enunciado del primer ejercicio",
      "Escribir qué datos tienes y qué te piden",
      "Intentar solo el primer paso, aunque no salga",
      "Resolver un ejercicio completo",
      "Marcar el progreso en el contador",
    ],
  },
  {
    match: /escrib|redact|informe|ensayo|art[ií]culo|trabajo|documento|presentaci/i,
    steps: [
      "Crear el documento y ponerle título",
      "Escribir 3 viñetas con lo que quieres decir",
      "Redactar un párrafo malo a propósito (borrador)",
      "Convertir las viñetas en secciones",
      "Revisar solo la primera sección",
    ],
  },
  {
    match: /c[oó]digo|program|app|bug|feature|deploy|proyecto/i,
    steps: [
      "Abrir el proyecto y ejecutar lo que ya existe",
      "Escribir en una frase qué debe funcionar al terminar",
      "Localizar el archivo donde empieza el cambio",
      "Hacer el cambio más pequeño posible y probarlo",
      "Anotar el siguiente paso antes de parar",
    ],
  },
  {
    match: /limpi|orden|organiz|casa|habitaci/i,
    steps: [
      "Poner un temporizador de 5 minutos",
      "Recoger solo una superficie",
      "Tirar o guardar 5 cosas",
      "Seguir zona por zona",
    ],
  },
];

const GENERIC = [
  "Abrir lo necesario para empezar (archivo, libro, herramienta)",
  "Escribir en una frase qué significa 'terminado'",
  "Hacer la acción más pequeña posible durante 2 minutos",
  "Decidir el siguiente paso concreto",
  "Trabajar un bloque de 15–25 minutos",
];

export function suggestBreakdown(title: string): Breakdown {
  const rule = RULES.find((r) => r.match.test(title));
  const steps = rule?.steps ?? GENERIC;
  return { firstStep: steps[0], steps };
}

export const JUST_START_MINUTES = [2, 5] as const;

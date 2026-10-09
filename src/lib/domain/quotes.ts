import { diffDays, type ISODate } from "./dates";

/**
 * Filosofía de disciplina: frases chinas y rusas.
 *
 * Regla: solo textos auténticos. `source` indica la obra concreta cuando la atribución es
 * verificable; si no lo es, se presenta como proverbio popular (sin inventar autores).
 */

export type QuoteTheme = "inicio" | "constancia" | "estudio" | "esfuerzo" | "descanso" | "suficiencia";

export type Quote = {
  id: string;
  origin: "china" | "rusia";
  text: string;
  /** Lectura (pinyin o transliteración) para quien no lee el original. */
  reading?: string;
  translation: string;
  /** Autor u obra verificable, o "Proverbio popular …". */
  source: string;
  reflection: string;
  themes: QuoteTheme[];
};

export const QUOTES: readonly Quote[] = [
  // ----------------------------------------------------------------- China
  {
    id: "cn-mil-millas",
    origin: "china",
    text: "千里之行，始于足下。",
    reading: "Qiān lǐ zhī xíng, shǐ yú zú xià.",
    translation: "Un viaje de mil millas comienza bajo tus pies.",
    source: "Laozi, Tao Te Ching, capítulo 64",
    reflection: "La meta grande no se ataca de golpe: se empieza por el primer paso de hoy.",
    themes: ["inicio"],
  },
  {
    id: "cn-pasos-cortos",
    origin: "china",
    text: "不积跬步，无以至千里；不积小流，无以成江海。",
    reading: "Bù jī kuǐ bù, wú yǐ zhì qiān lǐ; bù jī xiǎo liú, wú yǐ chéng jiāng hǎi.",
    translation: "Sin acumular medios pasos no se llega a mil li; sin reunir arroyos no se forman ríos ni mares.",
    source: "Xunzi, «Exhortación al estudio» (劝学)",
    reflection: "Cada sesión corta cuenta. El nivel extraordinario es la suma de días normales bien usados.",
    themes: ["constancia", "inicio"],
  },
  {
    id: "cn-tallar-sin-parar",
    origin: "china",
    text: "锲而舍之，朽木不折；锲而不舍，金石可镂。",
    reading: "Qiè ér shě zhī, xiǔ mù bù zhé; qiè ér bù shě, jīn shí kě lòu.",
    translation: "Si tallas y abandonas, ni la madera podrida se rompe; si tallas sin abandonar, hasta el metal y la piedra se graban.",
    source: "Xunzi, «Exhortación al estudio» (劝学)",
    reflection: "La perseverancia vence a la dificultad; el talento sin continuidad no deja huella.",
    themes: ["constancia", "esfuerzo"],
  },
  {
    id: "cn-aprender-pensar",
    origin: "china",
    text: "学而不思则罔，思而不学则殆。",
    reading: "Xué ér bù sī zé wǎng, sī ér bù xué zé dài.",
    translation: "Aprender sin pensar es inútil; pensar sin aprender es peligroso.",
    source: "Confucio, Analectas 2.15",
    reflection: "Las horas valen cuando entiendes lo que estudias, no solo cuando pasas páginas.",
    themes: ["estudio"],
  },
  {
    id: "cn-repasar",
    origin: "china",
    text: "温故而知新，可以为师矣。",
    reading: "Wēn gù ér zhī xīn, kěyǐ wéi shī yǐ.",
    translation: "Quien repasa lo antiguo y descubre lo nuevo puede ser maestro.",
    source: "Confucio, Analectas 2.11",
    reflection: "El repaso no es tiempo perdido: es donde lo aprendido se vuelve tuyo.",
    themes: ["estudio"],
  },
  {
    id: "cn-saber-no-saber",
    origin: "china",
    text: "知之为知之，不知为不知，是知也。",
    reading: "Zhī zhī wéi zhī zhī, bù zhī wéi bù zhī, shì zhī yě.",
    translation: "Saber que se sabe lo que se sabe y que no se sabe lo que no se sabe: eso es conocimiento.",
    source: "Confucio, Analectas 2.17",
    reflection: "Medir con honestidad (también tus horas) es la base de cualquier progreso real.",
    themes: ["estudio"],
  },
  {
    id: "cn-prisa",
    origin: "china",
    text: "欲速则不达。",
    reading: "Yù sù zé bù dá.",
    translation: "Quien quiere ir deprisa no llega.",
    source: "Confucio, Analectas 13.17",
    reflection: "La disciplina sostenible gana a los atracones de esfuerzo seguidos de abandono.",
    themes: ["constancia", "descanso"],
  },
  {
    id: "cn-diligencia",
    origin: "china",
    text: "业精于勤，荒于嬉；行成于思，毁于随。",
    reading: "Yè jīng yú qín, huāng yú xī; xíng chéng yú sī, huǐ yú suí.",
    translation: "El oficio se perfecciona con la diligencia y se arruina con el juego; la conducta se forma pensando y se pierde dejándose llevar.",
    source: "Han Yu, «Explicación sobre el progreso en el estudio» (进学解)",
    reflection: "La maestría no es un don: es lo que queda después de muchas horas deliberadas.",
    themes: ["esfuerzo", "estudio"],
  },
  {
    id: "cn-juventud",
    origin: "china",
    text: "少壮不努力，老大徒伤悲。",
    reading: "Shào zhuàng bù nǔlì, lǎo dà tú shāng bēi.",
    translation: "Quien no se esfuerza en la juventud se lamentará en vano en la vejez.",
    source: "«Canción larga» (长歌行), poema anónimo de la dinastía Han",
    reflection: "El tiempo que inviertes hoy en ti es el que tu yo futuro agradecerá.",
    themes: ["esfuerzo"],
  },
  {
    id: "cn-cielo",
    origin: "china",
    text: "天行健，君子以自强不息。",
    reading: "Tiān xíng jiàn, jūnzǐ yǐ zì qiáng bù xī.",
    translation: "El cielo se mueve con vigor; así la persona noble se fortalece sin descanso.",
    source: "Libro de los Cambios (I Ching), comentario al hexagrama Qian",
    reflection: "Fortalecerse es un movimiento constante, no un único gran día.",
    themes: ["constancia", "esfuerzo"],
  },
  {
    id: "cn-cinco-pasos",
    origin: "china",
    text: "博学之，审问之，慎思之，明辨之，笃行之。",
    reading: "Bó xué zhī, shěn wèn zhī, shèn sī zhī, míng biàn zhī, dǔ xíng zhī.",
    translation: "Estudia ampliamente, pregunta a fondo, reflexiona con cuidado, distingue con claridad y practica con firmeza.",
    source: "Doctrina del Medio (中庸), capítulo 20",
    reflection: "Un método completo de aprendizaje en cinco verbos. El último es practicar.",
    themes: ["estudio"],
  },
  {
    id: "cn-jade",
    origin: "china",
    text: "玉不琢，不成器；人不学，不知道。",
    reading: "Yù bù zhuó, bù chéng qì; rén bù xué, bù zhī dào.",
    translation: "El jade sin tallar no se convierte en objeto; la persona que no estudia no conoce el camino.",
    source: "Libro de los Ritos, «Registro del estudio» (学记)",
    reflection: "Nadie nace preparado: la preparación se talla hora a hora.",
    themes: ["estudio", "esfuerzo"],
  },
  {
    id: "cn-tension-relajacion",
    origin: "china",
    text: "一张一弛，文武之道也。",
    reading: "Yī zhāng yī chí, wén wǔ zhī dào yě.",
    translation: "Tensar y luego aflojar: ese es el camino de los reyes Wen y Wu.",
    source: "Libro de los Ritos, «Registros diversos» (杂记下)",
    reflection: "Un arco siempre tenso se rompe. Descansar es parte del método, no una debilidad.",
    themes: ["descanso", "suficiencia"],
  },
  {
    id: "cn-vencerse",
    origin: "china",
    text: "胜人者有力，自胜者强。",
    reading: "Shèng rén zhě yǒu lì, zì shèng zhě qiáng.",
    translation: "Quien vence a otros tiene fuerza; quien se vence a sí mismo es fuerte.",
    source: "Laozi, Tao Te Ching, capítulo 33",
    reflection: "Tu competidor principal es tu propio promedio de ayer.",
    themes: ["esfuerzo", "constancia"],
  },
  {
    id: "cn-saber-suficiente",
    origin: "china",
    text: "知足者富，强行者有志。",
    reading: "Zhī zú zhě fù, qiáng xíng zhě yǒu zhì.",
    translation: "Quien sabe que tiene suficiente es rico; quien persevera tiene voluntad.",
    source: "Laozi, Tao Te Ching, capítulo 33",
    reflection: "Perseverar y saber cuándo basta no se contradicen: las dos cosas son disciplina.",
    themes: ["suficiencia", "constancia"],
  },
  {
    id: "cn-vida-limitada",
    origin: "china",
    text: "吾生也有涯，而知也无涯。",
    reading: "Wú shēng yě yǒu yá, ér zhī yě wú yá.",
    translation: "Mi vida tiene límite, pero el conocimiento no lo tiene.",
    source: "Zhuangzi, «Lo esencial para nutrir la vida» (养生主)",
    reflection: "Zhuangzi sigue advirtiendo que perseguir lo ilimitado con una vida limitada agota. Por eso tu meta diaria tiene un final.",
    themes: ["suficiencia", "estudio"],
  },
  {
    id: "cn-camino-largo",
    origin: "china",
    text: "路漫漫其修远兮，吾将上下而求索。",
    reading: "Lù mànmàn qí xiū yuǎn xī, wú jiāng shàng xià ér qiú suǒ.",
    translation: "El camino es largo y lejano; lo recorreré de arriba abajo buscando.",
    source: "Qu Yuan, «Encuentro con el dolor» (离骚)",
    reflection: "El desarrollo personal es una búsqueda larga. Un día excelente no la termina; tampoco un día flojo.",
    themes: ["constancia"],
  },
  {
    id: "cn-aguja",
    origin: "china",
    text: "只要功夫深，铁杵磨成针。",
    reading: "Zhǐyào gōngfu shēn, tiě chǔ mó chéng zhēn.",
    translation: "Con suficiente esfuerzo, una barra de hierro se convierte en aguja.",
    source: "Proverbio popular chino",
    reflection: "Lo imposible a corto plazo es rutinario a largo plazo.",
    themes: ["constancia", "esfuerzo"],
  },
  {
    id: "cn-espada-ciruelo",
    origin: "china",
    text: "宝剑锋从磨砺出，梅花香自苦寒来。",
    reading: "Bǎo jiàn fēng cóng mó lì chū, méi huā xiāng zì kǔ hán lái.",
    translation: "El filo de la espada nace del afilado; el aroma del ciruelo, del frío amargo.",
    source: "Proverbio popular chino",
    reflection: "Las horas difíciles son las que afilan.",
    themes: ["esfuerzo"],
  },
  {
    id: "cn-montana-libros",
    origin: "china",
    text: "书山有路勤为径，学海无涯苦作舟。",
    reading: "Shū shān yǒu lù qín wéi jìng, xué hǎi wú yá kǔ zuò zhōu.",
    translation: "En la montaña de los libros, la diligencia es el sendero; en el mar sin orillas del saber, el esfuerzo es la barca.",
    source: "Proverbio popular chino (se atribuye a Han Yu, sin fuente que lo confirme)",
    reflection: "No hay atajos para el conocimiento, pero sí un camino claro: trabajo diario.",
    themes: ["estudio", "esfuerzo"],
  },

  // ----------------------------------------------------------------- Rusia
  {
    id: "ru-paciencia-trabajo",
    origin: "rusia",
    text: "Терпение и труд всё перетрут.",
    reading: "Terpénie i trud vsio peretrút.",
    translation: "La paciencia y el trabajo lo muelen todo.",
    source: "Proverbio popular ruso",
    reflection: "La paciencia y el trabajo vencen las dificultades. No hace falta prisa: hace falta continuidad.",
    themes: ["constancia", "esfuerzo"],
  },
  {
    id: "ru-pez-estanque",
    origin: "rusia",
    text: "Без труда не вытащишь и рыбку из пруда.",
    reading: "Bez trudá ne výtaschish i rýbku iz prudá.",
    translation: "Sin esfuerzo no sacas ni un pececito del estanque.",
    source: "Proverbio popular ruso",
    reflection: "Todo resultado, hasta el más pequeño, pide trabajo real.",
    themes: ["esfuerzo"],
  },
  {
    id: "ru-repeticion",
    origin: "rusia",
    text: "Повторение — мать учения.",
    reading: "Povtorénie — mat' uchénia.",
    translation: "La repetición es la madre del aprendizaje.",
    source: "Proverbio popular ruso (eco del latín «repetitio est mater studiorum»)",
    reflection: "Idiomas, programación, ejercicio: casi todo se domina repitiendo bien.",
    themes: ["estudio", "constancia"],
  },
  {
    id: "ru-luz-oscuridad",
    origin: "rusia",
    text: "Ученье — свет, а неученье — тьма.",
    reading: "Uchén'e — svet, a neuchén'e — t'ma.",
    translation: "El estudio es luz y la ignorancia, oscuridad.",
    source: "Proverbio popular ruso",
    reflection: "Cada hora de estudio enciende algo que nadie te puede quitar.",
    themes: ["estudio"],
  },
  {
    id: "ru-vivir-aprender",
    origin: "rusia",
    text: "Век живи — век учись.",
    reading: "Vek zhiví — vek uchís'.",
    translation: "Vive un siglo, aprende un siglo.",
    source: "Proverbio popular ruso",
    reflection: "El aprendizaje no tiene fecha de caducidad.",
    themes: ["estudio"],
  },
  {
    id: "ru-camino-andante",
    origin: "rusia",
    text: "Дорогу осилит идущий.",
    reading: "Dorógu osílit idúschi.",
    translation: "El camino lo vence quien camina.",
    source: "Proverbio popular ruso",
    reflection: "No importa la distancia hasta tu objetivo: importa que hoy avances.",
    themes: ["inicio", "constancia"],
  },
  {
    id: "ru-ojos-manos",
    origin: "rusia",
    text: "Глаза боятся, а руки делают.",
    reading: "Glazá boyátsia, a rukí délayut.",
    translation: "Los ojos tienen miedo, pero las manos hacen.",
    source: "Proverbio popular ruso",
    reflection: "La tarea parece enorme hasta que empiezas. Empieza.",
    themes: ["inicio", "esfuerzo"],
  },
  {
    id: "ru-piedra-quieta",
    origin: "rusia",
    text: "Под лежачий камень вода не течёт.",
    reading: "Pod lezháchi kámen' vodá ne techiót.",
    translation: "Bajo la piedra quieta no corre el agua.",
    source: "Proverbio popular ruso",
    reflection: "Nada llega a quien no se mueve.",
    themes: ["inicio"],
  },
  {
    id: "ru-gota",
    origin: "rusia",
    text: "Капля камень точит.",
    reading: "Káplia kámen' tóchit.",
    translation: "La gota horada la piedra.",
    source: "Proverbio popular ruso (como el latín «gutta cavat lapidem»)",
    reflection: "Lo que importa no es la fuerza de un día, sino la repetición de muchos.",
    themes: ["constancia"],
  },
  {
    id: "ru-no-dioses",
    origin: "rusia",
    text: "Не боги горшки обжигают.",
    reading: "Ne bógi gorshkí obzhigáyut.",
    translation: "No son los dioses quienes cuecen las vasijas.",
    source: "Proverbio popular ruso",
    reflection: "Los que destacan no son de otra especie: son personas que practicaron más. Tú también puedes.",
    themes: ["esfuerzo", "inicio"],
  },
  {
    id: "ru-despacio",
    origin: "rusia",
    text: "Тише едешь — дальше будешь.",
    reading: "Tíshe édesh' — dál'she búdesh'.",
    translation: "Cuanto más despacio vas, más lejos llegas.",
    source: "Proverbio popular ruso",
    reflection: "Un ritmo sostenible llega más lejos que un sprint que te agota.",
    themes: ["descanso", "constancia"],
  },
  {
    id: "ru-tiempo-ocio",
    origin: "rusia",
    text: "Делу время, потехе час.",
    reading: "Délu vrémia, potéje chas.",
    translation: "Tiempo para el trabajo y una hora para el recreo.",
    source: "Proverbio ruso; su forma escrita más antigua aparece en el reglamento de cetrería del zar Alexéi Mijáilovich (1656)",
    reflection: "Hay tiempo para todo: primero lo importante, y después, sin culpa, el descanso.",
    themes: ["suficiencia", "descanso"],
  },
  {
    id: "ru-hecho-pasear",
    origin: "rusia",
    text: "Сделал дело — гуляй смело.",
    reading: "Sdélal délo — gulyái smélo.",
    translation: "Hiciste el trabajo: ahora pasea tranquilo.",
    source: "Proverbio popular ruso",
    reflection: "Cuando cumples tu objetivo, el descanso no es un premio: es lo que toca.",
    themes: ["suficiencia", "descanso"],
  },
  {
    id: "ru-suvorov",
    origin: "rusia",
    text: "Тяжело в учении — легко в бою.",
    reading: "Tyazheló v uchénii — legkó v boyú.",
    translation: "Duro en el entrenamiento, fácil en la batalla.",
    source: "Dicho popular basado en «La ciencia de vencer» del general Alexandr Suvórov (1796)",
    reflection: "Lo que entrenas hoy es lo que tendrás disponible cuando importe.",
    themes: ["esfuerzo", "estudio"],
  },
  {
    id: "ru-nunca-tarde",
    origin: "rusia",
    text: "Учиться никогда не поздно.",
    reading: "Uchít'sia nikogdá ne pózdno.",
    translation: "Nunca es tarde para aprender.",
    source: "Proverbio popular ruso",
    reflection: "Un idioma, un instrumento, una ciencia: siempre se puede empezar hoy.",
    themes: ["estudio", "inicio"],
  },
  {
    id: "ru-trabajo-alimenta",
    origin: "rusia",
    text: "Труд кормит, а лень портит.",
    reading: "Trud kórmit, a len' pórtit.",
    translation: "El trabajo alimenta y la pereza estropea.",
    source: "Proverbio popular ruso",
    reflection: "El esfuerzo se acumula a tu favor; la dejadez, en tu contra.",
    themes: ["esfuerzo"],
  },
];

export const ORIGIN_LABEL: Record<Quote["origin"], string> = { china: "China", rusia: "Rusia" };

export function quoteById(id: string): Quote | undefined {
  return QUOTES.find((q) => q.id === id);
}

function pool(theme?: QuoteTheme): readonly Quote[] {
  if (!theme) return QUOTES;
  const p = QUOTES.filter((q) => q.themes.includes(theme));
  return p.length ? p : QUOTES;
}

/** Frase del día: cambia cada día local y es la misma en todos tus dispositivos. */
export function quoteOfDay(day: ISODate, theme?: QuoteTheme, salt = 0): Quote {
  const p = pool(theme);
  const n = diffDays(day, "2026-01-01") + salt * 7;
  return p[((n % p.length) + p.length) % p.length];
}

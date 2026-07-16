export type EditionId = "1" | "2" | "3";

export interface StoryCard {
  eyebrow: string;
  title: string;
  text: string;
  image: string;
  alt: string;
}

export interface Sponsor {
  name: string;
  logo?: string;
}

export interface Edition {
  id: EditionId;
  label: string;
  shortLabel: string;
  year: string;
  status: string;
  isCurrent: boolean;
  date: string;
  location: string;
  city: string;
  hero: {
    eyebrow: string;
    title: string;
    summary: string;
    image: string;
    alt: string;
  };
  stream: {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
    href: string;
    embedUrl?: string;
  };
  impact: {
    eyebrow: string;
    title: string;
    summary: string;
    cards: StoryCard[];
  };
  highlights: {
    eyebrow: string;
    title: string;
    summary: string;
    cards: StoryCard[];
  };
  about: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
  };
  milestones: Array<{
    eyebrow: string;
    title: string;
    text: string;
  }>;
  sponsors: {
    eyebrow: string;
    title: string;
    note: string;
    items: Sponsor[];
  };
  eventInfo: {
    description: string;
    categories: string[];
    categoriesNote?: string;
    prize: string;
    schedule: string;
  };
}

const commonSponsors = {
  pepsi: { name: "Pepsi", logo: "/assets/brands/pepsi.png" },
  sony: { name: "Sony", logo: "/assets/brands/sony.png" },
  bazuka: { name: "Bazuka", logo: "/assets/brands/bazuka.png" },
  evergood: { name: "Evergood", logo: "/assets/brands/evergood.png" },
  loGanga: { name: "Lo Ganga", logo: "/assets/brands/lo-ganga.png" },
  naturesGarden: {
    name: "Nature's Garden",
    logo: "/assets/brands/natures-garden.png"
  },
  codicia: { name: "Codicia", logo: "/assets/brands/codicia.png" },
  ponyMalta: { name: "Pony Malta", logo: "/assets/brands/pony-malta.png" }
} satisfies Record<string, Sponsor>;

export const editions: Edition[] = [
  {
    id: "1",
    label: "1ra edición",
    shortLabel: "Edición 1",
    year: "2024",
    status: "Edición finalizada",
    isCurrent: false,
    date: "Realizada en 2024",
    location: "Archivo de sede por confirmar",
    city: "Guayaquil, Ecuador",
    hero: {
      eyebrow: "El origen · 2024",
      title: "La primera batalla que se volvió historia.",
      summary:
        "La edición inaugural reunió a la comunidad de breaking de Guayaquil y dio origen al documental de Break The Beat.",
      image: "/assets/editions/edition-1-host.webp",
      alt: "Host de la primera edición de Break The Beat sobre el escenario"
    },
    stream: {
      eyebrow: "Archivo",
      title: "Edición finalizada",
      description:
        "Esta edición ya terminó. Sus momentos principales están disponibles en la sección de highlights.",
      cta: "Ver highlights",
      href: "#highlights"
    },
    impact: {
      eyebrow: "Impacto · Edición 1",
      title: "El punto de partida de un movimiento.",
      summary:
        "Los datos de esta vista corresponden únicamente a la primera edición y a su legado documental.",
      cards: [
        {
          eyebrow: "2024",
          title: "Torneo inaugural",
          text:
            "La primera edición abrió una pista competitiva para visibilizar el talento ecuatoriano de breaking.",
          image: "/assets/battle-floor.webp",
          alt: "Batalla de breaking durante la primera edición de Break The Beat"
        },
        {
          eyebrow: "Documental",
          title: "La historia cruzó fronteras",
          text:
            "El torneo derivó en un documental exhibido y reconocido en festivales nacionales e internacionales.",
          image: "/assets/editions/edition-1-host.webp",
          alt: "Host animando al público durante la primera edición"
        },
        {
          eyebrow: "10 marcas",
          title: "Primeras alianzas",
          text:
            "La edición inaugural contó con diez marcas registradas en el dossier de la segunda edición.",
          image: "/assets/editions/edition-1-winner.webp",
          alt: "Ganador de la primera edición con su reconocimiento"
        }
      ]
    },
    highlights: {
      eyebrow: "Highlights · Edición 1",
      title: "Los momentos que iniciaron todo.",
      summary:
        "Battles, conducción y premiación de la edición inaugural, sin mezclar imágenes de la segunda edición.",
      cards: [
        {
          eyebrow: "Battles",
          title: "La pista se encendió",
          text:
            "La competencia reunió a breakers frente a una comunidad que acompañó cada ronda.",
          image: "/assets/battle-floor.webp",
          alt: "Breakers compitiendo en la pista de la primera edición"
        },
        {
          eyebrow: "Host",
          title: "El pulso del evento",
          text:
            "La conducción mantuvo conectados al público, la música y la energía de la batalla.",
          image: "/assets/editions/edition-1-host.webp",
          alt: "Host de la primera edición con micrófono"
        },
        {
          eyebrow: "Premiación",
          title: "Talento reconocido",
          text:
            "El cierre celebró a los participantes y a quienes destacaron en la competencia inaugural.",
          image: "/assets/editions/edition-1-winner.webp",
          alt: "Ganador de la primera edición mostrando su diploma"
        }
      ]
    },
    about: {
      eyebrow: "Quiénes somos · Edición 1",
      title: "Una competencia estudiantil con vocación de comunidad.",
      paragraphs: [
        "Break The Beat nació como un torneo de breakdance realizado por estudiantes de Universidad Casa Grande.",
        "Desde su inicio buscó mostrar el breaking como arte, deporte, identidad y una alternativa positiva para jóvenes de Guayaquil."
      ]
    },
    milestones: [
      {
        eyebrow: "Origen",
        title: "Primera edición",
        text: "El torneo reunió a bailarines, público y primeras marcas aliadas en 2024."
      },
      {
        eyebrow: "Después del torneo",
        title: "Nació el documental",
        text: "La historia de la primera edición se convirtió en una pieza audiovisual sobre el talento ecuatoriano."
      },
      {
        eyebrow: "Legado",
        title: "Reconocimiento internacional",
        text: "El documental llegó a selecciones y reconocimientos en Cuenca, Madrid y Barcelona, entre otros circuitos."
      }
    ],
    sponsors: {
      eyebrow: "Sponsors · Edición 1",
      title: "Marcas de la primera edición.",
      note: "Listado tomado de la lámina “En la primera edición contamos con marcas como” del dossier 2025.",
      items: [
        commonSponsors.pepsi,
        commonSponsors.sony,
        commonSponsors.naturesGarden,
        commonSponsors.bazuka,
        commonSponsors.loGanga,
        commonSponsors.codicia,
        commonSponsors.evergood,
        commonSponsors.ponyMalta,
        { name: "Color Express" },
        { name: "Cábala Estudio Creativo" }
      ]
    },
    eventInfo: {
      description:
        "La primera edición fue el origen del torneo y del documental de Break The Beat. El archivo disponible no confirma una fecha completa, sede exacta ni desglose oficial de categorías.",
      categories: ["Batallas de breaking"],
      categoriesNote: "El detalle histórico de categorías todavía debe ser confirmado por la organización.",
      prize: "Premiación registrada en el archivo fotográfico; monto oficial por confirmar.",
      schedule: "Evento realizado en 2024. Horario archivado por confirmar."
    }
  },
  {
    id: "2",
    label: "2da edición",
    shortLabel: "Edición 2",
    year: "2025",
    status: "Edición finalizada",
    isCurrent: false,
    date: "Domingo 28 de septiembre de 2025",
    location: "Plaza de Teatros, calle Panamá",
    city: "Guayaquil, Ecuador",
    hero: {
      eyebrow: "Más que una batalla · 2025",
      title: "Una edición que puso al breaking en conversación.",
      summary:
        "La segunda edición amplió la comunidad, la cobertura y la presencia de Break The Beat en Guayaquil.",
      image: "/assets/hero-battle.webp",
      alt: "Competencia de la segunda edición de Break The Beat rodeada de público"
    },
    stream: {
      eyebrow: "Archivo",
      title: "Edición finalizada",
      description:
        "Revive los resultados, la cobertura y los momentos de la edición realizada en 2025.",
      cta: "Ver highlights",
      href: "#highlights"
    },
    impact: {
      eyebrow: "Impacto · Edición 2",
      title: "Más alcance, más comunidad.",
      summary:
        "Las cifras mostradas corresponden a la comunicación y asistencia reportadas para Break The Beat 2.",
      cards: [
        {
          eyebrow: "+50 participantes",
          title: "Talento en la pista",
          text:
            "Más de cincuenta participantes se inscribieron para competir en la segunda edición.",
          image: "/assets/community-lineup.webp",
          alt: "Participantes de la segunda edición reunidos junto a la pista"
        },
        {
          eyebrow: "+500 asistentes",
          title: "La plaza se llenó",
          text:
            "La Plaza de Teatros de la calle Panamá reunió a más de quinientas personas.",
          image: "/assets/crowd-rewind.webp",
          alt: "Público de la segunda edición alrededor del host"
        },
        {
          eyebrow: "+6 horas",
          title: "Una jornada completa",
          text:
            "La programación sostuvo más de seis horas de evento, música, competencia y premiación.",
          image: "/assets/hero-battle.webp",
          alt: "Breaker compitiendo durante la segunda edición"
        },
        {
          eyebrow: "+40K vistas",
          title: "Impacto mediático",
          text:
            "La comunicación sumó más de veinte piezas, cuatro medios y miles de interacciones en Instagram.",
          image: "/assets/press-expreso.webp",
          alt: "Cobertura de prensa de Break The Beat 2025"
        }
      ]
    },
    highlights: {
      eyebrow: "Highlights · Edición 2",
      title: "El pulso del evento, por momentos.",
      summary:
        "Una selección visual de battles, música, premiación y cobertura de la edición 2025.",
      cards: [
        {
          eyebrow: "Battles",
          title: "Competencia en círculo",
          text:
            "Rondas de breaking frente a una comunidad que siguió cada movimiento desde el borde de la pista.",
          image: "/assets/hero-battle.webp",
          alt: "Breaker en el centro de la pista durante la segunda edición"
        },
        {
          eyebrow: "DJ y host",
          title: "La música en vivo",
          text:
            "El DJ y la conducción sostuvieron el ritmo de la competencia durante toda la jornada.",
          image: "/assets/dj-live.webp",
          alt: "DJ mezclando música durante Break The Beat 2025"
        },
        {
          eyebrow: "Premiación",
          title: "La dupla ganadora",
          text:
            "La segunda edición cerró reconociendo a sus ganadores frente a la comunidad.",
          image: "/assets/winners.webp",
          alt: "Ganadores de la batalla 2v2 en Break The Beat 2025"
        },
        {
          eyebrow: "Free press",
          title: "La historia llegó a medios",
          text:
            "La cobertura amplificó el talento, la inclusión y la cultura urbana construida desde Guayaquil.",
          image: "/assets/press-expreso.webp",
          alt: "Artículo de prensa sobre Break The Beat 2025"
        }
      ]
    },
    about: {
      eyebrow: "Quiénes somos · Edición 2",
      title: "Un torneo que creció sin perder su causa.",
      paragraphs: [
        "La segunda edición reunió a bailarines de todo el país en una plataforma de competencia sana, expresión urbana y comunidad.",
        "El proyecto buscó fortalecer redes con academias, colectivos, gestores culturales, medios y marcas que creen en el arte como motor de cambio."
      ]
    },
    milestones: [
      {
        eyebrow: "+50",
        title: "Participantes",
        text: "La convocatoria nacional sumó más de cincuenta personas inscritas en Break The Beat 2."
      },
      {
        eyebrow: "+500",
        title: "Asistentes",
        text: "La Plaza de Teatros recibió a una comunidad amplia durante más de seis horas."
      },
      {
        eyebrow: "+4",
        title: "Medios de cobertura",
        text: "Prensa, contenido social y alianzas ampliaron el alcance de la edición 2025."
      }
    ],
    sponsors: {
      eyebrow: "Sponsors · Edición 2",
      title: "Marcas vinculadas al proyecto hasta la segunda edición.",
      note:
        "El media kit 2026 presenta este grupo como marcas que acompañaron las ediciones anteriores; no se atribuyen a la tercera edición.",
      items: [
        { name: "Alcaldía de Guayaquil", logo: "/assets/brands/alcaldia-guayaquil.png" },
        { name: "ZUMAR", logo: "/assets/brands/zumar.png" },
        { name: "Ruta Centro", logo: "/assets/brands/ruta-centro.png" },
        { name: "Aquafit", logo: "/assets/brands/aquafit.png" },
        { name: "LV Vinilos", logo: "/assets/brands/lv-vinilos.png" },
        commonSponsors.pepsi,
        commonSponsors.sony,
        commonSponsors.bazuka,
        commonSponsors.evergood,
        commonSponsors.loGanga,
        commonSponsors.naturesGarden,
        commonSponsors.codicia,
        commonSponsors.ponyMalta
      ]
    },
    eventInfo: {
      description:
        "La segunda edición reunió a bailarines de todo el país en una jornada con música en vivo, presentaciones, freestyle y competencia de breakdance.",
      categories: ["Batallas de breakdance", "Freestyle libre"],
      categoriesNote: "El archivo disponible no desglosa todas las categorías competitivas de 2025.",
      prize: "USD 600 anunciados en el dossier de la segunda edición.",
      schedule: "Domingo 28 de septiembre de 2025 · jornada de más de 6 horas."
    }
  },
  {
    id: "3",
    label: "3ra edición",
    shortLabel: "Edición 3",
    year: "2026",
    status: "Próxima edición",
    isCurrent: true,
    date: "Domingo 27 de septiembre de 2026",
    location: "Plaza de los Teatros, calle Panamá",
    city: "Guayaquil, Ecuador",
    hero: {
      eyebrow: "3ra edición · 2026",
      title: "El breaking vuelve a tomar Guayaquil.",
      summary:
        "Un torneo nacional donde el breaking se vive como deporte, cultura y comunidad.",
      image: "/assets/guayaquil-venue.webp",
      alt: "Bailarina en un espacio cultural de Guayaquil"
    },
    stream: {
      eyebrow: "En vivo",
      title: "Transmisión del evento",
      description:
        "El canal oficial todavía está por confirmar. El reproductor se activará aquí cuando la organización publique el enlace.",
      cta: "Seguir novedades",
      href: "https://www.instagram.com/breakthebeat.ucg/"
    },
    impact: {
      eyebrow: "Impacto proyectado · Edición 3",
      title: "Una nueva edición para ampliar el movimiento.",
      summary:
        "Como el evento aún no ocurre, esta sección muestra objetivos de la edición 2026 y evita presentar proyecciones como resultados.",
      cards: [
        {
          eyebrow: "Alcance nacional",
          title: "Talento de todo Ecuador",
          text:
            "La convocatoria busca reunir a bailarines de distintas ciudades y dar visibilidad a sus historias.",
          image: "/assets/community-lineup.webp",
          alt: "Comunidad de breakers reunida en una edición anterior"
        },
        {
          eyebrow: "18–30 años",
          title: "Juventud y cultura urbana",
          text:
            "La propuesta prioriza a estudiantes, artistas urbanos, bailarines y comunidades vinculadas al breaking.",
          image: "/assets/crowd-rewind.webp",
          alt: "Público joven acompañando una edición anterior"
        },
        {
          eyebrow: "$600 USD",
          title: "Premio anunciado",
          text:
            "El media kit 2026 anuncia un premio de seiscientos dólares para la persona ganadora.",
          image: "/assets/winners.webp",
          alt: "Ganadores de una edición anterior de Break The Beat"
        },
        {
          eyebrow: "Guayaquil",
          title: "Referente cultural y deportivo",
          text:
            "La meta es consolidar el torneo como un espacio reconocido, seguro y sostenible para la comunidad.",
          image: "/assets/guayaquil-venue.webp",
          alt: "Espacio cultural en la ciudad de Guayaquil"
        }
      ]
    },
    highlights: {
      eyebrow: "Highlights previstos · Edición 3",
      title: "Lo que viviremos en la tercera edición.",
      summary:
        "La programación visual se actualizará con material 2026 después del evento; por ahora muestra las experiencias confirmadas.",
      cards: [
        {
          eyebrow: "1 vs 1",
          title: "Batallas individuales",
          text:
            "Una categoría para competir cara a cara y demostrar técnica, musicalidad y presencia.",
          image: "/assets/hero-battle.webp",
          alt: "Batalla individual de breaking en una edición anterior"
        },
        {
          eyebrow: "2 vs 2",
          title: "Duplas en la pista",
          text:
            "Equipos de dos participantes podrán combinar estilos, estrategia y sincronía.",
          image: "/assets/winners.webp",
          alt: "Dupla ganadora de una edición anterior"
        },
        {
          eyebrow: "BGirls",
          title: "Categoría BGirls",
          text:
            "Una categoría propia para impulsar y visibilizar el talento de las BGirls participantes.",
          image: "/assets/battle-floor.webp",
          alt: "Breakers compitiendo en una edición anterior"
        },
        {
          eyebrow: "En vivo",
          title: "Música y transmisión",
          text:
            "DJ, host y un canal de transmisión por confirmar acompañarán el pulso del evento.",
          image: "/assets/dj-live.webp",
          alt: "DJ de Break The Beat en una edición anterior"
        }
      ]
    },
    about: {
      eyebrow: "Quiénes somos · Edición 3",
      title: "La tercera edición quiere llevar el torneo a otro nivel.",
      paragraphs: [
        "Break The Beat es una competencia nacional de breakdance creada por estudiantes de Universidad Casa Grande para visibilizar el talento, la disciplina y las historias de sus bailarines.",
        "En 2026 el proyecto busca ampliar auspicios, recursos y alcance para consolidarse como un referente cultural y deportivo de Guayaquil."
      ]
    },
    milestones: [
      {
        eyebrow: "Convocatoria",
        title: "Inscripciones 2026",
        text: "El formulario nativo permite registrar participantes individuales y duplas 2v2."
      },
      {
        eyebrow: "Competencia",
        title: "Tres categorías",
        text: "La inscripción contempla 1 vs 1, 2 vs 2 y BGirls para participantes mayores de edad."
      },
      {
        eyebrow: "Evento",
        title: "27 de septiembre",
        text: "La tercera edición está prevista en la Plaza de los Teatros, calle Panamá, Guayaquil."
      }
    ],
    sponsors: {
      eyebrow: "Sponsors · Edición 3",
      title: "Marcas de la tercera edición por confirmar.",
      note:
        "Las marcas de ediciones anteriores no se muestran como sponsors 2026. Esta vista se actualizará cuando existan acuerdos confirmados.",
      items: []
    },
    eventInfo: {
      description:
        "La tercera edición será una competencia nacional de breaking con música en vivo, shows, freestyle abierto y participación de bailarines de todo Ecuador.",
      categories: ["1 vs 1", "2 vs 2", "BGirls"],
      prize: "USD 600 para la persona ganadora, según el media kit 2026.",
      schedule: "Domingo 27 de septiembre de 2026 · horario operativo por confirmar."
    }
  }
];

export const currentEdition = editions.find((edition) => edition.isCurrent) ?? editions[2];

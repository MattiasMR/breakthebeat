export const event = {
  title: "Break The Beat",
  edition: "3ra edición",
  eyebrow: "Torneo nacional de breakdance",
  date: "Domingo 27 Sept, 2026 · 10 AM",
  location: "Plaza de los Teatros, calle Panamá",
  city: "Guayaquil, Ecuador",
  instagram: "@breakthebeat.ucg",
  instagramUrl: "https://www.instagram.com/breakthebeat.ucg/",
  tiktokUrl: "https://www.tiktok.com/@breakthebeat.ucg?_r=1&_t=ZS-98WkkVF0evN",
  youtubeUrl: "https://www.youtube.com/@BreakTheBeat_UCG",
  whatsappUrl: "https://chat.whatsapp.com/EPfWkeV0HgfJK55B5gEWW3",
  email: "breakthebeat@casagrande.edu.ec",
  summary:
    "Una competencia nacional de breakdance creada por estudiantes de Universidad Casa Grande para visibilizar la cultura urbana, abrir espacios seguros y reunir a bailarines de todo el país."
};

export const navItems = [
  { label: "Quiénes somos", href: "#evento" },
  { label: "Impacto", href: "#impacto" },
  { label: "Sponsors", href: "#sponsors" }
];

export const heroSlides = [
  {
    slug: "movimiento",
    title: "Break The Beat",
    eyebrow: "3ra edición",
    image: "/assets/hero-battle.webp",
    alt: "Bailarín compitiendo frente al público en Break The Beat",
    cta: "Conocer el movimiento",
    text:
      "Un torneo nacional donde el breaking se vive como deporte, cultura y comunidad.",
    href: "/movimiento/"
  },
  {
    slug: "impacto",
    title: "Impacto social",
    eyebrow: "Más que una batalla",
    image: "/assets/community-lineup.webp",
    alt: "Comunidad de Break The Beat reunida en una edición anterior",
    cta: "Ver impacto",
    text:
      "Historias, talleres y espacios seguros para que jóvenes canalicen energía desde el arte urbano.",
    href: "/impacto/"
  },
  {
    slug: "rewind",
    title: "Rewind",
    eyebrow: "Ediciones anteriores",
    image: "/assets/crowd-rewind.webp",
    alt: "Público y bailarines reunidos en Break The Beat",
    cta: "Ver historia",
    text:
      "Prensa, premios, documental y comunidad: una línea de tiempo que sigue creciendo.",
    href: "/rewind/"
  },
  {
    slug: "apoyar",
    title: "Donar ahora",
    eyebrow: "Funding",
    image: "/assets/winners.webp",
    alt: "Ganadores del torneo con cheque de premiación",
    cta: "Donar con PayPhone",
    text:
      "Aporta directamente a Break The Beat mediante PayPhone.",
    href: "/apoyar/"
  }
];

export const featurePages = [
  {
    slug: "movimiento",
    title: "Que es Break The Beat",
    eyebrow: "Movimiento",
    image: "/assets/hero-battle.webp",
    alt: "Bailarín compitiendo frente al público en Break The Beat",
    summary:
      "Break The Beat es una competencia nacional de breakdance creada por estudiantes de Universidad Casa Grande para visibilizar una cultura que mezcla arte, deporte, identidad y comunidad.",
    bullets: [
      "Competencia nacional en Guayaquil con bailarines de todo el país.",
      "Premios para los mejores bailarines de cada categoría.",
      "Música en vivo, freestyle abierto, shows y energía de cypher.",
      "Un espacio que respeta la cultura intima del breaking y sus codigos."
    ]
  },
  {
    slug: "impacto",
    title: "Impacto social y cultural",
    eyebrow: "Comunidad",
    image: "/assets/community-lineup.webp",
    alt: "Comunidad de Break The Beat reunida en una edición anterior",
    summary:
      "El proyecto busca abrir espacios seguros para jóvenes, contar historias reales de bailarines y mostrar el breakdance como una alternativa positiva frente a contextos complejos.",
    bullets: [
      "+500 asistentes y +50 participantes en la edición 2025.",
      "+40k vistas en Instagram y +300 comentarios positivos.",
      "Enfoque en talleres, barrios, fundaciones y comunidad.",
      "Narrativa centrada en talento, disciplina y pertenencia."
    ]
  },
  {
    slug: "rewind",
    title: "Rewind y reconocimientos",
    eyebrow: "Historia",
    image: "/assets/crowd-rewind.webp",
    alt: "Público y bailarines reunidos en Break The Beat",
    summary:
      "Break The Beat ya trascendio el torneo: sus ediciones anteriores impulsaron comunidad, prensa y un documental reconocido en festivales nacionales e internacionales.",
    bullets: [
      "Selección oficial en Cuenca, Madrid y Choreoscope Barcelona.",
      "Mejor corto documental en festivales de Barcelona y Muchu Picchu.",
      "Mención de honor en Premios Municipales de Quito 2025.",
      "Cobertura en Diario Expreso, SUPER, MadosTV y medios aliados."
    ]
  },
  {
    slug: "highlights",
    title: "Highlights del evento",
    eyebrow: "Momentos",
    image: "/assets/battle-floor.webp",
    alt: "Bailarines compitiendo en una batalla de breakdance",
    summary:
      "La experiencia se construye con battles, DJ en vivo, host de la comunidad, premiación, free press y momentos que hacen que cada edición tenga pulso propio.",
    bullets: [
      "Battles con filtros, jueces y dinamica real de cypher.",
      "DJ y host como parte activa del show.",
      "Premios que buscan reconocer el esfuerzo de los bailarines.",
      "Cobertura audiovisual y prensa para amplificar la comunidad."
    ]
  },
  {
    slug: "apoyar",
    title: "Donar ahora",
    eyebrow: "Donaciones",
    image: "/assets/winners.webp",
    alt: "Ganadores del torneo con cheque de premiación",
    summary:
      "Tu aporte ayuda a llevar clases gratuitas de baile a colegios y hacer posible la edición 2026 de Break The Beat.",
    bullets: [
      "Financiar clases de iniciación en colegios sin costo para sus estudiantes.",
      "Cubrir la producción y realización del evento de tesis Break The Beat 2026."
    ]
  }
];

export const donationUses = [
  {
    number: "01",
    title: "Clases gratuitas en colegios",
    description:
      "Pagar a profesores de baile para realizar jornadas de iniciación en colegios, sin costo para niñas, niños y jóvenes."
  },
  {
    number: "02",
    title: "Evento de tesis 2026",
    description:
      "Cubrir producción, logística, infraestructura y otros costos necesarios para realizar Break The Beat 2026."
  }
] as const;

export const donationPayment = {
  provider: "PayPhone",
  url: "https://ppls.me/sK0m4F8T63Z2tTv0sg7Uw"
} as const;

export const stats = [
  { value: "+4", label: "medios de cobertura" },
  { value: "+20", label: "piezas en redes" },
  { value: "+40k", label: "vistas en Instagram" },
  { value: "+2.5k", label: "likes en Instagram" },
  { value: "+300", label: "comentarios positivos" },
  { value: "+50", label: "participantes" },
  { value: "+500", label: "asistentes" },
  { value: "+4", label: "alianzas estrategicas" }
];

export const awards = [
  "Selección oficial en el Festival Internacional de Cine Cuenca",
  "Selección oficial en el Madrid Indie Film Festival - MADRIFF",
  "Mejor corto documental en la primera edición del Muchu Picchu International Film Festival",
  "Mejor corto documental en Indie House Barcelona, julio 2025",
  "Selección oficial para la muestra online de Choreoscope - Barcelona Dance Film Festival",
  "Mención de honor en video de mediana duración en los Premios Municipales de Quito 2025"
];

export const timeline = [
  {
    year: "Origen",
    title: "Una batalla que se volvió comunidad",
    text:
      "Break The Beat nace como un espacio para que bailarines de breaking compitan, se reconozcan y se encuentren desde la cultura."
  },
  {
    year: "Documental",
    title: "La historia cruza fronteras",
    text:
      "La primera edición trascendió el torneo y se convirtió en un documental exhibido en festivales nacionales e internacionales."
  },
  {
    year: "2025",
    title: "Segunda edición, más alcance",
    text:
      "La comunidad creció con nuevos talentos, prensa, alianzas y más de seis horas de evento en la Plaza de Teatros de la calle Panamá."
  },
  {
    year: "2026",
    title: "Tercera edición en producción",
    text:
      "La meta es consolidar el torneo como referente cultural y deportivo de Guayaquil, con más auspicios, premios y enfoque social."
  }
];

export const highlights = [
  {
    title: "Battles",
    image: "/assets/battle-floor.webp",
    width: 450,
    height: 300,
    alt: "Bailarines compitiendo en una batalla de breakdance al aire libre",
    text:
      "Formato competitivo con energía de cypher, filtros, jueces de la comunidad y música en vivo."
  },
  {
    title: "DJ y host",
    image: "/assets/dj-live.webp",
    width: 440,
    height: 293,
    alt: "DJ del evento mezclando música en vivo",
    text:
      "El beat se decide en el momento; el host y el DJ sostienen el pulso real de la batalla."
  },
  {
    title: "Premiación",
    image: "/assets/winners.webp",
    width: 560,
    height: 374,
    alt: "Ganadores de Break The Beat posando con cheque de premiación",
    text:
      "Premios que reconocen el esfuerzo de los bailarines y elevan el nivel del torneo."
  },
  {
    title: "Free press",
    image: "/assets/press-expreso.webp",
    width: 379,
    height: 800,
    alt: "Captura de prensa sobre Break The Beat en Diario Expreso",
    text:
      "Cobertura en medios, redes y espacios culturales que amplifican el mensaje del proyecto."
  }
];

export const collaborators = [
  { name: "Universidad Casa Grande", type: "Institucion" },
  { name: "PAPS", type: "Proyecto academico" },
  { name: "Alcaldia de Guayaquil", type: "Aliado anterior" },
  { name: "SUMAR", type: "Espacio aliado anterior" },
  { name: "Diario Expreso", type: "Prensa" },
  { name: "SUPER", type: "Prensa" },
  { name: "MadosTV", type: "Medio aliado" },
  { name: "Gestores culturales", type: "Comunidad" },
  { name: "Comunidad breaking", type: "Base del movimiento" }
];

export const payments = [
  {
    key: "payphone",
    label: "PayPhone",
    description: "Enlace de pago para elegir el monto y donar en línea.",
    enabled: true,
    url: donationPayment.url,
    status: "Disponible",
    disclaimer: "El pago se completa en la plataforma de PayPhone."
  },
  {
    key: "paypal",
    label: "PayPal",
    description: "Alternativa para aportes internacionales en USD.",
    enabled: false,
    url: "",
    status: "Link pendiente",
    disclaimer: "Comisiones comerciales y retiro de fondos por validar."
  }
];

export const footerGroups = [
  {
    title: "Break The Beat",
    links: [
      { label: "Quiénes somos", href: "/#evento" },
      { label: "Impacto", href: "/#impacto" },
      { label: "Sponsors", href: "/#sponsors" },
      { label: "Información del evento", href: "/#informacion" }
    ]
  },
  {
    title: "Participar",
    links: [
      { label: "Donar ahora", href: "/apoyar/" },
      { label: "Contacto oficial", href: `mailto:${event.email}` },
      { label: "Instagram", href: event.instagramUrl },
      { label: "TikTok", href: event.tiktokUrl },
      { label: "YouTube", href: event.youtubeUrl },
      { label: "WhatsApp", href: event.whatsappUrl },
      { label: "Email del proyecto", href: `mailto:${event.email}` }
    ]
  },
  {
    title: "Estado del sitio",
    links: [
      { label: "Domingo 27 de septiembre 2026", href: "/#inicio" },
      { label: "Plaza de los Teatros, calle Panamá", href: "/#inicio" },
      { label: "Transferencias habilitadas", href: "/apoyar/" },
      { label: "Sponsors 2026", href: "/#sponsors" }
    ]
  }
];

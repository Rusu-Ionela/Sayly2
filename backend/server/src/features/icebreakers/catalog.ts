/** Languages the questions are translated into; every other language shows the English text. */
export type PromptLanguage = "es" | "fr" | "de" | "it" | "pt" | "ro";

export type IcebreakerPrompt = {
  id: string;
  en: string;
  translations: Record<PromptLanguage, string>;
};

/**
 * Daily conversation starters: short, personal and answerable at any level, so a beginner can
 * reply in one sentence and an advanced learner can tell a story. Add new ones at the end
 * (ids are stored with answers, so never reuse or renumber an id).
 */
export const ICEBREAKER_PROMPTS: readonly IcebreakerPrompt[] = [
  {
    id: "ib01",
    en: "What did you eat for breakfast today?",
    translations: {
      es: "¿Qué desayunaste hoy?",
      fr: "Qu'est-ce que tu as mangé au petit-déjeuner aujourd'hui ?",
      de: "Was hast du heute zum Frühstück gegessen?",
      it: "Cosa hai mangiato a colazione oggi?",
      pt: "O que você comeu no café da manhã hoje?",
      ro: "Ce ai mâncat azi la micul dejun?",
    },
  },
  {
    id: "ib02",
    en: "Describe your hometown in three words.",
    translations: {
      es: "Describe tu ciudad natal en tres palabras.",
      fr: "Décris ta ville natale en trois mots.",
      de: "Beschreibe deine Heimatstadt in drei Wörtern.",
      it: "Descrivi la tua città natale in tre parole.",
      pt: "Descreva sua cidade natal em três palavras.",
      ro: "Descrie-ți orașul natal în trei cuvinte.",
    },
  },
  {
    id: "ib03",
    en: "What is a song you can't stop listening to right now?",
    translations: {
      es: "¿Qué canción no puedes dejar de escuchar ahora mismo?",
      fr: "Quelle chanson est-ce que tu écoutes en boucle en ce moment ?",
      de: "Welches Lied hörst du gerade ständig?",
      it: "Qual è la canzone che non riesci a smettere di ascoltare in questo periodo?",
      pt: "Qual música você não consegue parar de ouvir agora?",
      ro: "Ce melodie asculți întruna în perioada asta?",
    },
  },
  {
    id: "ib04",
    en: "Where would you travel tomorrow if money were no problem?",
    translations: {
      es: "Si el dinero no fuera un problema, ¿adónde viajarías mañana?",
      fr: "Si l'argent n'était pas un problème, où voyagerais-tu demain ?",
      de: "Wohin würdest du morgen reisen, wenn Geld keine Rolle spielte?",
      it: "Se i soldi non fossero un problema, dove andresti domani?",
      pt: "Se dinheiro não fosse problema, para onde você viajaria amanhã?",
      ro: "Unde ai călători mâine dacă banii n-ar fi o problemă?",
    },
  },
  {
    id: "ib05",
    en: "Why are you learning this language?",
    translations: {
      es: "¿Por qué estás aprendiendo este idioma?",
      fr: "Pourquoi est-ce que tu apprends cette langue ?",
      de: "Warum lernst du diese Sprache?",
      it: "Perché stai imparando questa lingua?",
      pt: "Por que você está aprendendo este idioma?",
      ro: "De ce înveți limba asta?",
    },
  },
  {
    id: "ib06",
    en: "What is a typical dish from your country that everyone should try?",
    translations: {
      es: "¿Qué plato típico de tu país debería probar todo el mundo?",
      fr: "Quel plat typique de ton pays tout le monde devrait goûter ?",
      de: "Welches typische Gericht aus deinem Land sollte jeder probieren?",
      it: "Quale piatto tipico del tuo paese dovrebbero assaggiare tutti?",
      pt: "Qual prato típico do seu país todo mundo deveria provar?",
      ro: "Ce mâncare tradițională din țara ta ar trebui să încerce toată lumea?",
    },
  },
  {
    id: "ib07",
    en: "What did you do last weekend?",
    translations: {
      es: "¿Qué hiciste el fin de semana pasado?",
      fr: "Qu'est-ce que tu as fait le week-end dernier ?",
      de: "Was hast du letztes Wochenende gemacht?",
      it: "Cosa hai fatto lo scorso fine settimana?",
      pt: "O que você fez no fim de semana passado?",
      ro: "Ce ai făcut weekendul trecut?",
    },
  },
  {
    id: "ib08",
    en: "Which word in your language do you love the most, and why?",
    translations: {
      es: "¿Qué palabra de tu idioma te gusta más y por qué?",
      fr: "Quel est ton mot préféré dans ta langue, et pourquoi ?",
      de: "Welches Wort in deiner Sprache magst du am liebsten und warum?",
      it: "Qual è la parola della tua lingua che ami di più, e perché?",
      pt: "Qual palavra do seu idioma você mais ama, e por quê?",
      ro: "Care e cuvântul tău preferat din limba ta și de ce?",
    },
  },
  {
    id: "ib09",
    en: "What is the best film or series you have watched this year?",
    translations: {
      es: "¿Cuál es la mejor película o serie que has visto este año?",
      fr: "Quel est le meilleur film ou la meilleure série que tu as vu cette année ?",
      de: "Was ist der beste Film oder die beste Serie, die du dieses Jahr gesehen hast?",
      it: "Qual è il film o la serie migliore che hai visto quest'anno?",
      pt: "Qual é o melhor filme ou série que você viu este ano?",
      ro: "Care e cel mai bun film sau serial pe care l-ai văzut anul ăsta?",
    },
  },
  {
    id: "ib10",
    en: "Describe your perfect Sunday.",
    translations: {
      es: "Describe tu domingo perfecto.",
      fr: "Décris ton dimanche idéal.",
      de: "Beschreibe deinen perfekten Sonntag.",
      it: "Descrivi la tua domenica perfetta.",
      pt: "Descreva o seu domingo perfeito.",
      ro: "Descrie-ți duminica perfectă.",
    },
  },
  {
    id: "ib11",
    en: "What is a hobby you would like to start?",
    translations: {
      es: "¿Qué pasatiempo te gustaría empezar?",
      fr: "Quel loisir aimerais-tu commencer ?",
      de: "Mit welchem Hobby würdest du gern anfangen?",
      it: "Quale hobby ti piacerebbe iniziare?",
      pt: "Qual hobby você gostaria de começar?",
      ro: "Ce hobby ți-ar plăcea să începi?",
    },
  },
  {
    id: "ib12",
    en: "What is something that made you smile today?",
    translations: {
      es: "¿Qué te ha hecho sonreír hoy?",
      fr: "Qu'est-ce qui t'a fait sourire aujourd'hui ?",
      de: "Was hat dich heute zum Lächeln gebracht?",
      it: "Cosa ti ha fatto sorridere oggi?",
      pt: "O que fez você sorrir hoje?",
      ro: "Ce te-a făcut să zâmbești azi?",
    },
  },
  {
    id: "ib13",
    en: "Tell us about a festival or holiday you love.",
    translations: {
      es: "Cuéntanos sobre una fiesta o celebración que te encante.",
      fr: "Parle-nous d'une fête ou d'un jour férié que tu adores.",
      de: "Erzähl uns von einem Fest oder Feiertag, den du liebst.",
      it: "Raccontaci di una festa o di una ricorrenza che ami.",
      pt: "Conte sobre uma festa ou feriado que você adora.",
      ro: "Povestește-ne despre o sărbătoare care îți place mult.",
    },
  },
  {
    id: "ib14",
    en: "What does your morning routine look like?",
    translations: {
      es: "¿Cómo es tu rutina por la mañana?",
      fr: "À quoi ressemble ta routine du matin ?",
      de: "Wie sieht deine Morgenroutine aus?",
      it: "Com'è la tua routine del mattino?",
      pt: "Como é a sua rotina pela manhã?",
      ro: "Cum arată rutina ta de dimineață?",
    },
  },
  {
    id: "ib15",
    en: "Which country's culture fascinates you the most?",
    translations: {
      es: "¿La cultura de qué país te fascina más?",
      fr: "La culture de quel pays te fascine le plus ?",
      de: "Die Kultur welchen Landes fasziniert dich am meisten?",
      it: "La cultura di quale paese ti affascina di più?",
      pt: "A cultura de qual país mais te fascina?",
      ro: "Cultura cărei țări te fascinează cel mai mult?",
    },
  },
  {
    id: "ib16",
    en: "What is the funniest mistake you have made in a foreign language?",
    translations: {
      es: "¿Cuál es el error más gracioso que has cometido en un idioma extranjero?",
      fr: "Quelle est l'erreur la plus drôle que tu as faite dans une langue étrangère ?",
      de: "Was war dein lustigster Fehler in einer Fremdsprache?",
      it: "Qual è l'errore più divertente che hai fatto in una lingua straniera?",
      pt: "Qual foi o erro mais engraçado que você já cometeu em uma língua estrangeira?",
      ro: "Care e cea mai amuzantă greșeală pe care ai făcut-o într-o limbă străină?",
    },
  },
  {
    id: "ib17",
    en: "If you could have dinner with anyone, who would it be?",
    translations: {
      es: "Si pudieras cenar con cualquier persona, ¿con quién sería?",
      fr: "Si tu pouvais dîner avec n'importe qui, ce serait avec qui ?",
      de: "Wenn du mit irgendjemandem zu Abend essen könntest, wer wäre es?",
      it: "Se potessi cenare con chiunque, chi sceglieresti?",
      pt: "Se você pudesse jantar com qualquer pessoa, quem seria?",
      ro: "Dacă ai putea lua cina cu oricine, cine ar fi?",
    },
  },
  {
    id: "ib18",
    en: "What is the weather like where you are right now?",
    translations: {
      es: "¿Qué tiempo hace donde estás ahora mismo?",
      fr: "Quel temps fait-il chez toi en ce moment ?",
      de: "Wie ist das Wetter gerade bei dir?",
      it: "Che tempo fa dove sei adesso?",
      pt: "Como está o tempo onde você está agora?",
      ro: "Cum e vremea acolo unde ești acum?",
    },
  },
  {
    id: "ib19",
    en: "What is a book that changed the way you think?",
    translations: {
      es: "¿Qué libro cambió tu forma de pensar?",
      fr: "Quel livre a changé ta façon de penser ?",
      de: "Welches Buch hat deine Denkweise verändert?",
      it: "Quale libro ha cambiato il tuo modo di pensare?",
      pt: "Qual livro mudou a sua forma de pensar?",
      ro: "Ce carte ți-a schimbat felul de a gândi?",
    },
  },
  {
    id: "ib20",
    en: "What would your dream job be?",
    translations: {
      es: "¿Cuál sería el trabajo de tus sueños?",
      fr: "Quel serait le métier de tes rêves ?",
      de: "Was wäre dein Traumjob?",
      it: "Quale sarebbe il lavoro dei tuoi sogni?",
      pt: "Qual seria o emprego dos seus sonhos?",
      ro: "Care ar fi jobul tău de vis?",
    },
  },
  {
    id: "ib21",
    en: "Which place in your city would you show a visitor first?",
    translations: {
      es: "¿Qué lugar de tu ciudad le enseñarías primero a un visitante?",
      fr: "Quel endroit de ta ville montrerais-tu en premier à un visiteur ?",
      de: "Welchen Ort in deiner Stadt würdest du einem Besucher zuerst zeigen?",
      it: "Quale posto della tua città mostreresti per primo a un visitatore?",
      pt: "Que lugar da sua cidade você mostraria primeiro a um visitante?",
      ro: "Ce loc din orașul tău i-ai arăta primul unui vizitator?",
    },
  },
  {
    id: "ib22",
    en: "What is a small habit that makes your day better?",
    translations: {
      es: "¿Qué pequeño hábito hace que tu día sea mejor?",
      fr: "Quelle petite habitude rend ta journée meilleure ?",
      de: "Welche kleine Gewohnheit macht deinen Tag besser?",
      it: "Quale piccola abitudine rende migliore la tua giornata?",
      pt: "Que pequeno hábito deixa o seu dia melhor?",
      ro: "Ce obicei mic îți face ziua mai bună?",
    },
  },
  {
    id: "ib23",
    en: "Do you prefer the mountains or the sea? Why?",
    translations: {
      es: "¿Prefieres la montaña o el mar? ¿Por qué?",
      fr: "Tu préfères la montagne ou la mer ? Pourquoi ?",
      de: "Magst du lieber die Berge oder das Meer? Warum?",
      it: "Preferisci la montagna o il mare? Perché?",
      pt: "Você prefere a montanha ou o mar? Por quê?",
      ro: "Preferi muntele sau marea? De ce?",
    },
  },
  {
    id: "ib24",
    en: "What is the best advice you have ever received?",
    translations: {
      es: "¿Cuál es el mejor consejo que te han dado?",
      fr: "Quel est le meilleur conseil qu'on t'ait jamais donné ?",
      de: "Was ist der beste Rat, den du je bekommen hast?",
      it: "Qual è il miglior consiglio che tu abbia mai ricevuto?",
      pt: "Qual é o melhor conselho que você já recebeu?",
      ro: "Care e cel mai bun sfat pe care l-ai primit vreodată?",
    },
  },
  {
    id: "ib25",
    en: "What did you want to be when you were a child?",
    translations: {
      es: "¿Qué querías ser de pequeño?",
      fr: "Que voulais-tu faire quand tu étais enfant ?",
      de: "Was wolltest du als Kind werden?",
      it: "Cosa volevi fare da grande quando eri bambino?",
      pt: "O que você queria ser quando era criança?",
      ro: "Ce voiai să te faci când erai copil?",
    },
  },
  {
    id: "ib26",
    en: "Which app or tool helps you the most when learning languages?",
    translations: {
      es: "¿Qué aplicación o herramienta te ayuda más a aprender idiomas?",
      fr: "Quelle application ou quel outil t'aide le plus à apprendre des langues ?",
      de: "Welche App oder welches Hilfsmittel hilft dir am meisten beim Sprachenlernen?",
      it: "Quale app o strumento ti aiuta di più a imparare le lingue?",
      pt: "Qual aplicativo ou ferramenta mais te ajuda a aprender idiomas?",
      ro: "Ce aplicație sau unealtă te ajută cel mai mult să înveți limbi?",
    },
  },
  {
    id: "ib27",
    en: "Tell us about a trip you will never forget.",
    translations: {
      es: "Cuéntanos sobre un viaje que nunca olvidarás.",
      fr: "Parle-nous d'un voyage que tu n'oublieras jamais.",
      de: "Erzähl uns von einer Reise, die du nie vergessen wirst.",
      it: "Raccontaci di un viaggio che non dimenticherai mai.",
      pt: "Conte sobre uma viagem que você nunca vai esquecer.",
      ro: "Povestește-ne despre o călătorie pe care n-o vei uita niciodată.",
    },
  },
  {
    id: "ib28",
    en: "What is something you are proud of this month?",
    translations: {
      es: "¿De qué estás orgulloso este mes?",
      fr: "De quoi es-tu fier ce mois-ci ?",
      de: "Worauf bist du diesen Monat stolz?",
      it: "Di cosa sei orgoglioso questo mese?",
      pt: "Do que você se orgulha neste mês?",
      ro: "Cu ce te mândrești luna asta?",
    },
  },
  {
    id: "ib29",
    en: "Coffee or tea? How do you like it?",
    translations: {
      es: "¿Café o té? ¿Cómo te gusta?",
      fr: "Café ou thé ? Comment tu l'aimes ?",
      de: "Kaffee oder Tee? Wie trinkst du ihn am liebsten?",
      it: "Caffè o tè? Come ti piace?",
      pt: "Café ou chá? Como você gosta?",
      ro: "Cafea sau ceai? Cum îți place?",
    },
  },
  {
    id: "ib30",
    en: "What would you like to learn to cook?",
    translations: {
      es: "¿Qué te gustaría aprender a cocinar?",
      fr: "Qu'est-ce que tu aimerais apprendre à cuisiner ?",
      de: "Was würdest du gern kochen lernen?",
      it: "Cosa ti piacerebbe imparare a cucinare?",
      pt: "O que você gostaria de aprender a cozinhar?",
      ro: "Ce ți-ar plăcea să înveți să gătești?",
    },
  },
];

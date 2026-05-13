export type UserInput = {
  detectiveName: string;
  setting: string;
  hobby: string;
  premise: string;
  numChapters: number;
  wordsPerChapter: number;
};

export type Character = {
  name: string;
  role: "detective" | "victim" | "suspect" | "ally" | "minor";
  age: number;
  occupation: string;
  datedFacts: string[];
  voiceTraits: string[];
  visualTags: string[];
  wants: string;
  fears: string;
  secret: string;
  alibi?: string;
  motive?: string;
  isGuilty?: boolean;
};

export type Clue = {
  id: string;
  description: string;
  plantedInChapter: number;
  payoffInChapter: number;
  isRedHerring: boolean;
  meaning: string;
};

export type Relationship = {
  characters: [string, string];
  seams: string[];
};

export type OpeningTechnique =
  | "sensory_immersion"
  | "character_action"
  | "dialogue_cold_open"
  | "interior_monologue"
  | "atmospheric_wrongness"
  | "singular_object"
  | "physical_sensation"
  | "environmental_contrast";

export type EndingTechnique =
  | "image"
  | "question"
  | "stated_intent"
  | "dialogue_cliff"
  | "realization"
  | "action_mid_motion"
  | "emotional_beat"
  | "singular_object";

export type ChapterOutline = {
  chapterNumber: number;
  title: string;
  oneSentenceSummary: string;
  primaryScene: string;
  charactersPresent: string[];
  cluesPlanted: string[];
  cluesReferenced: string[];
  emotionalBeat: string;
  openingTechnique: OpeningTechnique;
  endingTechnique: EndingTechnique;
};

export type BookBible = {
  title: string;
  subtitle?: string;
  setting: {
    townName: string;
    region: string;
    timeOfYear: string;
    atmosphere: string;
    keyLocations: { name: string; description: string }[];
  };
  characters: Character[];
  relationships: Relationship[];
  mystery: {
    crime: string;
    truth: string;
    misleadingTruth: string;
    clues: Clue[];
  };
  themes: string[];
  vocabularyPalette: string[];
  chapterOutlines: ChapterOutline[];
};

export type GeneratedChapter = {
  chapterNumber: number;
  title: string;
  text: string;
  wordCount: number;
};

export type ChapterSummary = {
  chapterNumber: number;
  summary: string;
  vocabularyUsed: string[];
};

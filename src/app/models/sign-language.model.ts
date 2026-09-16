export interface SignLanguage {
  code: string;
  name: string;
  locale: string;
  region: string;
  description: string;
}

export const SIGN_LANGUAGES: SignLanguage[] = [
  {
    code: 'isl',
    name: 'Indian Sign Language',
    locale: 'en-IN',
    region: 'India',
    description: 'Counter vocabulary with Indian English speech output'
  },
  {
    code: 'asl',
    name: 'American Sign Language',
    locale: 'en-US',
    region: 'United States and Canada',
    description: 'Counter vocabulary with US English speech output'
  },
  {
    code: 'bsl',
    name: 'British Sign Language',
    locale: 'en-GB',
    region: 'United Kingdom',
    description: 'Counter vocabulary with UK English speech output'
  },
  {
    code: 'auslan',
    name: 'Auslan',
    locale: 'en-AU',
    region: 'Australia',
    description: 'Counter vocabulary with Australian English speech output'
  },
  {
    code: 'lsf',
    name: 'French Sign Language',
    locale: 'fr-FR',
    region: 'France and French-speaking communities',
    description: 'Counter vocabulary with French speech output'
  }
];

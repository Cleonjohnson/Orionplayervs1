/**
 * JamRock Charades - Game Data
 * 3 categories with words and theme colors
 */

export const CHARADES_PACKS = [
  {
    id: 'pickney',
    name: 'Pickney Ting',
    subtitle: 'Toddlers / Family',
    color: '#4CAF50',
    requiresAgeGate: false,
    words: [
      'Patty',
      'School Bus',
      'Goat',
      'Doctor Bird',
      'Usain Bolt',
      'Mango',
      'Dumpling',
    ],
  },
  {
    id: 'yardie',
    name: 'Yardie Vibes',
    subtitle: 'Teen / General',
    color: '#FFC107',
    requiresAgeGate: false,
    words: [
      'Half Way Tree',
      'Dimbokro',
      'Oxtail',
      'Bad Mind',
      'Taxi Man',
      'Dancehall Queen',
      'Portmore',
    ],
  },
  {
    id: 'bigpeople',
    name: 'Big People Ting',
    subtitle: '18+ Adult',
    color: '#D32F2F',
    requiresAgeGate: true,
    words: [
      'Daggering',
      'Bedroom Bully',
      'Joe Grind',
      'Matey',
      'Good Body Gal',
    ],
  },
];

/**
 * Yardie Hustle - Jobs, Events, Cash Pot (Educational/Funny)
 */

// ----- JOBS -----
// reqLevel = level to unlock (1 = start). promoteCost = JMD to promote TO this job
export const JOBS = [
  { id: 'wiper', title: 'Windshield Wiper', payRate: 10, reqLevel: 1, promoteCost: 0 },
  { id: 'bagjuice', title: 'Bag Juice Vendor', payRate: 50, reqLevel: 2, promoteCost: 200 },
  { id: 'handcart', title: 'Handcart Man', payRate: 150, reqLevel: 3, promoteCost: 800 },
  { id: 'taxi', title: 'Robot Taxi Driver', payRate: 500, reqLevel: 4, promoteCost: 3000 },
  { id: 'sound', title: 'Sound System Operator', payRate: 2000, reqLevel: 5, promoteCost: 15000 },
  { id: 'producer', title: 'Dancehall Producer', payRate: 10000, reqLevel: 6, promoteCost: 80000 },
  { id: 'mp', title: 'MP for St. Andrew', payRate: 50000, reqLevel: 7, promoteCost: 400000 },
];

// ----- EVENTS (Random scenarios) -----
export const EVENTS = [
  {
    id: 'beggy',
    text: 'Beggy Beggy approach yuh!',
    choices: [
      { text: 'Gi him a smalls', effect: { money: -100, karma: 10 } },
      { text: 'Cut yuh eye', effect: { money: 0, karma: -5 } },
    ],
  },
  {
    id: 'police',
    text: 'Police Stop & Search!',
    choices: [
      { text: 'Run!', randomOutcome: true, escapeChance: 0.5, effectEscape: { money: 0 }, effectCaught: { money: -500, karma: -10 } },
      { text: 'Talk nice', effect: { money: -50, karma: 5 } },
    ],
  },
  {
    id: 'powercut',
    text: 'Power Cut! JPS strike again.',
    blockWorkSeconds: 10,
    choices: [{ text: 'Sigh. Wait it out.', effect: {} }],
  },
  {
    id: 'cashpot_rat',
    text: 'Cash Pot Dream: You dream of a big Rat.',
    hint: 'Bet on #15 (Rat).',
    choices: [{ text: 'Noted!', effect: {} }],
  },
  {
    id: 'boxfood',
    text: 'Box Food vendor pass by. Smell good!',
    choices: [
      { text: 'Buy one ($80)', effect: { money: -80, energy: 30 } },
      { text: 'Walk pass', effect: {} },
    ],
  },
  {
    id: 'digicel',
    text: 'Digicel Credit finish! No data.',
    choices: [
      { text: 'Top up $100', effect: { money: -100 } },
      { text: 'Use free WiFi', effect: { karma: -2 } },
    ],
  },
  {
    id: 'taxi_fare',
    text: 'Route taxi driver charge double fare!',
    choices: [
      { text: 'Pay di man', effect: { money: -100 } },
      { text: 'Argue & walk', effect: { karma: -5, energy: -10 } },
    ],
  },
  {
    id: 'lotto',
    text: 'Yuh find $50 on di ground.',
    choices: [
      { text: 'Keep it', effect: { money: 50 } },
      { text: 'Give to beggar', effect: { money: -50, karma: 15 } },
    ],
  },
  {
    id: 'rain',
    text: 'Rain fall! No customers.',
    choices: [{ text: 'Wait it out', effect: { money: -20 } }],
  },
  {
    id: 'customer',
    text: 'Big customer give yuh tip!',
    choices: [{ text: 'Bless up', effect: { money: 200, karma: 5 } }],
  },
  {
    id: 'duppy_dream',
    text: 'Yuh dream of Duppy! Cash Pot hint.',
    hint: 'Bet on #1 (Duppy).',
    choices: [{ text: 'Noted!', effect: {} }],
  },
  {
    id: 'old_lady_dream',
    text: 'Cash Pot Dream: Yuh see Old Lady.',
    hint: 'Bet on #36 (Old Lady).',
    choices: [{ text: 'Bless', effect: {} }],
  },
  {
    id: 'scammer',
    text: 'Man want sell yuh "gold chain" cheap!',
    choices: [
      { text: 'Buy it ($200)', effect: { money: -200, karma: -10 } },
      { text: 'Walk pass', effect: { karma: 5 } },
    ],
  },
  {
    id: 'lotto_win',
    text: 'Yuh scratch card win $100!',
    choices: [{ text: 'Collect', effect: { money: 100 } }],
  },
  {
    id: 'broke_taxi',
    text: 'Taxi break down. Yuh lose half day.',
    choices: [{ text: 'Sigh', effect: { money: -50, energy: -20 } }],
  },
  {
    id: 'viral_video',
    text: 'Yuh video go viral! Brand want pay yuh.',
    choices: [
      { text: 'Take deal ($500)', effect: { money: 500, karma: 5 } },
      { text: 'Nuh sell out', effect: { karma: 15 } },
    ],
  },
  {
    id: 'rain_again',
    text: 'Rain fall again! Nobody on street.',
    choices: [{ text: 'Wait', effect: { money: -30 } }],
  },
  {
    id: 'police_bribe',
    text: 'Officer say "Yuh need permit." Hint hint.',
    choices: [
      { text: 'Gi him smalls ($100)', effect: { money: -100, karma: -15 } },
      { text: 'Ask for receipt', effect: { money: -150, karma: 5 } },
    ],
  },
  {
    id: 'church_donation',
    text: 'Church sister ask fi donation.',
    choices: [
      { text: 'Gi $50', effect: { money: -50, karma: 15 } },
      { text: 'Next time', effect: { karma: -5 } },
    ],
  },
  {
    id: 'patty_vendor',
    text: 'Patty vendor have buy-one-get-one!',
    choices: [
      { text: 'Buy two ($150)', effect: { money: -150, energy: 25 } },
      { text: 'One only', effect: { money: -80, energy: 15 } },
    ],
  },
  {
    id: 'taxi_wreck',
    text: 'Route taxi inna accident! Yuh late fi work.',
    choices: [
      { text: 'Walk (free)', effect: { energy: -25 } },
      { text: 'Take next taxi ($80)', effect: { money: -80 } },
    ],
  },
  {
    id: 'friend_borrow',
    text: 'Bredrin want borrow $200. "Mi pay yuh back Friday."',
    choices: [
      { text: 'Lend it', effect: { money: -200, karma: 10 } },
      { text: 'Mi nuh have it', effect: { karma: -5 } },
    ],
  },
  {
    id: 'sweepstakes',
    text: 'Yuh name draw fi $300 sweepstakes!',
    choices: [{ text: 'Collect', effect: { money: 300 } }],
  },
  {
    id: 'duppy_dream_dog',
    text: 'Cash Pot Dream: Yuh see Dog.',
    hint: 'Bet on #11 (Dog).',
    choices: [{ text: 'Noted!', effect: {} }],
  },
  {
    id: 'bend_down_plaza',
    text: 'Bend Down Plaza have sale! Everything $100.',
    choices: [
      { text: 'Buy something ($100)', effect: { money: -100, karma: 0 } },
      { text: 'Walk pass', effect: {} },
    ],
  },
  {
    id: 'red_stripe_can',
    text: 'Yuh find empty Red Stripe can. Cash Pot?',
    hint: 'Some say can = #4 (Egg).',
    choices: [{ text: 'Maybe', effect: {} }],
  },
  {
    id: 'jps_bill',
    text: 'JPS bill come! $2000. Yuh never use so much.',
    choices: [
      { text: 'Pay it', effect: { money: -2000 } },
      { text: 'Pay half', effect: { money: -1000, karma: -10 } },
    ],
  },
  {
    id: 'lime_invite',
    text: 'Friend invite yuh to lime. Cover $150.',
    choices: [
      { text: 'Go lime', effect: { money: -150, karma: 10 } },
      { text: 'Next time', effect: { karma: 0 } },
    ],
  },
  {
    id: 'duppy_egg',
    text: 'Cash Pot Dream: Yuh see Egg roll down hill.',
    hint: 'Bet on #4 (Egg).',
    choices: [{ text: 'Noted!', effect: {} }],
  },
  {
    id: 'patty_man',
    text: 'Patty man shout "Hot! Fresh! Best in di land!" Yuh belly growl.',
    choices: [
      { text: 'Buy beef patty ($120)', effect: { money: -120, energy: 20 } },
      { text: 'Walk pass. Stay strong.', effect: {} },
    ],
  },
  {
    id: 'beggy_returns',
    text: 'Same beggy from yesterday. "Mi remember yuh. Yuh kind."',
    choices: [
      { text: 'Gi him $50 again', effect: { money: -50, karma: 15 } },
      { text: 'Today mi nuh have', effect: { karma: -3 } },
    ],
  },
  {
    id: 'robot_traffic',
    text: 'Robot traffic! Yuh stuck for 2 hours. No customers.',
    choices: [{ text: 'Sigh. Listen to radio.', effect: { money: -30, energy: -15 } }],
  },
  {
    id: 'lotto_dream',
    text: 'Yuh dream yuh win Lotto! Cash Pot say play #22.',
    hint: 'Some play #22 (Two Two).',
    choices: [{ text: 'Maybe next time', effect: {} }],
  },
  {
    id: 'sound_clash',
    text: 'Sound clash round di corner! Entry $200. Big prize.',
    choices: [
      { text: 'Go try yuh luck', effect: { money: -200, karma: 0 } },
      { text: 'Stay home. Save money.', effect: {} },
    ],
  },
  {
    id: 'old_lady_bless',
    text: 'Old lady drop $500. Yuh see it. Nobody else.',
    choices: [
      { text: 'Return it', effect: { karma: 25 } },
      { text: 'Pick it up. She never notice.', effect: { money: 500, karma: -20 } },
    ],
  },
  {
    id: 'digicel_promo',
    text: 'Digicel have promo! Double credit today only.',
    choices: [
      { text: 'Top up $200', effect: { money: -200 } },
      { text: 'Skip. Mi have enough.', effect: {} },
    ],
  },
  {
    id: 'box_food_special',
    text: 'Box food vendor have "Buy 2 get 1 free"! Rice and peas, oxtail.',
    choices: [
      { text: 'Buy 2 ($300)', effect: { money: -300, energy: 50 } },
      { text: 'One only ($150)', effect: { money: -150, energy: 25 } },
    ],
  },
  {
    id: 'taxi_wars',
    text: 'Two taxi man argue over passenger. Yuh inna middle.',
    choices: [
      { text: 'Take first one', effect: { money: -80 } },
      { text: 'Walk. Avoid drama.', effect: { energy: -15 } },
    ],
  },
  {
    id: 'church_revival',
    text: 'Church revival next door! All night. Yuh can\'t sleep.',
    choices: [{ text: 'Earplug and try', effect: { energy: -10 } }],
  },
  {
    id: 'neighbour_borrow',
    text: 'Neighbour want borrow $500. "Mi pay yuh back when mi get work."',
    choices: [
      { text: 'Lend it', effect: { money: -500, karma: 12 } },
      { text: 'Mi barely have', effect: { karma: -5 } },
    ],
  },
  {
    id: 'rooster_morning',
    text: 'Neighbour rooster start crow 4 a.m. Every. Single. Day.',
    choices: [{ text: 'Invest in earplug', effect: { money: -50 } }],
  },
  {
    id: 'power_back',
    text: 'JPS finally fix di line! Light come back after 3 days.',
    choices: [{ text: 'Bless. Charge phone.', effect: { karma: 5 } }],
  },
  {
    id: 'bend_down_bargain',
    text: 'Bend Down Plaza have "name yuh price" on one item!',
    choices: [
      { text: 'Try get shoe ($100)', effect: { money: -100, karma: 0 } },
      { text: 'Walk pass', effect: {} },
    ],
  },
  {
    id: 'viral_challenge',
    text: 'Someone tag yuh in viral challenge. "Do it or donate $100."',
    choices: [
      { text: 'Do di challenge', effect: { karma: 10 } },
      { text: 'Donate $100', effect: { money: -100, karma: 15 } },
    ],
  },
  {
    id: 'duppy_ball',
    text: 'Cash Pot Dream: Yuh see Balls (two).',
    hint: 'Bet on #2 (Balls).',
    choices: [{ text: 'Noted!', effect: {} }],
  },
  {
    id: 'jerk_pan',
    text: 'Yuh smell jerk from down di road. Stomach start sing.',
    choices: [
      { text: 'Buy jerk chicken ($250)', effect: { money: -250, energy: 40 } },
      { text: 'Resist. Go home cook.', effect: {} },
    ],
  },
  {
    id: 'taxi_share',
    text: 'Route taxi full. Driver say "Squeeze in! One more nuh hurt."',
    choices: [
      { text: 'Squeeze in ($50)', effect: { money: -50 } },
      { text: 'Wait next one', effect: { energy: -5 } },
    ],
  },
  {
    id: 'scam_offer',
    text: 'Man say "Yuh win trip to Miami! Just pay $500 processing."',
    choices: [
      { text: 'Pay. Sounds legit.', effect: { money: -500, karma: -25 } },
      { text: 'Nuh. Scam.', effect: { karma: 10 } },
    ],
  },
  {
    id: 'birthday_invite',
    text: 'Cousin birthday. Expect present. "Mi know yuh have work."',
    choices: [
      { text: 'Gi $300', effect: { money: -300, karma: 15 } },
      { text: 'Card only', effect: { karma: -5 } },
    ],
  },
  {
    id: 'fish_tea',
    text: 'Rainy day. Fish tea man pass. "Warm yuh soul!"',
    choices: [
      { text: 'Buy one ($100)', effect: { money: -100, energy: 20 } },
      { text: 'Next time', effect: {} },
    ],
  },
  {
    id: 'duppy_old_lady',
    text: 'Cash Pot Dream: Old Lady give yuh blessing.',
    hint: 'Bet on #36 (Old Lady).',
    choices: [{ text: 'Bless up', effect: {} }],
  },
  {
    id: 'oxtail_friday',
    text: 'Friday! Oxtail special $800. Yuh salary just come.',
    choices: [
      { text: 'Treat yuhself', effect: { money: -800, energy: 35 } },
      { text: 'Save it. Cook at home.', effect: {} },
    ],
  },
];

// Add more random events so the game feels less repetitive.
(() => {
  const templates = [
    ['New customer want discount!', ['Gi small discount (-$50)', { money: -50, karma: 5 }], ['Stand firm', { karma: -2 }]],
    ['Phone screen crack! Repair cost.', ['Fix it (-$600)', { money: -600 }], ['Use it cracked', { karma: -3 }]],
    ['Neighbour play loud music all night.', ['Complain', { karma: -2, energy: -5 }], ['Join the vibes', { karma: 6, energy: -8 }]],
    ['You get a quick side job offer.', ['Take it (+$300)', { money: 300, energy: -10 }], ['Skip', {}]],
    ['Rain stop and sun come out—more customers!', ['Work extra (+$150)', { money: 150, energy: -6 }], ['Rest', { energy: 5 }]],
    ['Taxi man offer “special rate”.', ['Take it (-$120)', { money: -120 }], ['Walk', { energy: -12 }]],
    ['Friend invite you to football match.', ['Go (-$200)', { money: -200, karma: 10 }], ['Stay home', {}]],
    ['Scammer call again—“just one code”.', ['Give code', { money: -800, karma: -20 }], ['Hang up', { karma: 6 }]],
    ['You find a $1000 note in old jeans!', ['Keep it (+$1000)', { money: 1000, karma: -5 }], ['Donate', { money: -200, karma: 20 }]],
    ['JPS bill reduction promo (maybe).', ['Apply (-$50)', { money: -50, karma: 2 }], ['Ignore', {}]],
  ];

  const mk = (i) => {
    const t = templates[i % templates.length];
    return {
      id: `gen_${i}`,
      text: t[0],
      choices: [
        { text: t[1][0], effect: t[1][1] },
        { text: t[2][0], effect: t[2][1] },
      ],
    };
  };

  const existing = new Set(EVENTS.map((e) => e.id));
  for (let i = 0; i < 50; i++) {
    const ev = mk(i);
    if (!existing.has(ev.id)) {
      existing.add(ev.id);
      EVENTS.push(ev);
    }
  }
})();

// ----- CASH POT NUMBERS (Educational / Funny) -----
export const CASH_POT_NUMBERS = [
  { number: 1, name: 'Duppy' },
  { number: 2, name: 'Balls' },
  { number: 4, name: 'Egg' },
  { number: 11, name: 'Dog' },
  { number: 15, name: 'Rat' },
  { number: 36, name: 'Old Lady' },
];

// All 36 for roulette draw (simplified: use 1-36)
export const CASH_POT_DRAW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36];

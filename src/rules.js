/* RoadAhead — rule data, fines (Motor Vehicles Act style), and road-sign quiz data */
window.RA = window.RA || {};

/* Shared game constants */
RA.C = {
  W: 480, H: 720,
  ROAD_X: 90, ROAD_W: 300,
  LANES: [140, 240, 340],
  PLAYER_Y: 560,
  PX2M: 1 / 14.4,      // pixels -> metres
  KMH: 0.25,           // px/s -> km/h
  MAXSPD: 320,         // px/s (= 80 km/h)
};

/* Rules of the road. fine = rupees, lp = license points lost, pts = base reward */
RA.RULES = {
  redLight: {
    emoji: '🚦', title: 'Red Light Jumping', fine: 5000, lp: 3, pts: 200,
    sec: 'Sec 184, MV Act',
    good: 'Stopped at the red light',
    bad: 'You jumped a red light!',
    tip: 'Red means STOP behind the white line. Signal jumping is one of the biggest causes of junction crashes in India.',
  },
  zebra: {
    emoji: '🚸', title: 'Not Yielding to Pedestrians', fine: 500, lp: 2, pts: 150,
    sec: 'Sec 183, MV Act',
    good: 'Let pedestrians cross safely',
    bad: 'You cut through a zebra crossing while people were on it!',
    tip: 'Pedestrians have the right of way at zebra crossings. Stop behind the line and wait for them to cross.',
  },
  ambulance: {
    emoji: '🚑', title: 'Blocking an Emergency Vehicle', fine: 10000, lp: 3, pts: 250,
    sec: 'Sec 194E, MV Act',
    good: 'Gave way to the ambulance',
    bad: 'You blocked an ambulance! Someone\'s life may depend on those minutes.',
    tip: 'When you hear a siren, move out of its lane and slow down. Obstructing emergency vehicles costs ₹10,000.',
  },
  overspeed: {
    emoji: '📸', title: 'Overspeeding', fine: 2000, lp: 2, pts: 100,
    sec: 'Sec 183, MV Act',
    good: 'Passed the speed camera within the limit',
    bad: 'Speed camera flash! You were over the limit.',
    tip: 'Speed limits are set for the road, not for your mood. Higher speed = far longer stopping distance.',
  },
  schoolzone: {
    emoji: '🏫', title: 'Speeding in a School Zone', fine: 2000, lp: 3, pts: 200,
    sec: 'Sec 183/184, MV Act',
    good: 'Drove gently through the school zone',
    bad: 'Too fast in a school zone! Children can dart onto the road without warning.',
    tip: 'Keep it under 25 km/h near schools. A child stepping out gives you barely a second to react.',
  },
  silence: {
    emoji: '🔇', title: 'Honking in a Silence Zone', fine: 1000, lp: 2, pts: 150,
    sec: 'Sec 194F, MV Act',
    good: 'Kept quiet near the hospital',
    bad: 'You honked in a hospital silence zone!',
    tip: 'No honking near hospitals, schools and courts. India\'s cities are among the noisiest in the world — be the change.',
  },
  mobile: {
    emoji: '📵', title: 'Using Phone While Driving', fine: 5000, lp: 3, pts: 100,
    sec: 'Sec 184, MV Act',
    good: 'Ignored the call and kept eyes on the road',
    bad: 'You answered a call while driving!',
    tip: 'A phone call quadruples your crash risk. Pull over safely if you must take it.',
  },
  rash: {
    emoji: '💥', title: 'Rash & Negligent Driving', fine: 5000, lp: 3, pts: 0,
    sec: 'Sec 184, MV Act',
    good: '',
    bad: 'You crashed into another vehicle!',
    tip: 'Maintain a safe following distance — at least 2 seconds behind the vehicle ahead. Tailgating causes pile-ups.',
  },
  rail: {
    emoji: '🚂', title: 'Unsafe Railway Crossing', fine: 10000, lp: 3, pts: 300,
    sec: 'Sec 184, MV Act',
    good: 'Waited for the railway gates to open',
    bad: 'You crossed while the railway gates were down! Trains cannot stop for you.',
    tip: 'Never zig-zag past closing gates. A train at speed needs over a kilometre to stop.',
  },
  animal: {
    emoji: '🐄', title: 'Stray Animals on the Road', fine: 0, lp: 0, pts: 50,
    sec: 'Safe driving practice',
    good: 'Slowed down for the animal',
    bad: 'You hit a stray animal!',
    tip: 'Cattle on the road are a daily reality in India. Slow down, never swerve suddenly, and pass with room to spare.',
  },
};

/* Road signs for the quiz + rule book. SVGs follow Indian sign conventions:
   red circle = prohibition, red triangle = caution, blue = information/mandatory. */
(function () {
  const RED = '#c1121f', INK = '#1d1d24', BLUE = '#0a4d9d';
  const circ = inner =>
    `<circle cx="50" cy="50" r="45" fill="#fff" stroke="${RED}" stroke-width="9"/>` + inner;
  const tri = inner =>
    `<polygon points="50,6 96,90 4,90" fill="#fff" stroke="${RED}" stroke-width="8" stroke-linejoin="round"/>` + inner;
  const slash = `<line x1="20" y1="80" x2="80" y2="20" stroke="${RED}" stroke-width="8"/>`;
  const svg = body => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  RA.SIGNS = [
    {
      id: 'stop', name: 'STOP',
      wrong: ['No Entry', 'Give Way'],
      svg: svg(`<polygon points="31,4 69,4 96,31 96,69 69,96 31,96 4,69 4,31" fill="${RED}" stroke="#fff" stroke-width="5"/>
        <text x="50" y="60" font-size="26" fill="#fff" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold">STOP</text>`),
    },
    {
      id: 'giveway', name: 'Give Way',
      wrong: ['STOP', 'Narrow Road Ahead'],
      svg: svg(`<polygon points="8,14 92,14 50,92" fill="#fff" stroke="${RED}" stroke-width="9" stroke-linejoin="round"/>`),
    },
    {
      id: 'noentry', name: 'No Entry',
      wrong: ['No Parking', 'One Way'],
      svg: svg(`<circle cx="50" cy="50" r="45" fill="${RED}"/><rect x="18" y="42" width="64" height="16" rx="3" fill="#fff"/>`),
    },
    {
      id: 'nohorn', name: 'Horn Prohibited',
      wrong: ['Compulsory Horn', 'Loudspeaker Zone'],
      svg: svg(circ(`<path d="M28 44 h14 l16 -14 v40 l-16 -14 h-14 z" fill="${INK}"/>
        <path d="M64 40 q8 10 0 20 M70 34 q13 16 0 32" stroke="${INK}" stroke-width="4" fill="none"/>` + slash)),
    },
    {
      id: 'speed50', name: 'Speed Limit 50',
      wrong: ['National Highway 50', 'Minimum Speed 50'],
      svg: svg(circ(`<text x="50" y="64" font-size="38" fill="${INK}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold">50</text>`)),
    },
    {
      id: 'school', name: 'School Ahead',
      wrong: ['Pedestrian Crossing', 'Playground Ahead'],
      svg: svg(tri(`<circle cx="40" cy="47" r="7" fill="${INK}"/><rect x="35" y="55" width="10" height="20" fill="${INK}"/>
        <circle cx="61" cy="42" r="8" fill="${INK}"/><rect x="55" y="51" width="12" height="26" fill="${INK}"/>
        <line x1="35" y1="62" x2="58" y2="62" stroke="${INK}" stroke-width="4"/>`)),
    },
    {
      id: 'pedestrian', name: 'Pedestrian Crossing',
      wrong: ['School Ahead', 'No Pedestrians'],
      svg: svg(tri(`<circle cx="50" cy="38" r="7" fill="${INK}"/>
        <path d="M50 46 l-9 14 m9 -14 l9 14 m-9 -14 v14 m0 0 l-8 20 m8 -20 l8 20" stroke="${INK}" stroke-width="5" fill="none"/>
        <line x1="20" y1="84" x2="80" y2="84" stroke="${INK}" stroke-width="4" stroke-dasharray="8 5"/>`)),
    },
    {
      id: 'noovertake', name: 'Overtaking Prohibited',
      wrong: ['Two-Way Traffic', 'No Heavy Vehicles'],
      svg: svg(circ(`<rect x="26" y="32" width="16" height="36" rx="5" fill="${RED}"/>
        <rect x="56" y="32" width="16" height="36" rx="5" fill="${INK}"/>`)),
    },
    {
      id: 'nouturn', name: 'U-Turn Prohibited',
      wrong: ['Compulsory U-Turn', 'Right Turn Prohibited'],
      svg: svg(circ(`<path d="M36 72 V46 a14 14 0 0 1 28 0 v18" stroke="${INK}" stroke-width="8" fill="none"/>
        <polygon points="55,62 73,62 64,78" fill="${INK}"/>` + slash)),
    },
    {
      id: 'menatwork', name: 'Men at Work',
      wrong: ['Farm Vehicles Ahead', 'Pedestrian Zone'],
      svg: svg(tri(`<circle cx="45" cy="40" r="7" fill="${INK}"/>
        <path d="M45 48 l-6 22 m6 -22 l10 8 l12 20 M45 48 l14 -4 l10 14" stroke="${INK}" stroke-width="5" fill="none"/>
        <line x1="26" y1="82" x2="74" y2="82" stroke="${INK}" stroke-width="4"/>`)),
    },
    {
      id: 'narrowbridge', name: 'Narrow Bridge Ahead',
      wrong: ['Road Widens Ahead', 'Two-Way Traffic'],
      svg: svg(tri(`<path d="M34 30 q10 22 0 50 M66 30 q-10 22 0 50" stroke="${INK}" stroke-width="6" fill="none"/>`)),
    },
    {
      id: 'railway', name: 'Guarded Railway Crossing',
      wrong: ['Toll Booth Ahead', 'Gate / Barrier Ahead'],
      svg: svg(tri(`<line x1="28" y1="78" x2="72" y2="78" stroke="${INK}" stroke-width="5"/>
        <line x1="34" y1="60" x2="34" y2="78" stroke="${INK}" stroke-width="5"/>
        <line x1="50" y1="60" x2="50" y2="78" stroke="${INK}" stroke-width="5"/>
        <line x1="66" y1="60" x2="66" y2="78" stroke="${INK}" stroke-width="5"/>
        <line x1="28" y1="60" x2="72" y2="60" stroke="${INK}" stroke-width="5"/>`)),
    },
    {
      id: 'oneway', name: 'One Way',
      wrong: ['No Entry', 'Straight Ahead Only'],
      svg: svg(`<rect x="10" y="10" width="80" height="80" rx="10" fill="${BLUE}"/>
        <path d="M50 22 l16 20 h-9 v34 h-14 v-34 h-9 z" fill="#fff"/>`),
    },
    {
      id: 'noparking', name: 'No Parking',
      wrong: ['Parking Allowed', 'No Stopping'],
      svg: svg(circ(`<text x="50" y="66" font-size="44" fill="${BLUE}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="bold">P</text>` + slash)),
    },
  ];
})();

/* License grade by final score */
RA.gradeFor = function (score) {
  if (score < 800)  return { badge: '🛺', name: 'Learner',       line: 'Keep that L-plate on. Practice makes perfect!' };
  if (score < 2500) return { badge: '🚗', name: 'City Cadet',    line: 'You survived the city. The city thanks you.' };
  if (score < 5000) return { badge: '🛣️', name: 'Smart Driver',  line: 'Solid, rule-abiding driving. Respect.' };
  if (score < 9000) return { badge: '🚙', name: 'Highway Pro',   line: 'Smooth, safe and streak-happy.' };
  return               { badge: '🏆', name: 'Road Guru',      line: 'If everyone drove like you, India\'s roads would be silent and safe.' };
};

RA.fmtINR = n => '₹' + n.toLocaleString('en-IN');

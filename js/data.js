// Demo content. Everything lives in memory; nothing leaves the page.
const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;
const now = Date.now();
const at = (daysAgo, h, m) => {
  const d = new Date(now - daysAgo * DAY);
  d.setHours(h, m, 0, 0);
  return d.getTime();
};

export const people = {
  me:    { id: 'me',    name: 'Adam',    handle: 'adam',    hue: 96,  status: 'online', bio: 'Builds the thing. Breaks the thing.' },
  alex:  { id: 'alex',  name: 'Alex',    handle: 'alex',    hue: 212, status: 'online', bio: 'Night owl, map enjoyer.' },
  mel:   { id: 'mel',   name: 'Mel',     handle: 'mel',     hue: 330, status: 'idle',   bio: 'Probably drawing something.' },
  cole:  { id: 'cole',  name: 'Cole',    handle: 'cole',    hue: 18,  status: 'online', bio: 'Ask me about keyboards.' },
  joe:   { id: 'joe',   name: 'Joseph',  handle: 'joseph',  hue: 268, status: 'dnd',    bio: 'Went down the hill. Green dog barked.' },
  jake:  { id: 'jake',  name: 'Jake',    handle: 'jake',    hue: 180, status: 'offline', bio: 'Back soon.' },
  mike:  { id: 'mike',  name: 'Mike',    handle: 'mike',    hue: 140, status: 'online', bio: 'Frog appreciator.' },
  sam:   { id: 'sam',   name: 'Sam Rivera', handle: 'sam',  hue: 160, status: 'online', bio: 'Sound engineer.' },
  morgan:{ id: 'morgan',name: 'Morgan Vale', handle: 'morgan', hue: 250, status: 'idle', bio: 'Community host.' },
};

export const communities = [
  { id: 'server', name: 'Server', hue: 96, members: ['me', 'alex', 'mel', 'cole', 'joe', 'jake', 'mike'], rooms: ['alex-room', 'mel-room', 'cole-room', 'joe-room', 'jake-room', 'mike-room'] },
  { id: 'fieldwork', name: 'Fieldwork', hue: 36, members: ['me', 'sam', 'morgan', 'alex'], rooms: ['lounge', 'build-lab'] },
];

export const rooms = {
  'alex-room': { name: "Alex's Room", owner: 'alex', channels: ['general', 'friday-coop', 'setups', 'meetup', 'voice', 'calendar', 'docs', 'tasks'] },
  'mel-room':  { name: "Mel's Room",  owner: 'mel',  channels: ['mel-chat', 'mel-voice'] },
  'cole-room': { name: "Cole's Room", owner: 'cole', channels: ['cole-chat'] },
  'joe-room':  { name: "Joseph's Room", owner: 'joe', channels: ['joe-chat', 'joe-voice'] },
  'jake-room': { name: "Jake's Room", owner: 'jake', channels: ['jake-chat'] },
  'mike-room': { name: "Mike's Room", owner: 'mike', channels: ['mike-chat'] },
  'lounge':    { name: 'Lounge', owner: 'morgan', channels: ['fw-general', 'fw-voice'] },
  'build-lab': { name: 'Build lab', owner: 'sam', channels: ['fw-build'] },
};

export const channels = {
  general:       { type: 'text', name: 'general', topic: 'Anything goes. Be nice.' },
  'friday-coop': { type: 'text', name: 'Friday Coop', topic: 'Planning the Friday session' },
  setups:        { type: 'text', name: 'Desk setups', topic: 'Show us the battlestation' },
  meetup:        { type: 'text', name: 'Next month’s meetup', topic: 'Dates, places, snacks' },
  voice:         { type: 'voice', name: 'Voice Chat' },
  calendar:      { type: 'calendar', name: 'Calendar' },
  docs:          { type: 'docs', name: 'docs' },
  tasks:         { type: 'tasks', name: 'Tasks' },
  'mel-chat':    { type: 'text', name: 'general', topic: 'Mel’s corner' },
  'mel-voice':   { type: 'voice', name: 'VOICE CHAT' },
  'cole-chat':   { type: 'text', name: 'general', topic: '' },
  'joe-chat':    { type: 'text', name: 'general', topic: '' },
  'joe-voice':   { type: 'voice', name: 'Hangout' },
  'jake-chat':   { type: 'text', name: 'general', topic: '' },
  'mike-chat':   { type: 'text', name: 'ponds', topic: 'Frogs only' },
  'fw-general':  { type: 'text', name: 'General chat', topic: '' },
  'fw-voice':    { type: 'voice', name: 'Lounge' },
  'fw-build':    { type: 'text', name: 'builds', topic: '' },
};

// Who is sitting in each voice channel before you join.
export const voiceOccupants = {
  voice: ['alex', 'cole', 'mike'],
  'fw-voice': ['sam', 'morgan'],
  'mel-voice': [],
  'joe-voice': ['joe'],
};

export const dms = [
  { id: 'dm-alex', with: 'alex', unread: 2 },
  { id: 'dm-mel', with: 'mel', unread: 0 },
  { id: 'dm-cole', with: 'cole', unread: 0 },
];

let seq = 1;
const msg = (author, t, text, extra = {}) => ({ id: seq++, author, t, text, reactions: [], ...extra });
const sys = (kind, t, text, person) => ({ id: seq++, system: kind, t, text, person });

export const messages = {
  general: [
    sys('online', at(2, 9, 8), 'came online', 'mike'),
    sys('online', at(2, 9, 27), 'came online', 'cole'),
    sys('warning', at(2, 9, 31), 'Messages sent while this PC was offline were not delivered'),
    msg('alex', at(1, 18, 2), 'anyone up for the friday session? thinking we try the **new map** first'),
    msg('cole', at(1, 18, 4), 'yes. bringing snacks this time, promise', { reactions: [{ e: '🍿', users: ['alex', 'mike'] }] }),
    msg('mike', at(1, 18, 5), 'frogs will be present 🐸'),
    sys('online', at(0, 9, 12), 'came online', 'mel'),
    msg('mel', at(0, 9, 40), 'made a quick poster for friday, what do we think', {
      attachments: [{ kind: 'image', name: 'friday-poster.png', art: 'poster' }],
      reactions: [{ e: '🔥', users: ['alex', 'cole', 'me'] }, { e: '😍', users: ['mike'] }],
    }),
    msg('alex', at(0, 9, 44), 'that is sick. pin it', { reply: 'prev' }),
    msg('me', at(0, 10, 2), 'Pinned. Also pushed the screenshare fix — should be **smooth 60** now. If anything stutters, tell me the codec.'),
    msg('cole', at(0, 10, 5), 'testing tonight. here’s the config I’m using:\n```\ncodec   = vp9\nfps     = 60\nquality = balanced\n```'),
    msg('joe', at(0, 10, 11), 'went down the hill, green dog barked. anyway count me in', { reactions: [{ e: '😂', users: ['me', 'alex', 'mel', 'cole'] }] }),
    msg('alex', at(0, 10, 16), 'Friday plan lives here → https://krypt.example/fieldwork/friday'),
  ],
  'friday-coop': [
    msg('alex', at(3, 20, 1), 'Friday co-op thread. Post times you can make it.'),
    msg('mike', at(3, 20, 7), '8pm works'),
    msg('cole', at(3, 20, 9), '8 too'),
  ],
  setups: [
    msg('cole', at(4, 14, 2), 'new desk, finally cable managed', { attachments: [{ kind: 'image', name: 'desk.jpg', art: 'desk' }] }),
    msg('mel', at(4, 14, 10), 'the lighting!!'),
  ],
  meetup: [msg('morgan', at(6, 11, 0), 'Next month’s meetup — suggest a date on the calendar.')],
  'mel-chat': [msg('mel', at(2, 22, 13), 'we’re not friends (jk)')],
  'cole-chat': [msg('me', at(2, 12, 1), 's')],
  'joe-chat': [msg('me', at(8, 16, 30), 'went down the hill green dog bark for real this time')],
  voice: [
    msg('alex', at(0, 10, 20), 'sharing the new map, tell me if it looks smooth on your end'),
    msg('cole', at(0, 10, 21), 'crystal clear. 60 locked here', { reactions: [{ e: '🔥', users: ['alex'] }] }),
    msg('mike', at(0, 10, 22), 'muted, eating 🐸'),
  ],
  'jake-chat': [], 'mike-chat': [msg('mike', at(1, 7, 3), '🐸')],
  'fw-general': [msg('morgan', at(1, 11, 16), 'Welcome to Fieldwork.')],
  'fw-build': [msg('sam', at(0, 8, 0), 'Build lab is open.')],
  'dm-alex': [
    msg('alex', at(0, 11, 2), 'hey did the stutter fix land?'),
    msg('alex', at(0, 11, 3), 'mine looked perfect last night'),
  ],
  'dm-mel': [msg('mel', at(2, 9, 0), 'np')],
  'dm-cole': [msg('cole', at(3, 19, 0), 'gg')],
};

export const lastVisit = { general: at(0, 9, 42) };
// Pins reference messages by id, oldest first.
export const pinned = { general: [messages.general.find((m) => m.attachments).id] };

// Community roles and invites (shown in Community settings).
export const roles = { me: 'Owner', alex: 'Admin', morgan: 'Owner', sam: 'Admin', mel: 'Member', cole: 'Member', joe: 'Member', jake: 'Guest', mike: 'Member' };
export const rolePerms = {
  Owner: ['rooms', 'invite', 'pin', 'share', 'remove'],
  Admin: ['rooms', 'invite', 'pin', 'share', 'remove'],
  Member: ['invite', 'pin', 'share'],
  Guest: ['share'],
};
export const invites = [
  { id: 'server-h8uv2sv5', community: 'server', by: 'alex', uses: 3, expires: 'in 5 days' },
  { id: 'server-q2m9x0aa', community: 'server', by: 'me', uses: 0, expires: 'never' },
  { id: 'fieldwork-7kd2pp1w', community: 'fieldwork', by: 'morgan', uses: 12, expires: 'in 1 day' },
];

// Days are counted from today; the co-op always lands on the coming Friday.
const toFriday = (5 - new Date().getDay() + 7) % 7;
export const events = [
  { day: toFriday, h: 20, title: 'Friday co-op', who: ['alex', 'cole', 'mike', 'me'], hue: 0 },
  { day: 2, h: 19, title: 'Map night', who: ['mel', 'joe'], hue: 220 },
  { day: 5, h: 21, title: 'Movie watch party', who: ['alex', 'mel', 'me'], hue: 280 },
  { day: 9, h: 18, title: 'Build lab demo', who: ['sam', 'me'], hue: 150 },
  { day: 13, h: 12, title: 'Meetup planning', who: ['morgan', 'alex'], hue: 30 },
  { day: -3, h: 20, title: 'Retro night', who: ['cole', 'mike'], hue: 190 },
];

export const doc = {
  title: 'Friday co-op — plan',
  updated: at(0, 10, 12),
  editors: ['alex', 'me', 'cole'],
  html: `<h2>Goals</h2>
<p>Try the <strong>new map</strong> first, then the classic rotation. Keep voice on the Voice Chat channel so the share stays in one place.</p>
<h2>Roles</h2>
<ul><li><strong>Alex</strong> — shotcaller</li><li><strong>Cole</strong> — snacks (confirmed)</li><li><strong>Mike</strong> — frogs</li></ul>
<h2>Streaming</h2>
<p>Share at <code>1080p60</code>. VP9 looked sharpest in last week’s tests; H.264 if your GPU is older.</p>
<blockquote>Tip: press <kbd>Ctrl</kbd> + <kbd>K</kbd> and type “share” to start sharing from anywhere.</blockquote>`,
};

export const tasks = {
  columns: [
    { id: 'todo', name: 'To do' },
    { id: 'doing', name: 'In progress' },
    { id: 'done', name: 'Done' },
  ],
  items: [
    { id: 't1', col: 'todo', title: 'Book the Friday slot', who: 'alex', tag: 'Plan' },
    { id: 't2', col: 'todo', title: 'Make the poster bigger', who: 'mel', tag: 'Art' },
    { id: 't3', col: 'doing', title: 'Test 1440p share on VP9', who: 'me', tag: 'Tech' },
    { id: 't4', col: 'doing', title: 'Buy snacks', who: 'cole', tag: 'Food' },
    { id: 't5', col: 'done', title: 'Fix the 1 fps stutter', who: 'me', tag: 'Tech' },
    { id: 't6', col: 'done', title: 'Pick a map', who: 'joe', tag: 'Plan' },
  ],
};

export const shareSources = [
  { id: 'screen1', kind: 'screen', name: 'Entire screen', detail: 'Display 1 · 2560 × 1440 · 144 Hz', img: 'assets/shares/code-editor.png' },
  { id: 'game', kind: 'window', name: 'Tactical Ops', detail: 'Game window', img: 'assets/shares/tactical-game.png' },
  { id: 'cinema', kind: 'window', name: 'Cinema player', detail: 'Video', img: 'assets/shares/cinema-player.png' },
  { id: 'design', kind: 'window', name: 'Design tool', detail: 'App window', img: 'assets/shares/design-tool.png' },
];

export const devices = [
  { id: 'd1', name: 'Windows desktop', detail: 'Krypt 6.0.38 · this is where your keys were made', icon: 'laptop', current: false, seen: 'Active now' },
  { id: 'd2', name: 'This browser', detail: 'Krypt Web · linked from Windows desktop', icon: 'globe', current: true, seen: 'This device' },
  { id: 'd3', name: 'Pixel 9', detail: 'Krypt Web · installed app', icon: 'phoneDevice', current: false, seen: '2 days ago' },
];

export const TIME = { MIN, HOUR, DAY, now };

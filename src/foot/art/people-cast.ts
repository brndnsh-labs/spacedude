/**
 * Who there is: each person's hand-drawn head and torso for the three ways they can face (toward us, away,
 * and to the right; left is the mirror), their colours and their measurements. The letters are explained in
 * people-rig.ts (MATERIAL); people.ts says how to add someone.
 *
 * In every grid the light comes from above and a little to the right: the left edge of a thing is its shadow
 * letter, the right edge its light one. Heads are 14 wide. A torso's outer columns, from the second row down,
 * are the dark line between body and arm.
 */
import { PAL } from '../../art/palette';
import type { Look, Pose, Sheet } from './people-rig';
import { STAND } from './people-rig';

const still = (over: Partial<Pose> = {}): Pose => ({ ...STAND, ...over });
/** `n` frames of the same pose. */
const hold = (n: number, over: Partial<Pose> = {}): Pose[] => Array.from({ length: n }, () => still(over));

const BRASS = [PAL.amber[1], PAL.amber[2], PAL.amber[4], PAL.amber[6]] as const;
const LEATHER = [PAL.wood[0], PAL.wood[1], PAL.wood[2], PAL.wood[4]] as const;

/* ---------- the captain ---------- */

/** A long brown coat that has seen some weather, a scarf, grey coming in at the temples. */
const player: Look = {
  ramps: {
    skin: PAL.skin[2],
    hair: ['#1a1423', '#2b1f3b', '#3a2f45', '#666082'],
    coat: [PAL.wood[1], PAL.wood[2], PAL.wood[3], PAL.wood[5]],
    shirt: [PAL.bone[2], PAL.bone[3], PAL.bone[4], PAL.bone[5]],
    extra: [PAL.leaf[1], PAL.leaf[2], PAL.leaf[3], PAL.leaf[5]],
    pants: [PAL.steel[0], PAL.steel[1], PAL.steel[2], PAL.steel[3]],
    boots: [PAL.night[2], PAL.wood[0], PAL.wood[1], PAL.wood[2]],
    trim: LEATHER,
    metal: BRASS,
  },
  // 1 is the grey at the temples, 2 a day's stubble
  more: { '1': PAL.steel[4], '2': '#a9826f' },
  top: 3, neck: 13, hip: 21,
  arm: 2, armLen: 9, leg: 3, stance: 2,
  coat: { hem: 26, open: true },
  head: {
    down: [
      '.....jhHHh....',
      '...jhhhHHHhh..',
      '..jhhHHhhHHHh.',
      '.jhhhhjhhhhHh.',
      '.j1zshhsSSs1h.',
      '.jzsesSSseSsh.',
      '.jzsesSSseSsj.',
      '..zssszsSSss..',
      '..22sszzss22..',
      '...222ss222...',
    ],
    up: [
      '.....jhHHh....',
      '...jhhhHHHhh..',
      '..jhhHHhhHHHh.',
      '.jhhhhhhhhHHh.',
      '.jhhjhhhhjhhh.',
      '.j1hhjhhhhjhh.',
      '.zj1hjhhhhj1s.',
      '..jjhhjhhjhj..',
      '...jjhhhhjj...',
      '....zzssss....',
    ],
    side: [
      '.....jhHHh....',
      '...jhhhHHHhh..',
      '..jhhhHHhHHHh.',
      '.jhhhhhhhhhHh.',
      '.jhhhhh1zsshh.',
      '.jhhhh1SsseS..',
      '.jjhhjzssseSS.',
      '..jjjzzssssS..',
      '....z222ssz...',
      '.....2222s....',
    ],
  },
  torso: {
    down: [
      '.xvuuUUvC.',
      'ccvuuuUvcC',
      'XcCvuUXcCX',
      'XccXuvtcCX',
      'XccXuvtcCX',
      'XccytttcCX',
      'XcxnaAnxCX',
      'XcxqppPxCX',
    ],
    up: [
      '.xuuuuUUC.',
      'ccccccccCC',
      'XccccccCCX',
      'XxxxxxxxcX',
      'XccccxccCX',
      'XccccxccCX',
      'XccccxccCX',
      'XccccxccCX',
    ],
    side: [
      '...vuuU...',
      '..xcvuUU..',
      '.xcccvuUc.',
      'xxcccccCt.',
      'xxcccccCt.',
      'xxcccccCt.',
      'xxcccccna.',
      'xxcccccCp.',
    ],
  },
  idle: [...hold(5), ...hold(3, { bob: 1 }), ...hold(2), still({ eyes: 'shut' }), ...hold(4), ...hold(3, { bob: 1 }), ...hold(2, { eyes: 'right' }), still()],
};

/* ---------- the work broker ---------- */

/** Tall and spare, silver hair swept back, spectacles, a dark frock coat buttoned to the neck. */
const broker: Look = {
  ramps: {
    skin: PAL.skin[0],
    hair: [PAL.steel[2], PAL.steel[4], PAL.steel[6], PAL.steel[8]],
    coat: ['#1a1230', '#2b2440', '#3d3558', '#5a5078'],
    shirt: [PAL.bone[3], PAL.bone[4], PAL.bone[5], PAL.bone[6]],
    extra: [PAL.rust[1], PAL.rust[3], PAL.rust[5], PAL.rust[6]],
    pants: [PAL.night[1], PAL.night[2], PAL.night[3], PAL.night[5]],
    boots: [PAL.night[0], PAL.night[1], PAL.night[3], PAL.night[5]],
    metal: BRASS,
  },
    top: 2, neck: 12, hip: 21,
  arm: 2, armLen: 10, leg: 3, stance: 2,
  cuff: 'shirt',
  coat: { hem: 28, open: false },
  head: {
    down: [
      '.....jhhHh....',
      '...jhhhHHHhh..',
      '..jhhHHhhhHHh.',
      '..jhzssssSShh.',
      '..jzsssSSSSsh.',
      '..jzjjsSSjjsh.',
      '..zaeaggaeas..',
      '...zsszsSSs...',
      '...zhhHHHHhz..',
      '....zshHsz....',
    ],
    up: [
      '.....jhhHh....',
      '...jhhhHHHhh..',
      '..jhhhhhhHHHh.',
      '..jhhhjhhhHhh.',
      '..jhhjhhhjhhh.',
      '..jjhjhhjhhhh.',
      '..zjhhhhjhhhs.',
      '...jjhhhhhhj..',
      '....zjjhhjs...',
      '.....zzsss....',
    ],
    side: [
      '......jhHh....',
      '....jhhHHHhh..',
      '...jhhhHHhhhs.',
      '..jhhhhhhzsSs.',
      '..jjhhhhzssSS.',
      '..jjhhjSsjjjS.',
      '...jjhzssgaea.',
      '....jzzssssSS.',
      '....zzzshHHh..',
      '......zzsshz..',
    ],
  },
  torso: {
    down: [
      '.TtuUtT.',
      'cCtuUtcC',
      'XcCvutCX',
      'XccCxcCX',
      'XcacxaCX',
      'XcccxcCX',
      'XcacxaCX',
      'XcccxcCX',
      'XcccxcCX',
    ],
    up: [
      '.xttTTC.',
      'ccccccCC',
      'XccxccCX',
      'XccxccCX',
      'XccxccCX',
      'XccxccCX',
      'XcaxcaCX',
      'XccxccCX',
      'XccxccCX',
    ],
    side: [
      '..xtTu..',
      '.xccCtu.',
      'xxcccCu.',
      'xxccccC.',
      'xxcccaC.',
      'xxccccC.',
      'xxcccaC.',
      'xxccccC.',
      'xxccccC.',
    ],
  },
  idle: [
    ...hold(4), ...hold(3, { eyes: 'left' }), ...hold(2), ...hold(3, { bob: 1 }), ...hold(2), ...hold(3, { eyes: 'right' }),
    ...hold(2), still({ eyes: 'shut' }), ...hold(3), ...hold(3, { bob: 1 }),
  ],
};

/* ---------- the dock office clerk ---------- */

const BOARD_FRONT = [
  '....cC.',
  '5AAA5C.',
  '5UUU5C.',
  '5UvU5C.',
  '5UUU5c.',
  '5UvU5x.',
  '55sS5..',
];

/** Small, neat, a teal uniform and a peaked cap, and the clipboard never leaves her left arm. */
const clerk: Look = {
  ramps: {
    skin: PAL.skin[1],
    hair: ['#1a1423', '#2e211d', '#4a3328', '#75573f'],
    coat: [PAL.teal[0], PAL.teal[2], PAL.teal[3], PAL.teal[4]],
    shirt: [PAL.bone[3], PAL.bone[4], PAL.bone[5], PAL.bone[6]],
    extra: [PAL.bone[2], PAL.bone[4], PAL.bone[5], PAL.bone[6]],
    pants: ['#16232a', '#233a42', '#35474f', '#4a6068'],
    boots: [PAL.night[0], PAL.night[2], PAL.night[4], PAL.night[6]],
    trim: LEATHER,
    metal: BRASS,
  },
  // 3 is her lips; 5 and 6 the clipboard's wood
  more: { '3': PAL.rust[4], '5': PAL.wood[5], '6': PAL.wood[2] },
  top: 5, neck: 15, hip: 23,
  arm: 2, armLen: 8, leg: 3, stance: 2,
  holds: 'left',
  head: {
    down: [
      '....xcccCC....',
      '..xcccccccCC..',
      '..xaaaaAAaaac.',
      '.dddbbbbbbBBd.',
      '.jhzzzzzzzzhh.',
      '.jzsesSSseSsh.',
      '.jzsesSSseSsh.',
      '.jhsssssSSshh.',
      '.jjzss33sssjh.',
      '...zzsssss....',
    ],
    up: [
      '....xcccCC....',
      '..xcccccccCC..',
      '..xaaaaaaaaac.',
      '..xccccccccC..',
      '.jhhhhhhhhhhh.',
      '.jhhhhhhhhHhh.',
      '.jhhhJJJJhhhh.',
      '.jjhJhHHhJhjh.',
      '..jjJhhhhJjj..',
      '....zJJJJs....',
    ],
    side: [
      '....xcccCC....',
      '..xcccccccC...',
      '..xaaaaaaaaA..',
      '..xcccdddbbbBB',
      '.jhhhhhhzzzz..',
      'JJhhhhzSsseS..',
      'JhJhhhzssseSS.',
      '.JjhhhhsssssS.',
      '...jjhhzss3...',
      '.....jzzss....',
    ],
  },
  torso: {
    down: [
      '.xtTTtC.',
      'aactTcaA',
      'XTcatcCX',
      'XccaccCX',
      'XccaccCX',
      'XccaccCX',
      'XmnaAnmX',
      'XxcxccCX',
      '.XxXxxc.',
    ],
    up: [
      '.xttTTC.',
      'aaccccaA',
      'XcccccCX',
      'XcccccCX',
      'XcccccCX',
      'XcccccCX',
      'XmnnnnmX',
      'XxccccCX',
      '.XxxXxc.',
    ],
    side: [
      '...xtT....',
      '..xcaatT..',
      '.xxccccca.',
      '.xxccccca.',
      '.xxccccca.',
      '.xxccccca.',
      '.xmnnnnnA.',
      '.xxcccccC.',
      '..Xxxxxc..',
    ],
  },
  detail(s: Sheet, view, p) {
    const y = this.neck + 1 + p.bob;
    if (view === 'down') {
      s.stamp(BOARD_FRONT, 12, y);
      if (p.act) {
        // the pen hand comes across to the board
        s.stamp(['.xc....', 'xcc....', 'xcc....', 'Xxcc...', '.Xxccs' + (p.act === 2 ? '.' : 'S'), '..XXX' + (p.act === 2 ? 'sS' : '..')], 6, y);
      }
    } else if (view === 'up') {
      // the elbow of the arm that is hugging the board
      s.stamp(['.c', 'xc', 'xc', 'xc', 'Xx'], 6, y);
    } else {
      // the board edge-on against her chest
      s.stamp(['6A', '65', '65', '65', '6s'], 16, y + 1);
      if (view === 'left') s.stamp(['.ccC....', 'XxcC....', 'XxcC....', 'XxccccsS', '.XXXXX..'], 9, y);
    }
  },
  idle: [
    ...hold(3), ...hold(2, { eyes: 'low', nod: 1 }),
    still({ eyes: 'low', nod: 1, act: 1, noArms: true }), still({ eyes: 'low', nod: 1, act: 2, noArms: true }),
    still({ eyes: 'low', nod: 1, act: 1, noArms: true }), still({ eyes: 'low', nod: 1, act: 2, noArms: true }),
    still({ eyes: 'low', nod: 1 }), ...hold(3), still({ eyes: 'shut' }), ...hold(2), ...hold(3, { bob: 1 }), ...hold(2, { eyes: 'left' }), still(),
  ],
};

/* ---------- the yard boss ---------- */

const ARMS_CROSSED = [
  '.yt............tT.',
  'ytt............ttT',
  'Yyy............yyt',
  'zssssssSZsssssSSsS',
  'zmnssssssZssSSnNsS',
  '.mnzzzzzzzZzzzmn..',
];

/** A big man in orange overalls with a beard to match his temper: goggles pushed up, tool belt, gloves. */
const yardBoss: Look = {
  ramps: {
    skin: PAL.skin[1],
    hair: ['#1a1423', '#2e211d', '#4a3328', '#75573f'],
    coat: [PAL.rust[2], PAL.rust[4], PAL.amber[3], PAL.amber[4]],
    pants: [PAL.rust[2], PAL.rust[4], PAL.amber[3], PAL.amber[4]],
    shirt: [PAL.steel[1], PAL.steel[2], PAL.steel[4], PAL.steel[5]],
    boots: [PAL.night[1], PAL.steel[0], PAL.steel[2], PAL.steel[4]],
    trim: LEATHER,
    metal: BRASS,
  },
  // 7 and 8 are the goggles' amber glass and its glint, 9 a steel wrench
  more: { '7': PAL.amber[2], '8': PAL.amber[5], '9': PAL.steel[6] },
  top: 1, neck: 11, hip: 21,
  arm: 3, armLen: 10, leg: 4, stance: 2,
  sleeveOf: 'shirt', sleeve: 3, glove: true,
  head: {
    down: [
      '....jjhhhh....',
      '..oooohhoooo..',
      '.mo77onno78om.',
      '.jhoohhhhooHh.',
      '.jzssssSSSSsh.',
      '.zzJJsSSSJJss.',
      '.zzsesSSseSss.',
      '.jzsssZsSSssh.',
      '.jhhhhHHhhhHh.',
      '.jhhhjZZjhhHh.',
      '..jhhhhhhhHh..',
      '...jjhhhhhj...',
    ],
    up: [
      '....jjhhhh....',
      '..jjhhhhhhHh..',
      '.jhhhhhhhHHhh.',
      '.mnnnnnnnnNNm.',
      '.jhhhjhhhhhhh.',
      '.zjhhhhhjhhhs.',
      '.zjjhhhhhhhjs.',
      '..zzjjhhjjss..',
      '..zzsssssSss..',
      '...zzssssss...',
    ],
    side: [
      '....jjhhhh....',
      '..jjhhhhoooo..',
      '.mnnnnnno78o..',
      '.jhhhhhhhooHh.',
      '.jhhhhzzsssSS.',
      '.jjhhhSsJJJsS.',
      '..jjhhzssseSSS',
      '..jhhhhsssssSS',
      '...jhhhhhHHHh.',
      '...jhhhhhhZhh.',
      '....jhhhhhHh..',
      '.....jjhhhh...',
    ],
  },
  torso: {
    down: [
      '...yttttT...',
      'ttxcttttxcTT',
      'YtxcttttxcTY',
      'YtxacccccaTY',
      'YyxccccccCtY',
      'YyxcXXXXcCtY',
      'XxcccccccCCX',
      'XxcccccccCCX',
      'MmnnnaAnnnNM',
      '.mNm9...mNm.',
      '.mnm9...mnm.',
    ],
    up: [
      '...zssssS...',
      'ttxcttttxcTT',
      'YttxcttxcTtY',
      'YtttxccctTtY',
      'YytxccccCttY',
      'YyxccccccCtY',
      'XxcccccccCCX',
      'XxcccccccCCX',
      'MmnnnnnnnnNM',
      '.mNm...9mNm.',
      '.mnm...9mnm.',
    ],
    side: [
      '....yttT....',
      '..yytttttT..',
      '.YytxcctttT.',
      '.YyxccccccC.',
      'YyyxccccccCC',
      'YyxcccccccCC',
      'XxccccccccCC',
      'XxccccccccC.',
      'MmnnnnnnnnNa',
      '.mNm...mNmm.',
      '.mnm...mnm..',
    ],
  },
  detail(s: Sheet, view, p) {
    if (view === 'down' && p.act) s.stamp(ARMS_CROSSED, 3, this.neck + 1 + p.bob);
  },
  idle: [
    ...hold(4, { act: 1, noArms: true }), ...hold(3, { act: 1, noArms: true, bob: 1 }), ...hold(3, { act: 1, noArms: true }),
    ...hold(2, { act: 1, noArms: true, eyes: 'right' }), still({ act: 1, noArms: true }), still({ act: 1, noArms: true, eyes: 'shut' }),
    ...hold(2, { act: 1, noArms: true }), ...hold(3, { act: 1, noArms: true, bob: 1 }),
  ],
};

export const CAST = { player, broker, clerk, yardBoss } satisfies Record<string, Look>;

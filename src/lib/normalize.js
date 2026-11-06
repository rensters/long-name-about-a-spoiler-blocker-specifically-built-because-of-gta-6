// hey, welcome to the cursed text department. turns whatever a website hands us into something regexes can work with.
// "𝐆𝐓𝐀 Ⅵ", "ＧＴＡ６", "GТА 6" (that Т is cyrillic, yes people do this), "Leónida", "#GTA6Trailer"
// all come out the other side as plain lowercase boring text. terms go through the exact same
// function, so whatever we mangle, we mangle on both sides and it still lines up.
(function (root) {
  const SS = (root.SpoilerShield = root.SpoilerShield || {});

  // the "don't let a match jump across this" character. the scanner glues separate blocks of a card
  // (title / channel / view count) together with it, so "...GTA" + "6M views" can't turn into "GTA 6".
  // regexes treat it as a wall. U+2063 INVISIBLE SEPARATOR, nobody types this on purpose (if you do, why)
  const WALL = '\u2063';

  // NFKC already fixes fullwidth digits, but arabic-indic, devanagari, thai etc digits just sail right through. annoying
  // these are the code points of each script's zero; digits are always the 10 code points after it
  const DIGIT_ZEROS = [
    0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66,
    0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1810, 0xff10,
  ];
  const DIGIT_RE = /\p{Nd}/gu;
  const foldDigit = (ch) => {
    const cp = ch.codePointAt(0);
    if (cp < 0x80) return ch;
    for (const z of DIGIT_ZEROS) if (cp >= z && cp < z + 10) return String(cp - z);
    return ch;
  };

  // letters that look latin but aren't, plus a few latin letters NFD can't split apart.
  // applied after lowercasing, so only lowercase forms here
  const LOOKALIKES = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'м': 'm', 'т': 't',
    'в': 'b', 'н': 'h', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ɡ': 'g', 'ӏ': 'l',
    'α': 'a', 'ε': 'e', 'ι': 'i', 'ο': 'o', 'ρ': 'p', 'τ': 't', 'υ': 'u', 'κ': 'k', 'ν': 'v', 'χ': 'x',
    'ı': 'i', 'ł': 'l', 'đ': 'd', 'ø': 'o', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ð': 'd', 'þ': 'th',
    '‘': "'", '’': "'", 'ʼ': "'", '`': "'", '´': "'",
  };
  const LOOKALIKE_RE = new RegExp('[' + Object.keys(LOOKALIKES).join('') + ']', 'g');

  // accents only get stripped off latin/greek/cyrillic letters. hindi, thai, japanese dakuten etc use
  // combining marks as actual parts of letters and stripping those turns グランド into クラント lmao. don't do that
  const ACCENT_RE = /([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}])\p{M}+/gu;
  const ARABIC_JUNK_RE = /[ً-ٰٟـ]/g; // harakat + tatweel, decorative

  // "GTA6Trailer" -> "GTA6 Trailer", "gtaVi" -> "gta Vi", "GTAVILeaks" -> "GTAVI Leaks"
  const CAMEL_1 = /(\p{Ll})(\p{Lu})/gu;
  const CAMEL_2 = /(\p{Lu})(\p{Lu}\p{Ll})/gu;

  const MAX = 20000; // nobody's spoiler is in character 20001. probably. hopefully

  function normalize(input) {
    if (input == null) return '';
    let s = String(input);
    if (!s) return '';
    if (s.length > MAX) s = s.slice(0, MAX);
    s = s.normalize('NFKC');
    s = s.replace(CAMEL_1, '$1 $2').replace(CAMEL_2, '$1 $2');
    s = s.replace(DIGIT_RE, foldDigit);
    s = s.toLowerCase();
    s = s.normalize('NFD').replace(ACCENT_RE, '$1').normalize('NFC');
    s = s.replace(ARABIC_JUNK_RE, '');
    s = s.replace(LOOKALIKE_RE, (c) => LOOKALIKES[c]);
    return s;
  }

  // for comparing names: channel handles, subreddits, categories. "@Rockstar_Games" == "rockstar games"
  function squash(input) {
    return normalize(input).replace(/[^\p{L}\p{N}]+/gu, '');
  }

  // tiny fast string hash. spots when a site recycles a DOM node with new content in it. nothing fancy, move along
  function hash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  }

  SS.text = { normalize, squash, hash, WALL };
  if (typeof module === 'object' && module.exports) module.exports = SS;
})(typeof globalThis !== 'undefined' ? globalThis : this);

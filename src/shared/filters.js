const BLOCKED_WORDS = [
    "gay", "homosexual", "queer", "homo", "androphile", "femboy", "feminine boy",
    "effeminate", "trap", "trans", "Trade", "Vers", "Twink", "Otter", "Bear",
    "Femme", "Masc", "Serving", "Gagged", "Twink", "Kiki", "Kai Kai", "Werk",
    "Realness", "Hunty", "Snatched", "Clocked", "Shade", "Zaddy", "Chosen family",
    "Closet case", "Henny", "Queening out", "Slay", "Camp", "Fishy", "Cruising",
    "Bathhouse", "Power bottom", "Situationship", "Pegging", "Femdom", "futa",
    "tranny", "crossdress", "Bisexual", "Intersex", "LGBTQ", "TS", "TGirl",
    "T-Boy", "Transsexual", "t-girl", "tgirl",
];

const BLOCKED_REGEX = new RegExp(
    `\\b(?:${BLOCKED_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})\\w*\\b`,
    "i"
);

export function isBlocked(title) {
    return BLOCKED_REGEX.test(title);
}

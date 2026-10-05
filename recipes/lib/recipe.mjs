// recipes/lib/recipe.mjs — the organisation recipe, compiled to a forge profile.
//
// One file describes what an organisation's machines are: who they are for, what language they
// speak, which programs are on them, what is taken out, and how locked down they are. This module
// reads that file, refuses what it cannot honour, and writes the `.profile` that build/forge builds.
//
// It runs unchanged in a browser and in node: no imports, no filesystem, no clock, no randomness.
// The same recipe always compiles to the same bytes.
//
// WHERE THIS CAME FROM. The recipe model is LATHE's (lathe/, and the auros-recipes repository it
// controlled). The engine it compiles to is the from-scratch one at the root of this repository.
// LATHE's hardest lesson (lathe/DECISIONS.md D38) was fields that reached the image as nothing:
// `updates.install_between`, `hardware.also_test` and `prune.also_keep` were written, validated,
// printed in the customer's pull request — and changed nothing on a machine. So the rule here is
// absolute: every field this form accepts changes the compiled profile, and every LATHE field the
// engine has no way to honour is REFUSED with a sentence saying so. Nothing is recorded-but-ignored.
// recipes/test/fields.test.mjs enforces the first half; recipes/test/forge.test.mjs proves every
// key the compiler writes is one build/forge actually reads.

export const SCHEMA_VERSION = 1

// ── what profiles/desktop.profile says ──────────────────────────────────────────────────────────
//
// Every compiled profile is `inherit="desktop"` plus overrides, so the compiler has to know what it
// is overriding. This is a COPY, because a browser cannot read the file, and a copy drifts — so
// recipes/test/options.test.mjs runs `build/forge resolve desktop` and fails on any difference.
// Package lists are kept in desktop.profile's own order so a compiled profile diffs cleanly against it.
export const BASE = Object.freeze({
  profile: 'desktop',
  packages_hardware: Object.freeze(['linux-image-generic', 'linux-firmware', 'network-manager', 'wireless-tools',
    'wpasupplicant', 'polkitd', 'bluez', 'cups', 'cups-filters', 'cups-browsed', 'avahi-daemon', 'avahi-utils',
    'printer-driver-gutenprint', 'printer-driver-hpcups', 'cups-pk-helper', 'system-config-printer',
    'pciutils', 'usbutils']),
  packages_files: Object.freeze(['thunar', 'thunar-volman', 'gvfs', 'gvfs-backends', 'udisks2', 'gdebi',
    'ristretto', 'atril', 'mousepad', 'xarchiver', 'mpv', 'mate-calc', 'shared-mime-info',
    'desktop-file-utils', 'xdg-user-dirs']),
  packages_apps: Object.freeze([]),
  packages_extra: Object.freeze([]),
  software_store: 'gnome-software',
  browser: 'firefox',
  browser_source: 'mozilla-apt mozilla-ppa mozilla-tarball',
  theme: 'nocturne',
  shell_archetype: 'rail',
  locale: 'en_US.UTF-8',
  extra_locales: '',
  timezone: 'UTC',
  keyboard_layout: 'us',
  keyboard_variant: '',
  kiosk_mode: 'no',
  allowed_apps: '',
  allow_user_install: 'yes',
  allow_settings_change: 'yes',
  allow_theme_change: 'yes',
  allow_network_change: 'yes',
  allow_tty: 'yes',
  screen_off_minutes: '10',
})

// Profiles that ship with the engine. A recipe may not take one of these names: its compiled file
// would overwrite the profile, and a recipe named `desktop` would inherit from itself.
export const RESERVED_NAMES = Object.freeze(['desktop', 'multilingual', 'office', 'revive', 'school-kiosk'])

// ── what the engine offers ──────────────────────────────────────────────────────────────────────
//
// Derived from the engine, not from LATHE's catalogue: themes/*.theme, shells/*.shell, build/forge's
// browser, store and package handling, and Ubuntu 24.04's archive. options.test.mjs checks the
// themes and layouts against those directories, and every locale and keyboard against the host's
// /usr/share/i18n/SUPPORTED and XKB rules when they exist. Every package named below was checked
// against the noble main+universe Packages index on 2026-10-04; that check needs the network and is
// not repeated by the tests.

// Every lookup table is an object with NO PROTOTYPE. A plain {} answers to "constructor",
// "toString", "__proto__" and the rest of Object.prototype, so `LANGUAGES[L]` was truthy for
// L = "constructor" — and `policy: constructor` validated, then compiled to allow_*="undefined",
// which build/forge's yesno() reads as yes. recipes/test/validate.test.mjs tries every such word.
function table (o) { return Object.assign(Object.create(null), o) }

const POLICIES = table({
  open: {
    says: 'The person at the machine owns it: they may install programs, change settings and the look, choose the wifi, and reach a console.',
    allow_user_install: 'yes', allow_settings_change: 'yes', allow_theme_change: 'yes', allow_network_change: 'yes', allow_tty: 'yes', kiosk_mode: 'no',
  },
  managed: {
    says: 'Somebody responsible for many machines decides what is installed. The person using one still decides how it looks and behaves, and may choose the wifi.',
    allow_user_install: 'no', allow_settings_change: 'yes', allow_theme_change: 'yes', allow_network_change: 'yes', allow_tty: 'yes', kiosk_mode: 'no',
  },
  locked: {
    says: 'Only the programs in this recipe can be opened, and nothing about the machine can be changed by the person using it: no installing, no settings, no theme, no network choice, no console.',
    allow_user_install: 'no', allow_settings_change: 'no', allow_theme_change: 'no', allow_network_change: 'no', allow_tty: 'no', kiosk_mode: 'no',
  },
  kiosk: {
    says: 'A machine on a counter. There is no desktop: the first program starts by itself and fills the screen, nobody signs in, and nothing can be changed, installed, mounted or reached from it.',
    allow_user_install: 'no', allow_settings_change: 'no', allow_theme_change: 'no', allow_network_change: 'no', allow_tty: 'no', kiosk_mode: 'yes',
  },
})

// themes/*.theme. `variant` is the theme file's own theme_variant.
const THEMES = table({
  ember: { variant: 'dark', says: 'Warm charcoal and firelight, for an old screen whose blues have faded.' },
  moss: { variant: 'dark', says: 'Dark, with a green accent.' },
  nocturne: { variant: 'dark', says: 'The default: dark, calm, gold accent.' },
  sandstone: { variant: 'light', says: 'The light theme, for bright rooms and daylight.' },
  slate: { variant: 'dark', says: 'Cool grey-blue, for offices.' },
  synthwave: { variant: 'dark', says: 'Loud pink and cyan.' },
})

// shells/*.shell, minus `locked`, which is not a layout a person chooses: it is what policy: kiosk is.
const LAYOUTS = table({
  dock: { says: 'Favourite programs always in the same place along the edge, like a Mac or a Chromebook shelf.' },
  rail: { says: 'Everything open sits in a row; nothing can hide. The AurOS default.' },
  taskbar: { says: 'A bar of open windows along the bottom; they overlap. What a Windows user expects.' },
  tiles: { says: 'A page of big buttons; one thing fills the screen at a time.' },
  workbench: { says: 'Windows divide the screen between them; driven from the keyboard.' },
})

// language -> locale (generated by forge's stage 4), script, and what the archive adds for it.
// fonts-noto-core carries the non-Latin scripts the base fonts do not draw; Greek and Cyrillic are in
// fonts-dejavu-core already, and Chinese is fonts_cjk, which desktop.profile sets to yes.
const NOTO = 'fonts-noto-core'
const LANGUAGES = table({
  Arabic: { locale: 'ar_EG.UTF-8', script: 'Arabic', packages: ['language-pack-ar', NOTO] },
  Bengali: { locale: 'bn_IN.UTF-8', script: 'Bengali', packages: ['language-pack-bn', NOTO] },
  'Chinese (Simplified)': { locale: 'zh_CN.UTF-8', script: 'Han', packages: ['language-pack-zh-hans'] },
  Dutch: { locale: 'nl_NL.UTF-8', script: 'Latin', packages: ['language-pack-nl'] },
  'English (India)': { locale: 'en_IN.UTF-8', script: 'Latin', packages: ['language-pack-en'] },
  'English (United Kingdom)': { locale: 'en_GB.UTF-8', script: 'Latin', packages: ['language-pack-en'] },
  'English (United States)': { locale: 'en_US.UTF-8', script: 'Latin', packages: ['language-pack-en'] },
  French: { locale: 'fr_FR.UTF-8', script: 'Latin', packages: ['language-pack-fr'] },
  German: { locale: 'de_DE.UTF-8', script: 'Latin', packages: ['language-pack-de'] },
  Greek: { locale: 'el_GR.UTF-8', script: 'Greek', packages: ['language-pack-el'] },
  Hindi: { locale: 'hi_IN.UTF-8', script: 'Devanagari', packages: ['language-pack-hi', NOTO] },
  Indonesian: { locale: 'id_ID.UTF-8', script: 'Latin', packages: ['language-pack-id'] },
  Italian: { locale: 'it_IT.UTF-8', script: 'Latin', packages: ['language-pack-it'] },
  Marathi: { locale: 'mr_IN.UTF-8', script: 'Devanagari', packages: ['language-pack-mr', NOTO] },
  Polish: { locale: 'pl_PL.UTF-8', script: 'Latin', packages: ['language-pack-pl'] },
  'Portuguese (Brazil)': { locale: 'pt_BR.UTF-8', script: 'Latin', packages: ['language-pack-pt'] },
  Russian: { locale: 'ru_RU.UTF-8', script: 'Cyrillic', packages: ['language-pack-ru'] },
  Spanish: { locale: 'es_ES.UTF-8', script: 'Latin', packages: ['language-pack-es'] },
  'Spanish (Latin America)': { locale: 'es_MX.UTF-8', script: 'Latin', packages: ['language-pack-es'] },
  // There is no language-pack-sw in noble. The locale is generated; the programs stay in English.
  Swahili: { locale: 'sw_KE.UTF-8', script: 'Latin', packages: [] },
  Tamil: { locale: 'ta_IN.UTF-8', script: 'Tamil', packages: ['language-pack-ta', NOTO] },
  Telugu: { locale: 'te_IN.UTF-8', script: 'Telugu', packages: ['language-pack-te', NOTO] },
  Turkish: { locale: 'tr_TR.UTF-8', script: 'Latin', packages: ['language-pack-tr'] },
  Ukrainian: { locale: 'uk_UA.UTF-8', script: 'Cyrillic', packages: ['language-pack-uk'] },
  Vietnamese: { locale: 'vi_VN.UTF-8', script: 'Latin', packages: ['language-pack-vi'] },
})

// What is printed on the keys -> XKB layout and variant, as /etc/default/keyboard names them.
//
// LATHE's catalogue named three Indian variants that do not exist in xkeyboard-config —
// `in:mar-inscript`, `in:hin-inscript`, `in:ben-inscript` — which src/aurwl would have answered by
// falling back to a US keyboard. These are read from /usr/share/X11/xkb/rules/evdev.lst on Ubuntu
// 24.04, and options.test.mjs re-reads that file wherever it exists.
const KEYBOARDS = table({
  'English (US)': { layout: 'us', variant: '', script: 'Latin' },
  'English (UK)': { layout: 'gb', variant: '', script: 'Latin' },
  'English (India)': { layout: 'in', variant: 'eng', script: 'Latin' },
  French: { layout: 'fr', variant: '', script: 'Latin' },
  German: { layout: 'de', variant: '', script: 'Latin' },
  Spanish: { layout: 'es', variant: '', script: 'Latin' },
  'Spanish (Latin America)': { layout: 'latam', variant: '', script: 'Latin' },
  'Portuguese (Brazil)': { layout: 'br', variant: '', script: 'Latin' },
  Italian: { layout: 'it', variant: '', script: 'Latin' },
  Dutch: { layout: 'nl', variant: '', script: 'Latin' },
  Polish: { layout: 'pl', variant: '', script: 'Latin' },
  Turkish: { layout: 'tr', variant: '', script: 'Latin' },
  Vietnamese: { layout: 'vn', variant: '', script: 'Latin' },
  'Marathi (InScript)': { layout: 'in', variant: 'marathi', script: 'Devanagari' },
  'Hindi (InScript)': { layout: 'in', variant: '', script: 'Devanagari' },
  'Bengali (InScript)': { layout: 'in', variant: 'ben_inscript', script: 'Bengali' },
  'Tamil (InScript)': { layout: 'in', variant: 'tam', script: 'Tamil' },
  Telugu: { layout: 'in', variant: 'tel', script: 'Telugu' },
  Arabic: { layout: 'ara', variant: '', script: 'Arabic' },
  Greek: { layout: 'gr', variant: '', script: 'Greek' },
  Hebrew: { layout: 'il', variant: '', script: 'Hebrew' },
  Russian: { layout: 'ru', variant: '', script: 'Cyrillic' },
  Ukrainian: { layout: 'ua', variant: '', script: 'Cyrillic' },
  Thai: { layout: 'th', variant: '', script: 'Thai' },
})

// Time zones: every Area/Location name in Ubuntu 24.04's tzdata (/usr/share/zoneinfo, without the
// tzdata-legacy package the image does not install), plus UTC. build/forge links /etc/localtime to the
// zone's file and carries on if there is none, so a zone that was merely SHAPED like one — a typo, or
// an old name like Asia/Calcutta — gave a machine on UTC that said nothing. options.test.mjs checks
// every name here against the tzdata of the machine running the tests.
const ZONE_AREAS = {
  Africa: 'Abidjan Accra Addis_Ababa Algiers Asmara Bamako Bangui Banjul Bissau Blantyre Brazzaville ' +
    'Bujumbura Cairo Casablanca Ceuta Conakry Dakar Dar_es_Salaam Djibouti Douala El_Aaiun Freetown ' +
    'Gaborone Harare Johannesburg Juba Kampala Khartoum Kigali Kinshasa Lagos Libreville Lome Luanda ' +
    'Lubumbashi Lusaka Malabo Maputo Maseru Mbabane Mogadishu Monrovia Nairobi Ndjamena Niamey ' +
    'Nouakchott Ouagadougou Porto-Novo Sao_Tome Timbuktu Tripoli Tunis Windhoek',
  America: 'Adak Anchorage Anguilla Antigua Araguaina Argentina/Buenos_Aires Argentina/Catamarca ' +
    'Argentina/Cordoba Argentina/Jujuy Argentina/La_Rioja Argentina/Mendoza Argentina/Rio_Gallegos ' +
    'Argentina/Salta Argentina/San_Juan Argentina/San_Luis Argentina/Tucuman Argentina/Ushuaia Aruba ' +
    'Asuncion Atikokan Atka Bahia Bahia_Banderas Barbados Belem Belize Blanc-Sablon Boa_Vista Bogota ' +
    'Boise Cambridge_Bay Campo_Grande Cancun Caracas Cayenne Cayman Chicago Chihuahua Ciudad_Juarez ' +
    'Coral_Harbour Costa_Rica Coyhaique Creston Cuiaba Curacao Danmarkshavn Dawson Dawson_Creek ' +
    'Denver Detroit Dominica Edmonton Eirunepe El_Salvador Ensenada Fort_Nelson Fortaleza Glace_Bay ' +
    'Goose_Bay Grand_Turk Grenada Guadeloupe Guatemala Guayaquil Guyana Halifax Havana Hermosillo ' +
    'Indiana/Indianapolis Indiana/Knox Indiana/Marengo Indiana/Petersburg Indiana/Tell_City ' +
    'Indiana/Vevay Indiana/Vincennes Indiana/Winamac Inuvik Iqaluit Jamaica Juneau ' +
    'Kentucky/Louisville Kentucky/Monticello Kralendijk La_Paz Lima Los_Angeles Lower_Princes Maceio ' +
    'Managua Manaus Marigot Martinique Matamoros Mazatlan Menominee Merida Metlakatla Mexico_City ' +
    'Miquelon Moncton Monterrey Montevideo Montreal Montserrat Nassau New_York Nipigon Nome Noronha ' +
    'North_Dakota/Beulah North_Dakota/Center North_Dakota/New_Salem Nuuk Ojinaga Panama Pangnirtung ' +
    'Paramaribo Phoenix Port-au-Prince Port_of_Spain Porto_Acre Porto_Velho Puerto_Rico Punta_Arenas ' +
    'Rainy_River Rankin_Inlet Recife Regina Resolute Rio_Branco Santa_Isabel Santarem Santiago ' +
    'Santo_Domingo Sao_Paulo Scoresbysund Shiprock Sitka St_Barthelemy St_Johns St_Kitts St_Lucia ' +
    'St_Thomas St_Vincent Swift_Current Tegucigalpa Thule Thunder_Bay Tijuana Toronto Tortola ' +
    'Vancouver Virgin Whitehorse Winnipeg Yakutat Yellowknife',
  Antarctica: 'Casey Davis DumontDUrville Macquarie Mawson McMurdo Palmer Rothera Syowa Troll Vostok',
  Arctic: 'Longyearbyen',
  Asia: 'Aden Almaty Amman Anadyr Aqtau Aqtobe Ashgabat Atyrau Baghdad Bahrain Baku Bangkok Barnaul ' +
    'Beirut Bishkek Brunei Chita Choibalsan Chongqing Colombo Damascus Dhaka Dili Dubai Dushanbe ' +
    'Famagusta Gaza Harbin Hebron Ho_Chi_Minh Hong_Kong Hovd Irkutsk Istanbul Jakarta Jayapura ' +
    'Jerusalem Kabul Kamchatka Karachi Kashgar Kathmandu Khandyga Kolkata Krasnoyarsk Kuala_Lumpur ' +
    'Kuching Kuwait Macau Magadan Makassar Manila Muscat Nicosia Novokuznetsk Novosibirsk Omsk Oral ' +
    'Phnom_Penh Pontianak Pyongyang Qatar Qostanay Qyzylorda Riyadh Sakhalin Samarkand Seoul Shanghai ' +
    'Singapore Srednekolymsk Taipei Tashkent Tbilisi Tehran Tel_Aviv Thimphu Tokyo Tomsk Ulaanbaatar ' +
    'Urumqi Ust-Nera Vientiane Vladivostok Yakutsk Yangon Yekaterinburg Yerevan',
  Atlantic: 'Azores Bermuda Canary Cape_Verde Faroe Jan_Mayen Madeira Reykjavik South_Georgia St_Helena ' +
    'Stanley',
  Australia: 'Adelaide Brisbane Broken_Hill Canberra Currie Darwin Eucla Hobart Lindeman Lord_Howe Melbourne ' +
    'Perth Sydney Yancowinna',
  Etc: 'GMT GMT+0 GMT+1 GMT+10 GMT+11 GMT+12 GMT+2 GMT+3 GMT+4 GMT+5 GMT+6 GMT+7 GMT+8 GMT+9 GMT-0 GMT-1 ' +
    'GMT-10 GMT-11 GMT-12 GMT-13 GMT-14 GMT-2 GMT-3 GMT-4 GMT-5 GMT-6 GMT-7 GMT-8 GMT-9 GMT0 ' +
    'Greenwich UCT UTC Universal Zulu',
  Europe: 'Amsterdam Andorra Astrakhan Athens Belfast Belgrade Berlin Bratislava Brussels Bucharest ' +
    'Budapest Busingen Chisinau Copenhagen Dublin Gibraltar Guernsey Helsinki Isle_of_Man Istanbul ' +
    'Jersey Kaliningrad Kirov Kyiv Lisbon Ljubljana London Luxembourg Madrid Malta Mariehamn Minsk ' +
    'Monaco Moscow Nicosia Oslo Paris Podgorica Prague Riga Rome Samara San_Marino Sarajevo Saratov ' +
    'Simferopol Skopje Sofia Stockholm Tallinn Tirane Tiraspol Ulyanovsk Vaduz Vatican Vienna Vilnius ' +
    'Volgograd Warsaw Zagreb Zurich',
  Indian: 'Antananarivo Chagos Christmas Cocos Comoro Kerguelen Mahe Maldives Mauritius Mayotte Reunion',
  Pacific: 'Apia Auckland Bougainville Chatham Chuuk Easter Efate Fakaofo Fiji Funafuti Galapagos Gambier ' +
    'Guadalcanal Guam Honolulu Johnston Kanton Kiritimati Kosrae Kwajalein Majuro Marquesas Midway ' +
    'Nauru Niue Norfolk Noumea Pago_Pago Palau Pitcairn Pohnpei Port_Moresby Rarotonga Saipan Samoa ' +
    'Tahiti Tarawa Tongatapu Wake Wallis Yap',
}
const ZONES = Object.freeze(['UTC', ...Object.entries(ZONE_AREAS).flatMap(([area, s]) => s.split(' ').map((l) => `${area}/${l}`))].sort())
const ZONE_SET = new Set(ZONES)

const TOGGLES = table({
  'Windows key + Spacebar': 'grp:win_space_toggle',
  'Alt + Shift': 'grp:alt_shift_toggle',
  'Ctrl + Spacebar': 'grp:ctrl_space_toggle',
})

// Programs, by the name a person says.
//
//   from      files   one of desktop.profile's packages_files (installed by default)
//             store   build/forge's software_store knob
//             browser build/forge's browser mechanism (browser / browser_source)
//             apps    added to packages_apps
//   launch    the command basenames aurshell's allow-list matches (src/aurshell/apps.c matches the
//             Exec program's basename). Only consulted under policy locked and kiosk. The ones for
//             programs outside desktop.profile have not been read off a built image yet.
//   shownAs   what build/forge renames it to on the machine, when it does.
//   group     a removable group it belongs to (prune.also_remove).
//   door      installs-software | terminal — a program that would undo a policy by being present.
const APPS = table({
  // the default desktop set: desktop.profile's packages_files, the store, and the browser
  Files: { from: 'files', packages: ['thunar', 'thunar-volman', 'gvfs', 'gvfs-backends', 'udisks2'], launch: ['thunar'], shownAs: 'Your files' },
  'Program Installer': { from: 'files', packages: ['gdebi'], launch: ['gdebi-gtk'], shownAs: 'Install a program you downloaded', door: 'installs-software' },
  'Image Viewer': { from: 'files', packages: ['ristretto'], launch: ['ristretto'], shownAs: 'Photos' },
  'Document Viewer': { from: 'files', packages: ['atril'], launch: ['atril'], shownAs: 'Documents' },
  'Text Editor': { from: 'files', packages: ['mousepad'], launch: ['mousepad'], shownAs: 'Notes' },
  'Archive Manager': { from: 'files', packages: ['xarchiver'], launch: ['xarchiver'], shownAs: 'Zip files' },
  'Media Player': { from: 'files', packages: ['mpv'], launch: ['mpv'], shownAs: 'Music and video', group: 'media players' },
  Calculator: { from: 'files', packages: ['mate-calc'], launch: ['mate-calc'], shownAs: 'Calculator' },
  'Software Centre': { from: 'store', packages: ['gnome-software'], launch: ['gnome-software'], shownAs: 'Get more programs', group: 'software store', door: 'installs-software' },
  Firefox: { from: 'browser', packages: ['firefox'], launch: ['firefox'] },
  // added on request, from Ubuntu's own archive
  'GNOME Web': { from: 'apps', packages: ['epiphany-browser'], launch: ['epiphany'] },
  'LibreOffice Writer': { from: 'apps', packages: ['libreoffice-writer', 'libreoffice-gtk4'], launch: ['libreoffice', 'lowriter'] },
  'LibreOffice Calc': { from: 'apps', packages: ['libreoffice-calc', 'libreoffice-gtk4'], launch: ['libreoffice', 'localc'] },
  'LibreOffice Impress': { from: 'apps', packages: ['libreoffice-impress', 'libreoffice-gtk4'], launch: ['libreoffice', 'loimpress'] },
  AbiWord: { from: 'apps', packages: ['abiword'], launch: ['abiword'] },
  Gnumeric: { from: 'apps', packages: ['gnumeric'], launch: ['gnumeric'] },
  GIMP: { from: 'apps', packages: ['gimp'], launch: ['gimp', 'gimp-2.10'] },
  Inkscape: { from: 'apps', packages: ['inkscape'], launch: ['inkscape'] },
  GCompris: { from: 'apps', packages: ['gcompris-qt'], launch: ['gcompris-qt'] },
  'Tux Paint': { from: 'apps', packages: ['tuxpaint'], launch: ['tuxpaint'] },
  'Typing Tutor': { from: 'apps', packages: ['klavaro'], launch: ['klavaro'] },
  'VLC Media Player': { from: 'apps', packages: ['vlc'], launch: ['vlc'], group: 'media players' },
  Scanner: { from: 'apps', packages: ['simple-scan'], launch: ['simple-scan'] },
  'Password Manager': { from: 'apps', packages: ['keepassxc'], launch: ['keepassxc'] },
  'Remote Desktop': { from: 'apps', packages: ['remmina', 'remmina-plugin-rdp'], launch: ['remmina'] },
  'Task Manager': { from: 'apps', packages: ['xfce4-taskmanager'], launch: ['xfce4-taskmanager'] },
  Kate: { from: 'apps', packages: ['kate'], launch: ['kate'] },
  Konsole: { from: 'apps', packages: ['konsole'], launch: ['konsole'], door: 'terminal' },
  Terminal: { from: 'apps', packages: ['xfce4-terminal'], launch: ['xfce4-terminal'], door: 'terminal' },
})

// What the default desktop has when a recipe does not say "only these".
const DEFAULT_APPS = Object.freeze(Object.keys(APPS).filter((n) => APPS[n].from !== 'apps'))

// Names a person will reasonably write, and the honest reason each is not offered.
const REFUSED_APPS = table({
  'Google Chrome': 'Google Chrome is not in Ubuntu\'s archive. This image adds exactly one outside repository — Mozilla\'s, for Firefox — and adding Google\'s is a decision about every machine, not one recipe. On an open machine a person can still download Chrome\'s .deb and open it with the Program Installer.',
  Chromium: 'On Ubuntu 24.04 Chromium exists only as a snap, and this image removes snapd: the package installs and leaves no browser behind. Firefox is the browser here.',
  Thunderbird: 'On Ubuntu 24.04 the thunderbird package is a stub that installs a snap, and this image removes snapd, so asking for it would ship a machine with no mail program and no error. (profiles/office.profile asks for it today and has this problem.)',
  Mail: 'The only full mail program in Ubuntu 24.04 is Thunderbird, which there is a snap stub (see Thunderbird). Webmail in Firefox works.',
  'Visual Studio Code': 'Visual Studio Code comes from Microsoft\'s own repository, which this image does not add.',
  'Podman Desktop': 'Podman Desktop is distributed through Flathub, and this image has no Flatpak.',
  Scratch: 'Today\'s Scratch is a website (scratch.mit.edu) and works in Firefox. The only Scratch in Ubuntu\'s archive is version 1.4 from 2009, which cannot open a project made today; offering it under the same name would be a different program wearing Scratch\'s name.',
  'Microsoft Office': 'Windows programs do not run on AurOS, and we say so on the website rather than offering a compatibility layer that half-works. LibreOffice Writer, Calc and Impress open Office files.',
  'Microsoft Word': 'Windows programs do not run on AurOS. LibreOffice Writer opens Word documents.',
  'Microsoft Excel': 'Windows programs do not run on AurOS. LibreOffice Calc opens Excel spreadsheets.',
  Photoshop: 'Windows programs do not run on AurOS. GIMP is the closest program in the archive.',
  Zoom: 'Zoom is not in Ubuntu\'s archive; zoom.us works in Firefox.',
  Spotify: 'Spotify on Ubuntu is a snap, and this image removes snapd; open.spotify.com works in Firefox.',
})

// Things that are not programs but are still removable or keepable, from desktop.profile's
// packages_hardware. Everything else in that list — the kernel, firmware, the network, polkit, the
// PCI and USB tools — has no name here, so no sentence in a recipe can take it out.
const CAPABILITIES = table({
  printing: {
    packages: ['cups', 'cups-filters', 'cups-browsed', 'printer-driver-gutenprint', 'printer-driver-hpcups', 'cups-pk-helper', 'system-config-printer'],
    says: 'Printing: the print system, drivers for printers that need them, and the Printers settings.',
  },
  bluetooth: {
    packages: ['bluez'],
    says: 'Bluetooth: mice, keyboards and headphones without a cable.',
  },
})

// Groups prune.also_remove may name: the two capabilities, and the groups default programs belong to.
const GROUPS = table({
  printing: { capability: 'printing' },
  bluetooth: { capability: 'bluetooth' },
  'media players': { apps: ['Media Player', 'VLC Media Player'] },
  'software store': { apps: ['Software Centre'] },
})

// LATHE groups that name nothing on this desktop. Accepting them would print a removal that removed
// nothing — the exact shape D38 found under keep_only_the_apps_above.
const ABSENT_GROUPS = table({
  'developer tools': 'The AurOS desktop has no compilers, debuggers or developer editors in it, so there is nothing to remove.',
  games: 'The AurOS desktop has no games in it, so there is nothing to remove.',
  'remote desktop': 'The AurOS desktop has no remote-desktop program in it, so there is nothing to remove.',
  'sample wallpapers and media': 'AurOS has no sample wallpapers or media files: its wallpaper is drawn from the theme. There is nothing to remove.',
  virtualisation: 'The AurOS desktop has no virtual-machine software in it, so there is nothing to remove.',
  webcam: 'The AurOS desktop has no camera program in it, so there is nothing to remove.',
  scanning: 'The AurOS desktop has no scanning program in it, so there is nothing to remove. (Add Scanner to apps if you want one.)',
  'smartcard readers': 'The AurOS desktop has no smartcard software in it, so there is nothing to remove.',
  'office suite': 'The AurOS desktop has no office suite in it, so there is nothing to remove.',
  'wired networking': 'Wired networking is part of the network manager every update arrives through. It cannot be removed.',
  'usb storage': 'USB sticks are opened by Files. Under policy locked and kiosk the person at the machine is already given no right to open one; on an open or managed machine, removing it would break Files.',
})

const FILES_SUPPORT = Object.freeze(['shared-mime-info', 'desktop-file-utils', 'xdg-user-dirs'])

// Frozen all the way down: a page that imports this module must not be able to change what the
// next compile means by editing a table in place.
const deepFreeze = (o) => { for (const v of Object.values(o)) if (v && typeof v === 'object') deepFreeze(v); return Object.freeze(o) }
export const OPTIONS = deepFreeze({
  policies: POLICIES, themes: THEMES, layouts: LAYOUTS, languages: LANGUAGES, keyboards: KEYBOARDS,
  toggles: TOGGLES, zones: ZONES, apps: APPS, defaultApps: DEFAULT_APPS, refusedApps: REFUSED_APPS,
  capabilities: CAPABILITIES, groups: GROUPS, absentGroups: ABSENT_GROUPS, filesSupport: FILES_SUPPORT,
})

// ── the form ────────────────────────────────────────────────────────────────────────────────────
//
// Every field this form accepts, in its canonical order, with the sentence a reader is shown. A
// field that is not here is refused. fields.test.mjs requires a probe for every path below proving
// the field changes the compiled profile.
export const FIELDS = Object.freeze([
  { path: 'schema', required: true, says: 'Which version of this form. Always 1. An unfamiliar number makes compile stop rather than guess.' },
  { path: 'name', required: true, says: 'The short name of this fleet, lowercase with hyphens. It becomes the profile\'s name: profiles/<name>.profile.' },
  { path: 'for', required: true, says: 'Who these machines are for and what people do on them, in your own words. At least twenty words.' },
  { path: 'organisation', required: true, says: 'Whose machines these are.' },
  { path: 'organisation.display_name', required: true, says: 'The name shown by the machine itself: its system name and the console sign-in screen.' },
  { path: 'language', required: true, says: 'What the machine speaks, as a person says it: "Marathi", not mr_IN.UTF-8.' },
  { path: 'other_languages', says: 'Further languages generated on the machine, so a person can switch to them.' },
  { path: 'keyboard', required: true, says: 'The layout printed on the keys. Latin layouts only, so a password can always be typed.' },
  { path: 'second_script', says: 'A second layout to switch to, for a script the keycaps do not show.' },
  { path: 'switch_scripts_with', says: 'The keys that switch between the two layouts. Required with second_script.' },
  { path: 'timezone', required: true, says: 'The clock, as a zone such as Asia/Kolkata. Not an offset, and not "auto".' },
  { path: 'apps', required: true, says: 'The programs on these machines, by the names people say.' },
  { path: 'prune', required: true, says: 'What is taken out of the standard desktop.' },
  { path: 'prune.keep_only_the_apps_above', required: true, says: 'true: remove every program not listed in apps. false: keep the standard desktop and add apps to it.' },
  { path: 'prune.also_keep', says: 'With keep_only: true — things that are not programs but are still needed (printing, bluetooth).' },
  { path: 'prune.also_remove', says: 'With keep_only: false — named groups to take out of the standard desktop.' },
  { path: 'policy', required: true, says: 'open | managed | locked | kiosk. How much the person using a machine may change.' },
  { path: 'desktop', says: 'How the desktop behaves. Not allowed under policy: kiosk, which has no desktop.' },
  { path: 'desktop.layout', says: 'How a person moves between things: dock, rail, taskbar, tiles or workbench.' },
  { path: 'desktop.can_install_apps', says: 'false takes installing away even on an open machine. true is only possible under policy: open.' },
  { path: 'desktop.can_reach_a_terminal', says: 'Whether Ctrl+Alt+F2 reaches a console. true is refused under policy: locked.' },
  { path: 'desktop.can_choose_wifi', says: 'Whether the person at the machine may choose its wifi network.' },
  { path: 'desktop.screen_off_minutes', says: 'Minutes without a touch before the screen goes dark. 0 means never; at most 120.' },
  { path: 'theme', says: 'The look, by name: ember, moss, nocturne, sandstone, slate or synthwave.' },
])
const FIELD = table(Object.fromEntries(FIELDS.map((f) => [f.path, f])))
const childrenOf = (prefix) => FIELDS.filter((f) => f.path.startsWith(prefix + '.') && !f.path.slice(prefix.length + 1).includes('.')).map((f) => f.path.slice(prefix.length + 1))
const TOP = FIELDS.filter((f) => !f.path.includes('.')).map((f) => f.path)

// ── what this form refuses, and why that is the point ───────────────────────────────────────────
//
// REFUSED_BY_DESIGN: things LATHE refused on purpose, and so does this. A shape that cannot carry the
// request is stronger than a rule that can be argued with on a deadline.
const BASE_WHY = 'Every fleet is built on the same base so that a security fix is one rebuild for everybody. A recipe cannot name what it is built on: the compiled profile always inherits desktop.'
const PIN_WHY = 'Holding a package back is how a machine ends up unpatched while looking maintained. If an update breaks your fleet, that is a report to us, and the fix goes into the base for everybody. This form has no shape that can carry a version.'
const KERNEL_WHY = 'The kernel, its drivers and the boot command line belong to the base, where they are patched once for everybody. A per-fleet kernel is a fork wearing a smaller hat.'
const RUN_WHY = 'A recipe cannot run code. Every effect it can have is a field with a name a non-engineer can read; a shell line is unreadable to the person this file is for and unbounded in what it can do inside a build.'
const SKIP_WHY = 'A recipe cannot ask for less checking. The strongest way to write "an unchecked image never ships" is a file that cannot express the request.'
const SECRET_WHY = 'A recipe cannot carry a secret. It is committed to a repository and anything in it is readable by everyone who can read that.'
const RAW_WHY = 'Programs are named the way people say them, in apps. A package list is a second, unreadable way to say the same thing, and the two would drift.'
const REFUSED_BY_DESIGN = table({
  from: BASE_WHY, base: BASE_WHY, image: BASE_WHY, registry: BASE_WHY, digest: BASE_WHY, inherit: BASE_WHY,
  pin: PIN_WHY, pins: PIN_WHY, hold: PIN_WHY, version: PIN_WHY, versions: PIN_WHY, exclude: PIN_WHY,
  kernel: KERNEL_WHY, kernel_args: KERNEL_WHY, boot_args: KERNEL_WHY, cmdline: KERNEL_WHY, drivers: KERNEL_WHY, modules: KERNEL_WHY,
  run: RUN_WHY, script: RUN_WHY, scripts: RUN_WHY, post_install: RUN_WHY, hooks: RUN_WHY, env: RUN_WHY, environment: RUN_WHY, commands: RUN_WHY,
  skip_checks: SKIP_WHY, force: SKIP_WHY, publish_without_test: SKIP_WHY, unsigned: SKIP_WHY, skip_tests: SKIP_WHY,
  password: SECRET_WHY, passwords: SECRET_WHY, wifi_password: SECRET_WHY, token: SECRET_WHY, secret: SECRET_WHY, secrets: SECRET_WHY,
  packages: RAW_WHY, packages_apps: RAW_WHY, packages_extra: RAW_WHY, install: RAW_WHY, remove: 'Write removals under prune, as named groups. A package list is a second, unreadable way to say the same thing.',
})

// NOT_IN_THE_ENGINE: LATHE fields this engine has nothing to honour them with. Refused rather than
// recorded, because a field the machine ignores is a lie in a file whose whole claim is that it is
// the machine (LATHE D38). Each says what would have to exist first.
const NOT_IN_THE_ENGINE = table({
  'organisation.helpdesk': 'AurOS has no help screen yet that would show a helpdesk. Put the desk\'s name in organisation.display_name if people need to see it, until there is one.',
  'organisation.logo': 'AurOS draws its branding as text and its wallpaper from the theme; there is nowhere a logo picture is shown yet.',
  hardware: 'The image is the same on every machine, so a fleet size or a model list changes nothing in it. Which models AurOS has actually been seen working on is recorded in hardware/compat.tsv, from physical machines — and it has no rows yet.',
  windows_apps: 'AurOS does not run Windows programs, and says so on its website. A switch to turn on a compatibility layer would be a promise; LibreOffice and Firefox cover what most people needed Windows programs for.',
  updates: 'Ubuntu\'s security updates install themselves once a day on apt\'s own timer, and AurOS has no setting for when. LATHE recorded an update window that no machine ever kept (its D38); this form refuses one until the engine can keep it.',
  first_boot_message: 'The first-boot screen does not show a message from the profile yet.',
  size_budget_gb: 'build/forge does not measure the image against a budget, so a budget written here could not stop a build that exceeded it.',
  approved_by: 'Who approved this fleet is recorded by whoever commits the compiled profile: the commit is the signature. A name written inside the file being approved proves nothing.',
  'prune.must_remove_at_least': 'build/forge does not count what a build removed, so this floor could only be checked against the plan the compiler itself writes — an alarm that cannot go off. What is removed is listed by explain instead.',
  'desktop.taskbar_and_start_menu': 'Choose desktop.layout: taskbar instead — that is the bar along the bottom.',
  'desktop.explorer_like_file_manager': 'Files is the one file manager AurOS has; there is no second behaviour to choose.',
  'desktop.familiar_folder_names': 'Documents, Downloads, Pictures and the rest are always created, in the machine\'s language. There is nothing to turn on.',
  'desktop.double_click_to_open': 'AurOS has no setting for single- or double-click.',
  'desktop.guided_first_boot': 'The first boot is the same on every AurOS machine; it cannot be switched off per fleet.',
  // kiosk.starts was a field here, and reached the machine as nothing: it reordered allowed_apps,
  // which src/aurshell/apps.c reads only as a set before sorting the programs by its own kind order.
  kiosk: 'policy: kiosk is the whole of a kiosk\'s settings; there is nothing for a kiosk block to say yet.',
  'kiosk.starts': 'Which program a kiosk starts is chosen by AurOS, not by the recipe: the locked shell puts the programs in its own order — a web browser first, then files, then office programs, then the rest — and starts the first (src/aurshell/apps.c). It cannot yet be told otherwise, so a kiosk.starts here would read like a choice and be none. A kiosk with one program starts that one.',
  'kiosk.opens': 'AurOS cannot yet tell the browser which page to open.',
  'kiosk.allowed_sites': 'AurOS cannot yet limit which sites the browser reaches. A list here would read like a fence and be none.',
  'kiosk.printing': 'Printing is kept or removed by prune.also_keep: [printing].',
  'kiosk.usb_storage': 'A kiosk is already given no right to open a USB stick; there is nothing to switch.',
  'kiosk.forget_session_after_minutes': 'AurOS does not wipe a kiosk session after a pause yet.',
  'kiosk.restart_daily_at': 'AurOS has no scheduled restart yet.',
  'theme.preset': 'AurOS themes are chosen by name; write theme: sandstone for a light one, or nocturne, slate, moss, ember or synthwave for a dark one.',
  'theme.accent': 'Each AurOS theme\'s colours are checked together for contrast (tools/contrast.c). A custom accent would skip that check, so a theme is chosen whole, by name.',
  'theme.text_scale': 'Text size is not a profile setting yet; a person can change it in Settings when the policy allows.',
  'theme.cursor_size': 'Pointer size is not a profile setting yet.',
})

// LATHE's words for things this form names differently, and the word to write instead.
const LAYOUT_SYNONYMS = table({ windows: 'taskbar', mac: 'dock', simple: 'tiles', 'browser-first': 'dock' })
const THEME_SYNONYMS = table({ light: 'sandstone', dark: 'nocturne', 'high contrast': null, 'follow the system': null, 'user chooses': null })

// ── YAML: a strict subset ───────────────────────────────────────────────────────────────────────
//
// Enough for a recipe and nothing more: block maps, block lists, one-line flow lists and maps,
// plain / single- / double-quoted scalars, folded and literal block text, and comments. Everything
// else is refused LOUDLY, with the line, because a YAML feature this reader half-understands is a
// recipe that means one thing to a reviewer and another to the compiler.
//
// Three refusals that look fussy and are not:
//   * unquoted yes/no/on/off/y/n — other YAML readers turn these into true/false and this one would
//     not; a word two tools disagree about must not reach a build. Write true/false, or quote it.
//   * numbers in any form but 12 and 1.5 — 0x1, +1, 1e3 and 010 all mean something different to
//     somebody. A plain 1 means 1 to everybody.
//   * an unquoted time like 03:30 — YAML 1.1 reads that as the number 210.

export class YamlError extends Error {
  constructor (line, message) { super(`line ${line}: ${message}`); this.line = line; this.bare = message }
}

// True/TRUE/False/FALSE are booleans to YAML 1.2's core schema and to YAML 1.1; only the lowercase
// spelling is read here, so the others are refused rather than read as words.
const BOOLISH = /^(?:y|Y|yes|Yes|YES|n|N|no|No|NO|on|On|ON|off|Off|OFF|True|TRUE|False|FALSE)$/
const NULLISH = /^(?:~|null|Null|NULL)$/
const INT = /^-?(?:0|[1-9][0-9]*)$/
const DEC = /^-?(?:0|[1-9][0-9]*)\.[0-9]+$/
// Anything some YAML reader would take as a number, other than the two plain forms above:
// 0x1, 0o7, 0b1, +1, 1e3, 010, .5, 1., 1_000, .inf, .nan.
const NUMBERISH = /^[-+]?(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|[0-9][0-9_]*(?:\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\.[0-9_]+(?:[eE][-+]?[0-9]+)?|\.(?:inf|Inf|INF|nan|NaN|NAN))$/
const SEXAGESIMAL = /^[0-9]+(?::[0-5]?[0-9])+(?:\.[0-9]*)?$/
const DATEISH = /^[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}(?:[Tt ].*)?$/
const KEY = /^[A-Za-z_][A-Za-z0-9_-]*$/
// A JavaScript object reads this key as its prototype, not as a key: `__proto__: 1` vanished, and a
// map under it became values the recipe appeared not to have.
const PROTO_KEY_WHY = '"__proto__" is not a key a recipe can use: the program reading it would take it as something other than a key.'
// Deeper than any recipe nests (three levels), and shallow enough that absurd input is a refusal
// with a line number rather than a stack overflow.
const MAX_DEPTH = 16

function plainValue (raw, line) {
  const s = raw
  if (s === 'true') return true
  if (s === 'false') return false
  if (BOOLISH.test(s)) throw new YamlError(line, `"${s}" is ambiguous: some YAML readers treat it as true/false and some as a word. Write true or false, or put it in quotes if you mean the word.`)
  if (NULLISH.test(s)) throw new YamlError(line, `"${s}" means "nothing". Delete the line instead of writing an empty value.`)
  if (INT.test(s)) return Number(s)
  if (DEC.test(s)) return Number(s)
  if (SEXAGESIMAL.test(s)) throw new YamlError(line, `"${s}" looks like a time. Put it in quotes ("${s}"): some YAML readers turn an unquoted time into a number.`)
  if (DATEISH.test(s)) throw new YamlError(line, `"${s}" looks like a date. Put it in quotes: some YAML readers turn an unquoted date into a date object.`)
  if (NUMBERISH.test(s)) throw new YamlError(line, `"${s}" is a number written in a way different YAML readers understand differently. Write it plainly, like 12 or 1.5, or put it in quotes if it is not a number.`)
  return s
}

function readQuoted (text, i, line) {
  const q = text[i]
  let out = ''
  let j = i + 1
  if (q === "'") {
    while (j < text.length) {
      if (text[j] === "'") {
        if (text[j + 1] === "'") { out += "'"; j += 2; continue }
        return { value: out, end: j + 1 }
      }
      out += text[j++]
    }
    throw new YamlError(line, 'a quoted text is not closed on this line. Quoted text must open and close on one line.')
  }
  while (j < text.length) {
    const c = text[j]
    if (c === '"') return { value: out, end: j + 1 }
    if (c === '\\') {
      const e = text[j + 1]
      const simple = { '"': '"', '\\': '\\', '/': '/', n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', 0: '\0' }
      if (e in simple) { out += simple[e]; j += 2; continue }
      if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(j + 2, j + 6))) { out += String.fromCharCode(parseInt(text.slice(j + 2, j + 6), 16)); j += 6; continue }
      throw new YamlError(line, `the escape "\\${e ?? ''}" is not one this reader knows. Use \\n, \\t, \\", \\\\ or \\uXXXX.`)
    }
    out += c; j++
  }
  throw new YamlError(line, 'a quoted text is not closed on this line. Quoted text must open and close on one line.')
}

// Strip a trailing comment from an unquoted stretch: '#' at the start or after whitespace.
function stripComment (s) {
  const m = /(^|\s)#/.exec(s)
  return (m ? s.slice(0, m.index) : s).replace(/\s+$/, '')
}

const RESERVED_START = /^[&*!%@`|>?]/

function scalarFrom (text, line, { inFlow = false } = {}) {
  // text: already trimmed on the left; may carry a trailing comment.
  if (text.startsWith('"') || text.startsWith("'")) {
    const { value, end } = readQuoted(text, 0, line)
    const rest = text.slice(end)
    if (stripComment(rest).trim() !== '') throw new YamlError(line, `unexpected text after the closing quote: "${rest.trim()}".`)
    return value
  }
  const s = stripComment(text).trim()
  if (s === '') throw new YamlError(line, 'a value is missing.')
  if (RESERVED_START.test(s)) {
    const what = { '&': 'an anchor', '*': 'an alias', '!': 'a tag', '%': 'a directive', '@': 'a reserved character', '`': 'a reserved character', '|': 'block text', '>': 'block text', '?': 'a complex key' }[s[0]]
    throw new YamlError(line, `"${s[0]}" starts ${what}, which recipes do not use. If you mean the text, put it in quotes.`)
  }
  if (s.startsWith('[') || s.startsWith('{')) throw new YamlError(line, inFlow ? 'a list or map inside a one-line list is not supported. Write it as an indented block.' : 'internal: flow value reached scalarFrom')
  if (s.startsWith('- ') || s === '-') throw new YamlError(line, 'a "-" list item cannot be written after a key on the same line. Start the list on the next line, indented.')
  if (/:\s/.test(s) || s.endsWith(':')) throw new YamlError(line, `"${s}" contains ": ", which YAML reads as the start of a key. Put the text in quotes.`)
  if (inFlow && /[[\]{}]/.test(s)) throw new YamlError(line, `"${s}" contains a bracket inside a one-line list. Put it in quotes.`)
  return plainValue(s, line)
}

// Split a one-line flow collection body on top-level commas, respecting quotes.
function splitFlow (body, line) {
  const parts = []
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '"' || c === "'") {
      const { end } = readQuoted(body, i, line)
      cur += body.slice(i, end); i = end - 1; continue
    }
    if (c === '[' || c === '{') throw new YamlError(line, 'a list or map inside a one-line list is not supported. Write it as an indented block.')
    if (c === '#' && (i === 0 || /\s/.test(body[i - 1]))) throw new YamlError(line, 'a comment inside a one-line list is not supported.')
    if (c === ',') { parts.push(cur); cur = ''; continue }
    cur += c
  }
  parts.push(cur)
  const trimmed = parts.map((p) => p.trim())
  if (trimmed.length === 1 && trimmed[0] === '') return []
  if (trimmed.some((p) => p === '')) throw new YamlError(line, 'an empty item in a one-line list (two commas together, or a comma at the end).')
  return trimmed
}

function flowFrom (text, line) {
  const open = text[0]
  const close = open === '[' ? ']' : '}'
  // find the matching close on this line, outside quotes
  let i = 1
  for (; i < text.length; i++) {
    const c = text[i]
    if (c === '"' || c === "'") { i = readQuoted(text, i, line).end - 1; continue }
    if (c === '[' || c === '{') throw new YamlError(line, 'a list or map inside a one-line list is not supported. Write it as an indented block.')
    if (c === close) break
  }
  if (i >= text.length) throw new YamlError(line, `a one-line ${open === '[' ? 'list' : 'map'} is not closed with "${close}" on the same line. Either close it on this line or write it as an indented block.`)
  const rest = text.slice(i + 1)
  if (stripComment(rest).trim() !== '') throw new YamlError(line, `unexpected text after "${close}": "${rest.trim()}".`)
  const items = splitFlow(text.slice(1, i), line)
  if (open === '[') return items.map((it) => scalarFrom(it, line, { inFlow: true }))
  const out = {}
  for (const it of items) {
    const m = /^([A-Za-z_][A-Za-z0-9_-]*):(?:\s+(.*))?$/.exec(it)
    if (!m) throw new YamlError(line, `"${it}" is not a "key: value" pair.`)
    if (m[2] === undefined || m[2].trim() === '') throw new YamlError(line, `"${m[1]}" has no value.`)
    if (m[1] === '__proto__') throw new YamlError(line, PROTO_KEY_WHY)
    if (Object.prototype.hasOwnProperty.call(out, m[1])) throw new YamlError(line, `"${m[1]}" appears twice in this map.`)
    out[m[1]] = scalarFrom(m[2], line, { inFlow: true })
  }
  return out
}

/** Parse a recipe. Throws YamlError (with .line) on anything outside the subset. */
export function parseYaml (text) {
  if (typeof text !== 'string') throw new YamlError(0, 'the recipe must be text.')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const raw = text.split('\n').map((l) => l.replace(/\r$/, ''))
  const lines = [] // {no, indent, text} for content lines; block scalars read raw lines themselves
  for (let i = 0; i < raw.length; i++) {
    const l = raw[i]
    const lead = /^[ \t]*/.exec(l)[0]
    if (lead.includes('\t')) throw new YamlError(i + 1, 'a tab is used for indentation. Use spaces: tabs mean different widths in different editors, so the nesting you see may not be the nesting the compiler reads.')
    const body = l.slice(lead.length)
    if (body === '' || body.startsWith('#')) continue
    if (/^(?:---|\.\.\.)(?:\s|$)/.test(body) && lead === '') throw new YamlError(i + 1, `"${body.slice(0, 3)}" marks a YAML document boundary. A recipe is one document; remove the line.`)
    lines.push({ no: i + 1, indent: lead.length, text: body })
  }
  if (lines.length === 0) throw new YamlError(1, 'the recipe is empty.')
  let pos = 0
  let injected = null // a virtual line: the map that starts on a "- key: value" line

  const peek = () => injected ?? lines[pos]
  const take = () => { if (injected) { const l = injected; injected = null; return l } return lines[pos++] }

  function blockScalar (indicator, parent, line) {
    if (!/^[|>]-?$/.test(indicator)) throw new YamlError(line, `"${indicator}" is not supported. Use > or >- for a paragraph, | or |- to keep line breaks.`)
    // read raw lines after `line` until a non-empty line with indent <= parent
    const startRaw = line // 1-based number of the key line; raw[line] is the next one
    const body = []
    let r = startRaw
    let blockIndent = -1
    while (r < raw.length) {
      const l = raw[r]
      if (l.trim() === '') { body.push(''); r++; continue }
      const ind = /^ */.exec(l)[0].length
      if (/^ *\t/.test(l)) throw new YamlError(r + 1, 'a tab is used for indentation. Use spaces.')
      if (ind <= parent) break
      if (blockIndent < 0) blockIndent = ind
      if (ind < blockIndent) throw new YamlError(r + 1, 'this line of text is indented less than the first line of the same text.')
      body.push(l.slice(blockIndent).replace(/\r$/, ''))
      r++
    }
    while (body.length && body[body.length - 1] === '') body.pop()
    if (blockIndent < 0) throw new YamlError(line, 'block text is announced and nothing follows it.')
    // skip the content lines we consumed
    while (pos < lines.length && lines[pos].no <= r) pos++
    let value
    if (indicator[0] === '|') value = body.join('\n')
    else {
      value = ''
      for (let k = 0; k < body.length; k++) {
        const b = body[k]
        if (b === '') { value += '\n'; continue }
        if (value !== '' && !value.endsWith('\n')) value += ' '
        value += b
      }
    }
    return indicator.endsWith('-') ? value : value + '\n'
  }

  function valueAfterKey (rest, ind, line) {
    // rest: text after "key:" (may be empty / comment)
    const t = stripComment(rest).trim()
    if (t === '') {
      const nx = peek()
      if (!nx || nx.indent <= ind) {
        // a list may sit at the same indent as its key
        if (nx && nx.indent === ind && (nx.text === '-' || nx.text.startsWith('- '))) return block(ind)
        throw new YamlError(line, 'this key has no value. Write one, or delete the line.')
      }
      return block(nx.indent)
    }
    const r = rest.trimStart()
    if (r[0] === '|' || r[0] === '>') return blockScalar(stripComment(r).trim(), ind, line)
    if (r[0] === '[' || r[0] === '{') return flowFrom(r, line)
    return scalarFrom(r, line)
  }

  function mapEntry (l, ind, into) {
    const m = /^([^\s:#"'][^:#]*?):(?=\s|$)(.*)$/.exec(l.text)
    if (!m) {
      if (l.text.startsWith('"') || l.text.startsWith("'")) throw new YamlError(l.no, 'quoted keys are not used in recipes. Write the key plainly.')
      throw new YamlError(l.no, `"${l.text}" is not "key: value". Every line in a recipe is a key, a list item starting "- ", or a comment.`)
    }
    const key = m[1]
    if (key === '<<') throw new YamlError(l.no, 'merge keys (<<) are not used in recipes. Write each field out.')
    if (!KEY.test(key)) throw new YamlError(l.no, `"${key}" is not a plain key. Keys are letters, digits, "_" and "-".`)
    if (key === '__proto__') throw new YamlError(l.no, PROTO_KEY_WHY)
    if (Object.prototype.hasOwnProperty.call(into, key)) throw new YamlError(l.no, `"${key}" appears twice. A second one would silently replace the first.`)
    into[key] = valueAfterKey(m[2], ind, l.no)
  }

  let depth = 0
  function block (ind) {
    const first = peek()
    if (depth >= MAX_DEPTH) throw new YamlError(first.no, `nested more than ${MAX_DEPTH} levels deep. A recipe nests three at most.`)
    depth++
    try { return blockBody(ind, first) } finally { depth-- }
  }
  function blockBody (ind, first) {
    if (first.indent !== ind) throw new YamlError(first.no, 'unexpected indentation.')
    const isSeq = first.text === '-' || first.text.startsWith('- ')
    if (isSeq) {
      const out = []
      while (peek() && peek().indent === ind && (peek().text === '-' || peek().text.startsWith('- '))) {
        const l = take()
        const rest = l.text.slice(1)
        const t = stripComment(rest).trim()
        if (t === '') throw new YamlError(l.no, 'an empty list item. Write a value after "- " or delete the line.')
        const body = rest.trimStart()
        const itemIndent = ind + 1 + (rest.length - body.length)
        if (body.startsWith('- ') || body === '-') throw new YamlError(l.no, 'a list inside a list is not used in recipes.')
        if (/^[^\s:#"'[{][^:#]*?:(?=\s|$)/.test(body)) {
          injected = { no: l.no, indent: itemIndent, text: body }
          out.push(block(itemIndent))
        } else if (body[0] === '[' || body[0] === '{') {
          out.push(flowFrom(body, l.no))
        } else if (body[0] === '|' || body[0] === '>') {
          out.push(blockScalar(stripComment(body).trim(), ind, l.no))
        } else {
          out.push(scalarFrom(body, l.no))
        }
      }
      const nx = peek()
      if (nx && nx.indent > ind) throw new YamlError(nx.no, 'this line is indented more than the list item above it, but is not part of it.')
      return out
    }
    const out = {}
    while (peek() && peek().indent === ind) {
      const l = take()
      if (l.text === '-' || l.text.startsWith('- ')) throw new YamlError(l.no, 'a list item where a "key: value" was expected.')
      mapEntry(l, ind, out)
      const nx = peek()
      if (nx && nx.indent > ind) throw new YamlError(nx.no, 'this line is indented more than the key above it, but that key already has a value.')
    }
    return out
  }

  if (lines[0].indent !== 0) throw new YamlError(lines[0].no, 'the first line of a recipe must not be indented.')
  const doc = block(0)
  if (pos < lines.length) throw new YamlError(lines[pos].no, 'this line is indented less than the document allows.')
  if (Array.isArray(doc)) throw new YamlError(lines[0].no, 'a recipe is a set of "key: value" lines, not a list.')
  return doc
}

// ── YAML out ────────────────────────────────────────────────────────────────────────────────────
//
// Deterministic: fields in the canonical order of FIELDS (unknown keys after them, alphabetically),
// set-like lists sorted, each top-level field preceded by the sentence a reader needs. The output
// parses back, through parseYaml, to exactly the recipe that was emitted (normalised: lists sorted).

const SORTED_LISTS = new Set(['other_languages', 'apps', 'prune.also_keep', 'prune.also_remove'])

function plainSafe (s) {
  if (s === '' || s !== s.trim()) return false
  if (/[\n\r\t\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/.test(s)) return false
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(s)) return false
  if (/:\s|:$|\s#/.test(s)) return false
  try { return plainValue(s, 0) === s } catch { return false }
}
function scalarOut (v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`emitYaml: ${v} cannot be written`)
    const s = String(v)
    if (!INT.test(s) && !DEC.test(s)) throw new Error(`emitYaml: ${s} cannot be written as a plain number`)
    return s
  }
  if (typeof v !== 'string') throw new Error(`emitYaml: cannot write a ${typeof v} as a scalar`)
  return plainSafe(v) ? v : JSON.stringify(v)
}
function flowItemOut (v) {
  const s = scalarOut(v)
  return /[,[\]{}]/.test(s) && !s.startsWith('"') ? JSON.stringify(v) : s
}

function orderedKeys (obj, prefix) {
  const known = prefix === '' ? TOP : childrenOf(prefix)
  const keys = Object.keys(obj)
  return [...known.filter((k) => keys.includes(k)), ...keys.filter((k) => !known.includes(k)).sort()]
}

export function emitYaml (recipe) {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) throw new Error('emitYaml: a recipe is a map')
  const out = ['# AurOS organisation recipe. Check it with: recipes/bin/auros-recipe validate <this file>', '']
  const writeMap = (obj, prefix, indent) => {
    for (const k of orderedKeys(obj, prefix)) {
      const path = prefix ? `${prefix}.${k}` : k
      const v = obj[k]
      const pad = '  '.repeat(indent)
      if (indent === 0) {
        if (out[out.length - 1] !== '') out.push('')
        const f = FIELD[path]
        if (f) out.push(`# ${f.says}`)
      }
      if (Array.isArray(v)) {
        const items = SORTED_LISTS.has(path) ? [...v].sort(cmp) : v
        if (items.length === 0) { out.push(`${pad}${k}: []`); continue }
        if (items.every((x) => typeof x !== 'object' || x === null)) {
          out.push(`${pad}${k}:`)
          for (const it of items) out.push(`${pad}  - ${scalarOut(it)}`)
        } else {
          out.push(`${pad}${k}:`)
          for (const it of items) {
            if (typeof it !== 'object' || it === null || Array.isArray(it)) { out.push(`${pad}  - ${scalarOut(it)}`); continue }
            const ks = Object.keys(it)
            if (ks.length === 0) throw new Error('emitYaml: an empty map in a list cannot be written')
            ks.forEach((ik, n) => out.push(`${pad}  ${n === 0 ? '- ' : '  '}${ik}: ${scalarOut(it[ik])}`))
          }
        }
      } else if (v !== null && typeof v === 'object') {
        if (Object.keys(v).length === 0) throw new Error(`emitYaml: ${path} is an empty map, which cannot be written`)
        out.push(`${pad}${k}:`)
        writeMap(v, path, indent + 1)
      } else if (typeof v === 'string' && path === 'for' && /^\S+(?: \S+)+\n?$/.test(v) && v.length > 60) {
        // Folded text: `>` keeps one final newline, `>-` keeps none, and both join the lines below
        // with single spaces — so only single-spaced text is written this way, and it parses back
        // to exactly itself.
        const nl = v.endsWith('\n')
        out.push(`${pad}${k}: ${nl ? '>' : '>-'}`)
        let cur = ''
        for (const w of (nl ? v.slice(0, -1) : v).split(' ')) {
          if (cur && cur.length + 1 + w.length > 76) { out.push(`${pad}  ${cur}`); cur = '' }
          cur = cur ? `${cur} ${w}` : w
        }
        if (cur) out.push(`${pad}  ${cur}`)
      } else {
        out.push(`${pad}${k}: ${scalarOut(v)}`)
      }
    }
  }
  writeMap(recipe, '', 0)
  return out.join('\n') + '\n'
}
const cmp = (a, b) => (String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0)
// flowItemOut is kept for callers that want one-line lists; emitYaml itself writes block lists.
export { flowItemOut as _flowItemOut }

// ── validate ────────────────────────────────────────────────────────────────────────────────────

// Text that will be written between double quotes in a file bash `source`s. A quote, a dollar, a
// backtick or a backslash there is not a typo — it is a command. Refused in every free-text field,
// and compile() refuses again before writing, so the rule holds even if validate is bypassed.
const SHELL_UNSAFE = /["$`\\]/
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/

function nearest (word, choices, n = 3) {
  // The search is quadratic in the word's length. No name here is longer than 40 characters, so a
  // word of more than 64 is near none of them, and is not searched (a 1 MB timezone took minutes).
  if (String(word).length > 64) return []
  const w = String(word).toLowerCase()
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 1; j <= b.length; j++) d[0][j] = j
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
      }
    }
    return d[a.length][b.length]
  }
  return choices
    .map((c) => ({ c, d: c.toLowerCase().includes(w) || w.includes(c.toLowerCase()) ? 0 : dist(w, c.toLowerCase()) }))
    .filter((x) => x.d <= Math.max(3, Math.floor(w.length / 2)))
    .sort((a, b) => a.d - b.d || cmp(a.c, b.c))
    .slice(0, n)
    .map((x) => x.c)
}
const quoteList = (xs) => xs.map((x) => `"${x}"`).join(', ')
const isMap = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Check a parsed recipe. Every error has a `path` (the field, dotted) and a `message` written for
 * the person who maintains the fleet, not for an engineer.
 */
export function validate (recipe) {
  const errors = []
  const err = (path, message) => errors.push({ path, message })

  if (!isMap(recipe)) {
    err('', 'A recipe is a set of "key: value" lines.')
    return { ok: false, errors }
  }

  // ── unknown keys, refused keys, and keys the engine cannot honour — at every level ─────────────
  const known = new Set(FIELDS.map((f) => f.path))
  const checkKeys = (obj, prefix) => {
    for (const k of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${k}` : k
      if (known.has(path)) continue
      if (!prefix && REFUSED_BY_DESIGN[k]) { err(path, `"${k}" is refused, and that is a feature. ${REFUSED_BY_DESIGN[k]}`); continue }
      if (NOT_IN_THE_ENGINE[path]) { err(path, `"${path}" is not something AurOS can do yet, so this form refuses it rather than record it and ignore it. ${NOT_IN_THE_ENGINE[path]}`); continue }
      const siblings = prefix ? childrenOf(prefix) : TOP
      const near = nearest(k, siblings)
      err(path, `"${k}" is not a field of this form${prefix ? ` under ${prefix}` : ''}.${near.length ? ` Did you mean ${quoteList(near)}?` : ''} A misspelt field is refused rather than ignored: an instruction that is quietly dropped still reads as though it was followed.`)
    }
  }
  checkKeys(recipe, '')
  for (const p of ['organisation', 'prune', 'desktop', 'kiosk']) if (isMap(recipe[p])) checkKeys(recipe[p], p)

  for (const f of FIELDS) {
    if (!f.required) continue
    const parts = f.path.split('.')
    const parent = parts.length === 1 ? recipe : recipe[parts[0]]
    if (parts.length === 2 && !isMap(parent)) continue // the parent's own error covers it
    if (!(parts[parts.length - 1] in parent)) err(f.path, `"${f.path}" is missing. ${f.says}`)
  }

  // Only a paragraph (`for`) may span lines: compile folds it to one. Any other text is written as
  // one KEY="value" line, and compile refuses a line break there — so validate refuses it first.
  const str = (path, v, { max = 200, min = 1, paragraph = false } = {}) => {
    if (typeof v !== 'string') { err(path, `"${path}" must be text.`); return false }
    if (!paragraph && /[\n\r\u2028\u2029\u0085]/.test(v)) { err(path, `"${path}" must be one line of text. It is written into the profile as a single line, and a line break there would end it.`); return false }
    if (INVISIBLE.test(paragraph ? v.replace(/\n/g, ' ') : v)) { err(path, `"${path}" contains an invisible or control character. Characters like a right-to-left override make a file read one way in a review and mean another to the compiler.`); return false }
    if (SHELL_UNSAFE.test(v)) { err(path, `"${path}" contains a quote mark, $, \` or \\. This text is written into a file the build runs as a shell script, where those characters are commands, not punctuation. Leave them out.`); return false }
    if (v.trim().length < min) { err(path, `"${path}" is empty.`); return false }
    if (v.length > max) { err(path, `"${path}" is longer than ${max} characters.`); return false }
    return true
  }
  const bool = (path, v) => {
    if (typeof v === 'boolean') return true
    err(path, `"${path}" must be true or false.`)
    return false
  }
  const list = (path, v) => {
    if (!Array.isArray(v)) { err(path, `"${path}" must be a list, one item per line starting "- " (or [a, b] on one line).`); return null }
    const seen = new Set()
    for (const x of v) {
      if (typeof x !== 'string') { err(path, `every item of "${path}" must be text; ${JSON.stringify(x)} is not.`); return null }
      if (seen.has(x)) { err(path, `"${x}" is listed twice in ${path}.`); return null }
      seen.add(x)
    }
    return v
  }

  // schema
  if ('schema' in recipe && recipe.schema !== SCHEMA_VERSION) {
    err('schema', `schema is ${JSON.stringify(recipe.schema)}; this compiler only knows schema ${SCHEMA_VERSION}. It stops rather than guess what an unfamiliar version meant.`)
  }

  // name
  if ('name' in recipe && typeof recipe.name === 'string') {
    const n = recipe.name
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(n) || n.length > 40) {
      err('name', `"${n}" is not a valid name. Use lowercase letters, digits and single hyphens, starting with a letter, at most 40 characters — e.g. "lincoln-high-library".`)
    } else if (RESERVED_NAMES.includes(n)) {
      err('name', `"${n}" is the name of a profile that ships with AurOS. Compiling this recipe would overwrite it${n === 'desktop' ? ', and a recipe named desktop would inherit from itself' : ''}. Choose your own name.`)
    }
  } else if ('name' in recipe) err('name', '"name" must be text.')

  // for
  if ('for' in recipe && str('for', recipe.for, { max: 600, paragraph: true })) {
    const words = recipe.for.trim().split(/\s+/).length
    if (words < 20) err('for', `"for" has ${words} word${words === 1 ? '' : 's'}; it needs at least twenty. In a year this paragraph is the only thing that explains what these machines are for, to whoever inherits them.`)
  }

  // organisation
  if ('organisation' in recipe) {
    if (!isMap(recipe.organisation)) err('organisation', '"organisation" must contain display_name: <your organisation\'s name>.')
    else if ('display_name' in recipe.organisation) str('organisation.display_name', recipe.organisation.display_name, { max: 60 })
  }

  // language
  const langs = []
  const langScripts = new Set()
  if ('language' in recipe) {
    const L = recipe.language
    if (typeof L !== 'string') err('language', '"language" must be text, e.g. "Marathi".')
    else if (/^[a-z]{2,3}(?:_[A-Z]{2})?(?:\.[A-Za-z0-9-]+)?$/.test(L)) err('language', `"${L}" is a locale code. Write the language the way a person says it, e.g. ${quoteList(Object.keys(LANGUAGES).slice(0, 3))}: someone who wrote ${L} cannot check it, and someone who wrote a name can.`)
    else if (!LANGUAGES[L]) err('language', `"${L}" is not a language this form knows.${nearest(L, Object.keys(LANGUAGES)).length ? ` Did you mean ${quoteList(nearest(L, Object.keys(LANGUAGES)))}?` : ''} The languages are: ${Object.keys(LANGUAGES).join(', ')}.`)
    else { langs.push(L); langScripts.add(LANGUAGES[L].script) }
  }
  if ('other_languages' in recipe) {
    const ol = list('other_languages', recipe.other_languages)
    if (ol) {
      if (ol.length === 0) err('other_languages', '"other_languages" is an empty list. Delete the line if there are none: an empty list reads like a decision and changes nothing.')
      for (const L of ol) {
        if (!LANGUAGES[L]) err('other_languages', `"${L}" is not a language this form knows.${nearest(L, Object.keys(LANGUAGES)).length ? ` Did you mean ${quoteList(nearest(L, Object.keys(LANGUAGES)))}?` : ''}`)
        else if (L === recipe.language) err('other_languages', `"${L}" is already the main language; listing it again adds nothing.`)
        else { langs.push(L); langScripts.add(LANGUAGES[L].script) }
      }
    }
  }

  // keyboard
  if ('keyboard' in recipe) {
    const k = recipe.keyboard
    if (typeof k !== 'string' || !KEYBOARDS[k]) err('keyboard', `"${k}" is not a keyboard this form knows.${typeof k === 'string' && nearest(k, Object.keys(KEYBOARDS)).length ? ` Did you mean ${quoteList(nearest(k, Object.keys(KEYBOARDS)))}?` : ''}`)
    else if (KEYBOARDS[k].script !== 'Latin') err('keyboard', `"${k}" types ${KEYBOARDS[k].script}, not Latin letters. The main keyboard must be able to type a password at the console and at every password prompt, which happen before anything else starts. Put "${k}" in second_script instead, and keep the keyboard that matches the letters on the keys here.`)
  }
  const hasSecond = 'second_script' in recipe
  const hasToggle = 'switch_scripts_with' in recipe
  if (hasSecond) {
    const s = recipe.second_script
    if (typeof s !== 'string' || !KEYBOARDS[s]) err('second_script', `"${s}" is not a keyboard this form knows.${typeof s === 'string' && nearest(s, Object.keys(KEYBOARDS)).length ? ` Did you mean ${quoteList(nearest(s, Object.keys(KEYBOARDS)))}?` : ''}`)
    else if (s === recipe.keyboard) err('second_script', 'second_script is the same as keyboard; there would be nothing to switch to.')
    if (!hasToggle) err('switch_scripts_with', `second_script needs switch_scripts_with: the keys that switch to it. A second layout nobody can reach is not a feature. Choose one of: ${Object.keys(TOGGLES).join(', ')}.`)
  }
  if (hasToggle) {
    const t = recipe.switch_scripts_with
    if (typeof t !== 'string' || !TOGGLES[t]) err('switch_scripts_with', `"${t}" is not one of: ${Object.keys(TOGGLES).join(', ')}.`)
    if (!hasSecond) err('switch_scripts_with', 'switch_scripts_with is set, but there is no second_script to switch to.')
  }

  // timezone
  if ('timezone' in recipe) {
    const tz = recipe.timezone
    if (typeof tz !== 'string') err('timezone', '"timezone" must be text, like Asia/Kolkata.')
    else if (/^(?:auto|local|geoip|automatic)$/i.test(tz)) err('timezone', `"${tz}" is refused. A machine that guesses its own zone makes two builds of one recipe into two different computers. Name the zone, like Asia/Kolkata.`)
    else if (/^(?:UTC|GMT)?[+-]\d/.test(tz)) err('timezone', `"${tz}" is an offset, which is wrong for half of every year wherever clocks change. Name the zone, like Europe/London.`)
    else if (!ZONE_SET.has(tz)) {
      const near = nearest(tz, ZONES)
      err('timezone', `"${tz}" is not a zone name this image has. Write it the way the zone database does, like Asia/Kolkata or America/Los_Angeles.${near.length ? ` Did you mean ${quoteList(near)}?` : ''} A zone the machine does not have leaves its clock on UTC without a word.`)
    }
  }

  // policy (read early: many rules depend on it)
  const policy = recipe.policy
  if ('policy' in recipe && !POLICIES[policy]) err('policy', `"${policy}" is not a policy. There are exactly four: open, managed, locked, kiosk. A mode nobody has checked is in force on a booted machine is a mode we cannot offer.`)

  // apps
  const apps = 'apps' in recipe ? list('apps', recipe.apps) : null
  if (apps) {
    if (apps.length === 0) err('apps', '"apps" is empty. A machine with no programs on it is not one anybody can use.')
    for (const a of apps) {
      if (/\d/.test(a)) { err('apps', `"${a}" contains a digit. Program names here never do, so a version number cannot be written: holding a program at a version is how a machine ends up unpatched while looking maintained.`); continue }
      if (/^[a-z0-9.+-]+$/.test(a) && !APPS[a]) {
        const owner = Object.keys(APPS).find((n) => APPS[n].packages.includes(a))
        err('apps', `"${a}" looks like a package name. Write programs the way people say them${owner ? ` — this one is "${owner}"` : ''}.`)
        continue
      }
      if (REFUSED_APPS[a]) { err('apps', `"${a}" is not offered. ${REFUSED_APPS[a]}`); continue }
      if (!APPS[a]) { const near = nearest(a, Object.keys(APPS)); err('apps', `"${a}" is not a program this form knows.${near.length ? ` Did you mean ${quoteList(near)}?` : ''} The programs are: ${Object.keys(APPS).join(', ')}.`); continue }
      const door = APPS[a].door
      if (door === 'installs-software' && POLICIES[policy] && policy !== 'open') err('apps', `"${a}" installs programs, and policy: ${policy} does not let the person at the machine install anything. It would be a button that looks like a button and refuses. Take it out, or use policy: open.`)
      if (door === 'installs-software' && policy === 'open' && isMap(recipe.desktop) && recipe.desktop.can_install_apps === false) err('apps', `"${a}" installs programs, and desktop.can_install_apps is false. It would be a button that refuses.`)
      if (door === 'terminal' && (policy === 'locked' || policy === 'kiosk')) err('apps', `"${a}" opens a command line, which undoes policy: ${policy} by being there. Take it out, or choose a less locked policy.`)
      if (door === 'terminal' && isMap(recipe.desktop) && recipe.desktop.can_reach_a_terminal === false) err('apps', `"${a}" opens a command line, and desktop.can_reach_a_terminal is false. Those two contradict each other.`)
    }
    if (policy === 'kiosk' && apps.length > 9) err('apps', `a kiosk shows its programs as a strip of large buttons, and nine is the most it can show. This lists ${apps.length}.`)
  }

  // prune
  let keepOnly = null
  if ('prune' in recipe) {
    const p = recipe.prune
    if (!isMap(p)) err('prune', '"prune" must contain keep_only_the_apps_above: true or false.')
    else {
      if ('keep_only_the_apps_above' in p && bool('prune.keep_only_the_apps_above', p.keep_only_the_apps_above)) keepOnly = p.keep_only_the_apps_above
      if (keepOnly === false && policy === 'kiosk') err('prune.keep_only_the_apps_above', 'a kiosk has to be keep_only_the_apps_above: true. Otherwise every program on the standard desktop is on the kiosk too.')
      if ('also_keep' in p) {
        const ak = list('prune.also_keep', p.also_keep)
        if (keepOnly === false) err('prune.also_keep', 'also_keep only means something with keep_only_the_apps_above: true. Here nothing is swept away, so nothing needs keeping, and a line that protects nothing must not read like protection. Delete it.')
        else if (ak) {
          if (ak.length === 0) err('prune.also_keep', 'also_keep is an empty list. Delete the line if there is nothing to keep.')
          for (const g of ak) {
            if (!CAPABILITIES[g]) err('prune.also_keep', `"${g}" is not something that can be kept. The choices are: ${Object.keys(CAPABILITIES).join(', ')}.${APPS[g] ? ' Programs are kept by listing them in apps.' : ''}`)
          }
        }
      }
      if ('also_remove' in p) {
        const ar = list('prune.also_remove', p.also_remove)
        if (keepOnly === true) err('prune.also_remove', 'with keep_only_the_apps_above: true, everything not in apps is already removed, so also_remove would remove nothing more — and the report would credit it for removals it did not make. Delete it.')
        else if (ar) {
          if (ar.length === 0) err('prune.also_remove', 'also_remove is an empty list. Delete the line if there is nothing to remove.')
          for (const g of ar) {
            if (ABSENT_GROUPS[g]) { err('prune.also_remove', `"${g}": ${ABSENT_GROUPS[g]}`); continue }
            if (/screen reader|magnifier|on-screen keyboard|accessibility|orca/i.test(g)) { err('prune.also_remove', `"${g}" is refused: accessibility tools are never removable, in any policy. A machine a disabled person cannot use is not one we build.`); continue }
            if (!GROUPS[g]) { const near = nearest(g, Object.keys(GROUPS)); err('prune.also_remove', `"${g}" is not a group that can be removed.${near.length ? ` Did you mean ${quoteList(near)}?` : ''} The groups are: ${Object.keys(GROUPS).join(', ')}. Anything the machine needs to start, update or reach the network has no name here, so it cannot be written.`); continue }
            const clash = (GROUPS[g].apps ?? []).filter((x) => apps?.includes(x))
            if (clash.length) err('prune.also_remove', `"${g}" would remove ${quoteList(clash)}, which apps asks for. The recipe says both; it has to say one.`)
          }
        }
      }
    }
  }

  // desktop
  if ('desktop' in recipe) {
    const d = recipe.desktop
    if (policy === 'kiosk') err('desktop', 'a kiosk has no desktop, so there is nothing for this block to describe. Delete it — a setting that cannot apply is refused rather than ignored.')
    else if (!isMap(d)) err('desktop', '"desktop" must be a block of settings.')
    else {
      if (Object.keys(d).length === 0) err('desktop', '"desktop" is empty. Delete it.')
      if ('layout' in d) {
        const l = d.layout
        if (typeof l !== 'string' || !LAYOUTS[l]) {
          const syn = typeof l === 'string' ? LAYOUT_SYNONYMS[l] : undefined
          if (l === 'locked') err('desktop.layout', '"locked" is not chosen as a layout: it is what policy: kiosk gives a machine.')
          else err('desktop.layout', `"${l}" is not a layout.${syn ? ` The nearest AurOS layout is "${syn}" — ${LAYOUTS[syn].says}` : ''} The layouts are: ${Object.keys(LAYOUTS).map((k) => `${k} (${LAYOUTS[k].says})`).join('; ')}`)
        }
      }
      if ('can_install_apps' in d && bool('desktop.can_install_apps', d.can_install_apps)) {
        if (d.can_install_apps === true && POLICIES[policy] && policy !== 'open') err('desktop.can_install_apps', `policy: ${policy} already decides that the person at the machine does not install programs. can_install_apps: true contradicts it; delete the line or use policy: open.`)
      }
      if ('can_reach_a_terminal' in d && bool('desktop.can_reach_a_terminal', d.can_reach_a_terminal)) {
        if (d.can_reach_a_terminal === true && policy === 'locked') err('desktop.can_reach_a_terminal', 'policy: locked means nothing can be reached from the machine; a console contradicts it.')
      }
      if ('can_choose_wifi' in d) bool('desktop.can_choose_wifi', d.can_choose_wifi)
      if ('screen_off_minutes' in d) {
        const m = d.screen_off_minutes
        if (!Number.isInteger(m) || m < 0 || m > 120) err('desktop.screen_off_minutes', `"${m}" must be a whole number of minutes from 0 (never) to 120. A screen that never goes dark on a laptop is an hour of battery thrown away and a bank statement shown to the room.`)
      }
    }
  }

  // theme
  if ('theme' in recipe) {
    const t = recipe.theme
    if (isMap(t)) {
      for (const sub of Object.keys(t)) {
        const p = `theme.${sub}`
        err(p, NOT_IN_THE_ENGINE[p] ? `"${p}" is not something AurOS can do. ${NOT_IN_THE_ENGINE[p]}` : `"${p}" is not a field. Choose a theme by name: theme: sandstone.`)
      }
      if (Object.keys(t).length === 0) err('theme', 'theme is an empty block. Write theme: <name>.')
    } else if (typeof t !== 'string' || !THEMES[t]) {
      const syn = typeof t === 'string' && t in THEME_SYNONYMS ? THEME_SYNONYMS[t] : undefined
      const extra = syn ? ` The ${t} theme is called "${syn}".` : syn === null ? ` AurOS has no "${t}" theme.` : ''
      err('theme', `"${t}" is not an AurOS theme.${extra} The themes are: ${Object.keys(THEMES).map((k) => `${k} (${THEMES[k].variant})`).join(', ')}.`)
    }
  }

  // Last, and only for an otherwise valid recipe: what compile would write must fit what the shell reads.
  if (errors.length === 0 && (policy === 'locked' || policy === 'kiosk')) {
    const list = allowListOf(recipe, programsOf(recipe).appSet)
    if (list.length > ALLOW_LIST_MAX) err('apps', `policy: ${policy} lists every program that may be opened, and these programs' names come to ${list.length} characters. The shell reads the first ${ALLOW_LIST_MAX} and drops the rest without a word, so the last programs would be installed and could never be opened. List fewer programs, or use policy: managed.`)
  }

  return { ok: errors.length === 0, errors }
}

// ── compile ─────────────────────────────────────────────────────────────────────────────────────

export const GENERATED_MARK = '# GENERATED by recipes/bin/auros-recipe from an organisation recipe. Do not edit:'

// The longest allowed_apps the shell reads whole. aurshell reads /etc/auros/policy.conf with
// src/common/theme.c, which keeps THEME_VAL_LEN - 1 = 191 bytes of a value and drops the rest without
// a word (and src/aurshell/shell.h holds 255). A locked recipe listing most of the catalogue compiled
// to 237: the programs at the end of the list were installed and could never be opened.
// recipes/test/options.test.mjs re-reads both sizes from the headers.
export const ALLOW_LIST_MAX = 191

const uniq = (xs) => [...new Set(xs)]
const words = (xs) => xs.join(' ')

// The programs a valid recipe puts on the machine. Shared by validate (which must refuse what compile
// cannot write) and compile.
function programsOf (r) {
  const keepOnly = r.prune.keep_only_the_apps_above
  const desk = isMap(r.desktop) ? r.desktop : {}
  const removedGroups = keepOnly ? [] : (r.prune.also_remove ?? [])
  const groupApps = removedGroups.flatMap((g) => GROUPS[g].apps ?? [])
  let appSet
  if (keepOnly) appSet = [...r.apps]
  else appSet = uniq([...DEFAULT_APPS.filter((a) => !groupApps.includes(a)), ...r.apps])
  // A program that installs software, on a machine whose person may not install anything, is a
  // button that refuses. Listing one explicitly is refused by validate; the standard desktop's two
  // are dropped here, and the report says so.
  const userMayInstall = r.policy === 'open' && desk.can_install_apps !== false
  const doorsDropped = userMayInstall ? [] : appSet.filter((a) => APPS[a].door === 'installs-software')
  appSet = appSet.filter((a) => !doorsDropped.includes(a)).sort(cmp)
  return { removedGroups, groupApps, userMayInstall, doorsDropped, appSet }
}

// What policy.conf's allowed_apps says. Under locked and kiosk, the launch names of every program on
// the machine; otherwise empty, which aurshell reads as "everything installed".
function allowListOf (r, appSet) {
  if (r.policy !== 'locked' && r.policy !== 'kiosk') return ''
  return uniq(appSet.flatMap((a) => APPS[a].launch)).join(' ')
}

/**
 * Compile a valid recipe to a forge profile.
 * @returns {{profile: string, report: {installed: object[], removed: object[], notes: string[]}}}
 */
export function compile (recipe) {
  const v = validate(recipe)
  if (!v.ok) {
    const e = new Error(`the recipe is not valid:\n${v.errors.map((x) => `  ${x.path || '(recipe)'}: ${x.message}`).join('\n')}`)
    e.errors = v.errors
    throw e
  }
  const r = recipe
  const policy = r.policy
  const P = POLICIES[policy]
  const keepOnly = r.prune.keep_only_the_apps_above
  const desk = isMap(r.desktop) ? r.desktop : {}
  const installed = []
  const removed = []
  const notes = []

  // ── which programs end up on the machine ──────────────────────────────────────────────────────
  const { removedGroups, groupApps, userMayInstall, doorsDropped, appSet } = programsOf(r)

  for (const a of appSet) {
    const A = APPS[a]
    installed.push({ item: a, packages: [...A.packages], why: r.apps.includes(a) ? `asked for in apps${A.shownAs && A.shownAs !== a ? ` (shown on the machine as "${A.shownAs}")` : ''}` : `part of the standard desktop${A.shownAs && A.shownAs !== a ? ` (shown as "${A.shownAs}")` : ''}` })
  }
  for (const a of DEFAULT_APPS) {
    if (appSet.includes(a)) continue
    let why
    if (doorsDropped.includes(a)) why = `it installs programs, and ${policy === 'open' ? 'desktop.can_install_apps is false' : `policy: ${policy} does not let the person at the machine install anything`}; it would be a button that refuses`
    else if (groupApps.includes(a)) why = `prune.also_remove names "${removedGroups.find((g) => (GROUPS[g].apps ?? []).includes(a))}"`
    else why = 'not in apps, and prune.keep_only_the_apps_above is true'
    removed.push({ item: a, packages: [...APPS[a].packages], why })
  }

  // ── capabilities: printing, bluetooth ─────────────────────────────────────────────────────────
  const capsKept = keepOnly ? (r.prune.also_keep ?? []) : Object.keys(CAPABILITIES).filter((c) => !removedGroups.includes(c))
  for (const c of Object.keys(CAPABILITIES)) {
    if (capsKept.includes(c)) installed.push({ item: c, packages: [...CAPABILITIES[c].packages], why: keepOnly ? 'kept by prune.also_keep' : 'part of the standard desktop' })
    else removed.push({ item: c, packages: [...CAPABILITIES[c].packages], why: keepOnly ? 'not in prune.also_keep, and prune.keep_only_the_apps_above is true' : `prune.also_remove names "${c}"` })
  }

  // ── the package lists ─────────────────────────────────────────────────────────────────────────
  const capDropped = Object.keys(CAPABILITIES).filter((c) => !capsKept.includes(c)).flatMap((c) => CAPABILITIES[c].packages)
  const hardware = BASE.packages_hardware.filter((p) => !capDropped.includes(p))
  const filesWanted = new Set([...FILES_SUPPORT, ...appSet.filter((a) => APPS[a].from === 'files').flatMap((a) => APPS[a].packages)])
  const files = BASE.packages_files.filter((p) => filesWanted.has(p))
  const appPkgs = uniq(appSet.filter((a) => APPS[a].from === 'apps').flatMap((a) => APPS[a].packages))
  const langList = [r.language, ...(r.other_languages ?? [])]
  const extra = uniq(langList.flatMap((L) => LANGUAGES[L].packages)).sort(cmp)
  const store = appSet.includes('Software Centre') ? 'gnome-software' : 'none'
  const hasFirefox = appSet.includes('Firefox')

  // ── keyboard ──────────────────────────────────────────────────────────────────────────────────
  const K = KEYBOARDS[r.keyboard]
  let kbLayout = K.layout
  let kbVariant = K.variant
  let kbOptions = ''
  if (r.second_script) {
    const S = KEYBOARDS[r.second_script]
    kbLayout = `${K.layout},${S.layout}`
    kbVariant = K.variant || S.variant ? `${K.variant},${S.variant}` : ''
    kbOptions = TOGGLES[r.switch_scripts_with]
  }

  // ── policy ────────────────────────────────────────────────────────────────────────────────────
  const allow = {
    allow_user_install: userMayInstall ? 'yes' : 'no',
    allow_settings_change: P.allow_settings_change,
    allow_theme_change: P.allow_theme_change,
    allow_network_change: policy === 'kiosk' ? 'no' : ('can_choose_wifi' in desk ? (desk.can_choose_wifi ? 'yes' : 'no') : P.allow_network_change),
    allow_tty: 'can_reach_a_terminal' in desk ? (desk.can_reach_a_terminal ? 'yes' : 'no') : P.allow_tty,
  }
  const allowedApps = allowListOf(r, appSet)
  if (allowedApps.length > ALLOW_LIST_MAX) throw new Error(`compile: refusing to write allowed_apps: ${allowedApps.length} characters, and the shell reads ${ALLOW_LIST_MAX}`)
  const archetype = policy === 'kiosk' ? 'locked' : desk.layout

  // ── the profile text ──────────────────────────────────────────────────────────────────────────
  const lines = []
  const section = (title) => { lines.push('', `# ── ${title} ${'─'.repeat(Math.max(3, 66 - title.length))}`) }
  const set = (key, value, ...comment) => {
    const val = String(value)
    if (SHELL_UNSAFE.test(val) || /[\n\r]/.test(val)) throw new Error(`compile: refusing to write ${key}: its value contains a character the shell would treat as code`)
    for (const c of comment) lines.push(`# ${c}`)
    lines.push(`${key}="${val}"`)
  }

  lines.push(GENERATED_MARK)
  lines.push('#   change the recipe, then: recipes/bin/auros-recipe compile <recipe> -o profiles/<name>.profile')
  lines.push('#   what it installs and removes, in plain words: recipes/bin/auros-recipe explain <recipe>')
  lines.push('inherit="desktop"')

  section('who these machines are for')
  set('profile_id', r.name, `name: ${r.name}`)
  set('profile_name', r.organisation.display_name, `organisation.display_name: ${r.organisation.display_name}`)
  set('brand_name', r.organisation.display_name)
  set('profile_description', r.for.trim().replace(/\s+/g, ' '), 'for: (shown by `build/forge list`)')

  section('language, keyboard, clock')
  set('locale', LANGUAGES[r.language].locale, `language: ${r.language}`)
  set('extra_locales', words((r.other_languages ?? []).map((L) => LANGUAGES[L].locale).sort(cmp)), `other_languages: ${(r.other_languages ?? []).slice().sort(cmp).join(', ') || '(none)'}`)
  set('keyboard_layout', kbLayout, `keyboard: ${r.keyboard}${r.second_script ? `; second_script: ${r.second_script}` : ''}`)
  set('keyboard_variant', kbVariant)
  set('keyboard_options', kbOptions, `switch_scripts_with: ${r.switch_scripts_with ?? '(no second layout)'}`)
  set('timezone', r.timezone, `timezone: ${r.timezone}`)

  section('programs')
  set('packages_apps', words(appPkgs), `apps: ${r.apps.slice().sort(cmp).join(', ')}`, `prune.keep_only_the_apps_above: ${keepOnly}`)
  if (words(files) !== words(BASE.packages_files)) set('packages_files', words(files), 'the standard desktop\'s programs that stay (desktop.profile packages_files, minus what is removed)')
  if (words(hardware) !== words(BASE.packages_hardware)) set('packages_hardware', words(hardware), `desktop.profile packages_hardware, minus: ${Object.keys(CAPABILITIES).filter((c) => !capsKept.includes(c)).join(', ')}`)
  set('packages_extra', words(extra), `what ${langList.slice().sort(cmp).join(', ')} need${langList.length === 1 ? 's' : ''}: translations, and fonts for scripts the base fonts cannot draw`)
  set('software_store', store, appSet.includes('Software Centre') ? (r.apps.includes('Software Centre') ? 'Software Centre: asked for in apps' : 'Software Centre: part of the standard desktop') : 'no Software Centre on these machines')
  if (!hasFirefox) set('browser_source', 'none', 'Firefox is not in apps')

  section(`policy: ${policy}`)
  lines.push(`# ${P.says}`)
  set('kiosk_mode', P.kiosk_mode)
  set('allow_user_install', allow.allow_user_install, ...(policy === 'open' && desk.can_install_apps === false ? ['desktop.can_install_apps: false'] : []))
  set('allow_settings_change', allow.allow_settings_change)
  set('allow_theme_change', allow.allow_theme_change)
  set('allow_network_change', allow.allow_network_change, ...('can_choose_wifi' in desk ? [`desktop.can_choose_wifi: ${desk.can_choose_wifi}`] : []))
  set('allow_tty', allow.allow_tty, ...('can_reach_a_terminal' in desk ? [`desktop.can_reach_a_terminal: ${desk.can_reach_a_terminal}`] : []))
  set('allowed_apps', allowedApps, policy === 'kiosk' ? `only these programs exist for the person at the machine; ${appSet.length === 1 ? `${appSet[0]} starts by itself` : 'the shell starts the first in its own order (a web browser first)'}` : policy === 'locked' ? 'only these programs can be opened' : 'empty: everything installed may be opened')
  if (archetype) set('shell_archetype', archetype, policy === 'kiosk' ? 'policy: kiosk is the locked shell' : `desktop.layout: ${desk.layout}`)
  if ('screen_off_minutes' in desk) set('screen_off_minutes', desk.screen_off_minutes, `desktop.screen_off_minutes: ${desk.screen_off_minutes}`)

  if (r.theme) {
    section('look')
    set('theme', r.theme, `theme: ${r.theme} (${THEMES[r.theme].variant})`)
  }

  // ── notes: what a reader of the report must know ──────────────────────────────────────────────
  if (!hasFirefox) notes.push('There is no web browser on these machines: Firefox is not in apps.')
  if (hasFirefox) notes.push('Firefox comes from Mozilla. If the machine that builds the image cannot reach Mozilla, the build stops rather than substitute another browser (build/forge, browser_fallback_ok).')
  if (policy === 'kiosk') notes.push('A kiosk here is the locked shell: the first program starts and fills the screen; there is no desktop, no settings, no console, no wifi choice and no USB mounting. AurOS cannot yet send the browser to a particular page or limit which sites it reaches.')
  if (policy === 'kiosk' && appSet.length > 1) notes.push(`Which of the ${appSet.length} programs the kiosk starts is AurOS's choice, not this recipe's: the locked shell puts a web browser first, then files, then office programs, then the rest.`)
  if (!capsKept.includes('printing')) notes.push('These machines cannot print.')
  if (r.second_script) notes.push(`${r.switch_scripts_with} switches the keyboard between ${r.keyboard} and ${r.second_script}.`)
  for (const L of langList) if (LANGUAGES[L].packages.length === 0) notes.push(`Ubuntu has no translations package for ${L}: dates, numbers and sorting follow ${L}, and most programs stay in English.`)
  notes.push('Programs from Ubuntu\'s archive are kept patched by the daily security updates. AurOS\'s own programs are part of the image and change when the image is rebuilt.')

  return { profile: lines.join('\n') + '\n', report: { installed, removed, notes } }
}

/** The report, as text a person reads before signing off. */
export function explain (recipe) {
  const { report } = compile(recipe)
  const r = recipe
  const out = []
  out.push(`${r.organisation.display_name} — ${r.name}`)
  out.push('')
  out.push(r.for.trim().replace(/\s+/g, ' '))
  out.push('')
  out.push(`Policy: ${r.policy}. ${POLICIES[r.policy].says}`)
  out.push(`Language: ${r.language}${r.other_languages ? ` (also: ${r.other_languages.join(', ')})` : ''}. Keyboard: ${r.keyboard}${r.second_script ? `, and ${r.second_script} with ${r.switch_scripts_with}` : ''}. Clock: ${r.timezone}.`)
  if (r.theme) out.push(`Look: ${r.theme}.`)
  out.push('')
  out.push('ON THESE MACHINES')
  for (const i of report.installed) out.push(`  + ${i.item} — ${i.why}  [${i.packages.join(' ')}]`)
  out.push('')
  out.push('TAKEN OUT OF THE STANDARD DESKTOP')
  if (report.removed.length === 0) out.push('  (nothing)')
  for (const i of report.removed) out.push(`  - ${i.item} — ${i.why}  [${i.packages.join(' ')}]`)
  out.push('')
  out.push('ALWAYS THERE, WHATEVER A RECIPE SAYS')
  out.push('  The kernel, the signed boot chain, the network, the security updates (unattended-upgrades),')
  out.push('  the permission system (polkitd) and the desktop itself. None of them has a name in this form,')
  out.push('  so no recipe can remove them.')
  out.push('')
  out.push('KNOW THIS')
  for (const n of report.notes) out.push(`  * ${n}`)
  return out.join('\n') + '\n'
}

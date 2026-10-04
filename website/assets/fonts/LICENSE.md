# Fonts

Self-hosted, nothing loaded from a font service.

| file | font | licence | copyright |
|---|---|---|---|
| `archivo.woff2` | Archivo (display face; variable, weight 200–600, width 100–125) | SIL OFL 1.1 | Copyright 2020 The Archivo Project Authors (Omnibus-Type) |
| `atkinson-400.woff2`, `atkinson-400i.woff2`, `atkinson-700.woff2` | Atkinson Hyperlegible (text face) | SIL OFL 1.1 | Copyright 2020 Braille Institute of America, Inc. |
| `martian-mono.woff2` | Martian Mono (variable, 300–700) | SIL OFL 1.1 | Copyright 2021 The Martian Mono Project Authors (Evil Martians) |
| `dejavu-sans.woff2`, `dejavu-sans-bold.woff2` | DejaVu Sans | Bitstream Vera licence + public-domain DejaVu changes (below) | Copyright 2003 Bitstream, Inc.; DejaVu changes are in the public domain |

**Modifications.** Archivo is the `@fontsource-variable/archivo`
5.3.0 file, instanced with fontTools to weights 200–600 and widths
100–125 (the page uses it expanded, light, and large) and subset to
Latin-1 plus typographic punctuation. DejaVu Sans is Ubuntu's `fonts-dejavu-core`, subset the
same way. Reserved Font Names are not used for the modified files'
family names in CSS beyond identifying the source. Subsetting is done by
`website/tools/fonts.sh`.

Why each one:

- **Archivo, expanded and light** for display: wide, quiet capitals and
  lowercase that read like a film's title card over a night sky, and
  nothing like a SaaS headline.
- **Atkinson Hyperlegible** for text: drawn by the Braille Institute for
  readers with low vision, which describes a lot of the people who still
  use a 2013 laptop.
- **Martian Mono** for anything that is data: numbers, file names,
  hashes, YAML.
- **DejaVu Sans** only inside the recreation of the restart screen,
  because it is the face `src/aurscreen` actually falls back to in the
  staging environment (there is no `/usr/share/auros/fonts/ui.ttf`
  there). The recreation is set in what the real screen is set in.

---|---|---|
| `atkinson-400.woff2`, `atkinson-400i.woff2`, `atkinson-700.woff2` | Atkinson Hyperlegible | Copyright 2020 Braille Institute of America, Inc. |
| `martian-mono.woff2` | Martian Mono (variable, 300–700) | Copyright 2021 The Martian Mono Project Authors (Evil Martians) |

Atkinson Hyperlegible was designed by the Braille Institute for readers
with low vision. That is why it is the text face here.

---

SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) and the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.


---

DejaVu Sans: Bitstream Vera Fonts Copyright

Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. Bitstream Vera
is a trademark of Bitstream, Inc.

Permission is hereby granted, free of charge, to any person obtaining a
copy of the fonts accompanying this license ("Fonts") and associated
documentation files (the "Font Software"), to reproduce and distribute the
Font Software, including without limitation the rights to use, copy,
merge, publish, distribute, and/or sell copies of the Font Software, and
to permit persons to whom the Font Software is furnished to do so, subject
to the following conditions:

The above copyright and trademark notices and this permission notice shall
be included in all copies of one or more of the Font Software typefaces.

The Font Software may be modified, altered, or added to, and in particular
the designs of glyphs or characters in the Fonts may be modified and
additional glyphs or characters may be added to the Fonts, only if the
fonts are renamed to names not containing either the words "Bitstream" or
the word "Vera".

This License becomes null and void to the extent applicable to Fonts or
Font Software that has been modified and is distributed under the
"Bitstream Vera" names.

The Font Software may be sold as part of a larger software package but no
copy of one or more of the Font Software typefaces may be sold by itself.

THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT OF
COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL BITSTREAM
OR THE GNOME FOUNDATION BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR
CONSEQUENTIAL DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF THE USE OF OR INABILITY TO USE THE FONT
SOFTWARE OR FROM OTHER DEALINGS IN THE FONT SOFTWARE.

Arev/DejaVu changes are in the public domain.

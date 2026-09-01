Collabrium Font Pack
=====================

Contains the two Collabrium typefaces as variable fonts (one file per
family/style covers the full weight range — no need for separate Light/
Regular/Bold files):

  Mulish/
    Mulish[wght].ttf           — weights 200-1000
    Mulish-Italic[wght].ttf    — italic, weights 200-1000
    OFL.txt                    — license

  Source Serif 4/
    SourceSerif4[opsz,wght].ttf         — optical size 8-60, weights 200-900
    SourceSerif4-Italic[opsz,wght].ttf  — italic
    OFL.txt                             — license

Both are licensed under the SIL Open Font License 1.1 — free for
commercial use, self-hosting, and modification, no attribution required.
Sourced from Google Fonts' official repository (github.com/google/fonts).

How to install
---------------
A browser cannot install a font into your operating system directly —
no website can write into your system Fonts folder, on any OS. This is
a deliberate security boundary, not a limitation of this pack. After
downloading and unzipping:

  macOS:    Double-click each .ttf file, then click "Install Font" in
            Font Book (or drag the files into Font Book directly).
  Windows:  Right-click each .ttf file and choose "Install" (or
            "Install for all users").
  Linux:    Copy the .ttf files into ~/.local/share/fonts/, then run
            `fc-cache -f`.

Once installed, "Mulish" and "Source Serif 4" will be available in any
app on your machine (Figma, Illustrator, Word, PowerPoint, etc.), not
just the browser.

See DESIGN-SYSTEM.md in the parent folder for how each typeface is used
across the Collabrium design system.

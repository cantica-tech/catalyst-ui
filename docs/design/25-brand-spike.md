# 25 — Brand: the research spike (R6.21 rewritten as its own roadmap)

R6.21 ("Brand identity and naming") was one row in the UI roadmap. It touches the name, the law, the visual
identity, every published surface and several people, so it is more than one entity. It is rewritten here as its own
roadmap, `brand` (`development/roadmaps/brand.md` in the UI's criterion), with its own workflow (`WORKFLOW-`, "Brand
change"). The main roadmap keeps R6.21 as a pointer to it. This document is the spike: what, where, who and how,
researched on 2026-10-19 before any roadmap step was written. It is also the roadmap's source.

Inputs: [`09`](09-ui-brand-portability.md) §5 (the brand proposal), decision C3 in [`../decisions.md`](../decisions.md)
(the product's name), and an inventory of the repositories, the GitHub organisation and the published packages.

## 1. What: the parts of a brand

| Part                     | Today                                                                                                        | Open                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| **Product name**         | **Catalyst Studio** (C3, 2026-10-16)                                                                         | a legal trademark search was never run                                                       |
| **Framework / CLI name** | `catalyst` (the command, the repositories, the Python package)                                               | stays the command name whatever happens (`09` §5.2)                                          |
| **Maker**                | Cantica Tech / CanticaTech (the Marketplace publisher ID)                                                    | two spellings, both in use                                                                   |
| **Internal vocabulary**  | criterion, kernel, module, journal                                                                           | `09` §5.2 proposes "the Record" for the criterion; not decided                               |
| **Mark and app icon**    | a stock flask drawing (`catalyst.svg`, a Flaticon-style `Capa_1` export) and PNGs made from it               | the licence is unknown; no mark of our own exists                                            |
| **Colours**              | the Studio's tokens (`static/studio.css`): accent `#0b5cad`, status ok, warn, error and info, light and dark | `09` §5.3 proposes indigo with an amber accent; status colours stay independent of the brand |
| **Type**                 | the system font stacks                                                                                       | `09` §5.3 proposes Inter or IBM Plex Sans, with a mono font that distinguishes 0/O and l/1   |
| **Voice and tagline**    | the Marketplace title's subtitle "rules, journal and traceability for AI-assisted development"               | four tagline candidates in `09` §5.3; none chosen                                            |
| **Brand in the CLI**     | none                                                                                                         | `09` §5.4: a one-line footer (`catalyst · checked 14:08 · journal ok · 0 drift`)             |
| **Guidelines**           | none                                                                                                         | a short guide and an asset pack once the above exist                                         |

## 2. Where: every surface that carries the brand

**The UI's repository**

- VS Code extension: `displayName` "Catalyst Studio — rules, journal and traceability for AI-assisted development",
  publisher `CanticaTech`, `resources/icon.png` (256 px), `resources/catalyst.svg` and nine view icons using it,
  light and dark icon sets.
- Desktop app: `productName` "Catalyst Studio", `appId` `com.cantica-tech.catalyst-studio`, `build/icon.png`
  (1024 px, from which `.icns`, `.ico` and the Linux icons are made), the `.deb` maintainer "Cantica Tech", the installers'
  file names `catalyst-studio-<version>-…`.
- The Studio: the page title, the colour and type tokens, the status colours.
- `README.md`: still says the extension is published "as **Catalyst framework**" (out of date since C3).
- 6 files still say "Catalyst UI", 15 say `catalyst-ui` (some rightly: the repository name).

**The kernel's repository and the modules**

- `README.md` headed `# catalyst`; `pyproject.toml`'s description "The catalyst framework's CLI".
- The README badge (`catalyst badge`): grey and one status colour, Verdana, no mark.
- No logo or image of any kind.

**GitHub and distribution**

- The organisation `cantica-tech`: an agency description ("a small, dedicated team… for every client"), a default
  avatar, the site `cantica-tech.com`.
- Repository descriptions: the UI's says "Catalyst UI — traceability chain browser…"; the kernel's and the process
  module's are empty.
- The distribution repository's README ("CanticaTech Release Artifacts Repository").
- The VS Code Marketplace listing (the extension's name, icon, description and gallery banner).
- The company site's repository (`cantica-web`, private), with no product page known.

**Not found:** a domain for the product, social accounts, a press or brand page.

## 3. Who

| Role                                             | Who                                                 | Does                                                                                                                                                           |
| ------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owner (the deployment's Product Owner and Admin) | Olivier Steck, the only registered user             | decides the name, the tagline, the mark; pays for filings; signs each step                                                                                     |
| Trademark counsel                                | external, not chosen yet                            | runs the official clearance (USPTO, EUIPO and the owner's home office) and files; an EEA representative is required for an EUIPO filing by a non-EEA applicant |
| Designer                                         | external, or Claude drafting for the owner's choice | the mark, the icon set, the colour and type system                                                                                                             |
| Developer (Claude)                               | the agent                                           | the inventory, the tokens, applying the brand to every surface, the CLI footer, the guide                                                                      |
| Release Manager                                  | the owner today                                     | the Marketplace listing, the store pages, the installers' names and icons                                                                                      |

Only the owner is registered in the UI's IAM. If the counsel or a designer is to sign anything in the criterion, they
are registered first (`catalyst user add`).

## 4. How

**The law first.** A name is only worth an identity once it can be kept. An informal search on 2026-10-16 (C3) and
another on 2026-10-19 found many uses of "Catalyst" in software: Tailwind's React kit, an open-source "Catalyst UI",
npm's `catalyst-ui`, a small "Catalyst Studio" on the Marketplace, Sony's Catalyst Production Suite, ETC's Catalyst
media server, Catalyst Development Corporation (developer components since 1995), catalyst.io (customer experience),
Coupa Catalyst (AI services), Catalyst AI (a machine-learning platform), Zoho Catalyst. None of these searches is a legal
clearance. The relevant classes are 9 (downloadable software: the extension, the desktop app, the CLI) and 42
(software services, a future shared server). Reported fees, to be checked on the offices' own fee pages: USPTO about
$350 per class, EUIPO about €850 for one class and €50 for the second.

**Then three outcomes:**

1. **Keep** "Catalyst Studio": the identity work goes ahead under it.
2. **Make it distinctive:** keep "Catalyst" with a distinctive mark and maker name (for example "Cantica Catalyst
   Studio"), if counsel says the bare word is weak but a compound is registrable.
3. **Rename the product:** keep `catalyst` as the command (`09` §5.2) and give the product a new name, evoking record,
   provenance or trace; every surface in §2 changes.

**What can start before the law answers**, because it holds under any outcome:

- Replace the stock flask with assets we own (its licence is unknown).
- Put the colour and type system in the Studio's tokens.
- Fix the inconsistencies: "Catalyst framework" in the README, "Catalyst UI" in the repository description, the empty
  descriptions, the two spellings of the maker.

**What waits for the law:** the mark itself, the tagline in print, the Marketplace banner, any filing, the website
page.

**Every brand change goes through the same steps:** the workflow "Brand change" in the UI's criterion.

## 5. The roadmap's items

Each item becomes one `RM-` row of the `brand` roadmap, `Not triaged` until a `FEAT-` or `REQ-` takes it on.

1. **Spike: what, where, who, how.** This document. Done when the owner has read it.
2. **Legal clearance.** Counsel searches "Catalyst" and "Catalyst Studio" in classes 9 and 42 (USPTO, EUIPO, the
   owner's home office) and advises: keep, make distinctive, or rename. Needs the owner to choose counsel.
3. **Name decision.** The owner picks one of the three outcomes from the advice; recorded as a decision (C3 updated).
4. **Asset licence audit and replacement.** Every image in the repositories traced to its source; the stock flask
   replaced by a neutral mark of our own until the real mark exists.
5. **Colour and type system.** The tokens of `09` §5.3 in the Studio (light, dark, high contrast), status colours
   unchanged, the fonts bundled (no network fonts in the desktop app).
6. **Mark and app icon.** The mark, at every size from 16 px monochrome to 1024 px, with the `.icns`, `.ico`, the
   Linux icons, the VS Code activity-bar icon and the Marketplace icon. Waits on 3.
7. **Voice and tagline.** One tagline chosen; a short voice guide (precise, calm, evidence first).
8. **Name consistency sweep.** Every surface of §2 made to agree: READMEs, repository descriptions, the
   organisation's profile, `pyproject.toml`, the distribution README, the maker's spelling.
9. **Brand in the CLI.** The one-line footer of `09` §5.4 in the kernel, product-agnostic (it names catalyst, not the
   Studio).
10. **Store and web presence.** The Marketplace listing (banner, screenshots, description), the GitHub release pages,
    a product page on the company site, a domain check. Waits on 3.
11. **Brand guide and asset pack.** One page and the files, published beside the releases.
12. **Internal vocabulary.** Whether "criterion" becomes "the Record" (`09` §5.2). A large change across the kernel's
    documents and commands; recommended: not now. The owner decides.

Order: 1 → 2 → 3 → 6, 10; items 4, 5, 7, 8 and 9 can run beside the legal track; 11 comes last; 12 is a decision
on its own.

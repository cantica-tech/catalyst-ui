# 26 — Editing in the Studio: create, edit and retire, by who may (design for the owner, 2026-10-25)

> **Status: proposed.** The owner's request of 2026-10-25. The rules it shows are the kernel's, in catalyst's design
> `31` (who creates, edits and retires what, and through which workflow) and `30` (visibility); this note is what the
> Studio shows for them. It writes through the host, as decision W1 has every write ([`24`](24-studio-gaps-roadmap.md)
> §2): the host confirms in its own dialog and runs a catalyst verb, journaled.

## 1. What the owner asked

- **Admins** (the Admin, and a Criterion Admin in their project) create, edit and delete entities directly in the
  Studio; if a change would break anything, they are told before it becomes permanent.
- **Everyone else** creates only some types (those of the modules running in the criterion); they edit or delete an
  entity directly only when it is linked to nothing; a linked one goes through a workflow (the criterion's, its
  type's, or a tag workflow whose participants they are).
- **Deleting is retiring** (the entity is closed in place, its ID never reused), and **an ID is never editable**.

## 2. What the Studio shows

### 2.1 The editor

One form per entity, made from its type's definition (fields, kinds, allowed values), not from a hand-written screen
per type, so any module's types work.

| Field                                                  | In the form                                                                                  |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `ID`, `Name`, `Filename`, `Signed-off-by`              | read-only, always                                                                            |
| back-referenced fields (`Sources`, `Builds`, `Steps`…) | read-only, with a link to the entity that cites it                                           |
| `Status`                                               | not a field: the moves its workflow allows, as buttons ("Move to…")                          |
| enum, user, date, reference fields                     | a picker of the allowed values, people of the project, linkable entities the person can see  |
| `Tags`                                                 | a tag picker; removing a tag a tag workflow targets is shown as a request (design `31` §4.4) |
| sections (`## Description`…)                           | markdown editors                                                                             |

Its buttons depend on who is looking and what the entity is linked to (§3).

### 2.2 Create

"New…" lists only the types the person may create: an admin, every type of the running modules; anyone else, the
types their grants and the modules allow (design `31` §4.1), read from `catalyst identity whoami` and the modules'
definitions. The form is the editor's, empty; "Create" runs `catalyst new`.

### 2.3 Retire

"Retire" (never "Delete": nothing is removed) moves the entity to its type's closed state, with the reason asked for.
The entity stays in every list that shows closed entities, marked retired.

## 3. Who sees which buttons

| Who                          | The entity is                          | Edit and Retire                             | What happens                                                                |
| ---------------------------- | -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------- |
| Admin, Criterion Admin       | anything they can see                  | **Save** / **Retire**                       | first a preview (§4), then the verb runs                                    |
| Anyone else                  | unlinked, theirs (created or assigned) | **Save** / **Retire**                       | the verb runs, after the host's confirmation                                |
| Anyone else                  | linked                                 | **Request change** / **Request retirement** | a proposal opens, which the governing workflow takes through its moves (§5) |
| A tag workflow's participant | carrying the workflow's tag            | the workflow's moves on open requests       | they review and move requests, whatever their other rights                  |

A button the person may not use is not shown; the Studio never offers what catalyst would refuse.

## 4. The admins' forewarning: "What this would change"

Before an admin's Save, Create or Retire becomes permanent, the host runs it as `catalyst try` (a scratch copy,
nothing kept) and the Studio shows a panel:

- **Nothing breaks**: "No finding added", and **Make it permanent**.
- **Something would break**: each `check` finding the change adds, worded as catalyst words it (a reference left
  dangling, a guard no longer holding, a workflow refusing a move), each linking to the entity concerned; and the
  findings it clears. The button reads **Make it permanent anyway**; confirming records "forewarned: …" in the
  journal entry. **Cancel** keeps nothing.

The panel is the impact view the Studio already has for `try` ([`24`](24-studio-gaps-roadmap.md), G1), opened on
every admin write instead of on request.

## 5. A request through a workflow

- "Request change" shows the edited form side by side with the current entity, then opens a proposal (`catalyst
propose`) with the person's reason.
- The entity shows a banner, "A change is waiting: REQ… → RECON…", and the workflow's path: its states, where the
  request is, and who may make the next move (the role, or the tag workflow's participants).
- Each move is a button for the people allowed to make it; the last one applies the change, journaled.
- The person who asked sees it in their inbox until it is applied or refused.

## 6. Where it works

In the VS Code extension and the desktop app, whose hosts confirm and run verbs (W1). In a plain browser the Studio
stays read-only, as today: the editor opens, its buttons do not.

## 7. Depends on

- catalyst's design `31`: contributors' types and grants, the workflow governing edits and retirements, tags and tag
  workflows, a preview on every writing verb.
- catalyst's design `30`: only what the person can see is offered, as a value, a link or a target.
- The host's action allow-list ([`24`](24-studio-gaps-roadmap.md), R6.30) gaining `new`, `propose`, the field edits
  and `try` for the preview.

## 8. Still to decide

1. **Editing many at once** (batch, R6.17): admins only (proposed), or anyone on unlinked entities of theirs.
2. **Fields edited in the form, or a markdown view too** for an admin who wants the raw file (proposed: the form
   only; the raw file stays in the editor of the host).

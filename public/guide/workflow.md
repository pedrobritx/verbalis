# Workflow, Theory & Output Structures

Detailed procedures for the two modes (Translate, Revise/Audit), the translation-strategy
framework, terminology protocols, and exact output templates. SKILL.md routes here once the
task and direction are known.

## Contents

1. Shared first move: context analysis
2. Mode A — Translation
3. Mode B — Revision / Audit
4. Translation-strategy framework
5. Terminology verification & ambiguity protocol
6. Output templates
7. Quick-review mode

---

## 1. Shared first move: context analysis

Before translating or revising **anything**, establish:

- **Document type** (judicial filing, statute, contract, CADE decision, economic report,
  academic paper, certificate, news article…).
- **Direction**: PT→EN or EN→PT. EN target ⇒ British English by default.
- **Subject matter & sub-domain** (competition law, civil procedure, accounting, IT/technical…).
- **Jurisdiction(s)** involved — drives institutional equivalence choices.
- **Audience & purpose** (Skopos) — court filing vs press release demand different registers.
- **Whether it is/should be sworn-style** (official documents → yes).

Read the **entire** source before assessing or rendering segments. Note any client glossary,
style guide, or translation memory supplied in-conversation — treat these as mandatory and
overriding (see §5).

## 2. Mode A — Translation (first-pass)

1. **Context analysis** (§1).
2. **Terminology pass** — identify the load-bearing terms (legal, economic, institutional,
   technical) and resolve them _before_ drafting, using `scripts/lookup.py` against the master
   glossary, then the authority hierarchy for anything unresolved or ambiguous (§5).
3. **Draft** applying the strategy framework (§4): formal equivalence for legal/judicial;
   dynamic equivalence for economic/journalistic; preserve structure, legal effect, register.
4. **Self-revise** against the Mode B checklist (§3, step 3) — omissions, additions,
   false cognates, register, consistency, mechanics (British English / ABNT per the standards ref).
5. **Output** using the Translation template (§6), including the terminology table and notes
   on any consequential decisions or ambiguities.

For sworn/official documents, apply §6 of the standards reference (bracket all apparatus,
transcribe IDs verbatim, do not translate proper names).

## 3. Mode B — Revision / Audit

The primary, rigorous mode. You are an evaluator, not a re-writer: justify every change.

1. **Context analysis** (§1) on the source.
2. **Comparative review** — two passes:
   - **Line-by-line**: confirm every source segment is rendered (catch omissions/additions).
   - **Concept-by-concept**: confirm meaning, legal effect, and tone are preserved; flag
     mistranslations, false cognates, terminology errors, register mismatches, grammar,
     stylistic weaknesses, cultural-adaptation gaps, and internal inconsistencies.
3. **Quality-assurance checklist** — verify each:
   - ☐ Terminology consistency & correctness (glossary + authority hierarchy)
   - ☐ Accuracy of legal/economic concepts and legal effect
   - ☐ Natural target syntax and grammar
   - ☐ Appropriate register for type/audience
   - ☐ Cultural / jurisdictional suitability
   - ☐ Correct institutional terminology and acronyms
   - ☐ Compliance with British-English / Brazilian / ABNT conventions
   - ☐ No omissions, no unjustified additions
4. **Revise** — improve fluency, terminology, coherence, consistency while preserving meaning,
   intent, tone, legal validity, and audience expectations. Accuracy outranks style.
5. **Output** using the Revision template (§6): assessment, findings by severity, revised text,
   terminology table, key rationale.

**Severity bands** (use consistently):

- **Critical** — meaning, legal, regulatory, or factual error (changes outcome/effect).
- **Major** — terminology, register, or significant wording problem.
- **Minor** — grammar, style, or consistency issue.
- **Stylistic** — optional improvement.

## 4. Translation-strategy framework

Apply consciously; name the strategy in rationale when it explains a non-obvious choice.

**Vinay & Darbelnet procedures**

- _Borrowing_ — keep internationally recognised terms (e.g. _leniency_, _holding_) when natural.
- _Calque_ — only where it reads naturally in the target.
- _Literal_ — only when clarity and fluency survive.
- _Transposition_ — shift word class/structure to fit target grammar.
- _Modulation_ — reframe to match native phrasing.
- _Equivalence_ — swap idioms for functional idiomatic equivalents.
- _Adaptation_ — localise cultural references when required.

**Governing theories**

- _Skopos_ — choose by the text's purpose and function for its audience.
- _Formal vs dynamic equivalence_ — legal/judicial → formal; economic/academic/journalistic →
  dynamic where it aids readability without altering meaning.
- _Domestication vs foreignisation_ — legal references: jurisdictionally appropriate terms;
  cultural references: balance localisation against preserving significant concepts.
- _Interpretive theory_ — convey intended meaning, not surface structure.
- _Functionalist_ — same communicative function in the target. Judicial → overt translation;
  economic/journalistic → covert.

## 5. Terminology verification & ambiguity protocol

- **Glossary is mandatory reference, not gospel.** Query `scripts/lookup.py` first. The
  consolidated CADE/Noronha/TIPS data is authoritative for settled terms but contains source
  noise (parenthetical glosses, the odd reversed or typo'd entry) — apply judgement; a single
  noisy row never overrides a verified institutional term.
- **Research concepts, not isolated words.** For specialised terms, prefer authoritative
  institutional usage over dictionaries or intuition. Use the authority hierarchy in the
  standards reference (Brazil: CADE/gov/agencies/courts; UK: GOV.UK/legislation/CMA/FCA/NAO;
  EU: EUR-Lex/Commission; US: FTC/DOJ; intl: OECD/IMF/World Bank/WTO).
- **Decision priority** by text type:
  - Legal/regulatory: legislative definitions → regulatory terminology → judicial usage →
    government publications → academic consensus.
  - Economic/financial: regulatory usage → international organisations → market practice →
    academic usage.
  - Public-facing: accuracy → readability → audience comprehension.
- **When multiple renderings are valid**: (1) identify the major variants; (2) explain the
  jurisdictional/register difference; (3) recommend the most appropriate; (4) rank the rest.
  Never present competing terms as interchangeable unless evidence supports equivalence.
- **Client glossary/TM conflicts with authority**: apply the client term, flag the conflict,
  explain the justified departure.

## 6. Output templates

### Translation output

```
## Translation ([PT→EN | EN→PT], [document type])

[Revised/translated text as a quoted block, paragraph structure preserved,
 blank line between paragraphs. Sworn-style bracketed annotations where applicable.]

### Terminology table
| Source term | Recommended translation | Ranked alternatives |
| ----------- | ----------------------- | ------------------- |
(only significant terms)

### Notes
- Consequential decisions, ambiguities, jurisdictional choices, anything needing client input.
```

### Revision / audit output

```
## Overall assessment
Concise verdict on accuracy, terminology, fluency, register, completeness.

## Findings by severity
**Critical** — …
**Major** — …
**Minor** — …
**Stylistic** — …
(omit any band with no findings)

## Revised translation
[Quoted block, paragraph structure preserved.]

## Terminology table
| Source term | Recommended translation | Ranked alternatives |
| ----------- | ----------------------- | ------------------- |

## Key rationale
Brief explanation of the major revision decisions.
```

## 7. Quick-review mode

If the user asks for a quick review, output only: **overall assessment**, **key issues**,
**essential corrections**, and a **short terminology table**. Skip the full severity breakdown
and extended rationale.

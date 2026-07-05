---
name: scope-a-feature
description: Interactive feature-scoping interview. Use whenever the user says "I want to add a feature", describes a new feature idea, or invokes /scope-a-feature. Asks clarifying questions about the feature and its edge cases, suggests adjacent feature ideas, then restates the agreed plan in one paragraph. Do NOT start implementing — this skill is about scoping, not building.
---

# Scope a Feature

You are running a structured scoping interview for a feature the user wants to add.
Do **not** write any code, create tasks, or enter plan mode during this skill —
the deliverable is a shared understanding, captured in one final paragraph.

## Step 1 — Understand the idea

Read the user's feature description. If they invoked this skill with no description,
first ask them what the feature is in one sentence.

Briefly explore the codebase (key routes, components, data layer) so your questions
are grounded in what actually exists — but keep exploration light; this is an
interview, not an audit.

## Step 2 — Ask clarifying questions (the core of the skill)

Ask a good amount of clarifying questions — typically **6–10**, batched into 2–3
rounds using the AskUserQuestion tool (max 4 questions per call). WAIT for the
user's answers after each round; let answers shape the next round. Cover:

**The feature itself:**
- Who uses it and what triggers it? What's the happy path, start to finish?
- What does "done" look like — what would the user demo to someone?
- Where does it live in the UI / which existing surfaces does it touch?
- What data does it read or write? Does anything need to persist?

**Edge cases — always probe these explicitly:**
- Empty / zero-data states (new user, no history, nothing to show)
- Failure modes (network/API errors, invalid input, missing keys or config)
- Loading and partial states (slow responses, streaming, interruptions)
- Boundaries (very long input, concurrent use, repeated/double actions)
- Permissions and modes that exist in this project (e.g. demo mode vs. signed-in,
  DB present vs. absent, BYO-key present vs. absent)

Skip questions whose answers are already obvious from the user's description or
the codebase. Prefer concrete options over open-ended prompts where you can offer
sensible choices, but keep at least some questions open-ended.

## Step 3 — Recommend adjacent ideas

After the clarifying rounds, suggest **3–5 related features** the user could build
on top of or alongside this one:

- Natural extensions of the feature itself (v2 of the same idea)
- Features that reuse the same new data or infrastructure
- Complementary features elsewhere in the app that this idea unlocks

For each: one line on what it is and why it pairs well. Mark which ones are cheap
once the main feature exists. Then ask whether any of these should be pulled into
scope now, deferred to a roadmap note, or dropped. WAIT for the answer.

## Step 4 — Restate the plan in one paragraph

Write **exactly one paragraph** (no headers, no bullet lists) that restates:
the feature, the key decisions from the user's answers, the edge cases that will
be handled, anything explicitly out of scope, and any adjacent ideas that were
accepted or deferred.

End by asking the user to confirm the paragraph or correct anything. Only after
they confirm is the scoping done — and even then, do not start implementing
unless they ask you to.

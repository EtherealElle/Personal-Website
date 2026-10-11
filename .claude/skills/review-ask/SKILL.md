---
name: review-ask
description: Draft Google review asks for finished jobs and follow up on the quiet ones, using the private job ledger. Use when the user finishes a job, asks about reviews or their Google profile, or asks what they owe anyone.
---

# Review ask

The Google Business Profile has zero reviews, which is most of why it doesn't surface
for the business's own name. Each review is worth more than any change to the site.

## 1. See what's owed

```
python scripts/jobs.py due
```

Three buckets, and it answers nothing else:

- **`reply`** — a lead with no reply logged. Hand it to `/lead-reply`.
- **`ask_for_review`** — finished at least a day ago, never asked.
- **`nudge_review`** — asked, five or more days of silence, under two nudges.

After two nudges, a client stops appearing. They've answered. Don't ask again, and don't
suggest asking again.

If `review_link` is null, stop and get it first — an ask without the direct link is the
ask that doesn't get done:

> In Google Business Profile, tap **Ask for reviews** and copy the
> `https://g.page/r/…/review` link.

```
python scripts/jobs.py config --review-link <url>
```

That link opens the review box directly. Don't substitute a Maps or search URL, and
don't send instructions for finding the profile — that's the step people abandon.

## 2. Draft the ask

Read `docs/voice.md`. One ask per client, in their own context: name the actual job, not
"your recent project". Two or three lines for a text, which is how these should go out.

What makes these work:

- Name the job. *"the hallway door"* proves it's not a mass send.
- One link, nothing else to decide.
- Say it's short — "a line or two is plenty" removes the reason people put it off.
- Say why it matters, once, plainly: a new business, and reviews are how people find it.
- No incentive, ever. Paying for reviews breaks Google's rules and risks the profile.
  The $100 referral card is for referrals, not reviews — keep them apart, and if a
  client asks, say so.

The nudge is shorter than the ask and apologises for nothing. One line, the link again,
and an explicit out: *"and if you'd rather not, that's completely fine."* Mean it.

Give the user a fenced block per client, ready to copy, and nothing to edit.

## 3. Log it

```
python scripts/jobs.py set <id> --asked today
python scripts/jobs.py set <id> --nudged today
python scripts/jobs.py set <id> --review in     # when it appears. stops the asking.
```

Only log what the user confirms they sent. A drafted ask is not a sent ask.

## 4. Mark finished jobs

If the user mentions finishing a job that isn't in the ledger yet:

```
python scripts/jobs.py add --name "<name>" --town "<town>" --job "<what it was>"
python scripts/jobs.py set <id> --stage done --finished today
```

Which also puts it in line for an ask tomorrow.

## The six already done

Six jobs are finished and none of them has been asked. They're the whole backlog and the
highest-value thing on the list. If the ledger is empty, offer to add them from what the
user remembers — name, town, job — and draft all six asks in one go. The jobs were in
Decatur, East Point, Clarkston and East Atlanta Village: drywall patches, door repairs, a
deck expansion and a garage remodel.

## Don'ts

- Don't send anything. Draft only.
- Don't offer anything in exchange for a review.
- Don't ask a client more than twice.
- Don't write a client's name, number or address into any file outside `private/`.

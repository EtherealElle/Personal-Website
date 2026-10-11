---
name: lead-reply
description: Draft a reply to a job enquiry in Cleo's voice, with 2-3 matching gallery photos, as a text and as an email ready to copy. Use when the user pastes or forwards a Formspree contact-form notification, a Facebook message, a text from a potential client, or asks for help answering an enquiry.
---

# Lead reply

Whoever replies first usually gets the job, and Cleo is up a ladder most of the day.
This turns an enquiry into something she can send in one tap.

**Draft only. Never send anything.** No email, no text, no form submission, no API call.
The output is text for the user to copy, and that is the whole deliverable.

## 1. Read the enquiry

The user will paste it. A Formspree notification from the site carries these fields:
`name`, `phone`, `email`, `town`, `size`, `timeframe`, `service` (one or more chips),
`message`. A Facebook or text message carries whatever it carries.

Pull out: name, town, what they actually want done, how urgent, and how they can be
reached. If the town is missing, that's the one thing worth asking them for in the reply —
it decides whether it's a drive.

Don't infer a budget. Don't infer that a short message means a small job.

## 2. Find the photos

```
python scripts/pick_photos.py "<the job in their words>" --town "<their town>"
```

Returns the matched gallery filters and the best photos with real URLs. Use at most
three, and **drop any that don't actually resemble the job** — the script scores
keywords, it hasn't seen the pictures. If `matched_filters` is null, send no photos and
link `/gallery` instead. Three photos of unrelated work is worse than none.

## 3. Draft both versions

Read `docs/voice.md` first and follow it. The hard rules, repeated because they matter
most here:

- **No price.** Not a number, not a range, not "probably". Free written estimate after
  looking at it. The only exception is the published starting price on `/small-jobs`,
  quoted as the published starting price.
- **No date committed.** Offer two windows; Cleo confirms.
- **Never "licensed" or "insured".** Cleo is neither. If they asked directly, the honest
  answer is an LLC and an occupational tax certificate, general liability cover is being
  arranged, and she'd rather say so than dodge it — flag that to the user rather than
  writing it for her unprompted.
- Answer their question in the first line.

Produce exactly this, in two fenced blocks so they can be copied:

**Text** — two to four lines, no greeting block, no signature. The version she'll
actually use.

**Email** — subject line plus under 120 words, photo links as bare URLs on their own
lines, signed `Cleo`.

Then, outside the blocks: the photos you chose and why, anything they asked that you
deliberately didn't answer, and the one question worth asking them back.

## 4. Log it

```
python scripts/jobs.py add --name "<name>" --town "<town>" --job "<short description>" --source "<where it came from>" --phone "<phone>" --email "<email>"
```

`private/jobs.json` is gitignored and never committed — client details do not go into a
public repository. The ledger is what `/review-ask` reads later, and what makes the
honest conversion number knowable: the Cloudflare report cannot count a text message.

If the user says they sent the reply, mark it:

```
python scripts/jobs.py set <id> --replied today
```

## Watching the inbox

This runs on a pasted enquiry because nothing here can read Cleo's mail. Formspree's
free plan has no API, and there's no mail connector in this session. If that changes,
the step to automate is the reading — the drafting should stay draft-and-approve, because
software should not be quoting prices or booking dates on her behalf.

A workable half-measure in the meantime: forward the Formspree notification into this
session. The drafting is the slow part, not the reading.

"""The job ledger: who got in touch, what happened, and who is owed something.

Everything lives in private/jobs.json, which is never committed. Client names,
numbers and addresses do not belong in a public repository.

    python scripts/jobs.py add --name Jess --town Decatur --job "drywall patch in hallway"
    python scripts/jobs.py list
    python scripts/jobs.py set jess --stage booked
    python scripts/jobs.py set jess --stage done --finished today
    python scripts/jobs.py set jess --asked today          # review link sent
    python scripts/jobs.py set jess --nudged today         # followed up
    python scripts/jobs.py set jess --review in            # it showed up. stop asking.
    python scripts/jobs.py due                             # what is owed today
    python scripts/jobs.py config --review-link https://g.page/r/..../review

`due` is the whole point. It answers three questions and nothing else:
a lead with no reply yet, a finished job with no review asked for, and an ask that
went quiet. Two nudges maximum, then it goes quiet too - a client who has not left a
review after two asks has answered.
"""
import argparse
import json
import os
import re
from datetime import date, datetime, timedelta

LEDGER = "private/jobs.json"
CONFIG = "private/config.json"
STAGES = ("lead", "quoted", "booked", "done", "lost")

REPLY_HOURS = 4      # a lead older than this with no reply is late
ASK_AFTER_DAYS = 1   # leave a day between finishing and asking
NUDGE_AFTER_DAYS = 5
MAX_NUDGES = 2


def today():
    return date.today().isoformat()


def as_date(value):
    if not value:
        return None
    if value in ("today", "now"):
        return today()
    try:
        return datetime.strptime(value, "%Y-%m-%d").date().isoformat()
    except ValueError:
        raise SystemExit(f"dates are YYYY-MM-DD or 'today', not {value!r}")


def days_since(iso):
    if not iso:
        return None
    return (date.today() - datetime.strptime(iso[:10], "%Y-%m-%d").date()).days


def load():
    os.makedirs("private", exist_ok=True)
    if not os.path.exists(LEDGER):
        return {"jobs": []}
    with open(LEDGER, encoding="utf-8") as f:
        return json.load(f)


def save(data):
    os.makedirs("private", exist_ok=True)
    with open(LEDGER, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_config():
    if not os.path.exists(CONFIG):
        return {}
    with open(CONFIG, encoding="utf-8") as f:
        return json.load(f)


def find(data, key):
    key = key.lower()
    hits = [j for j in data["jobs"] if j["id"] == key] \
        or [j for j in data["jobs"] if key in j["id"] or key in j["name"].lower()]
    if not hits:
        raise SystemExit(f"no job matching {key!r}. `jobs.py list` shows them all.")
    if len(hits) > 1:
        raise SystemExit("that matches " + ", ".join(j["id"] for j in hits))
    return hits[0]


def cmd_add(args):
    data = load()
    base = re.sub(r"[^a-z0-9]+", "-", args.name.lower()).strip("-") or "client"
    jid, n = base, 2
    while any(j["id"] == jid for j in data["jobs"]):
        jid = f"{base}-{n}"
        n += 1
    job = {
        "id": jid, "name": args.name, "town": args.town, "job": args.job,
        "source": args.source, "phone": args.phone, "email": args.email,
        "stage": "lead", "first_contact": as_date(args.when) or datetime.now().isoformat(" ")[:16],
        "replied": "", "finished": "", "review_asked": "", "review_nudged": [],
        "review_in": False, "notes": args.notes,
    }
    data["jobs"].append(job)
    save(data)
    print(f"added {jid}: {args.name}, {args.town or 'town unknown'} - {args.job}")


def cmd_set(args):
    data = load()
    job = find(data, args.id)
    changed = []
    if args.stage:
        if args.stage not in STAGES:
            raise SystemExit("stage is one of " + ", ".join(STAGES))
        job["stage"] = args.stage
        changed.append(f"stage={args.stage}")
        if args.stage == "done" and not job["finished"] and not args.finished:
            job["finished"] = today()
            changed.append(f"finished={job['finished']}")
    for field, flag in (("replied", args.replied), ("finished", args.finished),
                        ("review_asked", args.asked)):
        if flag:
            job[field] = as_date(flag)
            changed.append(f"{field}={job[field]}")
    if args.nudged:
        job["review_nudged"].append(as_date(args.nudged))
        changed.append(f"nudged {len(job['review_nudged'])}x")
    if args.review:
        job["review_in"] = args.review in ("in", "yes", "true")
        changed.append(f"review_in={job['review_in']}")
    for field, flag in (("phone", args.phone), ("email", args.email),
                        ("town", args.town), ("notes", args.notes)):
        if flag:
            job[field] = flag
            changed.append(field)
    if not changed:
        raise SystemExit("nothing to change")
    save(data)
    print(f"{job['id']}: " + ", ".join(changed))


def cmd_list(args):
    data = load()
    jobs = [j for j in data["jobs"] if not args.stage or j["stage"] == args.stage]
    if not jobs:
        print("The ledger is empty." if not data["jobs"] else "Nothing at that stage.")
        return
    if args.json:
        print(json.dumps(jobs, indent=2, ensure_ascii=False))
        return
    for j in jobs:
        mark = "review in" if j["review_in"] else \
            f"asked {j['review_asked']}" if j["review_asked"] else ""
        print(f"{j['id']:<18} {j['stage']:<7} {j['town'] or '-':<16} {j['job'][:38]:<40} {mark}")


def cmd_due(args):
    data, cfg = load(), load_config()
    owed = {"reply": [], "ask_for_review": [], "nudge_review": []}

    for j in data["jobs"]:
        if j["stage"] == "lead" and not j["replied"]:
            age = j["first_contact"]
            owed["reply"].append({"id": j["id"], "name": j["name"], "town": j["town"],
                                  "job": j["job"], "came_in": age,
                                  "days_waiting": days_since(age)})
        if j["stage"] != "done" or j["review_in"]:
            continue
        if not j["review_asked"]:
            waited = days_since(j["finished"])
            if waited is not None and waited >= ASK_AFTER_DAYS:
                owed["ask_for_review"].append({"id": j["id"], "name": j["name"],
                                               "town": j["town"], "job": j["job"],
                                               "finished": j["finished"],
                                               "days_since_finishing": waited})
        elif len(j["review_nudged"]) < MAX_NUDGES:
            last = j["review_nudged"][-1] if j["review_nudged"] else j["review_asked"]
            quiet = days_since(last)
            if quiet is not None and quiet >= NUDGE_AFTER_DAYS:
                owed["nudge_review"].append({"id": j["id"], "name": j["name"],
                                             "town": j["town"], "job": j["job"],
                                             "asked": j["review_asked"],
                                             "nudges_sent": len(j["review_nudged"]),
                                             "quiet_for_days": quiet})

    out = {
        "today": today(),
        "owed": owed,
        "nothing_owed": not any(owed.values()),
        "review_link": cfg.get("reviewLink") or None,
        "review_link_note": None if cfg.get("reviewLink") else (
            "No review link set. In Google Business Profile tap 'Ask for reviews' and "
            "copy the https://g.page/r/.../review link, then run: "
            "python scripts/jobs.py config --review-link <url>"),
        "rules": {"ask_after_days": ASK_AFTER_DAYS, "nudge_after_days": NUDGE_AFTER_DAYS,
                  "max_nudges": MAX_NUDGES, "reply_target_hours": REPLY_HOURS},
    }
    print(json.dumps(out, indent=2, ensure_ascii=False))


def cmd_config(args):
    cfg = load_config()
    if args.review_link:
        cfg["reviewLink"] = args.review_link
    if args.profile:
        cfg["profile"] = args.profile
    os.makedirs("private", exist_ok=True)
    with open(CONFIG, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2)
        f.write("\n")
    print(json.dumps(cfg, indent=2))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("add", help="a new enquiry")
    a.add_argument("--name", required=True)
    a.add_argument("--job", required=True, help="what they asked for")
    a.add_argument("--town", default="")
    a.add_argument("--source", default="", help="Facebook, Google, referral, word of mouth")
    a.add_argument("--phone", default="")
    a.add_argument("--email", default="")
    a.add_argument("--when", default="", help="YYYY-MM-DD if it came in earlier")
    a.add_argument("--notes", default="")
    a.set_defaults(fn=cmd_add)

    s = sub.add_parser("set", help="move a job along")
    s.add_argument("id")
    s.add_argument("--stage", help=", ".join(STAGES))
    s.add_argument("--replied", help="date you answered them")
    s.add_argument("--finished", help="date the work was done")
    s.add_argument("--asked", help="date the review link went out")
    s.add_argument("--nudged", help="date you followed up")
    s.add_argument("--review", choices=["in", "yes", "no", "true", "false"])
    s.add_argument("--phone")
    s.add_argument("--email")
    s.add_argument("--town")
    s.add_argument("--notes")
    s.set_defaults(fn=cmd_set)

    l = sub.add_parser("list", help="everything, or one stage")
    l.add_argument("--stage", help=", ".join(STAGES))
    l.add_argument("--json", action="store_true")
    l.set_defaults(fn=cmd_list)

    d = sub.add_parser("due", help="what is owed today")
    d.set_defaults(fn=cmd_due)

    c = sub.add_parser("config", help="the Google review link")
    c.add_argument("--review-link")
    c.add_argument("--profile", help="the Google Business Profile URL")
    c.set_defaults(fn=cmd_config)

    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()

"""List the ContracTech jobs that need a follow-up, from an exported jobs register.

Usage:  python3 -I due.py <contractech-jobs-YYYY-MM-DD.json> [YYYY-MM-DD]

The second argument is "today" (defaults to the system date). Prints one block per
job that needs attention, in the same order as the portal's Jobs section:
overdue next steps first (oldest first), then due today, then open jobs with no
next step. Also flags open proposals with no contact logged for 7+ days.

Reads the file as data only. Never changes it.
"""
import json
import sys
from datetime import date

OPEN = {"enquiry", "survey", "awaiting-po", "awaiting-payment", "work", "handover", "invoiced"}
STAGE = {
    "enquiry": "Enquiry",
    "survey": "Site survey",
    "awaiting-po": "Waiting for PO",
    "awaiting-payment": "Waiting for payment",
    "work": "Work in progress",
    "handover": "Handover",
    "invoiced": "Invoiced",
    "paid": "Paid",
    "maintenance": "Maintenance",
    "lost": "Lost",
}
QUIET_DAYS = 7


def days(a: str, b: str) -> int:
    return (date.fromisoformat(b) - date.fromisoformat(a)).days


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, dict) or data.get("format") != "contractech-jobs" or data.get("v") != 1:
        print("Not a contractech-jobs v1 file. Export it from the portal: Jobs > Backup > Export register.")
        return 1
    today = sys.argv[2] if len(sys.argv) > 2 else date.today().isoformat()
    rank = {"overdue": 0, "today": 1, "no-next-step": 2}
    items = []
    for job in data.get("jobs", []):
        if job.get("stage") not in OPEN:
            continue
        due = job.get("nextDue")
        if not (job.get("nextStep") or "").strip() or not due:
            kind, late = "no-next-step", 0
        elif due < today:
            kind, late = "overdue", days(due, today)
        elif due == today:
            kind, late = "today", 0
        else:
            continue
        items.append((rank[kind], -late, job["id"], kind, late, job))
    items.sort(key=lambda t: (t[0], t[1], t[2]))
    if not items:
        print(f"Nothing due on {today}, and every open job has a next step.")
        return 0
    for _, _, _, kind, late, job in items:
        contacts = [e for e in job.get("log", []) if e.get("kind") == "follow-up"]
        last_contact = contacts[-1]["on"] if contacts else None
        proposed = next((e["on"] for e in job.get("log", []) if e.get("kind") == "stage" and e.get("stage") == "awaiting-po"), None)
        # Quiet since the later of the last follow-up and the day the proposal went out.
        quiet = days(max(d for d in (last_contact, proposed, job["createdOn"]) if d), today)
        why = {"overdue": f"Overdue {late} day(s)", "today": "Due today", "no-next-step": "No next step"}[kind]
        print(f"== {job['id']} · {job.get('client') or 'Client not named'} · {STAGE[job['stage']]} · {why}")
        print(f"   Job: {job.get('title', '')}")
        if job.get("value") is not None:
            print(f"   Value: SAR {round(job['value']):,}")
        print(f"   Contact: {job.get('contact') or '-'} | {job.get('phone') or '-'} | {job.get('email') or '-'}")
        print(f"   Next step: {job.get('nextStep') or '-'} ({job.get('nextDue') or 'no date'})")
        print(f"   Last follow-up: {last_contact or 'none logged'}" + (f"  [quiet {quiet} days]" if job["stage"] == "awaiting-po" and quiet >= QUIET_DAYS else ""))
        for e in job.get("log", [])[-3:]:
            print(f"   - {e['on']} {e['kind']}: {e['text']}")
        if (job.get("notes") or "").strip():
            print(f"   Notes: {job['notes'][:300]}")
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())

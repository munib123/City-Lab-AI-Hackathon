# MedLens API

Base path: `/api`. All bodies are JSON. No login. CORS is open by default (set `CORS_ORIGINS` to a
comma-separated list to restrict it).

Run it locally (from the repo root):

```
python -m venv .venv
.venv/Scripts/pip install -r requirements-dev.txt        # Windows; use .venv/bin/pip on macOS/Linux
.venv/Scripts/python -m uvicorn medlens.api:app --app-dir backend --reload
# open http://127.0.0.1:8000/docs for the interactive docs
```

**The code decides every status. The UI should only display what the API returns, never re-classify.**

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | status, whether chat is on, KB counts |
| GET | `/api/reports` | the 14 corpus reports for a picker |
| GET | `/api/kb` | all ranges, urgent limits, aliases and rules, each with `{file, line, quote}` |
| POST | `/api/analyze` | analyse a corpus report (`report_id`) **or** pasted text (`text`) |
| POST | `/api/analyze/demographics` | same, after the user supplies the missing `age` and/or `sex` |
| POST | `/api/chat` | ask a question about **one** report (see "Chat" below) |

### `GET /api/reports`
```json
[{ "report_id": "P004", "patient_name": "Diana Prince", "result_count": 2 }]
```

### `POST /api/analyze`
Send **exactly one** of `report_id` or `text`. `age` and `sex` are optional.
```json
{ "report_id": "P004" }
```
```json
{ "text": "Recorded Age: 30\nBiological Sex: Male\nALT: 85 U/L" }
```
`/api/analyze/demographics` takes the same body but needs at least one of `age` (0-130) or `sex`
(`Male`/`Female`, also `m`/`f`):
```json
{ "report_id": "P003", "age": 40, "sex": "Male" }
```

### Response (`Analysis`)
```jsonc
{
  "report_id": "P004",                       // null for pasted text
  "patient": { "name": "Diana Prince", "mrn": "CLD-P004-9942", "age": 42, "sex": "Female" },
  "overall": "URGENT",                       // URGENT | NOT_NORMAL | INCOMPLETE | ALL_NORMAL | NO_RESULTS
  "results": [ /* one ResultAnalysis per test, see below */ ],
  "missing_demographics": [],                // ["age"], ["sex"] or ["age","sex"]
  "demographics_source": { "age": "recorded", "sex": "recorded" },  // recorded | user_supplied | missing
  "urgent_banner": {                         // null unless something is urgent
    "title": "Urgent: see a doctor today",
    "message": "One or more results are at an urgent level. Please see a doctor today. This is not a diagnosis. Only a doctor can say what it means.",
    "items": [{ "test": "Hemoglobin", "value": "6.5 g/dL", "reason": "..." }]
  },
  "doctor_questions": ["My Hemoglobin result is 6.5 g/dL. The lab says this is urgent. What should I do today?", "..."],  // always 3 to 5
  "demographics_prompt": null,               // text asking for age/sex when some result needs it
  "disclaimer": "Only a licensed medical doctor can diagnose conditions. ..."
}
```

### `ResultAnalysis`
```jsonc
{
  "raw_name": "SGPT",                  // as written in the report
  "canonical_name": "ALT",             // null when the test is not in the files
  "name_origin": "files",              // "files" | "team" (team = alias the lab's glossary does not list)
  "value_text": "45", "value": 45.0, "unit": "U/L",
  "converted_value": null, "converted_unit": null,
  "conversion": null,                  // see below, only when a unit was converted
  "status": "NORMAL",
  "range_used": { "low": 7.0, "high": 45.0, "unit": "U/L", "sex": "Female", "age_min": 18, "age_max": 100,
                  "qualitative": null,
                  "source": { "file": "5_ranges_biochemistry.md", "line": 6, "quote": "..." } },
  "danger": null,                      // set for URGENT_*: { threshold, condition, unit, source }
  "boundary": true,                    // value sits exactly on a range limit (still NORMAL, by the files' rule)
  "needs": [],                         // ["age"] / ["sex"] when status is NEEDS_INFO (or urgent but still missing)
  "reason": "45 U/L is inside the range 7-45 U/L for female, ages 18-100 (5_ranges_biochemistry.md:6). ...",
  "source": { "file": "report_P002_...md", "line": 14, "quote": "| SGPT | 45 | U/L |" },
  "explanation": {                     // null for UNCLASSIFIED
    "measures": "ALT is a protein found mostly in the liver. ...",
    "meaning": null,                   // text about a low/high result; null when NORMAL
    "label": "General information, not from CityLab's files",
    "origin": "team"
  }
}
```

Unit conversion example (`conversion`):
```json
{ "from_value": 6.0, "from_unit": "mmol/L", "factor": 18.0, "to_value": 108.0, "to_unit": "mg/dL",
  "working": "6.0 mmol/L × 18 = 108 mg/dL", "origin": "team", "note": "1 mmol/L of glucose = 18 mg/dL" }
```

## Chat

`POST /api/chat` takes the same body as `/api/analyze` (exactly one of `report_id` or `text`, plus optional
`age`/`sex`) and a `question` (1-500 characters). It is **stateless**: send the full question each time, and send
`age`/`sex` again if the user supplied them. The chat is locked to that one report.

```json
{ "report_id": "P002", "question": "Is my SGPT normal?" }
```
```jsonc
{
  "report_id": "P002",
  "answer": "Your ALT is 45 U/L. That is inside the range.",
  "answer_type": "answered",   // see below
  "sources": [                 // always show these as "sources"; empty for not_in_files / unavailable
    { "id": "RES1", "label": "Your report: SGPT 45 U/L", "file": "report_P002_...md", "line": 14, "origin": "report" },
    { "id": "R07",  "label": "Range: ALT (Female, ages 18-100)", "file": "5_ranges_biochemistry.md", "line": 6, "origin": "files" }
  ],
  "llm_used": true,            // false when code answered (refusals) or chat is off
  "reading_grade": 3.2         // reading level of the answer, null when code wrote it
}
```

| `answer_type` | Meaning | Suggested UI |
|---|---|---|
| `answered` | grounded in the files and this report; has at least one source | normal bubble + sources |
| `not_in_files` | the files do not contain the answer ("not in the files") | neutral bubble |
| `refused_other_patient` | the question was about someone else; refused by code | warning bubble |
| `refused_diagnosis` | asked for a diagnosis ("Do I have diabetes?"); refused by code | warning bubble |
| `needs_info` | age or sex is needed first; ask the user | bubble + age/sex form |
| `unavailable` | no API key, or the model could not be reached; the rest of the app still works | grey bubble |

`origin: "team"` on a source means general information that is **not from CityLab's files**; keep its label.

The two refusals work even when chat is switched off (no key), because they are plain code. Every model answer is also
checked in code before it is returned: its cited ids must exist, it must not sound like a diagnosis, it must not
mention another patient, and it is checked for reading level (about class 8).

## Statuses

| Status | Meaning | Suggested UI |
|---|---|---|
| `NORMAL` | inside the range (limits included) | green |
| `LOW` / `HIGH` | outside the range | amber |
| `ABNORMAL` | a word result that is not the normal word (e.g. Protein: Positive) | amber |
| `URGENT_LOW` / `URGENT_HIGH` | at or past an urgent limit | red, show `urgent_banner` at the top |
| `NEEDS_INFO` | age and/or sex needed to pick the range; **ask the user** (see `needs`), then call `/api/analyze/demographics` | blue, input form |
| `UNCLASSIFIED` | "cannot be classified from the files" (unknown test, unit that cannot be converted, age outside the files' bands) | grey |

## What the UI must show (these are the hackathon's rules)

1. `reason` for each result. It names the file and line used, so a judge can verify it.
2. `range_used.source` as a small "source" link or tooltip.
3. `conversion.working` whenever `conversion` is not null.
4. Anything with `origin: "team"` or an `explanation.label` must keep its "not from CityLab's files" label.
5. `urgent_banner` at the very top when it is not null.
6. `doctor_questions` and `disclaimer` on every report page.
7. For `NEEDS_INFO`: show `demographics_prompt` and a small age/sex form. Do not pre-fill a guess.

## Errors

| Code | When |
|---|---|
| 404 | unknown `report_id` |
| 422 | both or neither of `report_id`/`text`; bad `age`/`sex`; no results could be read from `text`; `text` longer than 20 000 characters |

Error body: `{ "detail": "..." }` (FastAPI also returns a list for field validation errors).

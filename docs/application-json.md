# Application JSON format

Instructions for producing one job application as a JSON object that
Applicator can fill its "New application" form from. Paste the object into
**Fill in from JSON** on that form; the user checks the filled-in fields and
saves.

## Rules

- Output **one JSON object** and nothing else: no Markdown fence, no comments,
  no text before or after it. A list of applications is not accepted.
- **Every field is optional.** Leave out what the vacancy does not say. Do not
  invent values, and do not write placeholders such as `"unknown"`, `"N/A"` or
  `"-"`. A field set to `null` or `""` counts as left out.
- Use **only the field names below**, spelled exactly as shown (camelCase).
  Any other key is ignored and reported to the user as left out.
- Fields with a fixed set of values take **exactly one of the listed values**.
  If the vacancy says something none of them fits (for example "Full-time" for
  the work mode), leave the field out.
- A value that does not fit its field is not used: the field stays empty and
  is marked with what was sent, and the user must correct it or leave it empty
  on purpose before saving. Every other field is still filled in.

## Fields

| Field            | Type   | Allowed values and form                                                                                                         |
| ---------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `companyName`    | string | The employer's name, up to 200 characters. Required to save, but may be added by hand.                                          |
| `positionTitle`  | string | The job title as advertised, up to 200 characters. Required to save, but may be added by hand.                                  |
| `seniority`      | string | `"junior"`, `"mid"`, `"senior"`, `"lead"`                                                                                       |
| `status`         | string | `"draft"` (not applied yet), `"applied"`, `"screening"`, `"assignment"` (a take-home task), `"interview"`, `"offer"`, `"rejected"`, `"withdrawn"`. Without it, the form starts at `"draft"`. |
| `appliedAt`      | string | The day the application was sent, as `"YYYY-MM-DD"`, e.g. `"2026-09-01"`. Leave out if not applied yet.                         |
| `city`           | string | Any city name, e.g. `"Munich"`.                                                                                                 |
| `country`        | string | Any country name, e.g. `"Germany"`.                                                                                             |
| `workMode`       | string | `"on_site"`, `"hybrid"`, `"remote"`                                                                                             |
| `channel`        | string | How the application is sent: `"direct"` (to the employer), `"agency"` (through a recruitment agency), `"referral"`. Without it, the form starts at `"direct"`. |
| `source`         | string | Where the vacancy was found, e.g. `"LinkedIn"`, `"StepStone"`, `"Company website"`.                                             |
| `sourceUrl`      | string | The vacancy's web address, starting with `http://` or `https://`.                                                               |
| `applicationUrl` | string | Where to apply, starting with `http://` or `https://`.                                                                          |
| `notes`          | string | Free text. Do not put the cover letter here unless asked.                                                                       |
| `salary`         | object | See [Salary](#salary).                                                                                                          |
| `contact`        | object | See [Contact](#contact).                                                                                                        |

### Salary

An object with any of these fields:

| Field        | Type   | Allowed values and form                                                                 |
| ------------ | ------ | --------------------------------------------------------------------------------------- |
| `advertised` | range  | What the vacancy states.                                                                |
| `estimated`  | range  | An estimate for the role, e.g. from salary research.                                    |
| `asked`      | range  | What the application asks for.                                                          |
| `currency`   | string | A three-letter ISO 4217 code, e.g. `"EUR"`, `"CHF"`, `"USD"`. Without it, the form starts at `"EUR"`. |
| `period`     | string | `"year"`, `"month"`, `"day"`, `"hour"`. Without it, the form starts at `"year"`.        |

A **range** is an object `{ "min": number, "max": number }` of whole numbers,
with no separators, symbols or decimals (`60000`, not `"60k"` or `60000.00`),
and `min` no higher than `max`:

| The vacancy says    | Range                              |
| ------------------- | ---------------------------------- |
| 60,000–70,000       | `{ "min": 60000, "max": 70000 }`   |
| exactly 65,000      | `{ "min": 65000, "max": 65000 }`   |
| from 60,000         | `{ "min": 60000 }`                 |
| up to 80,000        | `{ "max": 80000 }`                 |
| nothing about money | leave the range out                |

### Contact

One person, as an object with any of these fields, all strings:

| Field   | Form                                                    |
| ------- | ------------------------------------------------------- |
| `name`  | e.g. `"Jane Doe"`                                       |
| `role`  | e.g. `"Technical Recruiter"`                            |
| `email` | A valid email address.                                  |
| `phone` | As written, e.g. `"+49 30 1234567"`.                    |
| `url`   | A profile address, starting with `http://` or `https://`. |

## Example

```json
{
  "companyName": "Initech",
  "positionTitle": "Senior Platform Engineer",
  "seniority": "senior",
  "status": "applied",
  "appliedAt": "2026-09-01",
  "city": "Munich",
  "country": "Germany",
  "workMode": "hybrid",
  "channel": "direct",
  "source": "LinkedIn",
  "sourceUrl": "https://example.com/jobs/platform-engineer",
  "applicationUrl": "https://example.com/jobs/platform-engineer/apply",
  "notes": "Kubernetes and Go. Team of six, on call one week in eight.",
  "salary": {
    "advertised": { "min": 75000, "max": 90000 },
    "asked": { "min": 85000, "max": 85000 },
    "currency": "EUR",
    "period": "year"
  },
  "contact": {
    "name": "Jane Doe",
    "role": "Technical Recruiter",
    "email": "jane.doe@example.com"
  }
}
```

A vacancy that says little gives a small object, which is just as valid:

```json
{ "companyName": "Globex", "positionTitle": "Backend Developer", "workMode": "remote" }
```

## What Applicator also accepts

The rules above are what to produce. When reading, Applicator is more
forgiving, so that a slightly different object still fills the form:

- Fixed values are matched ignoring case, spaces, hyphens and underscores, and
  a few common variants are understood: `"Remote"`, `"On-site"`, `"Mid-Level"`,
  `"Sr."`, `"Take-home"`, `"Monthly"`, `"per annum"`.
- A currency may be `"€"`, `"£"` or `"US$"`; `"$"` alone is rejected because it
  names several currencies.
- An amount may be a string such as `"60,000"`, `"60 000"` or `"60k"`.
- `appliedAt` may also be `"01.09.2026"` (day first), `"1 September 2026"`,
  `"September 1, 2026"`, or a full timestamp (its date part is used). A date
  such as `"09/01/2026"`, which could be either 9 January or 1 September, is
  rejected rather than guessed.
- A day becomes the start of that day in the time zone of the browser it is
  pasted in, exactly as a day picked in the form does.

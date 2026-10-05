# CCTV camera sizing — Hikvision (phase 1)

An internal tool an integrator uses in front of a client. Enter the physical facts
of a location — mounting height, distance, scene width, environment, and what the
client actually needs to *see* — and get specific Hikvision models with their full
spec sheet and the engineering numbers that justify the choice.

Runs offline. No backend, no runtime network calls.

## Running it

Node 20 or newer.

```
npm install
npm run dev        # development server
npm run build      # static bundle into dist/
npm run preview    # serve the built bundle
npm test           # 151 tests
npm run lint
```

`dist/` is plain static files with a relative `base`, so it can be served from
any path, a USB stick or a laptop with no network.

## What it does

**Inputs** are grouped the way an engineer works: geometry, then purpose, then
environment, then client requirements. Every field has a helper line that explains
what it means on site. There is no submit button — the results recompute on every
change.

**Purpose** drives everything. It is the DORI scale from IEC 62676-4:2014, plus
the two special cases that carry their own requirement (ANPR and till overwatch).

**Output** is a ranked primary recommendation plus up to three alternatives, each
labelled by its trade-off ("budget option", "better in low light", "more flexible
lens"), each with a plain-language case for it and an honest weak point. Each card
carries the client's fifteen-field spec-sheet table verbatim, the model number,
lens, PoE figures, price band, and a link to the Hikvision datasheet the specs
were read from.

**Every number is traceable.** Each figure has a "how this was calculated"
disclosure showing the formula as applied, the inputs, and a link to the source of
its constants. Figures that are estimates rather than sourced values carry a
visible **Unverified** badge.

**Nothing fails silently.** If no model satisfies the constraints, the tool names
the binding constraint, lists the nearest misses with their shortfall, and suggests
what to change. Every excluded model has a reason you can repeat to a client.

**The configuration is in the URL.** Copy the link to send a client's scenario to
a colleague or reopen it later. A malformed link falls back to defaults with a
readable warning rather than rendering a half-populated scenario.

## Layout

```
src/
  domain/           pure maths, no UI, no framework
    units.ts        metric/imperial, SI internally
    dori.ts         pixel-density requirements + their sources
    sensors.ts      optical format -> active area in mm
    optics.ts       FOV, focal length, lens fit
    geometry.ts     tilt, blind spot, footprint, camera count
    pixelDensity.ts achieved density and the verdict
    illumination.ts IR/white-light reach and hotspot risk
    bitrate.ts      Hikvision published bitrates -> storage
    power.ts        PoE accounting (IEEE 802.3af/at/bt)
    calculate.ts    orchestrator: one traceable result object
    types.ts        the typed scenario and the multi-location project
  data/
    schema.ts              zod schema — the data contract
    hikvision-cameras.json the single source of truth for specs
    cameras.ts             validating loader (fails loudly)
  engine/
    weights.ts      scoring weights, in one documented place
    recommend.ts    hard filters, then score and rank, then explain
    outputCard.ts   the fifteen fields, in the client's order
  state/            project helpers and URL-encoded state
  ui/               components
```

## The data

38 Hikvision models, every specification read off the manufacturer datasheet
linked in the entry. No spec came from memory. Fields a datasheet does not state
are `null` and render as "Not specified" — never a guess, never a blank cell.
Each entry carries its datasheet URL and the date it was verified.

Adding a model is a one-object edit to `hikvision-cameras.json` with no code
change. The schema validates at load and refuses unknown fields, so a typo fails
immediately rather than quietly.

Scraping hikvision.com at runtime is deliberately not done: it would be fragile,
would block offline use, and may breach their terms.

## Phase 2 is not built

NVR/recorder selection, storage hardware and RAID, PoE switch selection, cable
runs, and the printable bill of materials are later phases. They are designed for
but not stubbed:

- the recommendation engine is a pure function over typed inputs;
- the project model is multi-location from the start and `projectTotals()` already
  aggregates camera count, PoE port count, PoE switch budget, aggregate bitrate
  and total storage across every location;
- per-camera bandwidth, storage and PoE are already computed and displayed;
- each product category gets its own data file against the shared schema.

## Read these too

- `ASSUMPTIONS.md` — every decision made without being able to ask, including
  which figures are not sourced and how they are marked.
- `TASKS.md` — the task list and its final status.


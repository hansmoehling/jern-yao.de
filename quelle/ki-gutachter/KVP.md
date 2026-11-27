# KVP v1 – technical intake and reviewed evidence

`src/kvp.js` contains public code, no production cases. It never publishes knowledge, modifies an active manifest, or schedules a report. All learned bands, calibration factors and weights remain proposals requiring Hans's review.

Manual enquiries from the exact testfield Origin `https://jern-yao.de` are replayed as `manual-v2` before an anonymous decision record is stored. This version keeps the actual stepped shaft, head and shaft-end geometry, nut model and explicit delivery condition, and uses `ranking-v2`, `force-v2`, `rm-v2` and `shaft-v2`. Recorded volume and forces use the engine's `V`, `Fmax_t` and `Fsum_t` fields. Only validated numerical dimensions and fixed enums survive; norm documents, source text and customer contact data are excluded. An unresolved contour is not logged as a calculated case. The server selects this version from the Origin, never from client claims. Other origins retain the previous replay until their package is released. This is still unreviewed intake, not approved KVP evidence.

The two JSON POST routes are enabled only for the exact Origin `https://jern-yao.de`. An optional `featureVersion` must be `kvp-v1`; an optional `language` selects the response language. Other origins cannot enable the routes through `ALLOWED_ORIGINS`. Both routes use the existing `SPEICHER` binding, an 8 KiB body limit and the existing approximate daily KV throttle (30 feedback / 60 experience requests per IP hash). They need no new credential. Deployment/WAF limits remain separate from this application throttle.

## Feedback

`POST /rueckmeldung` accepts only:

```json
{
  "featureVersion": "kvp-v1",
  "optIn": true,
  "source": "manual",
  "features": {
    "klasse": "formteil",
    "topologie": "kopf-schaft-napf",
    "merkmale": { "d0": 8, "L0_d0": 2, "werkstoffgruppe": "unlegiert-weich" }
  },
  "feedback": "passt",
  "predictedStages": 4,
  "actualStages": 4
}
```

This is a synthetic request format, not an approved manufacturing case. The consent control must start unchecked. Sources are `manual`, `drawing`, `structured_geometry`; feedback codes are `passt`, `zu_viele_stadien`, `zu_wenige_stadien`, `andere_reihenfolge`. Stage counts are optional. Unknown fields, free text, client approvals, files, contacts and source references are rejected. Technical string fields use fixed enums. The result is stored at `rueckmeldung:<server UUID>` as `ungeprueft`, `knowledgeEligible:false`, `approval:null`, with a date and no request linkage or TTL. Successful intake returns 202; it is never a case approval.

## Experience

`POST /erfahrung` accepts `{features, k?}` using the same feature schema; `k` is 1–5 and defaults to 3. It reads only `kvp:manifest:kvp-v1`. There is no fallback to the main knowledge manifest or to feedback/decision intake.

The private manifest needs `schemaVersion:1`, a bounded version identifier, `freigegeben:true`, and `freigabe:{von:"Hans",am:"YYYY-MM-DD"}`. Cases may be in `cases`, or in a separate `casesKey` exactly equal to `kvp:cases:<version>`. The separate record must have the same schema/version and a `cases` array. Neither path is automatically initialized. Missing evidence returns `missing`, unapproved evidence `pending-approval`, and malformed approved snapshots fail closed.

Every retrieved case separately needs an F-number, explicit approval by Hans, enumerated technical features and operations, a valid result status and an ordered stage list. Unknown private attributes are stripped from the returned projection. Duplicate IDs and invalid records are excluded. Only identical class and topology are compared; numeric features use disclosed initial distance scales and missing dimensions incur a penalty. Returned projections cannot approve themselves. The stage interval summarizes successful returned cases; failed cases remain distinguishable.

Approved manifest `bands` are returned only when each band also has Hans's approval, matching class/topology/material context, a supported metric and valid numerical bounds. New `experienceBand()` output is never active: below five successful cases it reports the literature limit, from five it proposes minimum/p90 bounds shrunk towards that limit with a disclosed prior weight. Marginal and failed outcomes remain separate zones.

## Review calculations

`calibrationProposal()` groups measured/recomputed force ratios by the same operation and material group. It reports median and p10/p90. Throughput records must state planned and measured units (`strokes-per-minute` or `pieces-per-minute`); mismatched units are excluded. Throughput groups keep catalog model and an explicit wire diameter class. No empirical factor changes the engine automatically.

`weightProposal()` considers only approved comparisons with unique anonymous D-identifiers (or opaque UUIDs), known catalog models, explicit eligible candidates, and the five higher-is-better normalized fit scores `forceFit`, `stationFit`, `sizeFit`, `lengthFit`, `throughputFit`. Raw reserves must first be converted into these suitability scores by the ranking model. Under 30 reviewed decisions it provides only the reason Pareto. From 30 it proposes regularized pairwise logistic weights, constrained nonnegative and summing to one, with Top-1/Top-3 replay before/after. The replay uses the same historical sample and is not independent validation. A worse replay is flagged. Financial ranking, feasibility gates and active weights remain untouched.

`monthlyReport()` returns a data-only monthly summary: approved cases, outcomes, source kinds, stage deviations, anonymous feedback counts, decision reasons and the inactive weight proposal. It does not write a report or create a scheduler. Publication still requires reviewed snapshot preparation, regression checks and explicit approval. No live or sample case is preapproved by this code.

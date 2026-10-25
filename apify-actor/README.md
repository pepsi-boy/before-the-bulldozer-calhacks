# Nashville Demolition Permits (Apify Actor)

Pulls the newest **demolition permits** from Metro Nashville's open data
(*Building Permits Issued*, ArcGIS Feature Server) and saves them to a dataset.
Built for [Before the Bulldozer](../README.md): every permit is a house whose doors,
cabinets, flooring and fixtures could go to a nonprofit instead of a landfill.

## Input

| Field | Default | What it does |
| --- | --- | --- |
| `daysBack` | 90 | Only permits issued in the last N days |
| `maxResults` | 100 | Max permits returned, newest first |
| `residentialOnly` | true | Keep only residential demolitions |

## Output (one item per permit)

```json
{
  "id": "2026012345",
  "address": "1234 Example St, Nashville, TN 37208",
  "lat": 36.17, "lng": -86.81,
  "dateIssued": "2026-10-20",
  "permitType": "Demolition Residential",
  "zip": "37208",
  "description": "Demolish single family residence…",
  "contractor": "Example Wrecking LLC"
}
```

This matches the app's `Permit` type, so the app can read the dataset directly.

## Run it on a schedule

Create a Schedule in Apify Console (e.g. every day at 7:00) so the dataset always holds
the latest permits. The app and the Fetch.ai agents read the **last successful run**:

```
GET https://api.apify.com/v2/acts/<username>~nashville-demolition-permits/runs/last/dataset/items?status=SUCCEEDED
```

## Deploy

From this folder: `apify login` then `apify push`.

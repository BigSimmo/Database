# WA mental health catchments — structured

**Status: extraction and reconciliation only. Nothing here has been corrected, merged or
resolved.** Where sources disagree, both readings are shown and the disagreement is listed in
section 4. No suburb, postcode, hospital or clinic name has been invented; spelling is
reproduced exactly as each source has it, typos included.

## Sources used

| ID         | File                                           | Date on the document | What it contains                                                                                                                                           |
| ---------- | ---------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S2015**  | `catchment-wa-p1.txt` … `catchment-wa-p12.txt` | 22 November 2015     | Statewide master. POST CODES / SUBURBS / APPROVED HOSPITAL / FOLLOW UP CLINIC. Pages 1–11 are data (537 rows); page 12 is a community-clinic address list. |
| **S2023**  | `catchment-southmetro-p1.txt`                  | November 2023        | South Metropolitan Health Service. Three teams (FREMANTLE / ROCKINGHAM KWINANA / PEEL), suburb lists only — **no postcodes, no hospitals**.                |
| **SMETRO** | `catchment-Metro_Catchment.txt`                | _undated_            | Metropolitan teams with phone/fax and suburb lists. 12 suburb blocks; 10 team headers survived extraction.                                                 |
| **SRPBG**  | `catchment-Mental_Health_Catchment.txt`        | _undated_            | Royal Perth Bentley Group, Service 3 — Midland / Bentley / Inner City suburb lists.                                                                        |
| **SWACHS** | `rural-catchment.png`                          | _undated_            | Image. "WACHS Link Mental Health Inter-Hospital Patient Transfer Model" — country hospital-to-metro transfer alignments. Transcribed in section 6.         |
| —          | `catchment-Rural_Catchment.txt`                | —                    | Contains only `455676294639Appendix 1: WACHS Alignments`. No usable data; it is the caption for the image above.                                           |

**Only S2015 has postcodes.** The machine-usable table in section 3 is therefore built from
S2015 alone, with the other sources used to reconcile against it.

---

## 1. Distinct APPROVED HOSPITALS

Counted from the 537 S2015 rows. **14 named hospitals**, plus 41 rows where the column is empty.

| Approved hospital (exact spelling) | Suburb rows |
| ---------------------------------- | ----------: |
| Albany                             |           3 |
| Alma Street                        |          47 |
| Armadale                           |          39 |
| Bentley                            |           4 |
| Bunbury                            |          48 |
| Graylands                          |          68 |
| Joondalup                          |          49 |
| Kalgoorlie                         |           8 |
| Kwinana                            |           2 |
| Midland                            |         104 |
| Mills Street                       |          31 |
| Rockingham                         |          70 |
| SCGH                               |          21 |
| Swan Valley                        |           2 |
| _(column empty)_                   |          41 |

**Total = 537 rows.** Named-hospital rows = 496.

The 41 empty-hospital rows are all country localities. In S2015 they carry a follow-up clinic
(a regional health service) but no admitting site. The full list, so the count can be checked:

- 6390 Boddington — follow-up clinic: Upper Great Southern
- 6306 Brookton — follow-up clinic: Great South
- 6725 Broome — follow-up clinic: Kimberley HS
- 6318 Broomehill — follow-up clinic: Central Great Southern
- 6798 Christmas Island — follow-up clinic: _(also empty)_
- 6429 Coolgardie — follow-up clinic: North. Goldfield H.S.
- 6515 Coorow — follow-up clinic: Midwest H.S.
- 6321 Cranbrook — follow-up clinic: Central Great Southern.
- 6333 Denmark — follow-up clinic: Great Southern.
- 6350 Dumbleyung — follow-up clinic: Narrogin
- 6448 Gibson — follow-up clinic: Great Southern
- 6335 Gnowangerup — follow-up clinic: Great Southern
- 6348 Hopetown — follow-up clinic: Great Southern
- 6525 Irwin — follow-up clinic: North West
- 6751 Juna Downs — follow-up clinic: North West
- 6714 Karratha — follow-up clinic: North West
- 6714 Karratha — follow-up clinic: West Pilbara
- 6317 Katanning — follow-up clinic: Great Southern.
- 6395 Kojonup — follow-up clinic: Great Southern.
- 6367 Kondinin — follow-up clinic: Great Southern.
- 6365 Kulin — follow-up clinic: Upper Great Southern
- 6743 Kununurra — follow-up clinic: Kimberley HS
- 6353 Lake Grace — follow-up clinic: Great Southern
- 6522 Mingenew — follow-up clinic: Gascoyne
- 6324 Mt Barker — follow-up clinic: Great Southern
- 6638 Mt Magnet — follow-up clinic: Gascoyne
- 6312 Narrogin — follow-up clinic: Great Southern
- 6753 Newman — follow-up clinic: North West
- 6443 Norseman — follow-up clinic: South East Coastal
- 6710 Onslow — follow-up clinic: North West
- 6308 Pingelly — follow-up clinic: Great Southern
- 6721 Port Hedland — follow-up clinic: North West
- 6722 South Hedland — follow-up clinic: Pilbara
- 6320 Tambellup — follow-up clinic: Central Great Southern
- 6751 Tom Price — follow-up clinic: North West
- 6315 Wagin — follow-up clinic: Great Southern
- 6308 Wandering — follow-up clinic: Upper Great Southern
- 6720 Wickham — follow-up clinic: West Pilbara
- 6391 Williams — follow-up clinic: Narrogin
- 6485 Wyalkatchem — follow-up clinic: East Wheatbelt
- 6740 Wyndham — follow-up clinic: Kimberley

That is 41 rows.

### Note on two of these names

- **Bentley** appears as an approved hospital on 4 rows, while **Mills Street** appears on 31.
  Page 12 of S2015 gives the Bentley community address as "MILLS STREET CENTRE, Mills Street,
  Bentley 6102". The two names are used inconsistently in S2015 — see section 4.
- **Kwinana** appears as an approved hospital on exactly 2 rows (Calista, Hope Valley) while
  every other Kwinana-area suburb has **Rockingham**. See section 4.
- **Swan Valley** appears as an approved hospital on exactly 2 rows (Wongan Hills, Wundowie),
  both with the "Wheat Belt" clinic; every other Wheat Belt row has **Midland**.

---

## 2. Distinct FOLLOW UP CLINICS (community mental health teams)

Counted from the 537 S2015 rows. **76 distinct clinic strings**, plus 1 row where the column is
empty. Names are reproduced exactly, including the trailing full stops, the `Midalnd` typo and
the two spellings of `Osborne`.

| Follow-up clinic (exact string)          | Suburb rows |
| ---------------------------------------- | ----------: |
| Albany                                   |           1 |
| Alma Street                              |           1 |
| Alma Street (Central)                    |          12 |
| Alma Street (Cockburn)                   |          15 |
| Alma Street (Fremantle)                  |           6 |
| Alma Street (Melville)                   |          13 |
| Armadale                                 |           4 |
| Armadale (Mead Centre)                   |           1 |
| Armadale (Mead)                          |           1 |
| Bentley                                  |          32 |
| Bunbury                                  |          48 |
| Central Great Southern                   |           2 |
| Central Great Southern.                  |           1 |
| Central Wheatbelt                        |           2 |
| Central Wheatbelt H.S.                   |           1 |
| Clarkson                                 |          13 |
| East Wheatbelt                           |           2 |
| East Wheatbelt HS                        |           1 |
| East.Wheatbelt HS                        |           1 |
| Eudoria Street (Gosnells)                |           4 |
| Eudoria Street (Thornlie)                |           6 |
| Gascoyne                                 |           8 |
| Gascoyne H.S.                            |           1 |
| Gascoyne HS                              |           1 |
| Geraldton HS                             |           4 |
| Great South                              |           1 |
| Great Southern                           |           8 |
| Great Southern.                          |           4 |
| ICC                                      |           3 |
| Inner City                               |          16 |
| Inner City (central)                     |           1 |
| Inner City Clinic                        |           1 |
| Joondalup                                |          36 |
| Kimberley                                |           1 |
| Kimberley HS                             |           2 |
| Kwinana                                  |          16 |
| Kwinana/Peel                             |           1 |
| Lower Great Southern                     |           2 |
| Mead Centre (Armadale)                   |           4 |
| Mead Centre (Kelmscott)                  |          17 |
| Mead centre (Armadale)                   |           1 |
| Meade Centre (Armadale)                  |           1 |
| Merredin                                 |           3 |
| Midalnd                                  |           2 |
| Midland                                  |          68 |
| Midwest H.S.                             |           2 |
| Mills Street                             |           3 |
| Mirrabooka                               |          15 |
| Murchison HS                             |           1 |
| Narrogin                                 |           3 |
| North West                               |           7 |
| North. Goldfield H.S.                    |           1 |
| Northam                                  |           9 |
| Nth Goldfield H.S.                       |           1 |
| Nth Goldfield HS                         |           5 |
| Osborne                                  |          19 |
| Osborne Park                             |           2 |
| Peel                                     |          27 |
| Peel /Rockingham                         |           1 |
| Peel/Rockingham                          |           2 |
| Pilbara                                  |           1 |
| Rockingham                               |          23 |
| Rockingham/Kwinana                       |           1 |
| Rockingham/Peel                          |           1 |
| South East Coastal                       |           1 |
| Southern Coastal HS                      |           1 |
| Subiaco                                  |          17 |
| Swan                                     |           1 |
| Upper Great Southern                     |           4 |
| Upper Great Southern.                    |           1 |
| West Pilbara                             |           2 |
| Western H.S.                             |           1 |
| Western HS                               |           2 |
| Wheat Belt                               |          10 |
| Wheat belt                               |           2 |
| Wheatbelt HS                             |           1 |
| _(column empty — Christmas Island only)_ |           1 |

**Total = 537 rows; 76 distinct named strings.**

### Clinic-name variants

The 76 strings above are **not** 76 teams. Below is my grouping of strings that look like the
same team written differently. **This grouping is my judgement, not the source's** — S2015
contains all of these as separate literal values, and section 3 preserves every one of them
exactly as written. Nothing has been merged in the data.

**Alma Street (Fremantle Hospital community service)** — 47 rows across 5 strings

- `Alma Street` — 1 rows
- `Alma Street (Central)` — 12 rows
- `Alma Street (Cockburn)` — 15 rows
- `Alma Street (Fremantle)` — 6 rows
- `Alma Street (Melville)` — 13 rows

  Four named sub-teams plus one bare `Alma Street` row (Hilton Park, 6163). The bare row may be a sub-team that was not filled in.

**Armadale / Mead Centre** — 29 rows across 7 strings

- `Armadale` — 4 rows
- `Armadale (Mead Centre)` — 1 rows
- `Armadale (Mead)` — 1 rows
- `Mead Centre (Armadale)` — 4 rows
- `Mead centre (Armadale)` — 1 rows
- `Meade Centre (Armadale)` — 1 rows
- `Mead Centre (Kelmscott)` — 17 rows

  Six ways of writing what appears to be the same Armadale-area service, plus a separate Kelmscott site. `Meade` and lower-case `centre` are almost certainly typos.

**Eudoria Street** — 10 rows across 2 strings

- `Eudoria Street (Gosnells)` — 4 rows
- `Eudoria Street (Thornlie)` — 6 rows

  Two named sites; both sit under the Armadale approved hospital.

**Inner City** — 21 rows across 4 strings

- `ICC` — 3 rows
- `Inner City` — 16 rows
- `Inner City (central)` — 1 rows
- `Inner City Clinic` — 1 rows

  Page 12 of S2015 names it `INNER CITY CLINIC, 74 Murray Street, Perth`. `ICC` is presumably the same clinic abbreviated.

**Midland** — 70 rows across 2 strings

- `Midland` — 68 rows
- `Midalnd` — 2 rows

  `Midalnd` on 2 rows (Red Hill 6056, Sawyers Valley 6074) is a transposition typo.

**Osborne** — 21 rows across 2 strings

- `Osborne` — 19 rows
- `Osborne Park` — 2 rows

  Page 12 names it `OSBORNE CLINIC, Osborne Place, Stirling 6021`. `Osborne Park` on 2 rows (Balcatta 6021, Herdsman 6017).

**Bentley / Mills Street** — 35 rows across 2 strings

- `Bentley` — 32 rows
- `Mills Street` — 3 rows

  `Mills Street` is the address of the Bentley clinic per page 12. Used as a clinic name on 3 rows (Belmont 6104, Bentley 6102, East Cannington 6107) where the rest of the same area says `Bentley`.

**Rockingham / Kwinana / Peel combinations** — 72 rows across 8 strings

- `Rockingham` — 23 rows
- `Kwinana` — 16 rows
- `Peel` — 27 rows
- `Peel/Rockingham` — 2 rows
- `Peel /Rockingham` — 1 rows
- `Kwinana/Peel` — 1 rows
- `Rockingham/Kwinana` — 1 rows
- `Rockingham/Peel` — 1 rows

  Five rows carry a two-team slash value rather than a single team. These are genuinely ambiguous in the source and must not be resolved silently.

**Great Southern** — 23 rows across 8 strings

- `Great Southern` — 8 rows
- `Great Southern.` — 4 rows
- `Great South` — 1 rows
- `Central Great Southern` — 2 rows
- `Central Great Southern.` — 1 rows
- `Lower Great Southern` — 2 rows
- `Upper Great Southern` — 4 rows
- `Upper Great Southern.` — 1 rows

  Trailing full stops appear on some rows only. `Great South` (Brookton, 6306) is probably `Great Southern` truncated.

**Wheatbelt** — 20 rows across 8 strings

- `Wheat Belt` — 10 rows
- `Wheat belt` — 2 rows
- `Wheatbelt HS` — 1 rows
- `Central Wheatbelt` — 2 rows
- `Central Wheatbelt H.S.` — 1 rows
- `East Wheatbelt` — 2 rows
- `East Wheatbelt HS` — 1 rows
- `East.Wheatbelt HS` — 1 rows

  Spacing, capitalisation and `HS`/`H.S.` suffixes vary. `East.Wheatbelt HS` has a full stop where a space belongs.

**Goldfields** — 7 rows across 3 strings

- `Nth Goldfield HS` — 5 rows
- `Nth Goldfield H.S.` — 1 rows
- `North. Goldfield H.S.` — 1 rows

  Three spellings of one name.

**Gascoyne** — 10 rows across 3 strings

- `Gascoyne` — 8 rows
- `Gascoyne HS` — 1 rows
- `Gascoyne H.S.` — 1 rows

  Three spellings of one name.

**Kimberley** — 3 rows across 2 strings

- `Kimberley` — 1 rows
- `Kimberley HS` — 2 rows

  Two spellings.

**Western** — 3 rows across 2 strings

- `Western HS` — 2 rows
- `Western H.S.` — 1 rows

  Two spellings.

**Pilbara / North West** — 10 rows across 3 strings

- `North West` — 7 rows
- `Pilbara` — 1 rows
- `West Pilbara` — 2 rows

  Three different regional labels used for Pilbara towns; not obviously the same team.

**Strings that appear once as themselves and were not grouped** (each shown with its count):

- `Albany` — 1 rows
- `Bunbury` — 48 rows
- `Clarkson` — 13 rows
- `Geraldton HS` — 4 rows
- `Joondalup` — 36 rows
- `Merredin` — 3 rows
- `Midwest H.S.` — 2 rows
- `Mirrabooka` — 15 rows
- `Murchison HS` — 1 rows
- `Narrogin` — 3 rows
- `Northam` — 9 rows
- `South East Coastal` — 1 rows
- `Southern Coastal HS` — 1 rows
- `Subiaco` — 17 rows
- `Swan` — 1 rows

That is 15 ungrouped strings plus the 1 empty value.

### The clinic hubs named in S2015's own address list (page 12)

Page 12 of S2015 lists community referral addresses. These 8 are the only clinics the document
gives an address and phone number for, so they are the closest thing the source has to a
definitive hub list:

1. **ALMA STREET CENTRE** — Alma Street, Fremantle 6160 — 9431 3300
2. **MILLS STREET CENTRE** — Mills Street, Bentley 6102 — 9416 3666
3. **SUBIACO CLINIC** — 2 Nicholson Road, Subiaco 6008 — 9381 9055
4. **JOONDALUP HEALTH CAMPUS** — Shenton Avenue and Grand Boulevard, Joondalup 6027 — 9400 9400
5. **INNER CITY CLINIC** — 74 Murray Street, Perth 6000 — 9224 1720
6. **MIRRABOOKA CLINIC** — 4/14 Chesterfield Road, Mirrabooka 6061 — 9344 5400
7. **OSBORNE CLINIC** — Osborne Place, Stirling 6021 — 9346 8350
8. **MIDLAND ADULT COMMUNITY MH SERVICE** — 281 Great Eastern Highway, Midland 6056 — Telephone 92378600, Fax 92378611

Note this list has **no Armadale, Rockingham, Kwinana, Peel or Clarkson entry**, even though all
five are used as follow-up clinic values in the same document. That is a gap in the source, not
in the extraction.

### The team hubs named in SMETRO (undated), with phone and fax

SMETRO gives contact details for 10 teams. This is the other candidate answer to "what are the
community team hubs":

| Team (as written)  | Phone     | Fax       |
| ------------------ | --------- | --------- |
| ARMADALE           | 9391 2400 | 9391 2429 |
| INNER CITY         | 92241720  | 92241702  |
| MIDLAND            | 9237 8600 | 9237 8611 |
| ROCKINGHAM KWINANA | 9528 0600 | 9529 1266 |
| FREMANTLE          | 9431 3555 | 9431 3479 |
| PEEL               | 9531 8080 | 9531 8070 |
| JOONDALUP          | 9400 9599 | 9400 9590 |
| LOWER WEST         | 9489 7200 | 9382 4171 |
| CLARKSON           | 9404 0094 | 9404 0099 |
| BENTLEY            | 9416 3544 | 9416 3676 |

SMETRO has **12 suburb blocks but only 10 headers** — two blocks lost their team name in
extraction. See section 5.

---

## 3. The mapping — seed data

One row per S2015 record, in source order (alphabetical by suburb within the document, page by
page). **537 rows.** Values are verbatim; empty cells are empty in the source. `page` is the
extracted page the row came from, so any row can be traced back.

Parsing note: pages 1–11 each begin with 7 header lines, after which every record is exactly
four consecutive lines (postcode, suburb, approved hospital, follow-up clinic). All 537 groups
begin with a 4-digit postcode with no drift across 2,148 lines, which is the check that the
grouping is right.

| postcode | suburb                    | approved_hospital | follow_up_clinic          | page |
| -------- | ------------------------- | ----------------- | ------------------------- | ---: |
| 6330     | Albany                    | Albany            | Lower Great Southern      |    1 |
| 6064     | Alexander Heights         | Graylands         | Mirrabooka                |    1 |
| 6154     | Alfred Cove               | Alma Street       | Alma Street (Melville)    |    1 |
| 6033     | Alkimos                   | Joondalup         | Joondalup                 |    1 |
| 6167     | Anketel                   | Rockingham        | Kwinana                   |    1 |
| 6153     | Applecross                | Alma Street       | Alma Street (Melville)    |    1 |
| 6153     | Ardross                   | Alma Street       | Alma Street (Melville)    |    1 |
| 6111     | Araluen                   | Armadale          | Armadale (Mead Centre)    |    1 |
| 6112     | Armadale                  | Armadale          | Mead Centre (Armadale)    |    1 |
| 6065     | Ashby                     | Joondalup         | Joondalup                 |    1 |
| 6111     | Ashendon                  | Armadale          | Armadale                  |    1 |
| 6104     | Ascot                     | Bentley           | Bentley                   |    1 |
| 6054     | Ashfield                  | Midland           | Midland                   |    1 |
| 6156     | Attadale                  | Alma Street       | Alma Street (Melville)    |    1 |
| 6164     | Atwell                    | Alma Street       | Alma Street (Cockburn)    |    1 |
| 6164     | Aubin Grove               | Alma Street       | Alma Street (Cockburn)    |    1 |
| 6290     | Augusta                   | Bunbury           | Bunbury                   |    1 |
| 6069     | Aveley                    | Midland           | Midland                   |    1 |
| 6233     | Australind                | Bunbury           | Bunbury                   |    1 |
| 6521     | Badgingarra               | Midland           | Wheat Belt                |    1 |
| 6562     | Bakers Hill               | Midland           | Northam                   |    1 |
| 6082     | Bailup                    | Midland           | Midland                   |    1 |
| 6253     | Balingup                  | Bunbury           | Bunbury                   |    1 |
| 6606     | Ballidu                   | Midland           | Northam                   |    1 |
| 6021     | Balcatta                  | Graylands         | Osborne Park              |    1 |
| 6171     | Baldivis                  | Rockingham        | Rockingham                |    1 |
| 6253     | Balingup                  | Bunbury           | Bunbury                   |    1 |
| 6061     | Balga                     | Graylands         | Mirrabooka                |    1 |
| 6066     | Ballajura                 | Graylands         | Mirrabooka                |    1 |
| 6606     | Ballidu                   | Midland           | Northam                   |    1 |
| 6164     | Banjup                    | Alma Street       | Alma Street (Cockburn)    |    1 |
| 6031     | Banksia Grove             | Joondalup         | Joondalup                 |    1 |
| 6210     | Barragup                  | Rockingham        | Peel/Rockingham           |    1 |
| 6054     | Bassendean                | Midland           | Midland                   |    1 |
| 6150     | Bateman                   | Alma Street       | Alma Street (Central)     |    1 |
| 6056     | Baskerville               | Midland           | Midland                   |    1 |
| 6053     | Bayswater                 | SCGH              | ICC                       |    1 |
| 6162     | Beaconsfield              | Alma Street       | Alma Street (Central)     |    1 |
| 6107     | Beckenham                 | Bentley           | Bentley                   |    1 |
| 6052     | Bedford                   | SCGH              | ICC                       |    1 |
| 6112     | Bedfordale                | Armadale          | Mead Centre (Kelmscott)   |    1 |
| 6063     | Beechboro                 | Midland           | Midland                   |    1 |
| 6556     | Beechina                  | Midland           | Midland                   |    1 |
| 6164     | Beeliar                   | Alma Street       | Alma Street (Cockburn)    |    1 |
| 6027     | Beldon                    | Joondalup         | Joondalup                 |    1 |
| 6069     | Belhus                    | Midland           | Midland                   |    1 |
| 6056     | Bellevue                  | Midland           | Midland                   |    1 |
| 6104     | Belmont                   | Mills Street      | Mills Street              |    1 |
| 6223     | Benger                    | Bunbury           | Bunbury                   |    1 |
| 6063     | Bennett Springs           | Midland           | Midland                   |    2 |
| 6102     | Bentley                   | Mills Street      | Mills Street              |    2 |
| 6167     | Bertram                   | Rockingham        | Rockingham                |    2 |
| 6304     | Beverley                  | Midland           | Central Wheatbelt         |    2 |
| 6163     | Bibra Lake                | Alma Street       | Alma Street (Cockburn)    |    2 |
| 6076     | Bickley                   | Midland           | Swan                      |    2 |
| 6157     | Bicton                    | Alma Street       | Alma Street (Melville)    |    2 |
| 6214     | Birchmont                 | Rockingham        | Kwinana/Peel              |    2 |
| 6502     | Bindoon                   | Midland           | Northam                   |    2 |
| 6390     | Boddington                |                   | Upper Great Southern      |    2 |
| 6154     | Booragoon                 | Alma Street       | Alma Street (Melville)    |    2 |
| 6432     | Boulder                   | Kalgoorlie        | Nth Goldfield H.S.        |    2 |
| 6237     | Boyanup                   | Bunbury           | Bunbury                   |    2 |
| 6056     | Boya                      | Midland           | Midland                   |    2 |
| 6244     | Boyup Brook               | Bunbury           | Bunbury                   |    2 |
| 6153     | Brentwood                 | Alma Street       | Alma Street (Melville)    |    2 |
| 6255     | Bridgetown                | Bunbury           | Bunbury                   |    2 |
| 6069     | Brigadoon                 | Midland           | Midland                   |    2 |
| 6112     | Brookdale                 | Armadale          | Armadale                  |    2 |
| 6306     | Brookton                  |                   | Great South               |    2 |
| 6725     | Broome                    |                   | Kimberley HS              |    2 |
| 6318     | Broomehill                |                   | Central Great Southern    |    2 |
| 6224     | Brunswick Junction        | Bunbury           | Bunbury                   |    2 |
| 6418     | Bruce Rock                | Midland           | Central Wheatbelt H.S.    |    2 |
| 6149     | Bull Creek                | Alma Street       | Alma Street (Melville)    |    2 |
| 6084     | Bullsbrook                | Midland           | Midland                   |    2 |
| 6231     | Bunbury                   | Bunbury           | Bunbury                   |    2 |
| 6230     | Bunbury                   | Bunbury           | Bunbury                   |    2 |
| 6028     | Burns Beach               | Joondalup         | Clarkson                  |    2 |
| 6100     | Burswood                  | Bentley           | Bentley                   |    2 |
| 6227     | Burekup                   | Bunbury           | Bunbury                   |    2 |
| 6280     | Busselton                 | Bunbury           | Bunbury                   |    2 |
| 6032     | Butler                    | Joondalup         | Clarkson                  |    2 |
| 6201     | Byford                    | Armadale          | Mead Centre (Kelmscott)   |    2 |
| 6167     | Calista                   | Kwinana           | Peel /Rockingham          |    2 |
| 6111     | Camillo                   | Armadale          | Mead Centre (Kelmscott)   |    2 |
| 6111     | Canning Mills             | Armadale          | Mead Centre (Kelmscott)   |    2 |
| 6155     | Canning Vale              | Armadale          | Eudoria Street (Thornlie) |    2 |
| 6107     | Cannington                | Mills Street      | Bentley                   |    2 |
| 6271     | Capel                     | Bunbury           | Bunbury                   |    2 |
| 6033     | Carabooda                 | Joondalup         | Clarkson                  |    2 |
| 6201     | Cardup                    | Armadale          | Mead Centre (Kelmscott)   |    2 |
| 6031     | Carramar                  | Joondalup         | Joondalup                 |    2 |
| 6076     | Carilla                   | Midland           | Midland                   |    2 |
| 6230     | Carey Park                | Bunbury           | Bunbury                   |    2 |
| 6020     | Carine                    | Graylands         | Osborne                   |    2 |
| 6101     | Carlisle                  | Mills Street      | Bentley                   |    2 |
| 6076     | Carmel                    | Midland           | Midland                   |    2 |
| 6517     | Carnamah                  | Graylands         | Midwest H.S.              |    2 |
| 6701     | Carnarvon                 | Graylands         | Gascoyne H.S.             |    3 |
| 6167     | Casuarina                 | Rockingham        | Rockingham                |    3 |
| 6055     | Caversham                 | Midland           | Midland                   |    3 |
| 6000     | Central Business District | SCGH              | Inner City (central)      |    3 |
| 6210     | Central Mandurah          | Rockingham        | Peel                      |    3 |
| 6168     | Challenger                | Rockingham        | Rockingham                |    3 |
| 6111     | Champion Lakes            | Armadale          | Armadale                  |    3 |
| 6556     | Chidlow                   | Midland           | Midland                   |    3 |
| 6084     | Chittering                | Midland           | Midland                   |    3 |
| 6798     | Christmas Island          |                   |                           |    3 |
| 6018     | Churchlands               | Graylands         | Osborne                   |    3 |
| 6015     | City Beach                | Graylands         | Subiaco                   |    3 |
| 6564     | Clackline                 | Midland           | Northam                   |    3 |
| 6010     | Claremont                 | Graylands         | Subiaco                   |    3 |
| 6030     | Clarkson                  | Joondalup         | Clarkson                  |    3 |
| 6230     | Clifton Park              | Bunbury           | Bunbury                   |    3 |
| 6105     | Cloverdale                | Mills Street      | Bentley                   |    3 |
| 6230     | College Grove             | Bunbury           | Bunbury                   |    3 |
| 6225     | Collie                    | Bunbury           | Bunbury                   |    3 |
| 6152     | Como                      | Mills Street      | Bentley                   |    3 |
| 6027     | Connolly                  | Joondalup         | Joondalup                 |    3 |
| 6210     | Coodanup                  | Rockingham        | Peel/Rockingham           |    3 |
| 6166     | Coogee                    | Alma Street       | Alma Street (Cockburn)    |    3 |
| 6163     | Coolbellup                | Alma Street       | Alma Street (Central)     |    3 |
| 6050     | Coolbinia                 | SCGH              | Inner City                |    3 |
| 6429     | Coolgardie                |                   | North. Goldfield H.S.     |    3 |
| 6168     | Cooloongup                | Rockingham        | Kwinana                   |    3 |
| 6214     | Coolup                    | Rockingham        | Peel                      |    3 |
| 6515     | Coorow                    |                   | Midwest H.S.              |    3 |
| 6375     | Corrigin                  | Graylands         | Upper Great Southern.     |    3 |
| 6011     | Cottesloe                 | Graylands         | Subiaco                   |    3 |
| 6284     | Cowaramup                 | Bunbury           | Bunbury                   |    3 |
| 6025     | Craigie                   | Joondalup         | Joondalup                 |    3 |
| 6321     | Cranbrook                 |                   | Central Great Southern.   |    3 |
| 6009     | Crawley                   | Graylands         | Subiaco                   |    3 |
| 6311     | Cuballing                 | Graylands         | Upper Great Southern      |    3 |
| 6640     | Cue                       | Graylands         | Gascoyne                  |    3 |
| 6067     | Cullacabardee             | Midland           | Midland                   |    3 |
| 6407     | Cunderdin                 | Midland           | Northam                   |    3 |
| 6028     | Currambine                | Joondalup         | Joondalup                 |    3 |
| 6008     | Daglish                   | Graylands         | Subiaco                   |    3 |
| 6009     | Dalkeith                  | Graylands         | Subiaco                   |    3 |
| 6609     | Dalwallinu                | Midland           | Wheat Belt                |    3 |
| 6507     | Dandaragan                | Midland           | Wheat Belt                |    3 |
| 6236     | Dardanup                  | Bunbury           | Bunbury                   |    3 |
| 6065     | Darch                     | Graylands         | Mirrabooka                |    3 |
| 6122     | Darling Downs             | Armadale          | Armadale (Mead)           |    3 |
| 6070     | Darlington                | Midland           | Midland                   |    3 |
| 6230     | Davenport                 | Bunbury           | Bunbury                   |    3 |
| 6210     | Dawesville                | Rockingham        | Peel                      |    4 |
| 6210     | Dudley Park               | Rockingham        | Peel                      |    4 |
| 6333     | Denmark                   |                   | Great Southern.           |    4 |
| 6062     | Dianella                  | Graylands         | Mirrabooka                |    4 |
| 6239     | Donnybrook                | Bunbury           | Bunbury                   |    4 |
| 6018     | Doubleview                | Graylands         | Osborne                   |    4 |
| 6461     | Dowerin                   | Midland           | Western H.S.              |    4 |
| 6350     | Dumbleyung                |                   | Narrogin                  |    4 |
| 6023     | Duncraig                  | Joondalup         | Joondalup                 |    4 |
| 6281     | Dunsborough               | Bunbury           | Bunbury                   |    4 |
| 6213     | Dwellingup                | Rockingham        | Peel                      |    4 |
| 6232     | Eaton                     | Bunbury           | Bunbury                   |    4 |
| 6107     | East Cannington           | Mills Street      | Mills Street              |    4 |
| 6158     | East Fremantle            | Alma Street       | Alma Street (Fremantle)   |    4 |
| 6004     | East Perth                | SCGH              | Inner City                |    4 |
| 6168     | East Rockingham           | Rockingham        | Rockingham                |    4 |
| 6100     | East Victoria Park        | Mills Street      | Bentley                   |    4 |
| 6054     | Eden Hill                 | Midland           | Midland                   |    4 |
| 6027     | Edgewater                 | Joondalup         | Joondalup                 |    4 |
| 6034     | Eglinton                  | Joondalup         | Clarkson                  |    4 |
| 6069     | Ellenbrook                | Midland           | Midland                   |    4 |
| 6062     | Embleton                  | SCGH              | Inner City                |    4 |
| 6210     | Erskine                   | Rockingham        | Peel                      |    4 |
| 6450     | Esperance                 | Kalgoorlie        | Southern Coastal HS       |    4 |
| 6707     | Exmouth                   | Graylands         | Gascoyne                  |    4 |
| 6210     | Falcon                    | Rockingham        | Peel                      |    4 |
| 6148     | Ferndale                  | Mills Street      | Bentley                   |    4 |
| 6014     | Floreat                   | Graylands         | Subiaco                   |    4 |
| 6211     | Florida Beach             | Rockingham        | Peel                      |    4 |
| 6112     | Forrestdale               | Armadale          | Mead Centre (Kelmscott)   |    4 |
| 6058     | Forrestfield              | Midland           | Midland                   |    4 |
| 6160     | Fremantle                 | Alma Street       | Alma Street (Fremantle)   |    4 |
| 6210     | Furnissdale               | Rockingham        | Rockingham/Peel           |    4 |
| 6168     | Garden Island             | Rockingham        | Rockingham                |    4 |
| 6530     | Geraldton                 | Graylands         | Geraldton HS              |    4 |
| 6448     | Gibson                    |                   | Great Southern            |    4 |
| 6083     | Gidgegannup               | Midland           | Midland                   |    4 |
| 6503     | Gingin                    | Midland           | Wheat belt                |    4 |
| 6064     | Girrawheen                | Graylands         | Mirrabooka                |    4 |
| 6071     | Glen Forrest              | Midland           | Midland                   |    4 |
| 6016     | Glendalough               | Graylands         | Osborne                   |    4 |
| 6230     | Glen Iris                 | Bunbury           | Bunbury                   |    4 |
| 6065     | Gnangara                  | Joondalup         | Joondalup                 |    4 |
| 6335     | Gnowangerup               |                   | Great Southern            |    4 |
| 6174     | Golden Bay                | Rockingham        | Rockingham                |    4 |
| 6460     | Goomalling                | Midland           | Wheat belt                |    4 |
| 6076     | Gooseberry Hill           | Midland           | Midland                   |    4 |
| 6110     | Gosnells                  | Armadale          | Eudoria Street (Gosnells) |    4 |
| 6284     | Gracetown                 | Bunbury           | Bunbury                   |    4 |
| 6254     | Greenbush                 | Bunbury           | Bunbury                   |    5 |
| 6056     | Greenmount                | Midland           | Midland                   |    5 |
| 6530     | Greenough                 | Graylands         | Geraldton HS              |    5 |
| 6024     | Greenwood                 | Joondalup         | Joondalup                 |    5 |
| 6210     | Greenfields               | Rockingham        | Peel                      |    5 |
| 6055     | Guildford                 | Midland           | Midland                   |    5 |
| 6018     | Gwelup                    | Graylands         | Osborne                   |    5 |
| 6076     | Hackett's Gully           | Midland           | Midland                   |    5 |
| 6210     | Halls Head                | Rockingham        | Rockingham                |    5 |
| 6022     | Hamersley                 | Graylands         | Osborne                   |    5 |
| 6215     | Hamel                     | Rockingham        | Peel                      |    5 |
| 6163     | Hamilton Hill             | Alma Street       | Alma Street (Central)     |    5 |
| 6164     | Hammond Park              | Alma Street       | Alma Street (Cockburn)    |    5 |
| 6220     | Harvey                    | Bunbury           | Bunbury                   |    5 |
| 6055     | Hazelmere                 | Midland           | Midland                   |    5 |
| 6027     | Heathridge                | Joondalup         | Joondalup                 |    5 |
| 6056     | Helena Valley             | Midland           | Midland                   |    5 |
| 6166     | Henderson                 | Alma Street       | Alma Street (Cockburn)    |    5 |
| 6055     | Henley Brook              | Midland           | Midland                   |    5 |
| 6017     | Herdsman                  | Graylands         | Osborne Park              |    5 |
| 6056     | Herne Hill                | Midland           | Midland                   |    5 |
| 6210     | Herron                    | Rockingham        | Peel                      |    5 |
| 6057     | High Wycombe              | Midland           | Midland                   |    5 |
| 6003     | Highgate                  | SCGH              | Inner City                |    5 |
| 6025     | Hillarys                  | Joondalup         | Joondalup                 |    5 |
| 6168     | Hillman                   | Rockingham        | Rockingham/Kwinana        |    5 |
| 6163     | Hilton                    | Alma Street       | Alma Street (Central)     |    5 |
| 6163     | Hilton Park               | Alma Street       | Alma Street               |    5 |
| 6065     | Hocking                   | Joondalup         | Joondalup                 |    5 |
| 6125     | Hopeland                  | Armadale          | Armadale                  |    5 |
| 6348     | Hopetown                  |                   | Great Southern            |    5 |
| 6165     | Hope Valley               | Kwinana           | Rockingham                |    5 |
| 6071     | Hovea                     | Midland           | Midland                   |    5 |
| 6230     | Hungry Hollow             | Bunbury           | Bunbury                   |    5 |
| 6110     | Huntingdale               | Armadale          | Eudoria Street (Thornlie) |    5 |
| 6028     | Iluka                     | Joondalup         | Joondalup                 |    5 |
| 6052     | Inglewood                 | SCGH              | Inner City                |    5 |
| 6018     | Innaloo                   | Graylands         | Osborne                   |    5 |
| 6525     | Irwin                     |                   | North West                |    5 |
| 6056     | Jane Brook                | Midland           | Midland                   |    5 |
| 6065     | Jandabup                  | Joondalup         | Joondalup                 |    5 |
| 6164     | Jandakot                  | Alma Street       | Alma Street (Cockburn)    |    5 |
| 6203     | Jarrahdale                | Armadale          | Mead Centre (Kelmscott)   |    5 |
| 6032     | Jindalee                  | Joondalup         | Clarkson                  |    5 |
| 6014     | Jolimont                  | Graylands         | Subiaco                   |    5 |
| 6027     | Joondalup                 | Joondalup         | Joondalup                 |    5 |
| 6060     | Joondanna                 | Graylands         | Osborne                   |    5 |
| 6751     | Juna Downs                |                   | North West                |    5 |
| 6076     | Kalamunda                 | Midland           | Midland                   |    5 |
| 6430     | Kalgoorlie                | Kalgoorlie        | Nth Goldfield HS          |    6 |
| 6025     | Kallaroo                  | Joondalup         | Joondalup                 |    6 |
| 6442     | Kambalda                  | Kalgoorlie        | Nth Goldfield HS          |    6 |
| 6152     | Karawara                  | Mills Street      | Bentley                   |    6 |
| 6163     | Kardinya                  | Alma Street       | Alma Street (Central)     |    6 |
| 6176     | Karnup                    | Rockingham        | Rockingham                |    6 |
| 6111     | Karragullen               | Armadale          | Mead Centre (Kelmscott)   |    6 |
| 6010     | Karrakatta                | Graylands         | Subiaco                   |    6 |
| 6018     | Karrinyup                 | Graylands         | Osborne                   |    6 |
| 6714     | Karratha                  |                   | North West                |    6 |
| 6288     | Karridale                 | Bunbury           | Bunbury                   |    6 |
| 6317     | Katanning                 |                   | Great Southern.           |    6 |
| 6410     | Kellerberrin              | Midland           | Wheatbelt HS              |    6 |
| 6111     | Kelmscott                 | Armadale          | Mead Centre (Kelmscott)   |    6 |
| 6151     | Kensington                | Mills Street      | Bentley                   |    6 |
| 6107     | Kenwick                   | Armadale          | Eudoria Street (Thornlie) |    6 |
| 6105     | Kewdale                   | Mills Street      | Bentley                   |    6 |
| 6206     | Keysbrook                 | Armadale          | Mead Centre (Kelmscott)   |    6 |
| 6005     | Kings Park                | SCGH              | ICC                       |    6 |
| 6054     | Kiara                     | Midland           | Midland                   |    6 |
| 6026     | Kingsley                  | Joondalup         | Joondalup                 |    6 |
| 6028     | Kinross                   | Joondalup         | Clarkson                  |    6 |
| 6251     | Kirup                     | Bunbury           | Bunbury                   |    6 |
| 6395     | Kojonup                   |                   | Great Southern.           |    6 |
| 6367     | Kondinin                  |                   | Great Southern.           |    6 |
| 6064     | Koondoola                 | Graylands         | Mirrabooka                |    6 |
| 6056     | Koongamia                 | Midland           | Midland                   |    6 |
| 6714     | Karratha                  |                   | West Pilbara              |    6 |
| 6743     | Kununurra                 |                   | Kimberley HS              |    6 |
| 6475     | Koorda                    | Midland           | East Wheatbelt            |    6 |
| 6365     | Kulin                     |                   | Upper Great Southern      |    6 |
| 6167     | Kwinana                   | Rockingham        | Rockingham                |    6 |
| 6167     | Kwinana Beach             | Rockingham        | Kwinana                   |    6 |
| 6167     | Kwinana Town              | Rockingham        | Kwinana                   |    6 |
| 6353     | Lake Grace                |                   | Great Southern            |    6 |
| 6210     | Lakelands                 | Rockingham        | Peel                      |    6 |
| 6215     | Lake Clifton              | Rockingham        | Peel                      |    6 |
| 6044     | Lancelin                  | Midland           | Wheat Belt                |    6 |
| 6065     | Landsdale                 | Graylands         | Mirrabooka                |    6 |
| 6147     | Langford                  | Armadale          | Eudoria Street (Thornlie) |    6 |
| 6100     | Lathlain                  | Mills Street      | Bentley                   |    6 |
| 6440     | Laverton                  | Kalgoorlie        | Nth Goldfield HS          |    6 |
| 6170     | Leda                      | Rockingham        | Kwinana                   |    6 |
| 6007     | Leederville               | SCGH              | Inner City                |    6 |
| 6149     | Leeming                   | Alma Street       | Alma Street (Melville)    |    6 |
| 6438     | Leonora                   | Kalgoorlie        | Nth Goldfield HS          |    6 |
| 6076     | Lesmurdie                 | Midland           | Midland                   |    6 |
| 6076     | Lower Chittering          | Midland           | Midland                   |    6 |
| 6054     | Lockridge                 | Midland           | Midland                   |    6 |
| 6240     | Lowden                    | Bunbury           | Bunbury                   |    7 |
| 6147     | Lynwood                   | Mills Street      | Bentley                   |    7 |
| 6109     | Maddington                | Armadale          | Eudoria Street (Gosnells) |    7 |
| 6210     | Madora Bay                | Rockingham        | Peel                      |    7 |
| 6072     | Mahogany Creek            | Midland           | Midland                   |    7 |
| 6057     | Maida Vale                | Midland           | Midland                   |    7 |
| 6090     | Malaga                    | Midland           | Midland                   |    7 |
| 6065     | Madeley                   | Graylands         | Mirrabooka                |    7 |
| 6167     | Mandogalup                | Rockingham        | Kwinana                   |    7 |
| 6210     | Mandurah                  | Rockingham        | Rockingham                |    7 |
| 6258     | Manjimup                  | Bunbury           | Bunbury                   |    7 |
| 6152     | Manning                   | Mills Street      | Bentley                   |    7 |
| 6064     | Marangaroo                | Graylands         | Mirrabooka                |    7 |
| 6204     | Mardella                  | Armadale          | Mead Centre (Kelmscott)   |    7 |
| 6285     | Margaret River            | Bunbury           | Bunbury                   |    7 |
| 6065     | Mariginiup                | Joondalup         | Joondalup                 |    7 |
| 6020     | Marmion                   | Joondalup         | Joondalup                 |    7 |
| 6110     | Martin                    | Armadale          | Eudoria Street (Gosnells) |    7 |
| 6051     | Maylands                  | SCGH              | Inner City                |    7 |
| 6167     | Medina                    | Rockingham        | Kwinana                   |    7 |
| 6210     | Meadow Springs            | Rockingham        | Peel                      |    7 |
| 6642     | Meekatharra               | Graylands         | Gascoyne                  |    7 |
| 6156     | Melville                  | Alma Street       | Alma Street (Melville)    |    7 |
| 6050     | Menora                    | SCGH              | Inner City                |    7 |
| 6436     | Menzies                   | Kalgoorlie        | Nth Goldfield HS          |    7 |
| 6415     | Merredin                  | Midland           | East.Wheatbelt HS         |    7 |
| 6030     | Merriwa                   | Joondalup         | Joondalup                 |    7 |
| 6056     | Middle Swan               | Midland           | Midland                   |    7 |
| 6056     | Midland                   | Midland           | Midland                   |    7 |
| 6056     | Midvale                   | Midland           | Midland                   |    7 |
| 6056     | Millendon                 | Midland           | Midland                   |    7 |
| 6030     | Mindarie                  | Joondalup         | Clarkson                  |    7 |
| 6522     | Mingenew                  |                   | Gascoyne                  |    7 |
| 6061     | Mirrabooka                | Graylands         | Mirrabooka                |    7 |
| 6510     | Moora                     | Midland           | Western HS                |    7 |
| 6623     | Morawa                    | Graylands         | Gascoyne                  |    7 |
| 6062     | Morley                    | SCGH              | Inner City                |    7 |
| 6012     | Mosman Park               | Graylands         | Subiaco                   |    7 |
| 6324     | Mt Barker                 |                   | Great Southern            |    7 |
| 6010     | Mt Claremont              | Graylands         | Subiaco                   |    7 |
| 6016     | Mt Hawthorn               | SCGH              | Inner City                |    7 |
| 6082     | Mt Helena                 | Midland           | Midland                   |    7 |
| 6050     | Mt Lawley                 | SCGH              | Inner City                |    7 |
| 6638     | Mt Magnet                 |                   | Gascoyne                  |    7 |
| 6153     | Mt Pleasant               | Alma Street       | Alma Street (Melville)    |    7 |
| 6112     | Mt Richon                 | Armadale          | Mead Centre (Armadale)    |    7 |
| 6112     | Mt Nasura                 | Armadale          | Mead centre (Armadale)    |    7 |
| 6501     | Muchea                    | Midland           | Western HS                |    7 |
| 6479     | Mukinbudin                | Midland           | Merredin                  |    7 |
| 6252     | Mullalyup                 | Bunbury           | Bunbury                   |    8 |
| 6027     | Mullaloo                  | Joondalup         | Joondalup                 |    8 |
| 6630     | Mullewa                   | Graylands         | Gascoyne                  |    8 |
| 6073     | Mundaring                 | Midland           | Midland                   |    8 |
| 6202     | Mundijong                 | Armadale          | Mead Centre (Kelmscott)   |    8 |
| 6166     | Munster                   | Alma Street       | Alma Street (Cockburn)    |    8 |
| 6150     | Murdoch                   | Alma Street       | Alma Street (Central)     |    8 |
| 6154     | Myaree                    | Alma Street       | Alma Street (Central)     |    8 |
| 6207     | Nambeelup                 | Rockingham        | Peel                      |    8 |
| 6275     | Nannup                    | Bunbury           | Bunbury                   |    8 |
| 6215     | Nanga Brook               | Rockingham        | Peel                      |    8 |
| 6369     | Narembeen                 | Midland           | Merredin                  |    8 |
| 6312     | Narrogin                  |                   | Great Southern            |    8 |
| 6753     | Newman                    |                   | North West                |    8 |
| 6165     | Naval Base                | Rockingham        | Kwinana                   |    8 |
| 6009     | Nedlands                  | Graylands         | Subiaco                   |    8 |
| 6031     | Neerabup                  | Joondalup         | Joondalup                 |    8 |
| 6061     | Nollamara                 | Graylands         | Mirrabooka                |    8 |
| 6062     | Noranda                   | SCGH              | Inner City Clinic         |    8 |
| 6443     | Norseman                  |                   | South East Coastal        |    8 |
| 6020     | North Beach               | Graylands         | Osborne                   |    8 |
| 6207     | North Dandalup            | Rockingham        | Peel                      |    8 |
| 6262     | Northcliffe               | Bunbury           | Bunbury                   |    8 |
| 6159     | North Fremantle           | Alma Street       | Alma Street (Fremantle)   |    8 |
| 6163     | North Lake                | Alma Street       | Alma Street (Central)     |    8 |
| 6006     | North Perth               | SCGH              | Inner City                |    8 |
| 6401     | Northam                   | Midland           | Northam                   |    8 |
| 6535     | Northampton               | Graylands         | Geraldton HS              |    8 |
| 6003     | Northbridge               | SCGH              | Inner City                |    8 |
| 6032     | Nowergup                  | Joondalup         | Clarkson                  |    8 |
| 6163     | O’Connor                  | Alma Street       | Alma Street (Central)     |    8 |
| 6113     | Oakford                   | Armadale          | Mead Centre (Kelmscott)   |    8 |
| 6027     | Ocean Reef                | Joondalup         | Joondalup                 |    8 |
| 6710     | Onslow                    |                   | North West                |    8 |
| 6109     | Orange Grove              | Armadale          | Eudoria Street (Gosnells) |    8 |
| 6167     | Orelia                    | Rockingham        | Kwinana                   |    8 |
| 6017     | Osborne Park              | Graylands         | Osborne                   |    8 |
| 6025     | Padbury                   | Joondalup         | Joondalup                 |    8 |
| 6157     | Palmyra                   | Alma Street       | Alma Street (Melville)    |    8 |
| 6169     | Palm Beach                | Rockingham        | Rockingham                |    8 |
| 6081     | Parkerville               | Midland           | Midland                   |    8 |
| 6147     | Parkwood                  | Mills Street      | Bentley                   |    8 |
| 6210     | Parklands                 | Rockingham        | Peel                      |    8 |
| 6167     | Parmelia                  | Rockingham        | Kwinana                   |    8 |
| 6076     | Paulls Valley             | Midland           | Midland                   |    8 |
| 6085     | Pearce RAAF               | Midland           | Midland                   |    8 |
| 6065     | Pearsall                  | Joondalup         | Joondalup                 |    8 |
| 6168     | Peel Estate               | Rockingham        | Rockingham                |    8 |
| 6260     | Pemberton                 | Bunbury           | Bunbury                   |    8 |
| 6011     | Peppermint Grove          | Graylands         | Subiaco                   |    9 |
| 6620     | Perenjori                 | Graylands         | Geraldton HS              |    9 |
| 6168     | Peron                     | Rockingham        | Rockingham                |    9 |
| 6000     | Perth                     | SCGH              | Inner City                |    9 |
| 6105     | Perth Airport             | Mills Street      | Bentley                   |    9 |
| 6112     | Piara Waters              | Armadale          | Mead Centre (Armadale)    |    9 |
| 6076     | Pickering Brook           | Midland           | Midland                   |    9 |
| 6229     | Picton                    | Bunbury           | Bunbury                   |    9 |
| 6076     | Piesse Brook              | Midland           | Midland                   |    9 |
| 6308     | Pingelly                  |                   | Great Southern            |    9 |
| 6065     | Pinjar                    | Joondalup         | Joondalup                 |    9 |
| 6208     | Pinjarra                  | Rockingham        | Peel                      |    9 |
| 6721     | Port Hedland              |                   | North West                |    9 |
| 6167     | Port Kennedy              | Rockingham        | Rockingham                |    9 |
| 6167     | Postans                   | Rockingham        | Kwinana                   |    9 |
| 6215     | Preston Beach             | Rockingham        | Peel                      |    9 |
| 6383     | Quairading                | Midland           | Central Wheatbelt         |    9 |
| 6107     | Queens Park               | Mills Street      | Bentley                   |    9 |
| 6030     | Quinns Rocks              | Joondalup         | Clarkson                  |    9 |
| 6346     | Ravensthorpe              | Albany            | Albany                    |    9 |
| 6208     | Ravenswood                | Rockingham        | Peel                      |    9 |
| 6056     | Red Hill                  | Midland           | Midalnd                   |    9 |
| 6104     | Redcliffe                 | Mills Street      | Bentley                   |    9 |
| 6148     | Riverton                  | Mills Street      | Bentley                   |    9 |
| 6103     | Rivervale                 | Mills Street      | Bentley                   |    9 |
| 6168     | Rockingham                | Rockingham        | Rockingham                |    9 |
| 6168     | Rockingham East           | Rockingham        | Rockingham                |    9 |
| 6226     | Roelands                  | Bunbury           | Bunbury                   |    9 |
| 6111     | Roleystone                | Armadale          | Mead Centre (Kelmscott)   |    9 |
| 6148     | Rossmoyne                 | Mills Street      | Bentley                   |    9 |
| 6161     | Rottnest Island           | Alma Street       | Alma Street (Fremantle)   |    9 |
| 6169     | Safety Bay                | Rockingham        | Kwinana                   |    9 |
| 6152     | Salter Pointer            | Bentley           | Bentley                   |    9 |
| 6163     | Samson                    | Alma Street       | Alma Street (Central)     |    9 |
| 6210     | San Remo                  | Rockingham        | Peel                      |    9 |
| 6639     | Sandstone                 | Graylands         | Gascoyne                  |    9 |
| 6074     | Sawyers Valley            | Midland           | Midalnd                   |    9 |
| 6019     | Scarborough               | Graylands         | Osborne                   |    9 |
| 6173     | Secret Harbour            | Rockingham        | Rockingham                |    9 |
| 6205     | Serpentine                | Armadale          | Mead Centre (Kelmscott)   |    9 |
| 6112     | Seville Grove             | Armadale          | Mead Centre (Armadale)    |    9 |
| 6537     | Shark Bay                 | Graylands         | Gascoyne HS               |    9 |
| 6155     | Shelley                   | Mills Street      | Bentley                   |    9 |
| 6008     | Shenton Park              | Graylands         | Subiaco                   |    9 |
| 6169     | Shoalwater                | Rockingham        | Kwinana                   |    9 |
| 6210     | Silver Sands              | Rockingham        | Peel                      |    9 |
| 6174     | Singleton                 | Rockingham        | Rockingham                |    9 |
| 6065     | Sinagra                   | Joondalup         | Joondalup                 |    9 |
| 6020     | Sorrento                  | Joondalup         | Joondalup                 |    9 |
| 6162     | South Fremantle           | Alma Street       | Alma Street (Fremantle)   |   10 |
| 6055     | South Guildford           | Midland           | Midland                   |   10 |
| 6722     | South Hedland             |                   | Pilbara                   |   10 |
| 6164     | South Lake                | Alma Street       | Alma Street (Cockburn)    |   10 |
| 6151     | South Perth               | Mills Street      | Bentley                   |   10 |
| 6426     | Southern Cross            | Midland           | East Wheatbelt HS         |   10 |
| 6110     | Southern River            | Armadale          | Eudoria Street (Thornlie) |   10 |
| 6163     | Spearwood                 | Alma Street       | Alma Street (Cockburn)    |   10 |
| 6102     | St James                  | Mills Street      | Bentley                   |   10 |
| 6021     | Stirling                  | Graylands         | Osborne                   |   10 |
| 6081     | Stoneville                | Midland           | Midland                   |   10 |
| 6056     | Stratton                  | Midland           | Midland                   |   10 |
| 6008     | Subiaco                   | Graylands         | Subiaco                   |   10 |
| 6164     | Success                   | Alma Street       | Alma Street (Cockburn)    |   10 |
| 6056     | Swan View                 | Midland           | Midland                   |   10 |
| 6010     | Swanbourne                | Graylands         | Subiaco                   |   10 |
| 6030     | Tamala Park               | Joondalup         | Clarkson                  |   10 |
| 6320     | Tambellup                 |                   | Central Great Southern    |   10 |
| 6409     | Tammin                    | Midland           | Northam                   |   10 |
| 6065     | Tapping                   | Joondalup         | Joondalup                 |   10 |
| 6556     | The Lakes                 | Midland           | Midland                   |   10 |
| 6167     | The Spectacles            | Rockingham        | Kwinana                   |   10 |
| 6108     | Thornlie                  | Armadale          | Eudoria Street (Thornlie) |   10 |
| 6519     | Three Springs             | Midland           | Wheat Belt                |   10 |
| 6751     | Tom Price                 |                   | North West                |   10 |
| 6566     | Toodyay                   | Midland           | Wheat Belt                |   10 |
| 6488     | Trayning                  | Midland           | Merredin                  |   10 |
| 6029     | Trigg                     | Graylands         | Osborne                   |   10 |
| 6060     | Tuart Hill                | Graylands         | Osborne                   |   10 |
| 6037     | Two Rocks                 | Joondalup         | Clarkson                  |   10 |
| 6069     | Upper Swan                | Midland           | Midland                   |   10 |
| 6100     | Victoria Park             | Mills Street      | Bentley                   |   10 |
| 6056     | Viveash                   | Midland           | Midland                   |   10 |
| 6315     | Wagin                     |                   | Great Southern            |   10 |
| 6169     | Waikiki                   | Rockingham        | Rockingham                |   10 |
| 6076     | Walliston                 | Midland           | Midland                   |   10 |
| 6308     | Wandering                 |                   | Upper Great Southern      |   10 |
| 6167     | Wandi                     | Rockingham        | Kwinana                   |   10 |
| 6065     | Wangara                   | Joondalup         | Joondalup                 |   10 |
| 6065     | Wanneroo                  | Joondalup         | Joondalup                 |   10 |
| 6210     | Wannanup                  | Rockingham        | Peel                      |   10 |
| 6169     | Warnbro                   | Rockingham        | Rockingham                |   10 |
| 6215     | Waroona                   | Rockingham        | Peel                      |   10 |
| 6024     | Warwick                   | Joondalup         | Joondalup                 |   10 |
| 6152     | Waterford                 | Mills Street      | Bentley                   |   10 |
| 6228     | Waterloo                  | Bunbury           | Bunbury                   |   10 |
| 6020     | Waterman                  | Graylands         | Osborne                   |   10 |
| 6107     | Wattle Grove              | Mills Street      | Bentley                   |   10 |
| 6166     | Wattleup                  | Alma Street       | Alma Street (Cockburn)    |   10 |
| 6170     | Wellard                   | Rockingham        | Kwinana                   |   11 |
| 6106     | Welshpool                 | Mills Street      | Bentley                   |   11 |
| 6014     | Wembley                   | Graylands         | Subiaco                   |   11 |
| 6019     | Wembley Downs             | Graylands         | Osborne                   |   11 |
| 6007     | West Leederville          | SCGH              | Inner City                |   11 |
| 6005     | West Perth                | SCGH              | Inner City                |   11 |
| 6055     | West Swan                 | Midland           | Midland                   |   11 |
| 6112     | Westfield                 | Armadale          | Mead Centre (Kelmscott)   |   11 |
| 6061     | Westminster               | Graylands         | Mirrabooka                |   11 |
| 6225     | West Arthur               | Albany            | Lower Great Southern      |   11 |
| 6123     | Whitby                    | Armadale          | Meade Centre (Armadale)   |   11 |
| 6162     | White Gum Valley          | Alma Street       | Alma Street (Fremantle)   |   11 |
| 6068     | Whiteman                  | Midland           | Midland                   |   11 |
| 6370     | Wickepin                  | Midland           | Narrogin                  |   11 |
| 6720     | Wickham                   |                   | West Pilbara              |   11 |
| 6286     | Witchcliffe               | Bunbury           | Bunbury                   |   11 |
| 6038     | Wilbinga                  | Graylands         | Osborne                   |   11 |
| 6156     | Willagee                  | Alma Street       | Alma Street (Melville)    |   11 |
| 6155     | Willeton                  | Mills Street      | Bentley                   |   11 |
| 6243     | Wilga                     | Bunbury           | Bunbury                   |   11 |
| 6391     | Williams                  |                   | Narrogin                  |   11 |
| 6107     | Wilson                    | Mills Street      | Bentley                   |   11 |
| 6646     | Wiluna                    | Kalgoorlie        | Murchison HS              |   11 |
| 6150     | Winthrop                  | Alma Street       | Alma Street (Central)     |   11 |
| 6603     | Wongan Hills-Ballidu      | Midland           | Wheat Belt                |   11 |
| 6221     | Wokalup                   | Bunbury           | Bunbury                   |   11 |
| 6168     | Woodbridge                | Rockingham        | Rockingham                |   11 |
| 6056     | Woodbridge                | Midland           | Midland                   |   11 |
| 6316     | Woodanilling              | Midland           | Wheat Belt                |   11 |
| 6018     | Woodlands                 | Graylands         | Osborne                   |   11 |
| 6026     | Woodvale                  | Joondalup         | Joondalup                 |   11 |
| 6558     | Wooroloo                  | Midland           | Midland                   |   11 |
| 6603     | Wongan Hills              | Swan Valley       | Wheat Belt                |   11 |
| 6560     | Wundowie                  | Swan Valley       | Wheat Belt                |   11 |
| 6740     | Wyndham                   |                   | Kimberley                 |   11 |
| 6112     | Wungong                   | Armadale          | Mead Centre (Kelmscott)   |   11 |
| 6485     | Wyalkatchem               |                   | East Wheatbelt            |   11 |
| 6635     | Yalgoo                    | Bunbury           | Bunbury                   |   11 |
| 6282     | Yallingup                 | Bunbury           | Bunbury                   |   11 |
| 6035     | Yanchep                   | Joondalup         | Clarkson                  |   11 |
| 6164     | Yangebup                  | Alma Street       | Alma Street (Cockburn)    |   11 |
| 6218     | Yarloop                   | Bunbury           | Bunbury                   |   11 |
| 6061     | Yirrigan                  | Graylands         | Mirrabooka                |   11 |
| 6060     | Yokine                    | Graylands         | Mirrabooka                |   11 |
| 6256     | Yornup                    | Bunbury           | Bunbury                   |   11 |
| 6302     | York                      | Midland           | Northam                   |   11 |
| 6208     | Yunderup South/North      | Rockingham        | Peel                      |   11 |

**Row count: 537.** Distinct suburb strings: 532. Distinct postcodes: 261.

Two rows are exact duplicates of another row (same postcode, suburb, hospital and clinic) — they
appear twice in S2015 itself and have been left in rather than silently deduplicated:

- `6253 Balingup / Bunbury / Bunbury` — appears twice on page 1
- `6606 Ballidu / Midland / Northam` — appears twice on page 1

Three suburb names appear twice with **different** values, which is a real conflict, not a duplicate:

- **Woodbridge** — `6168 / Rockingham / Rockingham` and `6056 / Midland / Midland`. Two genuinely
  different WA localities share the name; both rows are correct and a postcode is required to
  disambiguate.
- **Karratha** — `6714 / (no hospital) / North West` and `6714 / (no hospital) / West Pilbara`.
  Same postcode, two different clinics. Unresolved in the source.
- **Bunbury** — `6231 / Bunbury / Bunbury` and `6230 / Bunbury / Bunbury`. Two postcodes, same
  routing; harmless.

### Suburb lists from the sources that have no postcodes

S2023, SMETRO and SRPBG give suburb names only. They cannot be turned into postcode rows without
inventing postcodes, so they are given as team lists instead.

**S2023 (November 2023, South Metropolitan Health Service) — 129 suburbs:**

- **FREMANTLE** (49): Alfred Cove, Applecross, Ardross, Attadale, Atwell, Aubin Grove, Banjup, Bateman, Beaconsfield, Beeliar, Bibra Lake, Bicton, Booragoon, Brentwood, Bull Creek, Cockburn central, Coogee, Coolbellup, East Fremantle, Fremantle, Hamilton Hill, Hammond Park, Henderson, Hilton, Jandakot, Kardinya, Leeming, Melville, Mount Pleasant, Munster, Murdoch, Myaree, North Coogee, North Fremantle, North Lake, O’Connor, Palmyra, Rottnest Island, Samson, South Fremantle, South Lake, Spearwood, Success, Treeby, Wattleup, White Gum Valley, Willagee, Winthrop, Yangebup
- **ROCKINGHAM KWINANA** (31): Anketell, Baldivis, Calista, Casuarina, Cooloongup, Garden Island, Golden Bay, Hillman, Hope Valley, Karnup, Kwinana Town, Kwinana Beach, Leda, Mandogalup, Medina, Naval Base, Orelia, Palm Beach, Peron, Port Kennedy, Postans, Rockingham, Safety Bay, Secret Harbour, Shoalwater, Singleton, The Spectacles, Waikiki, Warnbro, Wandi, Wellard
- **PEEL** (49): Banksiadale, Barragup, Birchmont, Blythewood, Bouvard, Clifton, Coodanup, Coolup, Dawesville, Dudly Park, Dwellingup, Erskine, Etmilyn, Fairbridge, Falcon, Furnissdale, Greenfields, Halls Head, Hamel, Herron, Inglehope, Lakelands, Lake Clifton, Madora Bay, Mandurah, Meadow Springs, Meelon, Myara, Nambeelup, Nanga Brook, Nirinba, North Dandelup, North Yunderup, Parklands, Pinjarra/Carcoola, Point Grey, Preston Beach, Ravenswood, San Remo, Silver Sands, Solus, South Yunderup, Stakehill, Teesdale, Wagerup, Wannunup, Waroona, West Coolup, Whittaker

Total S2023 = 129.

**SMETRO (undated) — 406 suburbs across 12 blocks:**

- **ARMADALE** (38): Araluen, Armadale, Beckenham, Bedfordale, Brookdale, Byford, Canning Mills, Canning Vale, Cardup, Darling Downs, Forrestdale, Gosnells, Hopeland, Huntingdale, Jarrahdale, Karragullen, Karrakup, Kelmscott, Keysbrook, Kenwick, Langford, Maddington, Mardella, Martin, Mt Nasura, Mt Richan, Mundijong, Oakford, Oldbury, Orange Grove, Roleystone, Serpentine, Seville Grove, Southern River, Thornlie, Westfield, Whitby, Wungong
- **INNER CITY** (12): Bayswater, Bedford, East Perth, Embleton, Highgate, lnglewood, Maylands, Morley, Mount Lawley, Northbridge, Perth, West Perth
- **BENTLEY** (34): Ascot, Belmont, Bentley, Burswood, Cannington, Carlisle, Cloverdale, Como, East Cannington, East Victoria Park, Ferndale, Karawara, Kensington, Kewdale, Lathlain, Lynwood, Manning, Parkwood, Perth Airport, Queens Park, Redcliffe, Riverton, Rivervale, Rossmoyne, Salter Point, Shelley, South Perth, St James, Victoria Park, Waterford, Wattle Grove, Welshpool, Willetton, Wilson
- **MIDLAND** (74): Ashfield, Aveley, Avon Valley National Park, Bailup, Baskerville, Bassendean, Beechboro, Beechina, Belhus, Bellevue, Bennett Springs, Bickley, Boya, Brabham, Brigadoon, Bullsbrook, Carmel, Caversham, Chidlow, Darlington, Dayton, Eden Hill, Ellenbrook, Forrestfield, Gidgegannup, Glen Forrest, Gooseberry Hill, Gorrie, Greenmount, Guildford, Hacketts Gully, Hazelmere, Helena Valley, Henley Brook, Herne Hill, High Wycombe, Hovea, Jane Brook, Kalamunda, Kiara, Koongamia, Lesmurdie, Lockridge, Mahogany Creek, Maida Vale, Malmalling, Melaleuca, Middle Swan, Midland, Midvale, Millendon, Mount Helena, Mundaring, Parkerville, Paulis Valley, Pickering Brook, Piesse Brook, Red Hill, Reservoir, Sawyers Valley, South Guildford, Stoneville, Stratton, Swan View, The Lakes, The Vines, Upper Swan, Viveash, Walliston, Walyunga National Park, West Swan, Whiteman, Woodbridge, Wooroloo
- **ROCKINGHAM KWINANA** (36): Anketell, Baldivis, Becher, Calista, Casuarina, Challenger, Cooloongup, Garden Island, Goegrup, Golden Bay, Hillman, Hope Valley, Karnup, Kwinana Town, Kwinana Beach, Leda, Madara, Mandogalup, Medina, Naval Base, Orelia, Palm Beach, Peel Estate, Peron, Port Kennedy, Postans, Rockingham, Safety Bay, Secret Harbour, Shoalwater, Singleton, The Spectacles, Waikiki, Warnbro, Wandi, Wellard
- **FREMANTLE** (48): Alfred Cove, Applecross, Ardross, Attadale, Atwell, Aubin Grove, Banjup, Bateman, Beaconsfield, Beeliar, Bibra Lake, Bicton, Booragoon, Brentwood, Bull Creek, Cockburn Central, Coogee, Coolbellup, East Fremantle, Fremantle, Hamilton Hill, Hammond Park, Henderson, Hilton, Jandakot, Kardinya, Leeming, Melville, Mount Pleasant, Munster, Murdoch, Myaree, North Coogee, North Fremantle, North Lake, O'Connor, Palmyra, Rottnest Island, Samson, South Fremantle, South Lake, Spearwood, Success, Wattleup, White Gum Valley, Willagee, Winthrop, Yangebup
- **PEEL** (52): Banksiadale, Barragup, Birchmont, Blythewood, Bouvard, Clifton, Coodanup, Coolup, Dawesville, Dudly Park, Dwellingup, Erskine, Etmilyn, Fairbridge, Falcon, Furnissdale, Greenfields, Halls Head, Hamel, Herron, Holyoake, lnglehope, Lakelands, Lake Clifton, Madara Bay, Mandurah, Marriniup, Meadow Springs, Meelon, Myara, Nambeelup, Nanga Brook, Nirinba, North Dandalup, North Yunderup, Oakley, Parklands, Pinjarra/Carcoola, Point Grey, Preston Beach, Ravenswood, San Remo, Silver Sands, Salus, South Yunderup, Stakehill, Teesdale, Wagerup, Wannunup, Waroona, West Coolup, Whittaker
- **JOONDALUP** (36): Ashby, Banksia Grove, Burns Beach, Beldon, Carramar, Connolly, Craigie, Currambine, Duncraig, Edgewater, Gnangara, Greenwood, Heathridge, Hillarys, Hocking, lluka, Jandabup, Joondalup, Kallaroo, Kingsley, Kinross, Mariginiup, Marmion, Mullaloo, Neerabup, Ocean Reef, Padbury, Pearsall, Pinjar, Sinagra, Sorrento, Tapping, Wangara, Wanneroo, Warwick, Woodvale
- **LOWER WEST** (24): City Beach, Claremont, Coolbinia, Cottesloe, Crawley, Daglish, Dalkeith, Florea!, Jolimont, Karrakatta, Kings Park, Leederville, Menora, Mosman Park, Mt Claremont, Mt Hawthorn, Nedlands, North Perth, Peppermint Grove, Shenton Park, Subiaco, Swanbourne, Wembley, West Leederville
- **UNLABELLED-A (lines 83-85)** (20): Balcatta, Carine, Churchlands, Doubleview, Glendalough, Gwelup, Hamersley, Herdsman, lnnaloo, Joondanna, Karrinyup, North Beach, Osborne Park, Scarborough, Stirling, Trigg, Tuart Hill, Waterman's Bay, Wembley Downs, Woodlands
- **CLARKSON** (14): Alkimos, Butler, Carabooda, Clarkson, Eglinton, Jindalee, Merriwa, Mindarie, Nowergup, Quinns Rock, Ridgewood, Tamala Park, Two Rocks, Yanchep
- **UNLABELLED-B (line 89)** (18): Alexander, Balga, Ballajura, Cullacabardee, Darch, Dianella, Girrawheen, Koondoola, Landsdale, Lexia, Madeley, Malaga, Marangaroo, Mirrabooka, Nollamara, Noranda, Westminster, Yokine

**SRPBG (undated, Royal Perth Bentley Group Service 3) — 119 suburbs:**

- **Midland** (74): Ashfield, Aveley, Avon Valley National Park, Bailup, Baskerville, Bassendean, Beechboro, Beechina, Belhus, Bellevue, Bennett Springs, Bickley, Boya, Brabham, Brigadoon, Bullsbrook, Carmel, Caversham, Chidlow, Darlington, Dayton, Eden Hill, Ellenbrook, Forrestfield, Gidgegannup, Glen Forrest, Gooseberry Hill, Gorrie, Greenmount, Guildford, Hacketts Gully, Hazelmere, Helena Valley, Henley Brook, Herne Hill, High Wycombe, Hovea, Jane Brook, Kalamunda, Kiara, Koongamia, Lesmurdie, Lockridge, Mahogany Creek, Maida Vale, Malmalling, Melaleuca, Middle Swan, Midland, Midvale, Millendon, Mount Helena, Mundaring, Parkerville, Paulls Valley, Pickering Brook, Piesse Brook, Red Hill, Reservoir, Sawyers Valley, South Guildford, Stoneville, Stratton, Swan View, The Lakes, The Vines, Upper Swan, Viveash, Walliston, Walyunga National Park, West Swan, Whiteman, Woodbridge, Wooroloo
- **Bentley** (33): Ascot, Belmont, Bentley, Burswood, Cannington, Carlisle, Cloverdale, Como, East Cannington, East Victoria Park, Ferndale, Karawara, Kensington, Kewdale, Lathlain, Lynwood, Manning, Parkwood, Perth Airport, Queens Park, Redcliffe, Riverton, Rivervale, Rossmoyne, Salter Point, Shelley, South Perth, St James, Victoria Park, Waterford, Welshpool, Willetton, Wilson
- **Inner City** (12): Bayswater, Bedford, East Perth, Embleton, Highgate, Inglewood, Maylands, Morley, Mount Lawley, Northbridge, Perth, West Perth

How these three lists were split into suburbs: S2023's columns interleave four to six lines per
row, and the split was verified by checking that every one of the six resulting columns reads in
alphabetical order end to end. SMETRO and SRPBG run suburb names together on one line separated
only by spaces, so multi-word names ("Canning Vale", "Avon Valley National Park") were
re-assembled by longest match against the S2015 suburb vocabulary. Every token that could not be
matched is listed in section 5 rather than being guessed at.

---

## 4. Reconciliation — every disagreement between the sources

**Nothing below has been resolved.** Where a judgement is offered it is labelled as one, and the
data in section 3 is unchanged by it.

### 4.1 S2023 (Nov 2023) vs S2015 — South Metropolitan team assignment

Of the 129 suburbs in S2023, matched by exact name against S2015:

- **96 agree** — S2015 puts them under a clinic belonging to the same team.
- **5 disagree** — listed below.
- **28 have no exact name match in S2015 at all** — listed in section 5.

**The 5 suburbs where the two documents assign different teams:**

| Suburb      | S2023 (Nov 2023) says | S2015 says                                              | Nature of the disagreement                                                                                                                                              |
| ----------- | --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Halls Head  | PEEL                  | 6210, hospital Rockingham, clinic **Rockingham**        | Straight contradiction. Peel vs Rockingham.                                                                                                                             |
| Mandurah    | PEEL                  | 6210, hospital Rockingham, clinic **Rockingham**        | Straight contradiction. Note S2015 separately lists `Central Mandurah` (6210) under clinic **Peel**, so S2015 splits Mandurah between two teams.                        |
| Furnissdale | PEEL                  | 6210, hospital Rockingham, clinic **Rockingham/Peel**   | S2015 hedges with a two-team value; S2023 commits to Peel.                                                                                                              |
| Birchmont   | PEEL                  | 6214, hospital Rockingham, clinic **Kwinana/Peel**      | S2015 hedges; S2023 commits to Peel.                                                                                                                                    |
| Calista     | ROCKINGHAM KWINANA    | 6167, hospital **Kwinana**, clinic **Peel /Rockingham** | S2015 hedges, and also uses "Kwinana" as an approved hospital here, which it does for only one other suburb in the whole document. S2023 commits to Rockingham Kwinana. |

**My reading, which the owner should be able to overrule:** for all five, S2023 is the more
recent document and states a single team, and for Halls Head and Mandurah the geography makes
Peel the more plausible answer. But S2015 is the only source with postcodes, so if S2023 is
adopted for these five, the routing data will be carrying a 2023 team name on a 2015 postcode
that was never re-verified. I have **not** applied any of these changes.

**Suburbs S2015 assigns to a South Metro team that do not appear in S2023 at all** (18 rows).
Some are clearly the same place spelled differently; others look genuinely dropped or absorbed:

| S2015 row                                               | Likely S2023 counterpart        | Assessment                                                                                                                     |
| ------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 6167 Anketel / Rockingham / Kwinana                     | Anketell                        | Spelling. S2015 `Anketel` is one `l` short of every other source.                                                              |
| 6210 Dudley Park / Rockingham / Peel                    | Dudly Park                      | Spelling. S2015 `Dudley` looks correct; S2023 and SMETRO both write `Dudly`.                                                   |
| 6207 North Dandalup / Rockingham / Peel                 | North Dandelup                  | Spelling. S2015 and SMETRO write `Dandalup`; S2023 writes `Dandelup`.                                                          |
| 6153 Mt Pleasant / Alma Street / Alma Street (Melville) | Mount Pleasant                  | Abbreviation only.                                                                                                             |
| 6210 Wannanup / Rockingham / Peel                       | Wannunup                        | Spelling.                                                                                                                      |
| 6208 Yunderup South/North / Rockingham / Peel           | North Yunderup + South Yunderup | S2015 combines them into one row; S2023 splits them into two.                                                                  |
| 6208 Pinjarra / Rockingham / Peel                       | Pinjarra/Carcoola               | S2023 combines Pinjarra with Carcoola; S2015 has Pinjarra alone and no Carcoola row anywhere.                                  |
| 6210 Central Mandurah / Rockingham / Peel               | Mandurah                        | S2015 has both `Mandurah` (clinic Rockingham) and `Central Mandurah` (clinic Peel); S2023 has one `Mandurah` under Peel.       |
| 6163 Hilton Park / Alma Street / Alma Street            | Hilton                          | S2015 has both `Hilton` (clinic Alma Street (Central)) and `Hilton Park` (bare clinic `Alma Street`). S2023 has only `Hilton`. |
| 6167 Bertram / Rockingham / Rockingham                  | _none_                          | Not in S2023, SMETRO or SRPBG. Cannot determine whether it was dropped or renamed.                                             |
| 6167 Kwinana / Rockingham / Rockingham                  | _none_                          | S2023 has `Kwinana Town` and `Kwinana Beach` but no bare `Kwinana`.                                                            |
| 6167 Parmelia / Rockingham / Kwinana                    | _none_                          | Absent from all newer sources.                                                                                                 |
| 6168 Challenger / Rockingham / Rockingham               | _none in S2023_                 | Still present in SMETRO under ROCKINGHAM KWINANA. Dropped between SMETRO and S2023.                                            |
| 6168 Peel Estate / Rockingham / Rockingham              | _none in S2023_                 | Still present in SMETRO under ROCKINGHAM KWINANA. Dropped between SMETRO and S2023.                                            |
| 6168 East Rockingham / Rockingham / Rockingham          | _none_                          | Absent from all newer sources.                                                                                                 |
| 6168 Rockingham East / Rockingham / Rockingham          | _none_                          | S2015 lists both `East Rockingham` and `Rockingham East` at 6168. Probably one place written two ways, inside S2015 itself.    |
| 6168 Woodbridge / Rockingham / Rockingham               | _none_                          | Distinct from 6056 Woodbridge (Midland). Absent from newer sources.                                                            |
| 6211 Florida Beach / Rockingham / Peel                  | _none_                          | Absent from all newer sources.                                                                                                 |

### 4.2 SMETRO (undated) vs S2023 (Nov 2023) — the same three teams

| Team               | SMETRO count | S2023 count | Only in SMETRO                                              | Only in S2023             |
| ------------------ | -----------: | ----------: | ----------------------------------------------------------- | ------------------------- |
| FREMANTLE          |           48 |          49 | _(none)_                                                    | Treeby                    |
| ROCKINGHAM KWINANA |           36 |          31 | Becher, Challenger, Goegrup, Madara, Peel Estate            | _(none)_                  |
| PEEL               |           52 |          49 | Holyoake, Marriniup, Oakley, plus 4 spelling variants below | 4 spelling variants below |

Four PEEL entries differ only in spelling, and in each case it is not obvious which is right:

| SMETRO           | S2023            | S2015            | Comment                                                                                                                                                                                                                                         |
| ---------------- | ---------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lnglehope`      | `Inglehope`      | _(absent)_       | SMETRO begins the word with a lower-case L, a classic OCR substitution for a capital I.                                                                                                                                                         |
| `Madara Bay`     | `Madora Bay`     | `Madora Bay`     | S2015 and S2023 agree on `Madora`; SMETRO is the outlier. SMETRO **also** has a bare `Madara` in ROCKINGHAM KWINANA, which may be a second corruption of the same name sitting in the wrong team, or a real place. I could not determine which. |
| `North Dandalup` | `North Dandelup` | `North Dandalup` | S2015 and SMETRO agree on `Dandalup`; S2023 is the outlier.                                                                                                                                                                                     |
| `Salus`          | `Solus`          | _(absent)_       | Neither can be checked against a third source. Unresolved.                                                                                                                                                                                      |

**My reading:** SMETRO sits between the two dated documents. It carries suburbs S2015 has and
S2023 dropped (Challenger, Peel Estate), and it carries suburbs S2015 does not have but S2023
does (Anketell, Cockburn Central, Mount Pleasant, North Coogee). That ordering is inference from
content, **not** from a date — SMETRO carries no date at all.

### 4.3 SMETRO vs SRPBG (both undated) — Midland, Bentley, Inner City

These two documents cover the same three teams and are nearly identical. Three differences:

| Team                      | SMETRO                              | SRPBG                         | Comment                                                                                                                                                        |
| ------------------------- | ----------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Midland (74 suburbs each) | `Paulis Valley`                     | `Paulls Valley`               | S2015 also has `Paulls Valley` (6076), so **SMETRO is the outlier** and `Paulis` is almost certainly an OCR corruption of `Paulls`. Both preserved as written. |
| Bentley                   | 34 suburbs, includes `Wattle Grove` | 33 suburbs, no `Wattle Grove` | S2015 has `Wattle Grove` (6107, hospital Mills Street, clinic Bentley). SRPBG appears to have dropped it; SMETRO and S2015 agree it belongs.                   |
| Inner City (12 each)      | `lnglewood`                         | `Inglewood`                   | S2015 has `Inglewood` (6052). SMETRO's lower-case L is an OCR corruption.                                                                                      |

### 4.4 SMETRO team blocks vs S2015 clinic values

For every suburb in each SMETRO block I looked up what S2015 gives as the follow-up clinic.
Where a block maps cleanly onto one S2015 clinic there is nothing to report; the exceptions are:

| SMETRO block       | Suburb                                                                                 | S2015 says                                          | Comment                                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ARMADALE           | Beckenham                                                                              | 6107, hospital **Bentley**, clinic **Bentley**      | S2015 routes Beckenham to Bentley, not Armadale. Direct contradiction.                                                                                                         |
| BENTLEY            | Belmont (6104), Bentley (6102), East Cannington (6107)                                 | clinic **Mills Street**                             | The other 29 Bentley-block suburbs say clinic `Bentley`. An internal S2015 inconsistency rather than a cross-source one — Mills Street is the Bentley clinic's street address. |
| MIDLAND            | Bickley                                                                                | 6076, clinic **Swan**                               | The only row in all 537 that uses the clinic name `Swan`. Every other Midland-block suburb says `Midland`. Unexplained.                                                        |
| MIDLAND            | Woodbridge                                                                             | 6168, hospital Rockingham, clinic Rockingham        | Not a real conflict: S2015 has two Woodbridges, and the Midland one is 6056.                                                                                                   |
| JOONDALUP          | Burns Beach (6028), Kinross (6028)                                                     | clinic **Clarkson**                                 | S2015 routes these to Clarkson; SMETRO puts them in the Joondalup block.                                                                                                       |
| CLARKSON           | Alkimos (6033), Merriwa (6030)                                                         | clinic **Joondalup**                                | The mirror image of the row above. The Joondalup/Clarkson boundary moved between the two documents, in both directions.                                                        |
| INNER CITY         | Bayswater (6053), Bedford (6052)                                                       | clinic **ICC**                                      | Almost certainly the same clinic abbreviated, not a different one.                                                                                                             |
| LOWER WEST         | Coolbinia, Kings Park, Leederville, Menora, Mt Hawthorn, North Perth, West Leederville | clinic **Inner City** or **ICC**                    | The remaining 16 Lower West suburbs map to S2015's `Subiaco` clinic. `LOWER WEST` is a newer team name covering what S2015 split between Subiaco and Inner City.               |
| PEEL               | Halls Head, Mandurah                                                                   | clinic **Rockingham**                               | The same disagreement as 4.1, appearing in a second source.                                                                                                                    |
| ROCKINGHAM KWINANA | Calista, Hillman                                                                       | clinic **Peel /Rockingham**, **Rockingham/Kwinana** | S2015's two-team hedges.                                                                                                                                                       |

### 4.5 Spelling and typo variants across the sources

Every one of these is preserved as written in section 3 and in the team lists. None has been corrected.

| Name              | S2015               | S2023              | SMETRO                | SRPBG           | Which looks wrong                                                                        |
| ----------------- | ------------------- | ------------------ | --------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| Anketell          | `Anketel`           | `Anketell`         | `Anketell`            | —               | S2015                                                                                    |
| Paulls Valley     | `Paulls Valley`     | —                  | `Paulis Valley`       | `Paulls Valley` | SMETRO                                                                                   |
| Inglewood         | `Inglewood`         | —                  | `lnglewood`           | `Inglewood`     | SMETRO (lower-case L for I)                                                              |
| Inglehope         | _(absent)_          | `Inglehope`        | `lnglehope`           | —               | SMETRO (lower-case L for I)                                                              |
| Innaloo           | `Innaloo`           | —                  | `lnnaloo`             | —               | SMETRO (lower-case L for I)                                                              |
| Iluka             | `Iluka`             | —                  | `lluka`               | —               | SMETRO (lower-case L for I)                                                              |
| Floreat           | `Floreat`           | —                  | `Florea!`             | —               | SMETRO (`t` read as `!`)                                                                 |
| Mt Richon         | `Mt Richon`         | —                  | `Mt Richan`           | —               | SMETRO                                                                                   |
| Quinns Rocks      | `Quinns Rocks`      | —                  | `Quinns Rock`         | —               | Cannot tell; both forms are in real-world use                                            |
| Salter Point      | `Salter Pointer`    | —                  | `Salter Point`        | `Salter Point`  | S2015                                                                                    |
| Madora Bay        | `Madora Bay`        | `Madora Bay`       | `Madara Bay`          | —               | SMETRO                                                                                   |
| Dudley Park       | `Dudley Park`       | `Dudly Park`       | `Dudly Park`          | —               | S2023 and SMETRO agree with each other but both look wrong                               |
| North Dandalup    | `North Dandalup`    | `North Dandelup`   | `North Dandalup`      | —               | S2023                                                                                    |
| Wannanup          | `Wannanup`          | `Wannunup`         | `Wannunup`            | —               | S2015                                                                                    |
| Solus / Salus     | _(absent)_          | `Solus`            | `Salus`               | —               | Undeterminable                                                                           |
| Alexander Heights | `Alexander Heights` | —                  | `Alexander`           | —               | SMETRO looks truncated at a line break                                                   |
| Cockburn Central  | _(absent)_          | `Cockburn central` | `Cockburn Central`    | —               | S2023 lower-cases the second word                                                        |
| O'Connor          | `O’Connor` (curly)  | `O’Connor` (curly) | `O'Connor` (straight) | —               | The apostrophe character differs, which will break exact string matching between sources |
| Mount Pleasant    | `Mt Pleasant`       | `Mount Pleasant`   | `Mount Pleasant`      | —               | Abbreviation only                                                                        |

Two clinic names inside S2015 are themselves typos, already noted in section 2: `Midalnd`
(2 rows) and `Meade Centre (Armadale)` (1 row).

---

## 5. Coverage gaps and things I could not determine

### 5.1 Rows where a column is empty in S2015

- **41 rows have no APPROVED HOSPITAL.** All are country localities. The full list is in
  section 1. This is a real blank in the source, not a parsing failure: the 4-line record
  structure holds without drift across all 537 records, so the blank line is a blank cell.
- **1 row has neither hospital nor clinic: `6798 Christmas Island`.** It is the only row in the
  document with both columns empty. There is no way to tell from these sources where a Christmas
  Island referral goes.

### 5.2 Suburbs present in the newer sources but absent from S2015

These 28 S2023 suburbs have no exact-name row in S2015, so **they have no postcode in any source
supplied**. They cannot be added to the seed table without inventing a postcode.

- **FREMANTLE (4):** Cockburn central, Mount Pleasant, North Coogee, Treeby
  — of these, `Mount Pleasant` is S2015's `Mt Pleasant` (6153); the other three are genuinely
  new. Treeby and North Coogee are post-2015 developments, which is consistent.
- **ROCKINGHAM KWINANA (1):** Anketell — S2015 has `Anketel` (6167).
- **PEEL (23):** Banksiadale, Blythewood, Bouvard, Clifton, Dudly Park, Etmilyn, Fairbridge,
  Inglehope, Meelon, Myara, Nirinba, North Dandelup, North Yunderup, Pinjarra/Carcoola,
  Point Grey, Solus, South Yunderup, Stakehill, Teesdale, Wagerup, Wannunup, West Coolup,
  Whittaker.
  Of these, `Dudly Park`, `North Dandelup`, `North Yunderup`, `South Yunderup`,
  `Pinjarra/Carcoola` and `Wannunup` correspond to differently-spelled or differently-split
  S2015 rows (see 4.1). The remaining **17 Peel localities appear in no S2015 row at all**, so
  S2015 simply does not cover the inland Peel/Murray/Waroona shires at suburb level.

Additionally, from SMETRO: 3 ARMADALE suburbs (Karrakup, Mt Richan, Oldbury), 2 BENTLEY
(`Willetton`, `Salter Point` — S2015 has the typo `Salter Pointer`), 1 INNER CITY (`lnglewood`),
3 ROCKINGHAM KWINANA (`Becher`, `Goegrup`, `Madara`), 4 PEEL (`Holyoake`, `Marriniup`, `Oakley`,
`Salus`), 1 JOONDALUP (`lluka` — S2015 has `Iluka`), 1 CLARKSON (`Ridgewood`) and 2 from the
unlabelled Mirrabooka-area block (`Lexia`, and `Alexander` which is probably S2015's
`Alexander Heights`) have no S2015 row. **`Willetton` and `Ridgewood` are ordinary established
metropolitan suburbs missing from the 2015 statewide list — that is a gap in S2015 itself.**

Also missing from S2015: `Cockburn Central` in any spelling, and any `Carcoola` row.

### 5.3 Nirinba is in the PEEL column of S2023

S2023 lists **Nirinba** under PEEL. Nirinba is a Kwinana locality and SMETRO lists it under PEEL
too. I have not moved it. The column split for S2023 was verified by checking that all six
columns read in strict alphabetical order, and Nirinba falls exactly between `Nanga Brook` and
`North Dandelup` in the Peel column — so this is what the document says, not a parsing slip.
Whether the document is right is a question for the owner.

### 5.4 SMETRO — two suburb blocks lost their team name

SMETRO has **12 suburb blocks but only 10 team headers**. Two blocks are unlabelled:

- **Lines 83–85** (20 suburbs: Balcatta, Carine, Churchlands, Doubleview, Glendalough, Gwelup,
  Hamersley, Herdsman, lnnaloo, Joondanna, Karrinyup, North Beach, Osborne Park, Scarborough,
  Stirling, Trigg, Tuart Hill, Waterman's Bay, Wembley Downs, Woodlands).
  In S2015, 16 of these have clinic `Osborne` and 2 have `Osborne Park`; 2 are absent.
- **Line 89** (18 suburbs: Alexander, Balga, Ballajura, Cullacabardee, Darch, Dianella,
  Girrawheen, Koondoola, Landsdale, Lexia, Madeley, Malaga, Marangaroo, Mirrabooka, Nollamara,
  Noranda, Westminster, Yokine).
  In S2015, 13 have clinic `Mirrabooka`, 2 have `Midland` (Cullacabardee, Malaga), 1 has
  `Inner City Clinic` (Noranda); 2 are absent.

The S2015 evidence points to these being **Osborne** and **Mirrabooka** respectively, and the
header block at the top of SMETRO does not list either name. **I have not labelled them** — the
team names are genuinely not in the extracted file, and one of them was probably lost the same
way the `BENTLEY` header survived only as the corrupted string `487679356BENTLEY`.

### 5.5 Extraction artefacts

- `catchment-Rural_Catchment.txt` contains only `455676294639Appendix 1: WACHS Alignments` — a
  stray digit run glued to a caption. **It has no data.** The appendix content is the image.
- `catchment-Mental_Health_Catchment.txt` line 3 is `14629179606487` — a stray digit run above
  the title.
- `catchment-Metro_Catchment.txt` line 39 is `487679356BENTLEY P: 9416 3544` — a stray digit run
  glued to the BENTLEY heading; and its last line is a bare `12`, a page number.
- S2015 page 12 contains no catchment rows, only the community clinic address list.
- SMETRO and SRPBG run suburb names together on a line with only spaces between them, so
  multi-word names had to be re-assembled. I did this by longest match against the S2015 suburb
  vocabulary. **Every token that failed to match a known name was left as its own single-word
  entry and is listed in 5.2 rather than being guessed at.** Two joins needed vocabulary that
  S2015 does not have and were made from the source's own line (`Mt Richan`, `Paulis Valley`).

### 5.6 What I could not determine

1. **The dates of SMETRO and SRPBG.** Neither document carries one. Everything said about their
   ordering relative to S2015 and S2023 is inference from content.
2. **Whether SMETRO's `Madara` (Rockingham Kwinana) is a real place** or a corruption of
   `Madora Bay` sitting in the wrong team. It appears in no other source.
3. **Whether `Salus` (SMETRO) or `Solus` (S2023) is the correct Peel locality.** No third source.
4. **Postcodes for any suburb that appears only in S2023, SMETRO or SRPBG.** None of those three
   documents carries postcodes at all.
5. **Approved hospitals for the S2023 teams.** S2023 has no hospital column. The admitting site
   for a 2023-era Fremantle/Rockingham Kwinana/Peel referral cannot be read from these sources —
   S2015 says Alma Street and Rockingham, but Fiona Stanley Hospital opened in 2014–15 and
   appears nowhere in S2015's approved-hospital column, while the SWACHS image names FSH as the
   South Link destination. **S2015's approved-hospital column is very likely out of date for
   south metro and I would not seed routing from it without the owner confirming.**
6. **Where a Karratha referral goes.** S2015 has two `6714 Karratha` rows with different clinics
   (`North West` and `West Pilbara`) and no hospital on either.
7. **Whether `East Rockingham` and `Rockingham East` (both 6168, identical routing) are one place
   or two.**
8. **Why `Bickley` (6076) alone has the clinic `Swan`.**
9. **What the WACHS image's date or version is**, and whether it is still current.

---

## 6. Structure worth knowing before this becomes seed data

### 6.1 The relationship is many-to-many, not a tree

**One approved hospital serves several follow-up clinics.** Counted from S2015:

| Approved hospital | Suburbs | Distinct clinic strings under it | The clinics                                                                                                                                                                                                                                                                           |
| ----------------- | ------: | -------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Midland           |     104 |                               16 | Midland (68), Northam (9), Wheat Belt (8), Merredin (3), Central Wheatbelt (2), Midalnd (2), Western HS (2), Wheat belt (2), Central Wheatbelt H.S. (1), East Wheatbelt (1), East Wheatbelt HS (1), East.Wheatbelt HS (1), Narrogin (1), Swan (1), Western H.S. (1), Wheatbelt HS (1) |
| Rockingham        |      70 |                                7 | Peel (27), Rockingham (22), Kwinana (16), Peel/Rockingham (2), Kwinana/Peel (1), Rockingham/Kwinana (1), Rockingham/Peel (1)                                                                                                                                                          |
| Graylands         |      68 |                               11 | Osborne (19), Subiaco (17), Mirrabooka (15), Gascoyne (6), Geraldton HS (4), Osborne Park (2), Gascoyne H.S. (1), Gascoyne HS (1), Midwest H.S. (1), Upper Great Southern (1), Upper Great Southern. (1)                                                                              |
| Joondalup         |      49 |                                2 | Joondalup (36), Clarkson (13)                                                                                                                                                                                                                                                         |
| Bunbury           |      48 |                                1 | Bunbury (48)                                                                                                                                                                                                                                                                          |
| Alma Street       |      47 |                                5 | Alma Street (Cockburn) (15), Alma Street (Melville) (13), Alma Street (Central) (12), Alma Street (Fremantle) (6), Alma Street (1)                                                                                                                                                    |
| Armadale          |      39 |                                9 | Mead Centre (Kelmscott) (17), Eudoria Street (Thornlie) (6), Armadale (4), Eudoria Street (Gosnells) (4), Mead Centre (Armadale) (4), Armadale (Mead Centre) (1), Armadale (Mead) (1), Mead centre (Armadale) (1), Meade Centre (Armadale) (1)                                        |
| Mills Street      |      31 |                                2 | Bentley (28), Mills Street (3)                                                                                                                                                                                                                                                        |
| SCGH              |      21 |                                4 | Inner City (16), ICC (3), Inner City (central) (1), Inner City Clinic (1)                                                                                                                                                                                                             |
| Kalgoorlie        |       8 |                                4 | Nth Goldfield HS (5), Murchison HS (1), Nth Goldfield H.S. (1), Southern Coastal HS (1)                                                                                                                                                                                               |
| Bentley           |       4 |                                1 | Bentley (4)                                                                                                                                                                                                                                                                           |
| Albany            |       3 |                                2 | Lower Great Southern (2), Albany (1)                                                                                                                                                                                                                                                  |
| Kwinana           |       2 |                                2 | Peel /Rockingham (1), Rockingham (1)                                                                                                                                                                                                                                                  |
| Swan Valley       |       2 |                                1 | Wheat Belt (2)                                                                                                                                                                                                                                                                        |
| _(blank)_         |      41 | 18 regional health-service names | see section 1                                                                                                                                                                                                                                                                         |

**And the reverse also happens — one clinic sits under more than one hospital.** Eight cases:

| Clinic               | Hospitals it appears under     |
| -------------------- | ------------------------------ |
| Bentley              | Mills Street (28), Bentley (4) |
| Rockingham           | Rockingham (22), Kwinana (1)   |
| Wheat Belt           | Midland (8), Swan Valley (2)   |
| Gascoyne             | Graylands (6), _(blank)_ (2)   |
| Upper Great Southern | _(blank)_ (3), Graylands (1)   |
| Narrogin             | _(blank)_ (2), Midland (1)     |
| East Wheatbelt       | _(blank)_ (1), Midland (1)     |
| Midwest H.S.         | _(blank)_ (1), Graylands (1)   |

Most of these are the source being inconsistent rather than a real dual arrangement. **A seed
schema must therefore not assume `clinic → hospital` is a function.** Route on the suburb row,
not on a derived hospital-per-clinic lookup.

### 6.2 Metro and rural are two different models in one table

In S2015 the metropolitan rows and the country rows mean different things:

- **Metro rows** name a specific admitting hospital and a specific named community clinic
  (Alma Street (Cockburn), Mead Centre (Kelmscott), Eudoria Street (Thornlie), Osborne, Subiaco).
  The clinic is a building with an address — page 12 gives eight of them.
- **Country rows** name a **region**, not a clinic: `Great Southern`, `Wheat Belt`,
  `Nth Goldfield HS`, `Kimberley HS`, `North West`, `Pilbara`, `Gascoyne`. The `HS` / `H.S.`
  suffix stands for Health Service. 41 of these rows have no approved hospital at all, and the
  ones that do usually name **Graylands** or **Midland** — metropolitan sites acting as the
  admitting destination for a country referral, not a local hospital.

So "follow-up clinic" is a community team in the metro rows and a regional health service in the
country rows. **Treating them as one entity type will produce nonsense rural routing.**

### 6.3 The rural model, as the WACHS image actually states it

`rural-catchment.png` is a WA Country Health Service poster titled **"WACHS Link Mental Health
Inter-Hospital Patient Transfer Model"**, with the banner: _"Mental Health Patients - Except Time
Critical Patients and No Regional Bed available > Follow WACHS Link Alignments and Continue
Agreed Patient Flow Process <"_.

It does **not** map suburbs to clinics. It maps **country hospitals to one of three metropolitan
receiving sites**. That is a different question from the one the other four documents answer.

**South Link → FSH, 6152 2222** (42 facilities)

| Group                   | Facilities as written                                                                                                                                                 |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Great Southern (10)     | Albany RRC, Bremer Bay NP, Denmark H, Gnowangerup HS, Jerramungup NP, Katanning H, Kojonup H, Plantagenet H, Ravensthorpe H, Tambellup NP                             |
| South West (13)         | Augusta H, Boyup Brook H, Bridgetown H, Bunbury RRC, Busselton H, Collie H, Donnybrook H, Harvey H, Margaret River H, Nannup H, Northcliffe NP, Pemberton H, Warren H |
| Goldfields (9)          | Coolgardie HC, Esperance H, Kalgoorlie RRC, Kambalda HC, Laverton H, Leonora H, Menzies HC, Norseman H, Varley NP                                                     |
| Southern Wheatbelt (10) | Boddington H, Kondinin H, Dumbleyung MHS, Kukerin H, Lake Grace H, Narrogin H, Pingelly H, Wagin H, Wickepin HC, Williams HC                                          |

**East Link → RPH, 9224 2244** (34 facilities)

| Group                 | Facilities as written                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Kimberley (6)         | Broome RRC, Derby H, Fitzroy Crossing H, Halls Creek H, Kununurra H, Wyndham H                                                         |
| Pilbara (10)          | Hedland RRC, Marble Bar NP, Newman H, Nickol Bay H, Nullagine NP, Onslow H, Paraburdoo H, Roebourne H, Tom Price H, Wickham HC         |
| Western Wheatbelt (9) | Beverley H, Cunderdin HC, Dalwallinu H, Goomalling H, Northam H, Moora H, Wongan Hills H, Wyalkatchem H, York H                        |
| Eastern Wheatbelt (9) | Bruce Rock MHS, Corrigin HS, Kellerberrin MHS, Kununoppin H, Merredin HS, Narembeen MHS, Quairading H, Southern Cross H, Mukinbudin HC |

**North Link → SCGH, 6457 3333** (16 facilities)

| Group                | Facilities as written                                                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Midwest (15)         | Carnarvon H, Coral Bay NP, Cue HC, Dongara H, Exmouth H, Geraldton RRC, Kalbarri HC, Meekatharra H, Morawa H, Mount Magnet HC, Mullewa H, North Midlands H, Northampton H, Sandstone HC, Yalgoo NP |
| Costal Wheatbelt (1) | Jurien Bay HC — plus a note: _"St Johns Ambulance Direct Residential Emergency Admissions from Gingin, Lancelin, Chittering, Bindoon"_                                                             |

Total across all three links: **92 facilities.** The heading reads **"Costal Wheatbelt"** in the
image; that is a typo for "Coastal" but it is transcribed as shown.

Legend, as printed: **H** – Hospital | **HC** – Health Centre | **RRC** – Regional Resource
Centre | **NP** – Nursing Post | **MHS** – Memorial Health Service.

**Two things this changes.** First, the WACHS regions do not line up with S2015's clinic names —
S2015 has `Great Southern`, `Central Great Southern`, `Lower Great Southern` and
`Upper Great Southern` as four separate clinic values, where WACHS has one `Great Southern` group
and a separate `Southern Wheatbelt`. Second, the destinations are **FSH, RPH and SCGH** — and
**FSH appears nowhere in S2015's approved-hospital column**, which is the strongest single sign
that S2015's hospital column is stale.

### 6.4 Clinics do group under parent services, but the grouping is only implicit

Nothing in these documents states a hierarchy. It can be read off the data, with these caveats:

- **South Metropolitan Health Service** — S2023 states three teams: FREMANTLE, ROCKINGHAM
  KWINANA, PEEL. In S2015 these correspond to five `Alma Street (…)` clinics plus `Rockingham`,
  `Kwinana` and `Peel`. So one 2023 team spans several 2015 clinics — the Fremantle team covers
  four Alma Street sub-teams.
- **Royal Perth Bentley Group, Service 3** — SRPBG states three teams: Midland, Bentley,
  Inner City. Note that this puts **Midland under Royal Perth Bentley Group**, which is a
  parent-service fact none of the other documents give.
- **North Metropolitan** — not stated anywhere in these sources. Joondalup, Clarkson, Osborne,
  Mirrabooka and Subiaco/Lower West behave as a group in the data, but no document says so.
- **Armadale** — S2015 splits it across three named sites (Mead Centre Armadale, Mead Centre
  Kelmscott, Eudoria Street Gosnells/Thornlie) under one approved hospital; SMETRO collapses all
  of it into one `ARMADALE` team with one phone number.

The general shape: **the newer documents use coarser team names than the 2015 one.** S2015 names
the building; SMETRO and S2023 name the team. Any schema needs to hold both levels, or the
Kelmscott/Gosnells/Thornlie distinction is lost.

### 6.5 Practical notes for seeding

1. **Key on postcode + suburb, not suburb alone.** `Woodbridge` exists at both 6168 and 6056 with
   different routing.
2. **Postcodes are not unique to a suburb and a suburb is not unique to a postcode.** 537 rows
   cover 261 distinct postcodes.
3. **Normalise apostrophes before matching.** `O’Connor` uses a curly apostrophe in S2015 and
   S2023 and a straight one in SMETRO.
4. **Keep the raw clinic string.** Any normalisation (`Midalnd` → `Midland`, `Osborne Park` →
   `Osborne`) should be a separate mapping column, so the source value stays auditable.
5. **Do not derive hospital from clinic.** See 6.1.
6. **Flag the 5 disputed south-metro suburbs and the 41 blank-hospital rows** rather than letting
   them route silently.

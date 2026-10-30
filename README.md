Tehran Metro Route Finder

A modern and interactive Tehran Metro Route Finder built with FastAPI as backend 
and Use AI to make a clean HTML/CSS/JavaScript frontend interface. 

Users can easily find the best route between Tehran Metro stations, view line changes, and explore all 7 metro lines with their official colors and bilingual names.

🔹 Tech Stack: FastAPI · Python · HTML5 · CSS3 · Vanilla JS
🔹 Features:

RESTful API for metro data (stations, lines, routes)

Smart route calculation with transfer detection

Responsive, RTL-friendly Persian UI

Styled metro line components for all 7 lines

🧭 Designed for clean visualization and easy integration into smart transit systems or public transport

data by  mostafa-kheibary


## Estimated fastest route

A new endpoint compares routes using estimated journey time instead of only the
number of stops:

`GET /api/route/fastest`

Example:

```http
GET /api/route/fastest?from_station=تجریش&to_station=میدان%20صنعت&departure_time=08:30&day_type=weekday
```

Parameters:
- `from_station`: Persian origin station name (required)
- `to_station`: Persian destination station name (required)
- `departure_time`: local departure time in `HH:MM` format (optional; defaults to 12:00)
- `day_type`: `weekday` or `weekend` (default: `weekday`)

The response includes the estimated route, lines used, transfers, segment times,
waiting time, transfer time, total duration, and estimated arrival time.

### Estimation limitations

This project does not currently use an official real-time train feed or a verified
station-to-station timetable. Segment durations are estimated from station
coordinates, an adjustment factor, and an assumed average train speed. Waiting
time is modeled as half the configured headway. Transfer time and service hours
are configurable in `data/schedule_data.json`.

These values are assumptions for route comparison and must not be interpreted as
live operational information. Update `schedule_data.json` when verified local
data becomes available.

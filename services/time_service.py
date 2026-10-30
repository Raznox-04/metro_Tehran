"""Estimated travel-time routing for Tehran Metro.

All travel-time values are estimates. The source dataset contains station
coordinates and connectivity, but no official train timetable or segment times.
"""
import json
import math
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

import networkx as nx

from services.graph_service import metro_service


BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCHEDULE_PATH = os.path.join(BASE_DIR, "data", "schedule_data.json")


class MetroTimeService:
    def __init__(self):
        with open(SCHEDULE_PATH, "r", encoding="utf-8") as file:
            self.schedule = json.load(file)

    @staticmethod
    def _to_minutes(value: str) -> int:
        parsed = datetime.strptime(value, "%H:%M")
        return parsed.hour * 60 + parsed.minute

    def _validate_departure(self, departure_time: Optional[str]) -> Tuple[str, bool]:
        # Noon is used only as a neutral off-peak assumption when no time is supplied.
        value = departure_time or "12:00"
        try:
            minutes = self._to_minutes(value)
        except ValueError:
            raise ValueError("فرمت ساعت باید به شکل HH:MM باشد؛ مثلاً 08:30")

        opening = self._to_minutes(self.schedule["service_hours"]["opens"])
        closing = self._to_minutes(self.schedule["service_hours"]["closes"])
        if not opening <= minutes < closing:
            raise ValueError(
                "ساعت حرکت خارج از بازه تخمینی فعالیت مترو است "
                f"({self.schedule['service_hours']['opens']} تا "
                f"{self.schedule['service_hours']['closes']})"
            )
        return value, departure_time is None

    def _is_peak(self, departure_time: str) -> bool:
        minute = self._to_minutes(departure_time)
        for period in self.schedule["peak_periods"]:
            start = self._to_minutes(period["start"])
            end = self._to_minutes(period["end"])
            if start <= minute < end:
                return True
        return False

    def _headway(self, line: int, day_type: str, departure_time: str) -> float:
        line_key = str(line)
        line_data = self.schedule["headways_minutes"].get(line_key)
        if not line_data:
            line_data = self.schedule["default_headway_minutes"]
        day_data = line_data.get(day_type, line_data["weekday"])
        return float(day_data["peak"] if self._is_peak(departure_time) else day_data["off_peak"])

    @staticmethod
    def _distance_km(first: Dict, second: Dict) -> Optional[float]:
        try:
            lat1 = math.radians(float(first["latitude"]))
            lon1 = math.radians(float(first["longitude"]))
            lat2 = math.radians(float(second["latitude"]))
            lon2 = math.radians(float(second["longitude"]))
        except (KeyError, TypeError, ValueError):
            return None

        delta_lat = lat2 - lat1
        delta_lon = lon2 - lon1
        haversine = (
            math.sin(delta_lat / 2) ** 2
            + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
        )
        return 6371.0 * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))

    def _segment_minutes(self, first_name: str, second_name: str) -> float:
        data = metro_service._station_data
        distance = self._distance_km(data[first_name], data[second_name])
        if distance is None:
            return float(self.schedule["fallback_segment_minutes"])

        # Straight-line distance is increased to approximate the rail alignment.
        adjusted_distance = distance * float(self.schedule["distance_detour_factor"])
        speed = float(self.schedule["average_speed_kmh"])
        dwell = float(self.schedule["dwell_allowance_minutes"])
        estimate = (adjusted_distance / speed) * 60 + dwell
        return round(max(float(self.schedule["minimum_segment_minutes"]), estimate), 2)

    def _build_weighted_graph(self, departure_time: str, day_type: str):
        graph = nx.DiGraph()
        start_node = ("__START__", 0)
        graph.add_node(start_node)

        station_data = metro_service._station_data

        # A state is (station_id, line_number). This prevents a transfer station
        # from being treated as if every adjacent edge belonged to every line.
        for station, info in station_data.items():
            lines = sorted(set(info.get("lines", [])))
            for line in lines:
                graph.add_node((station, line))

        # Ride edges: add both directions, even if source JSON has a one-way relation.
        seen_connections = set()
        for station, info in station_data.items():
            for neighbor in info.get("relations", []):
                if neighbor not in station_data:
                    continue
                common_lines = set(info.get("lines", [])).intersection(
                    station_data[neighbor].get("lines", [])
                )
                for line in common_lines:
                    connection_key = (min(station, neighbor), max(station, neighbor), line)
                    if connection_key in seen_connections:
                        continue
                    seen_connections.add(connection_key)
                    minutes = self._segment_minutes(station, neighbor)
                    for source, target in ((station, neighbor), (neighbor, station)):
                        graph.add_edge(
                            (source, line),
                            (target, line),
                            weight=minutes,
                            kind="ride",
                            minutes=minutes,
                            line=line,
                        )

        # Transfer edges are added only inside the same interchange station.
        transfer_minutes = float(self.schedule["transfer_minutes"])
        for station, info in station_data.items():
            lines = sorted(set(info.get("lines", [])))
            for from_line in lines:
                for to_line in lines:
                    if from_line == to_line:
                        continue
                    wait = self._headway(to_line, day_type, departure_time) / 2
                    graph.add_edge(
                        (station, from_line),
                        (station, to_line),
                        weight=transfer_minutes + wait,
                        kind="transfer",
                        minutes=transfer_minutes,
                        wait_minutes=wait,
                        from_line=from_line,
                        to_line=to_line,
                    )

        return graph, start_node

    def fastest_route(
        self,
        start_persian: str,
        end_persian: str,
        departure_time: Optional[str] = None,
        day_type: str = "weekday",
    ) -> Dict:
        if day_type not in ("weekday", "weekend"):
            raise ValueError("نوع روز باید weekday یا weekend باشد")

        start_eng = metro_service.translate_to_english(start_persian)
        end_eng = metro_service.translate_to_english(end_persian)
        if not start_eng:
            raise ValueError(f"ایستگاه مبدأ '{start_persian}' یافت نشد")
        if not end_eng:
            raise ValueError(f"ایستگاه مقصد '{end_persian}' یافت نشد")

        departure_time, used_default_time = self._validate_departure(departure_time)
        if start_eng == end_eng:
            return {
                "route": [start_persian],
                "stops": 0,
                "transfer_count": 0,
                "transfer_stations": [],
                "lines_used": [],
                "segments": [],
                "transfers": [],
                "estimated_time": {
                    "total_minutes": 0,
                    "travel_minutes": 0,
                    "waiting_minutes": 0,
                    "transfer_minutes": 0,
                },
                "departure_time": departure_time,
                "day_type": day_type,
                "is_estimate": True,
                "assumptions": self.schedule["assumptions"],
            }

        graph, start_node = self._build_weighted_graph(departure_time, day_type)
        start_lines = sorted(set(station_data_line for station_data_line in
                                 metro_service.get_station_lines(start_persian)))
        end_lines = set(metro_service.get_station_lines(end_persian))

        for line in start_lines:
            initial_wait = self._headway(line, day_type, departure_time) / 2
            graph.add_edge(
                start_node,
                (start_eng, line),
                weight=initial_wait,
                kind="initial_wait",
                minutes=0,
                wait_minutes=initial_wait,
                line=line,
            )

        try:
            distances, paths = nx.single_source_dijkstra(graph, start_node, weight="weight")
        except nx.NetworkXNoPath:
            raise ValueError("مسیری بین این دو ایستگاه پیدا نشد")

        candidates = [
            (distances[(end_eng, line)], paths[(end_eng, line)])
            for line in end_lines
            if (end_eng, line) in distances
        ]
        if not candidates:
            raise ValueError("مسیری بین این دو ایستگاه پیدا نشد")

        total_weight, state_path = min(candidates, key=lambda item: item[0])
        ride_minutes = 0.0
        waiting_minutes = 0.0
        transfer_minutes_total = 0.0
        segments = []
        transfers = []
        route_english = [start_eng]
        lines_used = []

        for previous, current in zip(state_path, state_path[1:]):
            edge = graph[previous][current]
            kind = edge["kind"]
            if kind == "initial_wait":
                waiting_minutes += edge["wait_minutes"]
            elif kind == "ride":
                ride_minutes += edge["minutes"]
                if not lines_used or lines_used[-1] != edge["line"]:
                    lines_used.append(edge["line"])
                route_english.append(current[0])
                segments.append({
                    "from_station": metro_service.translate_to_persian(previous[0]),
                    "to_station": metro_service.translate_to_persian(current[0]),
                    "line": edge["line"],
                    "estimated_minutes": round(edge["minutes"], 2),
                })
            elif kind == "transfer":
                waiting_minutes += edge["wait_minutes"]
                transfer_minutes_total += edge["minutes"]
                transfers.append({
                    "station": metro_service.translate_to_persian(current[0]),
                    "from_line": edge["from_line"],
                    "to_line": edge["to_line"],
                    "transfer_minutes": round(edge["minutes"], 2),
                    "waiting_minutes": round(edge["wait_minutes"], 2),
                })

        route_fa = [metro_service.translate_to_persian(name) for name in route_english]
        total_minutes = ride_minutes + waiting_minutes + transfer_minutes_total
        arrival = datetime.strptime(departure_time, "%H:%M") + timedelta(minutes=total_minutes)
        closing = self._to_minutes(self.schedule["service_hours"]["closes"])
        arrival_minutes = arrival.hour * 60 + arrival.minute
        warnings = []
        if arrival_minutes >= closing:
            warnings.append("زمان رسیدن تخمینی از ساعت پایان سرویس عبور می‌کند.")

        return {
            "route": route_fa,
            "stops": max(0, len(route_fa) - 1),
            "transfer_count": len(transfers),
            "transfer_stations": [item["station"] for item in transfers],
            "lines_used": lines_used,
            "segments": segments,
            "transfers": transfers,
            "estimated_time": {
                "total_minutes": round(total_minutes, 1),
                "travel_minutes": round(ride_minutes, 1),
                "waiting_minutes": round(waiting_minutes, 1),
                "transfer_minutes": round(transfer_minutes_total, 1),
            },
            "departure_time": departure_time,
            "arrival_time": arrival.strftime("%H:%M"),
            "day_type": day_type,
            "used_default_departure_time": used_default_time,
            "is_estimate": True,
            "warnings": warnings,
            "assumptions": self.schedule["assumptions"],
        }


metro_time_service = MetroTimeService()

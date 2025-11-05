import json
import networkx as nx
from typing import Dict, List, Optional
import os
class MetroGraphService:
    def __init__(self):
        self._graph = None
        self._station_mapping = {}  # نگاشت نام فارسی به انگلیسی
        self._reverse_mapping = {}  # نگاشت انگلیسی به فارسی
        self._station_data = None
        self._load_station_mapping()

    def _load_data(self) -> Dict:
        """بارگیری داده‌های مترو از فایل JSON"""
        file_path = "data/metro_data.json"
        if not os.path.exists(file_path):
            # ایجاد داده‌های نمونه در صورت عدم وجود فایل
            return self.create_sample_data()

        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def create_sample_data(self) -> Dict:
        """ایجاد داده‌های نمونه برای تست"""
        sample_data = {
            "Tajrish": {
                "name": "Tajrish",
                "translations": {"fa": "تجریش"},
                "lines": [1],
                "colors": ["#E31837"],
                "relations": ["Gheytariyeh"]
            },
            "Gheytariyeh": {
                "name": "Gheytariyeh",
                "translations": {"fa": "قیطریه"},
                "lines": [1],
                "colors": ["#E31837"],
                "relations": ["Tajrish", "Shahid Sadr"]
            },
            "Shahid Sadr": {
                "name": "Shahid Sadr",
                "translations": {"fa": "شهید صدر"},
                "lines": [1],
                "colors": ["#E31837"],
                "relations": ["Gheytariyeh", "Gholhak"]
            },
            "Gholhak": {
                "name": "Gholhak",
                "translations": {"fa": "قلهک"},
                "lines": [1],
                "colors": ["#E31837"],
                "relations": ["Shahid Sadr", "Mirdamad"]
            },
            "Mirdamad": {
                "name": "Mirdamad",
                "translations": {"fa": "میرداماد"},
                "lines": [1],
                "colors": ["#E31837"],
                "relations": ["Gholhak", "Shahid Hemat"]
            },
            "Shahid Hemat": {
                "name": "Shahid Hemat",
                "translations": {"fa": "شهید همت"},
                "lines": [1, 2],
                "colors": ["#E31837", "#009645"],
                "relations": ["Mirdamad", "Tohid"]
            },
            "Tohid": {
                "name": "Tohid",
                "translations": {"fa": "توحید"},
                "lines": [2],
                "colors": ["#009645"],
                "relations": ["Shahid Hemat", "Meydan Azadi"]
            },
            "Meydan Azadi": {
                "name": "Meydan Azadi",
                "translations": {"fa": "میدان آزادی"},
                "lines": [2, 4],
                "colors": ["#009645", "#00A7E9"],
                "relations": ["Tohid", "Meydan Enghelab"]
            },
            "Meydan Enghelab": {
                "name": "Meydan Enghelab",
                "translations": {"fa": "میدان انقلاب"},
                "lines": [4],
                "colors": ["#00A7E9"],
                "relations": ["Meydan Azadi", "Teatr Shahr"]
            },
            "Teatr Shahr": {
                "name": "Teatr Shahr",
                "translations": {"fa": "تئاتر شهر"},
                "lines": [4],
                "colors": ["#00A7E9"],
                "relations": ["Meydan Enghelab", "Ferdowsi"]
            },
            "Ferdowsi": {
                "name": "Ferdowsi",
                "translations": {"fa": "فردوسی"},
                "lines": [4],
                "colors": ["#00A7E9"],
                "relations": ["Teatr Shahr", "Darvazeh Dolat"]
            },
            "Darvazeh Dolat": {
                "name": "Darvazeh Dolat",
                "translations": {"fa": "دروازه دولت"},
                "lines": [4],
                "colors": ["#00A7E9"],
                "relations": ["Ferdowsi", "Darvazeh Shemiran"]
            },
            "Darvazeh Shemiran": {
                "name": "Darvazeh Shemiran",
                "translations": {"fa": "دروازه شمیران"},
                "lines": [4],
                "colors": ["#00A7E9"],
                "relations": ["Darvazeh Dolat", "Meydan Shohada"]
            },
            "Meydan Shohada": {
                "name": "Meydan Shohada",
                "translations": {"fa": "میدان شهدا"},
                "lines": [4],
                "colors": ["#00A7E9"],
              # توابع compatibility برای backward compatibility
  "relations": ["Darvazeh Shemiran"]
            }
        }

        # ذخیره داده‌های نمونه
        os.makedirs("data", exist_ok=True)
        with open("data/metro_data.json", "w", encoding="utf-8") as f:
            json.dump(sample_data, f, ensure_ascii=False, indent=2)

        return sample_data

    def _load_station_mapping(self):
        """ایجاد نگاشت بین نام فارسی و انگلیسی ایستگاه‌ها"""
        self._station_data = self._load_data()
        for eng_name, info in self._station_data.items():
            fa_name = info.get("translations", {}).get("fa", eng_name)
            self._station_mapping[fa_name] = eng_name
            self._reverse_mapping[eng_name] = fa_name

    @property
    def graph(self):
        if self._graph is None:
            self._graph = self._build_graph()
        return self._graph

    def _build_graph(self):
        """ساخت گراف مترو"""
        data = self._station_data
        G = nx.Graph()

        for station, info in data.items():
            # اضافه کردن node با تمام ویژگی‌ها
            G.add_node(station, **info)

            # اضافه کردن edges
            for neighbor in info.get("relations", []):
                if neighbor in data:  # مطمئن شویم همسایه وجود دارد
                    G.add_edge(station, neighbor, weight=1)

        return G

    def translate_to_english(self, persian_name: str) -> Optional[str]:
        return self._station_mapping.get(persian_name.strip())

    def translate_to_persian(self, english_name: str) -> Optional[str]:
        return self._reverse_mapping.get(english_name)

    def find_similar_stations(self, query: str) -> List[str]:
        query = query.strip().lower()
        matches = []
        for persian_name in self._station_mapping.keys():
            if query in persian_name.lower():
                matches.append(persian_name)

        return sorted(matches)[:10]

    def get_station_info(self, station_name: str) -> Optional[Dict]:
        """دریافت اطلاعات ایستگاه"""
        eng_name = self.translate_to_english(station_name)
        if eng_name and eng_name in self.graph:
            return self.graph.nodes[eng_name]
        return None

    def get_all_stations_data(self) -> Dict:
        """دریافت تمام اطلاعات ایستگاه‌ها"""
        return self._station_data

    def shortest_path(self, start_persian: str, end_persian: str) -> Optional[List[str]]:
        """پیدا کردن کوتاه‌ترین مسیر با نام فارسی"""
        # تبدیل نام فارسی به انگلیسی
        start_eng = self.translate_to_english(start_persian)
        end_eng = self.translate_to_english(end_persian)

        if not start_eng:
            raise ValueError(f"ایستگاه مبدأ '{start_persian}' یافت نشد")
        if not end_eng:
            raise ValueError(f"ایستگاه مقصد '{end_persian}' یافت نشد")

        try:
            path_eng = nx.shortest_path(self.graph, start_eng, end_eng)
            # تبدیل مسیر به فارسی
            path_fa = [self.translate_to_persian(station) for station in path_eng]
            return path_fa
        except nx.NetworkXNoPath:
            return None
        except nx.NodeNotFound as e:
            raise ValueError(f"ایستگاه یافت نشد: {e}")

    def get_station_lines(self, station_name: str) -> List[int]:
        """دریافت خطوط یک ایستگاه"""
        info = self.get_station_info(station_name)
        return info.get("lines", [1]) if info else [1]

    def detect_line_changes(self, path: List[str]) -> List[Dict]:
        """تشخیص تغییرات خط در مسیر"""
        if len(path) < 2:
            return []

        line_changes = []
        current_lines = self.get_station_lines(path[0])

        for i in range(1, len(path)):
            next_lines = self.get_station_lines(path[i])

            # اگر خطوط تغییر کرده باشند
            if set(current_lines) != set(next_lines):
                line_changes.append({
                    "station": path[i],
                    "from_lines": current_lines.copy(),
                    "to_lines": next_lines.copy(),
                    "position": i
                })
                current_lines = next_lines

        return line_changes

metro_service = MetroGraphService()

def shortest_path(start: str, end: str):
    return metro_service.shortest_path(start, end)


def build_graph():
    return metro_service.graph
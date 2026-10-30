import unittest

from services.time_service import metro_time_service


class MetroTimeServiceTests(unittest.TestCase):
    def test_same_station_returns_zero_duration(self):
        result = metro_time_service.fastest_route("تجریش", "تجریش")
        self.assertEqual(result["route"], ["تجریش"])
        self.assertEqual(result["estimated_time"]["total_minutes"], 0)

    def test_adjacent_station_route_has_time_breakdown(self):
        result = metro_time_service.fastest_route(
            "تجریش", "قیطریه", departure_time="12:00"
        )
        self.assertEqual(result["route"][0], "تجریش")
        self.assertEqual(result["route"][-1], "قیطریه")
        self.assertGreater(result["estimated_time"]["total_minutes"], 0)
        self.assertIn("travel_minutes", result["estimated_time"])
        self.assertIn("waiting_minutes", result["estimated_time"])
        self.assertIn("transfer_minutes", result["estimated_time"])

    def test_invalid_departure_time_is_rejected(self):
        with self.assertRaises(ValueError):
            metro_time_service.fastest_route(
                "تجریش", "قیطریه", departure_time="25:70"
            )

    def test_unknown_station_is_rejected(self):
        with self.assertRaises(ValueError):
            metro_time_service.fastest_route(
                "ایستگاه نامعتبر", "قیطریه"
            )

    def test_invalid_day_type_is_rejected(self):
        with self.assertRaises(ValueError):
            metro_time_service.fastest_route(
                "تجریش", "قیطریه", day_type="holiday"
            )


if __name__ == "__main__":
    unittest.main()

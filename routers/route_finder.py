from fastapi import APIRouter, Query, HTTPException
from services.graph_service import metro_service
from typing import List
router = APIRouter()

@router.get("/route")
def get_route(
        from_station: str = Query(..., description="نام فارسی ایستگاه مبدأ"),
        to_station: str = Query(..., description="نام فارسی ایستگاه مقصد")
):
    try:
        path = metro_service.shortest_path(from_station, to_station)

        if not path:
            raise HTTPException(
                status_code=404,
                detail=f"مسیری بین ایستگاه {from_station} و {to_station} یافت نشد"
            )

        # محاسبه اطلاعات اضافی
        total_stations = len(path)
        transfer_stations = _find_transfer_stations(path)

        return {
            "route": path,
            "stops": total_stations - 1,
            "total_stations": total_stations,
            "transfer_count": len(transfer_stations),
            "transfer_stations": transfer_stations,
            "from_station": from_station,
            "to_station": to_station
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/stations/search")
def search_stations(query: str = Query(..., description="جستجوی ایستگاه")):
    matches = metro_service.find_similar_stations(query)
    return {"stations": matches}
@router.get("/stations/{station_name}/info")
def get_station_info(station_name: str):
    """دریافت اطلاعات یک ایستگاه"""
    info = metro_service.get_station_info(station_name)
    if not info:
        raise HTTPException(status_code=404, detail="ایستگاه یافت نشد")
    return info

@router.get("/stations/data")
def get_stations_data():
    """دریافت تمام اطلاعات ایستگاه‌ها"""
    return metro_service.get_all_stations_data()

@router.get("/route/details")
def get_route_with_details(
        from_station: str = Query(..., description="نام فارسی ایستگاه مبدأ"),
        to_station: str = Query(..., description="نام فارسی ایستگاه مقصد")
):
    try:
        path = metro_service.shortest_path(from_station, to_station)

        if not path:
            raise HTTPException(
                status_code=404,
                detail=f"مسیری بین ایستگاه {from_station} و {to_station} یافت نشد"
            )
        route_details = []
        for station_name in path:
            station_info = metro_service.get_station_info(station_name)
            if station_info:
                route_details.append({
                    "name": station_name,
                    "lines": station_info.get("lines", [1]),
                    "colors": station_info.get("colors", ["#E0001F"]),
                    "is_transfer": len(station_info.get("lines", [])) > 1
                })

        total_stations = len(path)
        transfer_stations = _find_transfer_stations(path)

        return {
            "route": path,
            "route_details": route_details,
            "stops": total_stations - 1,
            "total_stations": total_stations,
            "transfer_count": len(transfer_stations),
            "transfer_stations": transfer_stations
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
def _find_transfer_stations(path: List[str]) -> List[str]:
    transfer_stations = []
    for station in path:
        info = metro_service.get_station_info(station)
        if info and len(info.get("lines", [])) > 1:
            transfer_stations.append(station)
    return transfer_stations
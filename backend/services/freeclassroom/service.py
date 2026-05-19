"""空闲教室查询服务

数据通过爬取四川大学教室状态查询系统 (http://cir.scu.edu.cn/cir/) 获取。
该系统与教务系统 (zhjw.scu.edu.cn) 共用同一数据库，教学楼名、节次名称与教务系统完全一致。

爬取流程：
1. GET /jxlConfig → 获取教学楼列表（含校区、名称、位置标识）
2. GET /XLRoomData?jxlname={location} → 获取指定教学楼的教室使用状态
"""

import logging
from datetime import datetime

import httpx

from services.freeclassroom.schemas import BuildingDetail, BuildingInfo, ClassroomInfo, FreeClassroomResponse, TimeSlot

logger = logging.getLogger(__name__)

CIR_BASE_URL = "http://cir.scu.edu.cn/cir"
COMMON_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
}

# 校区编码映射（与教务系统一致）
CAMPUS_MAP = {
    "01": "望江校区",
    "02": "华西校区",
    "03": "江安校区",
}

TIME_SLOT_NAMES = ["一大节", "二大节", "三大节", "四大节", "五大节"]


async def _get_json(url: str) -> dict | list:
    """发送 GET 请求并解析 JSON 响应"""
    async with httpx.AsyncClient(timeout=15.0, headers=COMMON_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def get_buildings() -> list[BuildingInfo]:
    """获取所有教学楼列表"""
    data = await _get_json(f"{CIR_BASE_URL}/jxlConfig")
    buildings: list[BuildingInfo] = []
    for item in data:
        campus_code = str(item.get("xqh", ""))
        campus_name = CAMPUS_MAP.get(campus_code, f"校区{campus_code}")
        buildings.append(BuildingInfo(
            name=item["name"],
            location=item["location"],
            campus=campus_code,
            campus_name=campus_name,
        ))
    return buildings


async def get_building_detail(location: str) -> BuildingDetail | None:
    """获取指定教学楼的教室使用详情"""
    buildings = await get_buildings()
    building_info = next((b for b in buildings if b.location == location), None)
    if not building_info:
        return None

    data = await _get_json(f"{CIR_BASE_URL}/XLRoomData?jxlname={location}")
    roomdata = data.get("roomdata", [])
    xldata = data.get("xldata", [])

    # 计算当前教学周
    current_week = _calculate_current_week(xldata)

    classrooms: list[ClassroomInfo] = []
    for room in roomdata:
        class_use = room.get("classUse", [])
        time_slots: list[TimeSlot] = []
        for idx, slot in enumerate(class_use):
            use_flag = slot.get("use", "0")
            is_free = use_flag == "0" or use_flag == 0
            time_slots.append(TimeSlot(
                name=TIME_SLOT_NAMES[idx] if idx < len(TIME_SLOT_NAMES) else f"第{idx + 1}大节",
                is_free=is_free,
                course_name=slot.get("kcm") if not is_free else None,
                teacher=slot.get("jsm") if not is_free else None,
            ))
        classrooms.append(ClassroomInfo(
            name=room.get("roomName", ""),
            seats=room.get("roomZws"),
            time_slots=time_slots,
        ))

    return BuildingDetail(
        name=building_info.name,
        location=building_info.location,
        campus=building_info.campus,
        campus_name=building_info.campus_name,
        classrooms=classrooms,
    )


async def get_free_classrooms() -> FreeClassroomResponse:
    """获取全部教学楼及当天空闲教室概览数据"""
    buildings = await get_buildings()
    return FreeClassroomResponse(
        buildings=buildings,
        time_slot_names=TIME_SLOT_NAMES,
    )


def _calculate_current_week(xldata: list[dict]) -> int | None:
    """根据学期周次数据计算当前教学周"""
    now = datetime.now().timestamp() * 1000
    for entry in xldata:
        try:
            ksr_str = entry.get("ksr", "").split(".")[0]
            jsr_str = entry.get("jsr", "").split(".")[0]
            ksr = datetime.strptime(ksr_str, "%Y-%m-%d %H:%M:%S").timestamp() * 1000
            jsr = datetime.strptime(jsr_str, "%Y-%m-%d %H:%M:%S").timestamp() * 1000
            if ksr <= now <= jsr:
                return int(entry["zc"])
        except (ValueError, KeyError):
            continue
    return None
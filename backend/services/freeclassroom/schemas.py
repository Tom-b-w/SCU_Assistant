"""空闲教室查询 — 数据模型

数据源：四川大学教室状态查询系统 (http://cir.scu.edu.cn/cir/)
该系统与教务系统 (zhjw.scu.edu.cn) 共用同一数据库，教学楼名、节次名称与教务系统完全一致。
"""

from pydantic import BaseModel


class TimeSlot(BaseModel):
    """单个节次（一大节）的使用状态"""
    name: str
    is_free: bool
    course_name: str | None = None
    teacher: str | None = None


class ClassroomInfo(BaseModel):
    """单间教室信息"""
    name: str
    seats: int | None = None
    time_slots: list[TimeSlot]


class BuildingInfo(BaseModel):
    """教学楼信息"""
    name: str
    location: str
    campus: str
    campus_name: str


class BuildingDetail(BaseModel):
    """教学楼详情（含教室数据）"""
    name: str
    location: str
    campus: str
    campus_name: str
    classrooms: list[ClassroomInfo]


class FreeClassroomResponse(BaseModel):
    """空闲教室查询响应"""
    buildings: list[BuildingInfo]
    current_week: int | None = None
    time_slot_names: list[str] = [
        "一大节", "二大节", "三大节", "四大节", "五大节"
    ]
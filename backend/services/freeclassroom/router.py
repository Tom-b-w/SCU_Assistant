from fastapi import APIRouter, HTTPException, Query

from services.freeclassroom.schemas import BuildingDetail, FreeClassroomResponse
from services.freeclassroom.service import get_building_detail, get_free_classrooms

router = APIRouter(prefix="/api/freeclassroom", tags=["freeclassroom"])


@router.get("/buildings", response_model=FreeClassroomResponse)
async def list_buildings():
    """获取所有教学楼列表"""
    return await get_free_classrooms()


@router.get("/building", response_model=BuildingDetail)
async def building_detail(location: str = Query(..., description="教学楼位置标识，如 zongB、yjA")):
    """获取指定教学楼的教室使用状态"""
    result = await get_building_detail(location)
    if not result:
        raise HTTPException(status_code=404, detail="未找到该教学楼")
    return result
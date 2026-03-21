"""RAG 知识库 API"""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from gateway.auth.dependencies import get_current_user
from services.rag import service, schemas

router = APIRouter(prefix="/api/rag", tags=["RAG"])


@router.post("/kb", response_model=schemas.KBResponse, status_code=201)
async def create_knowledge_base(
    body: schemas.KBCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    kb = await service.create_kb(db, user.id, body.name, body.description)
    return kb


@router.get("/kb", response_model=list[schemas.KBResponse])
async def list_knowledge_bases(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await service.list_kbs(db, user.id)


@router.delete("/kb/{kb_id}", status_code=204)
async def delete_knowledge_base(
    kb_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await service.delete_kb(db, user.id, kb_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/kb/{kb_id}/upload", response_model=schemas.DocumentResponse)
async def upload_document(
    kb_id: int,
    file: UploadFile = File(...),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(400, "请选择文件")
    allowed = (".pdf", ".pptx", ".ppt", ".txt", ".md")
    if not any(file.filename.lower().endswith(ext) for ext in allowed):
        raise HTTPException(400, f"仅支持 {', '.join(allowed)} 格式")
    data = await file.read()
    if len(data) > 50 * 1024 * 1024:  # 50MB
        raise HTTPException(400, "文件大小不能超过 50MB")
    try:
        doc = await service.upload_document(db, kb_id, user.id, file.filename, data)
        return doc
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/kb/{kb_id}/query", response_model=schemas.RAGAnswer)
async def query_knowledge_base(
    kb_id: int,
    body: schemas.RAGQuery,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await service.rag_query(db, kb_id, user.id, body.question, body.top_k)
    except ValueError as e:
        raise HTTPException(404, str(e))

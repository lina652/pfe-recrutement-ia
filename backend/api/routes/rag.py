"""
RAG Chatbot API routes for recruiters with conversation history.
"""
import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db
from core.dependencies import require_role
from models.user import User, UserRole
from models.job_offer import JobOffer
from models.application import Application
from models.interview import Interview
from models.rag_conversation import RAGConversation, RAGMessage
from services.rag_service import get_rag_service
from schemas.interview_schemas import (
    RAGChatRequest,
    RAGChatResponse,
    RAGJobInfo
)
from schemas.rag_schemas import (
    RAGConversationCreate,
    RAGConversationUpdate,
    RAGConversationDetail,
    RAGConversationListItem,
    RAGMessageRequest,
    RAGMessageResponse
)

router = APIRouter(prefix="/rag", tags=["rag"])
logger = logging.getLogger(__name__)


# ==================== CONVERSATIONS ====================

@router.post("/conversations", response_model=RAGConversationDetail)
def create_conversation(
    payload: RAGConversationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Create a new RAG conversation."""
    try:
        job = db.query(JobOffer).filter(
            JobOffer.job_id == payload.job_id,
            JobOffer.posted_by == current_user.user_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found or access denied")
        
        conversation = RAGConversation(
            conversation_id=str(uuid.uuid4()),
            recruiter_id=current_user.user_id,
            job_id=payload.job_id,
            title=payload.title
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        return RAGConversationDetail(
            conversation_id=conversation.conversation_id,
            recruiter_id=conversation.recruiter_id,
            job_id=conversation.job_id,
            title=conversation.title,
            is_favorite=conversation.is_favorite,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            messages=[]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=list[RAGConversationListItem])
def list_conversations(
    job_id: str = None,
    favorites_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """List recruiter's conversations with filtering."""
    try:
        query = db.query(RAGConversation).filter(
            RAGConversation.recruiter_id == current_user.user_id
        )
        
        if job_id:
            query = query.filter(RAGConversation.job_id == job_id)
        
        if favorites_only:
            query = query.filter(RAGConversation.is_favorite == True)
        
        conversations = query.order_by(RAGConversation.updated_at.desc()).all()
        
        result = []
        for conv in conversations:
            msg_count = db.query(RAGMessage).filter(
                RAGMessage.conversation_id == conv.conversation_id
            ).count()
            
            result.append(RAGConversationListItem(
                conversation_id=conv.conversation_id,
                job_id=conv.job_id,
                title=conv.title,
                is_favorite=conv.is_favorite,
                created_at=conv.created_at,
                updated_at=conv.updated_at,
                message_count=msg_count
            ))
        
        return result
    except Exception as e:
        logger.error(f"Error listing conversations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations/{conversation_id}", response_model=RAGConversationDetail)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Get conversation with full message history."""
    try:
        conversation = db.query(RAGConversation).filter(
            RAGConversation.conversation_id == conversation_id,
            RAGConversation.recruiter_id == current_user.user_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        messages = db.query(RAGMessage).filter(
            RAGMessage.conversation_id == conversation_id
        ).order_by(RAGMessage.timestamp.asc()).all()
        
        return RAGConversationDetail(
            conversation_id=conversation.conversation_id,
            recruiter_id=conversation.recruiter_id,
            job_id=conversation.job_id,
            title=conversation.title,
            is_favorite=conversation.is_favorite,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            messages=[
                RAGMessageResponse(
                    message_id=msg.message_id,
                    conversation_id=msg.conversation_id,
                    role=msg.role,
                    content=msg.content,
                    timestamp=msg.timestamp
                )
                for msg in messages
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/conversations/{conversation_id}", response_model=RAGConversationDetail)
def update_conversation(
    conversation_id: str,
    payload: RAGConversationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Update conversation title or favorite status."""
    try:
        conversation = db.query(RAGConversation).filter(
            RAGConversation.conversation_id == conversation_id,
            RAGConversation.recruiter_id == current_user.user_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        if payload.title is not None:
            conversation.title = payload.title
        if payload.is_favorite is not None:
            conversation.is_favorite = payload.is_favorite
        
        conversation.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(conversation)
        
        messages = db.query(RAGMessage).filter(
            RAGMessage.conversation_id == conversation_id
        ).order_by(RAGMessage.timestamp.asc()).all()
        
        return RAGConversationDetail(
            conversation_id=conversation.conversation_id,
            recruiter_id=conversation.recruiter_id,
            job_id=conversation.job_id,
            title=conversation.title,
            is_favorite=conversation.is_favorite,
            created_at=conversation.created_at,
            updated_at=conversation.updated_at,
            messages=[
                RAGMessageResponse(
                    message_id=msg.message_id,
                    conversation_id=msg.conversation_id,
                    role=msg.role,
                    content=msg.content,
                    timestamp=msg.timestamp
                )
                for msg in messages
            ]
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Delete a conversation and all its messages."""
    try:
        conversation = db.query(RAGConversation).filter(
            RAGConversation.conversation_id == conversation_id,
            RAGConversation.recruiter_id == current_user.user_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Delete all messages first
        db.query(RAGMessage).filter(
            RAGMessage.conversation_id == conversation_id
        ).delete()
        
        # Delete conversation
        db.delete(conversation)
        db.commit()
        
        return {"status": "deleted", "conversation_id": conversation_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== MESSAGES ====================

@router.post("/conversations/{conversation_id}/messages", response_model=RAGMessageResponse)
def send_message(
    conversation_id: str,
    payload: RAGMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """Send a message and get RAG response saved to conversation."""
    try:
        conversation = db.query(RAGConversation).filter(
            RAGConversation.conversation_id == conversation_id,
            RAGConversation.recruiter_id == current_user.user_id
        ).first()
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Verify job access
        job = db.query(JobOffer).filter(
            JobOffer.job_id == conversation.job_id,
            JobOffer.posted_by == current_user.user_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=403, detail="Access denied for this job")
        
        # Save user message
        user_msg = RAGMessage(
            message_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role="user",
            content=payload.question
        )
        db.add(user_msg)
        
        # Get RAG response
        rag_service = get_rag_service()
        answer = rag_service.chat(
            db=db,
            job_id=conversation.job_id,
            question=payload.question
        )
        
        # Save AI response
        ai_msg = RAGMessage(
            message_id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            role="assistant",
            content=answer
        )
        db.add(ai_msg)
        
        # Update conversation timestamp
        conversation.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(ai_msg)
        
        return RAGMessageResponse(
            message_id=ai_msg.message_id,
            conversation_id=ai_msg.conversation_id,
            role=ai_msg.role,
            content=ai_msg.content,
            timestamp=ai_msg.timestamp
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ==================== LEGACY ENDPOINTS ====================

@router.post("/chat", response_model=RAGChatResponse)
def chat_with_rag(
    request: RAGChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """
    Legacy endpoint: Chat with RAG system (without conversation history).
    """
    try:
        # Verify job exists and recruiter has access
        job = db.query(JobOffer).filter(
            JobOffer.job_id == request.job_id
        ).first()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        if job.posted_by != current_user.user_id:
            raise HTTPException(status_code=403, detail="Access denied for this job")
        
        # Get RAG service and answer question
        rag_service = get_rag_service()
        answer = rag_service.chat(
            db=db,
            job_id=request.job_id,
            question=request.question
        )
        
        return RAGChatResponse(
            question=request.question,
            answer=answer,
            job_id=request.job_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in RAG chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs", response_model=list[RAGJobInfo])
def get_recruiter_jobs_with_candidates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """
    Get list of jobs with application and interview counts (for RAG job selector).
    """
    try:
        # Get recruiter's jobs
        jobs = db.query(JobOffer).filter(
            JobOffer.posted_by == current_user.user_id
        ).all()
        
        result = []
        for job in jobs:
            # Count applications
            app_count = db.query(Application).filter(
                Application.job_id == job.job_id
            ).count()
            
            # Count completed interviews
            interview_count = db.query(Interview).filter(
                Interview.job_id == job.job_id,
                Interview.status == "COMPLETED"
            ).count()
            
            result.append(RAGJobInfo(
                job_id=job.job_id,
                title=job.title,
                application_count=app_count,
                completed_interview_count=interview_count
            ))
        
        return result
    except Exception as e:
        logger.error(f"Error fetching recruiter jobs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/suggestions/{language}")
def get_suggested_questions(
    language: str = "en",
    current_user: User = Depends(require_role(UserRole.RECRUITER))
):
    """
    Get suggested RAG questions for recruiter.
    """
    try:
        rag_service = get_rag_service()
        questions = rag_service.suggest_questions(language)
        return {"suggestions": questions}
    except Exception as e:
        logger.error(f"Error fetching suggestions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

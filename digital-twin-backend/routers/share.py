import os
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
import bcrypt

from db.database import get_db, ShareLinkDB
from models.schemas import ShareLinkCreate, ShareLinkUpdate, ShareLinkResponse, ShareLinkVerify
from routers.auth import get_current_user

router = APIRouter(prefix="/share", tags=["Share"])

def verify_password(plain_password, hashed_password):
    # bcrypt requires bytes
    password_bytes = plain_password.encode('utf-8')
    # If the password is > 72 bytes, bcrypt will throw an error, but let's truncate just in case
    # Actually, direct bcrypt handles it or throws. Let's truncate to 72 bytes to be safe.
    password_bytes = password_bytes[:72]
    
    # hashed_password from DB is string, encode it to bytes
    hash_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hash_bytes)

def get_password_hash(password):
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed_bytes = bcrypt.hashpw(password_bytes, salt)
    return hashed_bytes.decode('utf-8')


@router.post("", response_model=ShareLinkResponse)
def create_share_link(link: ShareLinkCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Create a new password-protected share link."""
    link_id = str(uuid.uuid4())
    hashed_password = get_password_hash(link.password)
    
    db_link = ShareLinkDB(
        id=link_id,
        twin_id=link.twin_id,
        user_id=current_user.id,
        name=link.name,
        password_hash=hashed_password,
    )
    db.add(db_link)
    db.commit()
    db.refresh(db_link)
    
    return ShareLinkResponse(
        id=db_link.id,
        twin_id=db_link.twin_id,
        name=db_link.name,
        created_at=db_link.created_at
    )


@router.get("", response_model=list[ShareLinkResponse])
def list_share_links(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """List all active share links."""
    links = db.query(ShareLinkDB).filter(ShareLinkDB.user_id == current_user.id).all()
    return [
        ShareLinkResponse(
            id=link.id,
            twin_id=link.twin_id,
            name=link.name,
            created_at=link.created_at
        ) for link in links
    ]


@router.put("/{share_id}", response_model=ShareLinkResponse)
def update_share_link(share_id: str, update_data: ShareLinkUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Update a share link's name or password."""
    db_link = db.query(ShareLinkDB).filter(ShareLinkDB.id == share_id, ShareLinkDB.user_id == current_user.id).first()
    if not db_link:
        raise HTTPException(status_code=404, detail="Share link not found")
        
    if update_data.name is not None:
        db_link.name = update_data.name
    if update_data.password is not None and update_data.password.strip():
        db_link.password_hash = get_password_hash(update_data.password)
        
    db.commit()
    db.refresh(db_link)
    
    return ShareLinkResponse(
        id=db_link.id,
        twin_id=db_link.twin_id,
        name=db_link.name,
        created_at=db_link.created_at
    )


@router.delete("/{share_id}")
def delete_share_link(share_id: str, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Delete a share link."""
    db_link = db.query(ShareLinkDB).filter(ShareLinkDB.id == share_id, ShareLinkDB.user_id == current_user.id).first()
    if not db_link:
        raise HTTPException(status_code=404, detail="Share link not found")
        
    db.delete(db_link)
    db.commit()
    return {"deleted": share_id}


@router.post("/{share_id}/verify")
def verify_share_link(share_id: str, verify_data: ShareLinkVerify, response: Response, db: Session = Depends(get_db)):
    """Verify password for a share link and return the twin_id if successful."""
    db_link = db.query(ShareLinkDB).filter(ShareLinkDB.id == share_id).first()
    if not db_link:
        raise HTTPException(status_code=404, detail="Share link not found")
        
    if not verify_password(verify_data.password, db_link.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect password")
        
    # Also return the full twin layout state so the frontend doesn't need to authenticate to load it
    from db.crud import get_layout, layout_db_to_schema
    db_layout = get_layout(db, db_link.user_id, db_link.twin_id)
    if not db_layout:
        raise HTTPException(status_code=404, detail="Twin not found or deleted")
        
    schema = layout_db_to_schema(db_layout)
    
    # Ensure the background data connector is running for this twin
    try:
        from routers.data_source import apply_assignments_sync
        if schema.kpiAssignments:
            apply_assignments_sync(db_link.twin_id, db_link.user_id, schema.domain, schema.kpiAssignments)
    except Exception as e:
        print(f"Failed to sync KPIs on share load: {e}")
    
    # Issue a read-only share token so the guest can connect to the WebSocket
    import jwt
    from routers.auth import SECRET_KEY, ALGORITHM
    share_token = jwt.encode(
        {"sub": str(db_link.user_id), "share_id": share_id, "role": "guest", "domain": "shared"},
        SECRET_KEY, algorithm=ALGORITHM
    )
    response.set_cookie(
        key="share_token",
        value=share_token,
        httponly=True,
        secure=(os.getenv("ENVIRONMENT") == "production"),
        samesite="none" if os.getenv("ENVIRONMENT") == "production" else "lax",
        max_age=3600*24
    )
    
    return {"success": True, "twin_id": db_link.twin_id, "state": schema.model_dump(), "share_token": share_token}

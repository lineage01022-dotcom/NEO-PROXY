"""Admin role dependency."""
from fastapi import Depends, HTTPException
from auth import get_current_user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if (user or {}).get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

from fastapi import APIRouter

router = APIRouter()

# Import all sub-routers
from .auth import router as auth_router
from .messages import router as messages_router
from .contacts import router as contacts_router
from .users import router as users_router

# Include all routers
router.include_router(auth_router, prefix="/auth", tags=["authentication"])
router.include_router(messages_router, prefix="/messages", tags=["messages"])  
router.include_router(contacts_router, prefix="/contacts", tags=["contacts"])
router.include_router(users_router, prefix="/users", tags=["users"])
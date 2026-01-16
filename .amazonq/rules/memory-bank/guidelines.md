# Development Guidelines

## Code Quality Standards

### TypeScript Configuration
- **Strict Type Checking**: TypeScript 5.8.3 with strict mode enabled
- **ECMAScript Version**: ES2020 target for modern JavaScript features
- **Module System**: ES modules (`"type": "module"` in package.json)
- **Type Definitions**: Explicit type imports and exports throughout codebase

### Code Formatting Patterns
- **Import Organization**: External libraries first, then internal modules
  ```typescript
  import * as React from "react";
  import { Slot } from "@radix-ui/react-slot";
  import { cn } from "@/lib/utils";
  ```
- **Named Exports**: Prefer named exports over default exports for components
- **Const Declarations**: Use `const` for all immutable values
- **Arrow Functions**: Prefer arrow functions for callbacks and functional components

### Naming Conventions
- **Components**: PascalCase for React components (`Button`, `AuthContext`, `CollapsibleTrigger`)
- **Files**: Match component names - PascalCase for components, kebab-case for utilities
- **Functions**: camelCase for functions and methods (`login`, `getStoredToken`, `apiService`)
- **Constants**: SCREAMING_SNAKE_CASE for environment variables (`API_BASE_URL`, `JWT_SECRET_KEY`)
- **Types/Interfaces**: PascalCase with descriptive names (`AuthContextType`, `ButtonProps`, `VariantProps`)
- **Private Keys**: camelCase with descriptive names (`privateKey`, `publicKey`)

### File Organization
- **Component Files**: One component per file with related types in same file
- **Index Exports**: Use barrel exports for cleaner imports
- **Separation of Concerns**: 
  - UI components in `components/ui/`
  - Business logic in `context/` and `services/`
  - Type definitions in `types/`
  - Utilities in `lib/`

## Frontend Development Patterns

### React Component Patterns

#### Functional Components with Hooks
```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });
  
  // Component logic...
}
```

#### Forward Refs for Reusable Components
```typescript
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
```

#### Context Pattern for Global State
- Create context with `createContext<Type | undefined>(undefined)`
- Provide custom hook for consuming context (`useAuth`, `useChat`)
- Throw error if hook used outside provider
- Use `useCallback` for memoized functions in context

### State Management Patterns
- **Local State**: `useState` for component-specific state
- **Global State**: Context API for auth and chat state
- **Server State**: TanStack React Query for API data fetching
- **Memoization**: `useCallback` for functions, `useMemo` for computed values
- **Effects**: `useEffect` for side effects and lifecycle management

### Styling Patterns

#### Tailwind CSS Utility Classes
- Use utility-first approach with Tailwind CSS
- Combine classes with `cn()` utility function from `lib/utils.ts`
- Use `twMerge` to handle conflicting Tailwind classes

#### Component Variants with CVA
```typescript
const buttonVariants = cva(
  "base-classes",
  {
    variants: {
      variant: {
        default: "classes",
        destructive: "classes",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
```

### API Integration Patterns

#### Fetch API with Error Handling
```typescript
const response = await fetch(`${API_BASE_URL}/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(data),
});

if (!response.ok) {
  const errorText = await response.text();
  let errorDetail = 'Operation failed';
  try {
    const errorJson = JSON.parse(errorText);
    errorDetail = errorJson.detail || errorDetail;
  } catch {
    errorDetail = errorText || errorDetail;
  }
  throw new Error(errorDetail);
}

return response.json();
```

#### Service Layer Pattern
- Encapsulate API calls in service objects (`apiService`)
- Centralize API configuration (`API_BASE_URL`)
- Handle authentication tokens in service layer
- Log requests and responses for debugging

### Storage Patterns
- **LocalStorage**: Store auth tokens and user data
- **Keys**: Use descriptive keys (`authToken`, `userId`, `userEmail`)
- **Cleanup**: Remove all related keys on logout
- **Initialization**: Check storage on app mount for session restoration

## Backend Development Patterns

### FastAPI Application Structure

#### Application Initialization
```python
app = FastAPI(
    title="Secure Messaging API",
    description="End-to-end encrypted messaging application",
    version="1.0.0"
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api/v1")
```

#### Startup and Shutdown Events
```python
@app.on_event("startup")
async def startup():
    init_db()
    EmailQueue.initialize()
    asyncio.create_task(EmailQueue.start_worker())
    logger.info("Application started")

@app.on_event("shutdown")
async def shutdown():
    logger.info("Application shutting down")
```

### Database Patterns

#### SQLAlchemy Models
```python
class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    
    # Timestamps with timezone awareness
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), 
                       onupdate=lambda: datetime.now(timezone.utc))
    
    # Indexes for performance
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_username', 'username'),
    )
```

#### UUID Primary Keys
- Use `UUID(as_uuid=True)` for all primary keys
- Generate with `uuid.uuid4()` as default
- Convert to string when sending to frontend

#### Timestamp Management
- Use `datetime.now(timezone.utc)` for timezone-aware timestamps
- Include `created_at` and `updated_at` on all models
- Use lambda functions for default values

### Configuration Management

#### Pydantic Settings
```python
class Settings(BaseSettings):
    # Environment variables with defaults
    SERVER_HOST: str = os.getenv("SERVER_HOST", "0.0.0.0")
    SERVER_PORT: int = int(os.getenv("SERVER_PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Type conversion for integers
    DATABASE_POOL_SIZE: int = int(os.getenv("DATABASE_POOL_SIZE", "20"))
    
    # Lists for CORS origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "https://production-url.com",
    ]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

#### Environment Variable Patterns
- Load with `python-dotenv` using `load_dotenv()`
- Provide sensible defaults for development
- Use type conversion (`int()`, `.lower() == "true"`)
- Validate critical settings on startup with logging

### WebSocket Patterns

#### Connection Manager
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_personal_message(self, message: str, user_id: str):
        if user_id in self.active_connections:
            await self.active_connections[user_id].send_text(message)
```

#### WebSocket Authentication
- Verify JWT token from query parameter
- Match token user_id with URL user_id
- Close connection with code 1008 on auth failure
- Send connection confirmation after successful auth

#### Message Handling
- Parse JSON messages with type field
- Handle different message types (`message`, `group_message`, `typing`, etc.)
- Save messages to database before forwarding
- Send confirmations to sender
- Broadcast to recipients

### Logging Patterns

#### Structured Logging
```python
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Use emoji for visual clarity
logger.info("✅ Operation successful")
logger.warning("⚠️ Warning message")
logger.error("❌ Error occurred")
```

#### Debug Logging
- Log all registered routes on startup
- Log WebSocket connections and disconnections
- Log message routing and delivery
- Include user IDs and message IDs in logs
- Use try-except with traceback for errors

### Security Patterns

#### Password Hashing
- Use bcrypt with configurable salt rounds
- Never log passwords or tokens (use `[REDACTED]`)
- Store only password hashes in database

#### JWT Token Management
- Generate tokens with expiration times
- Include user_id in token payload (`sub` claim)
- Verify tokens on protected endpoints
- Use Bearer token authentication header

#### Input Validation
- Use Pydantic schemas for request validation
- Validate UUIDs before database queries
- Sanitize user inputs
- Check authorization before operations

## Testing Patterns

### ESLint Configuration
```javascript
export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
);
```

### Test Structure
- Unit tests in `tests/unit/`
- Integration tests in `tests/integration/`
- Use pytest for backend testing
- Use pytest-asyncio for async tests

## Common Code Idioms

### Utility Function Pattern
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### Re-export Pattern for UI Components
```typescript
import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";

const Collapsible = CollapsiblePrimitive.Root;
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger;
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent;

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
```

### Error Handling Pattern
```typescript
try {
  // Operation
} catch (error) {
  console.error('Operation failed:', error);
  throw error; // Re-throw for caller to handle
}
```

### Async/Await Pattern
- Always use async/await for asynchronous operations
- Handle errors with try-catch blocks
- Use Promise.all for parallel operations
- Avoid callback hell

## Documentation Standards

### Code Comments
- Use JSDoc/docstrings for public APIs
- Explain "why" not "what" in comments
- Document complex algorithms
- Add TODO comments for future improvements

### Type Annotations
- Annotate all function parameters and return types
- Use TypeScript interfaces for object shapes
- Use Pydantic models for API schemas
- Avoid `any` type in TypeScript

### API Documentation
- FastAPI auto-generates docs at `/docs`
- Include descriptions in route decorators
- Document request/response schemas
- Provide example payloads

## Performance Optimization

### Database Optimization
- Use connection pooling (pool_size=20, max_overflow=40)
- Add indexes on frequently queried columns
- Use eager loading for relationships
- Batch database operations when possible

### Frontend Optimization
- Use React.memo for expensive components
- Implement code splitting with lazy loading
- Optimize bundle size with tree shaking
- Use production builds for deployment

### Caching Strategies
- Redis for session storage and caching
- LocalStorage for client-side caching
- HTTP caching headers for static assets

## Deployment Practices

### Environment Configuration
- Separate `.env.development` and `.env.production`
- Never commit `.env` files to version control
- Use platform-specific environment variables
- Validate required environment variables on startup

### Build Process
- Frontend: `npm run build` creates optimized production bundle
- Backend: Use Dockerfile for containerization
- Run migrations before deployment
- Health check endpoints for monitoring

### CORS Configuration
- Whitelist specific origins in production
- Allow all origins only in development
- Include credentials for authenticated requests
- Handle preflight OPTIONS requests

## Best Practices Summary

1. **Type Safety**: Use TypeScript/Pydantic for type checking
2. **Error Handling**: Always handle errors gracefully with user-friendly messages
3. **Logging**: Log important operations with structured, searchable logs
4. **Security**: Never expose sensitive data, validate all inputs
5. **Testing**: Write tests for critical functionality
6. **Documentation**: Keep code self-documenting with clear names and types
7. **Performance**: Optimize database queries and minimize re-renders
8. **Consistency**: Follow established patterns throughout the codebase
9. **Modularity**: Keep components small and focused on single responsibility
10. **Accessibility**: Use semantic HTML and ARIA attributes where needed

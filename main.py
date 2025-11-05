from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from routers import route_finder

app = FastAPI(
    title="Tehran Metro API",
    description="API برای مسیریابی متروی تهران",
    version="1.0.0"
)

# فعال کردن CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# اضافه کردن روت API
app.include_router(route_finder.router, prefix="/api")

# سرو کردن فایل‌های استاتیک (HTML, CSS, JS)
app.mount("/", StaticFiles(directory="static", html=True), name="static")

# در صورت نیاز، مسیر تست API
@app.get("/api")
def root():
    return {"message": "Tehran Metro Route Finder API is running"}

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "Tehran Metro API"}
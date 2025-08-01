from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import shap
import xgboost as xgb
import json
import os
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
import ssl
import re

# Load environment variables
load_dotenv()

# Environment configuration
SMTP_SERVER = os.getenv('SMTP_SERVER')
SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Initialize FastAPI app
app = FastAPI(title="Explainable AI Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Create data directory if it doesn't exist
os.makedirs("data", exist_ok=True)

# Load ML model with error handling
try:
    model = joblib.load("data/xgboost_model.pkl")
    print("Model loaded successfully")
except FileNotFoundError:
    print("Warning: Model file not found. Prediction endpoint will not work.")
    model = None
except Exception as e:
    print(f"Warning: Error loading model: {e}")
    model = None

# Pydantic models
class InputData(BaseModel):
    features: list

class AuthData(BaseModel):
    email: str
    password: str

class TokenData(BaseModel):
    token: str

# User management
USERS_FILE = 'data/users.json'

def load_users():
    """Load users from JSON file"""
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading users: {e}")
        return {}

def save_users(users):
    """Save users to JSON file"""
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
        print("Users data saved successfully")
    except Exception as e:
        print(f"Error saving users: {e}")
        raise HTTPException(status_code=500, detail="Failed to save user data")

def hash_password(password: str) -> str:
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_verification_token() -> str:
    """Generate secure verification token"""
    return secrets.token_urlsafe(32)

def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def send_verification_email(to_email: str, token: str) -> bool:
    """Send verification email"""
    if not all([SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD]):
        print("SMTP configuration missing")
        return False
    
    verify_link = f"{FRONTEND_URL}/verify?token={token}"
    subject = "Verify your email address - Explainable AI"
    
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Email Verification</title>
        <style>
            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ text-align: center; margin-bottom: 30px; }}
            .btn {{ display: inline-block; padding: 12px 30px; background: #4db6ac; color: white; text-decoration: none; border-radius: 5px; }}
            .footer {{ margin-top: 30px; font-size: 12px; color: #666; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>Welcome to Explainable AI!</h2>
            </div>
            <p>Thank you for signing up! Please verify your email address to complete your registration.</p>
            <p style="text-align: center; margin: 30px 0;">
                <a href="{verify_link}" class="btn">Verify Email Address</a>
            </p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px;">
                {verify_link}
            </p>
            <div class="footer">
                <p>If you didn't create an account, you can safely ignore this email.</p>
                <p>This verification link will expire in 24 hours.</p>
            </div>
        </div>
    </body>
    </html>
    '''
    
    try:
        msg = MIMEMultipart()
        msg['From'] = SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(html, 'html'))
        
        context = ssl.create_default_context()
        
        if SMTP_PORT == 465:
            with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, to_email, msg.as_string())
        else:
            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_USER, to_email, msg.as_string())
        
        print(f"Verification email sent to {to_email}")
        return True
        
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        return False

# API Endpoints

@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Explainable AI Backend is running",
        "version": "1.0.0",
        "status": "healthy"
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Server is running",
        "model_loaded": model is not None
    }

@app.post("/signup")
def signup(data: AuthData):
    """User signup endpoint"""
    try:
        print(f"Signup attempt for: {data.email}")
        
        # Validate email format
        if not validate_email(data.email):
            raise HTTPException(status_code=400, detail='Please enter a valid email address')
        
        # Validate password
        if len(data.password.strip()) < 6:
            raise HTTPException(status_code=400, detail='Password must be at least 6 characters long')
        
        # Load existing users
        users = load_users()
        
        # Check if user already exists
        if data.email.lower() in users:
            print(f" Signup failed: {data.email} already registered")
            raise HTTPException(status_code=409, detail='Email already registered')
        
        # Create new user
        verification_token = create_verification_token()
        users[data.email.lower()] = {
            'password_hash': hash_password(data.password),
            'is_verified': False,
            'verification_token': verification_token,
            'created_at': str(os.path.getmtime(__file__))
        }
        
        # Save user data
        save_users(users)
        print(f"User {data.email} registered successfully")
        
        # Send verification email
        email_sent = send_verification_email(data.email, verification_token)
        
        if email_sent:
            return {
                'success': True,
                'message': 'Signup successful. Please check your email to verify your account.'
            }
        else:
            return {
                'success': True,
                'message': 'Signup successful. Email verification failed - please contact support.'
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f" Signup error: {e}")
        raise HTTPException(status_code=500, detail='Internal server error during signup')

@app.post("/login")
def login(data: AuthData):
    """User login endpoint"""
    try:
        print(f"Login attempt for: {data.email}")
        
        # Validate email format
        if not validate_email(data.email):
            raise HTTPException(status_code=400, detail='Please enter a valid email address')
        
        # Load users
        users = load_users()
        user = users.get(data.email.lower())
        
        # Check if user exists
        if not user:
            print(f" Login failed - user not found: {data.email}")
            raise HTTPException(status_code=401, detail='Invalid email or password')
        
        # Check password
        if user['password_hash'] != hash_password(data.password):
            print(f" Login failed - wrong password: {data.email}")
            raise HTTPException(status_code=401, detail='Invalid email or password')
        
        # Check if email is verified
        if not user.get('is_verified', False):
            print(f"  Login attempt for unverified user: {data.email}")
            raise HTTPException(status_code=403, detail='Please verify your email before logging in.')
        
        print(f" Login successful: {data.email}")
        return {
            'success': True,
            'message': 'Login successful',
            'email': data.email
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f" Login error: {e}")
        raise HTTPException(status_code=500, detail='Internal server error during login')

@app.post("/verify")
def api_verify(data: TokenData):
    """API email verification endpoint"""
    try:
        print(f" API verification attempt with token: {data.token[:10]}...")
        
        users = load_users()
        
        # Find user with matching token
        for email, user in users.items():
            if user.get('verification_token') == data.token:
                if user.get('is_verified'):
                    return {
                        'success': True,
                        'message': 'Email already verified.'
                    }
                
                # Verify user
                user['is_verified'] = True
                user['verification_token'] = None
                save_users(users)
                
                print(f" API email verification successful for: {email}")
                return {
                    'success': True,
                    'message': 'Email verified successfully! You can now log in.'
                }
        
        print(f" Invalid verification token: {data.token[:10]}...")
        raise HTTPException(status_code=400, detail='Invalid or expired verification link.')
        
    except HTTPException:
        raise
    except Exception as e:
        print(f" API verification error: {e}")
        raise HTTPException(status_code=500, detail='Internal server error during verification')

@app.get("/verify-email", response_class=HTMLResponse)
def verify_email(token: str):
    """Direct email verification endpoint (for email links)"""
    try:
        print(f" Direct email verification attempt with token: {token[:10]}...")
        
        users = load_users()
        
        # Find user with matching token
        for email, user in users.items():
            if user.get('verification_token') == token:
                if user.get('is_verified'):
                    return """
                    <html>
                        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                            <h2 style="color: #28a745;"> Email Already Verified</h2>
                            <p>Your email has already been verified. You can close this window and log in.</p>
                            <a href="http://localhost:3000" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Go to Login</a>
                        </body>
                    </html>
                    """
                
                # Verify user
                user['is_verified'] = True
                user['verification_token'] = None
                save_users(users)
                
                print(f" Direct email verification successful for: {email}")
                return """
                <html>
                    <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                        <h2 style="color: #28a745;">Email Verified Successfully!</h2>
                        <p>Your email has been verified. You can now close this window and log in.</p>
                        <a href="http://localhost:3000" style="display: inline-block; padding: 10px 20px; background: #28a745; color: white; text-decoration: none; border-radius: 5px;">Go to Login</a>
                    </body>
                </html>
                """
        
        print(f" Invalid verification token: {token[:10]}...")
        return """
        <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #dc3545;"> Invalid Verification Link</h2>
                <p>This verification link is invalid or has expired.</p>
                <a href="http://localhost:3000/signup" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Sign Up Again</a>
            </body>
        </html>
        """
        
    except Exception as e:
        print(f" Direct email verification error: {e}")
        return """
        <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h2 style="color: #dc3545;"> Verification Error</h2>
                <p>An error occurred during email verification. Please try again or contact support.</p>
                <a href="http://localhost:3000" style="display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">Go to Login</a>
            </body>
        </html>
        """

@app.post("/predict")
def predict(data: InputData):
    """ML prediction endpoint"""
    if model is None:
        raise HTTPException(status_code=503, detail="ML model not available")
    
    try:
        print(f"Prediction requested: features={data.features}")
        
        # Validate input
        if not data.features or len(data.features) == 0:
            raise HTTPException(status_code=400, detail="Features array cannot be empty")
        
        # Convert to numpy array
        input_array = np.array(data.features).reshape(1, -1)
        
        # Make prediction
        prediction = model.predict(input_array)[0]
        
        # Generate SHAP values for explainability
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(input_array)
        shap_top_features = np.argsort(np.abs(shap_values[0]))[::-1][:5]
        
        result = {
            "success": True,
            "prediction": int(prediction),
            "top_features": shap_top_features.tolist(),
            "shap_values": shap_values[0].tolist()
        }
        
        print(f" Prediction successful: {prediction}")
        return result
        
    except Exception as e:
        print(f" Prediction error: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=404,
        content={"detail": "Endpoint not found"}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc):
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

if __name__ == "__main__":
    import uvicorn
    print(" Starting Explainable AI Backend...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
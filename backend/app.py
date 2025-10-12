from fastapi import FastAPI, HTTPException, Request, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import numpy as np
import pandas as pd
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
from pymongo import MongoClient
from datetime import datetime
import ssl
import re
import io
from typing import List, Dict, Any

# Load environment variables
load_dotenv()

# Environment configuration
SMTP_SERVER = os.getenv('SMTP_SERVER')
SMTP_PORT = int(os.getenv('SMTP_PORT', '465'))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')


MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/')
MONGO_DB = os.getenv('MONGO_DB', 'xai_ids')

mongo_enabled = False
users_collection = None

try:
    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    # Will raise if connection fails
    mongo_client.server_info()
    db = mongo_client[MONGO_DB]
    users_collection = db['users']
    mongo_enabled = True
    print(f"✅ MongoDB connected: {MONGO_URI} (DB: {MONGO_DB})")
except Exception as e:
    # Don't crash — we will fall back to JSON file
    mongo_enabled = False
    users_collection = None
    print(f"ℹ️  MongoDB not available. Using JSON file storage. (This is normal for development)")


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
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = joblib.load("data/xgboost_model.pkl")
    print("✅ XGBoost model loaded successfully")
except FileNotFoundError:
    print("⚠️  Model file not found. Prediction endpoint will not work.")
    model = None
except Exception as e:
    print(f"⚠️  Error loading model: {e}")
    model = None

# Load feature names for validation
FEATURE_NAMES = []
MODEL_EXPECTED_FEATURES = 78  # The actual model expects 78 features

# Load label mapping for attack types
LABEL_MAPPING = {}
try:
    with open("data/label_mapping.json", 'r') as f:
        LABEL_MAPPING = json.load(f)
    print(f"✅ Loaded {len(LABEL_MAPPING)} attack type labels")
except FileNotFoundError:
    print("⚠️  Label mapping file not found. Using default labels.")
    LABEL_MAPPING = {
        "Benign": 0, "Bot": 1, "Brute Force -Web": 2, "Brute Force -XSS": 3, 
        "DDOS attack-HOIC": 4, "DDOS attack-LOIC-UDP": 5, "DDoS attacks-LOIC-HTTP": 6, 
        "DoS attacks-GoldenEye": 7, "DoS attacks-Hulk": 8, "DoS attacks-SlowHTTPTest": 9, 
        "DoS attacks-Slowloris": 10, "FTP-BruteForce": 11, "Infilteration": 12, 
        "Label": 13, "SQL Injection": 14, "SSH-Bruteforce": 15
    }

# Create reverse mapping (prediction number -> attack type)
ATTACK_TYPES = {v: k for k, v in LABEL_MAPPING.items()}

def get_attack_info(prediction):
    """Get attack type and vulnerability status from prediction number"""
    attack_type = ATTACK_TYPES.get(prediction, f"Unknown ({prediction})")
    is_vulnerable = prediction != 0  # 0 = Benign, everything else is an attack
    vulnerability_status = "Attack Detected" if is_vulnerable else "Safe (Benign)"
    
    return {
        "attack_type": attack_type,
        "is_vulnerable": is_vulnerable,
        "vulnerability_status": vulnerability_status,
        "prediction_number": prediction
    }

try:
    with open("data/feature_names.json", 'r') as f:
        FEATURE_NAMES = json.load(f)
    print(f"✅ Loaded {len(FEATURE_NAMES)} feature names from file")
    print(f"🔧 Model expects exactly {MODEL_EXPECTED_FEATURES} features")
    
    # If feature names file has fewer features than model expects, extend it
    if len(FEATURE_NAMES) < MODEL_EXPECTED_FEATURES:
        missing_count = MODEL_EXPECTED_FEATURES - len(FEATURE_NAMES)
        for i in range(missing_count):
            FEATURE_NAMES.append(f"Additional_Feature_{i+1}")
        print(f"ℹ️  Extended feature names to {len(FEATURE_NAMES)} to match model requirements")
        
except FileNotFoundError:
    print("⚠️  Feature names file not found. Using default feature names.")
    FEATURE_NAMES = [f"Feature_{i+1}" for i in range(MODEL_EXPECTED_FEATURES)]

# Pydantic models
class InputData(BaseModel):
    features: List[float]

class CSVUploadData(BaseModel):
    rows: List[List[float]]
    feature_names: List[str]

class AuthData(BaseModel):
    email: str
    password: str

class TokenData(BaseModel):
    token: str

# Helper functions for feature processing
def preprocess_features(features: List[float], feature_names: List[str] = None) -> np.ndarray:
    """
    Preprocess features to handle partial input.
    Fills missing features with default values (0.0).
    """
    if feature_names is None:
        feature_names = FEATURE_NAMES
    
    expected_features = MODEL_EXPECTED_FEATURES  # Use the actual model requirement
    provided_features = len(features)
    
    print(f"🔧 Preprocessing: {provided_features} provided, {expected_features} expected")
    
    # Convert to list to avoid modifying original
    processed_features = list(features)
    
    if provided_features > expected_features:
        # Truncate if more features than expected
        processed_features = processed_features[:expected_features]
        print(f"⚠️  Truncated {provided_features} features to {expected_features}")
    elif provided_features < expected_features:
        # Fill missing features with zeros
        missing_count = expected_features - provided_features
        processed_features.extend([0.0] * missing_count)
        print(f"ℹ️  Filled {missing_count} missing features with default values (from {provided_features} to {expected_features})")
    
    print(f"🔧 Final feature count: {len(processed_features)}")
    
    # Ensure we have exactly the expected number of features
    if len(processed_features) != expected_features:
        raise ValueError(f"Feature count mismatch: expected {expected_features}, got {len(processed_features)}")
    
    # Convert to numpy array and reshape for model input
    result_array = np.array(processed_features, dtype=np.float32).reshape(1, -1)
    print(f"🔧 Final array shape: {result_array.shape}")
    
    return result_array

def process_csv_data(csv_content: str) -> Dict[str, Any]:
    """
    Process CSV data and return structured data for prediction.
    """
    try:
        # Read CSV from string
        df = pd.read_csv(io.StringIO(csv_content))
        
        # Get feature names from CSV headers
        csv_feature_names = df.columns.tolist()
        
        # Convert to numeric, filling non-numeric values with 0
        df_numeric = df.apply(pd.to_numeric, errors='coerce').fillna(0.0)
        
        # Convert to list of lists (rows)
        rows = df_numeric.values.tolist()
        
        return {
            "rows": rows,
            "feature_names": csv_feature_names,
            "row_count": len(rows),
            "feature_count": len(csv_feature_names)
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV processing error: {str(e)}")

# User management
USERS_FILE = 'data/users.json'  # keep as a fallback / backup

def load_users():
    """
    Load users. If MongoDB is available, return users from Mongo as a dict keyed by email.
    Otherwise fallback to loading the JSON file (legacy).
    Returned dict format is compatible with the rest of the code: {email: {password_hash, is_verified, verification_token, created_at}}
    """
    # Preferred: MongoDB
    if mongo_enabled and users_collection is not None:
        try:
            users = {}
            for doc in users_collection.find({}):
                email = doc.get('email')
                if not email:
                    continue
                users[email] = {
                    'password_hash': doc.get('password_hash'),
                    'is_verified': doc.get('is_verified', False),
                    'verification_token': doc.get('verification_token'),
                    'created_at': doc.get('created_at')
                }
            return users
        except Exception as e:
            print(f"Error loading users from MongoDB: {e}")
            # fall through to JSON fallback

    # Fallback: JSON file (legacy)
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"Error loading users JSON: {e}")
        return {}


def save_users(users):
    """
    Save users. If MongoDB is available, upsert each user document into Mongo.
    Otherwise fallback to writing users JSON file (legacy).
    The 'users' argument must be a dict keyed by email as used elsewhere in the app.
    """
    # Preferred: MongoDB
    if mongo_enabled and users_collection is not None:
        try:
            for email, user in users.items():
                doc = {
                    'email': email,
                    'password_hash': user.get('password_hash'),
                    'is_verified': user.get('is_verified', False),
                    'verification_token': user.get('verification_token'),
                    'created_at': user.get('created_at') or datetime.utcnow().isoformat()
                }
                users_collection.update_one({'email': email}, {'$set': doc}, upsert=True)
            return
        except Exception as e:
            print(f"Error saving users to MongoDB: {e}")
            raise HTTPException(status_code=500, detail="Failed to save user data to DB")

    # Fallback: JSON file (legacy)
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=2)
        print("Users data saved successfully (JSON fallback).")
    except Exception as e:
        print(f"Error saving users JSON: {e}")
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
    """ML prediction endpoint - handles partial features"""
    if model is None:
        raise HTTPException(status_code=503, detail="ML model not available")
    
    try:
        print(f"📊 Prediction requested: {len(data.features)} features provided")
        
        # Validate input
        if not data.features or len(data.features) == 0:
            raise HTTPException(status_code=400, detail="Features array cannot be empty")
        
        # Convert to float if needed
        features_float = [float(f) for f in data.features]
        
        # Preprocess features (handle partial input)
        input_array = preprocess_features(features_float)
        
        print(f"🔧 Preprocessed array shape: {input_array.shape}")
        print(f"🔧 Expected shape: (1, {len(FEATURE_NAMES)})")
        
        # Make prediction
        prediction = model.predict(input_array)[0]
        
        # Get attack information
        attack_info = get_attack_info(int(prediction))
        
        # Generate SHAP values for explainability
        explainer = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(input_array)
        shap_top_features = np.argsort(np.abs(shap_values[0]))[::-1][:5]
        
        top_features_detailed = []
        for idx in shap_top_features:
            top_features_detailed.append({
            'feature_idx': int(idx),
            'feature_name': FEATURE_NAMES[idx] if idx < len(FEATURE_NAMES) else f'F{idx+1}',
            'feature_value': float(input_array[0, idx]),
            'shap_value': float(shap_values[0][idx])
        })

        print(f"SHAP values type: {type(shap_values)}; shape: {np.array(shap_values).shape}")
        result = {
            "success": True,
            "prediction": int(prediction),
            "attack_type": attack_info["attack_type"],
            "is_vulnerable": attack_info["is_vulnerable"],
            "vulnerability_status": attack_info["vulnerability_status"],
            "top_features": shap_top_features.tolist(),
            "shap_values": shap_values[0].tolist(),
            "features_used": len(data.features),
            "features_expected": MODEL_EXPECTED_FEATURES,
            "feature_names": FEATURE_NAMES
        }
        
        print(f"✅ Prediction successful: {prediction}")
        return result
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        print(f"❌ Error type: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")

@app.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    """CSV upload endpoint for batch prediction"""
    if model is None:
        raise HTTPException(status_code=503, detail="ML model not available")
    
    try:
        # Validate file type
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="File must be a CSV file")
        
        # Read CSV content
        content = await file.read()
        csv_content = content.decode('utf-8')
        
        print(f"📁 Processing CSV file: {file.filename}")
        
        # Process CSV data
        csv_data = process_csv_data(csv_content)
        
        predictions = []
        
        # Process each row
        for i, row in enumerate(csv_data["rows"]):
            try:
                # Convert to float and preprocess features for this row
                row_float = [float(val) for val in row]
                input_array = preprocess_features(row_float, csv_data["feature_names"])
                
                print(f"🔧 Row {i+1}: Preprocessed array shape: {input_array.shape}")
                
                # Make prediction
                prediction = model.predict(input_array)[0]
                
                # Get attack information
                attack_info = get_attack_info(int(prediction))
                
                # Generate SHAP values
                explainer = shap.TreeExplainer(model)
                shap_values = explainer.shap_values(input_array)
                shap_top_features = np.argsort(np.abs(shap_values[0]))[::-1][:5]
                
                predictions.append({
                    "row": i + 1,
                    "prediction": int(prediction),
                    "attack_type": attack_info["attack_type"],
                    "is_vulnerable": attack_info["is_vulnerable"],
                    "vulnerability_status": attack_info["vulnerability_status"],
                    "top_features": shap_top_features.tolist(),
                    "shap_values": shap_values[0].tolist(),
                    "features_used": len(row),
                    "features_expected": MODEL_EXPECTED_FEATURES
                })
                
            except Exception as e:
                print(f"❌ Row {i+1} error: {e}")
                predictions.append({
                    "row": i + 1,
                    "error": f"Prediction failed: {str(e)}"
                })
        
        result = {
            "success": True,
            "filename": file.filename,
            "total_rows": csv_data["row_count"],
            "features_in_csv": csv_data["feature_count"],
            "features_expected": MODEL_EXPECTED_FEATURES,
            "predictions": predictions,
            "feature_names": FEATURE_NAMES
        }
        
        print(f"✅ CSV processing completed: {csv_data['row_count']} rows processed")
        return result
        
    except Exception as e:
        print(f"❌ CSV upload error: {e}")
        raise HTTPException(status_code=500, detail=f"CSV processing failed: {str(e)}")

@app.get("/feature-names")
def get_feature_names():
    """Get the list of expected feature names"""
    return {
        "success": True,
        "feature_names": FEATURE_NAMES,
        "feature_count": MODEL_EXPECTED_FEATURES
    }

@app.get("/attack-types")
def get_attack_types():
    """Get the list of all attack types and their mappings"""
    return {
        "success": True,
        "attack_types": ATTACK_TYPES,
        "label_mapping": LABEL_MAPPING,
        "total_types": len(ATTACK_TYPES)
    }

@app.post("/test-preprocessing")
def test_preprocessing(data: InputData):
    """Test endpoint to verify feature preprocessing works correctly"""
    try:
        print(f"🧪 Testing preprocessing with {len(data.features)} features")
        
        # Convert to float if needed
        features_float = [float(f) for f in data.features]
        
        # Preprocess features
        input_array = preprocess_features(features_float)
        
        return {
            "success": True,
            "original_features": len(data.features),
            "expected_features": MODEL_EXPECTED_FEATURES,
            "preprocessed_shape": input_array.shape,
            "preprocessed_features": input_array[0].tolist(),
            "message": f"Successfully preprocessed {len(data.features)} features to {MODEL_EXPECTED_FEATURES} features"
        }
        
    except Exception as e:
        print(f"❌ Preprocessing test error: {e}")
        return {
            "success": False,
            "error": str(e),
            "original_features": len(data.features),
            "expected_features": MODEL_EXPECTED_FEATURES
        }

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
    print("🚀 Starting Explainable AI Backend...")
    print("📊 API Documentation: http://localhost:8000/docs")
    print("🔧 Health Check: http://localhost:8000/health")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
# Explainable AI IDS (Intrusion Detection System)

A full-stack Explainable AI application for Intrusion Detection System with user authentication and SHAP-based model explainability.

## Project Structure

- **Frontend**: React application with authentication and dashboard
- **Backend**: FastAPI server with ML model and user management
- **ML Model**: XGBoost classifier for intrusion detection with SHAP explanations

## Features

- User registration and email verification
- Secure login/logout
- ML model prediction with SHAP explanations
- Real-time intrusion detection
- Modern, responsive UI

## Prerequisites

- Python 3.11+
- Node.js 18+
- npm or yarn

## Quick Start

### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the backend directory:

```env
# SMTP Configuration for Email Verification (Optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000

# MongoDB Configuration (Optional - falls back to JSON file)
MONGO_URI=mongodb://localhost:27017/
MONGO_DB=xai_ids
```

Start the backend server:

```bash
python app.py
```

The backend will be available at `http://localhost:8000`

### 2. Frontend Setup

```bash
npm install
npm start
```

The frontend will be available at `http://localhost:3000`

## Usage

1. **Sign Up**: Create a new account with email verification
2. **Login**: Access the dashboard with your credentials
3. **Dashboard**: Enter feature values and get ML predictions with SHAP explanations

## API Endpoints

- `POST /signup` - User registration
- `POST /login` - User authentication
- `POST /verify` - Email verification
- `POST /predict` - ML model prediction
- `GET /health` - Health check

## Model Information

- **Algorithm**: XGBoost Classifier
- **Features**: 78 network flow features (model requirement)
- **Classes**: 16 attack types + Benign
- **Explainability**: SHAP values for feature importance
- **Partial Features**: Supports 20-30 features (missing ones filled with 0)

## Troubleshooting

1. **Backend not starting**: Check Python dependencies and port availability
2. **Frontend not connecting**: Ensure backend is running on port 8000
3. **Email verification**: Configure SMTP settings in `.env` file
4. **Model not loading**: Ensure `data/xgboost_model.pkl` exists

## Development

- Backend: FastAPI with automatic reload
- Frontend: React with hot reload
- Model: XGBoost with SHAP explanations
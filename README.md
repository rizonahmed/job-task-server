 # JobTask Backend
JobTask Backend is the server-side implementation for the TaskMate application, providing APIs for task management, authentication, and real-time updates.

## 🔗 Live API
- **FrontendUi:** [https://job-task-13f1d.web.app/](#)
- **Backend:** [https://task-mate-server-gold.vercel.app/](#)

## ✨ Features
- User authentication with JWT
- CRUD operations for tasks
- Real-time task updates
- Secure API with CORS enabled

## 🛠️ Technologies Used
- Node.js
- Express
- MongoDB
- JWT Authentication
- Cors

## 📦 Installation
### Clone the repository:
```bash
git clone <repository-url>
```
### Install dependencies:
```bash
cd backend
npm install
```
### Set up environment variables:
Create a `.env` file in the `backend` directory and add the following:
```
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
```
### Run the server:
```bash
npm start
```

The backend will run on `http://localhost:5000` by default.


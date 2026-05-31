<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Fresh Fridge

Fresh Fridge is a modern, responsive web application that helps users track expiry dates, manage their fridge inventory, scan grocery receipts/items with Gemini AI, and generate personalized recipe suggestions to minimize food waste.

---

## 🚀 Key Features

* **Multi-Language Support (i18n)**: Out-of-the-box support for **English** and **French**. Automatically detects the user's browser language, lets them manually switch anytime, and persists their preferences.
* **Secure User Management**: Fully integrated sign-up and sign-in authentication flow using backend `bcryptjs` password hashing and `jsonwebtoken` session tokens.
* **PostgreSQL Persistence**: Secure, scalable database architecture that isolates fridge inventory, saved recipes, and session details by each authenticated user.
* **Programmatic DB Migrations**: Programmatic, version-controlled database migrations written in **TypeScript** via `node-pg-migrate` that automatically apply schema changes on server startup.
* **Gemini 3.5 AI Integration**: Localized AI grocery scanners (identifies products and expiry dates from uploaded photos) and recipe suggestions in the user's selected language.

---

## 🛠️ Run Locally (Development Mode)

### Prerequisites
* **Node.js** (v20+ recommended)
* **Docker** & **Docker Compose** (for running the local database)

### Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment Variables**:
   Create a `.env` file in the root directory and configure your credentials:
   ```env
   GEMINI_API_KEY="your_actual_gemini_api_key_here"
   DATABASE_URL="postgres://fridge_user:fridge_password@localhost:5432/fresh_fridge"
   JWT_SECRET="super_secret_session_key_for_development_only_123"
   ```

3. **Start the Database Container**:
   Spin up the local PostgreSQL database dependency defined in `docker-compose.test.yml`:
   ```bash
   docker compose -f docker-compose.test.yml up -d
   ```

4. **Run the Server**:
   Start the development server (runs the backend via `tsx` and hooks up Vite hot-reloading for the React client). The server will automatically connect to your local database and execute the latest TypeScript migrations:
   ```bash
   npm run dev
   ```

5. **Access the App**:
   Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🐳 Run with Docker (Production Mode)

You can run the full multi-container application locally or in production using Docker Compose.

1. Ensure you have configured your environment variables in the `.env` file.
2. Build and start both the application container and the PostgreSQL 18 database service in the background:
   ```bash
   docker compose up --build -d
   ```
3. Access the application at `http://localhost:3000`.
4. To stop the services:
   ```bash
   docker compose down
   ```

---

## ⚙️ Sane Production Deployment Environment Variables

When deploying the Fresh Fridge application to a production host (such as Google Cloud Run, AWS ECS, or a VPS), ensure the following environment variables are properly configured in your target environment or container orchestrator.

> [!IMPORTANT]
> Never deploy with default development secret keys. Change the `JWT_SECRET` and secure your database credentials!

| Environment Variable | Description | Example / Default | Required in Prod? |
| :--- | :--- | :--- | :--- |
| **`GEMINI_API_KEY`** | Secret API key used to authenticate request calls to the Google Gemini AI models for scanning receipts and generating recipes. | `AIzaSy...` | **Yes** |
| **`DATABASE_URL`** | The connection string for your production PostgreSQL instance. Must support SSL if your database provider requires it. | `postgres://user:pass@pg-host:5432/db` | **Yes** |
| **`JWT_SECRET`** | A high-entropy, cryptographically secure random string used to sign and verify user authentication tokens. | *Set to a secure random hash* | **Yes** |
| **`NODE_ENV`** | Sets the Node runtime target optimization environment. Enforcing `production` serves static client bundles and triggers secure DB SSL validations. | `production` | **Yes** |
| **`PORT`** | The port on which the Express web server listens for incoming HTTP traffic. | `3000` | Optional (defaults to `3000`) |
| **`LOG_LEVEL`** | Verbosity logging level for backend logs. Use `DEBUG` for verbose inspection or `INFO` for typical runs. | `INFO` | Optional |
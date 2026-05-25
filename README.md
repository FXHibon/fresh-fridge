<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.
https://ai.studio/apps/9d27c7fd-19ae-4ae9-8c7f-b85fef5da7c4

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env](.env) to your Gemini API key
3. Run the app:
   `npm run dev`

## Run with Docker

You can run the application inside a Docker container using either the Dockerfile or Docker Compose.

**Prerequisites:** Docker and Docker Compose installed.

### Using Docker Compose (Recommended)

1. Ensure you have your `GEMINI_API_KEY` configured in the `.env` file in the root directory.
2. Build and start the container in the background:
   ```bash
   docker compose up --build -d
   ```
3. Access the application at `http://localhost:3000`.
4. To stop the application:
   ```bash
   docker compose down
   ```

### Using raw Docker commands

1. Build the Docker image:
   ```bash
   docker build -t fresh-fridge .
   ```
2. Run the Docker container, passing your `GEMINI_API_KEY`:
   ```bash
   docker run -p 3000:3000 --env GEMINI_API_KEY="your_api_key_here" fresh-fridge
   ```
3. Access the application at `http://localhost:3000`.
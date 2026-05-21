# 🧠 An Idea Validation Engine

## Screenshots
<img width="1759" height="778" alt="Screenshot 2026-05-21 at 11 16 22 AM" src="https://github.com/user-attachments/assets/94a78676-2be4-402a-86dc-3ff2215145f6" />
<img width="1774" height="1018" alt="Screenshot 2026-05-21 at 11 16 37 AM" src="https://github.com/user-attachments/assets/47c1ae54-4c1e-4f04-a2f4-0a7c4a738596" />
<img width="1773" height="1021" alt="Screenshot 2026-05-21 at 11 16 42 AM" src="https://github.com/user-attachments/assets/db8c1232-24b7-45c9-b180-a882433e002b" />
<img width="1766" height="1025" alt="Screenshot 2026-05-21 at 11 16 51 AM" src="https://github.com/user-attachments/assets/2348a300-06e2-4179-9a2e-5e953624635d" />
<img width="1763" height="745" alt="Screenshot 2026-05-21 at 11 16 14 AM" src="https://github.com/user-attachments/assets/1ecbf964-ea5a-4279-8171-dbdf594ad78c" />

The idea validator is a AI application for evaluating early-stage business or product ideas. The app takes a user submitted idea, runs it through a LangGraph/Ollama validation pipeline, and returns a structured business analysis including a refined value proposition, pros, cons, competitors, validation score, and execution difficulty score.

The project is built as a two-service local development app:

- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: FastAPI, LangGraph, LangChain Ollama, SQLite
- **LLM runtime**: Ollama running locally
- **Database**: Local SQLite file for saved validation history

This README is written for a clean local setup from zero to running application.

---

## Table of Contents

- [What the Application Does](#what-the-application-does)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Install and Configure Ollama](#install-and-configure-ollama)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Run the Full Application Locally](#run-the-full-application-locally)
- [Environment Variables](#environment-variables)
- [SQLite Validation History](#sqlite-validation-history)
- [API Reference](#api-reference)
- [Development Workflow](#development-workflow)
- [Troubleshooting](#troubleshooting)
- [Production/Deployment Notes](#productiondeployment-notes)

---

## What the Application Does

The Validation Engine helps a user reason about whether a business idea is worth pursuing.

The user enters an idea, for example:

```text
A platform where users can review books from authors and swipe left or right on recommended books.
```

The backend sends the idea through an LLM-powered graph pipeline and returns:

- **Refined value proposition**
- **Pros**
- **Cons**
- **Competitor context**
- **Validation score**
- **Difficulty score**
- **Reasoning for the score**

Each completed validation is saved locally to SQLite so the frontend sidebar can show previous ideas.

---

## Architecture

```text
+-------------------+       HTTP        +------------------------+
|                   |  /api/validate    |                        |
| React + Vite UI   | ----------------> | FastAPI Backend        |
|                   |                   |                        |
| - Idea input      |                   | - REST API             |
| - Loading states  |                   | - LangGraph workflow   |
| - Saved history   |                   | - SQLite persistence   |
|                   |                   |                        |
+-------------------+                   +-----------+------------+
                                                    |
                                                    | LangChain Ollama
                                                    v
                                         +------------------------+
                                         | Local Ollama Runtime   |
                                         | llama3.2:1b            |
                                         +------------------------+
```

The frontend calls the backend using relative API paths such as `/api/validate`. In local development, Vite should proxy these requests to the FastAPI backend, or the app can be served in an environment where both services are reachable under the same host.

### LangGraph Graph Architecture

The core AI workflow lives in:

```text
Backend/app/graph.py
```

The backend compiles a LangGraph `StateGraph` named `validation_app`. FastAPI calls this graph from the `/api/validate` endpoint with the user's original idea as the initial state.

The graph is a sequential pipeline:

```text
START
  |
  v
validate_idea_node
  |
  v
define_pros_node
  |
  v
define_cons_node
  |
  v
get_difficulty_score_node
  |
  v
define_competitors_list_node
  |
  v
get_validation_score_node
  |
  v
define_validation_score_reasoning_node
  |
  v
END
```

Each node receives the current `ValidationEngineState`, calls the local Ollama model through LangChain's `ChatOllama`, and returns a partial state update. LangGraph merges each node output into the shared state before moving to the next node.

The graph state contains:

| State Field | Purpose |
|---|---|
| `user_idea` | Original idea submitted by the user |
| `narrowed_down_idea` | More specific business concept generated by the first LLM node |
| `pros` | List-style output describing positive signals |
| `cons` | List-style output describing risks or weaknesses |
| `difficulty_score` | Execution difficulty score from 1 to 10 |
| `competitors_list` | Real companies competing in or near the market |
| `validation_score` | Overall idea strength score from 1 to 10 |
| `validation_score_reasoning` | Short explanation for the assigned validation score |

Node responsibilities:

| Node | Responsibility |
|---|---|
| `validate_idea_node` | Narrows the raw user idea into a clearer and more specific value proposition |
| `define_pros_node` | Generates exactly five concise pros for the refined idea |
| `define_cons_node` | Generates exactly five concise cons for the refined idea |
| `get_difficulty_score_node` | Scores execution difficulty using the idea, pros, and cons |
| `define_competitors_list_node` | Lists real competitors based on the original and refined idea |
| `get_validation_score_node` | Assigns the overall validation score using all previous graph context |
| `define_validation_score_reasoning_node` | Produces the final short explanation shown in the UI |

Once the graph finishes, `Backend/app/main.py` converts the final graph state into a `ValidationResponse` and saves it through `Backend/app/storage.py` into SQLite.

---

## Project Structure

```text
ValidationEngine/
├── Backend/
│   ├── app/
│   │   ├── config.py          # Ollama base URL and model configuration
│   │   ├── graph.py           # LangGraph validation pipeline
│   │   ├── main.py            # FastAPI app and API routes
│   │   ├── schemas.py         # Pydantic request/response models
│   │   └── storage.py         # SQLite persistence helpers
│   ├── requirements.txt       # Backend Python dependencies
│   └── validation_history.db  # Local SQLite DB, created at runtime
│
├── Frontend/
│   ├── src/
│   │   ├── App.tsx            # Main React application
│   │   └── styles.css         # Tailwind and global styles
│   ├── package.json           # Frontend scripts and dependencies
│   ├── tailwind.config.js
│   └── vite.config.ts
│
└── README.md
```

---

## Prerequisites

Install the following before running the app:

- **macOS** or another Unix-like development environment
- **Python 3.10+** recommended
- **Node.js 18+** recommended
- **npm**
- **Ollama**
- **Git** optional, but recommended

Check versions:

```bash
python3 --version
node --version
npm --version
```

---

## Install and Configure Ollama

The backend uses Ollama as the local LLM runtime.

### 1. Install Ollama

Download and install Ollama from:

```text
https://ollama.com/download
```

On macOS, open the Ollama application after installation. Ollama normally runs a local server at:

```text
http://127.0.0.1:11434
```

### 2. Verify Ollama is Running

Run:

```bash
ollama list
```

If Ollama is running, this prints the models installed locally.

You can also verify the local API:

```bash
curl http://127.0.0.1:11434/api/tags
```

### 3. Pull the Model Used by This App

The backend default model is:

```text
llama3.2:1b
```

Install it with:

```bash
ollama pull llama3.2:1b
```

Then verify:

```bash
ollama list
```

You should see something similar to:

```text
NAME              ID              SIZE      MODIFIED
llama3.2:1b       ...             ...       ...
```

### 4. Optional: Run a Manual Model Test

```bash
ollama run llama3.2:1b
```

Then type a simple prompt. If the model responds, Ollama is working.

---

## Backend Setup

Open a terminal at the project root:

```bash
cd /path/to/ValidationEngine
```

Then go into the backend folder:

```bash
cd Backend
```

### 1. Create a Virtual Environment

```bash
python3 -m venv .venv
```

### 2. Activate the Virtual Environment

On macOS/Linux:

```bash
source .venv/bin/activate
```

Your terminal should show that the virtual environment is active.

### 3. Install Backend Dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the Backend

From the `Backend` directory:

```bash
uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

The backend should now be running at:

```text
http://127.0.0.1:8000
```

### 5. Check Backend Health

In a separate terminal:

```bash
curl http://127.0.0.1:8000/health
```

Expected successful response:

```json
{
  "status": "ok",
  "model": "llama3.2:1b"
}
```

If you see `ollama_unreachable`, make sure the Ollama app is open and running.

If you see `model_missing`, run:

```bash
ollama pull llama3.2:1b
```

---

## Frontend Setup

Open a second terminal at the project root:

```bash
cd /path/to/ValidationEngine
```

Then go into the frontend folder:

```bash
cd Frontend
```

### 1. Install Frontend Dependencies

```bash
npm install
```

### 2. Run the Frontend Dev Server

```bash
npm run dev
```

The frontend dev server runs Vite and should print a local URL similar to:

```text
http://127.0.0.1:5173
```

Open that URL in your browser.

---

## Run the Full Application Locally

You need three things running or installed:

1. **Ollama app running**
2. **Backend running on port 8000**
3. **Frontend running with Vite**

### Terminal 1: Ollama

Usually on macOS, just open the Ollama app.

Verify:

```bash
ollama list
```

### Terminal 2: Backend

```bash
cd Backend
source .venv/bin/activate
uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

### Terminal 3: Frontend

```bash
cd Frontend
npm run dev
```

Then open:

```text
http://127.0.0.1:5173
```

---

## Environment Variables

The backend supports these environment variables:

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://127.0.0.1:11434` | Base URL for local Ollama server |
| `OLLAMA_MODEL` | `llama3.2:1b` | Ollama model used by the validation pipeline |

Example override:

```bash
OLLAMA_MODEL=llama3.2:1b uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

If you want to use a different installed model, first pull it:

```bash
ollama pull llama3.2
```

Then run:

```bash
OLLAMA_MODEL=llama3.2 uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

The backend also attempts to resolve the configured model against installed Ollama models.

---

## SQLite Validation History

Saved validation runs are stored locally in SQLite.

The database file is created automatically at runtime:

```text
Backend/validation_history.db
```

The saved history supports:

- Listing previous validations
- Loading one previous validation
- Deleting a previous validation

No external database server is required.

If you want to reset local history, stop the backend and remove the database file:

```bash
rm Backend/validation_history.db
```

Then restart the backend. A new database will be created automatically.

---

## API Reference

Base URL for local backend:

```text
http://127.0.0.1:8000
```

### Health Check

```http
GET /health
```

Example:

```bash
curl http://127.0.0.1:8000/health
```

Successful response:

```json
{
  "status": "ok",
  "model": "llama3.2:1b"
}
```

### Validate an Idea

```http
POST /api/validate
```

Request body:

```json
{
  "user_idea": "A marketplace for local fitness coaches to sell personalized training plans."
}
```

Example:

```bash
curl -X POST http://127.0.0.1:8000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"user_idea":"A marketplace for local fitness coaches to sell personalized training plans."}'
```

Response shape:

```json
{
  "id": "...",
  "title": "...",
  "user_idea": "...",
  "narrowed_down_idea": "...",
  "pros": "...",
  "cons": "...",
  "difficulty_score": "...",
  "competitors_list": "...",
  "validation_score": "...",
  "validation_score_reasoning": "...",
  "created_at": "..."
}
```

### List Saved Validations

```http
GET /api/validations
```

Example:

```bash
curl http://127.0.0.1:8000/api/validations
```

### Get One Saved Validation

```http
GET /api/validations/{validation_id}
```

Example:

```bash
curl http://127.0.0.1:8000/api/validations/YOUR_VALIDATION_ID
```

### Delete One Saved Validation

```http
DELETE /api/validations/{validation_id}
```

Example:

```bash
curl -X DELETE http://127.0.0.1:8000/api/validations/YOUR_VALIDATION_ID
```

Successful deletion returns:

```text
204 No Content
```

If the validation does not exist, the backend returns:

```text
404 Not Found
```

---

## Development Workflow

Recommended local workflow:

1. Start Ollama.
2. Start the backend.
3. Start the frontend.
4. Open the frontend in the browser.
5. Submit an idea.
6. Watch the loading states while the LLM runs.
7. Review generated output.
8. Reload previous validations from the sidebar.
9. Delete previous validations if needed.

### Backend Development Commands

From `Backend`:

```bash
source .venv/bin/activate
uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

Compile-check backend Python files:

```bash
python3 -m compileall app
```

### Frontend Development Commands

From `Frontend`:

```bash
npm run dev
```

Build frontend:

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

---

## Troubleshooting

### Error: Ollama is not reachable

Example message:

```text
Ollama is not reachable at http://127.0.0.1:11434
```

Fix:

1. Open the Ollama app.
2. Verify it is running:

```bash
curl http://127.0.0.1:11434/api/tags
```

3. Restart the backend.

### Error: Model is not installed

Example message:

```text
Model 'llama3.2:1b' is not installed.
```

Fix:

```bash
ollama pull llama3.2:1b
```

Then restart the backend.

### Error: Method Not Allowed When Deleting

If deleting a saved idea returns:

```text
Method Not Allowed
```

The backend process likely has not reloaded the latest `DELETE /api/validations/{validation_id}` route.

Fix:

1. Stop the backend server.
2. Start it again:

```bash
uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

3. Try deleting again.

### Frontend Cannot Reach Backend

The frontend calls API paths like:

```text
/api/validate
```

Make sure the backend is running on the expected local port and that the frontend dev setup is configured to reach it.

If needed, call the backend directly to confirm it works:

```bash
curl http://127.0.0.1:8000/health
```

### Backend Changes Not Taking Effect

If code changes do not seem to apply:

1. Stop the backend server.
2. Restart it.
3. Confirm the file you edited is under `Backend/app/`.

### Frontend Changes Not Showing

Try:

1. Refresh the browser.
2. Stop and restart Vite.
3. Clear browser cache if necessary.

---

## Production/Deployment Notes

This project is currently documented for local development only.

Before deploying, consider:

- Replacing local Ollama with a production-grade hosted model or GPU-backed inference service.
- Moving SQLite to a managed database if multiple users need persistent shared history.
- Restricting CORS instead of allowing all origins.
- Adding authentication if saved validations are user-specific.
- Adding request timeouts and background job handling for long LLM runs.
- Adding structured logging and monitoring.
- Adding automated tests for API routes and frontend behavior.

Deployment is intentionally out of scope for now.

---

## Quick Start Summary

Install Ollama model:

```bash
ollama pull llama3.2:1b
```

Run backend:

```bash
cd Backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:api --reload --host 127.0.0.1 --port 8000
```

Run frontend in another terminal:

```bash
cd Frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

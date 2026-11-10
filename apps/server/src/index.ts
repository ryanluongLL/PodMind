import "dotenv/config"
import { app } from "./app.js"
import "./jobs/worker.js"

/// Entry point for the real server: loads .env, starts the transcription
/// worker, and listens. Everything else lives in app.ts so tests can use it.
const port = process.env.PORT || 3001

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
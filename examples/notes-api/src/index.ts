import { configFromEnv } from './config.js';
import { createApp } from './server.js';
import { createMemoryStore, sampleNotes } from './store/memory.js';

const config = configFromEnv();
const app = createApp(createMemoryStore(config.seed ? sampleNotes : []));
app.listen(config.port, () => console.log(`notes-api listening on http://localhost:${config.port}`));


import { config } from 'dotenv';
config();

import '@/ai/flows/suggest-parameters.ts';
import '@/ai/flows/generate-background-flow.ts'; // Added AI background generation flow
// import '@/ai/flows/generate-texture-flow.ts'; // Removed AI texture generation flow for objects

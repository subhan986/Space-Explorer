
// src/ai/flows/generate-background-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to generate a space nebula background image.
 *
 * - generateBackground - Generates a background image for a space scene.
 * - GenerateBackgroundInput - Input schema for the flow.
 * - GenerateBackgroundOutput - Output schema for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBackgroundInputSchema = z.object({
  prompt: z.string().describe('A descriptive prompt for the space background image (e.g., "vibrant space nebula").'),
});
export type GenerateBackgroundInput = z.infer<typeof GenerateBackgroundInputSchema>;

const GenerateBackgroundOutputSchema = z.object({
  imageDataUri: z.string().describe("The generated background image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateBackgroundOutput = z.infer<typeof GenerateBackgroundOutputSchema>;

export async function generateBackground(input: GenerateBackgroundInput): Promise<GenerateBackgroundOutput> {
  return generateBackgroundFlow(input);
}

const generateBackgroundFlow = ai.defineFlow(
  {
    name: 'generateBackgroundFlow',
    inputSchema: GenerateBackgroundInputSchema,
    outputSchema: GenerateBackgroundOutputSchema,
  },
  async (input: GenerateBackgroundInput) => {
    const fullPrompt = `Generate a breathtaking, high-resolution panoramic image of a ${input.prompt}, suitable as a 360-degree background for a 3D space simulation. Ensure it has rich colors, deep blacks, and a sense of vastness. The image should be equirectangular if possible, otherwise a beautiful square image is fine.`;

    try {
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: fullPrompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      if (!media || !media.url) {
        throw new Error('Image generation failed to return a media URL.');
      }
      
      return { imageDataUri: media.url };

    } catch (error) {
      console.error(`Error generating background image for prompt "${input.prompt}":`, error);
      throw new Error(`Failed to generate background image.`);
    }
  }
);

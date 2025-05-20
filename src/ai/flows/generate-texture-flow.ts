
// src/ai/flows/generate-texture-flow.ts
'use server';
/**
 * @fileOverview A Genkit flow to generate textures for celestial bodies.
 *
 * - generateTexture - Generates a texture image for a given object name.
 * - GenerateTextureInput - Input schema for the flow.
 * - GenerateTextureOutput - Output schema for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTextureInputSchema = z.object({
  objectName: z.string().describe('The name of the celestial object for which to generate a texture (e.g., "Sun", "Earth").'),
});
export type GenerateTextureInput = z.infer<typeof GenerateTextureInputSchema>;

const GenerateTextureOutputSchema = z.object({
  textureDataUri: z.string().describe("The generated texture image as a data URI. Expected format: 'data:image/png;base64,<encoded_data>'."),
});
export type GenerateTextureOutput = z.infer<typeof GenerateTextureOutputSchema>;

export async function generateTexture(input: GenerateTextureInput): Promise<GenerateTextureOutput> {
  return generateTextureFlow(input);
}

const generateTextureFlow = ai.defineFlow(
  {
    name: 'generateTextureFlow',
    inputSchema: GenerateTextureInputSchema,
    outputSchema: GenerateTextureOutputSchema,
  },
  async (input: GenerateTextureInput) => {
    let promptText = '';
    if (input.objectName.toLowerCase() === 'sun') {
      promptText = "Generate a fiery, turbulent, high-resolution, seamless spherical texture map of the Sun's surface. The texture should be suitable for mapping onto a 3D sphere. Make it look like a star.";
    } else if (input.objectName.toLowerCase() === 'earth') {
      promptText = "Generate a vibrant, high-resolution, seamless spherical texture map of planet Earth. Show realistic continents, oceans, and swirling cloud patterns. The texture should be suitable for mapping onto a 3D sphere.";
    } else {
      throw new Error(`Texture generation not supported for: ${input.objectName}`);
    }

    try {
      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp', // IMPORTANT: Use the model capable of image generation
        prompt: promptText,
        config: {
          responseModalities: ['TEXT', 'IMAGE'], // Must include IMAGE
        },
      });

      if (!media || !media.url) {
        throw new Error('Image generation failed to return a media URL.');
      }
      
      // Gemini 2.0 Flash Exp might return JPGs, ensure PNG for consistency if possible, or handle mime type.
      // For simplicity, we assume it returns a usable data URI.
      return { textureDataUri: media.url };

    } catch (error) {
      console.error(`Error generating texture for ${input.objectName}:`, error);
      throw new Error(`Failed to generate texture for ${input.objectName}.`);
    }
  }
);


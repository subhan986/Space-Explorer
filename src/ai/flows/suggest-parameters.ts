// src/ai/flows/suggest-parameters.ts
'use server';

/**
 * @fileOverview A GenAI tool that suggests starting parameters for object mass and velocity.
 *
 * - suggestParameters - A function that handles the parameter suggestion process.
 * - SuggestParametersInput - The input type for the suggestParameters function.
 * - SuggestParametersOutput - The return type for the suggestParameters function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SuggestParametersInputSchema = z.object({
  currentMass: z.number().optional().describe('The current mass of the object.'),
  currentVelocity: z.number().optional().describe('The current velocity of the object.'),
  scenarioDescription: z
    .string()
    .optional()
    .describe('A description of the current scenario.'),
});
export type SuggestParametersInput = z.infer<typeof SuggestParametersInputSchema>;

const SuggestParametersOutputSchema = z.object({
  suggestedMass: z.number().describe('The suggested mass for the object.'),
  suggestedVelocity: z.number().describe('The suggested velocity for the object.'),
  explanation: z.string().describe('An explanation of why these parameters were suggested.'),
});
export type SuggestParametersOutput = z.infer<typeof SuggestParametersOutputSchema>;

export async function suggestParameters(input: SuggestParametersInput): Promise<SuggestParametersOutput> {
  return suggestParametersFlow(input);
}

const prompt = ai.definePrompt({
  name: 'suggestParametersPrompt',
  input: {schema: SuggestParametersInputSchema},
  output: {schema: SuggestParametersOutputSchema},
  prompt: `You are an expert in physics simulations, skilled at suggesting initial parameters for mass and velocity to achieve interesting gravitational effects.

You will suggest values for 'suggestedMass' and 'suggestedVelocity' to create a visually interesting simulation.

Consider the current scenario and any existing parameters when making your suggestions. Explain your reasoning in the 'explanation' field.

Here's the current scenario:
Scenario Description: {{{scenarioDescription}}}
Current Mass: {{{currentMass}}}
Current Velocity: {{{currentVelocity}}}

Respond with values that will result in stable orbits or interesting slingshot trajectories.
`,
});

const suggestParametersFlow = ai.defineFlow(
  {
    name: 'suggestParametersFlow',
    inputSchema: SuggestParametersInputSchema,
    outputSchema: SuggestParametersOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

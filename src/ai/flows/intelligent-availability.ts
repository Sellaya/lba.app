'use server';

/**
 * @fileOverview An AI agent that intelligently updates makeup artist availability.
 *
 * - updateAvailability - A function that updates the makeup artist's availability considering existing bookings, travel time, and service duration.
 * - UpdateAvailabilityInput - The input type for the updateAvailability function.
 * - UpdateAvailabilityOutput - The return type for the updateAvailability function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const UpdateAvailabilityInputSchema = z.object({
  existingBookings: z
    .string()
    .describe('A list of existing bookings, including date, time, and service.'),
  serviceDuration: z
    .number()
    .describe('The duration of the makeup service in minutes.'),
  travelTime: z
    .number()
    .describe(
      'The travel time in minutes to the client location within the Toronto GTA.'
    ),
  newAppointmentDateTime: z
    .string()
    .describe(
      'The requested date and time for the new appointment, in ISO format.'
    ),
});
export type UpdateAvailabilityInput = z.infer<typeof UpdateAvailabilityInputSchema>;

const UpdateAvailabilityOutputSchema = z.object({
  isAvailable: z
    .boolean()
    .describe(
      'Whether the makeup artist is available for the new appointment based on existing bookings, travel time, and service duration.'
    ),
  reason: z
    .string()
    .optional()
    .describe(
      'The reason why the makeup artist is not available, if applicable.'
    ),
});
export type UpdateAvailabilityOutput = z.infer<typeof UpdateAvailabilityOutputSchema>;

export async function updateAvailability(
  input: UpdateAvailabilityInput
): Promise<UpdateAvailabilityOutput> {
  return updateAvailabilityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'updateAvailabilityPrompt',
  input: {schema: UpdateAvailabilityInputSchema},
  output: {schema: UpdateAvailabilityOutputSchema},
  prompt: `You are an AI assistant helping a makeup artist manage their availability.

  Given the following information about existing bookings, travel time, service duration, and the requested date and time for a new appointment, determine whether the makeup artist is available.

  Existing Bookings: {{{existingBookings}}}
  Service Duration: {{{serviceDuration}}} minutes
  Travel Time: {{{travelTime}}} minutes
  New Appointment Date and Time: {{{newAppointmentDateTime}}}

  Consider travel time to and from appointments, and the duration of each service.
  Return a JSON object indicating whether the makeup artist is available and, if not, the reason why.
  `,
});

const updateAvailabilityFlow = ai.defineFlow(
  {
    name: 'updateAvailabilityFlow',
    inputSchema: UpdateAvailabilityInputSchema,
    outputSchema: UpdateAvailabilityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

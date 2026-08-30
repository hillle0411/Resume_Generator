import { z } from "zod";

export const ResumeSchema = z.object({
  name: z.string(),
  targetRole: z.string().optional(),
  contact: z.object({
    location: z.string().optional(),
    email: z.string().optional(),
    linkedin: z.string().optional(),
  }),
  summary: z.string().optional(),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    })
  ),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      dates: z.string(),
    })
  ),
  skills: z.array(z.string()),
});

export type Resume = z.infer<typeof ResumeSchema>;

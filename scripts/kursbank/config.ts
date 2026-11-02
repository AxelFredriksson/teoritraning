import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const CourseConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceDir: z.string().min(1),
  lectures: z.array(z.object({ n: z.number().int().positive(), title: z.string().min(1) })),
  sources: z.array(z.object({ glob: z.string().min(1), trust: z.enum(['trusted', 'helper']) })),
})

export type CourseConfig = z.infer<typeof CourseConfigSchema>

export function loadCourse(dir: string): CourseConfig {
  return CourseConfigSchema.parse(JSON.parse(readFileSync(join(dir, 'course.json'), 'utf8')))
}

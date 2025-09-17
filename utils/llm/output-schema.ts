import { z } from 'zod'

const schemas = {
  translateParagraphs: z.object({
    translation: z.array(z.string()),
  }),
  nextStep: z.discriminatedUnion('action', [
    z.object({
      action: z.literal('chat'),
    }),
    z.object({
      action: z.literal('search_online'),
      queryKeywords: z.array(z.string()),
    }),
  ]),
  searchKeywords: z.object({
    queryKeywords: z.array(z.string()),
  }),
  chatTitle: z.object({
    title: z.string(),
  }),
  emailCompose: z.object({
    subject: z.string().describe('The improved or confirmed email subject line'),
    body: z.string().describe('The polished email body text'),
  }),
}

export type Schemas = typeof schemas
export type SchemaName = keyof Schemas

export function selectSchema<S extends SchemaName>(schemaName: S) {
  return schemas[schemaName]
}

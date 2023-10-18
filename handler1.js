import { createSchema, createYoga } from 'graphql-yoga'
import { useCookies } from '@whatwg-node/server-plugin-cookies'

const yoga = createYoga({
  logging: true,
  maskedErrors: false,
  graphqlEndpoint: '/handler1',
  schema: createSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        greetings: String
      }
    `,
    resolvers: {
      Query: {
        async greetings (root, args, ctx) {
          await ctx.request.cookieStore?.set('Token', 'JWTOKENblablabla')
          await ctx.request.cookieStore?.set('UserInfo', 'somedata')

          return 'This is the `greetings` field of the root `Query` type'
        }
      }
    }
  }),
  plugins: [useCookies()]
})

export async function handler(event, lambdaContext) {
  const response = await yoga.fetch(
    event.path +
      '?' +
      new URLSearchParams((event.queryStringParameters) || {}).toString(),
    {
      method: event.httpMethod,
      headers: event.headers,
      body: event.body
        ? Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'utf8')
        : undefined
    },
    {
      event,
      lambdaContext
    }
  )

  const responseHeaders = Object.fromEntries(response.headers.entries())

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
    isBase64Encoded: false
  }
}

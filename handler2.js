import { createSchema, createYoga } from 'graphql-yoga'
import { CookieStore, getCookieString } from '@whatwg-node/cookie-store'

const useCustomCookies = () => {
  const cookieStringsByRequest = new WeakMap()

  return {
    onRequest({ request }) {
      const cookieStrings = []
      request.cookieStore = new CookieStore(request.headers.get('cookie') ?? '')
      request.cookieStore.onchange = ({ changed, deleted }) => {
        changed.forEach((cookie) => {
          cookieStrings.push(getCookieString(cookie))
        })
        deleted.forEach((cookie) => {
          cookieStrings.push(getCookieString({ ...cookie, value: undefined }))
        })
      }
      cookieStringsByRequest.set(request, cookieStrings)
    },
    onResponse({ request, response }) {
      const cookieStrings = cookieStringsByRequest.get(request)
      cookieStrings?.forEach((cookieString) => {
        response.headers.append('Set-Cookie', cookieString)
      })

      // that the only line added
      response.headers.set('Set-Cookies', JSON.stringify(cookieStrings))
    },
  }
}

const yoga = createYoga({
  logging: true,
  maskedErrors: false,
  graphqlEndpoint: '/handler2',
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
  plugins: [useCustomCookies()]
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

  const multiValueHeaders = {}
  const headers = Object.fromEntries(response.headers.entries())
  if (headers['set-cookies']) {
    multiValueHeaders['set-cookie'] = JSON.parse(headers['set-cookies'])

    delete headers['set-cookies']
    delete headers['set-cookie']
  }

  return {
    statusCode: response.status,
    headers,
    multiValueHeaders,
    body: await response.text(),
    isBase64Encoded: false,
  }
}

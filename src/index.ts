import { cors } from '@elysiajs/cors'
import { Elysia } from 'elysia'
import { existsSync } from 'fs'
import { env } from './env'

// Define the allowed project IDs
const ALLOWED_PROJECT_IDS = env.ALLOWED_PROJECT_IDS.split(',')
	.map((id) => id.trim())
	.filter(Boolean)

// Define the allowed organization IDs
const ALLOWED_ORGS = env.ALLOWED_ORGS.split(',')
	.map((org) => org.trim())
	.filter(Boolean)

// Environment settings
const isDev = env.ENV === 'development'

// Check if SSL certificates are configured
const certPath = env.SSL_CERT_PATH
const keyPath = env.SSL_KEY_PATH
const useHttps = Boolean(certPath && keyPath)

function getTimestamp(): string {
	const now = new Date()
	return `${now.toISOString()} [${now.toLocaleTimeString([], { hour12: false })}]`
}

function devLog(...args: any[]) {
	if (isDev) {
		console.log(`${getTimestamp()} [DEV]`, ...args)
	}
}

// Configure TLS if SSL certificates are provided
let tlsConfig = undefined

if (useHttps && certPath && keyPath) {
	try {
		// Check if certificate files exist
		if (!existsSync(certPath) || !existsSync(keyPath)) {
			console.error(`${getTimestamp()} ❌ SSL certificate or key file not found at the specified paths`)
			console.error(
				`${getTimestamp()} ❌ Please provide valid SSL certificates or remove the SSL_CERT_PATH and SSL_KEY_PATH variables to use HTTP`,
			)
			process.exit(1)
		}

		tlsConfig = {
			cert: Bun.file(certPath),
			key: Bun.file(keyPath),
		}

		console.log(`${getTimestamp()} ✅ SSL certificate and key loaded successfully`)
	} catch (error) {
		console.error(`${getTimestamp()} ❌ Failed to configure HTTPS:`, error)
		process.exit(1)
	}
}

// Create Elysia app with TLS configuration if needed
export const app = new Elysia({
	serve: {
		port: parseInt(env.PORT),
		...(tlsConfig ? { tls: tlsConfig } : {}),
	},
})
	.use(cors())
	.get('/', () => {
		devLog('Received request to root endpoint')
		return 'Sentry Tunnel Server is running'
	})
	.get('/health', () => {
		devLog('Received request to health endpoint')
		return {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			uptime: process.uptime()
		}
	})
	.post(
		'/tunnel',
		async ({
			body,
			request,
			set,
		}: {
			body: unknown
			request: Request
			set: {
				status: number
				headers: Record<string, string>
			}
		}) => {
			const requestId = Math.random().toString(36).substring(2, 10)
			devLog(`[${requestId}] Received request to tunnel endpoint`)

			try {
				// The body should be a Sentry envelope
				const envelope = body as string

				if (!envelope) {
					devLog(`[${requestId}] Missing envelope data`)
					set.status = 400
					return { error: 'Missing envelope data' }
				}

				// Parse the envelope header (first line of the envelope)
				const pieces = envelope.split('\n')
				// devLog(`[${requestId}] Envelope has ${pieces.length} pieces`)

				const header = JSON.parse(pieces[0])
				// devLog(`[${requestId}] Parsed envelope header:`, header)

				// Extract DSN information
				if (!header.dsn) {
					devLog(`[${requestId}] Missing DSN in envelope header`)
					set.status = 400
					return { error: 'Missing DSN in envelope header' }
				}

				const { host, pathname, username } = new URL(header.dsn)
				devLog(`[${requestId}] DSN info - Host: ${host}, Path: ${pathname}, Username: ${username}`)

				// Extract project ID (remove leading slash)
				const projectId = pathname.substring(1)
				devLog(`[${requestId}] Project ID: ${projectId}`)

				// Validate the project ID if ALLOWED_PROJECT_IDS is not empty
				if (ALLOWED_PROJECT_IDS.length > 0 && !ALLOWED_PROJECT_IDS.includes(projectId)) {
					devLog(
						`[${requestId}] Invalid project ID: ${projectId}, allowed: ${ALLOWED_PROJECT_IDS.join(', ')}`,
					)
					set.status = 403
					return { error: `Invalid project ID: ${projectId}` }
				}

				// Validate the organization ID if ALLOWED_ORGS is not empty
				if (ALLOWED_ORGS.length > 0 && !ALLOWED_ORGS.includes(username)) {
					devLog(
						`[${requestId}] Invalid organization ID: ${username}, allowed: ${ALLOWED_ORGS.join(', ')}`,
					)
					set.status = 403
					return { error: `Invalid organization ID: ${username}` }
				}

				// Construct the Sentry API URL
				const sentryUrl = `https://${host}/api/${projectId}/envelope/?sentry_key=${username}`
				devLog(`[${requestId}] Forwarding to Sentry URL: ${sentryUrl}`)

				// Forward the envelope to Sentry
				const startTime = Date.now()
				devLog(`[${requestId}] Sending request to Sentry...`)
				const response = await fetch(sentryUrl, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/x-sentry-envelope',
						'User-Agent': request.headers.get('User-Agent') || 'Sentry-Tunnel-Bun',
					},
					body: envelope,
				})
				const endTime = Date.now()
				devLog(
					`[${requestId}] Received response from Sentry with status: ${response.status} (took ${endTime - startTime}ms)`,
				)

				// Return the response from Sentry
				set.status = response.status

				// Copy headers from Sentry response
				response.headers.forEach((value, key) => {
					// devLog(`[${requestId}] Setting response header: ${key}: ${value}`)
					set.headers[key] = value
				})

				const responseText = await response.text()
				// devLog(`[${requestId}] Response body length: ${responseText.length} characters`)
				devLog(`[${requestId}] Request completed successfully`)
				return responseText
			} catch (error) {
				console.error(`${getTimestamp()} [${requestId}] Error in tunnel:`, error)
				set.status = 500
				return {
					error: 'Internal server error',
					message: error instanceof Error ? error.message : String(error),
				}
			}
		},
	)
	.listen(parseInt(env.PORT), (server) => {
		const protocol = useHttps ? 'https' : 'http'
		console.log(
			`${getTimestamp()} ${useHttps ? '🔒' : '🚀'} Sentry Tunnel Server is running at ${protocol}://localhost:${env.PORT}`,
		)
		console.log(`${getTimestamp()} 🌍 Environment: ${env.ENV}`)

		console.log(
			`${getTimestamp()} 📋 Allowed Project IDs: ${ALLOWED_PROJECT_IDS.length > 0 ? ALLOWED_PROJECT_IDS.join(', ') : 'All'}`,
		)
		console.log(
			`${getTimestamp()} 🏢 Allowed Organization IDs: ${ALLOWED_ORGS.length > 0 ? ALLOWED_ORGS.join(', ') : 'All'}`,
		)
	})

export type App = typeof app

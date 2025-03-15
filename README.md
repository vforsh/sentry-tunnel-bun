# Sentry Tunnel for Bun

A lightweight and fast Sentry tunnel implementation using Bun and Elysia. This tunnel acts as a proxy between your client applications and Sentry's servers, helping to bypass ad-blockers that might block direct connections to Sentry.

## What is a Sentry Tunnel?

A tunnel is an HTTP endpoint that acts as a proxy between Sentry and your application. Because you control this server, there is no risk of any requests sent to it being blocked. When the endpoint lives under the same origin as your application, the browser will not treat any requests to the endpoint as third-party requests. As a result, these requests will have different security measures applied which, by default, don't trigger ad-blockers.

## Features

- Fast and lightweight implementation using Bun and Elysia
- Works with any Sentry host
- Configurable allowed project IDs
- Easy to deploy and maintain
- Minimal dependencies
- Detailed logging in development mode with timestamps and request IDs
- HTTPS support when SSL certificates are provided
- Built-in CORS support for handling preflight requests

## Prerequisites

- [Bun](https://bun.sh/) 1.2.2 or higher

## Configuration

The following environment variables can be configured:

- `ALLOWED_PROJECT_IDS`: Comma-separated list of allowed project IDs (leave empty to allow all)
- `PORT`: Port to listen on (default: `3010`)
- `NODE_ENV`: Environment mode (`development`, `production`, or `test`, default: `development`)
- `SSL_CERT_PATH`: Path to SSL certificate file (optional, enables HTTPS when provided)
- `SSL_KEY_PATH`: Path to SSL key file (optional, enables HTTPS when provided)

## Usage

### Starting the Server

```bash
bun start
```

The server will start on the configured port (default: 3010) using either HTTP or HTTPS based on the availability of SSL certificates.

### Development Mode Logging

When running in development mode, the server outputs detailed logs about each request and response, which is helpful for debugging. Each log entry includes:

- ISO and local timestamps for precise timing information
- Unique request ID for tracking a request through its lifecycle
- Detailed information about the request processing stages

Example log output:
```
2023-07-15T12:34:56.789Z [12:34:56 PM] [DEV] [a1b2c3d4] Received request to tunnel endpoint
2023-07-15T12:34:56.790Z [12:34:56 PM] [DEV] [a1b2c3d4] Envelope has 2 pieces
2023-07-15T12:34:56.791Z [12:34:56 PM] [DEV] [a1b2c3d4] Forwarding to Sentry URL: https://o0.ingest.sentry.io/api/12345/envelope/?sentry_key=abcdef
2023-07-15T12:34:56.900Z [12:34:56 PM] [DEV] [a1b2c3d4] Received response from Sentry with status: 200 (took 109ms)
2023-07-15T12:34:56.901Z [12:34:56 PM] [DEV] [a1b2c3d4] Request completed successfully
```

### Client-Side Configuration

In your client application, configure Sentry to use the tunnel:

```javascript
import * as Sentry from '@sentry/browser';

Sentry.init({
  dsn: 'https://your-dsn@o0.ingest.sentry.io/your-project-id',
  tunnel: 'https://your-server.com/tunnel', // URL to your tunnel endpoint
  // other Sentry configuration options...
});
```

## How It Works

1. Your client application sends Sentry events to your tunnel endpoint instead of directly to Sentry.
2. The tunnel server receives the events, validates them, and forwards them to the actual Sentry server.
3. The tunnel server returns the response from Sentry back to your client application.

## Security Considerations

- The tunnel server should be properly secured, as it acts as a proxy for your Sentry events.
- Use HTTPS in production environments by providing valid SSL certificates.
- Use the `ALLOWED_PROJECT_IDS` environment variable to restrict which projects can be used with your tunnel.
- In production, consider placing the tunnel behind a reverse proxy (like Nginx or Cloudflare) for additional security.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 
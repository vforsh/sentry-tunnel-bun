import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
	/**
	 * The prefix that client-side variables must have. This is enforced both at
	 * a type-level and at runtime.
	 */
	clientPrefix: '',

	client: {
		ALLOWED_PROJECT_IDS: z.string().default(''),
		ALLOWED_ORGS: z.string().default(''),
		PORT: z.string().default('3010'),
		ENV: z.enum(['development', 'production', 'test']).default('development'),
		SSL_CERT_PATH: z.string().optional(),
		SSL_KEY_PATH: z.string().optional(),
	},

	/**
	 * What object holds the environment variables at runtime. This is usually
	 * `process.env` or `import.meta.env`.
	 */
	runtimeEnv: process.env,

	/**
	 * By default, this library will feed the environment variables directly to
	 * the Zod validator.
	 *
	 * This means that if you have an empty string for a value that is supposed
	 * to be a number (e.g. `PORT=` in a ".env" file), Zod will incorrectly flag
	 * it as a type mismatch violation. Additionally, if you have an empty string
	 * for a value that is supposed to be a string with a default value (e.g.
	 * `DOMAIN=` in an ".env" file), the default value will never be applied.
	 *
	 * In order to solve these issues, we recommend that all new projects
	 * explicitly specify this option as true.
	 */
	emptyStringAsUndefined: true,
})

#!/usr/bin/env bun

import { execSync } from 'child_process'
import { existsSync, readFileSync } from 'fs'

// Configuration
const ENV_FILE = '.env.prod'
const DOKKU_REMOTE = 'dokku'
const BRANCH = 'main'

// Main function
async function main() {
	console.log(`Starting deployment process...`)

	// Step 1: Backup current environment variables (in memory only)
	console.log('Backing up current environment variables...')
	let currentEnvVars
	try {
		const output = execSync(`dokku config:export`, {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'pipe'],
		})

		// Parse the output to get current env vars
		currentEnvVars = parseExportFormat(output)
		console.log('Environment backup created in memory')
		console.log(`Backed up ${Object.keys(currentEnvVars).length} environment variables`)
	} catch (error) {
		console.error(`Error backing up environment variables: ${error.message}`)
		console.error('Continuing without backup (no rollback will be possible)')
	}

	// Step 2: Read and set new environment variables
	if (!existsSync(ENV_FILE)) {
		console.error(`Error: ${ENV_FILE} file not found!`)
		process.exit(1)
	}

	// Read .env.prod file
	const envContent = readFileSync(ENV_FILE, 'utf-8')
	const envLines = envContent.split('\n')

	// Build a single config:set command with all variables
	const newEnvVars: string[] = []
	const envKeys: string[] = []

	for (const line of envLines) {
		// Skip comments and empty lines
		if (line.trim() === '' || line.trim().startsWith('#')) {
			continue
		}

		// Extract key and value
		const [key, ...valueParts] = line.split('=')
		const value = valueParts.join('=') // Rejoin in case value contains = characters

		if (key && value !== undefined) {
			const trimmedKey = key.trim()
			// Use the escape function for the value
			newEnvVars.push(`${trimmedKey}=${escapeEnvValue(value.trim())}`)
			envKeys.push(trimmedKey)
		}
	}

	if (newEnvVars.length === 0) {
		console.warn('No environment variables found in .env.prod')
	} else {
		// Set all environment variables in a single command
		try {
			console.log(`Setting ${newEnvVars.length} environment variables...`)
			console.log('Environment variables being set:')
			envKeys.forEach((key) => console.log(`- ${key}`))

			// Build the command
			const configSetCmd = `dokku config:set --no-restart ${newEnvVars.join(' ')}`

			// Execute the command
			execSync(configSetCmd, {
				stdio: ['ignore', 'pipe', 'pipe'],
			})

			console.log('Environment variables set successfully.')
		} catch (error) {
			console.error(`Error setting environment variables: ${error.message}`)
			await rollbackEnv(currentEnvVars)
			process.exit(1)
		}
	}

	// Step 3: Deploy the app
	console.log('Deploying app...')
	try {
		execSync(`git push ${DOKKU_REMOTE} ${BRANCH}`, { stdio: 'inherit' })
		console.log('Deployment successful!')
	} catch (error) {
		console.error(`Deployment failed: ${error.message}`)
		console.log('Rolling back environment variables to previous state...')
		await rollbackEnv(currentEnvVars)
		process.exit(1)
	}
}

// Helper function to escape environment variable values
// Based on Dokku documentation: https://dokku.com/docs/configuration/environment-variables/
function escapeEnvValue(value: string): string {
	// If the value contains spaces, newlines, or special characters, wrap it in single quotes
	// and escape any existing single quotes
	if (/[\s\n\r\t'"\\$&|<>^;()!]/.test(value)) {
		// Escape single quotes by replacing ' with '\''
		const escapedValue = value.replace(/'/g, "'\\''")
		return `'${escapedValue}'`
	}
	return value
}

// Helper function to parse export format from dokku config:export
function parseExportFormat(exportOutput: string): Record<string, string> {
	const result: Record<string, string> = {}
	const lines = exportOutput.split('\n')

	for (const line of lines) {
		// Match lines like: export KEY='VALUE'
		const match = line.match(/export\s+([^=]+)=['"]?(.*?)['"]?$/)
		if (match && match.length >= 3) {
			const key = match[1].trim()
			const value = match[2].trim()
			result[key] = value
		}
	}

	return result
}

// Helper function to rollback environment variables
async function rollbackEnv(backupEnvVars: Record<string, string> | undefined) {
	if (!backupEnvVars) {
		console.error('No backup available for rollback')
		return
	}

	try {
		console.log('Rolling back to previous environment variables...')
		console.log('Rolling back the following environment variables:')
		Object.keys(backupEnvVars).forEach((key) => console.log(`- ${key}`))

		// Format env vars for dokku command with proper escaping
		const envVarArgs = Object.entries(backupEnvVars)
			.map(([key, value]) => `${key}=${escapeEnvValue(value)}`)
			.join(' ')

		// Build the rollback command
		const rollbackCmd = `dokku config:set ${envVarArgs}`

		// Execute the rollback command
		execSync(rollbackCmd, {
			stdio: ['ignore', 'pipe', 'pipe'],
		})

		console.log('Environment variables rolled back successfully')
	} catch (error) {
		console.error(`Error rolling back environment variables: ${error.message}`)
		console.error('You may need to manually restore the environment variables')
	}
}

// Run the script
main().catch((error) => {
	console.error('Unhandled error:', error.message)
	process.exit(1)
})

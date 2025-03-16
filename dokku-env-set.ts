#!/usr/bin/env bun

/**
 * Dokku Environment Variable Setter
 *
 * This script reads environment variables from a local .env file
 * and sets them in a Dokku application via SSH.
 *
 * Usage:
 *   bun run dokku-env-set.ts [--file=.env.prod] [--no-restart] [--ssh-host=dokku@example.com] [<app-name>]
 */

import { spawn } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import prompts from 'prompts'

// Parse command line arguments
interface Args {
	file: string
	noRestart: boolean
	appName: string
	sshHost: string
}

function parseArgs(): Args {
	const args = process.argv.slice(2)
	let file = '.env.prod'
	let noRestart = false
	let appName = ''
	let sshHost = ''

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]

		if (arg.startsWith('--file=')) {
			file = arg.substring('--file='.length)
		} else if (arg === '--no-restart') {
			noRestart = true
		} else if (arg.startsWith('--ssh-host=')) {
			sshHost = arg.substring('--ssh-host='.length)
		} else if (!arg.startsWith('--')) {
			appName = arg
		}
	}

	return { file, noRestart, appName, sshHost }
}

// Parse .env file content
function parseEnvFile(content: string): Record<string, string> {
	const result: Record<string, string> = {}
	const lines = content.split('\n')

	for (const line of lines) {
		// Skip comments and empty lines
		if (line.trim().startsWith('#') || line.trim() === '') {
			continue
		}

		// Find the first equals sign (handling values that may contain equals signs)
		const equalsIndex = line.indexOf('=')
		if (equalsIndex > 0) {
			const key = line.substring(0, equalsIndex).trim()
			let value = line.substring(equalsIndex + 1).trim()

			// Handle quoted values
			if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
				value = value.substring(1, value.length - 1)
			}

			result[key] = value
		}
	}

	return result
}

// Execute dokku command via SSH
async function executeDokkuCommand(
	appName: string,
	envVars: Record<string, string>,
	noRestart: boolean,
	sshHost: string,
): Promise<void> {
	// SSH command format
	const command = 'ssh'
	const args = ['-t', sshHost]

	// Build the dokku command as a single string for SSH
	let dokkuCmd = 'config:set'
	if (noRestart) {
		dokkuCmd += ' --no-restart'
	}
	dokkuCmd += ` ${appName}`

	// Add environment variables
	for (const [key, value] of Object.entries(envVars)) {
		// Escape special characters for SSH
		const escapedValue = value.replace(/"/g, '\\"')
		dokkuCmd += ` ${key}=${escapedValue}`
	}

	args.push(dokkuCmd)

	console.log(`\nExecuting: ssh -t ${sshHost} config:set ${appName} [...]`)

	return new Promise((resolve, reject) => {
		const proc = spawn(command, args)

		let output = ''
		let errorOutput = ''

		proc.stdout?.on('data', (data) => {
			output += data.toString()
			process.stdout.write(data)
		})

		proc.stderr?.on('data', (data) => {
			errorOutput += data.toString()
			process.stderr.write(data)
		})

		proc.on('close', (code) => {
			if (code === 0) {
				console.log('\nEnvironment variables set successfully!')
				resolve()
			} else {
				console.error(`\nFailed to set environment variables. Exit code: ${code}`)
				reject(new Error(errorOutput || 'Unknown error'))
			}
		})
	})
}

// Main function
async function main() {
	try {
		// Parse arguments
		let { file, noRestart, appName, sshHost } = parseArgs()

		// Prompt for missing information
		const questions: prompts.PromptObject[] = []

		if (!appName) {
			questions.push({
				type: 'text',
				name: 'appName',
				message: 'Enter the Dokku application name:',
				validate: (value: string) => value.trim() ? true : 'Application name is required'
			})
		}

		if (!sshHost) {
			questions.push({
				type: 'text',
				name: 'sshHost',
				message: 'Enter the SSH host (e.g., dokku@example.com):',
				validate: (value: string) => value.trim() ? true : 'SSH host is required'
			})
		}

		// Only prompt if there are questions to ask
		if (questions.length > 0) {
			const response = await prompts(questions)
			
			// Handle user cancellation (Ctrl+C)
			if (!response.appName && !appName) {
				console.error('Error: No application name provided')
				process.exit(1)
			}
			
			if (!response.sshHost && !sshHost) {
				console.error('Error: No SSH host provided')
				process.exit(1)
			}
			
			// Update values from prompts
			appName = appName || response.appName
			sshHost = sshHost || response.sshHost
		}

		// Check if file exists
		if (!existsSync(file)) {
			console.error(`Error: Environment file '${file}' not found`)
			process.exit(1)
		}

		console.log(`Reading environment variables from: ${file}`)

		// Read and parse .env file
		const fileContent = readFileSync(file, 'utf-8')
		const envVars = parseEnvFile(fileContent)

		// Validate environment variables
		const varCount = Object.keys(envVars).length
		if (varCount === 0) {
			console.error(`Error: No environment variables found in '${file}'`)
			process.exit(1)
		}

		console.log(`Found ${varCount} environment variables to set for app '${appName}'`)

		// List keys (but not values for security)
		console.log('Variables to set:')
		for (const key of Object.keys(envVars)) {
			console.log(`  - ${key}`)
		}

		// Execute dokku command
		await executeDokkuCommand(appName, envVars, noRestart, sshHost)
	} catch (error) {
		console.error('Error:', error.message)
		process.exit(1)
	}
}

// Run the script
main()

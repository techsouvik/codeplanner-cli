# CodePlanner CLI - Quick Start Guide

## 🚀 Get Started in 5 Minutes

CodePlanner CLI is an AI-powered tool that helps you generate implementation plans and debug errors in your TypeScript/JavaScript projects.

## Prerequisites

- **Bun** >= 1.0 ([Install Bun](https://bun.sh/docs/installation))
- **Docker** ([Install Docker](https://docs.docker.com/get-docker/))
- **OpenAI API Key** ([Get API Key](https://platform.openai.com/api-keys))

## Setup (5 minutes)

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

```bash
# Copy the example environment file
cp env.example .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 3. Start Redis

```bash
# Start Redis using Docker Compose
bun run docker:up
```

### 4. Start Services

You'll need to run these in separate terminals:

**Terminal 1 - WebSocket Gateway:**
```bash
bun run dev:gateway
```

**Terminal 2 - CodePlanner Engine:**
```bash
bun run dev:worker
```

**Terminal 3 - CLI Commands:**
```bash
# Use the CLI here
bun run cli
```

## Usage

### Index Your Codebase

First, index your project so CodePlanner can understand your code:

```bash
bun run cli index -p ./your-project
```

### Generate Implementation Plans

Ask CodePlanner to create a plan for implementing features:

```bash
bun run cli plan "Add user authentication with JWT" -p ./your-project
```

### Analyze Errors

Get debugging help for errors:

```bash
bun run cli analyze-error -t compiler -p ./your-project
# Then paste your error when prompted
```

## Example Workflow

```bash
# 1. Index your codebase
bun run cli index -p examples/sample-project

# 2. Generate a plan
bun run cli plan "Add email validation to User interface" -p examples/sample-project

# 3. Analyze an error
echo "src/index.ts(5,10): error TS2339: Property 'email' does not exist on type 'User'" | \
  bun run cli analyze-error -t compiler -p examples/sample-project
```

## Testing

Run the complete test suite:

```bash
# Make sure you have OPENAI_API_KEY set
export OPENAI_API_KEY="your-api-key-here"

# Run the test flow
bun run test:flow
```

## Commands Reference

### `index`
Index your codebase for semantic search and planning.

```bash
bun run cli index [options]
```

**Options:**
- `-p, --project <path>` - Path to your project directory (default: `./`)

### `plan`
Generate an implementation plan for your query.

```bash
bun run cli plan <query> [options]
```

**Arguments:**
- `<query>` - Your planning query (e.g., "Add user authentication")

**Options:**
- `-p, --project <path>` - Path to your project directory (default: `./`)

### `analyze-error`
Analyze an error and generate debugging steps.

```bash
bun run cli analyze-error [options]
```

**Options:**
- `-e, --error <input>` - Error input text (if not provided, will read from stdin)
- `-t, --type <type>` - Type of error (compiler, runtime, linter) (default: `runtime`)
- `-p, --project <path>` - Path to your project directory (default: `./`)

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `WS_PORT` | WebSocket gateway port | `3000` |

### Configuration File

Create a `.codeplannerrc` file in your project root:

```json
{
  "openaiApiKey": "sk-your-api-key-here",
  "endpoint": "ws://localhost:3000",
  "embeddingModel": "text-embedding-3-small",
  "planningModel": "gpt-4-turbo-preview",
  "userId": "user1",
  "projectId": "my-project"
}
```

## Troubleshooting

### Redis Connection Issues

```bash
# Check if Redis is running
docker-compose -f docker/docker-compose.yml ps

# Restart Redis if needed
bun run docker:down
bun run docker:up
```

### OpenAI API Issues

- Verify your API key is correct
- Check your OpenAI account has sufficient credits
- Ensure you have access to the required models

### WebSocket Connection Issues

- Make sure the gateway is running on port 3000
- Check firewall settings
- Verify no other service is using port 3000

### TypeScript Parsing Issues

- Ensure `tsconfig.json` exists in your project
- Check file paths are correct
- Verify TypeScript files are valid

## Next Steps

- Try CodePlanner with your own projects
- Customize the configuration for your needs
- Integrate with your development workflow
- Check out the full documentation in `README.md`

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review the logs from the gateway and worker processes
3. Ensure all prerequisites are installed correctly
4. Verify your OpenAI API key and credits

Happy coding with CodePlanner! 🎉

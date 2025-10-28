# CodePlanner CLI - Docker Setup

This guide shows you how to run CodePlanner CLI using Docker Compose for a complete containerized setup.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- OpenAI API Key

### 1. Setup Environment

```bash
# Copy the environment template
cp docker/docker.env .env

# Edit .env and add your OpenAI API key
# OPENAI_API_KEY=sk-your-actual-api-key-here
```

### 2. Start All Services

```bash
# Use the startup script (recommended)
./docker/start-codeplanner.sh

# Or start manually
docker-compose -f docker/docker-compose.yml up -d
```

### 3. Use the CLI

```bash
# Interactive CLI session
docker-compose -f docker/docker-compose.yml exec cli bash

# Direct commands
docker-compose -f docker/docker-compose.yml exec cli bun packages/cli/src/index.ts index -p examples/sample-project
```

## 📋 Available Services

| Service | Port | Description |
|---------|------|-------------|
| Redis | 6379 | Message queuing and vector storage |
| Gateway | 3000 | WebSocket gateway for real-time communication |
| Engine | - | Background worker for processing jobs |
| CLI | - | Interactive command-line interface |

## 🔧 Usage Examples

### Index Your Codebase

```bash
# Index the sample project
docker-compose -f docker/docker-compose.yml exec cli \
  bun packages/cli/src/index.ts index -p examples/sample-project

# Index your own project (mount it first)
docker-compose -f docker/docker-compose.yml exec cli \
  bun packages/cli/src/index.ts index -p /workspace/your-project
```

### Generate Implementation Plans

```bash
# Generate a plan
docker-compose -f docker/docker-compose.yml exec cli \
  bun packages/cli/src/index.ts plan "Add user authentication with JWT" -p examples/sample-project
```

### Analyze Errors

```bash
# Analyze a compiler error
echo "src/index.ts(5,10): error TS2339: Property 'email' does not exist on type 'User'" | \
  docker-compose -f docker/docker-compose.yml exec -T cli \
  bun packages/cli/src/index.ts analyze-error -t compiler -p examples/sample-project
```

## 🛠️ Development Mode

For development with live code changes:

```bash
# Use the override file for development
docker-compose -f docker/docker-compose.yml -f docker/docker-compose.override.yml up -d
```

## 📊 Monitoring

### View Logs

```bash
# All services
docker-compose -f docker/docker-compose.yml logs -f

# Specific service
docker-compose -f docker/docker-compose.yml logs -f gateway
docker-compose -f docker/docker-compose.yml logs -f engine
```

### Health Checks

```bash
# Check service status
docker-compose -f docker/docker-compose.yml ps

# Check gateway health
curl http://localhost:3000/health

# Check Redis
docker-compose -f docker/docker-compose.yml exec redis redis-cli ping
```

## 🔄 Common Operations

### Restart Services

```bash
# Restart all services
docker-compose -f docker/docker-compose.yml restart

# Restart specific service
docker-compose -f docker/docker-compose.yml restart engine
```

### Update Code

```bash
# Rebuild and restart after code changes
docker-compose -f docker/docker-compose.yml up -d --build
```

### Clean Up

```bash
# Stop all services
docker-compose -f docker/docker-compose.yml down

# Stop and remove volumes (clears Redis data)
docker-compose -f docker/docker-compose.yml down -v

# Remove all containers and images
docker-compose -f docker/docker-compose.yml down --rmi all
```

## 🐛 Troubleshooting

### Services Won't Start

1. **Check environment variables:**
   ```bash
   cat .env
   # Ensure OPENAI_API_KEY is set correctly
   ```

2. **Check Docker logs:**
   ```bash
   docker-compose -f docker/docker-compose.yml logs
   ```

3. **Check port conflicts:**
   ```bash
   # Check if ports 3000 or 6379 are in use
   lsof -i :3000
   lsof -i :6379
   ```

### CLI Connection Issues

1. **Check gateway is running:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Check Redis connection:**
   ```bash
   docker-compose -f docker/docker-compose.yml exec redis redis-cli ping
   ```

3. **Restart services:**
   ```bash
   docker-compose -f docker/docker-compose.yml restart
   ```

### Memory Issues

If you encounter memory issues with the engine:

```bash
# Increase Docker memory limit
# Or restart the engine service
docker-compose -f docker/docker-compose.yml restart engine
```

## 📁 Project Structure in Docker

```
/workspace/                    # Your project files
/app/packages/                 # CodePlanner packages
  ├── cli/                    # CLI package
  ├── gateway/                # Gateway package
  ├── engine/                 # Engine package
  └── shared/                 # Shared types
/app/examples/                # Example projects
```

## 🔐 Security Notes

- The `.env` file contains sensitive information (API keys)
- Never commit `.env` files to version control
- Use Docker secrets for production deployments
- Consider using Docker networks for additional isolation

## 🚀 Production Deployment

For production deployment:

1. Use Docker secrets for API keys
2. Set up proper logging and monitoring
3. Use Docker Swarm or Kubernetes for orchestration
4. Configure proper resource limits
5. Set up health checks and auto-restart policies

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review Docker logs for error messages
3. Ensure all prerequisites are met
4. Verify your OpenAI API key is valid and has sufficient credits

---

**Happy coding with CodePlanner! 🎉**

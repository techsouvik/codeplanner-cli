#!/bin/bash

# CodePlanner Docker Startup Script
# This script starts all CodePlanner services and provides easy access to the CLI

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    print_warning "No .env file found. Creating from template..."
    cp docker/docker.env .env
    print_warning "Please edit .env file and add your OpenAI API key before continuing."
    print_warning "Required: OPENAI_API_KEY=sk-your-actual-api-key-here"
    exit 1
fi

# Check if OPENAI_API_KEY is set
if ! grep -q "OPENAI_API_KEY=sk-" .env || grep -q "OPENAI_API_KEY=sk-your-api-key-here" .env; then
    print_error "Please set your OpenAI API key in the .env file"
    print_error "Edit .env and set: OPENAI_API_KEY=sk-your-actual-api-key-here"
    exit 1
fi

print_status "Starting CodePlanner services..."

# Start all services
docker-compose -f docker/docker-compose.yml up -d

print_status "Waiting for services to be ready..."

# Wait for Redis to be healthy
print_status "Waiting for Redis..."
timeout=60
while [ $timeout -gt 0 ]; do
    if docker-compose -f docker/docker-compose.yml exec redis redis-cli ping > /dev/null 2>&1; then
        print_success "Redis is ready!"
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    print_error "Redis failed to start within 60 seconds"
    exit 1
fi

# Wait for Gateway to be healthy
print_status "Waiting for Gateway..."
timeout=60
while [ $timeout -gt 0 ]; do
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        print_success "Gateway is ready!"
        break
    fi
    sleep 2
    timeout=$((timeout - 2))
done

if [ $timeout -le 0 ]; then
    print_error "Gateway failed to start within 60 seconds"
    exit 1
fi

# Wait a bit for Engine to start
print_status "Waiting for Engine to start..."
sleep 5

print_success "All services are ready! 🎉"
echo ""
print_status "Available services:"
echo "  - Redis: localhost:6379"
echo "  - Gateway: localhost:3000"
echo "  - Engine: Running in background"
echo "  - CLI: Available via docker-compose exec"
echo ""

print_status "To use the CLI, run one of these commands:"
echo ""
echo "1. Interactive CLI session:"
echo "   docker-compose -f docker/docker-compose.yml exec cli bash"
echo ""
echo "2. Direct CLI commands:"
echo "   docker-compose -f docker/docker-compose.yml exec cli bun packages/cli/src/index.ts index -p examples/sample-project"
echo "   docker-compose -f docker/docker-compose.yml exec cli bun packages/cli/src/index.ts plan \"Add user authentication\" -p examples/sample-project"
echo "   docker-compose -f docker/docker-compose.yml exec cli bun packages/cli/src/index.ts analyze-error -t compiler -p examples/sample-project"
echo ""
echo "3. View logs:"
echo "   docker-compose -f docker/docker-compose.yml logs -f"
echo ""
echo "4. Stop services:"
echo "   docker-compose -f docker/docker-compose.yml down"
echo ""

# Check if user wants to start interactive session
read -p "Would you like to start an interactive CLI session now? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting interactive CLI session..."
    docker-compose -f docker/docker-compose.yml exec cli bash
fi

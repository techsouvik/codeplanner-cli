#!/bin/bash

# Docker Test Script for CodePlanner CLI
# This script tests the complete Docker setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
}

print_error() {
    echo -e "${RED}[FAIL]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo "🧪 Testing CodePlanner Docker Setup"
echo "===================================="

# Check if .env exists
if [ ! -f .env ]; then
    print_error ".env file not found. Please run ./docker/start-codeplanner.sh first"
    exit 1
fi

# Check if services are running
print_status "Checking if services are running..."

if ! docker-compose -f docker/docker-compose.yml ps | grep -q "Up"; then
    print_error "Services are not running. Please start them first:"
    echo "  ./docker/start-codeplanner.sh"
    exit 1
fi

print_success "Services are running"

# Test Redis connection
print_status "Testing Redis connection..."
if docker-compose -f docker/docker-compose.yml exec redis redis-cli ping | grep -q "PONG"; then
    print_success "Redis is responding"
else
    print_error "Redis is not responding"
    exit 1
fi

# Test Gateway health check
print_status "Testing Gateway health check..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_success "Gateway is healthy"
else
    print_error "Gateway health check failed"
    exit 1
fi

# Test CLI availability
print_status "Testing CLI availability..."
if docker-compose -f docker/docker-compose.yml exec cli bun --version > /dev/null 2>&1; then
    print_success "CLI container is ready"
else
    print_error "CLI container is not ready"
    exit 1
fi

# Test indexing
print_status "Testing codebase indexing..."
if docker-compose -f docker/docker-compose.yml exec cli \
   bun packages/cli/src/index.ts index -p examples/sample-project > /dev/null 2>&1; then
    print_success "Indexing test passed"
else
    print_warning "Indexing test failed (this might be expected if OpenAI API key is not set)"
fi

# Test plan generation (if API key is available)
print_status "Testing plan generation..."
if docker-compose -f docker/docker-compose.yml exec cli \
   bun packages/cli/src/index.ts plan "Add email validation" -p examples/sample-project > /dev/null 2>&1; then
    print_success "Plan generation test passed"
else
    print_warning "Plan generation test failed (this might be expected if OpenAI API key is not set)"
fi

echo ""
print_success "Docker setup test completed! 🎉"
echo ""
print_status "To use the CLI interactively:"
echo "  docker-compose -f docker/docker-compose.yml exec cli bash"
echo ""
print_status "To run specific commands:"
echo "  docker-compose -f docker/docker-compose.yml exec cli bun packages/cli/src/index.ts --help"
echo ""
print_status "To view logs:"
echo "  docker-compose -f docker/docker-compose.yml logs -f"

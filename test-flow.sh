#!/bin/bash

# CodePlanner CLI Test Flow Script
# This script tests the complete CodePlanner workflow from indexing to planning and error analysis

set -e  # Exit on any error

echo "🧪 Testing CodePlanner-CLI MVP"
echo "================================"

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

# Check if required environment variables are set
if [ -z "$OPENAI_API_KEY" ]; then
    print_error "OPENAI_API_KEY environment variable is required"
    print_status "Please set it with: export OPENAI_API_KEY='your-api-key-here'"
    exit 1
fi

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    print_error "Bun is not installed. Please install Bun first."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Starting Redis service..."
docker-compose -f docker/docker-compose.yml up -d

# Wait for Redis to be ready
print_status "Waiting for Redis to be ready..."
sleep 3

# Check if Redis is accessible
if ! docker exec $(docker-compose -f docker/docker-compose.yml ps -q redis) redis-cli ping | grep -q PONG; then
    print_error "Redis is not responding. Please check Docker logs."
    exit 1
fi

print_success "Redis is ready!"

# Install dependencies
print_status "Installing dependencies..."
bun install

# Start gateway in background
print_status "Starting WebSocket Gateway..."
bun packages/gateway/src/server.ts &
GATEWAY_PID=$!

# Wait for gateway to start
sleep 2

# Start worker in background
print_status "Starting CodePlanner Engine..."
bun packages/engine/src/worker.ts &
WORKER_PID=$!

# Wait for worker to start
sleep 3

# Test 1: Indexing codebase
echo ""
print_status "Test 1: Indexing codebase..."
echo "----------------------------------------"

if bun packages/cli/src/index.ts index -p examples/sample-project; then
    print_success "Indexing test passed!"
else
    print_error "Indexing test failed!"
    cleanup_and_exit 1
fi

sleep 5

# Test 2: Generate plan
echo ""
print_status "Test 2: Generate implementation plan..."
echo "----------------------------------------"

if echo "Add email validation to User interface" | bun packages/cli/src/index.ts plan -p examples/sample-project; then
    print_success "Plan generation test passed!"
else
    print_error "Plan generation test failed!"
    cleanup_and_exit 1
fi

sleep 5

# Test 3: Analyze error
echo ""
print_status "Test 3: Analyze error..."
echo "----------------------------------------"

# Create a test error
TEST_ERROR="src/index.ts(5,10): error TS2339: Property 'email' does not exist on type 'User'"

if echo "$TEST_ERROR" | bun packages/cli/src/index.ts analyze-error -t compiler -p examples/sample-project; then
    print_success "Error analysis test passed!"
else
    print_error "Error analysis test failed!"
    cleanup_and_exit 1
fi

# Cleanup function
cleanup_and_exit() {
    local exit_code=$1
    
    echo ""
    print_status "Cleaning up..."
    
    # Kill background processes
    if [ ! -z "$GATEWAY_PID" ]; then
        kill $GATEWAY_PID 2>/dev/null || true
    fi
    
    if [ ! -z "$WORKER_PID" ]; then
        kill $WORKER_PID 2>/dev/null || true
    fi
    
    # Stop Docker services
    docker-compose -f docker/docker-compose.yml down
    
    if [ $exit_code -eq 0 ]; then
        print_success "All tests completed successfully! 🎉"
    else
        print_error "Some tests failed. Check the output above for details."
    fi
    
    exit $exit_code
}

# Wait a bit before cleanup
sleep 2

# Run cleanup
cleanup_and_exit 0

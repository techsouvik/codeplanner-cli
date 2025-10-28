# CodePlanner CLI

> AI-powered code planning and error analysis for TypeScript/JavaScript projects

CodePlanner CLI is an intelligent development tool that uses AI to help you plan implementations and debug errors in your codebase. It combines AST parsing, semantic search, and LLM-powered analysis to provide actionable insights and step-by-step guidance.

## ✨ Features

- **🧠 AI-Powered Planning**: Generate detailed implementation plans based on your codebase context
- **🐛 Intelligent Error Analysis**: Get step-by-step debugging guidance for compiler, runtime, and linter errors
- **📚 Semantic Code Indexing**: Index your codebase for intelligent code search and context understanding
- **⚡ Real-time Streaming**: Get responses streamed in real-time for better user experience
- **🔍 Context-Aware**: Uses your actual codebase to provide relevant suggestions and examples

## 🏗️ Architecture

CodePlanner CLI is built with a modular architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CLI Client    │    │  WebSocket      │    │  CodePlanner    │
│                 │◄──►│  Gateway        │◄──►│  Engine         │
│  - plan         │    │                 │    │                 │
│  - analyze-error│    │  - Message      │    │  - AST Parser   │
│  - index        │    │    Routing      │    │  - Embeddings   │
└─────────────────┘    └─────────────────┘    │  - Vector Store │
                                              │  - Plan Gen     │
                                              │  - Error Analysis│
                                              └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │     Redis       │
                                              │                 │
                                              │  - Job Queue    │
                                              │  - Vector Store │
                                              │  - Pub/Sub      │
                                              └─────────────────┘
```

### Components

- **CLI Client**: Command-line interface for user interactions
- **WebSocket Gateway**: Real-time communication hub
- **CodePlanner Engine**: Core processing engine with AST parsing, embeddings, and LLM integration
- **Redis**: Message broker and vector storage backend

## 🚀 Quick Start

### Option 1: Docker (Recommended)

**Prerequisites:**
- Docker and Docker Compose
- OpenAI API Key

**Setup:**
```bash
# Clone the repository
git clone <repository-url>
cd codeplanner-cli

# Setup environment
cp docker/docker.env .env
# Edit .env and add your OpenAI API key

# Start all services
./docker/start-codeplanner.sh

# Use the CLI
docker-compose -f docker/docker-compose.yml exec cli bash
```

**Quick Commands:**
```bash
# Index codebase
docker-compose -f docker/docker-compose.yml exec cli \
  bun packages/cli/src/index.ts index -p examples/sample-project

# Generate plan
docker-compose -f docker/docker-compose.yml exec cli \
  bun packages/cli/src/index.ts plan "Add user authentication" -p examples/sample-project
```

📖 **See [DOCKER.md](DOCKER.md) for complete Docker setup guide**

### Option 2: Local Development

**Prerequisites:**
- [Bun](https://bun.sh/) >= 1.0
- [Docker](https://docs.docker.com/get-docker/)
- [OpenAI API Key](https://platform.openai.com/api-keys)

**Setup:**
```bash
# Clone and install dependencies
git clone <repository-url>
cd codeplanner-cli
bun install

# Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key

# Start services
bun run docker:up
bun run dev:gateway  # Terminal 1
bun run dev:worker   # Terminal 2

# Use the CLI
bun run cli index -p ./your-project
bun run cli plan "Add user authentication" -p ./your-project
```

## 📖 Usage

### Indexing Your Codebase

Before using planning or error analysis, index your codebase:

```bash
bun run cli index -p ./your-project
```

This will:
- Parse your TypeScript/JavaScript files using AST analysis
- Extract functions, classes, and interfaces
- Generate embeddings for semantic search
- Store everything in Redis for fast retrieval

### Generating Implementation Plans

Create detailed implementation plans for new features:

```bash
bun run cli plan "Add JWT authentication middleware" -p ./your-project
```

The plan will include:
- High-level architecture overview
- Step-by-step implementation instructions
- Code examples and file changes
- Testing strategies
- Potential challenges and solutions

### Analyzing Errors

Get intelligent debugging help for various error types:

```bash
# Compiler errors
bun run cli analyze-error -t compiler -p ./your-project
# Then paste your TypeScript error

# Runtime errors
bun run cli analyze-error -t runtime -p ./your-project
# Then paste your stack trace

# Linter errors
bun run cli analyze-error -t linter -p ./your-project
# Then paste your linter output
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | Required |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `WS_PORT` | WebSocket gateway port | `3000` |
| `EMBEDDING_MODEL` | OpenAI embedding model | `text-embedding-3-small` |
| `PLANNING_MODEL` | OpenAI planning model | `gpt-4-turbo-preview` |

### Configuration File

Create a `.codeplannerrc` file in your project root:

```json
{
  "openaiApiKey": "sk-your-api-key-here",
  "endpoint": "ws://localhost:3000",
  "embeddingModel": "text-embedding-3-small",
  "planningModel": "gpt-4-turbo-preview",
  "userId": "user1",
  "projectId": "my-project",
  "maxContextChunks": 15,
  "batchSize": 20,
  "temperature": 0.3
}
```

## 🧪 Testing

Run the complete test suite:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY="your-api-key-here"

# Run the test flow
bun run test:flow
```

This will test:
- Codebase indexing
- Plan generation
- Error analysis
- End-to-end workflow

## 📁 Project Structure

```
codeplanner-cli/
├── packages/
│   ├── cli/                    # CLI frontend
│   │   ├── src/
│   │   │   ├── commands/       # CLI commands
│   │   │   ├── client/         # WebSocket client
│   │   │   └── utils/          # Utilities
│   │   └── package.json
│   │
│   ├── gateway/                # WebSocket gateway
│   │   ├── src/
│   │   │   ├── server.ts       # WebSocket server
│   │   │   ├── redis.ts        # Redis client
│   │   │   └── types.ts        # Gateway types
│   │   └── package.json
│   │
│   ├── engine/                 # CodePlanner engine
│   │   ├── src/
│   │   │   ├── parser/         # AST parsing
│   │   │   ├── embeddings/     # Embedding generation
│   │   │   ├── vector-store/   # Vector storage
│   │   │   ├── planner/        # Plan generation
│   │   │   ├── error-analysis/ # Error analysis
│   │   │   └── worker.ts       # Main worker
│   │   └── package.json
│   │
│   └── shared/                 # Shared types
│       ├── src/types.ts
│       └── package.json
│
├── examples/
│   └── sample-project/         # Test project
│
├── docker/
│   └── docker-compose.yml      # Redis service
│
├── test-flow.sh                # Test script
├── .codeplannerrc.example      # Config template
├── env.example                 # Environment template
├── QUICKSTART.md               # Quick start guide
└── README.md                   # This file
```

## 🔍 How It Works

### 1. Code Analysis
- Uses `ts-morph` to parse TypeScript/JavaScript files
- Extracts functions, classes, interfaces, and types
- Chunks large files for better embedding quality

### 2. Semantic Search
- Generates embeddings using OpenAI's `text-embedding-3-small`
- Stores vectors in Redis for fast similarity search
- Finds relevant code based on semantic meaning, not just keywords

### 3. AI-Powered Planning
- Uses GPT-4 to generate implementation plans
- Considers your actual codebase context
- Provides specific, actionable steps with code examples

### 4. Intelligent Error Analysis
- Parses various error types (compiler, runtime, linter)
- Uses semantic search to find related code
- Generates step-by-step debugging plans with fixes

## 🚧 Current Limitations (MVP)

- Single user mode (no authentication)
- Basic vector search (cosine similarity)
- Full reindexing only (no incremental updates)
- Limited error type support
- No caching (every request hits LLM)
- CLI-only interface

## 🛣️ Roadmap

### Phase 1 (Current)
- ✅ Core MVP with basic functionality
- ✅ AST parsing and embeddings
- ✅ Plan generation and error analysis
- ✅ CLI interface

### Phase 2 (Future)
- 🔄 Redis Vector Sets for better search
- 🔄 Incremental indexing with file watchers
- 🔄 Multi-language support (Python, Go, etc.)
- 🔄 VS Code extension
- 🔄 Team collaboration features

### Phase 3 (Future)
- 🔄 Cost tracking dashboard
- 🔄 Custom model support
- 🔄 Integration with CI/CD pipelines
- 🔄 Advanced analytics and insights

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details.

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Running in Development

```bash
# Install dependencies
bun install

# Start all services in development mode
bun run dev:gateway  # Terminal 1
bun run dev:worker   # Terminal 2
bun run dev:cli      # Terminal 3
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for providing the AI models
- [ts-morph](https://ts-morph.com/) for TypeScript AST manipulation
- [Bun](https://bun.sh/) for the fast JavaScript runtime
- [Redis](https://redis.io/) for vector storage and message queuing

## 📞 Support

- 📖 [Documentation](QUICKSTART.md)
- 🐛 [Issue Tracker](https://github.com/your-org/codeplanner-cli/issues)
- 💬 [Discussions](https://github.com/your-org/codeplanner-cli/discussions)

---

**Happy coding with CodePlanner! 🎉**

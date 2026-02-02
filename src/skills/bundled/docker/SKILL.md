---
name: docker
description: Docker container management - build, run, compose
user-invocable: true
metadata:
  openclaw:
    emoji: "\U0001F433"
    requires:
      bins: [docker]
---

# Docker Skill

Help the user with Docker container operations.

## Capabilities

- **Containers**: Run, stop, list, remove containers
- **Images**: Build, pull, push, list images
- **Compose**: Manage multi-container applications
- **Networks**: Create and manage Docker networks
- **Volumes**: Manage persistent data storage
- **Logs**: View container logs and debugging

## Guidelines

1. Always check running containers with `docker ps` first
2. Use meaningful names for containers and images
3. Clean up unused resources with `docker system prune`
4. Use docker-compose for multi-container setups
5. Check logs when containers fail to start

## Common Commands

```bash
docker ps                     # List running containers
docker ps -a                  # List all containers
docker images                 # List images
docker run -d image           # Run container detached
docker stop container         # Stop a container
docker rm container           # Remove a container
docker logs container         # View container logs
docker exec -it container sh  # Shell into container
docker build -t name .        # Build image from Dockerfile
docker-compose up -d          # Start compose services
docker-compose down           # Stop compose services
docker system prune -a        # Clean up everything
```

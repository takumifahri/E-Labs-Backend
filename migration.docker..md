# Docker Documentation - E-Labs Backend

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- Git

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd backend-takumifahri
```

### 2. Start Services
```bash
# Start all services
docker-compose up -d

# Check services status
docker-compose ps
```

### 3. Database Setup
```bash
# Generate Prisma client
docker-compose exec app npm run generate

# Run database migration
docker-compose exec app npm run migrate

# (Optional) Seed database for development
docker-compose exec app npm run seed
```

### 4. Verify Installation
```bash
# Check application logs
docker-compose logs -f app

# Test API endpoint
curl http://202.10.36.217:3333/api/health
```

## 📁 Project Structure

```
backend-takumifahri/
├── docker-compose.yml          # Docker services configuration
├── Dockerfile                  # App container build instructions
├── migration.docker.md         # Database migration guide
├── src/                        # Application source code
├── prisma/                     # Database schema & migrations
└── package.json               # Node.js dependencies
```

## 🐳 Docker Services

### App Service
- **Image**: Custom built from Node.js 18 Alpine
- **Port**: 3333
- **Environment**: Production
- **Volumes**: Source code, storage, node_modules

### Database Service
- **Image**: PostgreSQL 15 Alpine
- **Port**: 5432
- **Database**: manpro
- **Credentials**: postgres/postgres
- **Storage**: Persistent volume

## 🔧 Available Commands

### Service Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f [service_name]

# Check service status
docker-compose ps
```

### Database Operations
```bash
# Generate Prisma client
docker-compose exec app npm run generate

# Run migrations
docker-compose exec app npm run migrate

# Access database directly
docker-compose exec db psql -U postgres -d manpro

# Database backup
docker-compose exec db pg_dump -U postgres manpro > backup.sql

# Database restore
docker-compose exec -i db psql -U postgres manpro < backup.sql
```

### Development Commands
```bash
# Install new dependencies
docker-compose exec app npm install <package_name>

# Run tests
docker-compose exec app npm test

# View application logs
docker-compose exec app npm run logs

# Access container shell
docker-compose exec app sh
```

## 🔄 Deployment Workflows

### Production Deployment
```bash
#!/bin/bash
# Production deployment script

echo "🚀 Starting production deployment..."

# Stop existing containers
docker-compose down

# Build fresh containers
docker-compose build --no-cache

# Start services
docker-compose up -d

# Wait for database startup
echo "⏳ Waiting for database..."
sleep 15

# Generate Prisma client
echo "📦 Generating Prisma client..."
docker-compose exec app npm run generate

# Run migrations
echo "🗄️ Running database migrations..."
docker-compose exec app npm run migrate

# Check deployment status
echo "✅ Checking services..."
docker-compose ps
docker-compose logs --tail=50 app

echo "🎉 Production deployment complete!"
echo "📍 App running at: http://202.10.36.217:3333"
```

### Development Setup
```bash
#!/bin/bash
# Development setup with sample data

echo "🛠️ Setting up development environment..."

docker-compose up -d
sleep 10

# Database setup
docker-compose exec app npm run generate
docker-compose exec app npm run migrate
docker-compose exec app npm run seed

echo "✅ Development setup complete with sample data!"
```

## 🔍 Troubleshooting

### Common Issues

#### 1. Build Fails with Network Error
```bash
# Clear Docker cache
docker system prune -a

# Rebuild with verbose output
DOCKER_BUILDKIT=1 docker-compose build --no-cache --progress=plain
```

#### 2. Database Connection Error
```bash
# Check database status
docker-compose logs db

# Restart database
docker-compose restart db

# Wait for database to be ready
docker-compose exec db pg_isready -U postgres -d manpro
```

#### 3. Permission Issues
```bash
# Fix storage permissions
docker-compose exec app chmod -R 755 /usr/src/app/src/code/storage

# Check user ownership
docker-compose exec app ls -la /usr/src/app/src/code/storage
```

#### 4. App Won't Start
```bash
# Check app logs
docker-compose logs app

# Regenerate Prisma client
docker-compose exec app npm run generate

# Check environment variables
docker-compose exec app env | grep DATABASE_URL
```

### Health Checks

#### Service Health
```bash
# Check all services
docker-compose ps

# Test database connection
docker-compose exec db pg_isready -U postgres -d manpro

# Test app health endpoint
curl -f http://202.10.36.217:3333/api/health
```

#### Performance Monitoring
```bash
# Monitor resource usage
docker stats

# Check container logs
docker-compose logs --tail=100 -f app

# Monitor database queries
docker-compose exec db psql -U postgres -d manpro -c "SELECT * FROM pg_stat_activity;"
```

## 📊 Monitoring & Maintenance

### Log Management
```bash
# View recent logs
docker-compose logs --tail=100 app

# Follow logs in real-time
docker-compose logs -f app

# Export logs to file
docker-compose logs app > app-logs.txt
```

### Backup & Restore
```bash
# Create database backup
docker-compose exec db pg_dump -U postgres manpro > backup-$(date +%Y%m%d_%H%M%S).sql

# Create full backup including volumes
docker run --rm -v backend-takumifahri_postgres_data:/volume -v $(pwd):/backup alpine tar czf /backup/postgres-backup-$(date +%Y%m%d_%H%M%S).tar.gz /volume

# Restore database
docker-compose exec -i db psql -U postgres manpro < backup.sql
```

### Updates & Maintenance
```bash
# Update Docker images
docker-compose pull

# Rebuild after code changes
docker-compose build --no-cache app

# Clean unused Docker resources
docker system prune -f

# Update dependencies
docker-compose exec app npm update
```

## 🔐 Security Considerations

### Environment Variables
- Never commit sensitive data to repository
- Use strong passwords for production
- Regularly rotate JWT secrets
- Monitor access logs

### Network Security
```bash
# Check exposed ports
docker-compose ps

# Review network configuration
docker network ls
docker network inspect backend-takumifahri_app-network
```

### Database Security
```bash
# Change default passwords
# Update docker-compose.yml with strong passwords

# Regular security updates
docker-compose pull
docker-compose up -d
```

## 📱 API Endpoints

### Health Check
```bash
GET http://202.10.36.217:3333/api/health
```

### Main Endpoints
```bash
# Authentication
POST http://202.10.36.217:3333/api/auth/login

# Ruangan
GET http://202.10.36.217:3333/api/ruangan

# Admin
GET http://202.10.36.217:3333/api/admin/users
```

## 🆘 Support

### Getting Help
1. Check logs: `docker-compose logs app`
2. Verify services: `docker-compose ps`
3. Test connectivity: `curl http://202.10.36.217:3333/api/health`
4. Review this documentation

### Useful Resources
- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Node.js Documentation](https://nodejs.org/docs/)

---

**Last Updated**: November 2025  
**Version**: 1.0.0  
**Environment**: Production (VPS: 202.10.36.217)
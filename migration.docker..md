# Generate Prisma client dulu
docker-compose exec app npm run generate

# Jalankan migrasi
docker-compose exec app npm run migrate

# Lalu jalankan seeder
docker-compose exec app npm run seed
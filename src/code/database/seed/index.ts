async function runSeeds() {
  console.log("🚀 Starting database seeding...");

  try {
    // Import and run seeds sequentially
    console.log("\n1️⃣ Running user seed...");
    await import('./userSeed');
    console.log("\n4️⃣ Running mata kuliah seed...");
    await import('./matkulSeed');

    console.log("\n2️⃣ Running barang seed...");
    await import('./barangSeed');

    console.log("\n3️⃣ Running ruangan seed...");
    await import('./ruanganSeed');

    console.log("\n🎉 All seeds completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

runSeeds();
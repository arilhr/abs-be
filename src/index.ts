import "dotenv/config";
import app from "./app";
import prisma from "./prisma";

const PORT = process.env.PORT || 3000;

async function main() {
  app.listen(PORT, () =>
    console.log(`Server running on http://localhost:${PORT}`)
  );
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
});

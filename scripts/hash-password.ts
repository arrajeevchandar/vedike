import { hash } from "bcryptjs";

async function main() {
  const password = process.argv.slice(2).find((value) => value !== "--");
  if (!password) {
    console.error("Usage: pnpm admin:hash -- \"your strong password\"");
    process.exitCode = 1;
    return;
  }
  console.log(await hash(password, 12));
}

void main();

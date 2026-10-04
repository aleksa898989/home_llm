import path from "node:path";
import { hashPassword, randomPassword } from "./auth/password.ts";
import { openDatabase } from "./db.ts";
import { loadEnv } from "./env.ts";
import { createServices } from "./services.ts";

const USAGE = `Usage:
  admin list
  admin create <username>          create an approved admin with a random password
  admin reset-password <username>  set a random password and sign them out everywhere
  admin make-admin <username>      approve and promote an existing user`;

const { users, sessions } = createServices(
  openDatabase(path.join(loadEnv().dataDir, "home_llm.db")),
);
const [command, username] = process.argv.slice(2);

const findUser = (name: string | undefined) => {
  const found = name ? users.findCredentials(name) : undefined;
  if (!found) {
    console.error(`No user "${name ?? ""}"`);
    process.exit(1);
  }
  return found.user;
};

switch (command) {
  case "list":
    for (const u of users.list())
      console.log(
        `${u.username.padEnd(20)} ${u.isAdmin ? "admin" : "user "}  ${u.approved ? "approved" : "pending"}`,
      );
    break;

  case "create": {
    if (!username) {
      console.error(USAGE);
      process.exit(1);
    }
    const password = randomPassword();
    users.create(username, await hashPassword(password), { admin: true, approved: true });
    console.log(`Created admin "${username}" with password: ${password}`);
    break;
  }

  case "reset-password": {
    const user = findUser(username);
    const password = randomPassword();
    users.update(user.id, { passwordHash: await hashPassword(password) });
    sessions.destroyAllFor(user.id);
    console.log(`New password for ${user.username}: ${password}`);
    break;
  }

  case "make-admin": {
    const user = findUser(username);
    users.update(user.id, { isAdmin: true, approved: true });
    console.log(`${user.username} is now an approved admin`);
    break;
  }

  default:
    console.log(USAGE);
}

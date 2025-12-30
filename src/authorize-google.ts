import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";
import readline from "readline";

const SCOPES = ["https://www.googleapis.com/auth/drive.file"];
const TOKEN_PATH = path.join(process.cwd(), "token.json");
const CREDENTIALS_PATH = path.join(process.cwd(), "oauth-credentials.json");

async function authorize() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    console.error("oauth-credentials.json not found!");
    console.log("\nSteps to get credentials:");
    console.log("1. Go to https://console.cloud.google.com");
    console.log("2. Create/select project");
    console.log("3. Enable Google Drive API");
    console.log("4. Create OAuth 2.0 Client ID (Desktop app)");
    console.log("5. Download JSON and save as oauth-credentials.json");
    process.exit(1);
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  const { client_id, client_secret, redirect_uris } =
    credentials.installed || credentials.web;

  const oAuth2Client = new OAuth2Client(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });

  console.log("Authorize this app by visiting this url:", authUrl);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter the code from that page here: ", async (code) => {
    rl.close();
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);

      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
      console.log("\n✅ Token stored to", TOKEN_PATH);
      console.log("You can now run your backup service!");
    } catch (err) {
      console.error("Error retrieving access token", err);
    }
  });
}

authorize();

import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import fs from "fs";
import path from "path";

export const uploadToDrive = async (filePath: string, mimeType?: string) => {
  try {
    console.log("🔐 Authenticating with Google Drive...");

    if (!fs.existsSync(filePath)) {
      throw new Error(`❌ File not found: ${filePath}`);
    }

    // Load credentials & token
    const credentialsPath = path.join(process.cwd(), "oauth-credentials.json");
    const tokenPath = path.join(process.cwd(), "token.json");

    if (!fs.existsSync(credentialsPath)) {
      throw new Error("❌ oauth-credentials.json not found!");
    }

    if (!fs.existsSync(tokenPath)) {
      throw new Error("❌ token.json not found! Run authorization first.");
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf-8"));
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf-8"));

    const { client_id, client_secret, redirect_uris } =
      credentials.installed || credentials.web;

    const oAuth2Client = new OAuth2Client(
      client_id,
      client_secret,
      redirect_uris[0]
    );

    oAuth2Client.setCredentials(token);

    const drive = google.drive({ version: "v3", auth: oAuth2Client });

    console.log("✅ Authentication successful!");

    // ===== FILE INFO =====
    const fileName = path.basename(filePath);
    const resolvedMimeType = mimeType || "text/plain";

    console.log("📄 File:", fileName);
    console.log("📦 Mime Type:", resolvedMimeType);

    // OPTIONAL: Folder ID
    const folderId = process.env.GDRIVE_FOLDER_ID || null;

    if (folderId) {
      console.log(`📁 Uploading to folder ID: ${folderId}`);
    } else {
      console.log("📁 Uploading to root directory");
    }

    const fileMetadata: any = {
      name: fileName,
    };

    if (folderId) {
      fileMetadata.parents = [folderId];
    }

    const media = {
      mimeType: resolvedMimeType,
      body: fs.createReadStream(filePath),
    };

    // ===== UPLOAD =====
    console.log("📤 Uploading to Google Drive...");

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: "id, name, webViewLink, parents",
    });

    console.log("\n✅ Upload successful!");
    console.log("📁 File Name:", response.data.name);
    console.log("🆔 File ID:", response.data.id);
    console.log("🔗 View Link:", response.data.webViewLink);

    return response.data;
  } catch (error: any) {
    console.error("\n❌ Upload failed!");
    console.error("Error:", error.message);

    if (error.message?.includes("invalid_grant")) {
      console.log("\n💡 Tip: Token expired. Run authorization again:");
      console.log("   npm run authorize:gdrive");
    }

    throw error;
  }
};

const { Octokit } = require("@octokit/rest");
const { createHmac } = require("crypto");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { pipeline } = require("stream");
const { promisify: promisifyStream } = require("util");
const streamPipeline = promisifyStream(pipeline);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PHOTOS = 10;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = process.env.BRIEFING_SECRET;
  if (!secret) {
    console.error("BRIEFING_SECRET is not set");
    return { statusCode: 500, body: "Internal Server Error" };
  }

  const signature = event.headers["x-briefing-signature"];
  if (!signature) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const body = JSON.parse(event.body);
  const computedSignature = createHmac("sha256", secret).update(event.body).digest("hex");
  if (!secureCompare(signature, computedSignature)) {
    return { statusCode: 401, body: "Unauthorized" };
  }

  const { codigo, slug, briefing, midia } = body;
  if (!codigo || !slug || !briefing || !Array.isArray(midia)) {
    return { statusCode: 400, body: "Invalid payload" };
  }

  if (midia.length > MAX_PHOTOS) {
    return { statusCode: 400, body: "Too many photos" };
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "briefing-"));
  try {
    const files = [];
    for (const file of midia) {
      if (file.size > MAX_FILE_SIZE) {
        return { statusCode: 400, body: "File too large" };
      }
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return { statusCode: 400, body: "Invalid file type" };
      }
      const filePath = path.join(tempDir, file.name);
      await streamPipeline(Buffer.from(file.data, "base64"), fs.createWriteStream(filePath));
      files.push(filePath);
    }

    const branchName = `nexia/cliente-${slug}`;
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

    // Create branch if it doesn't exist
    try {
      await octokit.git.getRef({ owner: "gilcambe", repo: "nexia", ref: `heads/${branchName}` });
    } catch (error) {
      const { data: mainRef } = await octokit.git.getRef({ owner: "gilcambe", repo: "nexia", ref: "heads/main" });
      await octokit.git.createRef({ owner: "gilcambe", repo: "nexia", ref: `refs/heads/${branchName}`, sha: mainRef.object.sha });
    }

    // Prepare files for commit
    const filesToCommit = [];
    const briefingPath = `clientes/${slug}/briefing.json`;
    const briefingContent = JSON.stringify(briefing, null, 2);
    filesToCommit.push({ path: briefingPath, content: briefingContent });

    for (const file of files) {
      const mediaPath = `clientes/${slug}/midia/${path.basename(file)}`;
      const content = fs.readFileSync(file, { encoding: "base64" });
      filesToCommit.push({ path: mediaPath, content });
    }

    // Create commit
    const { data: latestCommit } = await octokit.repos.getBranch({ owner: "gilcambe", repo: "nexia", branch: branchName });
    const tree = await octokit.git.createTree({
      owner: "gilcambe",
      repo: "nexia",
      base_tree: latestCommit.commit.sha,
      tree: filesToCommit.map((file) => ({
        path: file.path,
        mode: "100644",
        type: "blob",
        content: file.content,
      })),
    });

    const commit = await octokit.git.createCommit({
      owner: "gilcambe",
      repo: "nexia",
      message: `Briefing recebido para ${slug}`,
      tree: tree.sha,
      parents: [latestCommit.commit.sha],
    });

    await octokit.git.updateRef({
      owner: "gilcambe",
      repo: "nexia",
      ref: `heads/${branchName}`,
      sha: commit.sha,
    });

    // Trigger GitHub Action
    await octokit.actions.createWorkflowDispatch({
      owner: "gilcambe",
      repo: "nexia",
      workflow_id: "lote-sites.yml",
      ref: branchName,
      inputs: {
        slugs: slug,
        publicar: "previa",
      },
    });

    return { statusCode: 200, body: "Briefing processed successfully" };
  } catch (error) {
    console.error("Error processing briefing:", error);
    return { statusCode: 500, body: "Internal Server Error" };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

function secureCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

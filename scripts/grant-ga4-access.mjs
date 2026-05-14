#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { SignJWT, importPKCS8 } from "jose";

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (!current.startsWith("--")) {
      continue;
    }

    const key = current.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function requiredArg(args, key) {
  const value = args[key];
  if (!value || typeof value !== "string") {
    throw new Error(`Missing required argument --${key}`);
  }
  return value;
}

function helpText() {
  return `
Usage:
  node scripts/grant-ga4-access.mjs \\
    --service-account "C:\\path\\to\\key.json" \\
    --property 512274060 \\
    --user ga4-reader@energdive.iam.gserviceaccount.com \\
    --role predefinedRoles/viewer \\
    --enable-admin-api

Notes:
  - This uses the GA4 Admin API accessBindings endpoint.
  - The caller must already have GA4 user-management permission.
  - If you authenticate using the same service account you are trying to grant,
    and that account does not already have admin access, Google will reject it.
  - If the Admin API is disabled on the GCP project, pass --enable-admin-api
    to first call Service Usage and enable analyticsadmin.googleapis.com.
`.trim();
}

async function loadServiceAccount(path) {
  const raw = await readFile(path, "utf8");
  const json = JSON.parse(raw);

  if (json.type !== "service_account") {
    throw new Error("The JSON file is not a Google service_account key.");
  }

  for (const field of ["client_email", "private_key", "token_uri"]) {
    if (!json[field]) {
      throw new Error(`Service account file is missing "${field}".`);
    }
  }

  return json;
}

async function createAccessToken(serviceAccount, scope) {
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(serviceAccount.private_key, "RS256");

  const assertion = await new SignJWT({ scope })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setAudience(serviceAccount.token_uri)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  const tokenJson = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok) {
    const detail =
      tokenJson.error_description ||
      tokenJson.error ||
      `Token request failed with HTTP ${tokenResponse.status}`;
    throw new Error(detail);
  }

  if (!tokenJson.access_token) {
    throw new Error("OAuth token response did not contain access_token.");
  }

  return tokenJson.access_token;
}

async function enableAdminApi({ accessToken, projectRef }) {
  const response = await fetch(
    `https://serviceusage.googleapis.com/v1/projects/${encodeURIComponent(
      projectRef
    )}/services/analyticsadmin.googleapis.com:enable`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: json.error?.message || `Enable request failed with HTTP ${response.status}`,
      json,
    };
  }

  return {
    ok: true,
    json,
  };
}

async function pollOperation({ accessToken, operationName, timeoutMs = 120000 }) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const response = await fetch(
      `https://serviceusage.googleapis.com/v1/${operationName}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: json.error?.message || `Operation poll failed with HTTP ${response.status}`,
        json,
      };
    }

    if (json.done) {
      return {
        ok: true,
        json,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  return {
    ok: false,
    message: `Timed out waiting for operation ${operationName}`,
  };
}

async function createAccessBinding({ accessToken, propertyId, userEmail, role }) {
  const response = await fetch(
    `https://analyticsadmin.googleapis.com/v1alpha/properties/${propertyId}/accessBindings`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessBinding: {
          user: userEmail,
          roles: [role],
        },
      }),
    }
  );

  const json = await response.json().catch(() => ({}));

  if (response.ok) {
    return { ok: true, json };
  }

  const message =
    json.error?.message ||
    `Access binding request failed with HTTP ${response.status}`;

  return {
    ok: false,
    status: response.status,
    message,
    json,
  };
}

async function listAccessBindings({ accessToken, propertyId }) {
  const response = await fetch(
    `https://analyticsadmin.googleapis.com/v1alpha/properties/${propertyId}/accessBindings`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      message: json.error?.message || `List failed with HTTP ${response.status}`,
      json,
    };
  }

  return {
    ok: true,
    json,
  };
}

function summarizeFailure(result, targetEmail) {
  const message = String(result.message || "");

  if (result.status === 403) {
    return [
      "Google denied the access grant.",
      "Most likely cause: this service account does not already have GA4 admin/user-management access.",
      `Target principal: ${targetEmail}`,
      `API message: ${message}`,
      "",
      "Fix:",
      "1. Use an existing GA4 Admin principal to call properties.accessBindings.create, or",
      "2. Have an existing Admin grant this service account access first.",
    ].join("\n");
  }

  if (result.status === 409) {
    return `Access binding already exists for ${targetEmail}.`;
  }

  return `Request failed: ${message}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    console.log(helpText());
    return;
  }

  const serviceAccountPath = requiredArg(args, "service-account");
  const propertyId = requiredArg(args, "property");
  const userEmail = requiredArg(args, "user");
  const role = args.role || "predefinedRoles/viewer";
  const requestedScopes = [
    args.scope || "https://www.googleapis.com/auth/analytics.manage.users",
  ];

  if (args["enable-admin-api"]) {
    requestedScopes.push("https://www.googleapis.com/auth/cloud-platform");
  }

  const scope = requestedScopes.join(" ");

  console.log(`Loading service account: ${serviceAccountPath}`);
  console.log(`Property: ${propertyId}`);
  console.log(`Grant user: ${userEmail}`);
  console.log(`Role: ${role}`);

  const serviceAccount = await loadServiceAccount(serviceAccountPath);
  const accessToken = await createAccessToken(serviceAccount, scope);

  if (args["enable-admin-api"]) {
    console.log(
      `Attempting to enable analyticsadmin.googleapis.com on project ${serviceAccount.project_id}...`
    );

    const enableResult = await enableAdminApi({
      accessToken,
      projectRef: serviceAccount.project_id,
    });

    if (!enableResult.ok) {
      console.error(
        `Could not enable analyticsadmin.googleapis.com: ${enableResult.message}`
      );
      process.exit(1);
    }

    const operationName = enableResult.json.name;
    if (operationName) {
      const operationResult = await pollOperation({
        accessToken,
        operationName,
      });

      if (!operationResult.ok) {
        console.error(
          `Enable request started but could not confirm completion: ${operationResult.message}`
        );
        process.exit(1);
      }
    }

    console.log("analyticsadmin.googleapis.com is enabled or enablement completed.");
  }

  const createResult = await createAccessBinding({
    accessToken,
    propertyId,
    userEmail,
    role,
  });

  if (!createResult.ok) {
    console.error(summarizeFailure(createResult, userEmail));

    if (args["check-existing"]) {
      const existing = await listAccessBindings({ accessToken, propertyId });
      if (existing.ok) {
        const match = (existing.json.accessBindings || []).find(
          (binding) => binding.user?.toLowerCase() === userEmail.toLowerCase()
        );
        if (match) {
          console.log("Existing binding found:");
          console.log(JSON.stringify(match, null, 2));
          process.exit(0);
        }
      }
    }

    process.exit(1);
  }

  console.log("Access binding created successfully:");
  console.log(JSON.stringify(createResult.json, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

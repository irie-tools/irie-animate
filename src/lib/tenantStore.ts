import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export type TenantSettings = {
  id: string;
  slug: string;
  workspaceName: string;
  ownerName: string;
  ownerInitials: string;
  plan: "Studio" | "Pro" | "Agency";
  status: "Trial" | "Active" | "Paused";
  primaryDomain: string;
  billingEmail: string;
  createdAt: string;
  updatedAt: string;
  limits: {
    projects: number;
    sourceMinutes: number;
    monthlyExports: number;
  };
  features: {
    publicFrontDoor: boolean;
    videoSourceCook: boolean;
    exportPackages: boolean;
    requireApproval: boolean;
  };
  onboarding: Array<{ label: string; done: boolean }>;
};

const tenantsDir = resolve(process.cwd(), ".irie-animate", "tenants");
const tenantPath = resolve(tenantsDir, "ak.json");

export async function readTenant(): Promise<TenantSettings> {
  await ensureTenant();
  return normalizeTenant(JSON.parse(await readFile(tenantPath, "utf8")) as TenantSettings);
}

export async function updateTenant(patch: Partial<TenantSettings>): Promise<TenantSettings> {
  const current = await readTenant();
  const next: TenantSettings = {
    ...current,
    ...patch,
    limits: patch.limits ? { ...current.limits, ...patch.limits } : current.limits,
    features: patch.features ? { ...current.features, ...patch.features } : current.features,
    onboarding: patch.onboarding ?? current.onboarding,
    updatedAt: new Date().toISOString()
  };
  await mkdir(tenantsDir, { recursive: true });
  await writeFile(tenantPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

async function ensureTenant() {
  if (existsSync(tenantPath)) return;
  await mkdir(tenantsDir, { recursive: true });
  await writeFile(tenantPath, `${JSON.stringify(createSeedTenant(), null, 2)}\n`, "utf8");
}

function normalizeTenant(tenant: TenantSettings): TenantSettings {
  return {
    ...tenant,
    ownerInitials: tenant.ownerInitials || initialsFromName(tenant.ownerName),
    limits: {
      projects: tenant.limits?.projects ?? 3,
      sourceMinutes: tenant.limits?.sourceMinutes ?? 30,
      monthlyExports: tenant.limits?.monthlyExports ?? 12
    },
    features: {
      publicFrontDoor: tenant.features?.publicFrontDoor ?? true,
      videoSourceCook: tenant.features?.videoSourceCook ?? true,
      exportPackages: tenant.features?.exportPackages ?? true,
      requireApproval: tenant.features?.requireApproval ?? false
    },
    onboarding: tenant.onboarding ?? []
  };
}

function createSeedTenant(): TenantSettings {
  const createdAt = new Date().toISOString();
  return {
    id: "tenant-ak",
    slug: "ak",
    workspaceName: "Aurelia Studio",
    ownerName: "Aurelia Keeper",
    ownerInitials: "AK",
    plan: "Studio",
    status: "Trial",
    primaryDomain: "aurelia.local",
    billingEmail: "studio@example.com",
    createdAt,
    updatedAt: createdAt,
    limits: {
      projects: 3,
      sourceMinutes: 30,
      monthlyExports: 12
    },
    features: {
      publicFrontDoor: true,
      videoSourceCook: true,
      exportPackages: true,
      requireApproval: false
    },
    onboarding: [
      { label: "Confirm tenant identity", done: true },
      { label: "Upload reference kit", done: false },
      { label: "Map video sources", done: false },
      { label: "Cook first scroll preview", done: true },
      { label: "Prepare export package", done: false }
    ]
  };
}

function initialsFromName(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "AK";
}

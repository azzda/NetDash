declare module "virtual:netdash-manifest" {
  export interface AppManifest {
    generatedAt: string;
    workspaceVersion: string;
    packageManager: string;
    packages: Array<{
      name: string;
      version: string;
    }>;
    dependencyGroups: Array<{
      name: string;
      items: string[];
    }>;
  }

  export const appManifest: AppManifest;
}
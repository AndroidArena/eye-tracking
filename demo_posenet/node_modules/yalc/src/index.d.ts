/// <reference types="node" />
import { ExecSyncOptions } from 'child_process';
import { PackageName } from './installations';
export declare const values: {
    myNameIs: string;
    ignoreFileName: string;
    myNameIsCapitalized: string;
    lockfileName: string;
    yalcPackagesFolder: string;
    prescript: string;
    postscript: string;
    installationsFile: string;
};
export interface AddPackagesOptions {
    dev?: boolean;
    link?: boolean;
    yarn?: boolean;
    safe?: boolean;
    workingDir: string;
}
export interface UpdatePackagesOptions {
    safe?: boolean;
    workingDir: string;
}
export { publishPackage } from './publish';
export { updatePackages } from './update';
export { checkManifest } from './check';
export { removePackages } from './remove';
export { addPackages } from './add';
export interface YalcGlobal extends NodeJS.Global {
    yalcStoreMainDir: string;
}
export declare const yalcGlobal: YalcGlobal;
export declare function getStoreMainDir(): string;
export declare function getStorePackagesDir(): string;
export declare const getPackageStoreDir: (packageName: string, version?: string) => string;
export declare type PackageScripts = Partial<{
    preinstall: string;
    postupdate: string;
    postpush: string;
    prepack: string;
    prepare: string;
    install: string;
    prepublish: string;
    prepublishOnly: string;
    postpublish: string;
    preyalc: string;
    postyalc: string;
}>;
export interface PackageManifest {
    name: string;
    version: string;
    private?: boolean;
    bin?: string | {
        [name: string]: string;
    };
    dependencies?: {
        [name: string]: string;
    };
    devDependencies?: {
        [name: string]: string;
    };
    yalc: Partial<{
        sig: boolean;
        signature: boolean;
        noSig: boolean;
    }>;
    workspaces?: string[];
    scripts?: PackageScripts;
    __JSONSpaces: number;
}
export declare const getPackageManager: (cwd: string) => "yarn" | "npm";
export declare const getPackageManagerInstallCmd: (cwd: string) => "yarn" | "npm install";
export declare const execLoudOptions: ExecSyncOptions;
export declare const parsePackageName: (packageName: string) => {
    name: PackageName;
    version: string;
};
export declare function readPackageManifest(workingDir: string): PackageManifest | null;
export declare const readSignatureFile: (workingDir: string) => string;
export declare const readIgnoreFile: (workingDir: string) => string;
export declare const writeSignatureFile: (workingDir: string, signature: string) => void;
export declare function writePackageManifest(workingDir: string, pkg: PackageManifest): void;
export declare const isYarn: (cwd: string) => boolean;
export declare const runOrWarnPackageManagerInstall: (workingDir: string, doRun?: boolean | undefined) => void;

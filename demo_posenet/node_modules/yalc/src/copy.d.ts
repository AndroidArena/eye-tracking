import { PackageManifest } from '.';
export declare const getFileHash: (srcPath: string, relPath?: string) => Promise<string>;
export declare const copyPackageToStore: (pkg: PackageManifest, options: {
    workingDir: string;
    signature?: boolean | undefined;
    changed?: boolean | undefined;
    knit?: boolean | undefined;
    files?: boolean | undefined;
}) => Promise<string | false>;

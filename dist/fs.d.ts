export declare function ensureDir(dirPath: string): Promise<void>;
export declare function writeFileIfMissing(filePath: string, content: string): Promise<void>;
export declare function writeText(filePath: string, content: string): Promise<void>;
export declare function readTextOrEmpty(filePath: string): Promise<string>;

declare module "ali-oss" {
  import type { Readable } from "stream";

  interface PutObjectResult {
    name: string;
    url: string;
    res: { status: number };
  }

  class OSS {
    constructor(options: {
      region: string;
      accessKeyId: string;
      accessKeySecret: string;
      bucket: string;
    });
    put(
      name: string,
      file: Buffer | Readable | string,
      options?: { headers?: Record<string, string> }
    ): Promise<PutObjectResult>;
  }
  export default OSS;
}

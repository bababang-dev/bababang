import OSS from "ali-oss";

export function getOSSClient() {
  return new OSS({
    region: process.env.OSS_REGION || "oss-cn-hongkong",
    accessKeyId: process.env.OSS_ACCESS_KEY_ID || "LTAI5tRkCQYKHLtucQESJBQx",
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || "qXDXEfvX6EGZqZ5j9f1VTcJkiB0Ipp",
    bucket: process.env.OSS_BUCKET || "bababang-files",
  });
}

import { PreflightWorkspace } from "@/components/postlint/preflight-workspace";
import { getUploadConfig } from "@/lib/postlint/config/upload";

export default function Home() {
  return <PreflightWorkspace uploadConfig={getUploadConfig()} />;
}
